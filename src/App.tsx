import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FluentProvider,
  webDarkTheme,
  Button,
  Text,
  Slider,
  Field,
  Input,
} from "@fluentui/react-components";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { convertFileSrc } from '@tauri-apps/api/core';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import "./App.css";
import "./Win11Theme.css";

// ─── 类型定义 ────────────────────────────────────────────────────────
interface Resource { id: string; name: string; path: string; type: 'image' | 'audio' | 'video'; focusX?: number; focusY?: number; hasFace?: boolean; }

interface AudioTimelineItem {
  id: string;
  resourceId: string;
  timelineStart: number;
  startOffset: number;
  duration: number;
  volume: number;
  fadeIn?: number;   // 淡入时长 (秒，默认0)
  fadeOut?: number;  // 淡出时长 (秒，默认0)
  // 剪辑点系统
  cutPoints?: number[];      // 在夹内的时间位置 (0~duration)，左闭右开
  selectedRegions?: number[]; // 被选中待删除的区域索引
}

interface TimelineItem {
  id: string;
  resourceId: string;
  duration: number;
  transition: string;
  rotation: number;
  contrast: number;
  saturation: number;
  exposure: number;    // 曝光 (1.0)
  brilliance: number;  // 鲜明度 (1.0)
  temp: number;        // 色温 (0)
  tint: number;        // 色调 (0)
  zoom: number;
  overlayText?: string;
  fontSize?: number;   // 24
  fontWeight?: string; // "bold"
  fontColor?: string;  // 文字颜色 (#fff)
  fontFamily?: string; // 字体
  textAlign?: 'left' | 'center' | 'right'; // 对齐方式
  textBg?: string;     // 文字背景色 (rgba)
  textShadowColor?: string;  // 文字阴影颜色
  textStrokeColor?: string;  // 文字描边颜色
  textStrokeWidth?: number;  // 文字描边宽度
  textGlow?: boolean;        // 文字发光
  textX?: number;            // 文字X位置 (0-100%, 默认50)
  textY?: number;            // 文字Y位置 (0-100%, 默认50)
  cropPos?: Crop;
  textAnimation?: string; // 文字入场动画，如 'fadeIn' | 'slideLeft' | 'slideUp' | 'zoom' | 'bounce' | 'typewriter' 等
  textAnimDuration?: number; // 动画时长 (秒，默认 0.6)
  animation?: string; // 图片入场动效 / 镜头推进
  overrides?: string[]; // 被手动修改过的字段名列表（全局覆盖模型）
}

// 全局默认值接口
interface GlobalDefaults {
  duration: number;
  transition: string;
  exposure: number;
  brilliance: number;
  contrast: number;
  saturation: number;
  temp: number;
  tint: number;
  zoom: number;
  rotation: number;
  animation: string;
}

const GLOBAL_DEFAULTS_INIT: GlobalDefaults = {
  duration: 3, transition: 'fade',
  exposure: 1.0, brilliance: 1.0, contrast: 1.0, saturation: 1.0,
  temp: 0, tint: 0, zoom: 1.0, rotation: 0, animation: 'none'
};

const ANIMATION_PRESETS = ['anim-img-fadeIn', 'anim-img-slideLeft', 'anim-img-slideRight', 'anim-img-slideUp', 'anim-img-slideDown', 'anim-img-zoomIn', 'anim-img-zoomOut', 'anim-img-panLeft', 'anim-img-panRight'];

