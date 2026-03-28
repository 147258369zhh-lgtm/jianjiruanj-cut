// ─── 媒体工具 ────────────────────────────────────────────────────────
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * 获取媒体文件时长（视频/音频）
 * 兼容 Tauri 与浏览器环境
 */
export const getMediaDuration = (path: string): Promise<number> => {
  return new Promise((resolve) => {
    const isHttp = path.startsWith('http');
    const isWebRelative = path.startsWith('/');
    let url: string;
    try {
      url = (isHttp || isWebRelative) ? path : convertFileSrc(path);
    } catch {
      // 浏览器环境 fallback
      url = path;
    }
    const media = new Audio();
    // 仅对外部 URL 设置 crossOrigin
    if (isHttp && !url.includes('asset.localhost')) {
      media.crossOrigin = 'anonymous';
    }
    media.preload = 'metadata';

    const timeout = setTimeout(() => {
      media.src = '';
      resolve(10);
    }, 5000);

    media.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = media.duration;
      // 安全上限：Infinity 或超 1 小时视为解析失败
      resolve(!dur || !isFinite(dur) || dur > 3600 ? 10 : dur);
    };
    media.onerror = () => {
      clearTimeout(timeout);
      // 终极回退：CORS 拒绝时尝试 Fetch 转 BlobURL
      if (isHttp) {
        fetch(url, { mode: 'cors' })
          .then(res => res.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const fallbackMedia = new Audio(blobUrl);
            fallbackMedia.onloadedmetadata = () => resolve(fallbackMedia.duration || 10);
            fallbackMedia.onerror = () => resolve(10);
          })
          .catch(() => resolve(10));
      } else {
        resolve(10);
      }
    };
    media.src = url;
  });
};
