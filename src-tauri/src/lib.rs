use exif::{In, Reader, Tag};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::process::Command;
use tauri::Manager;

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
    #[serde(rename = "autoOpen")]
    auto_open: bool,
    #[serde(rename = "resourcePaths")]
    resource_paths: Vec<ResourcePath>,
    #[serde(rename = "audioClips")]
    audio_clips: Vec<AudioTimelineItem>,
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
    let quality = payload.quality;
    let codec = payload.codec;
    let hdr = payload.hdr;

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
    let ffmpeg_path = resolve_ffmpeg_path(&app);

    let mut script = String::new();
    for (i, item) in items.iter().enumerate() {
        let mut vf_chain = vec![];
        vf_chain.push("loop=loop=-1:size=1:start=0".to_string());
        vf_chain.push(format!("fps={}", fps));
        vf_chain.push(format!("trim=duration={}", item.duration));
        vf_chain.push("setpts=PTS-STARTPTS".to_string());

        match item.rotation.unwrap_or(0) {
            90 => vf_chain.push("transpose=1".to_string()),
            180 => vf_chain.push("hflip,vflip".to_string()),
            270 => vf_chain.push("transpose=2".to_string()),
            _ => {}
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
                vf_chain.push(format!("drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':text='{}':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=h-th-100:borderw=4:bordercolor=black", safe_text));
            }
        }

        if let Some(cp) = &item.crop_pos {
            vf_chain.push(format!(
                "crop=iw*{}/100:ih*{}/100:iw*{}/100:ih*{}/100",
                cp.width, cp.height, cp.x, cp.y
            ));
        }

        vf_chain.push(format!("format=yuv420p,setsar=1,scale={}:force_original_aspect_ratio=decrease,pad={}:-1:-1:color=black", resolution, resolution));
        script.push_str(&format!("[{}:v]{}[v{}];\n", i, vf_chain.join(","), i));
    }

    let mut concat_inputs = String::new();
    for i in 0..items.len() {
        concat_inputs.push_str(&format!("[v{}]", i));
    }
    script.push_str(&format!(
        "{}concat=n={}:v=1:a=0[outv]\n",
        concat_inputs,
        items.len()
    ));
    std::fs::write(&filter_script_path, script).map_err(|e| format!("写入滤镜脚本失败: {}", e))?;

    let mut cmd = Command::new(&ffmpeg_path);
    cmd.arg("-y");

    let final_output = app
        .path()
        .desktop_dir()
        .map_err(|e| e.to_string())?
        .join(format!(
            "output_{}.mp4",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));

    for item in &items {
        let is_dng = item.path.to_lowercase().ends_with(".dng");
        let path = if is_dng {
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
        };
        cmd.arg("-i").arg(path.replace("\\", "/"));
    }

    let mut audio_inputs_count = 0;
    for clip in &payload.audio_clips {
        if let Some(res) = payload
            .resource_paths
            .iter()
            .find(|r| r.id == clip.resource_id)
        {
            cmd.arg("-ss")
                .arg(clip.start_offset.to_string())
                .arg("-t")
                .arg(clip.duration.to_string())
                .arg("-i")
                .arg(res.path.replace("\\", "/"));
            audio_inputs_count += 1;
        }
    }

    cmd.arg("-filter_complex_script")
        .arg(&filter_script_path)
        .arg("-map")
        .arg("[outv]");

    if audio_inputs_count > 0 {
        if audio_inputs_count == 1 {
            cmd.arg("-map").arg(format!("{}:a", items.len()));
        } else {
            let mut amix_str = String::new();
            for i in 0..audio_inputs_count {
                amix_str.push_str(&format!("[{}:a]", items.len() + i));
            }
            amix_str.push_str(&format!(
                "amix=inputs={}:duration=longest[outa]",
                audio_inputs_count
            ));
            cmd.arg("-filter_complex")
                .arg(amix_str)
                .arg("-map")
                .arg("[outa]");
        }
    }

    if codec == "h265" {
        cmd.arg("-c:v").arg("libx265");
        if hdr {
            cmd.arg("-pix_fmt")
                .arg("yuv420p10le")
                .arg("-color_primaries")
                .arg("bt2020")
                .arg("-color_trc")
                .arg("smpte2084")
                .arg("-colorspace")
                .arg("bt2020nc")
                .arg("-x265-params")
                .arg("hdr10=1:repeat-headers=1:color-range=pc");
        }
    } else {
        cmd.arg("-c:v").arg("libx264");
    }

    if quality == "lossless" {
        cmd.arg("-crf").arg("10").arg("-preset").arg("slow");
    } else if quality == "high" {
        cmd.arg("-crf").arg("15").arg("-preset").arg("slow");
    } else {
        cmd.arg("-crf").arg("23");
    }

    if audio_inputs_count > 0 {
        cmd.arg("-c:a").arg("aac").arg("-shortest");
    }
    cmd.arg(&final_output);

    let status = cmd
        .status()
        .map_err(|e| format!("唤醒 FFmpeg 引擎失败: {}. 路径: {:?}", e, ffmpeg_path))?;
    if status.success() {
        if payload.auto_open {
            let _ = tauri_plugin_opener::open_path(final_output.clone(), None::<String>);
        }
        Ok(final_output.to_string_lossy().to_string())
    } else {
        Err(format!("视频合成失败: {}", status))
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            generate_video,
            get_preview_url,
            normalize_image,
            reveal_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
