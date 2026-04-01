import os
import sys
import json
import urllib.request
import tarfile
import argparse
import ssl

# ==========================================
# 独立大模型调度池 (基于 sherpa-onnx)
# 完全模拟 edge-tts 接口，给上层提供离线秒出服务
# ==========================================

MODEL_URLS = [
    "https://hf-mirror.com/csukuangfj/vits-zh-aishell3/resolve/main/vits-aishell3.tar.bz2",
    "https://mirror.ghproxy.com/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-aishell3.tar.bz2",
    "https://github.moeyy.xyz/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-aishell3.tar.bz2"
]
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".cache", "clip_jianji_tts")
MODEL_DIR = os.path.join(CACHE_DIR, "vits-aishell3")

# 根据实验挑选了几个在 AIShell3 中听着比较正常、拟真度不错的角色ID，伪装成各种音色
VOICE_MAP = {
    "zh-CN-Aishell3-F0": {"sid": 0, "name": "zh-CN-Aishell3-F0", "short_name": "Aishell3-F0", "gender": "Female", "desc": "开源清脆女声"},
    "zh-CN-Aishell3-F1": {"sid": 1, "name": "zh-CN-Aishell3-F1", "short_name": "Aishell3-F1", "gender": "Female", "desc": "开源柔美女声"},
    "zh-CN-Aishell3-M10": {"sid": 10, "name": "zh-CN-Aishell3-M10", "short_name": "Aishell3-M10", "gender": "Male", "desc": "开源稳重男声"},
    "zh-CN-Aishell3-M14": {"sid": 14, "name": "zh-CN-Aishell3-M14", "short_name": "Aishell3-M14", "gender": "Male", "desc": "开源青年男声"},
    "zh-CN-Aishell3-F33": {"sid": 33, "name": "zh-CN-Aishell3-F33", "short_name": "Aishell3-F33", "gender": "Female", "desc": "开源知性女声"}
}

def download_model_if_needed():
    if not os.path.exists(MODEL_DIR):
        print(f"首次运行大模型，正在从国内高速镜像为您下载本地大模型基座...")
        print(f"大概 15MB，请稍候几秒...")
        os.makedirs(CACHE_DIR, exist_ok=True)
        tar_path = os.path.join(CACHE_DIR, "vits.tar.bz2")
        downloaded = False
        
        import subprocess
        for url in MODEL_URLS:
            try:
                print(f"尝试借助系统引擎拉取节点: {url[:30]}...")
                subprocess.run(["curl.exe", "-k", "-L", url, "-o", tar_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if os.path.exists(tar_path) and os.path.getsize(tar_path) > 1000000:
                    downloaded = True
                    break
            except Exception as e:
                print(f"节点拉取失败，尝试下一个...")
        
        
        if not downloaded:
            print("所有大模型节点下载失败，请检查网络！")
            sys.exit(1)
            
        print("本地基座下载完毕，正在解压挂载配置...")
        with tarfile.open(tar_path, "r:bz2") as tar:
            tar.extractall(path=CACHE_DIR)
        os.remove(tar_path)
        print("大模型基座已就绪！")
    return True

def handle_list_voices():
    # 返回跟 edge-tts 相同的 JSON 数组格式
    res = []
    for k, v in VOICE_MAP.items():
        res.append({
            "Name": v["name"],
            "ShortName": v["short_name"],
            "Gender": v["gender"],
            "Locale": "zh-CN"
        })
    print(json.dumps(res, ensure_ascii=False))

def handle_generate(text, voice, rate_str, output_path):
    download_model_if_needed()
    import sherpa_onnx
    import soundfile as sf
    import numpy as np

    sid = VOICE_MAP.get(voice, VOICE_MAP["zh-CN-Aishell3-F0"])["sid"]
    
    # 初始化 VITS TTS
    vits_model = os.path.join(MODEL_DIR, "vits-aishell3.onnx")
    tokens = os.path.join(MODEL_DIR, "tokens.txt")
    lexicon = os.path.join(MODEL_DIR, "lexicon.txt")
    rule_fsts = os.path.join(MODEL_DIR, "rule.fst")

    tts_config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=vits_model,
                lexicon=lexicon,
                tokens=tokens,
            ),
            num_threads=2,
            debug=0,
            provider="cpu",
        ),
        rule_fsts=rule_fsts,
        max_num_sentences=1,
    )
    
    tts = sherpa_onnx.OfflineTts(tts_config)
    
    # 处理速率，例如 "+20%"
    speed = 1.0
    if rate_str:
        if rate_str.startswith('+'):
            speed += float(rate_str.strip('+%')) / 100.0
        elif rate_str.startswith('-'):
            speed -= float(rate_str.strip('-%')) / 100.0
    
    # 大模型零延迟硬解
    audio = tts.generate(text, sid=sid, speed=speed)
    
    # 写出到 WAV 文件
    sf.write(output_path, audio.samples, tts.sample_rate)
    print(f"Audio generated precisely at {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Local TTS Engine Stand-in for Edge-TTS")
    parser.add_argument("--list-voices", action="store_true", help="List all available local voices")
    parser.add_argument("--text", type=str, help="Text to synthesize")
    parser.add_argument("--voice", type=str, help="Voice ID to use")
    parser.add_argument("--rate", type=str, default="+0%", help="Speaking rate")
    parser.add_argument("--write-media", type=str, help="Output path (should end in .wav)")
    
    args = parser.parse_args()

    if args.list_voices:
        handle_list_voices()
    elif args.text and args.write_media:
        handle_generate(args.text, args.voice, args.rate, args.write_media)
    else:
        print("Error: Either --list-voices or --text/--write-media must be provided.", file=sys.stderr)
        sys.exit(1)
