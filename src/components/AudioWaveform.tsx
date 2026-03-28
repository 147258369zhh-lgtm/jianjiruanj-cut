import { memo, useRef, useEffect } from 'react';
import { AUDIO_RAINBOW, AUDIO_PALETTES } from '../utils/constants';

export const AudioWaveform = memo(({ isPlaying, palette }: { isPlaying: boolean; palette: typeof AUDIO_PALETTES[0] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(Date.now()).current;
  const numWaves = 2; // 性能优化：从4波降低到2波

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let animationId: number;
    let isVisible = true;

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.1 });
    observer.observe(canvas);

    // 不播放时只渲染一帧静态画面
    const renderStatic = () => {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const midY = canvas.height / 2;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(canvas.width, midY);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.globalCompositeOperation = 'lighter';
      for (let w = 0; w < numWaves; w++) {
        const path = new Path2D();
        for (let x = 0; x <= canvas.width; x += 8) {
          const normX = x / canvas.width;
          const yOff = Math.sin(normX * 10 + w * 2) * 4;
          const y = midY + yOff;
          if (x === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        const c1 = AUDIO_RAINBOW[(w * 2) % AUDIO_RAINBOW.length];
        const c2 = AUDIO_RAINBOW[(w * 2 + 3) % AUDIO_RAINBOW.length];
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, c1);
        gradient.addColorStop(1, c2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.2;
        ctx.stroke(path);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.stroke(path);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
    };

    if (!isPlaying) {
      renderStatic();
      return () => { observer.disconnect(); };
    }

    const render = () => {
      if (!isVisible) {
        animationId = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const midY = canvas.height / 2;
      const t = (Date.now() - startTime) / 500;

      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(canvas.width, midY);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.globalCompositeOperation = 'lighter';

      for (let w = 0; w < numWaves; w++) {
        const path = new Path2D();
        for (let x = 0; x <= canvas.width; x += 8) { // 步长从5增大到8
          const normX = x / canvas.width;
          const speed = t * (1 + w * 0.2);
          const freq = normX * 10 + w * 2;
          const amp = Math.sin(speed * 0.5) * 16 + 22;
          const yOff = Math.sin(freq - speed * 2) * Math.cos(normX * 5 + speed) * amp;
          const y = midY + yOff;
          if (x === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }

        const c1 = AUDIO_RAINBOW[(w * 2) % AUDIO_RAINBOW.length];
        const c2 = AUDIO_RAINBOW[(w * 2 + 3) % AUDIO_RAINBOW.length];
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, c1);
        gradient.addColorStop(1, c2);

        // 性能优化：移除 shadowBlur，只保留2层渲染
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.4;
        ctx.stroke(path);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        ctx.stroke(path);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;

      animationId = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [isPlaying, palette]);

  return <canvas ref={canvasRef} width={500} height={60} style={{ width: '100%', height: '100%', display: 'block', opacity: 0.9 }} />;
});