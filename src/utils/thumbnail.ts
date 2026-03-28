// ─── 性能优化：缩略图生成引擎（并发限流 max=4）──────────────────────
export const THUMB_WIDTH = 180;
export const thumbCache = new Map<string, string>();
const thumbPending = new Map<string, Promise<string>>();

const thumbQueue: Array<() => Promise<void>> = [];
let thumbRunning = 0;
const THUMB_CONCURRENCY = 4;

const runThumbQueue = () => {
  while (thumbRunning < THUMB_CONCURRENCY && thumbQueue.length > 0) {
    const task = thumbQueue.shift()!;
    thumbRunning++;
    task().finally(() => { thumbRunning--; runThumbQueue(); });
  }
};

export const generateThumbnail = (srcUrl: string): Promise<string> => {
  if (thumbCache.has(srcUrl)) return Promise.resolve(thumbCache.get(srcUrl)!);
  if (thumbPending.has(srcUrl)) return thumbPending.get(srcUrl)!;

  const p = new Promise<string>((resolve) => {
    const doWork = () => new Promise<void>((done) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const scale = Math.min(1, THUMB_WIDTH / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          const url = blob ? URL.createObjectURL(blob) : srcUrl;
          thumbCache.set(srcUrl, url);
          thumbPending.delete(srcUrl);
          resolve(url);
          canvas.width = 0; canvas.height = 0; // 释放 GPU 资源
          done();
        }, 'image/webp', 0.65);
      };
      img.onerror = () => {
        thumbCache.set(srcUrl, srcUrl);
        thumbPending.delete(srcUrl);
        resolve(srcUrl);
        done();
      };
      img.src = srcUrl;
    });
    thumbQueue.push(doWork);
    runThumbQueue();
  });
  thumbPending.set(srcUrl, p);
  return p;
};
