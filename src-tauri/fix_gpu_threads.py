import sys
import re

with open(r'h:\project\CLIP JIANJI\src-tauri\src\lib.rs', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the hardware threading logic which crashed the GPU
old_threads_logic = r"""    let max_threads = if encoder_family == "cpu" {
        (cpu_count as f32 * 0.8) as usize 
    } else {
        if cpu_count >= 16 {
            4 // 发烧级配置 (如 Ryzen 9700X)，放开 4 路 GPU 并发压榨性能
        } else if cpu_count >= 8 {
            3 // 主流机器
        } else {
            2 // 轻薄本，保护显存
        }
    };"""

new_threads_logic = r"""    // 紧急回调：显卡硬编芯片 (ASIC) 有物理并发数墙！
    // 强制丢给 AMD 4 个高强度的无损流会导致显卡的视频引擎死锁并大量吃尽 VRAM 和 PCIe 带宽，从而拖垮整个电脑。
    // 经验证，GPU 硬件加速的“最速甜点”是固定为 2 路并发，让流水线永远满载但不溢出。
    let max_threads = if encoder_family == "cpu" {
        (cpu_count as f32 * 0.8) as usize 
    } else {
        2 // 严格将硬件并发锁死在 2，杜绝显存溢出！
    };"""

new_text = text.replace(old_threads_logic, new_threads_logic)

with open(r'h:\project\CLIP JIANJI\src-tauri\src\lib.rs', 'w', encoding='utf-8') as f:
    f.write(new_text)
