import yt_dlp
import sys
import json
import argparse
import os

def search_youtube(keyword, proxy=None):
    ydl_opts = {
        'format': 'best',
        'noplaylist': True,
        'quiet': True,
        'extract_flat': 'in_playlist',
        'simulate': True,
    }
    if proxy and proxy.strip():
        ydl_opts['proxy'] = proxy.strip()

    search_query = f"ytsearch20:{keyword}"
    
    results = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_query, download=False)
            if 'entries' in info:
                for idx, entry in enumerate(info['entries']):
                    title = entry.get('title')
                    if not title:
                        continue
                    video_id = entry.get('id')
                    url = f"https://www.youtube.com/watch?v={video_id}" if video_id else entry.get('url')
                    author = entry.get('uploader', 'YouTube')
                    # format duration
                    duration_sec = entry.get('duration') or 0
                    
                    thumbnail = None
                    thumbnails = entry.get('thumbnails', [])
                    if thumbnails:
                        # Grab medium quality thumbnail
                        thumbnail = thumbnails[len(thumbnails)//2].get('url')
                        
                    results.append({
                        'id': abs(hash(video_id or url)) % 900000000,
                        'name': title,
                        'artist': author,
                        'cover': thumbnail or "https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo_2005.svg",
                        'duration': int(duration_sec * 1000),
                        'url': url,
                        'genre': "YouTube 全域检索"
                    })
        print(json.dumps({'status': 'success', 'data': results}))
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))


def download_audio(url, output_path, proxy=None, ffmpeg=None):
    # Ensure directory exists
    out_dir = os.path.dirname(output_path)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir)
        
    ydl_opts = {
        'format': 'm4a/bestaudio/best',
        # extract_audio requires ffmpeg installed
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a',
        }],
        'outtmpl': output_path.replace('.m4a', ''), # without extension, posprocessor adds it
        'quiet': True,
        'no_warnings': True,
    }
    if proxy and proxy.strip():
        ydl_opts['proxy'] = proxy.strip()
        
    if ffmpeg and ffmpeg.strip():
        ydl_opts['ffmpeg_location'] = ffmpeg.strip()

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        # Check if file was created
        if os.path.exists(output_path) or os.path.exists(output_path.replace('.m4a', '.mp3')):
            final_path = output_path
            if not os.path.exists(final_path) and os.path.exists(output_path.replace('.m4a', '.mp3')):
                final_path = output_path.replace('.m4a', '.mp3')
            print(json.dumps({'status': 'success', 'path': final_path}))
        else:
            print(json.dumps({'status': 'error', 'message': 'Download completed but file not found'}))
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="YouTube Music Engine using yt-dlp")
    parser.add_argument('--search', type=str, help='Search keyword')
    parser.add_argument('--download', type=str, help='URL to download')
    parser.add_argument('--output', type=str, help='Output path for download')
    parser.add_argument('--proxy', type=str, help='HTTP/SOCKS proxy URL', default='')
    parser.add_argument('--ffmpeg', type=str, help='Path to ffmpeg executable', default='')
    
    args = parser.parse_args()
    
    if args.search:
        search_youtube(args.search, args.proxy)
    elif args.download and args.output:
        download_audio(args.download, args.output, args.proxy, args.ffmpeg)
    else:
        print(json.dumps({'status': 'error', 'message': 'Invalid arguments'}))
