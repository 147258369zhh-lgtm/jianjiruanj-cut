export interface ThumbnailTask {
  src: string;
  timeOffset: number;
  key: string;
  resolve: (dataUrl: string) => void;
  reject: (err: any) => void;
}

class ThumbnailGenerator {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;

  private queue: ThumbnailTask[] = [];
  private cache: Map<string, string> = new Map();
  private processing: boolean = false;
  private lastProcessTime: number = 0;

  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';
    // 关键：在跨域（tauri -> asset）环境下必须设置，否则 toDataURL 会报 Tainted Canvas
    this.video.crossOrigin = 'anonymous'; 
    this.canvas = document.createElement('canvas');
    this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public async getThumbnail(src: string, timeOffset: number): Promise<string> {
    // 归一化时间点，避免微小的精度差异导致重复提取
    const roundedOffset = Math.round(timeOffset * 100) / 100;
    const key = `${src}_${roundedOffset}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ src, timeOffset: roundedOffset, key, resolve, reject });
      
      // 核心优化：按视频源排序。
      // 先把一个视频的所有帧切完再切下一个，减少几百次 load() 调用，速度起飞。
      this.queue.sort((a, b) => a.src.localeCompare(b.src));
      
      this.processNext();
    });
  }

  private async processNext() {
    if (this.processing) {
      if (Date.now() - this.lastProcessTime > 10000) {
        console.warn('[ThumbnailGenerator] Task timeout, forcing recovery.');
        this.processing = false;
      } else {
        return;
      }
    }
    
    if (this.queue.length === 0) return;
    
    this.processing = true;
    this.lastProcessTime = Date.now();
    const task = this.queue.shift()!;

    // 再次检查缓存（可能排队时别的任务已经做好了）
    if (this.cache.has(task.key)) {
      task.resolve(this.cache.get(task.key)!);
      this.processing = false;
      this.processNext();
      return;
    }

    try {
      // 1. 切换视频源
      if (this.video.src !== task.src) {
        this.video.src = task.src;
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => { cleanup(); resolve(); };
          const onError = (e: any) => { cleanup(); reject(e); };
          const cleanup = () => {
            this.video.removeEventListener('loadedmetadata', onLoaded);
            this.video.removeEventListener('error', onError);
          };
          this.video.addEventListener('loadedmetadata', onLoaded);
          this.video.addEventListener('error', onError);
          setTimeout(() => { cleanup(); resolve(); }, 4000); // 4s 还没加载完也强行继续，防止卡死
          this.video.load();
        });
      }

      // 2. 跳转到目标时间点
      const duration = this.video.duration || 0;
      const targetTime = Math.max(0, Math.min(task.timeOffset, duration));
      
      if (Math.abs(this.video.currentTime - targetTime) > 0.05) {
        this.video.currentTime = targetTime;
        await new Promise<void>((resolve) => {
          const onSeeked = () => { cleanup(); resolve(); };
          const cleanup = () => this.video.removeEventListener('seeked', onSeeked);
          this.video.addEventListener('seeked', onSeeked);
          setTimeout(() => { cleanup(); resolve(); }, 2500); // 2.5s 还没跳到位也要画，不然整个队列全毁了
        });
      }

      // 3. 提取图像
      // 必须 readyState >= 2 (HAVE_CURRENT_DATA) 才能成功 drawImage
      if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
        const aspect = this.video.videoWidth / this.video.videoHeight;
        this.canvas.width = 240; 
        this.canvas.height = Math.round(240 / aspect);
        
        // 重新获取 context (修改 width 会重置 context)
        const ctx = this.canvas.getContext('2d')!;
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        try {
          const dataUrl = this.canvas.toDataURL('image/jpeg', 0.8);
          this.cache.set(task.key, dataUrl);
          task.resolve(dataUrl);
        } catch (e) {
          console.error('Tainted canvas detected even with crossOrigin!', e);
          task.reject(e);
        }
      } else {
        task.reject(new Error("Video not ready or invalid dimensions"));
      }

    } catch (err) {
      console.warn('Individual Task Failed:', err);
      task.reject(err);
    } finally {
      this.processing = false;
      // 微小延迟给 UI 线程一点喘息机会
      setTimeout(() => this.processNext(), 10);
    }
  }
}

export const globalThumbnailGenerator = new ThumbnailGenerator();
