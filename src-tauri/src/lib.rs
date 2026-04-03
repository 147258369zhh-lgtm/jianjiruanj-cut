use exif::{In, Reader, Tag};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, BufRead, Read, Seek, SeekFrom};
use std::process::{Command, Stdio};
use tauri::{Manager, Emitter};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn write_temp_file(data: Vec<u8>, ext: String) -> Result<String, String> {
    let mut temp_file = std::env::temp_dir();
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let filename = format!("tmp_asset_{}.{}", ts, ext);
    temp_file.push(filename);
    std::fs::write(&temp_file, data).map_err(|e| e.to_string())?;
    Ok(temp_file.to_string_lossy().into_owned())
}

#[derive(Serialize, Clone, Debug)]
pub struct ProgressPayload {
    pub progress: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TimelineItem {
    path: String,
    duration: f32,
    transition: String,
    rotation: Option<u32>,
    #[serde(rename = "overlayText")]
    overlay_text: Option<String>,
    contrast: Option<f32>,
    saturation: Option<f32>,
    #[serde(rename = "cropPos")]
    crop_pos: Option<CropPos>,
    #[serde(rename = "fillMode")]
    fill_mode: Option<String>,
    animation: Option<String>,
    
    // 文字涂装高阶属性
    #[serde(rename = "fontColor")]
    font_color: Option<String>,
    #[serde(rename = "fontSize")]
    font_size: Option<f32>,
    #[serde(rename = "textAlign")]
    text_align: Option<String>,
    #[serde(rename = "textShadow")]
    text_shadow: Option<bool>,
    #[serde(rename = "textShadowColor")]
    text_shadow_color: Option<String>,
    #[serde(rename = "textStroke")]
    text_stroke: Option<bool>,
    #[serde(rename = "textStrokeColor")]
    text_stroke_color: Option<String>,
    #[serde(rename = "textStrokeWidth")]
    text_stroke_width: Option<f32>,
    #[serde(rename = "textBgEnable")]
    text_bg_enable: Option<bool>,
    #[serde(rename = "textBg")]
    text_bg: Option<String>,
    #[serde(rename = "textBgPadX")]
    text_bg_padx: Option<f32>,
    #[serde(rename = "textBgPadY")]
    text_bg_pady: Option<f32>,

    #[serde(rename = "flipX")]
    flip_x: Option<bool>,
    #[serde(rename = "flipY")]
    flip_y: Option<bool>,
    #[serde(rename = "blendMode")]
    blend_mode: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CropPos {
    x: f32,
    y: f32,
    width: f32,
    height: f32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ResourcePath {
    id: String,
    path: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VideoPayload {
    items: Vec<TimelineItem>,
    fps: u32,
    resolution: String,
    quality: String,
    codec: String,
    hdr: bool,
    #[serde(rename = "exportEncodingPreset")]
    preset: Option<String>,
    #[serde(rename = "exportBitrateMode")]
    bitrate_mode: Option<String>,
    #[serde(rename = "exportTargetBitrate")]
    target_bitrate: Option<u32>,
    #[serde(rename = "exportDeband")]
    deband: Option<bool>,
    #[serde(rename = "exportForceCpu")]
    force_cpu: Option<bool>,
    #[serde(rename = "exportMasterAudio")]
    master_audio: Option<bool>,
    #[serde(rename = "outputPath")]
    output_path: Option<String>,
    #[serde(rename = "autoOpen")]
    auto_open: bool,
    #[serde(rename = "resourcePaths")]
    resource_paths: Vec<ResourcePath>,
    #[serde(rename = "audioClips")]
    audio_clips: Vec<AudioTimelineItem>,
    #[serde(rename = "voiceoverClips", default)]
    voiceover_clips: Vec<VoiceoverExportClip>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AudioTimelineItem {
    id: String,
    #[serde(rename = "resourceId")]
    resource_id: String,
    #[serde(rename = "timelineStart")]
    timeline_start: f32,
    #[serde(rename = "startOffset")]
    start_offset: f32,
    duration: f32,
    volume: f32,
    #[serde(rename = "fadeIn")]
    fade_in: Option<f32>,
    #[serde(rename = "fadeOut")]
    fade_out: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VoiceoverExportClip {
    #[serde(rename = "filePath")]
    file_path: String,
    #[serde(rename = "timelineStart")]
    timeline_start: f32,
    duration: f32,
    volume: f32,
}

// 辅助函数：定位 FFmpeg 路径汇聚点 (绝对化升级)
fn resolve_ffmpeg_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    // 1. 尝试资源目录 (生产环境)
    if let Ok(rd) = app.path().resource_dir() {
        let p = rd.join("bin").join("ffmpeg.exe");
        if p.exists() {
            return p;
        }
    }

    // 2. 尝试基于 EXE 目录的深度追溯 (开发环境极致兼容)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // target/debug -> bin/ffmpeg.exe
            let p = exe_dir.join("bin").join("ffmpeg.exe");
            if p.exists() {
                return p;
            }

            // target/debug -> ../../src-tauri/bin/ffmpeg.exe
            if let Some(root) = exe_dir.parent().and_then(|p| p.parent()) {
                let p = root.join("src-tauri").join("bin").join("ffmpeg.exe");
                if p.exists() {
                    return p;
                }
                let p = root.join("bin").join("ffmpeg.exe");
                if p.exists() {
                    return p;
                }
            }
        }
    }

    // 3. 兜底尝试
    let p = std::path::PathBuf::from("K:\\xiangmu\\剪辑\\src-tauri\\bin\\ffmpeg.exe");
    if p.exists() {
        return p;
    }

    std::path::PathBuf::from("ffmpeg")
}

// GPU 硬件编码器自动探测 (NVENC / AMF / CPU 三级降级)
fn detect_best_encoder(ffmpeg_path: &std::path::Path, want_h265: bool) -> (String, String) {
    // 返回 (encoder_name, encoder_family): family = "nvenc" | "amf" | "cpu"
    let nvenc = if want_h265 { "hevc_nvenc" } else { "h264_nvenc" };
    let amf   = if want_h265 { "hevc_amf"  } else { "h264_amf"  };
    let qsv   = if want_h265 { "hevc_qsv"  } else { "h264_qsv"  };
    let cpu   = if want_h265 { "libx265"   } else { "libx264"   };

    // 实际探测硬件: 尝试编码 1 帧空数据，成功则说明显卡驱动可用
    let probe = |enc: &str| -> bool {
        let output = Command::new(ffmpeg_path)
            .args(["-hide_banner", "-loglevel", "error",
                   "-f", "lavfi", "-i", "color=c=black:s=256x256:d=0.04:r=30",
                   "-pix_fmt", "yuv420p", "-c:v", enc, "-b:v", "1M", "-frames:v", "1", "-f", "null", "-"])
            .output();
            
        match output {
            Ok(out) => {
                let success = out.status.success();
                if !success && !out.stderr.is_empty() {
                    println!("FFmpeg Encoder {} probe failed: {}", enc, String::from_utf8_lossy(&out.stderr));
                }
                success
            },
            Err(_) => false
        }
    };

    // 优先 NVENC (通常性能更好)
    if probe(nvenc) { return (nvenc.to_string(), "nvenc".to_string()); }
    // 其次 AMF (AMD 显卡)
    if probe(amf) { return (amf.to_string(), "amf".to_string()); }
    // 然后 QSV (Intel 核心显卡)
    if probe(qsv) { return (qsv.to_string(), "qsv".to_string()); }
    // 兜底 CPU
    (cpu.to_string(), "cpu".to_string())
}

use image::{DynamicImage, Rgb, RgbImage};

fn process_raw_image(path: &str, preview_path: &std::path::Path) -> Result<String, String> {
    let raw = rawloader::decode_file(path).map_err(|e| format!("RAW解码失败: {}", e))?;

    // 尝试提取嵌套预览 (ISP 级别)
    if let Ok(file) = File::open(path) {
        let mut bufreader = BufReader::new(file);
        let exifreader = Reader::new();
        if let Ok(exif) = exifreader.read_from_container(&mut bufreader) {
            let mut best_data: Option<Vec<u8>> = None;
            let mut max_len = 0;
            for ifd_type in [In::PRIMARY, In::THUMBNAIL] {
                if let Some(field) = exif.get_field(Tag::JPEGInterchangeFormat, ifd_type) {
                    if let Some(offset) = field.value.get_uint(0) {
                        if let Some(len_field) =
                            exif.get_field(Tag::JPEGInterchangeFormatLength, ifd_type)
                        {
                            if let Some(len) = len_field.value.get_uint(0) {
                                if len > max_len {
                                    if let Ok(mut file) = File::open(path) {
                                        let mut data = vec![0u8; len as usize];
                                        if file.seek(SeekFrom::Start(offset as u64)).is_ok()
                                            && file.read_exact(&mut data).is_ok()
                                        {
                                            best_data = Some(data);
                                            max_len = len;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if let Some(data) = best_data {
                if data.len() > 4 && data[0] == 0xFF && data[1] == 0xD8 {
                    if std::fs::write(preview_path, &data).is_ok() {
                        return Ok(preview_path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // 内存 Demosaic (Super-Pixel 全彩提取)
    let width = raw.width;
    let height = raw.height;
    if let rawloader::RawImageData::Integer(ref buf) = raw.data {
        let out_w = (width / 2) as u32;
        let out_h = (height / 2) as u32;
        let mut img = RgbImage::new(out_w, out_h);

        // 使用相机自带白平衡 (WB)
        let wb = raw.wb_coeffs;
        let r_mul = if wb[0] > 0.0 { wb[0] } else { 1.0 };
        let g_mul = if wb[1] > 0.0 { wb[1] } else { 1.0 };
        let b_mul = if wb[2] > 0.0 { wb[2] } else { 1.0 };

        // 黑白电平处理
        let black = raw.blacklevels[0] as f32;
        let white = raw.whitelevels[0] as f32;
        let range = (white - black).max(1.0);

        for y in 0..(height / 2) {
            for x in 0..(width / 2) {
                let mut r = 0.0f32;
                let mut g = 0.0f32;
                let mut b = 0.0f32;
                let mut gn = 0.0f32;

                for dy in 0..2 {
                    for dx in 0..2 {
                        let cx = x * 2 + dx;
                        let cy = y * 2 + dy;
                        let color = raw.cfa.color_at(cx, cy);
                        let val = (buf[cy * width + cx] as f32 - black).max(0.0);
                        if color == 0 {
                            r = val * r_mul;
                        } else if color == 1 {
                            g += val * g_mul;
                            gn += 1.0;
                        } else if color == 2 {
                            b = val * b_mul;
                        }
                    }
                }

                let g_final = if gn > 0.0 { g / gn } else { g };

                // Gamma 2.2 视觉矫正
                let apply_gamma = |v: f32| -> u8 {
                    let n = (v / range).clamp(0.0, 1.0);
                    (n.powf(1.0 / 2.2) * 255.0) as u8
                };

                img.put_pixel(
                    x as u32,
                    y as u32,
                    Rgb([apply_gamma(r), apply_gamma(g_final), apply_gamma(b)]),
                );
            }
        }

        if DynamicImage::ImageRgb8(img).save(preview_path).is_ok() {
            return Ok(preview_path.to_string_lossy().to_string());
        }
    }

    Err("未能完成 DNG 全彩提取".to_string())
}

// 辅助函数：深度提取 DNG 预览图/转码 (错误追溯强化)
fn extract_dng_preview(
    path: &str,
    preview_path: &std::path::Path,
    ffmpeg_path: &std::path::Path,
    scale_vf: &str,
) -> Result<String, String> {
    if preview_path.exists() {
        return Ok(preview_path.to_string_lossy().to_string());
    }

    // --- 第一阶段：纯 Rust 解析嵌入的 RAW/JPEG ---
    if let Ok(p) = process_raw_image(path, preview_path) {
        return Ok(p);
    }

    // --- 第二阶段：FFmpeg 深度提取 (兜底) ---
    let output = Command::new(ffmpeg_path)
        .arg("-probesize")
        .arg("500000000") // 提升到惊人的 500MB，应对极大 DNG
        .arg("-analyzeduration")
        .arg("500000000")
        .arg("-i")
        .arg(path)
        .arg("-vframes")
        .arg("1")
        .arg("-vf")
        .arg(scale_vf)
        .arg("-pix_fmt")
        .arg("yuvj420p") // 放松像素格式要求，有些 DNG 需要 full range
        .arg("-sws_flags")
        .arg("lanczos")
        .arg("-f")
        .arg("image2")
        .arg("-y")
        .arg(preview_path)
        .output()
        .map_err(|e| format!("FFmpeg 启动失败: {}. 引擎路径: {:?}", e, ffmpeg_path))?;

    if preview_path.exists() {
        Ok(preview_path.to_string_lossy().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "原生解析与 FFmpeg 兜底皆失败。FFmpeg 错误流: {}",
            stderr
        ))
    }
}

#[tauri::command]
async fn reveal_in_explorer(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(path);
    if !p.exists() {
        return Err("文件不存在".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(p.to_string_lossy().replace("/", "\\"))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let folder = p.parent().unwrap_or(&p);
        let _ =
            tauri_plugin_opener::open_path(folder.to_string_lossy().to_string(), None::<String>);
    }
    Ok(())
}

#[tauri::command]
async fn generate_video(app: tauri::AppHandle, payload: VideoPayload) -> Result<String, String> {
    let items = payload.items;
    let fps = payload.fps;
    let res = payload.resolution;
    let quality = payload.quality.clone();
    let codec = payload.codec.clone();
    let hdr = payload.hdr;
    let encode_preset = payload.preset.clone().unwrap_or_else(|| "speed".to_string());
    let bitrate_mode = payload.bitrate_mode.clone().unwrap_or_else(|| "crf".to_string());
    let target_bitrate = payload.target_bitrate.unwrap_or(20);
    let deband = payload.deband.unwrap_or(false);
    let force_cpu = payload.force_cpu.unwrap_or(false);
    let master_audio = payload.master_audio.unwrap_or(false);

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let preview_dir = app_data_dir.join("previews");
    if !preview_dir.exists() {
        let _ = std::fs::create_dir_all(&preview_dir);
    }

    let filter_script_path = app_data_dir.join("filter.txt");
    if items.is_empty() {
        return Err("时间轴素材为空，请先添加图片！".to_string());
    }

    let resolution = if res == "original" {
        "1920:1080"
    } else {
        res.as_str()
    };
    let res_parts: Vec<&str> = resolution.split(':').collect();
    let res_w = res_parts[0];
    let res_h = res_parts[1];
    let ffmpeg_path = resolve_ffmpeg_path(&app);

    let mut script = String::new();
    for (i, item) in items.iter().enumerate() {
        // 关键优化: 先处理像素操作(仅1帧)，再 loop 复制已处理帧
        // 旧顺序: loop→fps→trim→scale (每帧都缩放 = 198次/图)
        // 新顺序: scale→loop→fps→trim (仅缩放1次/图 = 提速 ~200倍)
        let mut vf_chain = vec![];

        // === 第一阶段: 像素级处理 (仅处理1帧原图) ===
        match item.rotation.unwrap_or(0) {
            90 => vf_chain.push("transpose=1".to_string()),
            180 => vf_chain.push("hflip,vflip".to_string()), // 暂留，但会被 flipX/Y 补充或覆盖
            270 => vf_chain.push("transpose=2".to_string()),
            _ => {}
        }
        
        if item.flip_x.unwrap_or(false) {
            vf_chain.push("hflip".to_string());
        }
        if item.flip_y.unwrap_or(false) {
            vf_chain.push("vflip".to_string());
        }

        let contrast = item.contrast.unwrap_or(1.0);
        let saturation = item.saturation.unwrap_or(1.0);
        if contrast != 1.0 || saturation != 1.0 {
            vf_chain.push(format!(
                "eq=contrast={}:saturation={}",
                contrast, saturation
            ));
        }

        if let Some(text) = &item.overlay_text {
            if !text.trim().is_empty() {
                let safe_text = text.replace(":", "\\:").replace("'", "\\'");
                let font_size = item.font_size.unwrap_or(80.0) * 1.5; // 按比例缩放为视频字号
                let font_color = item.font_color.as_deref().unwrap_or("white").replace("#", "0x");
                
                // 定位
                let align = item.text_align.as_deref().unwrap_or("center");
                let (x_expr, y_expr) = match align {
                    "left" => ("100", "h-th-100"),
                    "right" => ("w-text_w-100", "h-th-100"),
                    _ => ("(w-text_w)/2", "h-th-100") // center
                };

                let mut dt = format!("drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':text='{}':fontcolor='{}':fontsize={}:x={}:y={}", safe_text, font_color, font_size, x_expr, y_expr);

                // 描边效果
                if item.text_stroke.unwrap_or(false) {
                    let stroke_color = item.text_stroke_color.as_deref().unwrap_or("black").replace("#", "0x");
                    let stroke_w = item.text_stroke_width.unwrap_or(4.0);
                    dt.push_str(&format!(":borderw={}:bordercolor='{}'", stroke_w, stroke_color));
                }

                // 阴影效果
                if item.text_shadow.unwrap_or(false) {
                    let shadow_color = item.text_shadow_color.as_deref().unwrap_or("black").replace("#", "0x") + "80"; // 半透明阴影
                    dt.push_str(&format!(":shadowx=6:shadowy=6:shadowcolor='{}'", shadow_color));
                }
                
                // 遮罩底板
                if item.text_bg_enable.unwrap_or(false) {
                    let bg_color = item.text_bg.as_deref().unwrap_or("black").replace("#", "0x") + "B3"; // 70% 不透明度
                    dt.push_str(&format!(":box=1:boxcolor='{}':boxborderw={}", bg_color, item.text_bg_padx.unwrap_or(20.0)));
                }

                vf_chain.push(dt);
            }
        }

        if let Some(cp) = &item.crop_pos {
            vf_chain.push(format!(
                "crop=iw*{}/100:ih*{}/100:iw*{}/100:ih*{}/100",
                cp.width, cp.height, cp.x, cp.y
            ));
        }

        if item.fill_mode.as_deref() == Some("cover") {
            vf_chain.push(format!("scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}:(iw-ow)/2:(ih-oh)/2,format=yuv420p,setsar=1", res_w, res_h, res_w, res_h));
        } else {
            vf_chain.push(format!("scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p,setsar=1", res_w, res_h, res_w, res_h));
        }

        // === 第二阶段: 时间轴生成 ===
        let anim = item.animation.as_deref().unwrap_or("none");
        let dur_frames = (item.duration * fps as f32) as u32;
        
        if anim == "none" {
            // 静态零开销优化
            vf_chain.push("loop=loop=-1:size=1:start=0".to_string());
            vf_chain.push(format!("fps={}", fps));
            vf_chain.push(format!("trim=duration={}", item.duration));
            vf_chain.push("setpts=PTS-STARTPTS".to_string());
        } else {
            // 动态逐帧动画渲染分支
            if anim.contains("zoomIn") {
                vf_chain.push(format!("zoompan=z='min(pzoom+0.0015,1.5)':d={}:s={}x{}", dur_frames, res_w, res_h));
            } else if anim.contains("zoomOut") {
                vf_chain.push(format!("zoompan=z='max(1.5-0.0015*in,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
            } else if anim.contains("panRight") {
                vf_chain.push(format!("zoompan=z=1.1:x='min(x+2,iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
            } else if anim.contains("panLeft") {
                vf_chain.push(format!("zoompan=z=1.1:x='max(iw-iw/zoom-in*2,0)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
            } else {
                // 回退到普通平展
                vf_chain.push("loop=loop=-1:size=1:start=0".to_string());
                vf_chain.push(format!("fps={}", fps));
                vf_chain.push(format!("trim=duration={}", item.duration));
            }
            
            // 补充出入场 Fade
            if anim.contains("fadeIn") || anim.contains("slide") {
                // 由于用 slide 模拟在 ffmpeg 中较复杂，统一降级为淡入处理保证美感
                vf_chain.push("fade=t=in:st=0:d=1.0".to_string());
            }
            vf_chain.push("setpts=PTS-STARTPTS".to_string());
        }

        script.push_str(&format!("[{}:v]{}[v{}];\n", i, vf_chain.join(","), i));
    }

    let mut concat_inputs = String::new();
    for i in 0..items.len() {
        concat_inputs.push_str(&format!("[v{}]", i));
    }
    script.push_str(&format!(
        "{}concat=n={}:v=1:a=0[outv_pre];\n",
        concat_inputs,
        items.len()
    ));
    if deband {
        script.push_str("[outv_pre]deband[outv];\n");
    } else {
        script.push_str("[outv_pre]copy[outv];\n");
    }
    let mut precalc_audio_count = 0;
    for clip in &payload.audio_clips {
        if payload.resource_paths.iter().any(|r| r.id == clip.resource_id) {
            let mut filters = Vec::new();
            if (clip.volume - 1.0).abs() > 0.01 {
                filters.push(format!("volume={}", clip.volume));
            }
            if let Some(fi) = clip.fade_in {
                if fi > 0.0 {
                    filters.push(format!("afade=t=in:st=0:d={:.2}", fi));
                }
            }
            if let Some(fo) = clip.fade_out {
                if fo > 0.0 {
                    let out_start = (clip.duration - fo).max(0.0);
                    filters.push(format!("afade=t=out:st={:.2}:d={:.2}", out_start, fo));
                }
            }
            
            let input_lbl = format!("{}:a", items.len() + precalc_audio_count);
            let output_lbl = format!("a{}", precalc_audio_count);
            
            if filters.is_empty() {
                script.push_str(&format!("[{}]anull[{}];\n", input_lbl, output_lbl));
            } else {
                script.push_str(&format!("[{}]{}[{}];\n", input_lbl, filters.join(","), output_lbl));
            }
            precalc_audio_count += 1;
        }
    }

    if precalc_audio_count > 0 {
        if precalc_audio_count == 1 {
            script.push_str("[a0]anull[outa];\n");
        } else {
            let mut amix_str = String::new();
            for i in 0..precalc_audio_count {
                amix_str.push_str(&format!("[a{}]", i));
            }
            amix_str.push_str(&format!(
                "amix=inputs={}:duration=longest[outa];\n",
                precalc_audio_count
            ));
            script.push_str(&amix_str);
        }
    }

    // 配音音频流处理 (adelay 定位 + volume 控制)
    let mut vo_audio_count = 0;
    let vo_input_base = items.len() + precalc_audio_count; // 配音输入的起始索引
    for (vi, vo) in payload.voiceover_clips.iter().enumerate() {
        let delay_ms = (vo.timeline_start * 1000.0) as u64;
        let mut filters = Vec::new();
        if delay_ms > 0 {
            filters.push(format!("adelay={}|{}", delay_ms, delay_ms));
        }
        if (vo.volume - 1.0).abs() > 0.01 {
            filters.push(format!("volume={}", vo.volume));
        }
        let input_lbl = format!("{}:a", vo_input_base + vi);
        let output_lbl = format!("vo{}", vi);
        if filters.is_empty() {
            script.push_str(&format!("[{}]anull[{}];\n", input_lbl, output_lbl));
        } else {
            script.push_str(&format!("[{}]{}[{}];\n", input_lbl, filters.join(","), output_lbl));
        }
        vo_audio_count += 1;
    }

    // 如果有配音但没有音乐 outa，需要单独处理最终混音
    let total_audio_streams = precalc_audio_count + vo_audio_count;
    if total_audio_streams > 0 && (precalc_audio_count == 0 || vo_audio_count > 0) {
        // 需要重新混合所有音频流
        if total_audio_streams == 1 && precalc_audio_count == 1 {
            // 只有音乐，outa 已经生成，不需要改
        } else if total_audio_streams == 1 && vo_audio_count == 1 {
            // 只有配音
            script.push_str("[vo0]anull[outa];\n");
        } else if precalc_audio_count > 0 && vo_audio_count > 0 {
            // 有音乐+配音，需要重新混合
            // 先把已有的 [outa] 改名为 [music_mix]
            let old = if precalc_audio_count == 1 {
                "[a0]anull[outa];\n".to_string()
            } else {
                let mut s = String::new();
                for i in 0..precalc_audio_count { s.push_str(&format!("[a{}]", i)); }
                s.push_str(&format!("amix=inputs={}:duration=longest[outa];\n", precalc_audio_count));
                s
            };
            let new = old.replace("[outa]", "[music_mix]");
            script = script.replace(&old, &new);
            // 混合 music_mix + 所有 vo
            let mut final_mix = "[music_mix]".to_string();
            for i in 0..vo_audio_count { final_mix.push_str(&format!("[vo{}]", i)); }
            final_mix.push_str(&format!("amix=inputs={}:duration=longest[outa];\n", 1 + vo_audio_count));
            script.push_str(&final_mix);
        } else if vo_audio_count > 1 {
            // 多段配音无音乐
            let mut mix = String::new();
            for i in 0..vo_audio_count { mix.push_str(&format!("[vo{}]", i)); }
            mix.push_str(&format!("amix=inputs={}:duration=longest[outa];\n", vo_audio_count));
            script.push_str(&mix);
        }
    }
    std::fs::write(&filter_script_path, script).map_err(|e| format!("写入滤镜脚本失败: {}", e))?;

    // ==========================================
    // 并行分段编码架构 (Parallel Segment Encoding)
    // 将 N 张图片分成多个分段，同时编码，最后无损拼接
    // ==========================================
    let cpu_count = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let want_h265 = codec == "h265";
    let (encoder_name, encoder_family) = if force_cpu {
        if want_h265 { ("libx265".to_string(), "cpu".to_string()) } else { ("libx264".to_string(), "cpu".to_string()) }
    } else {
        detect_best_encoder(&ffmpeg_path, want_h265)
    };

    let final_output = if let Some(path) = &payload.output_path {
        std::path::PathBuf::from(path)
    } else {
        app.path()
            .desktop_dir()
            .map_err(|e| e.to_string())?
            .join(format!(
                "output_{}.mp4",
                chrono::Local::now().format("%Y%m%d_%H%M%S")
            ))
    };

    // 预处理所有图片路径 (DNG 转换 - 启用 Rayon 并行风暴)
    use rayon::prelude::*;
    let resolved_paths: Vec<String> = items.par_iter().map(|item| {
        let is_dng = item.path.to_lowercase().ends_with(".dng");
        if is_dng {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            item.path.hash(&mut hasher);
            let preview_name = format!("{:x}_render.jpg", hasher.finish());
            let p = preview_dir.join(preview_name);
            extract_dng_preview(&item.path, &p, &ffmpeg_path, "scale=1920:-1")
                .unwrap_or_else(|_| item.path.clone())
        } else {
            item.path.clone()
        }
    }).collect();

    // 决定并行分段数 (防止线程风暴与显卡Session并发溢出)
    let max_segments = if encoder_family == "cpu" { (cpu_count / 4).max(1).min(4) } else { 2 };
    let mut num_segments = if items.len() <= 6 { 1 } else { (items.len() / 8).min(max_segments).max(1) };
    
    // 特殊格式强制单进程防崩溃
    let is_gif = payload.output_path.as_ref().map(|p| p.to_lowercase().ends_with(".gif")).unwrap_or(false)
              || payload.output_path.as_ref().map(|p| p.to_lowercase().ends_with(".webp")).unwrap_or(false);
    if is_gif { num_segments = 1; }
    let total_duration: f32 = items.iter().map(|item| item.duration).sum();

    if num_segments <= 1 {
        // === 单进程模式 (图片太少，不值得并行) ===
        let mut cmd = Command::new(&ffmpeg_path);
        cmd.arg("-y")
            .arg("-threads").arg(cpu_count.to_string())
            .arg("-filter_threads").arg(cpu_count.to_string())
            .arg("-sws_flags").arg("fast_bilinear");

        for path in &resolved_paths {
            let p_str: &str = path;
            cmd.arg("-i").arg(p_str.replace("\\", "/"));
        }

        // 音频输入
        let mut audio_inputs_count = 0;
        for clip in &payload.audio_clips {
            if let Some(res) = payload.resource_paths.iter().find(|r| r.id == clip.resource_id) {
                let audio_path = if res.path.starts_with("/audio/") {
                    app.path()
                        .resolve(format!("public{}", res.path), tauri::path::BaseDirectory::Resource)
                        .map(|p| p.to_string_lossy().into_owned())
                        .unwrap_or_else(|_| res.path.clone())
                } else { res.path.clone() };
                cmd.arg("-ss").arg(clip.start_offset.to_string())
                    .arg("-t").arg(clip.duration.to_string())
                    .arg("-i").arg(audio_path.replace("\\", "/"));
                audio_inputs_count += 1;
            }
        }

        // 配音输入
        let mut voiceover_input_count = 0;
        for vo in &payload.voiceover_clips {
            cmd.arg("-i").arg(vo.file_path.replace("\\", "/"));
            voiceover_input_count += 1;
        }

        // 决定音频映射
        let total_audio = audio_inputs_count + voiceover_input_count;
        cmd.arg("-filter_complex_script").arg(&filter_script_path)
            .arg("-map").arg("[outv]");
        if total_audio > 0 { cmd.arg("-map").arg("[outa]"); }

        if final_output.to_string_lossy().to_lowercase().ends_with(".gif") {
            cmd.arg("-c:v").arg("gif").arg("-loop").arg("0");
        } else if final_output.to_string_lossy().to_lowercase().ends_with(".webp") {
            cmd.arg("-c:v").arg("libwebp").arg("-loop").arg("0").arg("-lossless").arg(if quality == "lossless" { "1" } else { "0" });
        } else {
            cmd.arg("-c:v").arg(&encoder_name);
            if want_h265 && hdr {
                cmd.arg("-pix_fmt").arg("yuv420p10le")
                    .arg("-color_primaries").arg("bt2020")
                    .arg("-color_trc").arg("smpte2084")
                    .arg("-colorspace").arg("bt2020nc");
                if encoder_family == "cpu" {
                    cmd.arg("-x265-params").arg("hdr10=1:repeat-headers=1:color-range=pc");
                }
            }
            match encoder_family.as_str() {
                "nvenc" => {
                    let cq = if quality == "lossless" { "14" } else if quality == "high" { "18" } else { "24" };
                    let preset_flag = if encode_preset == "quality" {
                        if quality == "lossless" { "p7" } else if quality == "high" { "p6" } else { "p5" }
                    } else {
                        if quality == "lossless" { "p5" } else if quality == "high" { "p4" } else { "p2" }
                    };
                    cmd.arg("-preset").arg(preset_flag);
                    if bitrate_mode == "vbr" {
                        cmd.arg("-rc").arg("vbr").arg("-b:v").arg(format!("{}M", target_bitrate)).arg("-maxrate").arg(format!("{}M", target_bitrate + 10));
                    } else {
                        cmd.arg("-rc").arg("vbr").arg("-cq").arg(cq).arg("-b:v").arg("0");
                    }
                    cmd.arg("-spatial-aq").arg("1").arg("-temporal-aq").arg("1");
                }
                "amf" => {
                    let qp = if quality == "lossless" { "14" } else if quality == "high" { "18" } else { "24" };
                    let spd = if encode_preset == "quality" {
                        if quality == "lossless" { "quality" } else if quality == "high" { "quality" } else { "balanced" }
                    } else {
                        if quality == "lossless" { "balanced" } else if quality == "high" { "balanced" } else { "speed" }
                    };
                    cmd.arg("-quality").arg(spd);
                    if bitrate_mode == "vbr" {
                        cmd.arg("-rc").arg("vbr_peak").arg("-b:v").arg(format!("{}M", target_bitrate)).arg("-maxrate").arg(format!("{}M", target_bitrate + 10));
                    } else {
                        cmd.arg("-rc").arg("cqp").arg("-qp_i").arg(qp).arg("-qp_p").arg(qp);
                    }
                }
                "qsv" => {
                    let qp = if quality == "lossless" { "14" } else if quality == "high" { "18" } else { "24" };
                    let preset_flag = if encode_preset == "quality" {
                        if quality == "lossless" { "veryslow" } else if quality == "high" { "slower" } else { "slow" }
                    } else {
                        if quality == "lossless" { "medium" } else if quality == "high" { "fast" } else { "faster" }
                    };
                    cmd.arg("-preset").arg(preset_flag).arg("-look_ahead").arg("1");
                    if bitrate_mode == "vbr" {
                        cmd.arg("-b:v").arg(format!("{}M", target_bitrate)).arg("-maxrate").arg(format!("{}M", target_bitrate + 10));
                    } else {
                        cmd.arg("-q").arg(qp);
                    }
                }
                _ => {
                    let crf = if quality == "lossless" { "15" } else if quality == "high" { "18" } else { "24" };
                    let preset_flag = if encode_preset == "quality" { "slower" } else { "faster" };
                    cmd.arg("-preset").arg(preset_flag);
                    if bitrate_mode == "vbr" {
                        cmd.arg("-b:v").arg(format!("{}M", target_bitrate)).arg("-maxrate").arg(format!("{}M", target_bitrate * 2)).arg("-bufsize").arg(format!("{}M", target_bitrate * 4));
                    } else {
                        cmd.arg("-crf").arg(crf);
                    }
                }
            }
        }
        if total_audio > 0 { 
            cmd.arg("-c:a").arg("aac").arg("-shortest"); 
            if master_audio {
                cmd.arg("-b:a").arg("320k").arg("-ar").arg("48000");
            }
        }
        cmd.arg(&final_output);
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("唤醒 FFmpeg 引擎失败: {}", e))?;
        let mut full_stderr = String::new();
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    full_stderr.push_str(&line); full_stderr.push('\n');
                    if let Some(idx) = line.find("time=") {
                        let time_str = &line[idx + 5..];
                        if let Some(t_str) = time_str.split_whitespace().next() {
                            let parts: Vec<&str> = t_str.split(':').collect();
                            if parts.len() == 3 {
                                let cur = parts[0].parse::<f32>().unwrap_or(0.0) * 3600.0
                                    + parts[1].parse::<f32>().unwrap_or(0.0) * 60.0
                                    + parts[2].parse::<f32>().unwrap_or(0.0);
                                let pct = ((cur / total_duration) * 100.0).min(99.0);
                                let _ = app.emit("export-progress", ProgressPayload { progress: pct as f64 });
                            }
                        }
                    }
                }
            }
        }
        let status = child.wait().map_err(|e| format!("等待 FFmpeg 失败: {}", e))?;
        if !status.success() {
            let log_path = std::path::PathBuf::from("h:\\project\\CLIP JIANJI\\src-tauri\\ffmpeg_error.log");
            let _ = std::fs::write(&log_path, &full_stderr);
            let tail = if full_stderr.len() > 300 { &full_stderr[full_stderr.len()-300..] } else { &full_stderr };
            return Err(format!("视频合成失败: {}\n...{}", status, tail));
        }
    } else {
        // === 并行分段编码模式 ===
        let _ = app.emit("export-progress", ProgressPayload { progress: 2.0 });

        // 将图片分段
        let chunk_size = (items.len() + num_segments - 1) / num_segments;
        let segments: Vec<(usize, usize)> = (0..items.len())
            .step_by(chunk_size)
            .map(|start| (start, (start + chunk_size).min(items.len())))
            .collect();

        let temp_dir = app_data_dir.join("segments");
        if temp_dir.exists() { let _ = std::fs::remove_dir_all(&temp_dir); }
        let _ = std::fs::create_dir_all(&temp_dir);

        // 为每个分段生成 filter script 并启动 FFmpeg 进程
        let mut children: Vec<(std::process::Child, std::path::PathBuf, f32)> = Vec::new();

        for (seg_idx, &(start, end)) in segments.iter().enumerate() {
            let seg_items = &items[start..end];
            let seg_paths = &resolved_paths[start..end];

            // 生成分段 filter script
            let mut seg_script = String::new();
            for (local_i, item) in seg_items.iter().enumerate() {
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
                            _ => ("(w-text_w)/2", "h-th-100") // center
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
                
                let anim = item.animation.as_deref().unwrap_or("none");
                let dur_frames = (item.duration * fps as f32) as u32;
                if anim == "none" {
                    vf.push("loop=loop=-1:size=1:start=0".to_string());
                    vf.push(format!("fps={}", fps));
                    vf.push(format!("trim=duration={}", item.duration));
                } else {
                    if anim.contains("zoomIn") {
                        vf.push(format!("zoompan=z='min(pzoom+0.0015,1.5)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    } else if anim.contains("zoomOut") {
                        vf.push(format!("zoompan=z='max(1.5-0.0015*in,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    } else if anim.contains("panRight") {
                        vf.push(format!("zoompan=z=1.1:x='min(x+2,iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    } else if anim.contains("panLeft") {
                        vf.push(format!("zoompan=z=1.1:x='max(iw-iw/zoom-in*2,0)':y='ih/2-(ih/zoom/2)':d={}:s={}x{}", dur_frames, res_w, res_h));
                    } else {
                        vf.push("loop=loop=-1:size=1:start=0".to_string());
                        vf.push(format!("fps={}", fps));
                        vf.push(format!("trim=duration={}", item.duration));
                    }
                    if anim.contains("fadeIn") || anim.contains("slide") {
                        vf.push("fade=t=in:st=0:d=1.0".to_string());
                    }
                }
                vf.push("setpts=PTS-STARTPTS".to_string());
                seg_script.push_str(&format!("[{}:v]{}[v{}];\n", local_i, vf.join(","), local_i));
            }
            let mut concat_in = String::new();
            for i in 0..seg_items.len() { concat_in.push_str(&format!("[v{}]", i)); }
            seg_script.push_str(&format!("{}concat=n={}:v=1:a=0[outv];\n", concat_in, seg_items.len()));

            let seg_filter = temp_dir.join(format!("filter_{}.txt", seg_idx));
            std::fs::write(&seg_filter, &seg_script).map_err(|e| format!("写入分段滤镜失败: {}", e))?;

            let seg_output = temp_dir.join(format!("seg_{}.mp4", seg_idx));
            let seg_dur: f32 = seg_items.iter().map(|it| it.duration).sum();

            let threads_per_proc = (cpu_count / num_segments).max(2);
            let mut cmd = Command::new(&ffmpeg_path);
            cmd.arg("-y")
                .arg("-threads").arg(threads_per_proc.to_string())
                .arg("-filter_threads").arg(threads_per_proc.to_string())
                .arg("-sws_flags").arg("fast_bilinear");
            for p_str in seg_paths { let p: &str = &p_str; cmd.arg("-i").arg(p.replace("\\", "/")); }
            cmd.arg("-filter_complex_script").arg(&seg_filter)
                .arg("-map").arg("[outv]")
                .arg("-c:v").arg(&encoder_name)
                .arg("-an"); // 分段无音频

            if want_h265 && hdr {
                cmd.arg("-pix_fmt").arg("yuv420p10le")
                    .arg("-color_primaries").arg("bt2020")
                    .arg("-color_trc").arg("smpte2084")
                    .arg("-colorspace").arg("bt2020nc");
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
                _ => {
                    let (crf, preset) = if quality == "lossless" { ("15", "faster") } else if quality == "high" { ("18", "faster") } else { ("24", "superfast") };
                    cmd.arg("-crf").arg(crf).arg("-preset").arg(preset);
                }
            }
            cmd.arg(&seg_output);
            cmd.stdout(Stdio::null()).stderr(Stdio::piped());

            let child = cmd.spawn().map_err(|e| format!("启动分段 {} 失败: {}", seg_idx, e))?;
            children.push((child, seg_output, seg_dur));
        }

        // 等待所有分段编码完成，收集进度
        let mut completed_dur = 0.0f32;
        let mut full_stderr = String::new();
        for (seg_idx, (mut child, _seg_path, seg_dur)) in children.into_iter().enumerate() {
            if let Some(stderr) = child.stderr.take() {
                let reader = BufReader::new(stderr);
                for line_res in reader.lines() {
                    if let Ok(line) = line_res {
                        full_stderr.push_str(&line); full_stderr.push('\n');
                        if let Some(idx) = line.find("time=") {
                            let ts = &line[idx + 5..];
                            if let Some(t) = ts.split_whitespace().next() {
                                let p: Vec<&str> = t.split(':').collect();
                                if p.len() == 3 {
                                    let cur = p[0].parse::<f32>().unwrap_or(0.0) * 3600.0
                                        + p[1].parse::<f32>().unwrap_or(0.0) * 60.0
                                        + p[2].parse::<f32>().unwrap_or(0.0);
                                    let pct = ((completed_dur + cur) / total_duration * 85.0 + 2.0).min(87.0);
                                    let _ = app.emit("export-progress", ProgressPayload { progress: pct as f64 });
                                }
                            }
                        }
                    }
                }
            }
            let status = child.wait().map_err(|e| format!("分段 {} 等待失败: {}", seg_idx, e))?;
            if !status.success() {
                let log_path = std::path::PathBuf::from("h:\\project\\CLIP JIANJI\\src-tauri\\ffmpeg_error.log");
                let _ = std::fs::write(&log_path, &full_stderr);
                let tail = if full_stderr.len() > 300 { &full_stderr[full_stderr.len()-300..] } else { &full_stderr };
                let _ = std::fs::remove_dir_all(&temp_dir);
                return Err(format!("分段 {} 编码失败: {}\n...{}", seg_idx, status, tail));
            }
            completed_dur += seg_dur;
        }

        // 生成 concat 列表
        let _ = app.emit("export-progress", ProgressPayload { progress: 88.0 });
        let concat_list_path = temp_dir.join("concat_list.txt");
        let mut concat_list = String::new();
        for seg_idx in 0..segments.len() {
            let seg_file = temp_dir.join(format!("seg_{}.mp4", seg_idx));
            concat_list.push_str(&format!("file '{}'\n", seg_file.to_string_lossy().replace("\\", "/")));
        }
        std::fs::write(&concat_list_path, &concat_list).map_err(|e| format!("写入 concat 列表失败: {}", e))?;

        // 最终拼接 + 音频混合
        let mut final_cmd = Command::new(&ffmpeg_path);
        final_cmd.arg("-y").arg("-f").arg("concat").arg("-safe").arg("0")
            .arg("-i").arg(&concat_list_path);

        // 添加音频输入
        let mut audio_inputs_count = 0;
        for clip in &payload.audio_clips {
            if let Some(res) = payload.resource_paths.iter().find(|r| r.id == clip.resource_id) {
                let audio_path = if res.path.starts_with("/audio/") {
                    app.path()
                        .resolve(format!("public{}", res.path), tauri::path::BaseDirectory::Resource)
                        .map(|p| p.to_string_lossy().into_owned())
                        .unwrap_or_else(|_| res.path.clone())
                } else { res.path.clone() };
                final_cmd.arg("-ss").arg(clip.start_offset.to_string())
                    .arg("-t").arg(clip.duration.to_string())
                    .arg("-i").arg(audio_path.replace("\\", "/"));
                audio_inputs_count += 1;
            }
        }

        // 视频直接 copy (已经编码好了), 音频编码
        final_cmd.arg("-c:v").arg("copy");
        if audio_inputs_count > 0 {
            // 音频滤镜
            let mut afilt = String::new();
            for ai in 0..audio_inputs_count {
                let clip = payload.audio_clips.iter()
                    .filter(|c| payload.resource_paths.iter().any(|r| r.id == c.resource_id))
                    .nth(ai);
                if let Some(clip) = clip {
                    let mut filters = Vec::new();
                    if (clip.volume - 1.0).abs() > 0.01 { filters.push(format!("volume={}", clip.volume)); }
                    if let Some(fi) = clip.fade_in { if fi > 0.0 { filters.push(format!("afade=t=in:st=0:d={:.2}", fi)); } }
                    if let Some(fo) = clip.fade_out { if fo > 0.0 { let os = (clip.duration - fo).max(0.0); filters.push(format!("afade=t=out:st={:.2}:d={:.2}", os, fo)); } }
                    let lbl_in = format!("{}:a", ai + 1);
                    let lbl_out = format!("a{}", ai);
                    if filters.is_empty() {
                        afilt.push_str(&format!("[{}]anull[{}];", lbl_in, lbl_out));
                    } else {
                        afilt.push_str(&format!("[{}]{}[{}];", lbl_in, filters.join(","), lbl_out));
                    }
                }
            }
            if audio_inputs_count == 1 {
                afilt.push_str("[a0]anull[outa];");
            } else {
                for ai in 0..audio_inputs_count { afilt.push_str(&format!("[a{}]", ai)); }
                afilt.push_str(&format!("amix=inputs={}:duration=longest[outa];", audio_inputs_count));
            }
            final_cmd.arg("-filter_complex").arg(&afilt)
                .arg("-map").arg("0:v").arg("-map").arg("[outa]")
                .arg("-c:a").arg("aac").arg("-shortest");
        }
        final_cmd.arg(&final_output);
        final_cmd.stdout(Stdio::null()).stderr(Stdio::piped());

        let _ = app.emit("export-progress", ProgressPayload { progress: 92.0 });
        let mut final_child = final_cmd.spawn().map_err(|e| format!("最终拼接启动失败: {}", e))?;
        let mut final_stderr = String::new();
        if let Some(stderr) = final_child.stderr.take() {
            let reader = BufReader::new(stderr);
            for line_res in reader.lines() { if let Ok(line) = line_res { final_stderr.push_str(&line); final_stderr.push('\n'); } }
        }
        let final_status = final_child.wait().map_err(|e| format!("最终拼接等待失败: {}", e))?;

        // 清理临时文件
        let _ = std::fs::remove_dir_all(&temp_dir);

        if !final_status.success() {
            let log_path = std::path::PathBuf::from("h:\\project\\CLIP JIANJI\\src-tauri\\ffmpeg_error.log");
            let _ = std::fs::write(&log_path, &final_stderr);
            let tail = if final_stderr.len() > 300 { &final_stderr[final_stderr.len()-300..] } else { &final_stderr };
            return Err(format!("最终拼接失败: {}\n...{}", final_status, tail));
        }
    }

    let _ = app.emit("export-progress", ProgressPayload { progress: 100.0 });
    if payload.auto_open {
        let _ = tauri_plugin_opener::open_path(final_output.clone(), None::<String>);
    }
    Ok(final_output.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_preview_url(app: tauri::AppHandle, path: String) -> Result<String, String> {
    if !path.to_lowercase().ends_with(".dng") {
        return Ok(path);
    }
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let preview_dir = app_data_dir.join("previews");
    if !preview_dir.exists() {
        let _ = std::fs::create_dir_all(&preview_dir);
    }

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    let preview_name = format!("{:x}_thumb.jpg", hasher.finish());
    let preview_path = preview_dir.join(preview_name);

    let ffmpeg_path = resolve_ffmpeg_path(&app);
    match extract_dng_preview(&path, &preview_path, &ffmpeg_path, "scale=640:-1") {
        Ok(p) => Ok(p),
        Err(_) => Ok(path),
    }
}

#[tauri::command]
async fn normalize_image(app: tauri::AppHandle, path: String) -> Result<String, String> {
    if !path.to_lowercase().ends_with(".dng") {
        return Ok(path);
    }
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let normalized_dir = app_data_dir.join("normalized");
    if !normalized_dir.exists() {
        let _ = std::fs::create_dir_all(&normalized_dir);
    }

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    let normalized_name = format!("{:x}_norm.jpg", hasher.finish());
    let normalized_path = normalized_dir.join(normalized_name);

    let ffmpeg_path = resolve_ffmpeg_path(&app);
    extract_dng_preview(&path, &normalized_path, &ffmpeg_path, "scale=2560:-1")
        .map_err(|e| format!("DNG 格式标准化失败: {}", e))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TtsRequest {
    text: String,
    voice: String,     // e.g. "zh-CN-XiaoxiaoNeural"
    rate: String,      // e.g. "+0%", "+20%", "-10%"
    #[serde(default)]
    style: Option<String>,  // e.g. "documentary-narration", "narration-professional"
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TtsVoice {
    name: String,
    short_name: String,
    gender: String,
    locale: String,
}

#[tauri::command]
async fn generate_tts(app: tauri::AppHandle, req: TtsRequest) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let tts_dir = app_data_dir.join("tts");
    if !tts_dir.exists() {
        let _ = std::fs::create_dir_all(&tts_dir);
    }

    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let output_file = tts_dir.join(format!("tts_{}.wav", ts));

    let cwd = std::env::current_dir().unwrap_or_default();
    let script_path = if cwd.join("scripts/local_tts_engine.py").exists() {
        cwd.join("scripts/local_tts_engine.py")
    } else {
        cwd.join("src-tauri/scripts/local_tts_engine.py")
    };

    // 本地开源大模型硬核驱动 (无网可用)
    // 选对音色本身就有很好的自然语感，直接生成无损 wav 格式
    let mut cmd = Command::new("python");
    cmd.arg(&script_path)
        .arg("--text").arg(&req.text)
        .arg("--voice").arg(&req.voice)
        .arg("--rate").arg(&req.rate)
        .arg("--write-media").arg(&output_file);
    
    // Windows: 隐藏控制台窗口
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let output = cmd.spawn()
        .map_err(|e| format!("启动本地离线 TTS 模型失败: {}. 请确认已安装 Python 和 sherpa-onnx", e))?
        .wait_with_output()
        .map_err(|e| format!("等待大模型生成完成失败: {}", e))?;

    if output_file.exists() && std::fs::metadata(&output_file).map(|m| m.len() > 0).unwrap_or(false) {
        Ok(output_file.to_string_lossy().into_owned())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(format!("TTS 生成失败 (exit={}): stderr={}, stdout={}", output.status, stderr, stdout))
    }
}

#[tauri::command]
async fn list_tts_voices() -> Result<Vec<TtsVoice>, String> {
    let cwd = std::env::current_dir().unwrap_or_default();
    let script_path = if cwd.join("scripts/local_tts_engine.py").exists() {
        cwd.join("scripts/local_tts_engine.py")
    } else {
        cwd.join("src-tauri/scripts/local_tts_engine.py")
    };

    let output = Command::new("python")
        .arg(&script_path)
        .arg("--list-voices")
        .output()
        .map_err(|e| format!("获取音色列表失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut voices = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.starts_with("zh-CN") || line.starts_with("zh-TW") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                voices.push(TtsVoice {
                    name: parts[0].to_string(),
                    short_name: parts[0].to_string(),
                    gender: parts[1].to_string(),
                    locale: if parts[0].starts_with("zh-CN") { "中文".to_string() } else { "台湾".to_string() },
                });
            }
        }
    }
    Ok(voices)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WebMusicItem {
    id: u64,
    name: String,
    artist: String,
    cover: String,
    duration: u32,
    url: String,
    genre: String,
}

#[tauri::command]
async fn bili_get_qr_auth() -> Result<(String, String), String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36".parse().unwrap());
    headers.insert("Referer", "https://www.bilibili.com".parse().unwrap());
    
    let client = reqwest::Client::builder().default_headers(headers).build().unwrap();
    let url = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate";
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    
    let qr_url = json["data"]["url"].as_str().unwrap_or("").to_string();
    let qrcode_key = json["data"]["qrcode_key"].as_str().unwrap_or("").to_string();
    
    if qr_url.is_empty() { return Err("获取二维码失败".to_string()); }
    Ok((qr_url, qrcode_key))
}

#[tauri::command]
async fn bili_poll_qr_auth(qrcode_key: String) -> Result<(i32, String, String), String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36".parse().unwrap());
    headers.insert("Referer", "https://www.bilibili.com".parse().unwrap());
    
    let client = reqwest::Client::builder().default_headers(headers).build().unwrap();
    let url = format!("https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key={}", qrcode_key);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    let cookies = resp.headers().get_all("set-cookie")
        .into_iter()
        .filter_map(|h| h.to_str().ok())
        .collect::<Vec<_>>()
        .join("; ");
        
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let code = json["data"]["code"].as_i64().unwrap_or(-1) as i32;
    let message = json["data"]["message"].as_str().unwrap_or("").to_string();
    
    let mut sessdata = String::new();
    if code == 0 {
        // Fallback 1: Extract from the redirect URL in json payload
        if let Some(url_str) = json["data"]["url"].as_str() {
            if let Some(idx) = url_str.find("SESSDATA=") {
                let start = idx + 9;
                let end = url_str[start..].find('&').map(|i| start + i).unwrap_or(url_str.len());
                sessdata = url_str[start..end].to_string();
            }
        }
        
        // Fallback 2: cookies
        if sessdata.is_empty() {
            if let Some(s) = cookies.split(';').find(|c| c.trim().starts_with("SESSDATA=")) {
                sessdata = s.trim().replace("SESSDATA=", "");
            }
        }
    }
    Ok((code, message, sessdata))
}

#[tauri::command]
async fn search_web_music(keyword: String, source: Option<String>, sessdata: Option<String>) -> Result<Vec<WebMusicItem>, String> {
    let src = source.unwrap_or_else(|| "apple".to_string());
    
    if src == "local" {
        return search_local_music(keyword).await;
    } else if src == "jamendo" {
        return Err("Not supported".into());
    } else if src == "netease" {
        return Err("网易云通道尚未实装".into());
    } else if src == "bilibili" {
        // B站搜索
        let mut items = Vec::new();
        let url = format!("https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={}", urlencoding::encode(&keyword));
        
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36".parse().unwrap());
        if let Some(s) = sessdata {
            if !s.is_empty() {
                headers.insert("Cookie", format!("SESSDATA={}", s).parse().unwrap());
            }
        }

        let client = reqwest::Client::builder().default_headers(headers).build().unwrap();
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        
        if json["code"].as_i64().unwrap_or(-1) != 0 {
            return Err(format!("B站API出错: {:?}", json["message"]));
        }

        if let Some(results) = json.pointer("/data/result").and_then(|v| v.as_array()) {
            for v_obj in results {
                let id = v_obj["id"].as_u64().unwrap_or(0); // Actually an internal ID
                let bvid = v_obj["bvid"].as_str().unwrap_or("").to_string(); // we use bvid for url 
                let raw_name = v_obj["title"].as_str().unwrap_or("").to_string();
                let name = raw_name.replace("<em class=\"keyword\">", "").replace("</em>", "");
                let artist = v_obj["author"].as_str().unwrap_or("UP主").to_string();
                let cover = format!("https:{}", v_obj["pic"].as_str().unwrap_or(""));
                let dur_str = v_obj["duration"].as_str().unwrap_or("00:00"); // e.g., "03:45"
                let parts: Vec<&str> = dur_str.split(':').collect();
                let mut duration_ms = 0;
                if parts.len() == 2 {
                    if let (Ok(m), Ok(s)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                        duration_ms = (m * 60 + s) * 1000;
                    }
                }
                
                if !bvid.is_empty() {
                    items.push(WebMusicItem {
                        id,
                        name,
                        artist,
                        cover,
                        duration: duration_ms,
                        url: format!("bilibili:{}", bvid), // special prefix for download parsing
                        genre: "B站原音".to_string()
                    });
                }
            }
        }
        return Ok(items);
    }

    let url = format!("https://itunes.apple.com/search?term={}&media=music&limit=100", urlencoding::encode(&keyword));
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    
    let mut items = Vec::new();
    if let Some(results) = json.pointer("/results").and_then(|v| v.as_array()) {
        for s in results {
            let id = s["trackId"].as_u64().unwrap_or(0);
            let name = s["trackName"].as_str().unwrap_or("Unknown").to_string();
            let artist_name = s["artistName"].as_str().unwrap_or("Unknown").to_string();
            let cover_url = s["artworkUrl100"].as_str().unwrap_or("").to_string();
            let url_str = s["previewUrl"].as_str().unwrap_or("").to_string();
            let genre = s["primaryGenreName"].as_str().unwrap_or("Other").to_string();
            
            // preview format is usually 30-sec m4a snippet
            let duration = 30000;

            if id > 0 && !url_str.is_empty() {
                items.push(WebMusicItem { id, name, artist: artist_name, cover: cover_url, duration, url: url_str, genre });
            }
        }
    }

    // --- ALGORITHMIC SORTING AND DEDUPLICATION ---
    let kw_lower = keyword.to_lowercase();
    
    // Sort items by relevance (Descending)
    items.sort_by(|a, b| {
        let score_a = calculate_relevance(&a.name, &a.artist, &kw_lower);
        let score_b = calculate_relevance(&b.name, &b.artist, &kw_lower);
        score_b.cmp(&score_a) 
    });

    // Deduplication by identical name + artist to solve duplicate sources/albums
    let mut deduped = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in items {
        let key = format!("{}|{}", item.name.to_lowercase(), item.artist.to_lowercase());
        if !seen.contains(&key) {
            seen.insert(key);
            deduped.push(item);
        }
    }

    Ok(deduped)
}

fn calculate_relevance(name: &str, artist: &str, query: &str) -> i32 {
    let mut score = 0;
    let name_l = name.to_lowercase();
    let artist_l = artist.to_lowercase();
    
    // 1. Exact Match bonuses & Word Match bonuses
    if name_l == query { score += 50; }
    if artist_l == query { score += 50; }
    if query.contains(&artist_l) || artist_l.contains(query) { score += 20; }
    if query.contains(&name_l) || name_l.contains(query) { score += 20; }

    // If query has multiple words (e.g. "周杰伦 晴天"), boost if artist exactly matches one word
    let query_wants_inst = query.contains("instrumental") || query.contains("伴奏") || query.contains("karaoke");
    let mut word_matches_artist = false;
    for term in query.split_whitespace() {
        if artist_l == term {
            score += 60; // Huge bonus for an exact word match on artist name
            word_matches_artist = true;
        }
    }

    // 2. Penalize Non-Originals (Covers, Live, Remixes) IF query didn't organically ask for them
    let is_cover = name_l.contains("cover") || name_l.contains("翻唱");
    let is_live = name_l.contains("live") || name_l.contains("演唱会");
    let is_remix = name_l.contains("remix") || name_l.contains("dj");
    let is_inst = name_l.contains("instrumental") || name_l.contains("伴奏") || name_l.contains("piano") || name_l.contains("karaoke");

    if is_cover && !query.contains("cover") && !query.contains("翻唱") { score -= 40; }
    if is_live && !query.contains("live") && !query.contains("演唱会") { score -= 15; }
    if is_remix && !query.contains("remix") && !query.contains("dj") { score -= 25; }
    
    if query_wants_inst {
        // User actively wants an instrumental!
        if is_inst {
            score += 80; // Massive bonus
        } else {
            score -= 50; // Heavily penalize non-instrumentals
        }
    } else {
        // User didn't ask for instrumental
        if is_inst { score -= 30; }
    }

    score
}

async fn search_local_music(keyword: String) -> Result<Vec<WebMusicItem>, String> {
    // A brilliant idea: scan standard Music folders on Windows for mp3/wav files matching keyword
    use std::path::Path;
    use std::fs;
    
    let mut items = Vec::new();
    let mut id_counter = 50000;
    
    // Look in C:\Users\Username\Music or C:\Users\Public\Music
    let user_dirs = vec![
        dirs::audio_dir(),
        dirs::download_dir(),
        dirs::desktop_dir(),
        Some(std::path::PathBuf::from("H:\\project\\CLIP JIANJI\\public")) // A common fallback if needed
    ];

    for dir_opt in user_dirs {
        if let Some(dir) = dir_opt {
            if dir.exists() && dir.is_dir() {
                // A very simple non-recursive glob/scan for performance
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.filter_map(Result::ok) {
                        let path = entry.path();
                        if path.is_file() {
                            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                                if ext.eq_ignore_ascii_case("mp3") || ext.eq_ignore_ascii_case("wav") || ext.eq_ignore_ascii_case("m4a") {
                                    if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                                        if keyword.is_empty() || name.to_lowercase().contains(&keyword.to_lowercase()) {
                                            id_counter += 1;
                                            // Mock properties, since we don't have id3 reading cleanly included.
                                            let url = format!("file://{}", path.display().to_string().replace("\\", "/"));
                                            items.push(WebMusicItem {
                                                id: id_counter,
                                                name: name.to_string(),
                                                artist: "本地设备".to_string(),
                                                cover: "https://cdn-icons-png.flaticon.com/512/8112/8112613.png".to_string(),
                                                duration: 180000, // Hardcoded 3 mins placeholder, it plays until it finishes anyway
                                                url,
                                                genre: "本地实体文件".to_string()
                                            });
                                            if items.len() >= 50 {
                                                return Ok(items);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    if items.is_empty() {
        return Err("本地音乐夹、下载处或桌面均未检索到含该关键词的MP3/WAV文件。".to_string());
    }
    Ok(items)
}

#[tauri::command]
async fn download_web_music(app: tauri::AppHandle, mut url: String, id: u64, name: String, artist: String, sessdata: Option<String>) -> Result<String, String> {
    let mut actual_url = url.clone();
    
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36".parse().unwrap());
    headers.insert("Referer", "https://www.bilibili.com".parse().unwrap());
    
    if url.starts_with("bilibili:") {
        let bvid = url.strip_prefix("bilibili:").unwrap();
        // 1. Get CID
        if let Some(s) = &sessdata {
            if !s.is_empty() {
                headers.insert("Cookie", format!("SESSDATA={}", s).parse().unwrap());
            }
        }
        
        let client = reqwest::Client::builder().default_headers(headers.clone()).build().unwrap();
        
        // Fetch view info to get CID
        let view_url = format!("https://api.bilibili.com/x/web-interface/view?bvid={}", bvid);
        let resp = client.get(&view_url).send().await.map_err(|e| format!("B站CID请求失败: {}", e))?;
        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        
        if json["code"].as_i64().unwrap_or(-1) != 0 {
            return Err(format!("获取B站视频详情失败: {:?}", json["message"]));
        }
        
        let cid = json["data"]["cid"].as_u64().unwrap_or(0);
        if cid == 0 { return Err("无法获取视频CID".into()); }
        
        // 2. Get PlayUrl (dash format audio)
        let playurl = format!("https://api.bilibili.com/x/player/wbi/playurl?fnval=16&bvid={}&cid={}", bvid, cid);
        let resp = client.get(&playurl).send().await.map_err(|e| format!("B站音频地址请求失败: {}", e))?;
        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        
        if json["code"].as_i64().unwrap_or(-1) != 0 {
            // Fallback non-wbi
            let playurl_old = format!("https://api.bilibili.com/x/player/playurl?fnval=16&bvid={}&cid={}", bvid, cid);
            let resp2 = client.get(&playurl_old).send().await.map_err(|e| format!("B站降级请求失败: {}", e))?;
            let json2: serde_json::Value = resp2.json().await.map_err(|e| e.to_string())?;
            if let Some(arr) = json2.pointer("/data/dash/audio").and_then(|v| v.as_array()) {
                if let Some(first) = arr.first() {
                    actual_url = first["baseUrl"].as_str().unwrap_or("").to_string();
                } else {
                    return Err("未能解析音轨 (降级失败)".into());
                }
            } else {
                return Err(format!("无权解析高品质原音轨: {:?}", json2["message"]));
            }
        } else {
            if let Some(arr) = json.pointer("/data/dash/audio").and_then(|v| v.as_array()) {
                if let Some(first) = arr.first() {
                    actual_url = first["baseUrl"].as_str().unwrap_or("").to_string();
                } else {
                    return Err("未包含音轨数据".into());
                }
            } else {
                return Err("音轨数据结构异常".into());
            }
        }
    }
    
    // Now download from actual_url
    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())?;
    
    let resp = client.get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("无法下载歌曲，HTTP {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    
    // Apple's .m4a snippets are typically 10KB to 200KB depending on format + duration
    if bytes.len() < 5000 {
        return Err("音乐文件异常过小".to_string());
    }

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let music_dir = app_data_dir.join("music_downloads");
    if !music_dir.exists() {
        let _ = std::fs::create_dir_all(&music_dir);
    }

    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let safe_artist = artist.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let ext = if url.contains(".aac") || url.contains(".m4a") { "m4a" } else { "mp3" };
    let filename = format!("{}___{}_{}.{}", safe_artist, safe_name, id, ext);
    let out_path = music_dir.join(&filename);

    std::fs::write(&out_path, bytes).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(out_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn search_ytdlp(keyword: String, proxy: Option<String>) -> Result<Vec<WebMusicItem>, String> {
    let cwd = std::env::current_dir().unwrap_or_default();
    let script_path = if cwd.join("scripts/yt_music_engine.py").exists() {
        cwd.join("scripts/yt_music_engine.py")
    } else {
        cwd.join("src-tauri/scripts/yt_music_engine.py")
    };

    let mut cmd = std::process::Command::new("python");
    cmd.arg(&script_path).arg("--search").arg(&keyword);
    if let Some(p) = proxy {
        if !p.trim().is_empty() {
            cmd.arg("--proxy").arg(p.trim());
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    
    let output = cmd.output().map_err(|e| format!("Python 命令启动失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    let mut parsed_json: Option<serde_json::Value> = None;
    for line in stdout.lines().rev() {
        if line.trim().starts_with('{') {
            if let Ok(j) = serde_json::from_str(line) {
                parsed_json = Some(j);
                break;
            }
        }
    }
    
    let json = parsed_json.ok_or_else(|| format!("JSON 解析失败:\nstdout: {}\nstderr: {}", stdout, String::from_utf8_lossy(&output.stderr)))?;
    
    if json["status"].as_str().unwrap_or("") == "success" {
        let items: Vec<WebMusicItem> = serde_json::from_value(json["data"].clone()).map_err(|e| format!("反序列化失败: {}", e))?;
        Ok(items)
    } else {
        Err(json["message"].as_str().unwrap_or("未知错误").to_string())
    }
}

#[tauri::command]
async fn download_ytdlp(app: tauri::AppHandle, url: String, id: String, name: String, artist: String, proxy: Option<String>) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let music_dir = app_data_dir.join("music_downloads");
    if !music_dir.exists() {
        let _ = std::fs::create_dir_all(&music_dir);
    }

    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let safe_artist = artist.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let filename = format!("{}___{}_{}.m4a", safe_artist, safe_name, id);
    let out_path = music_dir.join(&filename);

    let cwd = std::env::current_dir().unwrap_or_default();
    let script_path = if cwd.join("scripts/yt_music_engine.py").exists() {
        cwd.join("scripts/yt_music_engine.py")
    } else {
        cwd.join("src-tauri/scripts/yt_music_engine.py")
    };

    let ffmpeg_path = resolve_ffmpeg_path(&app);

    let mut cmd = std::process::Command::new("python");
    cmd.arg(&script_path)
       .arg("--download").arg(&url)
       .arg("--output").arg(&out_path)
       .arg("--ffmpeg").arg(ffmpeg_path);
       
    if let Some(p) = proxy {
        if !p.trim().is_empty() {
            cmd.arg("--proxy").arg(p.trim());
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    
    let output = cmd.output().map_err(|e| format!("Python 命令启动失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    let mut parsed_json: Option<serde_json::Value> = None;
    if let Some(start) = stdout.find('{') {
        if let Some(end) = stdout.rfind('}') {
            if let Ok(j) = serde_json::from_str(&stdout[start..=end]) {
                parsed_json = Some(j);
            }
        }
    }
    
    let json = parsed_json.ok_or_else(|| format!("JSON 解析失败:\nstdout: {}\nstderr: {}", stdout, String::from_utf8_lossy(&output.stderr)))?;
    
    if json["status"].as_str().unwrap_or("") == "success" {
        Ok(json["path"].as_str().unwrap_or("").to_string())
    } else {
        Err(json["message"].as_str().unwrap_or("未知错误").to_string())
    }
}

#[tauri::command]
async fn read_local_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_machine_id() -> String {
    machine_uid::get().unwrap_or_else(|_| "UNKNOWN_MACHINE".to_string())
}

#[tauri::command]
fn read_auth_store(app: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let target = app_data_dir.join(".sys_auth.json");
    if target.exists() {
        std::fs::read_to_string(&target).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn write_auth_store(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_data_dir.exists() {
        let _ = std::fs::create_dir_all(&app_data_dir);
    }
    let target = app_data_dir.join(".sys_auth.json");
    std::fs::write(&target, data).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            generate_video,
            get_preview_url,
            normalize_image,
            reveal_in_explorer,
            write_temp_file,
            generate_tts,
            list_tts_voices,
            search_web_music,
            download_web_music,
            search_ytdlp,
            download_ytdlp,
            bili_get_qr_auth,
            bili_poll_qr_auth,
            read_local_file,
            get_machine_id,
            read_auth_store,
            write_auth_store
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
