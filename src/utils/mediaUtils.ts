// ─── 媒体工具 ────────────────────────────────────────────────────────

/**
 * 获取媒体文件时长（视频/音频）
 * 返回 Promise<number>，单位秒
 */
export function getMediaDuration(url: string): Promise<number> {
  const isHttp = url.startsWith('http') || url.startsWith('blob:');
  const isWebRelative = url.startsWith('/');
  const src = isHttp || isWebRelative ? url : url;

  return new Promise((resolve) => {
    const media = new Audio();
    media.preload = 'metadata';

    const timeout = setTimeout(() => resolve(3), 8000);

    media.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = isFinite(media.duration) && media.duration > 0 ? media.duration : 3;
      resolve(dur);
      media.src = '';
    };

    media.onerror = () => {
      clearTimeout(timeout);
      // 尝试 blob 方式兜底
      fetch(url)
        .then(r => r.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const fallbackMedia = new Audio();
          fallbackMedia.preload = 'metadata';
          fallbackMedia.onloadedmetadata = () => {
            const d = isFinite(fallbackMedia.duration) && fallbackMedia.duration > 0
              ? fallbackMedia.duration : 3;
            resolve(d);
            URL.revokeObjectURL(blobUrl);
          };
          fallbackMedia.onerror = () => { resolve(3); URL.revokeObjectURL(blobUrl); };
          fallbackMedia.src = blobUrl;
        })
        .catch(() => resolve(3));
    };

    media.src = src;
  });
}
