import sys
import re

with open(r'h:\project\CLIP JIANJI\src-tauri\src\lib.rs', 'r', encoding='utf-8') as f:
    text = f.read()

start_str = "#[tauri::command]\nasync fn generate_video"
start_idx = text.find(start_str)
end_str = "#[tauri::command]\nasync fn get_preview_url"
end_idx = text.find(end_str)

new_fn = r"""#[tauri::command]
async fn generate_video(app: tauri::AppHandle, payload: VideoPayload) -> Result<String, String> {
    let items = payload.items;
    let fps = payload.fps;
    let res = payload.resolution;
    let quality = payload.quality;
    let codec = payload.codec;
    let hdr = payload.hdr;

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let temp_dir = app_data_dir.join("segments_v2");
    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    if items.is_empty() {
        return Err("时间轴素材为空，请先添加图片或视频！".to_string());
    }

    let resolution = if res == "original" { "1920:1080" } else { res.as_str() };
    let res_parts: Vec<&str> = resolution.split(':').collect();
    let res_w = res_parts[0];
    let res_h = res_parts[1];
    let ffmpeg_path = resolve_ffmpeg_path(&app);

    let cpu_count = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let want_h265 = codec == "h265";
    let (encoder_name, encoder_family) = detect_best_encoder(&ffmpeg_path, want_h265);

    let final_output = if let Some(path) = &payload.output_path {
        std::path::PathBuf::from(path)
    } else {
        app.path().desktop_dir().map_err(|e| e.to_string())?
            .join(format!("output_{}.mp4", chrono::Local::now().format("%Y%m%d_%H%M%S")))
    };

    // 【智能硬件探针 (Dynamic Hardware Probing)】
    let max_threads = if encoder_family == "cpu" {
        (cpu_count as f32 * 0.8) as usize 
    } else {
        if cpu_count >= 16 {
            4 // 发烧级配置 (如 Ryzen 9700X)，放开 4 路 GPU 并发压榨性能
        } else if cpu_count >= 8 {
            3 // 主流机器
        } else {
            2 // 轻薄本，保护显存
        }
    };

    let pool = rayon::ThreadPoolBuilder::new().num_threads(max_threads).build().unwrap();

    let _ = app.emit("export-progress", ProgressPayload { progress: 2.0 });

    let completed_items = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let total_items = items.len();

    // 独立循环渲染
    use rayon::prelude::*;
    let segment_results: Vec<Result<std::path::PathBuf, String>> = pool.install(|| {
        items.par_iter().enumerate().map(|(i, item)| {
            let seg_output = temp_dir.join(format!("clip_{:04}.mp4", i));
            
            let mut vf = vec![];
            match item.rotation.unwrap_or(0) {
                90 => vf.push("transpose=1".to_string()),
                180 => vf.push("hflip,vflip".to_string()),
                270 => vf.push("transpose=2".to_string()),
                _ => {}
            }
            if item.flip_x.unwrap_or(false) { vf.push("hflip".to_string()); }
            if item.flip_y.unwrap_or(false) { vf.push("vflip".to_string()); }
            
            let c = item.contrast.unwrap_or(1.0);
            let s = item.saturation.unwrap_or(1.0);
            if c != 1.0 || s != 1.0 { vf.push(format!("eq=contrast={}:saturation={}", c, s)); }
            
            if let Some(text) = &item.overlay_text {
                if !text.trim().is_empty() {
                    let safe_text = text.replace(":", "\\:").replace("'", "\\'");
                    let font_size = item.font_size.unwrap_or(80.0) * 1.5;
                    let font_color = item.font_color.as_deref().unwrap_or("white").replace("#", "0x");
                    
                    let align = item.text_align.as_deref().unwrap_or("center");
                    let (x_expr, y_expr) = match align {
                        "left" => ("100", "h-th-100"),
                        "right" => ("w-text_w-100", "h-th-100"),
                        _ => ("(w-text_w)/2", "h-th-100")
                    };

                    let mut dt = format!("drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':text='{}':fontcolor='{}':fontsize={}:x={}:y={}", safe_text, font_color, font_size, x_expr, y_expr);

                    if item.text_stroke.unwrap_or(false) {
                        let stroke_color = item.text_stroke_color.as_deref().unwrap_or("black").replace("#", "0x");
                        let stroke_w = item.text_stroke_width.unwrap_or(4.0);
                        dt.push_str(&format!(":borderw={}:bordercolor='{}'", stroke_w, stroke_color));
                    }
                    if item.text_shadow.unwrap_or(false) {
                        let shadow_color = item.text_shadow_color.as_deref().unwrap_or("black").replace("#", "0x") + "80";
                        dt.push_str(&format!(":shadowx=6:shadowy=6:shadowcolor='{}'", shadow_color));
                    }
                    if item.text_bg_enable.unwrap_or(false) {
                        let bg_color = item.text_bg.as_deref().unwrap_or("black").replace("#", "0x") + "B3";
                        dt.push_str(&format!(":box=1:boxcolor='{}':boxborderw={}", bg_color, item.text_bg_padx.unwrap_or(20.0)));
                    }
                    vf.push(dt);
                }
            }
            if let Some(cp) = &item.crop_pos {
                vf.push(format!("crop=iw*{}/100:ih*{}/100:iw*{}/100:ih*{}/100", cp.width, cp.height, cp.x, cp.y));
            }
            
            if item.fill_mode.as_deref() == Some("cover") {
                vf.push(format!("scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}:(iw-ow)/2:(ih-oh)/2,format=yuv420p,setsar=1", res_w, res_h, res_w, res_h));
            } else {
                vf.push(format!("scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p,setsar=1", res_w, res_h, res_w, res_h));
            }
            
            // 【解复用器循环 (-loop 1) 判断】
            let anim = item.animation.as_deref().unwrap_or("none");
            let is_video = item.path.to_lowercase().ends_with(".mp4") || item.path.to_lowercase().ends_with(".mov") || item.path.to_lowercase().ends_with(".webm");
            let is_zoom_anim = anim.contains("zoom") || anim.contains("pan");
            
            // 只有没有任何 Zoom 滤镜的静态图片才能使用输入极速循环
            let use_input_loop = !is_video && !is_zoom_anim;

            if is_video {
                vf.push(format!("fps={}", fps));
                vf.push(format!("trim=duration={}", item.duration));
            } else {
                if is_zoom_anim {
                    let dur_frames = (item.duration * fps as f32) as u32;
                    if anim.contains("zoomIn") {
                        vf.push(format!("zoompan=z='min(pzoom+0.0015,1.5)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    } else if anim.contains("zoomOut") {
                        vf.push(format!("zoompan=z='max(1.5-0.0015*in,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    } else if anim.contains("panRight") {
                        vf.push(format!("zoompan=z=1.1:x='min(x+2,iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    } else if anim.contains("panLeft") {
                        vf.push(format!("zoompan=z=1.1:x='max(iw-iw/zoom-in*2,0)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    }
                    if anim.contains("fadeIn") || anim.contains("slide") {
                        vf.push("fade=t=in:st=0:d=1.0".to_string());
                    }
                } else {
                    if !use_input_loop {
                        vf.push("loop=loop=-1:size=1:start=0".to_string());
                        vf.push(format!("fps={}", fps));
                        vf.push(format!("trim=duration={}", item.duration));
                    }
                    if anim.contains("fadeIn") || anim.contains("slide") {
                        vf.push("fade=t=in:st=0:d=1.0".to_string());
                    }
                }
            }
            vf.push("setpts=PTS-STARTPTS".to_string());

            let is_dng = item.path.to_lowercase().ends_with(".dng");
            let final_path = if is_dng {
                let preview_dir = app_data_dir.join("previews");
                if !preview_dir.exists() { let _ = std::fs::create_dir_all(&preview_dir); }
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                let mut hasher = DefaultHasher::new();
                item.path.hash(&mut hasher);
                let p = preview_dir.join(format!("{:x}_render.jpg", hasher.finish()));
                extract_dng_preview(&item.path, &p, &ffmpeg_path, "scale=1920:-1").unwrap_or_else(|_| item.path.clone())
            } else {
                item.path.clone()
            };

            let mut cmd = Command::new(&ffmpeg_path);
            cmd.arg("-y")
               .arg("-threads").arg("2");

            if use_input_loop {
                // 极速黑科技：直接在流读取口做无限高速拷贝！
                cmd.arg("-loop").arg("1").arg("-framerate").arg(fps.to_string()).arg("-t").arg(item.duration.to_string());
            } else if is_video {
                // 如果是视频，提前截断输入流以节省解码时间
                cmd.arg("-t").arg(item.duration.to_string());
            }

            cmd.arg("-i").arg(final_path.replace("\\", "/"))
               .arg("-vf").arg(vf.join(","))
               .arg("-c:v").arg(&encoder_name)
               .arg("-an");

            if encoder_family == "amf" {
                cmd.arg("-usage").arg("transcoding"); 
            }

            if want_h265 && hdr {
                cmd.arg("-pix_fmt").arg("yuv420p10le").arg("-color_primaries").arg("bt2020").arg("-color_trc").arg("smpte2084").arg("-colorspace").arg("bt2020nc");
                if encoder_family == "cpu" { cmd.arg("-x265-params").arg("hdr10=1:repeat-headers=1:color-range=pc"); }
            }
            match encoder_family.as_str() {
                "nvenc" => {
                    let cq = if quality == "lossless" { "14" } else if quality == "high" { "18" } else { "24" };
                    let preset = if quality == "lossless" { "p7" } else if quality == "high" { "p4" } else { "p2" };
                    cmd.arg("-preset").arg(preset).arg("-rc").arg("vbr").arg("-cq").arg(cq).arg("-b:v").arg("0");
                }
                "amf" => {
                    let qp = if quality == "lossless" { "14" } else if quality == "high" { "18" } else { "24" };
                    let spd = if quality == "lossless" { "quality" } else if quality == "high" { "balanced" } else { "speed" };
                    cmd.arg("-quality").arg(spd).arg("-rc").arg("cqp").arg("-qp_i").arg(qp).arg("-qp_p").arg(qp);
                }
                "qsv" => {
                    let qp = if quality == "lossless" { "14" } else if quality == "high" { "18" } else { "24" };
                    let preset = if quality == "lossless" { "veryslow" } else if quality == "high" { "medium" } else { "fast" };
                    cmd.arg("-preset").arg(preset).arg("-look_ahead").arg("1").arg("-q").arg(qp);
                }
                _ => {
                    let (crf, preset) = if quality == "lossless" { ("15", "faster") } else if quality == "high" { ("18", "faster") } else { ("24", "superfast") };
                    cmd.arg("-crf").arg(crf).arg("-preset").arg(preset);
                }
            }
            cmd.arg(&seg_output).stdout(Stdio::null()).stderr(Stdio::piped());

            let mut child = match cmd.spawn() {
                Ok(c) => c,
                Err(e) => return Err(format!("生成分镜 {} 启动失败: {}", i, e)),
            };

            let status = match child.wait() {
                Ok(s) => s,
                Err(e) => return Err(format!("等待分镜 {} 失败: {}", i, e)),
            };

            if !status.success() {
                return Err(format!("分镜 {} 生成失败: 错误码 {}", i, status));
            }

            let done = completed_items.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            let progress = 2.0 + (done as f64 / total_items as f64) * 85.0; 
            let _ = app.emit("export-progress", ProgressPayload { progress });

            Ok(seg_output)
        }).collect()
    });

    for res in &segment_results {
        if let Err(e) = res {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(e.to_string());
        }
    }

    // 全极速流拼接
    let concat_list_path = temp_dir.join("concat_list.txt");
    let mut concat_list = String::new();
    for res in &segment_results {
        if let Ok(path) = res {
            concat_list.push_str(&format!("file '{}'\n", path.to_string_lossy().replace("\\", "/")));
        }
    }
    std::fs::write(&concat_list_path, &concat_list).map_err(|e| format!("写入拼合清单失败: {}", e))?;

    let mut final_cmd = Command::new(&ffmpeg_path);
    final_cmd.arg("-y").arg("-f").arg("concat").arg("-safe").arg("0").arg("-i").arg(&concat_list_path);

    let mut audio_inputs_count = 0;
    for clip in &payload.audio_clips {
        if let Some(res) = payload.resource_paths.iter().find(|r| r.id == clip.resource_id) {
            let audio_path = if res.path.starts_with("/audio/") {
                app.path().resolve(format!("public{}", res.path), tauri::path::BaseDirectory::Resource)
                    .map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| res.path.clone())
            } else { res.path.clone() };
            final_cmd.arg("-ss").arg(clip.start_offset.to_string())
                     .arg("-t").arg(clip.duration.to_string())
                     .arg("-i").arg(audio_path.replace("\\", "/"));
            audio_inputs_count += 1;
        }
    }

    for vo in &payload.voiceover_clips {
        final_cmd.arg("-i").arg(vo.file_path.replace("\\", "/"));
        audio_inputs_count += 1;
    }

    final_cmd.arg("-c:v").arg("copy");

    if audio_inputs_count > 0 {
        let mut afilt = String::new();
        for ai in 0..payload.audio_clips.len() {
            let clip = &payload.audio_clips[ai];
            if payload.resource_paths.iter().any(|r| r.id == clip.resource_id) {
                let mut filters = Vec::new();
                if (clip.volume - 1.0).abs() > 0.01 { filters.push(format!("volume={}", clip.volume)); }
                if let Some(fi) = clip.fade_in { if fi > 0.0 { filters.push(format!("afade=t=in:st=0:d={:.2}", fi)); } }
                if let Some(fo) = clip.fade_out { if fo > 0.0 { let os = (clip.duration - fo).max(0.0); filters.push(format!("afade=t=out:st={:.2}:d={:.2}", os, fo)); } }
                
                let lbl_in = format!("{}:a", ai + 1);
                let lbl_out = format!("m{}", ai);
                if filters.is_empty() {
                    afilt.push_str(&format!("[{}]anull[{}];", lbl_in, lbl_out));
                } else {
                    afilt.push_str(&format!("[{}]{}[{}];", lbl_in, filters.join(","), lbl_out));
                }
            }
        }
        
        let vo_offset = 1 + payload.audio_clips.iter().filter(|c| payload.resource_paths.iter().any(|r| r.id == c.resource_id)).count();
        for (i, _) in payload.voiceover_clips.iter().enumerate() {
            afilt.push_str(&format!("[{}:a]anull[vo{}];", vo_offset + i, i));
        }

        if audio_inputs_count == 1 {
            if payload.voiceover_clips.is_empty() {
                afilt.push_str("[m0]anull[outa];");
            } else {
                afilt.push_str("[vo0]anull[outa];");
            }
        } else {
            let mut mix = String::new();
            for i in 0..vo_offset - 1 { mix.push_str(&format!("[m{}]", i)); }
            for i in 0..payload.voiceover_clips.len() { mix.push_str(&format!("[vo{}]", i)); }
            mix.push_str(&format!("amix=inputs={}:duration=longest[outa];", audio_inputs_count));
            afilt.push_str(&mix);
        }

        final_cmd.arg("-filter_complex").arg(&afilt)
                 .arg("-map").arg("0:v")
                 .arg("-map").arg("[outa]")
                 .arg("-c:a").arg("aac").arg("-shortest");
    }

    final_cmd.arg(&final_output).stdout(Stdio::null()).stderr(Stdio::piped());

    let _ = app.emit("export-progress", ProgressPayload { progress: 95.0 });
    let mut final_child = final_cmd.spawn().map_err(|e| format!("合流启动失败: {}", e))?;
    let final_status = final_child.wait().map_err(|e| format!("合流等待失败: {}", e))?;

    if !final_status.success() {
        return Err(format!("视频合流写入失败: {}", final_status));
    }

    let _ = std::fs::remove_dir_all(&temp_dir);
    let _ = app.emit("export-progress", ProgressPayload { progress: 100.0 });
    
    if payload.auto_open {
        let _ = tauri_plugin_opener::open_path(final_output.clone(), None::<String>);
    }
    
    Ok(final_output.to_string_lossy().to_string())
}
"""
    
new_content = text[:start_idx] + new_fn + "\n\n" + text[end_idx:]
with open(r'h:\project\CLIP JIANJI\src-tauri\src\lib.rs', 'w', encoding='utf-8') as f:
    f.write(new_content)
