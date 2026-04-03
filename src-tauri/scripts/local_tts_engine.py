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
    "https://ghfast.top/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-icefall-zh-aishell3.tar.bz2",
    "https://mirror.ghproxy.com/https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-icefall-zh-aishell3.tar.bz2"
]
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".cache", "clip_jianji_tts")
MODEL_DIR = os.path.join(CACHE_DIR, "vits-icefall-zh-aishell3")

# 根据实验挑选了多组在 AIShell3 中听着比较正常、拟真度不错的角色ID，伪装成各种音色
VOICE_MAP = {
    # ------------------ 女声系列 ------------------
    "zh-CN-F-QingCui":   {"sid": 0, "name": "zh-CN-F-QingCui", "short_name": "清脆女声", "gender": "Female", "desc": "元气清脆的少女音"},
    "zh-CN-F-RouMei":    {"sid": 1, "name": "zh-CN-F-RouMei", "short_name": "柔美女声", "gender": "Female", "desc": "温柔甜美的年轻女性"},
    "zh-CN-F-ZhiXing":   {"sid": 33, "name": "zh-CN-F-ZhiXing", "short_name": "知性女声", "gender": "Female", "desc": "成熟稳重的学姐音"},
    "zh-CN-F-QingLeng":  {"sid": 40, "name": "zh-CN-F-QingLeng", "short_name": "清冷御姐", "gender": "Female", "desc": "冷静且气质的冷艳音"},
    "zh-CN-F-HuoPo":     {"sid": 48, "name": "zh-CN-F-HuoPo", "short_name": "活泼女大", "gender": "Female", "desc": "略带俏皮的活泼女大"},
    "zh-CN-F-BaQi":      {"sid": 55, "name": "zh-CN-F-BaQi", "short_name": "霸气女主", "gender": "Female", "desc": "气场全开的大女主音"},
    "zh-CN-F-TianZhen":  {"sid": 61, "name": "zh-CN-F-TianZhen", "short_name": "天真萝莉", "gender": "Female", "desc": "稚嫩可爱的幼妹音"},
    "zh-CN-F-WenWan":    {"sid": 70, "name": "zh-CN-F-WenWan", "short_name": "温婉闺蜜", "gender": "Female", "desc": "极具亲和力的倾听者"},
    "zh-CN-F-LuoLi":     {"sid": 80, "name": "zh-CN-F-LuoLi", "short_name": "傲娇幼女", "gender": "Female", "desc": "带着一点点小脾气的二次元女孩"},
    "zh-CN-F-ZhiBo":     {"sid": 99, "name": "zh-CN-F-ZhiBo", "short_name": "电台女播", "gender": "Female", "desc": "字正腔圆的专业级广播女声"},
    
    # ------------------ 男声系列 ------------------
    "zh-CN-M-WenZhong":  {"sid": 10, "name": "zh-CN-M-WenZhong", "short_name": "稳重男声", "gender": "Male", "desc": "低沉磁性的成熟男声"},
    "zh-CN-M-QingNian":  {"sid": 14, "name": "zh-CN-M-QingNian", "short_name": "青年男声", "gender": "Male", "desc": "标准的青年男声音色"},
    "zh-CN-M-YangGuang": {"sid": 21, "name": "zh-CN-M-YangGuang", "short_name": "阳光少年", "gender": "Male", "desc": "充满朝气与活力的运动系男生"},
    "zh-CN-M-ZhiYu":     {"sid": 30, "name": "zh-CN-M-ZhiYu", "short_name": "治愈暖男", "gender": "Male", "desc": "温柔可亲如同邻家大哥哥"},
    "zh-CN-M-DaShu":     {"sid": 41, "name": "zh-CN-M-DaShu", "short_name": "沧桑大叔", "gender": "Male", "desc": "声音极具阅历的中老年男声"},
    "zh-CN-M-BaZong":    {"sid": 50, "name": "zh-CN-M-BaZong", "short_name": "霸道总裁", "gender": "Male", "desc": "冷酷强势的霸总音"},
    "zh-CN-M-ZhengTai":  {"sid": 66, "name": "zh-CN-M-ZhengTai", "short_name": "清心正太", "gender": "Male", "desc": "清亮单纯的小男孩音"},
    "zh-CN-M-DuoLuo":    {"sid": 88, "name": "zh-CN-M-DuoLuo", "short_name": "慵懒男主", "gender": "Male", "desc": "略带一丝沙哑的慵懒气息"},
    "zh-CN-M-DiYin":     {"sid": 100, "name": "zh-CN-M-DiYin", "short_name": "深感低音", "gender": "Male", "desc": "令人沉醉的重低音炮"},
    "zh-CN-M-XinWen":    {"sid": 120, "name": "zh-CN-M-XinWen", "short_name": "新闻男播", "gender": "Male", "desc": "严谨有力且字正腔圆的播音男"}
}

def download_model_if_needed():
    if not os.path.exists(MODEL_DIR):
        print(f"首次运行大模型，正在为您下载本地大模型基座...")
        print(f"大概 15MB，请稍候几秒...")
        os.makedirs(CACHE_DIR, exist_ok=True)
        tar_path = os.path.join(CACHE_DIR, "vits.tar.bz2")
        downloaded = False
        
        import urllib.request
        import ssl
        
        try:
            # 兼容不同系统环境，绕过无证书校验时的阻止
            ssl._create_default_https_context = ssl._create_unverified_context
        except AttributeError:
            pass
            
        for url in MODEL_URLS:
            try:
                print(f"尝试拉取节点: {url[:40]}...")
                urllib.request.urlretrieve(url, tar_path)
                if os.path.exists(tar_path) and os.path.getsize(tar_path) > 1000000:
                    downloaded = True
                    break
            except Exception as e:
                print(f"节点拉取失败: {e}，尝试下一个...")
        
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

    sid = VOICE_MAP.get(voice, VOICE_MAP["zh-CN-F-QingCui"])["sid"]
    
    # 初始化 VITS TTS
    vits_model = os.path.join(MODEL_DIR, "model.onnx")
    tokens = os.path.join(MODEL_DIR, "tokens.txt")
    lexicon = os.path.join(MODEL_DIR, "lexicon.txt")
    rule_fars = os.path.join(MODEL_DIR, "rule.far")

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
        rule_fars=rule_fars,
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