// ─── 媒体特征无损高速探测引擎 ───────────────────────────────────────────────────
const getMediaDuration = (path: string): Promise<number> => {
  return new Promise((resolve) => {
    const isHttp = path.startsWith('http');
    const isWebRelative = path.startsWith('/');
    const url = (isHttp || isWebRelative) ? path : convertFileSrc(path);
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
      // 终极回退：CORS 拒绝时尝试 Fetch 转 BlobURL (针对严苛的 CDN)
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

// ─── 莫兰迪绚烂色谱定义 ──────────────────────────────────────────
const AUDIO_PALETTES = [
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

const AudioWaveform = memo(({ isPlaying, palette }: { isPlaying: boolean; palette: typeof AUDIO_PALETTES[0] }) => {
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

// ─── 子组件: 沉浸式玻璃态自定义下拉框 (解决原生 select 无法美化弹窗的问题) ───
const IosSelect = ({ value, options, onChange, style }: { value: string; options: {value: string, label: string}[]; onChange: (v: string) => void; style?: React.CSSProperties }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', onClick, true); // mousedown captures better than click
    return () => window.removeEventListener('mousedown', onClick, true);
  }, [isOpen]);

  const selectedOpt = options.find(o => o.value === value) || { label: value };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(20, 20, 25, 0.8)', color: '#fff', border: isOpen ? '1px solid var(--ios-indigo)' : '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 12, padding: '0 12px', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', boxShadow: isOpen ? '0 0 0 2px var(--ios-indigo-glow)' : 'none' }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(30,30,35,0.9)'; e.currentTarget.style.borderColor = isOpen ? 'var(--ios-indigo)' : 'var(--ios-indigo)'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(20,20,25,0.8)'; e.currentTarget.style.borderColor = isOpen ? 'var(--ios-indigo)' : 'rgba(255,255,255,0.1)'; }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedOpt?.label}</span>
        <span style={{ fontSize: 9, opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0 }}>▼</span>
      </div>
      {isOpen && createPortal(
        <div style={{
          position: 'absolute',
          top: ref.current ? ref.current.getBoundingClientRect().bottom + 6 : 0,
          left: ref.current ? ref.current.getBoundingClientRect().left : 0,
          width: ref.current ? ref.current.getBoundingClientRect().width : 'auto',
          background: 'rgba(30, 30, 38, 0.95)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 12,
          padding: 6,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          zIndex: 999999,
          maxHeight: 280,
          overflowY: 'auto'
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                color: opt.value === value ? '#fff' : 'rgba(255,255,255,0.7)',
                background: opt.value === value ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (opt.value !== value) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; } }}
              onMouseLeave={e => { if (opt.value !== value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};


// ─── 性能优化：缩略图生成引擎（并发限流 max=4）──────────────────────
const THUMB_WIDTH = 180; // 略微减小宽度以提升速度
const thumbCache = new Map<string, string>(); // path -> blobUrl
// 已入队但还未有结果的 Promise，防止同一 URL 重复入队
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

const generateThumbnail = (srcUrl: string): Promise<string> => {
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

// ─── 子组件: 极简图片卡片 ──────────────────────────────────────────
const SortableImageCard = memo(function SortableImageCard({
  item, resource, isSelected, onSelect, onRemove, pps, previewUrl, onContextMenu, onTrimDuration, onDoubleClickCard, multiSelectIndex, isMultiSelected
}: {
  item: TimelineItem; resource?: Resource; isSelected: boolean; onSelect: (id: string, isCtrl: boolean) => void; onRemove: (id: string) => void; pps: number; previewUrl?: string; onContextMenu?: (e: React.MouseEvent) => void; onTrimDuration?: (id: string, delta: number) => void; onDoubleClickCard?: () => void; multiSelectIndex?: number; isMultiSelected?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useSortable({ id: item.id });
  const [isHovered, setIsHovered] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setCombinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    containerRef.current = node;
  }, [setNodeRef]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: '800px 0px', threshold: 0 });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isVideo = resource?.type === 'video';

  // 性能优化：异步生成缩略图，时间轴只显示小图 (视频不生成缩略图)
  useEffect(() => {
    if (isVideo) return; // 视频不走 generateThumbnail
    const src = previewUrl
      ? (previewUrl.startsWith('http') || previewUrl.startsWith('blob:') ? previewUrl : convertFileSrc(previewUrl))
      : resource ? convertFileSrc(resource.path) : '';
    if (!src) return;
    generateThumbnail(src).then(setThumbUrl);
  }, [resource?.path, previewUrl, isVideo]);

  const thumbStyle: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: 'cover',
    transform: `rotate(${item.rotation}deg) scale(${item.zoom || 1})`,
    filter: `
      brightness(${item.exposure ?? 1.0}) 
      contrast(${(item.contrast ?? 1.0) + ((item.brilliance ?? 1.0) - 1.0) * 0.2}) 
      saturate(${(item.saturation ?? 1.0) + ((item.brilliance ?? 1.0) - 1.0) * 0.1})
      sepia(${(item.temp ?? 0) > 0 ? (item.temp ?? 0) / 100 : 0})
      hue-rotate(${(item.tint ?? 0)}deg)
    `,
    transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), filter 0.3s',
  };

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    fontSize: `${item.fontSize || 24}px`,
    fontWeight: (item.fontWeight === 'bold' ? 700 : 400),
    textAlign: 'center',
    pointerEvents: 'none',
    width: '90%',
    wordBreak: 'break-all',
    textShadow: '0 2px 10px rgba(0,0,0,0.8)',
    zIndex: 5,
  };

  // 缩略图 src：优先使用生成的缩略图，fallback 到原图
  const imgSrc = thumbUrl || (previewUrl
    ? (previewUrl.startsWith('http') || previewUrl.startsWith('blob:') ? previewUrl : convertFileSrc(previewUrl))
    : resource ? convertFileSrc(resource.path) : '');

  return (
    <div
      ref={setCombinedRef}
      className={`ios-btn-hover ${isSelected ? 'ios-selected' : ''} ${isMultiSelected ? 'ios-multi-selected' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        width: `${item.duration * pps}px`,
        height: '100%',
        flexShrink: 0,
        position: 'relative',
        cursor: 'grab',
        overflow: 'hidden',
        borderRadius: '12px',
        background: isSelected ? 'rgba(94, 92, 230, 0.08)' : 'rgba(0,0,0,0.5)',
        border: isSelected
          ? (isMultiSelected ? '2.5px dashed rgba(94, 92, 230, 0.9)' : '3px solid rgba(94, 92, 230, 0.9)')
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isSelected
          ? '0 0 20px rgba(94,92,230,0.5), 0 10px 30px rgba(94,92,230,0.3), inset 0 0 15px rgba(94,92,230,0.1)'
          : 'none',
        boxSizing: 'border-box',
      }}
      {...attributes} {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id, e.ctrlKey || e.metaKey); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickCard?.(); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Trim 手柄 (左右边缘) */}
      <div
        className="trim-handle trim-handle-left"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const startX = e.clientX;
          const startDur = item.duration;
          const onMove = (me: MouseEvent) => {
            const deltaPx = me.clientX - startX;
            const deltaDur = deltaPx / pps;
            const newDur = Math.max(0.3, startDur - deltaDur);
            onTrimDuration?.(item.id, newDur - startDur);
          };
          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />
      <div
        className="trim-handle trim-handle-right"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const startX = e.clientX;
          const startDur = item.duration;
          const onMove = (me: MouseEvent) => {
            const deltaPx = me.clientX - startX;
            const deltaDur = deltaPx / pps;
            const newDur = Math.max(0.3, startDur + deltaDur);
            onTrimDuration?.(item.id, newDur - startDur);
          };
          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />
      {isVisible ? (
        <>
          {resource ? (
            isVideo ? (
              <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <video src={imgSrc} muted style={{ ...thumbStyle, position: 'absolute', inset: 0, pointerEvents: 'none' }} preload="metadata" />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 18, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>🎬</span>
                </div>
                <div style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 8, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.5)', padding: '1px 3px', borderRadius: 3, pointerEvents: 'none' }}>{item.duration.toFixed(1)}s</div>
              </div>
            ) : (
              <img src={imgSrc} style={thumbStyle} alt="" />
            )
          ) : (
            item.overlayText ? (
              <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.textBg || 'rgba(30,30,30,0.9)', padding: '4px' }}>
                <span style={{ fontSize: Math.min(item.fontSize || 14, 14), fontWeight: 700, color: item.fontColor || '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '95%' }}>{item.overlayText}</span>
              </div>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#ef4444' }}>缺失</div>
          )}
        </>
      ) : null}

      {/* 右上角删除按钮 (hover 时显示) */}
      {isHovered && (
        <div
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 4, right: 4, zIndex: 20,
            width: 18, height: 18, borderRadius: 5,
            background: 'rgba(255, 59, 48, 0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 10, color: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            transition: 'transform 0.15s',
          }}
          title="从轨道移除"
        >🗑</div>
      )}

      {/* 多选序号角标 */}
      {isMultiSelected && multiSelectIndex !== undefined && (
        <div style={{
          position: 'absolute', top: 4, left: 4, zIndex: 20,
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--ios-indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: '#fff',
          boxShadow: '0 2px 8px rgba(94,92,230,0.6)',
          pointerEvents: 'none',
        }}>{multiSelectIndex + 1}</div>
      )}

      {/* 浮空文字预览层 */}
      {item.overlayText && (
        <div style={textStyle}>
          {item.overlayText}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding: '4px 8px', fontSize: 9, color: '#fff', display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <span>{item.duration.toFixed(1)}s</span>
        <span style={{ opacity: 0.6 }}>{item.transition !== 'none' ? '✨' : ''}</span>
      </div>
    </div>
  );
});

// ─── 子组件: 剪辑点音频轨道项 (剪辑点系统) ──────────────────────────────────────
type AudioTrackItemProps = {
  item: AudioTimelineItem;
  resource: any;
  isSelected: boolean;
  onSelect: (id: string, isCtrl: boolean) => void;
  pps: number;
  isPlaying: boolean;
  editingMode: boolean;
  onUpdateItem: (id: string, patch: Partial<AudioTimelineItem>, isDragging?: boolean) => void;
};

const AudioTrackItem = memo(({ item, resource, isSelected, onSelect, pps, isPlaying, editingMode, onUpdateItem }: AudioTrackItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingCutIdx, setDraggingCutIdx] = useState<number | null>(null);

  // 根据 resourceId 生成稳定的索引来选取色谱
  const paletteIdx = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < (item.resourceId || '').length; i++) hash = (hash << 5) - hash + item.resourceId.charCodeAt(i);
    return Math.abs(hash) % AUDIO_PALETTES.length;
  }, [item.resourceId]);
  const palette = AUDIO_PALETTES[paletteIdx];

  const cutPoints: number[] = (item.cutPoints || []).slice().sort((a, b) => a - b);
  const selectedRegions: number[] = item.selectedRegions || [];
  const selectedSet = new Set(selectedRegions);

  // 全部区域的边界 (0 + cutPoints + duration)
  const allBoundaries = [0, ...cutPoints, item.duration];

  // 把容器内的 clientX 转换成 clip 内的时间值
  const xToTime = (clientX: number): number => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const t = ((clientX - rect.left) / rect.width) * item.duration;
    return Math.max(0, Math.min(item.duration, t));
  };

  // 双击插入剪辑点
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingMode) return;

    const t = xToTime(e.clientX);
    const isNearExisting = cutPoints.some(cp => Math.abs(cp - t) < 0.1);

    if (!isNearExisting) {
      const newCP = [...cutPoints, t].sort((a, b) => a - b);
      let newSelected = [...selectedRegions];
      // 智能化：如果是插入第二个点，自动选中中间那段
      if (newCP.length === 2 && selectedRegions.length === 0) {
        newSelected = [1];
      }
      onUpdateItem(item.id, { cutPoints: newCP, selectedRegions: newSelected });
    }
  };

  // 单击点击背景或轨道：做事件拦截，防重入冲突
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 取消此处进行 onSelect：因为 onMouseDown 已经将它触发过了
    // 如果两边都触发，就导致 selected=true 紧接着马上 false （抵消了 Ctrl click）
  };

  // 剪辑点拖拽
  const handleCutMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setDraggingCutIdx(idx);
    const onMove = (me: MouseEvent) => {
      const t = xToTime(me.clientX);
      const newCuts = cutPoints.map((cp, i) => i === idx ? t : cp);
      onUpdateItem(item.id, { cutPoints: newCuts.sort((a, b) => a - b) });
    };
    const onUp = () => {
      setDraggingCutIdx(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 全位移拖拽 (非剪辑模式)
  const handleDragStart = (e: React.MouseEvent) => {
    if (editingMode) return;
    e.stopPropagation();
    onSelect(item.id, e.ctrlKey || e.metaKey);

    const startX = e.clientX;
    const startT = item.timelineStart;

    const onMove = (me: MouseEvent) => {
      const deltaT = (me.clientX - startX) / pps;
      onUpdateItem(item.id, { timelineStart: startT + deltaT }, true);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const blockWidth = item.duration * pps;

  return (
    <div
      className={`timeline-block ${isSelected ? 'selected-item' : ''}`}
      style={{ position: 'absolute', left: item.timelineStart * pps, top: 2, bottom: 2, width: blockWidth, display: 'flex', flexDirection: 'column', minWidth: 20 }}
    >
      <div
        ref={containerRef}
        style={{
          flex: 1, position: 'relative', width: '100%',
          borderRadius: 12,
          background: isSelected
            ? `${palette.c1}44` // 44 是 25% 不透明度
            : `linear-gradient(180deg, ${palette.c1}33 0%, ${palette.c2}11 100%)`,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: isSelected ? `1.5px solid ${palette.c2}` : `1px solid ${palette.c1}44`,
          cursor: editingMode ? 'crosshair' : 'grab',
          overflow: 'hidden',
          boxShadow: isSelected
            ? `0 0 20px ${palette.glow}, inset 0 0 10px ${palette.c1}33`
            : '0 4px 12px rgba(0,0,0,0.3)',
        }}
        onClick={handleContentClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleDragStart}
      >
        {/* 波形层 */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'flex', alignItems: 'center' }}>
          <AudioWaveform isPlaying={isPlaying} palette={palette} />
        </div>

        {/* 剪辑区域高亮覆盖层 */}
        {editingMode && allBoundaries.length > 1 && allBoundaries.slice(0, -1).map((boundary, idx) => {
          const regionStart = boundary / item.duration;
          const regionEnd = allBoundaries[idx + 1] / item.duration;
          const isRegionSelected = selectedSet.has(idx);
          return (
            <div
              key={idx}
              style={{
                position: 'absolute', top: 0, bottom: 0, zIndex: 2,
                left: `${regionStart * 100}%`,
                width: `${(regionEnd - regionStart) * 100}%`,
                background: isRegionSelected
                  ? 'rgba(255, 59, 48, 0.45)' // iOS 红色半透明
                  : 'rgba(255, 255, 255, 0.02)',
                border: isRegionSelected ? '1px solid #FF3B30' : 'none',
                borderRight: (idx < allBoundaries.length - 2 && !isRegionSelected) ? '1px solid rgba(255,255,255,0.05)' : 'none',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onClick={(e) => {
                e.stopPropagation();
                const newSelectedRegions = selectedSet.has(idx)
                  ? selectedRegions.filter(r => r !== idx)
                  : [...selectedRegions, idx];
                onUpdateItem(item.id, { selectedRegions: newSelectedRegions });
              }}
              onDoubleClick={handleDoubleClick}
            >
              {isRegionSelected && (
                <div style={{
                  fontSize: 10, color: '#fff', fontWeight: 900,
                  textShadow: '0 2px 8px rgba(255, 59, 48, 0.8)',
                  background: '#FF3B30', padding: '1px 6px', borderRadius: 4,
                  transform: 'scale(0.9)'
                }}>待删除</div>
              )}
            </div>
          );
        })}

        {/* 剪辑点标线 */}
        {editingMode && cutPoints.map((cp, idx) => {
          const pct = cp / item.duration;
          return (
            <div
              key={idx}
              style={{
                position: 'absolute', top: 0, bottom: 0, zIndex: 10,
                left: `calc(${pct * 100}% - 1px)`,
                width: 3,
                background: draggingCutIdx === idx ? '#FBBF24' : '#F472B6',
                cursor: 'col-resize',
                boxShadow: '0 0 8px #F472B6',
              }}
              onMouseDown={(e) => handleCutMouseDown(e, idx)}
            >
              {/* 顶部小三角把手 */}
              <div style={{
                position: 'absolute', top: -1, left: -5, width: 13, height: 10,
                background: draggingCutIdx === idx ? '#FBBF24' : '#F472B6',
                clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                cursor: 'col-resize',
              }} />
            </div>
          );
        })}

        {/* 剪辑模式提示角标 */}
        {editingMode && (
          <div style={{
            position: 'absolute', top: 4, right: 4, zIndex: 20,
            background: 'rgba(139,92,246,0.85)', borderRadius: 4, padding: '1px 5px',
            fontSize: 9, color: '#fff', pointerEvents: 'none',
          }}>✂ 剪辑</div>
        )}
      </div>

      {/* 曲目名标签 */}
      <div style={{
        position: 'absolute', bottom: 2, left: 6, fontSize: 9, fontWeight: 700,
        color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)',
        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        pointerEvents: 'none', zIndex: 10
      }}>
        {resource?.name}
      </div>
    </div>
  );
});

// ─── 子组件: iOS 资源库卡片 ──────────────────────────────────────────
const ResourceCardItem = memo(({ res, isAdded, isChecked, onToggle, onSelectPreview, onAdd, onRemove, onConvert, onReveal: _onReveal, previewUrl }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // 识别原始 DNG (未转码)
  const isDNG = res.path.toLowerCase().endsWith('.dng');
  const hasPreview = !!previewUrl;

  const displaySrc = useMemo(() => {
    if (previewUrl) {
      return (previewUrl.startsWith('http') || previewUrl.startsWith('blob:') ? previewUrl : convertFileSrc(previewUrl));
    }
    if (res.type === 'image' || res.type === 'video') {
      return convertFileSrc(res.path);
    }
    return '';
  }, [res, previewUrl]);

  // 音频项：完全不同的紧凑设计
  if (res.type === 'audio') {
    const audioColors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#06B6D4'];
    const colorIdx = res.name.length % audioColors.length;
    const accentColor = audioColors[colorIdx];
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
          background: isChecked ? `${accentColor}15` : (isHovered ? 'rgba(255,255,255,0.03)' : 'transparent'),
          borderRadius: 10, cursor: 'pointer',
          borderLeft: isChecked ? `3px solid ${accentColor}` : '3px solid transparent',
          transition: 'all 0.25s ease',
        }}
        onClick={() => onSelectPreview(res)}
        onDoubleClick={() => onToggle(res.id)}
      >
        {/* 小圆形渐变图标 */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}15)`,
          border: `1px solid ${accentColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15,
          transition: 'transform 0.2s',
          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
        }}>♪</div>
        {/* 名称 */}
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 12.5, fontWeight: isChecked ? 600 : 400,
          color: isChecked ? '#fff' : 'rgba(255,255,255,0.8)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: 0.3,
        }}>{res.name}</div>
        {/* 行内操作按钮 */}
        {(isHovered || isAdded) && (
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <div
              style={{
                width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isAdded ? `${accentColor}90` : 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={e => { e.stopPropagation(); onAdd(res); }}
              title={isAdded ? "已添加" : "添加轨道"}
            >{isAdded ? '✓' : '+'}</div>
            <div
              style={{
                width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={e => { e.stopPropagation(); onRemove(res.id); }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.25)'; e.currentTarget.style.color = '#FF3B30'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              title="移除"
            >×</div>
          </div>
        )}
      </div>
    );
  }

  // 视频项：类似音频的列表布局
  if (res.type === 'video') {
    const videoColors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];
    const vColorIdx = res.name.length % videoColors.length;
    const vAccent = videoColors[vColorIdx];
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px',
          background: isChecked ? `${vAccent}15` : (isHovered ? 'rgba(255,255,255,0.03)' : 'transparent'),
          borderRadius: 10, cursor: 'pointer',
          borderLeft: isChecked ? `3px solid ${vAccent}` : '3px solid transparent',
          transition: 'all 0.25s ease',
        }}
        onClick={() => onSelectPreview(res)}
        onDoubleClick={() => onToggle(res.id)}
      >
        {/* 视频缩略图 */}
        <div style={{
          width: 64, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
          background: '#000', position: 'relative',
          border: isHovered ? `1px solid ${vAccent}50` : '1px solid rgba(255,255,255,0.06)',
          transition: 'all 0.25s',
        }}>
          <video src={displaySrc} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onMouseEnter={e => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
            onMouseLeave={e => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
          />
          <div style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 8, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '0 3px', borderRadius: 2 }}>🎬</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: isChecked ? 500 : 400, color: isChecked ? '#fff' : 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.name}</div>
        </div>
        {(isHovered || isAdded) && (
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isAdded ? `${vAccent}90` : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={e => { e.stopPropagation(); onAdd(res); }} title={isAdded ? '已添加' : '添加轨道'}>{isAdded ? '✓' : '+'}</div>
            <div style={{ width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={e => { e.stopPropagation(); onRemove(res.id); }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.25)'; e.currentTarget.style.color = '#FF3B30'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              title="移除">×</div>
          </div>
        )}
      </div>
    );
  }

  // 图片项的颜色主题（根据名称 hash 取色）
  const imgColors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6'];
  const imgColorIdx = res.name.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % imgColors.length;
  const imgAccent = imgColors[imgColorIdx];

  // 图片项：保持缩略图布局
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 12, padding: '5px 8px',
        background: isChecked ? `${imgAccent}12` : (isHovered ? `${imgAccent}08` : 'transparent'),
        borderRadius: 10, cursor: 'pointer',
        borderLeft: isChecked ? `3px solid ${imgAccent}` : '3px solid transparent',
        transition: 'all 0.25s ease',
      }}
      onClick={() => onSelectPreview(res)}
      onDoubleClick={() => onToggle(res.id)}
    >
      {/* 图片缩略图 */}
      <div style={{
        width: 72, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        background: '#151515', display: 'flex', justifyContent: 'center', alignItems: 'center',
        border: isHovered ? `1px solid ${imgAccent}50` : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isHovered ? `0 4px 12px ${imgAccent}25` : 'none',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        transform: isHovered ? 'scale(1.04)' : 'scale(1)',
        position: 'relative'
      }}>
        {displaySrc ? (
          <img src={displaySrc} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isDNG ? 0.6 : 1 }} alt="" />
        ) : (
          <div style={{ fontSize: 10, opacity: 0.3, color: '#fff' }}>...</div>
        )}
        {/* DNG 转换 */}
        {isDNG && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', opacity: isHovered ? 1 : (hasPreview ? 0 : 0.8),
            transition: 'opacity 0.3s'
          }}>
            {!hasPreview && (
              <Button size="small" appearance="primary" disabled={isConverting}
                style={{ fontSize: 9, padding: '0 6px', height: 20, borderRadius: 4, background: 'var(--ios-indigo)', border: 'none', fontWeight: 600, color: '#fff' }}
                onClick={async (e) => { e.stopPropagation(); setIsConverting(true); await onConvert(res.id); setIsConverting(false); }}
              >{isConverting ? '...' : '转换'}</Button>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: isChecked ? 500 : 400,
          color: isChecked ? '#fff' : 'rgba(255,255,255,0.85)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{res.name}</div>
        {isDNG && <div style={{ fontSize: 9, color: 'var(--ios-indigo)', letterSpacing: 1, marginTop: 2 }}>RAW</div>}
      </div>

      {/* 行内操作按钮 */}
      {(isHovered || isAdded) && (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <div
            style={{
              width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isAdded ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onClick={e => { e.stopPropagation(); onAdd(res); }}
            title={isAdded ? "已添加" : "添加轨道"}
          >{isAdded ? '✓' : '+'}</div>
          <div
            style={{
              width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onClick={e => { e.stopPropagation(); onRemove(res.id); }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.25)'; e.currentTarget.style.color = '#FF3B30'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            title="移除"
          >×</div>
        </div>
      )}
    </div>
  );
});

// ─── 主应用 ──────────────────────────────────────────────────────
function App() {
  const [pps, setPps] = useState(24);
  const [resources, setResources] = useState<Resource[]>([
    { id: 'lib_aud_1', name: '🎵 宁静心境 (Please Calm My Mind)', path: '/audio/please-calm-my-mind.mp3', type: 'audio' },
    { id: 'lib_aud_2', name: '🎹 遗忘的华尔兹 (Forgotten Waltz)', path: '/audio/forgotten-waltz.mp3', type: 'audio' },
    { id: 'lib_aud_3', name: '🌿 钢琴小品 (Piano Music)', path: '/audio/piano-music.mp3', type: 'audio' },
    { id: 'lib_aud_4', name: '✨ 温柔恬静 (Calm Soft)', path: '/audio/calm-soft.mp3', type: 'audio' },
    { id: 'lib_aud_5', name: '🌊 柔和背景 (Background Soft Calm)', path: '/audio/background-soft-calm.mp3', type: 'audio' },
  ]);

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [audioItems, setAudioItems] = useState<AudioTimelineItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAudioIds, setSelectedAudioIds] = useState<Set<string>>(new Set());
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [monitorRes, setMonitorRes] = useState<Resource | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'effects' | 'export'>('effects');
  const [libTab, setLibTab] = useState<'image' | 'audio' | 'video'>('image');

  // 导出设置
  const [exportFormat, setExportFormat] = useState<'mp4' | 'mov'>('mp4');
  const [exportResolution, setExportResolution] = useState<'1080p' | '4k' | 'original'>('original');
  const [exportFps, setExportFps] = useState<'30' | '60'>('60');
  const [exportQuality, setExportQuality] = useState<'medium' | 'high' | 'lossless'>('lossless');
  const [exportCodec, setExportCodec] = useState<'h264' | 'h265'>('h264');
  const [exportHdr, setExportHdr] = useState(false);

  // 裁切编辑
  const [crop, setCrop] = useState<Crop>();
  const [isCropping, setIsCropping] = useState(false);

  // 音频剪辑
  const [isEditingAudio, setIsEditingAudio] = useState(false);

  // 播放指针拖拽
  const [isDraggingHead, setIsDraggingHead] = useState(false);
  const [isJumping, setIsJumping] = useState(false); // 控制双击时的平滑跳转
  const [selectionBox, setSelectionBox] = useState<{ x1: number; x2: number; y: number; h: number } | null>(null);
  const [localDuration, setLocalDuration] = useState<number | null>(null);
  const [audioBlobs, setAudioBlobs] = useState<{ [id: string]: string }>({}); // 核心：URL 映射缓存
  const [previewCache, setPreviewCache] = useState<{ [path: string]: string }>({}); // RAW 预览图映射缓存
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'image' | 'audio'; targetId: string } | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [_isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<'ios' | 'win11'>(() => {
    return (localStorage.getItem('__editor_theme__') as 'ios' | 'win11') || 'ios';
  });

  // ─── 改版新增状态 ────────────────────────────────────────────────────
  const [projectName, setProjectName] = useState('未命名项目');
  const [sortMode, setSortMode] = useState<'manual' | 'time' | 'name'>('manual');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [leftTab, setLeftTab] = useState<'photo' | 'music' | 'video'>('photo');
  const [_showAdvancedExport, _setShowAdvancedExport] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [showGlobalDefaults, setShowGlobalDefaults] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ─── 全局默认值系统 (任务6) ──────────────────────────────────────────
  const [globalDefaults, setGlobalDefaults] = useState<GlobalDefaults>(GLOBAL_DEFAULTS_INIT);
  const globalDefaultsRef = useRef(globalDefaults);
  globalDefaultsRef.current = globalDefaults;

  // 检查字段是否被覆盖
  const isOverridden = useCallback((item: TimelineItem, key: string) => {
    return item.overrides?.includes(key) ?? false;
  }, []);

  // 监听退出全屏
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── 智能面部检测引擎 WebWorker ─────────────────────────
  const faceWorkerRef = useRef<Worker | null>(null);
  
  useEffect(() => {
    faceWorkerRef.current = new Worker(new URL('./workers/faceDetector.worker.ts', import.meta.url), { type: 'module' });
    faceWorkerRef.current.onmessage = (e) => {
      const { id, focusX, focusY, found } = e.data;
      setResources(prev => prev.map(r => r.id === id ? { ...r, focusX, focusY, hasFace: found } : r));
    };
    return () => faceWorkerRef.current?.terminate();
  }, []);

  // ─── 性能优化：状态 Ref (消除播放时级联重渲染) ─────────────────
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const audioItemsRef = useRef(audioItems);
  audioItemsRef.current = audioItems;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const selectedAudioIdsRef = useRef(selectedAudioIds);
  selectedAudioIdsRef.current = selectedAudioIds;
  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;

  // ─── 撤销/重做系统 (ref-based, 零依赖) ───────────────────────
  interface EditorSnapshot { timeline: TimelineItem[]; audioItems: AudioTimelineItem[]; }
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);

  const pushSnapshot = useCallback(() => {
    undoStackRef.current.push({
      timeline: JSON.parse(JSON.stringify(timelineRef.current)),
      audioItems: JSON.parse(JSON.stringify(audioItemsRef.current))
    });
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, []);

  // 恢复单个字段的继承 (全局覆盖模型)
  const restoreInheritance = useCallback((itemId: string, key: keyof GlobalDefaults) => {
    pushSnapshot();
    setTimeline(prev => prev.map(t => {
      if (t.id === itemId || selectedIdsRef.current.has(t.id)) {
        const newOverrides = (t.overrides || []).filter(k => k !== key);
        return { ...t, [key]: globalDefaults[key], overrides: newOverrides };
      }
      return t;
    }));
    setStatusMsg(`🔗 已恢复「${key}」为全局默认值`); setTimeout(() => setStatusMsg(''), 1500);
  }, [globalDefaults, pushSnapshot]);

  const undo = useCallback(() => {
    const snap = undoStackRef.current.pop();
    if (!snap) { setStatusMsg('⚠️ 已经是最早状态'); setTimeout(() => setStatusMsg(''), 1500); return; }
    redoStackRef.current.push({
      timeline: JSON.parse(JSON.stringify(timelineRef.current)),
      audioItems: JSON.parse(JSON.stringify(audioItemsRef.current))
    });
    setTimeline(snap.timeline);
    setAudioItems(snap.audioItems);
    setStatusMsg('↩️ 已撤销'); setTimeout(() => setStatusMsg(''), 1200);
  }, []);

  const redo = useCallback(() => {
    const snap = redoStackRef.current.pop();
    if (!snap) { setStatusMsg('⚠️ 已经是最新状态'); setTimeout(() => setStatusMsg(''), 1500); return; }
    undoStackRef.current.push({
      timeline: JSON.parse(JSON.stringify(timelineRef.current)),
      audioItems: JSON.parse(JSON.stringify(audioItemsRef.current))
    });
    setTimeline(snap.timeline);
    setAudioItems(snap.audioItems);
    setStatusMsg('↪️ 已重做'); setTimeout(() => setStatusMsg(''), 1200);
  }, []);

  // ─── 滤镜预设 ──────────────────────────────────────────────────
  const FILTER_PRESETS = useMemo(() => [
    { name: '🎞 胶片', exposure: 0.95, contrast: 1.15, saturation: 0.85, temp: 15, tint: 5, brilliance: 1.0 },
    { name: '🌸 日系', exposure: 1.1, contrast: 0.9, saturation: 0.7, temp: -10, tint: -5, brilliance: 1.05 },
    { name: '🎬 电影', exposure: 0.9, contrast: 1.3, saturation: 0.8, temp: 10, tint: -10, brilliance: 1.1 },
    { name: '⬛ 黑白', exposure: 1.0, contrast: 1.2, saturation: 0.0, temp: 0, tint: 0, brilliance: 1.0 },
    { name: '🌅 暖阳', exposure: 1.05, contrast: 1.1, saturation: 1.1, temp: 30, tint: 10, brilliance: 1.05 },
    { name: '❄️ 冷调', exposure: 1.0, contrast: 1.15, saturation: 0.9, temp: -25, tint: -15, brilliance: 1.0 },
    { name: '📷 复古', exposure: 0.92, contrast: 1.1, saturation: 0.65, temp: 20, tint: 8, brilliance: 0.95 },
    { name: '🍃 清新', exposure: 1.08, contrast: 0.95, saturation: 1.15, temp: -5, tint: 5, brilliance: 1.1 },
    { name: '🔮 梦幻', exposure: 1.1, contrast: 0.85, saturation: 0.9, temp: -15, tint: 15, brilliance: 1.15 },
    { name: '🎨 鲜艳', exposure: 1.0, contrast: 1.2, saturation: 1.5, temp: 5, tint: 0, brilliance: 1.1 },
    { name: '🏚 褪色', exposure: 1.05, contrast: 0.85, saturation: 0.5, temp: 10, tint: 5, brilliance: 0.9 },
    { name: '🌇 夕照', exposure: 0.95, contrast: 1.15, saturation: 1.2, temp: 40, tint: 15, brilliance: 1.0 },
    { name: '🧊 青橙', exposure: 1.0, contrast: 1.2, saturation: 1.1, temp: -20, tint: 20, brilliance: 1.05 },
    { name: '✨ 柔光', exposure: 1.15, contrast: 0.88, saturation: 0.95, temp: 5, tint: 0, brilliance: 1.2 },
    { name: '🔄 重置', exposure: 1.0, contrast: 1.0, saturation: 1.0, temp: 0, tint: 0, brilliance: 1.0 },
  ], []);


  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null); // 指针 DOM 引用
  const libScrollRef = useRef<HTMLDivElement>(null);
  const [libScrollTop, setLibScrollTop] = useState(0);
  const timeTextRef = useRef<HTMLSpanElement>(null); // 时间文字 DOM 引用
  const monitorVideoRef = useRef<HTMLVideoElement>(null); // 预览区视频元素引用
  const clickTimesRef = useRef<number[]>([]); // 用于记录点击时间戳实现三击

  const audioElsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const lastSyncTimeRef = useRef<number>(0);
  // 性能优化：将 playTime 同步到 ref，供音频同步 RAF 循环读取
  const playTimeRef = useRef(playTime);
  playTimeRef.current = playTime;

  // ─── 播放头位置分割片段 (ref-based, 零依赖) ──────────────────
  const splitAtPlayhead = useCallback(() => {
    const tl = timelineRef.current;
    const pt = playTimeRef.current;
    let accDur = 0;
    for (let i = 0; i < tl.length; i++) {
      const item = tl[i];
      if (pt >= accDur && pt < accDur + item.duration) {
        const splitPoint = pt - accDur;
        if (splitPoint < 0.2 || item.duration - splitPoint < 0.2) {
          setStatusMsg('⚠️ 分割点距边缘过近'); setTimeout(() => setStatusMsg(''), 1500);
          return;
        }
        pushSnapshot();
        const left = { ...item, duration: splitPoint, id: `tm_${Date.now()}_L` };
        const right = { ...item, duration: item.duration - splitPoint, id: `tm_${Date.now()}_R` };
        setTimeline(prev => [...prev.slice(0, i), left, right, ...prev.slice(i + 1)]);
        setStatusMsg('✂️ 已在播放头位置分割'); setTimeout(() => setStatusMsg(''), 1500);
        return;
      }
      accDur += item.duration;
    }
    setStatusMsg('⚠️ 播放头不在任何片段上'); setTimeout(() => setStatusMsg(''), 1500);
  }, [pushSnapshot]);

  // ─── 工程保存/加载 (ref-based) ─────────────────────────────────
  const saveProject = useCallback(async () => {
    const projectData = JSON.stringify({
      resources: resourcesRef.current,
      timeline: timelineRef.current,
      audioItems: audioItemsRef.current,
      pps: ppsRef.current
    }, null, 2);
    const outputPath = await save({ filters: [{ name: '工程文件', extensions: ['proj.json'] }] });
    if (!outputPath) return;
    try {
      await invoke('write_file', { path: outputPath, content: projectData });
      setStatusMsg('💾 工程已保存'); setTimeout(() => setStatusMsg(''), 2000);
    } catch {
      localStorage.setItem('__editor_project__', projectData);
      setStatusMsg('💾 工程已保存到本地缓存'); setTimeout(() => setStatusMsg(''), 2000);
    }
  }, []);

  const loadProject = useCallback(async () => {
    const selected = await open({ filters: [{ name: '工程文件', extensions: ['proj.json', 'json'] }] });
    if (!selected) return;
    try {
      const path = typeof selected === 'string' ? selected : (selected as any).path;
      const content = await invoke<string>('read_file', { path });
      const data = JSON.parse(content);
      if (data.resources) setResources(data.resources);
      if (data.timeline) setTimeline(data.timeline);
      if (data.audioItems) setAudioItems(data.audioItems);
      if (data.pps) setPps(data.pps);
      setStatusMsg('📂 工程已加载'); setTimeout(() => setStatusMsg(''), 2000);
    } catch {
      const cached = localStorage.getItem('__editor_project__');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.resources) setResources(data.resources);
        if (data.timeline) setTimeline(data.timeline);
        if (data.audioItems) setAudioItems(data.audioItems);
        if (data.pps) setPps(data.pps);
        setStatusMsg('📂 已从本地缓存恢复'); setTimeout(() => setStatusMsg(''), 2000);
      } else {
        setStatusMsg('❌ 加载失败'); setTimeout(() => setStatusMsg(''), 2000);
      }
    }
  }, []);

  // ─── 自动保存 (每60秒) ───────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (timelineRef.current.length > 0 || audioItemsRef.current.length > 0) {
        localStorage.setItem('__editor_autosave__', JSON.stringify({
          resources: resourcesRef.current,
          timeline: timelineRef.current,
          audioItems: audioItemsRef.current,
          pps: ppsRef.current
        }));
      }
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 启动时检查自动保存
  useEffect(() => {
    const saved = localStorage.getItem('__editor_autosave__');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.timeline?.length > 0 || data.audioItems?.length > 0) {
          setStatusMsg('💡 发现自动保存数据 (上次会话)');
        }
      } catch { /* ignore */ }
    }
  }, []);

  // ─── 全局快捷键系统 (ref-based, 零依赖 — 消除播放卡顿) ────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
        return;
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        if (selectedIdsRef.current.size > 0) {
          pushSnapshot();
          setTimeline(p => p.filter(t => !selectedIdsRef.current.has(t.id)));
          setSelectedIds(new Set());
        }
        if (selectedAudioIdsRef.current.size > 0) {
          pushSnapshot();
          setAudioItems(p => p.filter(a => !selectedAudioIdsRef.current.has(a.id)));
          setSelectedAudioIds(new Set());
        }
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        const delta = e.code === 'ArrowLeft' ? -step : step;
        setPlayTime(prev => Math.max(0, prev + delta));
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (e.code === 'KeyY') { e.preventDefault(); redo(); return; }
        if (e.code === 'KeyA') { e.preventDefault(); setSelectedIds(new Set(timelineRef.current.map(t => t.id))); return; }
        if (e.code === 'KeyS') { e.preventDefault(); saveProject(); return; }
        if (e.code === 'KeyO') { e.preventDefault(); loadProject(); return; }
        if (e.code === 'KeyB') { e.preventDefault(); splitAtPlayhead(); return; }
      }

      // Home/End 跳转时间轴开头/末尾 (任务12)
      if (e.code === 'Home') { e.preventDefault(); setPlayTime(0); return; }
      if (e.code === 'End') {
        e.preventDefault();
        const total = timelineRef.current.reduce((s, t) => s + t.duration, 0);
        setPlayTime(total); return;
      }

      // [ / ] 调整选中项时长 (任务12)
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          const delta = e.code === 'BracketLeft' ? -0.5 : 0.5;
          pushSnapshot();
          setTimeline(p => p.map(t => selectedIdsRef.current.has(t.id) ? { ...t, duration: Math.max(0.3, t.duration + delta) } : t));
          return;
        }
      }

      // ? = 快捷键提示面板
      if (e.key === '?' || e.code === 'Slash') {
        setShowShortcuts(prev => !prev);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pushSnapshot, undo, redo, splitAtPlayhead, saveProject, loadProject]);

  // ─── 拖拽导入文件 ──────────────────────────────────────────────
  useEffect(() => {
    let dragCounter = 0;
    const handleDragEnter = (e: DragEvent) => { e.preventDefault(); dragCounter++; setIsDragOver(true); };
    const handleDragLeave = (e: DragEvent) => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; setIsDragOver(false); } };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'dng'];
      const audioExts = ['mp3', 'wav', 'm4a'];
      const newResources: Resource[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let type: 'image' | 'audio' | null = null;
        if (imageExts.includes(ext)) type = 'image';
        else if (audioExts.includes(ext)) type = 'audio';
        if (type) {
          newResources.push({
            id: `res_drop_${Date.now()}_${i}`,
            name: file.name,
            path: (file as any).path || file.name, // Tauri 提供 path
            type,
          });
        }
      }

      if (newResources.length > 0) {
        setResources(prev => [...prev, ...newResources]);
        setStatusMsg(`📥 已导入 ${newResources.length} 个素材文件`);
        setTimeout(() => setStatusMsg(''), 2000);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // ─── 时间轴 Ctrl+滚轮 缩放 ──────────────────────────────────────
  const handleTimelineWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -4 : 4;
      setPps(prev => Math.max(8, Math.min(120, prev + delta)));
    }
  }, []);



  // 性能优化：资源 Map 索引 (O(1) 查找替代 O(n) 遍历)
  const resourceMap = useMemo(() => new Map(resources.map(r => [r.id, r])), [resources]);
    // 1. 核心：高性能播放引擎 (RequestAnimationFrame + DOM 脱芀)
  // 性能优化：移除 timeline/pps 依赖，改用 ref 读取——防止大量照片时每次 timeline 变化都重建 RAF 循环
  useEffect(() => {
    if (!isPlaying) return;

    let rafId: number;
    const startTs = performance.now();
    const baseTime = playTimeRef.current; // 直接从 ref 读初始时间，避免闭包捕获

    const tick = () => {
      const tl = timelineRef.current;   // 每帧从 ref 读取最新数据
      const currentPps = ppsRef.current;
      const elapsed = (performance.now() - startTs) / 1000 * playbackSpeed;
      const currentT = baseTime + elapsed;

      // 读取 maxPlayTime（不放入 deps，直接计算）
      const maxAudio = audioItemsRef.current.length > 0
        ? Math.max(...audioItemsRef.current.map(a => a.timelineStart + a.duration))
        : 0;
      const maxT = tl.reduce((s, t) => s + t.duration, 0);
      const maxPt = Math.max(maxT, maxAudio) + 0.01;

      if (currentT >= maxPt && maxPt > 0.02) {
        setPlayTime(maxPt);
        setIsPlaying(false);
        return;
      }

      // 直接操作 DOM，绕过 React 重绘
      if (playheadRef.current) {
        let accX = 0;
        let accDur = 0;
        let found = false;
        for (let i = 0; i < tl.length; i++) {
          const itemDur = tl[i].duration;
          if (currentT >= accDur && currentT < accDur + itemDur) {
            accX += (currentT - accDur) * currentPps;
            found = true;
            break;
          }
          accDur += itemDur;
          accX += (itemDur * currentPps) + 4;
        }
        if (!found) {
          const overflowDur = currentT - accDur;
          accX += (overflowDur * currentPps) - (tl.length > 0 ? 4 : 0);
        }
        playheadRef.current.style.transform = `translateX(${60 + accX}px)`;

        const scrollEl = timelineScrollRef.current;
        if (scrollEl) {
          const headX = 60 + accX;
          const viewLeft = scrollEl.scrollLeft;
          const viewRight = viewLeft + scrollEl.clientWidth;
          if (headX > viewRight - 100) {
            scrollEl.scrollLeft = headX - scrollEl.clientWidth / 2;
          } else if (headX < viewLeft + 60) {
            scrollEl.scrollLeft = Math.max(0, headX - 100);
          }
        }
      }

      if (timeTextRef.current) {
        timeTextRef.current.textContent = formatTime(currentT);
      }

      playTimeRef.current = currentT;

      if (performance.now() - lastSyncTimeRef.current > 1000) {
        setPlayTime(currentT);
        lastSyncTimeRef.current = performance.now();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      const finalElapsed = (performance.now() - startTs) / 1000;
      setPlayTime(baseTime + finalElapsed * playbackSpeed);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackSpeed]);

  // 性能优化：已添加资源 ID 集合 (替代 timeline.some() + audioItems.some())
  const addedResourceIds = useMemo(() => new Set([...timeline.map(t => t.resourceId), ...audioItems.map(a => a.resourceId)]), [timeline, audioItems]);

  // 1b. 自动资源预热引擎 (Blob 转换 — 兼容 Tauri WebView2 音频播放)
  useEffect(() => {
    resources.filter(r => r.type === 'audio').forEach(res => {
      if (audioBlobs[res.id]) return;
      let fetchUrl: string;
      if (res.path.startsWith('http') || res.path.startsWith('blob:')) {
        fetchUrl = res.path;
      } else if (res.path.startsWith('/')) {
        fetchUrl = res.path;
      } else {
        fetchUrl = convertFileSrc(res.path);
      }
      fetch(fetchUrl)
        .then(r => r.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setAudioBlobs(prev => ({ ...prev, [res.id]: url }));
        })
        .catch(e => console.warn(`[Audio Blob] 预热失败: ${res.name}`, fetchUrl, e));
    });
  }, [resources, audioBlobs]);

  // DNG 预览缓存
  useEffect(() => {
    resources.filter(r => r.type === 'image' && r.path.toLowerCase().endsWith('.dng')).forEach(res => {
      if (previewCache[res.path]) return;
      invoke('get_preview_url', { path: res.path })
        .then((url: any) => {
          setPreviewCache(prev => ({ ...prev, [res.path]: url }));
        })
        .catch(e => console.error(`Failed to fetch DNG preview for ${res.name}`, e));
    });
  }, [resources, previewCache]);

  const getEffectiveSrc = (path: string) => {
    if (path.toLowerCase().endsWith('.dng')) {
      const p = previewCache[path];
      return p ? (p.startsWith('http') || p.startsWith('blob:') ? p : convertFileSrc(p)) : '';
    }
    return convertFileSrc(path);
  };

  // 计算整个工程的物理最远时间点
  const maxPlayTime = useMemo(() => {
    const maxT = timeline.length > 0 ? timeline.reduce((acc, t) => acc + t.duration, 0) : 0;
    const maxA = audioItems.length > 0 ? Math.max(...audioItems.map(a => a.timelineStart + a.duration)) : 0;
    return Math.max(maxT, maxA) + 0.01;
  }, [timeline, audioItems]);

  // 精确计算 playLine 的左边距，修复 `gap: 4px` 造成的误差
  const playLineLeft = useMemo(() => {
    let accDur = 0;
    let accX = 0;

    for (let i = 0; i < timeline.length; i++) {
      const itemDur = timeline[i].duration;
      if (playTime >= accDur && playTime < accDur + itemDur) {
        const localOffset = (playTime - accDur) * pps;
        return 60 + accX + localOffset;
      }
      accDur += itemDur;
      accX += (itemDur * pps) + 4; // 计入 gap 距离
    }

    // 如果超出了所有图片的边界（比如正在纯放音频）
    if (playTime >= accDur) {
      const overflowDur = playTime - accDur;
      return 60 + accX + (overflowDur * pps) - (timeline.length > 0 ? 4 : 0);
    }
    return 60;
  }, [playTime, timeline, pps]);

  // 三连击检测算法
  const handleTripleClickZone = () => {
    const now = Date.now();
    clickTimesRef.current.push(now);

    // 只保留最近 3 次点击
    if (clickTimesRef.current.length > 3) {
      clickTimesRef.current.shift();
    }

    // 检查是否凑齐了三次，且头尾点击间隔在 500ms 内
    if (clickTimesRef.current.length === 3) {
      const duration = clickTimesRef.current[2] - clickTimesRef.current[0];
      if (duration < 500) {
        setPlayTime(0);
        setIsPlaying(false);
        setStatusMsg(' ⚡ 三击重置，指针归零');
        setTimeout(() => setStatusMsg(''), 1500);
        clickTimesRef.current = []; // 触发后清空池子
      }
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  // 辅助函数：格式化时间为 00:00.00
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };



  // playTimeRef 已在上方声明并持续同步

  // 性能优化：音频同步使用独立 RAF 循环，避免依赖高频 playTime state 更新
  useEffect(() => {
    if (!isPlaying) {
      Object.values(audioElsRef.current).forEach(a => {
        try { a.pause(); } catch (e) { }
      });
      return;
    }

    let audioRafId: number;
    const syncAudio = () => {
      const currentPlayTime = playTimeRef.current;

      audioItems.forEach(item => {
        const res = resourceMap.get(item.resourceId);
        if (!res) return;

        // 优先用 blob 缓存，其次判断路径类型
        const playPath = audioBlobs[res.id]
          || (res.path.startsWith('http') || res.path.startsWith('/') || res.path.startsWith('blob:')
            ? res.path
            : convertFileSrc(res.path));

        let audio = audioElsRef.current[item.id];
        if (!audio || (audio.src !== playPath && !audio.src.startsWith('blob:'))) {
          if (audio) { audio.pause(); audio.src = ""; }
          audio = new Audio();
          // 仅对外部 URL 设置 crossOrigin，Tauri asset 协议不需要
          if (playPath.startsWith('http') && !playPath.includes('asset.localhost')) {
            audio.crossOrigin = 'anonymous';
          }
          audio.preload = 'auto';
          audio.src = playPath;
          audio.onerror = (e) => console.warn('[Audio Error]', item.id, playPath, e);
          audioElsRef.current[item.id] = audio;
        }

        const itemEnd = item.timelineStart + item.duration;
        const targetPos = item.startOffset + (currentPlayTime - item.timelineStart);

        if (currentPlayTime >= item.timelineStart && currentPlayTime < itemEnd) {
          // 计算淡入淡出音量 (任务7)
          const baseVol = item.volume ?? 1.0;
          const elapsed = currentPlayTime - item.timelineStart;
          const remaining = itemEnd - currentPlayTime;
          const fi = item.fadeIn || 0;
          const fo = item.fadeOut || 0;
          let fadeMul = 1.0;
          if (fi > 0 && elapsed < fi) fadeMul = Math.min(fadeMul, elapsed / fi);
          if (fo > 0 && remaining < fo) fadeMul = Math.min(fadeMul, remaining / fo);
          const effectiveVol = Math.max(0, Math.min(1, baseVol * fadeMul));

          if (audio.paused) {
            audio.currentTime = targetPos;
            audio.volume = effectiveVol;
            const p = audio.play();
            if (p) p.catch(() => { });
          } else {
            // 放宽容差到 0.5s，避免频繁 seek 导致反复卡顿
            if (Math.abs(audio.currentTime - targetPos) > 0.5) {
              audio.currentTime = targetPos;
            }
            audio.volume = effectiveVol;
          }
        } else {
          if (!audio.paused) audio.pause();
        }
      });

      audioRafId = requestAnimationFrame(syncAudio);
    };

    audioRafId = requestAnimationFrame(syncAudio);
    return () => cancelAnimationFrame(audioRafId);
  }, [isPlaying, audioItems, resourceMap, audioBlobs]);

  const togglePlay = () => {
    const nextState = !isPlaying;
    if (nextState) {
      // 关键：在用户点击的瞬间尝试启动所有现有音频以通过浏览器审核
      Object.values(audioElsRef.current).forEach(a => {
        const p = a.play();
        if (p) p.then(() => a.pause()).catch(() => { });
      });
      setStatusMsg("");
    }
    setIsPlaying(nextState);
  };

  const updateSelectedProperty = (key: keyof TimelineItem, val: any) => {
    if (selectedIds.size === 0) return;
    setTimeline(prev => prev.map(t => {
      if (!selectedIds.has(t.id)) return t;
      // 自动将修改的字段加入 overrides（全局覆盖模型）
      const globalKeys: string[] = Object.keys(GLOBAL_DEFAULTS_INIT);
      if (globalKeys.includes(key as string)) {
        const newOverrides = Array.from(new Set([...(t.overrides || []), key as string]));
        return { ...t, [key]: val, overrides: newOverrides };
      }
      return { ...t, [key]: val };
    }));
  };

  // Slider 撤销保护：拖动前压栈，拖动结束后自动保存
  const sliderUndoFlag = useRef(false);
  const updatePropertyWithUndo = (key: keyof TimelineItem, val: any) => {
    if (!sliderUndoFlag.current) { pushSnapshot(); sliderUndoFlag.current = true; }
    updateSelectedProperty(key, val);
  };
  const finalizeSliderUndo = () => { sliderUndoFlag.current = false; };

  const updateAudioItem = (id: string, patch: Partial<AudioTimelineItem>, isDragging: boolean = false) => {
    setAudioItems(prev => {
      return prev.map(a => {
        if (a.id === id) {
          let newPatch = { ...patch };

          // ─── 吸附碰撞算法 (Magnetic Snapping) ───
          if (isDragging && newPatch.timelineStart !== undefined) {
            const snapThreshold = 0.4; // 吸附触发距离 (0.4秒)
            const myDur = a.duration;
            let candidateT = newPatch.timelineStart;
            let bestDiff = snapThreshold;

            for (const other of prev) {
              if (other.id === id) continue;
              const otherStart = other.timelineStart;
              const otherEnd = other.timelineStart + other.duration;

              // 我的开始碰别人结束
              if (Math.abs(candidateT - otherEnd) < bestDiff) { candidateT = otherEnd; bestDiff = Math.abs(newPatch.timelineStart - otherEnd); }
              // 我的结束碰别人开始
              if (Math.abs(candidateT + myDur - otherStart) < bestDiff) { candidateT = otherStart - myDur; bestDiff = Math.abs(newPatch.timelineStart + myDur - otherStart); }

              // 并行对齐 (头对头，尾对尾)
              if (Math.abs(candidateT - otherStart) < bestDiff) { candidateT = otherStart; bestDiff = Math.abs(newPatch.timelineStart - otherStart); }
              if (Math.abs(candidateT + myDur - otherEnd) < bestDiff) { candidateT = otherEnd - myDur; bestDiff = Math.abs(newPatch.timelineStart + myDur - otherEnd); }
            }

            if (Math.abs(candidateT - 0) < bestDiff) { candidateT = 0; }

            newPatch.timelineStart = Math.max(0, candidateT);
          }
          return { ...a, ...newPatch };
        }
        return a;
      });
    });
  };

  // 合并选区缝合间隙
  const stitchSelectedAudioGaps = () => {
    if (selectedAudioIds.size < 2) {
      setStatusMsg("聚合失败：请按住 Ctrl 选定至少 2 段音频残片");
      setTimeout(() => setStatusMsg(""), 3000);
      return;
    }
    setAudioItems(prev => {
      // 1. 过滤并按照时间轴顺序排序所有选中的碎片
      const sortedSelected = prev.filter(a => selectedAudioIds.has(a.id)).sort((a, b) => a.timelineStart - b.timelineStart);

      // 2. 以最开头的那个碎片为锚点
      let anchorTime = sortedSelected[0].timelineStart;

      // 3. 构建新的位移映射表
      const shifts = new Map<string, number>();
      for (const piece of sortedSelected) {
        shifts.set(piece.id, anchorTime);
        anchorTime += piece.duration; // 紧随其后排队
      }

      // 4. 应用修改
      return prev.map(item => {
        if (shifts.has(item.id)) {
          return { ...item, timelineStart: shifts.get(item.id)! };
        }
        return item;
      });
    });
    setStatusMsg("🧲 已成功跨越时空缝合选中的残片！");
    setTimeout(() => setStatusMsg(""), 3000);
  };

  const applyAllToTimeline = () => {
    if (!selectedItem) return;
    setTimeline(prev => prev.map(t => ({
      ...t,
      duration: selectedItem.duration,
      transition: selectedItem.transition,
      contrast: selectedItem.contrast,
      saturation: selectedItem.saturation,
      exposure: selectedItem.exposure,
      brilliance: selectedItem.brilliance,
      temp: selectedItem.temp,
      tint: selectedItem.tint,
      zoom: selectedItem.zoom,
      rotation: selectedItem.rotation,
      overlayText: selectedItem.overlayText,
      fontSize: selectedItem.fontSize,
      fontWeight: selectedItem.fontWeight,
      cropPos: selectedItem.cropPos,
    })));
    setStatusMsg('效果已成功应用到所有图片');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  // ─── 音频剪辑核心算法 ───
  // 逻辑：将一个音轨项根据保留区域切分为多个独立音轨项，并自动计算起始位置留存空隙
  const executeAudioCut = (itemId: string) => {
    const item = audioItems.find(a => a.id === itemId);
    if (!item) return;
    const cuts = (item.cutPoints || []).slice().sort((a, b) => a - b);
    const selected = new Set(item.selectedRegions || []);
    const boundaries = [0, ...cuts, item.duration];

    const newFragments: AudioTimelineItem[] = [];
    let currentTimelinePos = item.timelineStart;

    for (let i = 0; i < boundaries.length - 1; i++) {
      const startClip = boundaries[i];
      const endClip = boundaries[i + 1];
      const dur = endClip - startClip;

      if (!selected.has(i)) {
        if (dur > 0.01) {
          newFragments.push({
            ...item,
            id: `aud_${Date.now()}_${i}`,
            timelineStart: currentTimelinePos,
            startOffset: item.startOffset + startClip,
            duration: dur,
            cutPoints: [],
            selectedRegions: []
          });
        }
      }
      // 取消波纹删除：无论分段是否被保留，始终将其持续时间计入偏移累加中，制造真实的“缝隙”
      currentTimelinePos += dur;
    }

    if (newFragments.length === 0) {
      setAudioItems(prev => prev.filter(a => a.id !== itemId));
      setSelectedAudioIds(new Set());
    } else {
      setAudioItems(prev => {
        const idx = prev.findIndex(a => a.id === itemId);
        const next = [...prev];
        next.splice(idx, 1, ...newFragments);
        return next;
      });
      // 将剪除后存活下来的片段维持为选中状态，以免右侧面板丢失上下文
      setSelectedAudioIds(new Set(newFragments.map(f => f.id)));
    }

    setIsEditingAudio(false);
    setStatusMsg("✂️ 残片已切除。此时已留出空隙，如需拼合缝合可点击上方 '缝合选区'");
    setTimeout(() => setStatusMsg(""), 4000);
  };

  // 播放指针 — 单局拖拽定位工具函数 (ref-based 避免重建)
  const seekToX = useCallback((clientX: number) => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rawX = clientX - rect.left + el.scrollLeft - 60;
    const tl = timelineRef.current;
    const currentPps = ppsRef.current;

    let accX = 0;
    let targetTime = 0;
    for (let i = 0; i < tl.length; i++) {
      const itemW = tl[i].duration * currentPps;
      const nextX = accX + itemW + (i < tl.length - 1 ? 4 : 0);
      if (rawX <= nextX) {
        const localX = Math.max(0, rawX - accX);
        targetTime += Math.min(localX / currentPps, tl[i].duration);
        break;
      } else {
        accX = nextX;
        targetTime += tl[i].duration;
      }
    }
    if (tl.length === 0 || rawX > accX) {
      const overflowX = Math.max(0, rawX - accX);
      targetTime += (overflowX / currentPps);
    }
    // 限制不超过最大播放时长
    const maxT = tl.reduce((s, t) => s + t.duration, 0);
    setPlayTime(Math.max(0, Math.min(targetTime, maxT + 5)));
  }, []);

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (isDraggingHead) {
      seekToX(e.clientX);
    } else if (selectionBox) {
      const rect = timelineScrollRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX = e.clientX - rect.left + timelineScrollRef.current!.scrollLeft;
        setSelectionBox(prev => prev ? { ...prev, x2: currentX } : null);
      }
    }
  };

  const handleTimelineMouseUp = (e: React.MouseEvent) => {
    if (isDraggingHead) setIsDraggingHead(false);
    if (selectionBox) {
      const xStart = Math.min(selectionBox.x1, selectionBox.x2) - 60; // 减侧边栏
      const xEnd = Math.max(selectionBox.x1, selectionBox.x2) - 60;

      const newlySelected = new Set(e.ctrlKey ? selectedIds : []);
      let currentAcc = 0;
      timeline.forEach(item => {
        const itemStart = currentAcc * pps;
        const itemEnd = (currentAcc + item.duration) * pps;
        // 简单的横向相交检测
        if (!(itemEnd < xStart || itemStart > xEnd)) {
          newlySelected.add(item.id);
        }
        currentAcc += item.duration;
      });
      setSelectedIds(newlySelected);
      setSelectionBox(null);
    }
  };

  const handleImport = async (type: 'image' | 'audio' | 'video') => {
    const selected = await open({
      multiple: true,
      filters: [{
        name: type === 'image' ? '图片' : type === 'video' ? '视频' : '音频',
        extensions: type === 'image' ? ['png', 'jpg', 'jpeg', 'webp', 'dng', 'DNG'] : type === 'video' ? ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'] : ['mp3', 'wav', 'm4a']
      }]
    });
    if (selected && Array.isArray(selected)) {
      const newResources: Resource[] = (selected as any[]).map(rawSelected => {
        const path = typeof rawSelected === 'string' ? rawSelected : rawSelected.path;
        const id = `res_${Date.now()}_${Math.random()}`;
        
        if (type === 'image') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = async () => {
            try {
              const bitmap = await createImageBitmap(img);
              faceWorkerRef.current?.postMessage({
                id,
                imageBitmap: bitmap,
                width: img.naturalWidth,
                height: img.naturalHeight
              }, [bitmap]);
            } catch (err) { console.error('Face detection task dispatch failed', err); }
          };
          img.src = convertFileSrc(path);
        }

        return { id, name: path.split(/[\\/]/).pop() || '', path, type };
      });
      setResources(prev => [...prev, ...newResources]);
      setLibTab(type === 'image' ? 'image' : type === 'video' ? 'video' : 'audio');
      setStatusMsg(`🎉 素材处理完成 (${newResources.length}项)`);
      setTimeout(() => setStatusMsg(''), 2000);
    }
  };

  const handleRevealInExplorer = async (resourceId: string) => {
    const res = resourceMap.get(resourceId);
    if (!res) return;
    try {
      // 如果已经有缓存预览，打开预览所在的文件夹
      const targetPath = previewCache[res.path] || res.path;
      await invoke('reveal_in_explorer', { path: targetPath });
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertDNG = async (resourceId: string) => {
    const res = resourceMap.get(resourceId);
    if (!res) return;

    try {
      setStatusMsg(`正在转换 DNG: ${res.name}...`);
      const normalizedPath = await invoke<string>('normalize_image', { path: res.path });

      // Always update preview cache with the result of normalize_image
      setPreviewCache(prev => ({ ...prev, [res.path]: normalizedPath }));
      setStatusMsg("✨ DNG 转换成功 (已开启 AWB 算法)");

      // If the normalizedPath is different, it means the resource itself was converted/replaced
      if (normalizedPath && normalizedPath !== res.path) {
        setResources(prev => prev.map(r => r.id === resourceId ? { ...r, path: normalizedPath } : r));
        setStatusMsg(`🎉 ${res.name} 已更新为转换后的文件`);
      }
    } catch (e: any) {
      console.error('DNG conversion failed:', e);
      setStatusMsg(`❌ 转换失败: ${String(e).slice(0, 50)}`);
    } finally {
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const removeFromLibrary = useCallback((id: string | Set<string>) => {
    const ids = typeof id === 'string' ? new Set([id]) : id;
    
    // Memory Leak Fix: Cleanup Blobs
    const toRemove = resourcesRef.current.filter(r => ids.has(r.id));
    toRemove.forEach(r => {
      let src = previewCache[r.path] || r.path;
      if (src && !src.startsWith('http') && !src.startsWith('blob:') && !src.startsWith('/')) src = convertFileSrc(src);
      if (thumbCache.has(src)) {
        const cachedUrl = thumbCache.get(src);
        if (cachedUrl && cachedUrl.startsWith('blob:')) URL.revokeObjectURL(cachedUrl);
        thumbCache.delete(src);
      }
      if (r.type === 'audio') {
         setAudioBlobs(prev => {
            const next = {...prev};
            const blobUrl = next[r.id];
            if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
            delete next[r.id];
            return next;
         });
      }
    });

    setResources(prev => prev.filter(r => !ids.has(r.id)));
    setTimeline(prev => prev.filter(t => !ids.has(t.resourceId)));
    setAudioItems(prev => prev.filter(a => !ids.has(a.resourceId)));
    setSelectedResourceIds(new Set());
  }, [previewCache]);

  // --- Memoization Fixes ---
  const handleLibToggle = useCallback((id: string) => {
    setSelectedResourceIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const handleLibSelectPreview = useCallback((r: Resource) => setMonitorRes(r), []);

  const handleLibAdd = useCallback(async (r: Resource) => {
    if (r.type === 'image') {
      const gd = globalDefaultsRef.current;
      const isRandom = gd.animation === 'random';
      const anim = isRandom ? ANIMATION_PRESETS[Math.floor(Math.random() * ANIMATION_PRESETS.length)] : gd.animation;
      const overrides = isRandom ? ['animation'] : [];
      setTimeline(p => [...p, {
        id: `tm_${Date.now()}_${Math.random()}`, resourceId: r.id, 
        duration: gd.duration, transition: gd.transition, 
        rotation: gd.rotation, contrast: gd.contrast, saturation: gd.saturation, 
        exposure: gd.exposure, brilliance: gd.brilliance, temp: gd.temp, tint: gd.tint, zoom: gd.zoom,
        animation: anim, overrides, fontSize: 24, fontWeight: 'normal'
      }]);
    } else {
      const dur = await getMediaDuration(r.path);
      setAudioItems(prev => {
        let startPos = 0;
        if (prev.length > 0) { const last = prev[prev.length - 1]; startPos = last.timelineStart + last.duration; }
        return [...prev, { id: `au_${Date.now()}`, resourceId: r.id, timelineStart: startPos, startOffset: 0, duration: dur, volume: 1.0 }];
      });
    }
  }, []);

  const handleTimelineSelect = useCallback((id: string, isCtrl: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isCtrl) { if (next.has(id)) next.delete(id); else next.add(id); }
      else { next.clear(); next.add(id); }
      return next;
    });
    setSelectedAudioIds(new Set());
  }, []);

  const handleTimelineRemove = useCallback((id: string) => {
    pushSnapshot();
    setTimeline(p => p.filter(t => t.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, [pushSnapshot]);

  const handleTimelineTrim = useCallback((id: string, delta: number) => {
    pushSnapshot();
    setTimeline(p => p.map(t => t.id === id ? { ...t, duration: Math.max(0.3, t.duration + delta) } : t));
  }, [pushSnapshot]);

  const handleTimelineContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'image', targetId: id });
  }, []);

  const handleAudioSelect = useCallback((id: string, isCtrl: boolean) => {
    setSelectedAudioIds(prev => {
      const next = new Set(prev);
      if (isCtrl) { if (next.has(id)) next.delete(id); else next.add(id); }
      else { next.clear(); next.add(id); }
      return next;
    });
    setSelectedIds(new Set());
  }, []);

  const handleTimelineDoubleClick = useCallback((id: string) => {
    const tl = timelineRef.current;
    let startTime = 0;
    for (const t of tl) { if (t.id === id) break; startTime += t.duration; }
    setPlayTime(startTime);
    setIsPlaying(true);
    const scrollEl = timelineScrollRef.current;
    if (scrollEl) {
      let accX = 0;
      for (let i = 0; i < tl.length; i++) {
        if (tl[i].id === id) break;
        accX += tl[i].duration * ppsRef.current + 4;
      }
      scrollEl.scrollLeft = Math.max(0, accX - scrollEl.clientWidth / 3);
    }
  }, []);

  const selectedItem = useMemo(() => timeline.find(t => selectedIds.has(t.id)), [timeline, selectedIds]);

  const monitorSrc = useMemo(() => {
    if ((isPlaying || playTime > 0) && timeline.length > 0) {
      let acc = 0;
      for (const t of timeline) {
        if (playTime >= acc && playTime < acc + t.duration) {
          const res = resourceMap.get(t.resourceId);
          if (res) {
            return { ...res, currentItem: t, src: getEffectiveSrc(res.path), localTime: playTime - acc };
          }
          // 纯文字项（无 resourceId）
          if (!t.resourceId && t.overlayText) {
            return { id: t.id, name: t.overlayText, type: 'text' as const, path: '', currentItem: t, src: '', localTime: 0 };
          }
          return null;
        }
        acc += t.duration;
      }
    }
    return monitorRes ? { ...monitorRes, currentItem: null, src: getEffectiveSrc(monitorRes.path), localTime: 0 } : null;
  }, [isPlaying, playTime, timeline, resources, monitorRes, previewCache]);

  // 同步视频播放与时间线
  useEffect(() => {
    const videoEl = monitorVideoRef.current;
    if (!videoEl || !monitorSrc || monitorSrc.type !== 'video') return;
    const localTime = monitorSrc.localTime || 0;
    // 同步 currentTime（仅在差异超过 0.3s 时 seek，避免频繁跳帧）
    if (Math.abs(videoEl.currentTime - localTime) > 0.3) {
      videoEl.currentTime = localTime;
    }
    if (isPlaying) {
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
    }
  }, [isPlaying, monitorSrc]);

  const handleGenerate = async () => {
    const outputPath = await save({ filters: [{ name: '视频文件', extensions: [exportFormat] }] });
    if (!outputPath) return;
    setIsGenerating(true); setStatusMsg('正在极速渲染中...');

    let computedResolution = '1920:1080';
    if (exportResolution === '4k') computedResolution = '3840:2160';

    if (exportResolution === 'original') {
      setStatusMsg('正在探测全轨原图极致边界...');
      let maxW = 1920;
      let maxH = 1080;
      for (const t of timeline) {
        const res = resourceMap.get(t.resourceId);
        if (res && res.type === 'image') {
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = () => {
              maxW = Math.max(maxW, img.naturalWidth);
              maxH = Math.max(maxH, img.naturalHeight);
              resolve(null);
            };
            img.onerror = resolve;
            img.src = res.path.startsWith('http') ? res.path : convertFileSrc(res.path);
          });
        }
      }
      maxW = maxW + (maxW % 2); // FFmpeg H264 要求宽高为偶数
      maxH = maxH + (maxH % 2);
      computedResolution = `${maxW}:${maxH}`;
    }

    try {
      await invoke('generate_video', {
        payload: {
          items: timeline.map(t => ({ ...t, path: resourceMap.get(t.resourceId)?.path })),
          resourcePaths: resources.map(r => ({ id: r.id, path: r.path })),
          audioClips: audioItems.map(a => ({ ...a, path: resourceMap.get(a.resourceId)?.path })),
          outputPath,
          resolution: computedResolution,
          fps: parseInt(exportFps, 10),
          quality: exportQuality,
          codec: exportCodec,
          hdr: exportHdr,
          autoOpen: true
        }
      });
      setStatusMsg('导出成功！');
    } catch (e) { setStatusMsg(`导出失败: ${e}`); }
    finally { setIsGenerating(false); }
  };

  const filteredResources = useMemo(() => {
    const byType = resources.filter(r => r.type === libTab);
    if (!searchQuery.trim()) return byType;
    const q = searchQuery.toLowerCase();
    return byType.filter(r => r.name.toLowerCase().includes(q));
  }, [resources, libTab, searchQuery]);

  const libItemHeight = libTab === 'image' ? 62 : 52;
  const libStartIndex = Math.max(0, Math.floor(libScrollTop / libItemHeight) - 3);
  const libEndIndex = Math.min(filteredResources.length - 1, Math.floor((libScrollTop + 800) / libItemHeight) + 8);
  const visibleResources = filteredResources.slice(libStartIndex, libEndIndex + 1);

  // 性能优化：memo 化计算，避免每次渲染重算
  const maxVideoEnd = useMemo(() => timeline.reduce((acc, t) => acc + t.duration, 0), [timeline]);
  const maxAudioEnd = useMemo(() => audioItems.length > 0 ? Math.max(...audioItems.map(a => a.timelineStart + a.duration)) : 0, [audioItems]);
  const maxTime = useMemo(() => Math.max(maxVideoEnd, maxAudioEnd, playTime), [maxVideoEnd, maxAudioEnd, playTime]);
  const timelineWidth = useMemo(() => Math.max(8000, maxTime * pps + 1000), [maxTime, pps]);

  return (
    <FluentProvider theme={webDarkTheme} style={{ height: '100vh', width: '100vw', background: 'transparent' }}>
      <div className={`ios-layout ${theme === 'win11' ? 'theme-win11' : ''}`} onClick={() => { setContextMenu(null); setShowShortcuts(false); setShowSortMenu(false); setShowMoreMenu(false); }}>


        {/* 全局浮窗 Toast 通知 */}
        {statusMsg && (
          <div className="global-toast">
            {statusMsg}
          </div>
        )}

        {/* 快捷键提示面板 */}
        {showShortcuts && (
          <div className="shortcuts-panel" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⌨️ 快捷键速查</div>
            {[
              ['Space', '播放/暂停'], ['Delete', '删除选中'], ['← →', '微调 ±0.1s'],
              ['Shift+←→', '微调 ±1s'], ['Ctrl+Z', '撤销'], ['Ctrl+Y', '重做'],
              ['Ctrl+A', '全选'], ['Ctrl+S', '保存工程'], ['Ctrl+O', '加载工程'],
              ['Ctrl+B', '分割片段'], ['Ctrl+滚轮', '时间轴缩放'], ['?', '显示/隐藏此面板'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{key}</span>
                <span style={{ opacity: 0.7 }}>{desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* 拖拽导入遮罩 */}
        {isDragOver && (
          <div className="drop-overlay">
            <div className="drop-overlay-icon">📥</div>
            <div className="drop-overlay-text">释放以导入素材</div>
            <div className="drop-overlay-subtext">支持 PNG / JPG / WEBP / DNG / MP3 / WAV / M4A</div>
          </div>
        )}

        {/* 右键上下文菜单 */}
        {contextMenu && (
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
            {contextMenu.type === 'image' ? (
              <>
                <div className="context-menu-item" onClick={() => { pushSnapshot(); setTimeline(p => [...p, ...p.filter(t => t.id === contextMenu.targetId).map(t => ({ ...t, id: `tm_${Date.now()}_cp` }))]); setContextMenu(null); }}>📋 复制片段</div>
                <div className="context-menu-item" onClick={() => { setContextMenu(null); splitAtPlayhead(); }}>✂️ 在播放头分割 (Ctrl+B)</div>
                <div className="context-menu-separator" />
                <div className="context-menu-item danger" onClick={() => { pushSnapshot(); setTimeline(p => p.filter(t => t.id !== contextMenu.targetId)); setSelectedIds(new Set()); setContextMenu(null); }}>🗑 删除</div>
              </>
            ) : (
              <>
                <div className="context-menu-item" onClick={() => { setContextMenu(null); splitAtPlayhead(); }}>✂️ 在播放头分割</div>
                <div className="context-menu-separator" />
                <div className="context-menu-item danger" onClick={() => { pushSnapshot(); setAudioItems(p => p.filter(a => a.id !== contextMenu.targetId)); setSelectedAudioIds(new Set()); setContextMenu(null); }}>🗑 删除</div>
              </>
            )}
          </div>
        )}


        {/* ═══ 顶部项目操作栏 (任务1: 项目级主流程) ═══ */}
        <div className="project-toolbar" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--ios-hairline)',
          flexShrink: 0, minHeight: 40,
        }}>

          {/* 左侧：主流程按钮组 */}
          <Button size="small" appearance="primary" style={{ borderRadius: 6, background: 'var(--ios-indigo)', fontWeight: 600, fontSize: 12, padding: '0 14px', height: 30, border: 'none' }} onClick={() => handleImport(leftTab === 'music' ? 'audio' : leftTab === 'video' ? 'video' : 'image')}>
            📥 导入
          </Button>
          {/* 排序下拉菜单 (任务5) */}
          <div style={{ position: 'relative' }}>
            <Button size="small" appearance="subtle" style={{ borderRadius: 6, fontSize: 12, padding: '0 10px', height: 30, color: 'rgba(255,255,255,0.7)' }} onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}>
              {sortMode === 'manual' ? '📂 排序' : `📂 ${sortMode === 'time' ? '时间序' : '名称序'}${sortDirection === 'desc' ? '↓' : '↑'}`}
            </Button>
            {showSortMenu && (
              <div className="sort-dropdown" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'rgba(30,30,46,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6, zIndex: 999, minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                {[
                  { mode: 'manual' as const, label: '✋ 手动排序', dir: 'asc' as const },
                  { mode: 'name' as const, label: '🔤 按名称 A→Z', dir: 'asc' as const },
                  { mode: 'name' as const, label: '🔤 按名称 Z→A', dir: 'desc' as const },
                  { mode: 'time' as const, label: '🕐 按文件名数字 ↑', dir: 'asc' as const },
                  { mode: 'time' as const, label: '🕐 按文件名数字 ↓', dir: 'desc' as const },
                ].map((opt, idx) => (
                  <div key={idx} style={{ padding: '6px 12px', fontSize: 12, color: (sortMode === opt.mode && sortDirection === opt.dir) ? '#fff' : 'rgba(255,255,255,0.65)', background: (sortMode === opt.mode && sortDirection === opt.dir) ? 'rgba(94,92,230,0.3)' : 'transparent', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = (sortMode === opt.mode && sortDirection === opt.dir) ? 'rgba(94,92,230,0.3)' : 'transparent'; }}
                    onClick={() => {
                      if (opt.mode === 'manual') {
                        setSortMode('manual');
                        setStatusMsg('✋ 已切换为手动排序'); setTimeout(() => setStatusMsg(''), 1500);
                      } else {
                        if (sortMode === 'manual' && timeline.length > 0) {
                          // 排序前提示
                          setStatusMsg('⚠️ 排序将覆盖当前手动顺序（可 Ctrl+Z 撤销）');
                          setTimeout(() => setStatusMsg(''), 2500);
                        }
                        pushSnapshot();
                        setSortMode(opt.mode);
                        setSortDirection(opt.dir);
                        const sorted = [...timeline].sort((a, b) => {
                          const ra = resources.find(r => r.id === a.resourceId);
                          const rb = resources.find(r => r.id === b.resourceId);
                          const nameA = ra?.name || '';
                          const nameB = rb?.name || '';
                          if (opt.mode === 'name') {
                            return opt.dir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
                          } else {
                            // 按文件名中的数字比较
                            const numA = parseInt((nameA.match(/\d+/) || ['0'])[0], 10);
                            const numB = parseInt((nameB.match(/\d+/) || ['0'])[0], 10);
                            return opt.dir === 'asc' ? numA - numB : numB - numA;
                          }
                        });
                        setTimeline(sorted);
                        setStatusMsg(`📂 已按${opt.mode === 'name' ? '名称' : '数字'}${opt.dir === 'asc' ? '升序' : '降序'}排列`);
                        setTimeout(() => setStatusMsg(''), 1500);
                      }
                      setShowSortMenu(false);
                    }}>
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 中间：项目名称居中 */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {isEditingProjectName ? (
              <input
                autoFocus
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onBlur={() => setIsEditingProjectName(false)}
                onKeyDown={e => { if (e.key === 'Enter') setIsEditingProjectName(false); }}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--ios-indigo)', borderRadius: 4, color: '#fff', fontSize: 13, fontWeight: 600, padding: '2px 8px', width: 160, outline: 'none', textAlign: 'center' }}
              />
            ) : (
              <span
                onClick={() => setIsEditingProjectName(true)}
                style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: '2px 8px', borderRadius: 4, transition: 'background 0.15s' }}
                title="点击编辑项目名称"
              >{projectName}</span>
            )}
          </div>

          {/* 右侧：··· 更多菜单 + 🚀导出 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMoreMenu(v => !v); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 1, padding: '0 10px', height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
              title="更多选项"
            >···</button>
            {showMoreMenu && (
              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'rgba(28,28,42,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6, zIndex: 1000, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                {[
                  { icon: '💾', label: '保存工程  Ctrl+S', action: () => { saveProject(); setShowMoreMenu(false); } },
                  { icon: '📂', label: '加载工程  Ctrl+O', action: () => { loadProject(); setShowMoreMenu(false); } },
                ].map(item => (
                  <div key={item.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    onClick={item.action}
                  ><span>{item.icon}</span><span>{item.label}</span></div>
                ))}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 6px' }} />
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  onClick={() => { const next = theme === 'ios' ? 'win11' : 'ios'; setTheme(next); localStorage.setItem('__editor_theme__', next); setShowMoreMenu(false); }}
                >
                  <span>{theme === 'ios' ? '🍃' : '🪩'}</span>
                  <span>切换主题（{theme === 'ios' ? 'iOS' : 'Win11'}）</span>
                </div>
                {timeline.length > 0 && (
                  <>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 6px' }} />
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      onClick={() => { setShowGlobalDefaults(true); setShowExportPanel(false); setShowMoreMenu(false); }}
                    >
                      <span>⚙️</span><span>全局默认设置</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Button size="small" appearance="primary" style={{ borderRadius: 6, background: '#10B981', fontWeight: 600, fontSize: 12, padding: '0 16px', height: 30, border: 'none' }} onClick={() => { setShowExportPanel(!showExportPanel); setShowGlobalDefaults(false); }}>
            🚀 导出
          </Button>
        </div>

        {/* ═══ 主内容区 ═══ */}
        <div style={{ flex: 1, display: 'flex', gap: 8, minHeight: 0 }}>

          {/* 1. 左侧资源区 (任务2: 照片/音乐/文字 三标签) */}
          <div className="glass-panel" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            {/* 三标签头部 */}
            <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--ios-hairline)' }}>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', borderRadius: 7, padding: 2 }}>
                {([['photo', '照片'], ['music', '音乐'], ['video', '视频']] as const).map(([key, label]) => (
                  <div
                    key={key}
                    onClick={() => { setLeftTab(key); if (key === 'photo') setLibTab('image'); else if (key === 'music') setLibTab('audio'); else if (key === 'video') setLibTab('video'); }}
                    style={{ flex: 1, textAlign: 'center', padding: '5px 0', background: leftTab === key ? 'rgba(255,255,255,0.12)' : 'transparent', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: leftTab === key ? 600 : 400, color: leftTab === key ? '#fff' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s ease-out' }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* 左侧内容区 */}
            {leftTab === 'video' ? (
              /* 视频素材库 */
              <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                <Button size="small" appearance="primary" style={{ borderRadius: 8, background: 'var(--ios-indigo)', fontWeight: 600, fontSize: 12, height: 36, border: 'none', width: '100%' }} onClick={() => handleImport('video')}>
                  🎬 导入视频文件
                </Button>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>支持 MP4 / MOV / AVI / MKV / WebM</div>
                {resources.filter(r => r.type === 'video').length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>暂无视频，点击上方导入</div>
                ) : (
                  resources.filter(r => r.type === 'video').map(res => (
                    <div key={res.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onClick={() => {
                        // 获取视频真实时长
                        const videoEl = document.createElement('video');
                        videoEl.preload = 'metadata';
                        videoEl.src = getEffectiveSrc(res.path);
                        videoEl.onloadedmetadata = () => {
                          const realDuration = Math.round(videoEl.duration * 10) / 10 || 10;
                          const gd = globalDefaultsRef.current;
                          pushSnapshot();
                          setTimeline(p => [...p, {
                            id: `tm_vid_${Date.now()}_${Math.random()}`, resourceId: res.id, duration: realDuration,
                            transition: gd.transition, rotation: gd.rotation, contrast: gd.contrast,
                            saturation: gd.saturation, exposure: gd.exposure, brilliance: gd.brilliance,
                            temp: gd.temp, tint: gd.tint, zoom: gd.zoom,
                          }]);
                          setStatusMsg(`✨ 已添加视频 (${realDuration}s)`); setTimeout(() => setStatusMsg(''), 1500);
                        };
                        videoEl.onerror = () => {
                          // fallback: 如果无法读取时长，使用默认值
                          pushSnapshot();
                          setTimeline(p => [...p, {
                            id: `tm_vid_${Date.now()}`, resourceId: res.id, duration: 10, transition: 'fade', rotation: 0, contrast: 1, saturation: 1, exposure: 1, brilliance: 1, temp: 0, tint: 0, zoom: 1,
                          }]);
                          setStatusMsg(`✨ 已添加视频`); setTimeout(() => setStatusMsg(''), 1500);
                        };
                      }}
                    >
                      <div style={{ width: 40, height: 28, borderRadius: 4, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎬</div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.name}</div>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); setResources(p => p.filter(r => r.id !== res.id)); }} style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} title="删除">×</div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* 照片/音乐 共用界面 */
              <>
                {/* 搜索 + 操作栏 */}
                <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* 快速导入按钮 */}
                <Button size="small" appearance="primary" style={{ borderRadius: 7, background: 'var(--ios-indigo)', fontWeight: 600, fontSize: 11, height: 32, border: 'none', width: '100%' }} onClick={() => handleImport(leftTab === 'music' ? 'audio' : 'image')}>
                  {leftTab === 'music' ? '🎵 导入音频文件' : '📸 导入照片文件'}
                </Button>
                <Input
                    value={searchQuery}
                    onChange={(_e, data) => setSearchQuery(data.value)}
                    placeholder="🔍 搜索..."
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 11 }}
                  />
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Button size="small" appearance="subtle" style={{ borderRadius: 6, fontSize: 11, padding: '0 6px', color: 'rgba(255,255,255,0.7)' }} onClick={() => {
                      const allIds = filteredResources.map(r => r.id);
                      if (selectedResourceIds.size === allIds.length && allIds.length > 0) setSelectedResourceIds(new Set());
                      else setSelectedResourceIds(new Set(allIds));
                    }}>
                      {filteredResources.length > 0 && selectedResourceIds.size === filteredResources.length ? '反选' : '全选'}
                    </Button>
                    <Button appearance="primary" size="small" disabled={selectedResourceIds.size === 0} style={{ flex: 1, borderRadius: 6, background: selectedResourceIds.size > 0 ? 'var(--ios-indigo)' : 'rgba(255,255,255,0.04)', color: selectedResourceIds.size > 0 ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: 11, border: 'none' }} onClick={async () => {
                      const selectedList = resources.filter(r => r.type === libTab && selectedResourceIds.has(r.id));
                      for (const r of selectedList) {
                        if (r.type === 'image') {
                          setTimeline(p => [...p, { id: `tm_${Date.now()}_${Math.random()}`, resourceId: r.id, duration: 3, transition: 'fade', rotation: 0, contrast: 1.0, saturation: 1.0, exposure: 1.0, brilliance: 1.0, temp: 0, tint: 0, zoom: 1.0, fontSize: 24, fontWeight: 'normal' }]);
                        } else {
                          const dur = await getMediaDuration(r.path);
                          setAudioItems(prev => {
                            let startPos = 0;
                            if (prev.length > 0) { const last = prev[prev.length - 1]; startPos = last.timelineStart + last.duration; }
                            return [...prev, { id: `au_${Date.now()}_${Math.random()}`, resourceId: r.id, timelineStart: startPos, startOffset: 0, duration: dur, volume: 1.0 }];
                          });
                        }
                      }
                      setSelectedResourceIds(new Set());
                    }}>
                      {selectedResourceIds.size > 0 ? `+ 编入 ${selectedResourceIds.size}项` : '+ 编入轨道'}
                    </Button>
                    <Button size="small" appearance="subtle" disabled={selectedResourceIds.size === 0} style={{ borderRadius: 6, minWidth: 28, padding: 0, fontSize: 12, color: selectedResourceIds.size > 0 ? '#FF3B30' : 'rgba(255,255,255,0.1)' }} onClick={() => removeFromLibrary(selectedResourceIds)}>🗑</Button>
                  </div>
                </div>

                {/* 资源列表 */}
                <div ref={libScrollRef} onScroll={(e) => setLibScrollTop(e.currentTarget.scrollTop)} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                  {filteredResources.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: 60, opacity: 0.2, fontSize: 11 }}>
                      {leftTab === 'photo' ? '暂无照片，点击顶部 📥导入' : '暂无音乐'}
                    </div>
                  ) : (
                    <div style={{ height: filteredResources.length * libItemHeight, position: 'relative' }}>
                      {visibleResources.map((res, idx) => {
                        const absIndex = libStartIndex + idx;
                        return (
                        <div key={res.id} style={{ position: 'absolute', top: absIndex * libItemHeight, width: '100%', height: libItemHeight, padding: '0 4px', boxSizing: 'border-box' }}>
                          <ResourceCardItem
                            res={res}
                            isAdded={addedResourceIds.has(res.id)}
                            isChecked={selectedResourceIds.has(res.id)}
                            onToggle={handleLibToggle}
                            onSelectPreview={handleLibSelectPreview}
                            onAdd={handleLibAdd}
                            onRemove={removeFromLibrary}
                            onConvert={handleConvertDNG}
                            onReveal={handleRevealInExplorer}
                            previewUrl={previewCache[res.path]}
                          />
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 2. 监视器 */}
          <div
            className="glass-panel monitor-container"
            style={{ flex: 2, position: 'relative' }}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'INPUT') return;
              const el = e.currentTarget;
              if (!document.fullscreenElement) { el.requestFullscreen().catch(() => {}); setIsFullscreen(true); }
              else { document.exitFullscreen(); setIsFullscreen(false); }
            }}
          >
            <div className="panel-header-ios" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'rgba(0,0,0,0.2)' }}>
              <span className="header-title" style={{ opacity: 0.8 }}>照片合成视频王 - 预览</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span ref={timeTextRef} style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', letterSpacing: -1 }}>{formatTime(playTime)}</span>
                <span style={{ fontSize: 10, opacity: 0.4, fontWeight: 600, letterSpacing: 1 }}>ENGINE ACTIVE</span>
              </div>
            </div>

            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {monitorSrc ? (
                monitorSrc.src ? (
                  isCropping ? (
                    <ReactCrop crop={crop} onChange={c => setCrop(c)} style={{ maxWidth: '85%', maxHeight: '85%' }}>
                      <img src={monitorSrc.src} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="" />
                    </ReactCrop>
                  ) : (
                    <div style={{ position: 'relative', width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {monitorSrc.type === 'video' ? (
                        <video ref={monitorVideoRef} src={monitorSrc.src} muted style={{
                          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px',
                          transform: `rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${monitorSrc.currentItem?.zoom || 1})`,
                          filter: `
                            brightness(${monitorSrc.currentItem?.exposure ?? 1.0})
                            contrast(${(monitorSrc.currentItem?.contrast ?? 1.0) + ((monitorSrc.currentItem?.brilliance ?? 1.0) - 1.0) * 0.2})
                            saturate(${(monitorSrc.currentItem?.saturation ?? 1.0) + ((monitorSrc.currentItem?.brilliance ?? 1.0) - 1.0) * 0.1})
                            sepia(${(monitorSrc.currentItem?.temp ?? 0) > 0 ? (monitorSrc.currentItem?.temp ?? 0) / 100 : 0})
                            hue-rotate(${(monitorSrc.currentItem?.tint ?? 0)}deg)
                          `,
                          transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), filter 0.4s'
                        }} />
                      ) : (
                        <img key={monitorSrc.currentItem?.id} src={monitorSrc.src} className={monitorSrc.currentItem?.animation && monitorSrc.currentItem.animation !== 'none' ? monitorSrc.currentItem.animation : ''} style={{
                          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px',
                          transformOrigin: (monitorSrc.currentItem && resourceMap.get(monitorSrc.currentItem.resourceId)?.focusX) ? `${resourceMap.get(monitorSrc.currentItem.resourceId)?.focusX}% ${resourceMap.get(monitorSrc.currentItem.resourceId)?.focusY}%` : 'center center',
                          transform: `rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${monitorSrc.currentItem?.zoom || 1})`,
                          filter: `
                            brightness(${monitorSrc.currentItem?.exposure ?? 1.0})
                            contrast(${(monitorSrc.currentItem?.contrast ?? 1.0) + ((monitorSrc.currentItem?.brilliance ?? 1.0) - 1.0) * 0.2})
                            saturate(${(monitorSrc.currentItem?.saturation ?? 1.0) + ((monitorSrc.currentItem?.brilliance ?? 1.0) - 1.0) * 0.1})
                            sepia(${(monitorSrc.currentItem?.temp ?? 0) > 0 ? (monitorSrc.currentItem?.temp ?? 0) / 100 : 0})
                            hue-rotate(${(monitorSrc.currentItem?.tint ?? 0)}deg)
                          `,
                          transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), filter 0.4s'
                        }} alt="" />
                      )}
                      {monitorSrc.currentItem?.overlayText && (
                        <div
                          key={`txt-${monitorSrc.currentItem.id}`}
                          className={`text-anim-${monitorSrc.currentItem.textAnimation || 'none'}`}
                          style={{
                            position: 'absolute',
                            top: `${monitorSrc.currentItem.textY ?? 50}%`,
                            left: `${monitorSrc.currentItem.textX ?? 50}%`,
                            transform: 'translate(-50%, -50%)',
                            '--text-anim-dur': `${monitorSrc.currentItem.textAnimDuration ?? 0.6}s`,
                            textAlign: (monitorSrc.currentItem.textAlign || 'center') as any,
                            color: monitorSrc.currentItem.fontColor || '#fff',
                            fontSize: monitorSrc.currentItem.fontSize || 36,
                            fontWeight: monitorSrc.currentItem.fontWeight === 'bold' ? 700 : 400,
                            fontFamily: monitorSrc.currentItem.fontFamily || 'sans-serif',
                            textShadow: monitorSrc.currentItem.textGlow
                              ? `0 0 20px ${monitorSrc.currentItem.textShadowColor || monitorSrc.currentItem.fontColor || '#fff'}, 0 0 40px ${monitorSrc.currentItem.textShadowColor || monitorSrc.currentItem.fontColor || '#fff'}60`
                              : (monitorSrc.currentItem.textShadowColor ? `2px 2px 8px ${monitorSrc.currentItem.textShadowColor}` : '0 0 20px rgba(0,0,0,0.8)'),
                            WebkitTextStroke: monitorSrc.currentItem.textStrokeColor
                              ? `${monitorSrc.currentItem.textStrokeWidth || 1}px ${monitorSrc.currentItem.textStrokeColor}`
                              : undefined,
                            background: monitorSrc.currentItem.textBg || 'transparent',
                            padding: monitorSrc.currentItem.textBg && monitorSrc.currentItem.textBg !== 'transparent' ? '12px 24px' : 0,
                            borderRadius: 8,
                            cursor: 'move',
                            maxWidth: '80%',
                            userSelect: 'none',
                            zIndex: 10,
                          } as React.CSSProperties}
                          onMouseDown={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            const container = e.currentTarget.parentElement;
                            if (!container) return;
                            const rect = container.getBoundingClientRect();
                            const startX = e.clientX, startY = e.clientY;
                            const startPctX = monitorSrc.currentItem?.textX ?? 50;
                            const startPctY = monitorSrc.currentItem?.textY ?? 50;
                            const onMove = (me: MouseEvent) => {
                              const dx = ((me.clientX - startX) / rect.width) * 100;
                              const dy = ((me.clientY - startY) / rect.height) * 100;
                              setTimeline(p => p.map(t => t.id === monitorSrc.currentItem?.id
                                ? { ...t, textX: Math.max(0, Math.min(100, startPctX + dx)), textY: Math.max(0, Math.min(100, startPctY + dy)) }
                                : t));
                            };
                            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                            window.addEventListener('mousemove', onMove);
                            window.addEventListener('mouseup', onUp);
                          }}
                        >{monitorSrc.currentItem.overlayText}</div>
                      )}
                    </div>
                  )
                ) : (
                  /* 纯文字项预览（无图片背景） */
                  <div style={{ position: 'relative', width: '85%', height: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: monitorSrc.currentItem?.textBg || 'rgba(30,30,30,0.9)', border: `2px solid ${monitorSrc.currentItem?.fontColor || '#fff'}30` }}>
                    <div style={{ textAlign: (monitorSrc.currentItem?.textAlign || 'center') as any, color: monitorSrc.currentItem?.fontColor || '#fff', fontSize: monitorSrc.currentItem?.fontSize || 36, fontWeight: monitorSrc.currentItem?.fontWeight === 'bold' ? 700 : 400, fontFamily: monitorSrc.currentItem?.fontFamily || 'sans-serif', textShadow: monitorSrc.currentItem?.textGlow ? `0 0 20px ${monitorSrc.currentItem?.textShadowColor || monitorSrc.currentItem?.fontColor || '#fff'}, 0 0 40px ${monitorSrc.currentItem?.textShadowColor || monitorSrc.currentItem?.fontColor || '#fff'}60` : (monitorSrc.currentItem?.textShadowColor ? `2px 2px 8px ${monitorSrc.currentItem?.textShadowColor}` : '0 0 20px rgba(0,0,0,0.5)'), WebkitTextStroke: monitorSrc.currentItem?.textStrokeColor ? `${monitorSrc.currentItem?.textStrokeWidth || 1}px ${monitorSrc.currentItem?.textStrokeColor}` : undefined, padding: '24px 32px', maxWidth: '80%', wordBreak: 'break-word' as const }}>{monitorSrc.currentItem?.overlayText}</div>
                  </div>
                )
              ) : (
                <div style={{ opacity: 0.03, color: '#fff', fontSize: 100, fontWeight: 900, transform: 'rotate(-10deg)', userSelect: 'none' }}>iOS 26</div>
              )}
            </div>

            <div className="floating-play-btn" style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }} onClick={togglePlay}>
              <span style={{ display: 'inline-block', transform: isPlaying ? 'none' : 'translateX(4px)' }}>
                {isPlaying ? '⏸' : '▶'}
              </span>
            </div>

            {/* Mini 进度条 + 播放速度 */}
            <div style={{ position: 'absolute', bottom: 12, left: 20, right: 20, display: 'flex', alignItems: 'center', gap: 10, zIndex: 50 }}>
              <div
                style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const bar = e.currentTarget;
                  const seek = (clientX: number) => {
                    const rect = bar.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    setPlayTime(maxPlayTime * pct);
                  };
                  seek(e.clientX);
                  const onMove = (ev: MouseEvent) => seek(ev.clientX);
                  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                <div style={{ width: `${maxPlayTime > 0 ? (playTime / maxPlayTime * 100) : 0}%`, height: '100%', borderRadius: 3, background: 'var(--ios-indigo)', transition: isPlaying ? 'none' : 'width 0.15s', boxShadow: '0 0 6px var(--ios-indigo-glow)' }} />
              </div>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="ios-dark-select"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 10, padding: '2px 6px', cursor: 'pointer', minWidth: 48 }}
              >
                <option value="0.5" style={{ background: '#1e1e2e', color: '#fff' }}>0.5x</option>
                <option value="0.75" style={{ background: '#1e1e2e', color: '#fff' }}>0.75x</option>
                <option value="1" style={{ background: '#1e1e2e', color: '#fff' }}>1x</option>
                <option value="1.5" style={{ background: '#1e1e2e', color: '#fff' }}>1.5x</option>
                <option value="2" style={{ background: '#1e1e2e', color: '#fff' }}>2x</option>
              </select>
            </div>
          </div>

          {/* 3. 右侧属性面板（上下文驱动 + 编辑/导出模式切换） */}
          <div className="glass-panel" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header-ios" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="header-title" style={{ fontSize: 12 }}>
                {showGlobalDefaults ? '⚙️ 全局默认设置' : showExportPanel ? '🚀 导出设置' : (
                  selectedIds.size > 1 ? `🎨 批量编辑 (${selectedIds.size}项)` :
                  selectedIds.size === 1 ? '🎨 照片属性' :
                  selectedAudioIds.size > 0 ? '🎵 音频属性' :
                  '💡 项目信息'
                )}
              </span>
              {(showGlobalDefaults || showExportPanel) && <Button size="small" appearance="subtle" style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, color: 'rgba(255,255,255,0.5)' }} onClick={() => { setShowGlobalDefaults(false); setShowExportPanel(false); setActiveTab('effects'); }}>← 返回</Button>}
            </div>
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', scrollBehavior: 'smooth' }}>
              {/* ═══ 全局默认设置面板 (任务6) ═══ */}
              {showGlobalDefaults ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                    修改全局默认值将自动应用到所有<strong style={{ color: 'rgba(255,255,255,0.65)' }}>未手动覆盖</strong>的图片。单独修改过的图片参数旁会显示 ✏️ 标记。
                  </div>
                  <div className="ios-prop-group">
                    <Text weight="bold" style={{ color: '#10B981', fontSize: 13, marginBottom: 8, display: 'block' }}>⏱ 基础参数</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Field label={`默认时长: ${globalDefaults.duration}s`}>
                        <Slider min={0.5} max={10} step={0.1} value={globalDefaults.duration} onChange={(_e, d) => {
                          const v = Math.round(d.value * 10) / 10;
                          setGlobalDefaults(p => ({ ...p, duration: v }));
                          setTimeline(prev => prev.map(t => !(t.overrides?.includes('duration')) ? { ...t, duration: v } : t));
                        }} />
                      </Field>
                      <Field label="默认片段转场">
                        <IosSelect
                          value={globalDefaults.transition}
                          onChange={v => {
                            setGlobalDefaults(p => ({ ...p, transition: v }));
                            setTimeline(prev => prev.map(t => !(t.overrides?.includes('transition')) ? { ...t, transition: v } : t));
                          }}
                          style={{ height: 36 }}
                          options={[
                            { value: 'none', label: '直接切入 (Cut)' },
                            { value: 'fade', label: '经典叠化 (Dissolve)' },
                            { value: 'white', label: '模糊闪白 (Dip to White)' },
                            { value: 'iris', label: '中心扩散 (Iris)' },
                            { value: 'slide', label: '平滑推入 (Push)' },
                            { value: 'zoom', label: '专业缩放 (Zoom)' }
                          ]}
                        />
                      </Field>
                      <Field label="默认照片动效 (入场)">
                        <IosSelect
                          value={globalDefaults.animation || 'none'}
                          onChange={v => {
                            setGlobalDefaults(p => ({ ...p, animation: v }));
                            setTimeline(prev => prev.map(t => {
                              if (t.overrides?.includes('animation')) return t;
                              const finalAnim = v === 'random' ? ANIMATION_PRESETS[Math.floor(Math.random() * ANIMATION_PRESETS.length)] : v;
                              return { ...t, animation: finalAnim, overrides: v === 'random' ? [...(t.overrides || []), 'animation'] : (t.overrides || []) };
                            }));
                          }}
                          style={{ height: 36 }}
                          options={[
                            { value: 'none', label: '无动效 (None)' },
                            { value: 'random', label: '🎲 照片随机分配 (Random)' },
                            { value: 'anim-img-fadeIn', label: '平滑淡入 (Fade In)' },
                            { value: 'anim-img-slideLeft', label: '从右滑入 (Slide Left)' },
                            { value: 'anim-img-slideRight', label: '从左滑入 (Slide Right)' },
                            { value: 'anim-img-slideUp', label: '向上浮现 (Slide Up)' },
                            { value: 'anim-img-slideDown', label: '向下降落 (Slide Down)' },
                            { value: 'anim-img-zoomIn', label: '缓慢放大 (Zoom In)' },
                            { value: 'anim-img-zoomOut', label: '缓慢缩小 (Zoom Out)' },
                            { value: 'anim-img-panLeft', label: '向左推移 (Pan Left)' },
                            { value: 'anim-img-panRight', label: '向右推移 (Pan Right)' }
                          ]}
                        />
                      </Field>
                    </div>
                  </div>
                  <div className="ios-prop-group">
                    <Text weight="bold" style={{ color: 'var(--ios-indigo)', fontSize: 13, marginBottom: 8, display: 'block' }}>🌓 影像参数默认值</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {([['exposure', '曝光', 0.5, 2.0, 0.05], ['brilliance', '鲜明度', 0.5, 2.0, 0.05], ['contrast', '对比度', 0.5, 2.0, 0.05], ['saturation', '饱和度', 0.0, 2.0, 0.05]] as const).map(([key, label, min, max, step]) => (
                        <Field key={key} label={`${label}: ${globalDefaults[key].toFixed(2)}`}>
                          <Slider min={min} max={max} step={step} value={globalDefaults[key]} onChange={(_e, d) => {
                            setGlobalDefaults(p => ({ ...p, [key]: d.value }));
                            setTimeline(prev => prev.map(t => !(t.overrides?.includes(key)) ? { ...t, [key]: d.value } : t));
                          }} />
                        </Field>
                      ))}
                    </div>
                  </div>
                  <div className="ios-prop-group">
                    <Text weight="bold" style={{ color: '#C084FC', fontSize: 13, marginBottom: 8, display: 'block' }}>🎨 色彩默认值</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {([['temp', '色温', -100, 100, 1], ['tint', '色调', -100, 100, 1]] as const).map(([key, label, min, max, step]) => (
                        <Field key={key} label={`${label}: ${globalDefaults[key]}`}>
                          <Slider min={min} max={max} step={step} value={globalDefaults[key]} onChange={(_e, d) => {
                            setGlobalDefaults(p => ({ ...p, [key]: d.value }));
                            setTimeline(prev => prev.map(t => !(t.overrides?.includes(key)) ? { ...t, [key]: d.value } : t));
                          }} />
                        </Field>
                      ))}
                    </div>
                  </div>
                  <Button appearance="subtle" style={{ marginTop: 8, borderRadius: 10, height: 36, fontSize: 12, color: '#FF3B30', border: '1px solid rgba(255,59,48,0.2)' }} onClick={() => {
                    pushSnapshot();
                    setGlobalDefaults(GLOBAL_DEFAULTS_INIT);
                    setTimeline(prev => prev.map(t => {
                      const clean: any = { ...t };
                      Object.keys(GLOBAL_DEFAULTS_INIT).forEach(k => {
                        if (!(t.overrides?.includes(k))) clean[k] = (GLOBAL_DEFAULTS_INIT as any)[k];
                      });
                      return clean;
                    }));
                    setStatusMsg('🔄 已重置所有全局参数为默认值'); setTimeout(() => setStatusMsg(''), 1500);
                  }}>
                    🔄 重置全部为默认
                  </Button>
                </div>
              ) :
              activeTab === 'effects' ? (
                (selectedIds.size > 0 || selectedAudioIds.size > 0) ? (
                  selectedIds.size > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

                      {/* 滤镜预设 */}
                      <div className="ios-prop-group">
                        <Text weight="bold" style={{ color: '#10B981', fontSize: 13, marginBottom: 8, display: 'block' }}>🎨 一键滤镜预设</Text>
                        <div className="filter-preset-scroll">
                          {FILTER_PRESETS.map((preset) => (
                            <div
                              key={preset.name}
                              className="filter-preset-card"
                              onClick={() => {
                                pushSnapshot();
                                setTimeline(prev => prev.map(t => selectedIds.has(t.id) ? {
                                  ...t, exposure: preset.exposure, contrast: preset.contrast, saturation: preset.saturation, temp: preset.temp, tint: preset.tint, brilliance: preset.brilliance
                                } : t));
                                setStatusMsg(`✨ 已应用${preset.name}预设`); setTimeout(() => setStatusMsg(''), 1500);
                              }}
                            >
                              {preset.name}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* GROUP 1: 影像与色彩 (合并) */}
                      <div className="ios-prop-group">
                        <Text weight="bold" style={{ color: 'var(--ios-indigo)', fontSize: 11, marginBottom: 2, display: 'block' }}>🎨 影像与色彩 {selectedIds.size > 1 && <span style={{ fontSize: 9, opacity: 0.5, fontWeight: 400 }}>({selectedIds.size} 项)</span>}</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
                          
                          {/* 动效/入场 */}
                          <Field label={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>照片动效/入场</span>
                              {selectedItem && <span onClick={() => selectedItem && (isOverridden(selectedItem, 'animation') ? restoreInheritance(selectedItem.id, 'animation') : null)} style={{ cursor: isOverridden(selectedItem, 'animation') ? 'pointer' : 'default', fontSize: 11, opacity: 0.7 }} title={isOverridden(selectedItem, 'animation') ? '点击恢复继承全局默认' : '正在继承全局默认'}>{isOverridden(selectedItem, 'animation') ? '✏️' : '🔗'}</span>}
                            </span>
                          }>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <IosSelect
                                value={(selectedItem as any)?.animation || 'none'}
                                onChange={val => {
                                  pushSnapshot();
                                  updateSelectedProperty('animation', val);
                                }}
                                style={{ flex: 1, height: 32 }}
                                options={[
                                  { value: 'none', label: '无动效 (None)' },
                                  { value: 'anim-img-fadeIn', label: '平滑淡入 (Fade In)' },
                                  { value: 'anim-img-slideLeft', label: '从右滑入 (Slide Left)' },
                                  { value: 'anim-img-slideRight', label: '从左滑入 (Slide Right)' },
                                  { value: 'anim-img-slideUp', label: '向上浮现 (Slide Up)' },
                                  { value: 'anim-img-slideDown', label: '向下降落 (Slide Down)' },
                                  { value: 'anim-img-zoomIn', label: '缓慢放大 (Zoom In)' },
                                  { value: 'anim-img-zoomOut', label: '缓慢缩小 (Zoom Out)' },
                                  { value: 'anim-img-panLeft', label: '向左推移 (Pan Left)' },
                                  { value: 'anim-img-panRight', label: '向右推移 (Pan Right)' }
                                ]}
                              />
                              <div
                                title="为时间线所有照片随机分配不同动效"
                                className="ios-hover-scale"
                                style={{
                                  height: 32, width: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: 16,
                                  boxShadow: '0 2px 8px rgba(99,102,241,0.2)', transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0
                                }}
                                onClick={() => {
                                  pushSnapshot();
                                  setTimeline(prev => prev.map(t => {
                                    const isImage = resourceMap.get(t.resourceId)?.type === 'image';
                                    if (isImage) {
                                      const randAnim = ANIMATION_PRESETS[Math.floor(Math.random() * ANIMATION_PRESETS.length)];
                                      const ov = new Set(t.overrides || []);
                                      ov.add('animation');
                                      return { ...t, animation: randAnim, overrides: Array.from(ov) };
                                    }
                                    return t;
                                  }));
                                  setStatusMsg('🎲 已为所有照片随机生成新动效！'); setTimeout(() => setStatusMsg(''), 2000);
                                }}
                              >🎲</div>
                            </div>
                          </Field>

                          <Field label={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{`时长: ${localDuration !== null ? localDuration : (selectedItem?.duration || 3)}s`}</span>
                              {selectedItem && <span onClick={() => selectedItem && (isOverridden(selectedItem, 'duration') ? restoreInheritance(selectedItem.id, 'duration') : null)} style={{ cursor: isOverridden(selectedItem, 'duration') ? 'pointer' : 'default', fontSize: 11, opacity: 0.7 }} title={isOverridden(selectedItem, 'duration') ? '点击恢复继承全局默认' : '正在继承全局默认'}>{isOverridden(selectedItem, 'duration') ? '✏️' : '🔗'}</span>}
                            </span>
                          }>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <div style={{ flex: 1, minWidth: 0 }} onMouseUp={() => { if (localDuration !== null) { pushSnapshot(); updateSelectedProperty('duration', localDuration); setLocalDuration(null); } }}>
                                <Slider min={0.1} max={10} step={0.1} value={localDuration !== null ? localDuration : (selectedItem?.duration || 3)} onChange={(_e, d) => setLocalDuration(Math.round(d.value * 10) / 10)} style={{ width: '100%', maxWidth: '100%' }} />
                              </div>
                              <div
                                title="为所有照片的时长随机波动上下20%"
                                className="ios-hover-scale"
                                style={{
                                  height: 32, width: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: 16,
                                  boxShadow: '0 2px 8px rgba(99,102,241,0.2)', transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0
                                }}
                                onClick={() => {
                                  const baseDuration = localDuration !== null ? localDuration : (selectedItem?.duration || 3);
                                  pushSnapshot();
                                  setTimeline(prev => prev.map(t => {
                                    if (resourceMap.get(t.resourceId)?.type === 'image') {
                                      const factor = 0.8 + Math.random() * 0.4;
                                      const newDur = Math.max(0.1, Math.round(baseDuration * factor * 10) / 10);
                                      const ov = new Set(t.overrides || []);
                                      ov.add('duration');
                                      return { ...t, duration: newDur, overrides: Array.from(ov) };
                                    }
                                    return t;
                                  }));
                                  setStatusMsg(`🎲 已基于 ${baseDuration}s 为全轨重新随机分配时长！`); setTimeout(() => setStatusMsg(''), 2000);
                                }}
                              >🎲</div>
                            </div>
                          </Field>
                          {([['exposure', '曝光', 0.5, 2.0, 0.05], ['brilliance', '鲜明度', 0.5, 2.0, 0.05], ['contrast', '对比度', 0.5, 2.0, 0.05], ['saturation', '饱和度', 0.0, 2.0, 0.05], ['temp', '色温', -100, 100, 1], ['tint', '色调', -100, 100, 1]] as [keyof GlobalDefaults, string, number, number, number][]).map(([key, label, min, max, step]) => (
                            <Field key={key} label={
                              <span onDoubleClick={() => { pushSnapshot(); updateSelectedProperty(key, key === 'temp' || key === 'tint' ? 0 : (GLOBAL_DEFAULTS_INIT as any)[key]); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} title="双击重置">
                                <span>{`${label}: ${key === 'temp' || key === 'tint' ? ((selectedItem as any)?.[key] || 0) : ((selectedItem as any)?.[key]?.toFixed(2) || (GLOBAL_DEFAULTS_INIT as any)[key].toFixed(2))}`}</span>
                                {selectedItem && <span onClick={(e) => { e.stopPropagation(); if (isOverridden(selectedItem, key)) restoreInheritance(selectedItem.id, key); }} style={{ cursor: isOverridden(selectedItem, key) ? 'pointer' : 'default', fontSize: 11, opacity: 0.7 }} title={isOverridden(selectedItem, key) ? '点击恢复继承' : '继承全局默认'}>{isOverridden(selectedItem, key) ? '✏️' : '🔗'}</span>}
                              </span>
                            }>
                              <div style={{ width: '100%', minWidth: 0 }} onMouseUp={finalizeSliderUndo}>
                                <Slider style={{ width: '100%', maxWidth: '100%' }} min={min} max={max} step={step} value={key === 'temp' || key === 'tint' ? ((selectedItem as any)?.[key] || 0) : ((selectedItem as any)?.[key] || (GLOBAL_DEFAULTS_INIT as any)[key])} onChange={(_e, d) => updatePropertyWithUndo(key, d.value)} />
                              </div>
                            </Field>
                          ))}
                        </div>
                      </div>

                      {/* 批量操作按钮组 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Button appearance="primary" style={{ borderRadius: 10, background: 'var(--ios-indigo)', height: 38, fontWeight: 600, fontSize: 12 }} onClick={applyAllToTimeline}>
                          ✨ 一键分发至全部图片
                        </Button>
                        <Button appearance="subtle" style={{ borderRadius: 10, height: 34, fontWeight: 500, fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => {
                              const anims = ['anim-img-fadeIn', 'anim-img-slideLeft', 'anim-img-slideRight', 'anim-img-slideUp', 'anim-img-slideDown', 'anim-img-zoomIn', 'anim-img-zoomOut', 'anim-img-panLeft', 'anim-img-panRight'];
                              pushSnapshot();
                              // Randomize ALL images on timeline 
                              setTimeline(prev => prev.map(t => {
                                const isImage = resourceMap.get(t.resourceId)?.type === 'image';
                                return isImage ? { ...t, animation: anims[Math.floor(Math.random() * anims.length)] } : t;
                              }));
                              setStatusMsg(`🎲 已为全轨所有照片重新随机分配动效`); setTimeout(() => setStatusMsg(''), 2000);
                        }}>
                          🎲 一键随机全部照片动效
                        </Button>
                        {audioItems.length > 0 && timeline.length > 0 && (
                          <Button appearance="subtle" style={{ borderRadius: 10, height: 34, fontWeight: 500, fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                            onClick={() => {
                              const totalAudioDur = Math.max(...audioItems.map(a => a.timelineStart + a.duration));
                              if (totalAudioDur <= 0 || timeline.length === 0) return;
                              pushSnapshot();
                              const perItemDur = totalAudioDur / timeline.length;
                              setTimeline(prev => prev.map(t => ({ ...t, duration: Math.round(perItemDur * 10) / 10 })));
                              setStatusMsg(`🎵 已将 ${timeline.length} 张图片均匀分配到 ${totalAudioDur.toFixed(1)}s 音乐时长`);
                              setTimeout(() => setStatusMsg(''), 2000);
                            }}>
                            🎵 自动适配音乐时长
                          </Button>
                        )}
                      </div>

                      {/* GROUP 2: 文字工坊 */}
                      <div className="ios-prop-group">
                        <Text weight="bold" style={{ color: '#34D399', fontSize: 11, marginBottom: 2, display: 'block' }}>⌨️ 文字工坊</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <Input value={selectedItem?.overlayText || ''} onChange={(_e, data) => updateSelectedProperty('overlayText', data.value)} placeholder="输入文字..." style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 6px', width: '100%', fontSize: 11 }} />

                          {/* 字体 + 字号一行 */}
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <select
                              value={selectedItem?.fontFamily || 'sans-serif'}
                              onChange={e => updateSelectedProperty('fontFamily', e.target.value)}
                              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 4px', color: '#fff', fontSize: 10, outline: 'none', cursor: 'pointer', minWidth: 0 }}
                            >
                              <optgroup label="常用" style={{ background: '#1e1e2e' }}>
                                <option value="sans-serif">默认</option>
                                <option value="'Microsoft YaHei', sans-serif">微软雅黑</option>
                                <option value="'SimHei', sans-serif">黑体</option>
                                <option value="'SimSun', serif">宋体</option>
                                <option value="'KaiTi', serif">楷体</option>
                                <option value="'FangSong', serif">仿宋</option>
                              </optgroup>
                              <optgroup label="艺术字体" style={{ background: '#1e1e2e' }}>
                                <option value="'STXingkai', cursive">华文行楷</option>
                                <option value="'STCaiyun', cursive">华文彩云</option>
                                <option value="'STHupo', cursive">华文琥珀</option>
                                <option value="'STLiti', serif">华文隶书</option>
                                <option value="'STXinwei', serif">华文新魏</option>
                                <option value="'YouYuan', sans-serif">幼圆</option>
                                <option value="'LiSu', serif">隶书</option>
                                <option value="'STZhongsong', serif">华文中宋</option>
                                <option value="'FZShuTi', serif">方正舒体</option>
                                <option value="'FZYaoTi', serif">方正姚体</option>
                              </optgroup>
                              <optgroup label="英文字体" style={{ background: '#1e1e2e' }}>
                                <option value="'Impact', sans-serif">Impact</option>
                                <option value="'Georgia', serif">Georgia</option>
                                <option value="'Palatino Linotype', serif">Palatino</option>
                                <option value="'Comic Sans MS', cursive">Comic Sans</option>
                                <option value="'Lucida Console', monospace">Lucida Console</option>
                                <option value="'Brush Script MT', cursive">Brush Script</option>
                                <option value="'Copperplate Gothic', serif">Copperplate</option>
                                <option value="'Bookman Old Style', serif">Bookman</option>
                              </optgroup>
                            </select>
                            <input type="number" value={selectedItem?.fontSize || 24} onChange={e => updateSelectedProperty('fontSize', Number(e.target.value))} min={8} max={200} style={{ width: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 4px', color: '#fff', fontSize: 10, outline: 'none', textAlign: 'center' }} />
                          </div>

                          {/* 粗体/斜体/对齐 + 颜色 一行 */}
                          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                            <div onClick={() => updateSelectedProperty('fontWeight', selectedItem?.fontWeight === 'bold' ? 'normal' : 'bold')} style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedItem?.fontWeight === 'bold' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 800, fontSize: 11, color: '#fff' }}>B</div>
                            <div onClick={() => updateSelectedProperty('fontWeight', selectedItem?.fontWeight === 'italic' ? 'normal' : 'italic')} style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedItem?.fontWeight === 'italic' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontStyle: 'italic', fontSize: 11, color: '#fff' }}>I</div>
                            {(['left', 'center', 'right'] as const).map(a => (
                              <div key={a} onClick={() => updateSelectedProperty('textAlign', a)} style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: (selectedItem?.textAlign || 'center') === a ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 9, color: '#fff' }}>
                                {a === 'left' ? '◧' : a === 'center' ? '◻' : '◨'}
                              </div>
                            ))}
                            <div style={{ flex: 1 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>色</span>
                              <input type="color" value={selectedItem?.fontColor || '#FFFFFF'} onChange={e => updateSelectedProperty('fontColor', e.target.value)} style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            </div>
                          </div>

                          {/* 艺术字预设 5列 */}
                          <div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>艺术字预设</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
                              {([
                                { label: '霓虹', color: '#00FFFF', shadow: '#00FFFF', stroke: '', glow: true, font: 'sans-serif' },
                                { label: '金属', color: '#FFD700', shadow: '#B8860B', stroke: '#DAA520', glow: false, font: "'Impact', sans-serif" },
                                { label: '冰雪', color: '#E0F4FF', shadow: '#4FC3F7', stroke: '#81D4FA', glow: true, font: 'serif' },
                                { label: '烈焰', color: '#FF6B35', shadow: '#FF0000', stroke: '#FFD700', glow: true, font: "'SimHei', sans-serif" },
                                { label: '科技', color: '#00FF88', shadow: '#00FF88', stroke: '', glow: true, font: 'monospace' },
                                { label: '优雅', color: '#FFFFFF', shadow: 'rgba(0,0,0,0.5)', stroke: '', glow: false, font: "'KaiTi', serif" },
                                { label: '复古', color: '#D4A574', shadow: '#8B4513', stroke: '', glow: false, font: 'serif' },
                                { label: '浪漫', color: '#FF69B4', shadow: '#FF1493', stroke: '', glow: true, font: "'STXingkai', cursive" },
                                { label: '暗夜', color: '#9370DB', shadow: '#4B0082', stroke: '#6A0DAD', glow: true, font: "'STHupo', cursive" },
                                { label: '朋克', color: '#FF00FF', shadow: '#FF00FF', stroke: '#00FF00', glow: true, font: "'Impact', sans-serif" },
                                { label: '水墨', color: '#2F2F2F', shadow: 'rgba(0,0,0,0.3)', stroke: '', glow: false, font: "'STXingkai', cursive" },
                                { label: '彩虹', color: '#FF6B6B', shadow: '#FFD93D', stroke: '#6BCB77', glow: true, font: "'STCaiyun', cursive" },
                                { label: '极光', color: '#7DF9FF', shadow: '#00CED1', stroke: '#20B2AA', glow: true, font: 'sans-serif' },
                                { label: '古典', color: '#8B7355', shadow: '#5C4033', stroke: '#DEB887', glow: false, font: "'STLiti', serif" },
                                { label: '清除', color: '#FFFFFF', shadow: '', stroke: '', glow: false, font: 'sans-serif' },
                              ]).map(preset => (
                                <div
                                  key={preset.label}
                                  onClick={() => {
                                    pushSnapshot();
                                    setTimeline(p => p.map(t => selectedIds.has(t.id) ? {
                                      ...t,
                                      fontColor: preset.color,
                                      textShadowColor: preset.shadow,
                                      textStrokeColor: preset.stroke,
                                      textGlow: preset.glow,
                                      fontFamily: preset.font,
                                    } : t));
                                  }}
                                  style={{ padding: '3px 1px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'center', fontSize: 9, color: preset.color, fontWeight: 600, transition: 'all 0.12s', textShadow: preset.shadow ? `0 0 6px ${preset.shadow}` : 'none', lineHeight: '1.2' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = preset.color + '60'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                                >{preset.label}</div>
                              ))}
                            </div>
                          </div>

                          {/* 文字效果 */}
                          <div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>效果</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                              <div onClick={() => updateSelectedProperty('textGlow', !selectedItem?.textGlow)} style={{ padding: '3px 1px', borderRadius: 4, background: selectedItem?.textGlow ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedItem?.textGlow ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', textAlign: 'center', fontSize: 9, color: '#fff' }}>✨发光</div>
                              <div onClick={() => updateSelectedProperty('textStrokeColor', selectedItem?.textStrokeColor ? '' : '#000000')} style={{ padding: '3px 1px', borderRadius: 4, background: selectedItem?.textStrokeColor ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedItem?.textStrokeColor ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', textAlign: 'center', fontSize: 9, color: '#fff' }}>🔲描边</div>
                              <div onClick={() => updateSelectedProperty('textShadowColor', selectedItem?.textShadowColor ? '' : 'rgba(0,0,0,0.8)')} style={{ padding: '3px 1px', borderRadius: 4, background: selectedItem?.textShadowColor ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedItem?.textShadowColor ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', textAlign: 'center', fontSize: 9, color: '#fff' }}>🌑阴影</div>
                              <div onClick={() => updateSelectedProperty('textBg', selectedItem?.textBg && selectedItem.textBg !== 'transparent' ? 'transparent' : 'rgba(0,0,0,0.5)')} style={{ padding: '3px 1px', borderRadius: 4, background: selectedItem?.textBg && selectedItem.textBg !== 'transparent' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedItem?.textBg && selectedItem.textBg !== 'transparent' ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', textAlign: 'center', fontSize: 9, color: '#fff' }}>◼底板</div>
                            </div>
                            {selectedItem?.textStrokeColor ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>描边{selectedItem?.textStrokeWidth || 1}px</span>
                                <input type="range" min={0.5} max={6} step={0.5} value={selectedItem?.textStrokeWidth || 1} onChange={e => updateSelectedProperty('textStrokeWidth', Number(e.target.value))} style={{ flex: 1, height: 3, accentColor: '#6366F1' }} />
                                <input type="color" value={selectedItem?.textStrokeColor || '#000000'} onChange={e => updateSelectedProperty('textStrokeColor', e.target.value)} style={{ width: 18, height: 18, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                              </div>
                            ) : null}
                          </div>

                          {/* 入场动画 */}
                          <div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>🎬 入场动画</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 4 }}>
                              {([
                                ['none', '🚫 无'],
                                ['fadeIn', '☁️ 淡入'],
                                ['slideLeft', '→ 左飘入'],
                                ['slideRight', '← 右飘入'],
                                ['slideUp', '↑ 下飘入'],
                                ['slideDown', '↓ 上飘入'],
                                ['zoom', '🔍 缩放弹出'],
                                ['bounce', '⬆ 弹跳落入'],
                                ['typewriter', '⌨️ 打字机'],
                                ['rotateIn', '🌀 旋转飘入'],
                              ] as [string, string][]).map(([val, label]) => (
                                <div
                                  key={val}
                                  onClick={() => updateSelectedProperty('textAnimation', val)}
                                  style={{
                                    padding: '3px 2px', borderRadius: 5, cursor: 'pointer', textAlign: 'center',
                                    fontSize: 9, fontWeight: (selectedItem?.textAnimation || 'none') === val ? 700 : 400,
                                    color: (selectedItem?.textAnimation || 'none') === val ? '#fff' : 'rgba(255,255,255,0.55)',
                                    background: (selectedItem?.textAnimation || 'none') === val ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${(selectedItem?.textAnimation || 'none') === val ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                    transition: 'all 0.15s',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  }}
                                >{label}</div>
                              ))}
                            </div>
                            {(selectedItem?.textAnimation && selectedItem.textAnimation !== 'none') && (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>动画 {(selectedItem?.textAnimDuration ?? 0.6).toFixed(1)}s</span>
                                <input type="range" min={0.2} max={2.0} step={0.1}
                                  value={selectedItem?.textAnimDuration ?? 0.6}
                                  onChange={e => updateSelectedProperty('textAnimDuration', Number(e.target.value))}
                                  style={{ flex: 1, height: 3, accentColor: '#6366F1' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* GROUP 4: 几何与时间 */}
                      <div className="ios-prop-group">
                        <Text weight="bold" style={{ color: '#F87171', fontSize: 13, marginBottom: 8, display: 'block' }}>📐 几何、时间与转场</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button size="small" style={{ flex: 1 }} onClick={() => updateSelectedProperty('rotation', (selectedItem!.rotation + 90) % 360)}>↺ 旋转 90°</Button>
                            <Button
                              size="small"
                              appearance={isCropping ? 'primary' : 'outline'}
                              style={{ flex: 1 }}
                              onClick={() => {
                                if (isCropping) { updateSelectedProperty('cropPos', crop); setIsCropping(false); }
                                else { setCrop({ unit: '%', width: 50, height: 50, x: 25, y: 25 }); setIsCropping(true); }
                              }}
                            >{isCropping ? '确认裁剪' : '自由裁剪'}</Button>
                          </div>
                          <Field label={`缩放: ${selectedItem?.zoom?.toFixed(2) || '1.0'}`}><Slider min={1.0} max={3.0} step={0.1} value={selectedItem?.zoom || 1.0} onChange={(_e, d) => updateSelectedProperty('zoom', d.value)} /></Field>
                          <Field label="全局转场方式">
                            <select className="ios-dark-select" value={selectedItem?.transition} onChange={(_e) => updateSelectedProperty('transition', _e.target.value)} style={{ width: '100%', height: 36 }}>
                              <option value="none">直接切入 (Cut)</option>
                              <option value="fade">经典叠化 (Dissolve)</option>
                              <option value="white">模糊闪白 (Dip to White)</option>
                              <option value="iris">中心扩散 (Iris)</option>
                              <option value="slide">平滑推入 (Push)</option>
                              <option value="slide_up">垂直推开 (Slide Up)</option>
                              <option value="zoom">专业缩放 (Zoom)</option>
                              <option value="wipe">硬核擦除 (Wipe)</option>
                              <option value="cube">立体旋转 (Cube)</option>
                              <option value="glitch">故障艺术 (Glitch)</option>
                              <option value="flip">水平翻转 (Flip)</option>
                            </select>
                          </Field>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                        <Button appearance="subtle" style={{ color: '#FF3B30', height: 36 }} onClick={() => { setTimeline(p => p.filter(t => !selectedIds.has(t.id))); setSelectedIds(new Set()); }}>🗑️ 从轨道移除素材</Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <Text weight="bold" style={{ color: '#C084FC', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>🎵 音频实验室</span>
                        {selectedAudioIds.size > 1 && (
                          <span style={{ fontSize: 11, background: '#10B981', color: '#fff', padding: '4px 10px', borderRadius: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)', transition: 'all 0.2s' }} className="ios-hover-scale" onClick={stitchSelectedAudioGaps}>🧲 缝合所选残片</span>
                        )}
                      </Text>
                      <div className="ios-prop-group" style={{ padding: '16px', borderRadius: 16, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                        <Field label={`播放音量: ${Math.round((audioItems.find(a => selectedAudioIds.has(a.id))?.volume || 1) * 100)}%`}>
                          <div style={{ width: '100%', minWidth: 0 }}>
                            <Slider style={{ width: '100%', maxWidth: '100%' }} min={0} max={2} step={0.1} value={audioItems.find(a => selectedAudioIds.has(a.id))?.volume || 1} onChange={(_e, d) => selectedAudioIds.forEach(id => updateAudioItem(id, { volume: d.value }))} />
                          </div>
                        </Field>
                        {/* 淡入淡出控制 (任务7) */}
                        <Field label={`淡入: ${(audioItems.find(a => selectedAudioIds.has(a.id))?.fadeIn || 0).toFixed(1)}s`}>
                          <div style={{ width: '100%', minWidth: 0 }}>
                            <Slider style={{ width: '100%', maxWidth: '100%' }} min={0} max={5} step={0.1} value={audioItems.find(a => selectedAudioIds.has(a.id))?.fadeIn || 0} onChange={(_e, d) => selectedAudioIds.forEach(id => updateAudioItem(id, { fadeIn: d.value }))} />
                          </div>
                        </Field>
                        <Field label={`淡出: ${(audioItems.find(a => selectedAudioIds.has(a.id))?.fadeOut || 0).toFixed(1)}s`}>
                          <div style={{ width: '100%', minWidth: 0 }}>
                            <Slider style={{ width: '100%', maxWidth: '100%' }} min={0} max={5} step={0.1} value={audioItems.find(a => selectedAudioIds.has(a.id))?.fadeOut || 0} onChange={(_e, d) => selectedAudioIds.forEach(id => updateAudioItem(id, { fadeOut: d.value }))} />
                          </div>
                        </Field>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                          <Button
                            appearance={isEditingAudio ? "primary" : "outline"}
                            size="small"
                            style={{ height: 34, borderRadius: 8, fontSize: 12 }}
                            onClick={() => setIsEditingAudio(!isEditingAudio)}
                            disabled={selectedAudioIds.size > 1}
                          >
                            {isEditingAudio ? "✅ 正在剪辑" : "✂️ 剪辑模式"}
                          </Button>
                          {(isEditingAudio && selectedAudioIds.size === 1) && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Button size="small" style={{ flex: 1 }} onClick={() => {
                                const id = Array.from(selectedAudioIds)[0];
                                const item = audioItems.find(a => a.id === id);
                                if (item) {
                                  const boundaries = [0, ...(item.cutPoints || []).sort((a, b) => a - b), item.duration];
                                  const allIndices = boundaries.slice(0, -1).map((_, i) => i);
                                  const selected = new Set(item.selectedRegions || []);
                                  updateAudioItem(id, { selectedRegions: allIndices.filter(i => !selected.has(i)) });
                                }
                              }}>反选</Button>
                              <Button size="small" appearance="subtle" style={{ flex: 1 }} onClick={() => executeAudioCut(Array.from(selectedAudioIds)[0])}>确认剪除</Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button appearance="primary" style={{ marginTop: 20, background: 'rgba(255,59,48,0.15)', color: '#FF453A', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 10, height: 44, fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(255,59,48,0.1)' }} onClick={() => { setAudioItems(p => p.filter(a => !selectedAudioIds.has(a.id))); setSelectedAudioIds(new Set()); setIsEditingAudio(false); }}>🗑️ 从项目彻底移除选定音频</Button>
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 20, alignItems: 'center' }}>
                    <div style={{ fontSize: 36, opacity: 0.15 }}>📷</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.8 }}>
                      在轨道中选择片段获取效果选项
                    </div>
                    {timeline.length === 0 && (
                      <div style={{ marginTop: 8, padding: '10px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
                          💡 <strong style={{ color: 'rgba(255,255,255,0.7)' }}>快速开始</strong><br/>
                          1. 左侧 《照片》 Tab 导入素材<br/>
                          2. 单击卡片 → 添加到轨道<br/>
                          3. 直接拖放文件到窗口也可导入
                        </div>
                        <div
                          style={{ marginTop: 10, padding: '6px 0', textAlign: 'center', fontSize: 11, color: 'var(--ios-indigo)', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => { setShowGlobalDefaults(true); setShowExportPanel(false); }}
                        >⚙️ 配置全局默认参数</div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

                  {/* 一键导出预设 */}
                  <div className="ios-prop-group">
                    <Text weight="bold" style={{ color: '#10B981', fontSize: 13, marginBottom: 8, display: 'block' }}>⚡ 快捷导出预设</Text>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { name: '📱 抖音/快手', fmt: 'mp4', res: '1080p', fps: '60', codec: 'h264', quality: 'high' as const },
                        { name: '🅱️ B站高清', fmt: 'mp4', res: '1080p', fps: '60', codec: 'h264', quality: 'high' as const },
                        { name: '🎬 Apple ProRes', fmt: 'mov', res: 'original', fps: '60', codec: 'h265', quality: 'lossless' as const },
                        { name: '📺 4K HDR', fmt: 'mp4', res: '4k', fps: '60', codec: 'h265', quality: 'lossless' as const },
                      ].map(preset => (
                        <div
                          key={preset.name}
                          className="filter-preset-card"
                          onClick={() => {
                            setExportFormat(preset.fmt as any);
                            setExportResolution(preset.res as any);
                            setExportFps(preset.fps as any);
                            setExportCodec(preset.codec as any);
                            setExportQuality(preset.quality);
                            if (preset.codec === 'h265' && preset.name.includes('HDR')) setExportHdr(true);
                            setStatusMsg(`✅ 已应用「${preset.name}」预设`); setTimeout(() => setStatusMsg(''), 1500);
                          }}
                        >{preset.name}</div>
                      ))}
                    </div>
                  </div>

                  <div className="ios-prop-group" style={{ marginTop: 0 }}>
                    <Text weight="bold" style={{ color: 'var(--ios-indigo)', fontSize: 13, marginBottom: 12, display: 'block' }}>🎬 输出格式与帧率</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Field label="封装格式">
                        <select className="ios-dark-select" value={exportFormat} onChange={e => setExportFormat(e.target.value as any)}>
                          <option value="mp4">MP4 (通用媒体容器)</option>
                          <option value="mov">MOV (Apple 专业容器)</option>
                        </select>
                      </Field>
                      <Field label="编码标准 (Codec)">
                        <select className="ios-dark-select" value={exportCodec} onChange={e => setExportCodec(e.target.value as any)}>
                          <option value="h264">H.264 / AVC (最强兼容性)</option>
                          <option value="h265">H.265 / HEVC (极致压缩 & 4K 推荐)</option>
                        </select>
                      </Field>
                      <Field label="HDR 10-bit & 杜比色彩空间 (只支持 H.265)">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                          <input
                            type="checkbox"
                            checked={exportHdr}
                            disabled={exportCodec !== 'h265'}
                            onChange={e => setExportHdr(e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: 'var(--ios-indigo)', cursor: exportCodec === 'h265' ? 'pointer' : 'not-allowed' }}
                          />
                          <Text style={{ fontSize: 13, opacity: exportCodec === 'h265' ? 0.8 : 0.3 }}>
                            开启高动态范围 (BT.2020 PQ) {exportCodec !== 'h265' && "(请先切换编码为 H.265)"}
                          </Text>
                        </div>
                      </Field>
                      <Field label="帧速率 (FPS)">
                        <select className="ios-dark-select" value={exportFps} onChange={e => setExportFps(e.target.value as any)}>
                          <option value="30">30 FPS (标准电影感)</option>
                          <option value="60">60 FPS (丝滑高刷无拖影)</option>
                        </select>
                      </Field>
                    </div>
                  </div>

                  <div className="ios-prop-group">
                    <Text weight="bold" style={{ color: '#F59E0B', fontSize: 13, marginBottom: 12, display: 'block' }}>👁️‍🗨️ 画质极限控制</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Field label="输出分辨率">
                        <select className="ios-dark-select" value={exportResolution} onChange={e => setExportResolution(e.target.value as any)}>
                          <option value="original">🔰 原尺寸装配 (100% 不缩放超清)</option>
                          <option value="4k">4K 标准 (3840x2160)</option>
                          <option value="1080p">1080P 全高清 (1920x1080)</option>
                        </select>
                      </Field>
                      <Field label="渲染画质 (CRF Engine)">
                        <select className="ios-dark-select" value={exportQuality} onChange={e => setExportQuality(e.target.value as any)}>
                          <option value="lossless">💎 无损直出 (-crf 10, 体积大极清晰)</option>
                          <option value="high">✨ 专业高画质 (-crf 15, 清晰度优先)</option>
                          <option value="medium">📱 互联网传播 (-crf 23, 体积最优)</option>
                        </select>
                      </Field>
                    </div>
                  </div>

                  <Button
                    appearance="primary"
                    size="large"
                    style={{
                      marginTop: 16, height: 48, borderRadius: 12,
                      background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                      boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3), inset 0 1px 1px rgba(255,255,255,0.2)',
                      fontWeight: 600, fontSize: 13, border: 'none',
                      transition: 'all 0.3s ease'
                    }}
                    className="ios-hover-scale"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? '正在拼尽全力导出...' : '开始执行极速渲染'}
                  </Button>

                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM ZONE */}
        <div className="glass-panel ios-timeline">
          <div
            className="panel-header-ios"
            style={{ height: 30, padding: '0 12px', background: 'rgba(0,0,0,0.1)', cursor: 'pointer' }}
            onDoubleClick={() => { setPlayTime(0); setIsPlaying(false); setStatusMsg(' ⏮ 跳至开头'); setTimeout(() => setStatusMsg(''), 1000); }}
            onClick={handleTripleClickZone}
            title="双击归零"
          >
            <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              {playTime.toFixed(2)}s / {maxPlayTime.toFixed(2)}s
            </span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Button size="small" appearance="subtle" style={{ fontSize: 10, padding: '0 4px', height: 24 }} onClick={(e) => { e.stopPropagation(); splitAtPlayhead(); }} title="Ctrl+B 分割">✂️</Button>
              <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
              <div className="zoom-control" onClick={e => e.stopPropagation()}>
                <span>🔍</span>
                <input type="range" min={8} max={120} value={pps} onChange={e => setPps(Number(e.target.value))} />
                <span>{Math.round(pps / 24 * 100)}%</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
              <Button size="small" appearance="subtle" style={{ fontSize: 10, padding: '0 4px', height: 24 }} onClick={(e) => { e.stopPropagation(); pushSnapshot(); setTimeline([]); setAudioItems([]); }}>清空</Button>
            </div>
          </div>

          <div
            ref={timelineScrollRef}
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              position: 'relative',
              cursor: 'default',
              background: 'rgba(0,0,0,0.2)'
            }}
            onMouseMove={handleTimelineMouseMove}
            onMouseUp={handleTimelineMouseUp}
            onMouseLeave={handleTimelineMouseUp}
            onWheel={handleTimelineWheel}
          >
            {/* 1. 时间刻度尺 (Time Ruler) - 专用导航区 */}
            <div
              className="ios-time-ruler"
              style={{ width: timelineWidth }}
              onMouseDown={(e) => {
                e.stopPropagation(); // 阻止背景框选触发
                seekToX(e.clientX);
                setIsDraggingHead(true);
                const onMove = (me: MouseEvent) => seekToX(me.clientX);
                const onUp = () => {
                  setIsDraggingHead(false);
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                seekToX(e.clientX);
                setIsJumping(true);
                setTimeout(() => setIsJumping(false), 300); // 0.3s 后恢复无动画状态
              }}
            >
              {/* 渲染刻度线 - 自适应密度 */}
              {(() => {
                // 根据 pps 动态选择刻度间距
                let tickStep = 1;
                if (pps < 15) tickStep = 5;
                else if (pps < 30) tickStep = 2;
                else if (pps > 80) tickStep = 0.5;
                const totalTicks = Math.ceil(maxPlayTime / tickStep) + 1;
                // 精确计算每个刻度的像素位置（考虑 gap）
                const getTickX = (time: number) => {
                  let accDur = 0, accX = 0;
                  for (let i = 0; i < timeline.length; i++) {
                    const d = timeline[i].duration;
                    if (time <= accDur + d) {
                      return 60 + accX + (time - accDur) * pps;
                    }
                    accDur += d;
                    accX += d * pps + 4;
                  }
                  return 60 + accX + (time - accDur) * pps;
                };
                return Array.from({ length: totalTicks }).map((_, i) => {
                  const t = i * tickStep;
                  if (t > maxPlayTime + tickStep) return null;
                  const x = getTickX(t);
                  const isMajor = t % (tickStep >= 1 ? 5 : 1) === 0;
                  return (
                    <div key={i} style={{ position: 'relative' }}>
                      <div
                        className={`ruler-tick ${isMajor ? 'major' : ''}`}
                        style={{ left: x }}
                      />
                      {isMajor && (
                        <div className="ruler-label" style={{ left: x }}>
                          {t >= 60 ? `${Math.floor(t/60)}:${(t%60).toString().padStart(2,'0')}` : `${t}s`}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* 播放指针 (三角形拓展抓手 + 加大热区) */}
            <div
              ref={playheadRef}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 1,
                zIndex: 800,
                transform: `translateX(${playLineLeft}px)`,
                transition: isJumping ? 'transform 0.3s ease-out' : ((isPlaying || isDraggingHead) ? 'none' : 'transform 0.1s linear'),
                pointerEvents: 'none',
              }}
            >
              {/* 三角形头部抓手 */}
              <div style={{
                position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
                borderTop: '10px solid var(--ios-indigo)',
                filter: 'drop-shadow(0 2px 4px rgba(99,102,241,0.5))',
                pointerEvents: 'auto', cursor: 'grab',
                zIndex: 810,
              }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsDraggingHead(true);
                  document.body.style.cursor = 'grabbing';
                  document.body.style.userSelect = 'none';
                  const onMove = (me: MouseEvent) => { me.preventDefault(); seekToX(me.clientX); };
                  const onUp = () => {
                    setIsDraggingHead(false);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              />
              {/* 竖线 */}
              <div style={{
                position: 'absolute', top: 8, bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: 2, background: 'var(--ios-indigo)',
                boxShadow: '0 0 8px var(--ios-indigo-glow)',
                borderRadius: 1,
              }} />
              {/* 透明宽热区 (20px 宽可点击拖拽) */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: 20, cursor: 'grab', pointerEvents: 'auto',
              }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsDraggingHead(true);
                  document.body.style.cursor = 'grabbing';
                  document.body.style.userSelect = 'none';
                  const onMove = (me: MouseEvent) => { me.preventDefault(); seekToX(me.clientX); };
                  const onUp = () => {
                    setIsDraggingHead(false);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              />
            </div>

            <div
              style={{
                width: timelineWidth,
                padding: '10px 0 10px 0',
                position: 'relative',
                marginTop: 0
              }}
              onMouseDown={(e) => {
                // 只有点击背景（非元素）时才触发框选
                if (e.button === 0 && e.currentTarget === e.target) {
                  if (e.ctrlKey) {
                    const rect = timelineScrollRef.current?.getBoundingClientRect();
                    if (rect) {
                      const startX = e.clientX - rect.left + timelineScrollRef.current!.scrollLeft;
                      setSelectionBox({ x1: startX, x2: startX, y: 0, h: 370 });
                    }
                  } else {
                    setSelectedIds(new Set());
                    setSelectedAudioIds(new Set());
                  }
                }
              }}
            >
              {selectionBox && (
                <div
                  className="ios-selection-box"
                  style={{
                    left: Math.min(selectionBox.x1, selectionBox.x2),
                    width: Math.abs(selectionBox.x2 - selectionBox.x1),
                    top: 10,
                    height: 250
                  }}
                />
              )}
              <div style={{ display: 'flex', alignItems: 'center', height: 210, marginBottom: 8 }}>
                <div style={{ width: 60, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 900, opacity: 0.5 }}>图片</div>
                {timeline.length === 0 && (
                  <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.18)', fontSize: 12, border: '1.5px dashed rgba(255,255,255,0.07)', borderRadius: 12, margin: '0 4px', userSelect: 'none' }}>
                    <span style={{ fontSize: 24, opacity: 0.5 }}>📷</span>
                    <span>将照片/视频拖入此处，或在左侧导入并点击卡片添加</span>
                  </div>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToParentElement, restrictToHorizontalAxis]} onDragEnd={(e) => {
                  const { active, over } = e;
                  // 拖动后自动标记为手动排序
                  if (over && active.id !== over.id && sortMode !== 'manual') {
                    setSortMode('manual');
                    setStatusMsg('✋ 拖动后已切换为手动排序'); setTimeout(() => setStatusMsg(''), 1500);
                  }
                  if (over && active.id !== over.id) setTimeline(items => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id)));
                }}>
                  <div style={{ display: 'flex', gap: 4, height: '100%' }}>
                    <SortableContext items={timeline.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                      {timeline.map((item, _idx) => {
                        const isMulti = selectedIds.size > 1 && selectedIds.has(item.id);
                        // 计算多选序号（在选中集合中的出现顺序）
                        const multiIdx = isMulti ? Array.from(selectedIds).indexOf(item.id) : undefined;
                        return (
                        <SortableImageCard
                          key={item.id} item={item} resource={resourceMap.get(item.resourceId)}
                          isSelected={selectedIds.has(item.id)}
                          isMultiSelected={isMulti}
                          multiSelectIndex={multiIdx}
                          onSelect={handleTimelineSelect}
                          onRemove={handleTimelineRemove}
                          pps={pps} previewUrl={previewCache[resourceMap.get(item.resourceId)?.path || '']}
                          onContextMenu={(e) => handleTimelineContextMenu(e, item.id)}
                          onTrimDuration={handleTimelineTrim}
                          onDoubleClickCard={() => handleTimelineDoubleClick(item.id)}
                        />
                        );
                      })}
                    </SortableContext>
                  </div>
                </DndContext>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', height: 70, marginTop: 0 }}>
                <div style={{ width: 60, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 900, opacity: 0.5 }}>音频</div>
                <div style={{ position: 'relative', flex: 1, height: 70, overflow: 'visible' }}>
                  {audioItems.map(item => {
                    const isItPlaying = isPlaying && playTime >= item.timelineStart && playTime < (item.timelineStart + item.duration);
                    return (
                      <AudioTrackItem
                        key={item.id}
                        item={item}
                        resource={resourceMap.get(item.resourceId)}
                        isSelected={selectedAudioIds.has(item.id)}
                        onSelect={handleAudioSelect}
                        pps={pps}
                        isPlaying={isItPlaying}
                        editingMode={isEditingAudio && selectedAudioIds.has(item.id)}
                        onUpdateItem={updateAudioItem}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </FluentProvider >
  );
}

export default App;
