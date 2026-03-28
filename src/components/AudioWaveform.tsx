import React, { memo, useRef, useEffect } from 'react';

// ─── 莫兰迪绚烂色谱定义 ──────────────────────────────────────────
export const AUDIO_PALETTES = [
  { c1: '#8B5CF6', c2: '#A855F7', c3: '#EC4899', glow: 'rgba(168, 85, 247, 0.6)' }, // 极光紫
  { c1: '#10B981', c2: '#34D399', c3: '#6EE7B7', glow: 'rgba(52, 211, 153, 0.5)' }, // 森林绿
  { c1: '#0EA5E9', c2: '#38BDF8', c3: '#7DD3FC', glow: 'rgba(56, 189, 248, 0.5)' }, // 海天蓝
  { c1: '#F43F5E', c2: '#FB7185', c3: '#FDA4AF', glow: 'rgba(251, 113, 133, 0.5)' }, // 绯红
  { c1: '#F59E0B', c2: '#FBBF24', c3: '#FCD34D', glow: 'rgba(251, 191, 36, 0.5)' },  // 夕阳金
];

// ─── 子组件: iOS 26 全息幻彩丝带流光波形 (玻璃质感曲线) ─────────────────────────────
const AUDIO_RAINBOW = [
  '#FF3B30', // Red
  '#FF9500', // Orange
  '#FFCC00', // Yellow
  '#34C759', // Green
  '#00C7BE', // Teal
  '#30B0C7', // Light Blue
  '#007AFF', // Blue
  '#5856D6', // Indigo
  '#AF52DE', // Purple
  '#FF2D55'  // Pink
];

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
