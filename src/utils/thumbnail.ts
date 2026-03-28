// ─── 缩略图生成引擎 ────────────────────────────────────────────────────────

const THUMB_WIDTH = 80;
const thumbCache = new Map<string, string>();
const thumbPending = new Map<string, Promise<string>>();

const thumbQueue: Array<{ src: string; resolve: (v: string) => void }> = [];
let activeThumbTasks = 0;
const THUMB_CONCURRENCY = 4;

function runThumbQueue() {
  while (activeThumbTasks < THUMB_CONCURRENCY && thumbQueue.length > 0) {
    const task = thumbQueue.shift()!;
    activeThumbTasks++;
    doGenerateThumbnail(task.src)
      .then(url => task.resolve(url))
      .finally(() => { activeThumbTasks--; runThumbQueue(); });
  }
}

export function generateThumbnail(src: string): Promise<string> {
  if (thumbCache.has(src)) return Promise.resolve(thumbCache.get(src)!);
  if (thumbPending.has(src)) return thumbPending.get(src)!;
  
  const p = new Promise<string>((resolve) => {
    thumbQueue.push({ src, resolve });
    runThumbQueue();
  });
  thumbPending.set(src, p);
  return p;
}

function doGenerateThumbnail(src: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = THUMB_WIDTH / img.naturalWidth;
      const w = THUMB_WIDTH;
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, w, h);
      try {
        const url = canvas.toDataURL('image/webp', 0.5);
        thumbCache.set(src, url);
        resolve(url);
      } catch {
        thumbCache.set(src, src);
        resolve(src);
      }
    };
    img.onerror = () => { thumbCache.set(src, src); resolve(src); };
    img.src = src;
  });
}

export function getThumbCache() { return thumbCache; }
