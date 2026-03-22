import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
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
import { convertFileSrc } from '@tauri-apps/api/core';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import "./App.css";
import "./Win11Theme.css";

// ─── 类型定义 ────────────────────────────────────────────────────────
interface Resource { id: string; name: string; path: string; type: 'image' | 'audio' | 'video' }

interface AudioTimelineItem {
  id: string;
  resourceId: string;
  timelineStart: number;
  startOffset: number;
  duration: number;
  volume: number;
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
  cropPos?: Crop;
}

// ─── 媒体特征无损高速探测引擎 ───────────────────────────────────────────────────
const getMediaDuration = (path: string): Promise<number> => {
  return new Promise((resolve) => {
    const isHttp = path.startsWith('http');
    const url = isHttp ? path : convertFileSrc(path);
    const media = new Audio();
    media.crossOrigin = 'anonymous'; // 破除 CORS 封锁
    media.preload = 'metadata';

    const timeout = setTimeout(() => {
      media.src = '';
      resolve(10);
    }, 5000);

    media.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve(media.duration || 10);
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


// ─── 性能优化：缩略图生成引擎 ──────────────────────────────────────
const THUMB_WIDTH = 200; // 缩略图最大宽度
const thumbCache = new Map<string, string>(); // path -> blobUrl

const generateThumbnail = (srcUrl: string): Promise<string> => {
  if (thumbCache.has(srcUrl)) return Promise.resolve(thumbCache.get(srcUrl)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = THUMB_WIDTH / img.naturalWidth;
      const w = THUMB_WIDTH;
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          thumbCache.set(srcUrl, url);
          resolve(url);
        } else {
          resolve(srcUrl); // fallback to original
        }
      }, 'image/webp', 0.7);
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
};

// ─── 子组件: 极简图片卡片 ──────────────────────────────────────────
const SortableImageCard = memo(function SortableImageCard({
  item, resource, isSelected, onSelect, onRemove, pps, previewUrl, onContextMenu, onTrimDuration, onDoubleClickCard
}: {
  item: TimelineItem; resource?: Resource; isSelected: boolean; onSelect: (id: string, isCtrl: boolean) => void; onRemove: (id: string) => void; pps: number; previewUrl?: string; onContextMenu?: (e: React.MouseEvent) => void; onTrimDuration?: (id: string, delta: number) => void; onDoubleClickCard?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useSortable({ id: item.id });
  const [isHovered, setIsHovered] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  // 性能优化：异步生成缩略图，时间轴只显示小图
  useEffect(() => {
    const src = previewUrl
      ? (previewUrl.startsWith('http') || previewUrl.startsWith('blob:') ? previewUrl : convertFileSrc(previewUrl))
      : resource ? convertFileSrc(resource.path) : '';
    if (!src) return;
    generateThumbnail(src).then(setThumbUrl);
  }, [resource?.path, previewUrl]);

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
      ref={setNodeRef}
      className={`ios-btn-hover ${isSelected ? 'ios-selected' : ''}`}
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
        background: 'rgba(0,0,0,0.5)',
        border: isSelected ? '2px solid rgba(94, 92, 230, 0.8)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isSelected ? '0 10px 25px rgba(94,92,230,0.4), inset 0 0 10px rgba(255,255,255,0.05)' : 'none',
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
      {resource ? <img src={imgSrc} style={thumbStyle} alt="" /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#ef4444' }}>缺失</div>}

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
const ResourceCardItem = memo(({ res, isAdded, isChecked, onToggle, onSelectPreview, onAdd, onRemove, onConvert, onReveal, previewUrl }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // 识别原始 DNG (未转码)
  const isDNG = res.path.toLowerCase().endsWith('.dng');
  const hasPreview = !!previewUrl;

  const displaySrc = useMemo(() => {
    if (previewUrl) {
      return (previewUrl.startsWith('http') || previewUrl.startsWith('blob:') ? previewUrl : convertFileSrc(previewUrl));
    }
    if (res.type === 'image') {
      return convertFileSrc(res.path);
    }
    return '';
  }, [res, previewUrl]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 14, padding: '6px 4px 6px 8px',
        background: isChecked ? 'rgba(255, 255, 255, 0.05)' : (isHovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent'),
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
      onClick={() => onSelectPreview(res)}
      onDoubleClick={() => onToggle(res.id)}
    >
      {/* 极简左侧修饰线 (选中时发光) */}
      <div style={{
        position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 2, borderRadius: 1,
        background: isChecked ? '#fff' : 'transparent',
        boxShadow: isChecked ? '0 0 10px rgba(255,255,255,0.8)' : 'none',
        transition: 'all 0.3s',
        opacity: isChecked ? 1 : 0
      }} />

      {/* 图片容器撑大拉长，采用类似 16:9 画幅 */}
      <div style={{
        width: 76, height: 46, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
        background: '#151515', display: 'flex', justifyContent: 'center', alignItems: 'center',
        boxShadow: isHovered ? '0 6px 16px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        transition: 'transform 0.5s ease-out, box-shadow 0.5s ease-out',
        transform: isHovered && !isChecked ? 'scale(1.02)' : 'scale(1)',
        position: 'relative'
      }}>
        {res.type === 'image' ? (
          displaySrc ? (
            <img src={displaySrc} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isDNG ? 0.6 : 1 }} alt="" />
          ) : (
            <div style={{ fontSize: 10, opacity: 0.3, color: '#fff' }}>...</div>
          )
        ) : (
          <div style={{ fontSize: 16, opacity: 0.8, color: '#fff' }}>🎵</div>
        )}

        {/* DNG 专供：浮窗式转换按钮 */}
        {isDNG && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', opacity: isHovered ? 1 : (hasPreview ? 0 : 0.8),
            transition: 'opacity 0.3s'
          }}>
            {!hasPreview && (
              <Button
                size="small"
                appearance="primary"
                disabled={isConverting}
                style={{
                  fontSize: 10, padding: '0 8px', height: 24, borderRadius: 4,
                  background: 'var(--ios-indigo)', border: 'none', fontWeight: 600, color: '#fff'
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsConverting(true);
                  await onConvert(res.id);
                  setIsConverting(false);
                }}
              >
                {isConverting ? '转换中...' : '高清转换'}
              </Button>
            )}

            <Button
              size="small"
              appearance="subtle"
              style={{
                fontSize: 10, padding: '0 8px', height: 24, borderRadius: 4,
                background: 'rgba(255,255,255,0.1)', border: 'none', fontWeight: 600, color: '#fff'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onReveal(res.id);
              }}
            >
              📂 定位文件
            </Button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 4 }}>
        <div style={{
          fontSize: 13, fontWeight: isChecked ? 500 : 300,
          color: isChecked ? '#fff' : 'rgba(255,255,255,0.85)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: 0.5,
          fontFamily: 'Inter, -apple-system, sans-serif'
        }}>{res.name}</div>
        <div style={{
          fontSize: 9, fontWeight: 400, color: isDNG ? 'var(--ios-indigo)' : 'rgba(255,255,255,0.35)', letterSpacing: 2.0
        }}>{isDNG ? 'RAW / DNG' : (res.type === 'image' ? 'IMAGE' : 'AUDIO')}</div>
      </div>

      {/* 操作区：带左偏渐变羽化的融合停靠带，右移精校，消除按钮割裂感 */}
      <div style={{
        display: 'flex', gap: 6, alignItems: 'center', padding: '6px 4px 6px 20px',
        position: 'absolute', right: 0, top: 0, bottom: 0,
        background: 'linear-gradient(to right, transparent 0%, rgba(20,20,20,0.6) 30%, rgba(20,20,20,0.9) 100%)',
        backdropFilter: isHovered ? 'blur(2px)' : 'none',
        WebkitBackdropFilter: isHovered ? 'blur(2px)' : 'none',
        opacity: (isHovered || isChecked || isAdded) ? 1 : 0,
        transform: (isHovered || isChecked || isAdded) ? 'translateX(0)' : 'translateX(10px)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <Button
          icon={<span style={{ fontWeight: 500, fontSize: 13 }}>{isAdded ? '✔' : '+'}</span>}
          size="small"
          style={{
            width: 30, height: 30, padding: 0, minWidth: 0, borderRadius: 8,
            background: isAdded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
            color: isAdded ? '#fff' : 'rgba(255,255,255,0.6)',
            border: isAdded ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isAdded ? '0 0 12px rgba(255,255,255,0.1)' : 'none',
            transition: 'all 0.3s'
          }}
          onClick={e => { e.stopPropagation(); onAdd(res); }}
          title={isAdded ? "已添加" : "添加轨道"}
        />
        <Button
          icon={<span style={{ fontSize: 13, fontWeight: 300 }}>×</span>}
          size="small" appearance="subtle"
          style={{
            width: 30, height: 30, padding: 0, minWidth: 0, borderRadius: 8,
            color: 'rgba(255,255,255,0.4)', background: 'transparent',
            transition: 'color 0.2s',
          }}
          onClick={e => { e.stopPropagation(); onRemove(res.id); }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FF3B30')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          title="移除文件"
        />
      </div>
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
  const [libTab, setLibTab] = useState<'image' | 'audio'>('image');

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

  // 监听退出全屏
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
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
    { name: '🔄 重置', exposure: 1.0, contrast: 1.0, saturation: 1.0, temp: 0, tint: 0, brilliance: 1.0 },
  ], []);


  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null); // 指针 DOM 引用
  const timeTextRef = useRef<HTMLSpanElement>(null); // 时间文字 DOM 引用
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
  // 性能优化：已添加资源 ID 集合 (替代 timeline.some() + audioItems.some())
  const addedResourceIds = useMemo(() => new Set([...timeline.map(t => t.resourceId), ...audioItems.map(a => a.resourceId)]), [timeline, audioItems]);

  // 1. 自动资源预热引擎 (CORS Blob Bypass)
  useEffect(() => {
    resources.filter(r => r.type === 'audio' && r.path.startsWith('http')).forEach(res => {
      if (audioBlobs[res.id]) return;
      fetch(res.path, { mode: 'cors' })
        .then(r => r.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setAudioBlobs(prev => ({ ...prev, [res.id]: url }));
        })
        .catch(e => console.error(`Failed to fetch audio blob for ${res.name}`, e));
    });
  }, [resources, audioBlobs]);

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
    return Math.max(maxT, maxA);
  }, [timeline, audioItems]);

  // 精确计算 playLine 的左边距。修复 `gap: 4px` 造成的误差
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

  // 1. 核心：高性能播放引擎 (RequestAnimationFrame + DOM 脱钩)
  useEffect(() => {
    if (!isPlaying) return;

    let rafId: number;
    const startTs = performance.now();
    const baseTime = playTime;

    const tick = () => {
      const elapsed = (performance.now() - startTs) / 1000 * playbackSpeed;
      const currentT = baseTime + elapsed;

      if (currentT >= maxPlayTime && maxPlayTime > 0) {
        setPlayTime(maxPlayTime);
        setIsPlaying(false);
        return;
      }

      // 直接操作 DOM，绕过 React 重绘
      if (playheadRef.current) {
        // 计算左边距 (逻辑与 playLineLeft 一致)
        let accX = 0;
        let accDur = 0;
        let found = false;
        for (let i = 0; i < timeline.length; i++) {
          const itemDur = timeline[i].duration;
          if (currentT >= accDur && currentT < accDur + itemDur) {
            accX += (currentT - accDur) * pps;
            found = true;
            break;
          }
          accDur += itemDur;
          accX += (itemDur * pps) + 4;
        }
        if (!found) {
          const overflowDur = currentT - accDur;
          accX += (overflowDur * pps) - (timeline.length > 0 ? 4 : 0);
        }
        playheadRef.current.style.transform = `translateX(${60 + accX}px)`;

        // 播放时自动滚动时间轴跟踪播放头
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

      // 每隔 1s 同步一次状态，保证暂停时位置准确，但不产生高频压力
      if (performance.now() - lastSyncTimeRef.current > 1000) {
        setPlayTime(currentT);
        lastSyncTimeRef.current = performance.now();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      // 停止时强制同步一次最终位置
      const finalElapsed = (performance.now() - startTs) / 1000;
      setPlayTime(baseTime + finalElapsed);
    };
  }, [isPlaying, maxPlayTime, timeline, pps, playbackSpeed]);

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

        const playPath = audioBlobs[res.id] || (res.path.startsWith('http') ? res.path : convertFileSrc(res.path));

        let audio = audioElsRef.current[item.id];
        if (!audio || (audio.src !== playPath && !audio.src.startsWith('blob:'))) {
          if (audio) { audio.pause(); audio.src = ""; }
          audio = new Audio();
          audio.crossOrigin = 'anonymous';
          audio.preload = 'auto';
          audio.src = playPath;
          audioElsRef.current[item.id] = audio;
        }

        const itemEnd = item.timelineStart + item.duration;
        const targetPos = item.startOffset + (currentPlayTime - item.timelineStart);

        if (currentPlayTime >= item.timelineStart && currentPlayTime < itemEnd) {
          if (audio.paused) {
            audio.currentTime = targetPos;
            audio.volume = item.volume ?? 1.0;
            const p = audio.play();
            if (p) p.catch(() => { });
          } else {
            if (Math.abs(audio.currentTime - targetPos) > 0.15) {
              audio.currentTime = targetPos;
            }
            if (audio.volume !== (item.volume ?? 1.0)) {
              audio.volume = item.volume ?? 1.0;
            }
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
    setTimeline(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, [key]: val } : t));
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
    setPlayTime(Math.max(0, targetTime));
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

  const handleImport = async (type: 'image' | 'audio') => {
    const selected = await open({
      multiple: true,
      filters: [{
        name: type === 'image' ? '图片' : '音频',
        extensions: type === 'image' ? ['png', 'jpg', 'jpeg', 'webp', 'dng', 'DNG'] : ['mp3', 'wav', 'm4a']
      }]
    });
    if (selected && Array.isArray(selected)) {
      const newResources: Resource[] = (selected as any[]).map(rawSelected => {
        const path = typeof rawSelected === 'string' ? rawSelected : rawSelected.path;
        return {
          id: `res_${Date.now()}_${Math.random()}`,
          name: path.split(/[\\/]/).pop() || '',
          path,
          type
        };
      });
      setResources(prev => [...prev, ...newResources]);
      setLibTab(type);
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

  const removeFromLibrary = (id: string | Set<string>) => {
    const ids = typeof id === 'string' ? new Set([id]) : id;
    setResources(prev => prev.filter(r => !ids.has(r.id)));
    setTimeline(prev => prev.filter(t => !ids.has(t.resourceId)));
    setAudioItems(prev => prev.filter(a => !ids.has(a.resourceId)));
    setSelectedResourceIds(new Set());
  };

  const selectedItem = useMemo(() => timeline.find(t => selectedIds.has(t.id)), [timeline, selectedIds]);

  const monitorSrc = useMemo(() => {
    if ((isPlaying || playTime > 0) && timeline.length > 0) {
      let acc = 0;
      for (const t of timeline) {
        if (playTime >= acc && playTime < acc + t.duration) {
          const res = resourceMap.get(t.resourceId);
          return res ? { ...res, currentItem: t, src: getEffectiveSrc(res.path) } : null;
        }
        acc += t.duration;
      }
    }
    return monitorRes ? { ...monitorRes, currentItem: null, src: getEffectiveSrc(monitorRes.path) } : null;
  }, [isPlaying, playTime, timeline, resources, monitorRes, previewCache]);

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

  // 性能优化：memo 化计算，避免每次渲染重算
  const maxVideoEnd = useMemo(() => timeline.reduce((acc, t) => acc + t.duration, 0), [timeline]);
  const maxAudioEnd = useMemo(() => audioItems.length > 0 ? Math.max(...audioItems.map(a => a.timelineStart + a.duration)) : 0, [audioItems]);
  const maxTime = useMemo(() => Math.max(maxVideoEnd, maxAudioEnd, playTime), [maxVideoEnd, maxAudioEnd, playTime]);
  const timelineWidth = useMemo(() => Math.max(8000, maxTime * pps + 1000), [maxTime, pps]);

  return (
    <FluentProvider theme={webDarkTheme} style={{ height: '100vh', width: '100vw', background: 'transparent' }}>
      <div className={`ios-layout ${theme === 'win11' ? 'theme-win11' : ''}`} onClick={() => { setContextMenu(null); setShowShortcuts(false); }}>

        {/* 主题切换按钮 */}
        <button
          className="theme-switch-btn"
          onClick={(e) => {
            e.stopPropagation();
            const next = theme === 'ios' ? 'win11' : 'ios';
            setTheme(next);
            localStorage.setItem('__editor_theme__', next);
          }}
        >
          <span className="icon">{theme === 'ios' ? '🍃' : '🪩'}</span>
          {theme === 'ios' ? 'iOS 26' : 'Win11'}
        </button>

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


        {/* TOP ZONE: Sidebars + Monitor */}
        <div style={{ flex: 1, display: 'flex', gap: 24, minHeight: 0 }}>

          {/* 1. 素材库 (图片库/音乐库 双 Tab) */}
          <div className="glass-panel" style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            {/* 高级质感控制台头部 */}
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--ios-hairline)', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 第一排：库切换 & 导入按钮 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 3, width: 150, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
                  <div
                    onClick={() => setLibTab('image')}
                    style={{ flex: 1, textAlign: 'center', padding: '6px 0', background: libTab === 'image' ? 'rgba(255,255,255,0.15)' : 'transparent', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: libTab === 'image' ? 600 : 400, color: libTab === 'image' ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)', boxShadow: libTab === 'image' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                  >
                    图片库
                  </div>
                  <div
                    onClick={() => setLibTab('audio')}
                    style={{ flex: 1, textAlign: 'center', padding: '6px 0', background: libTab === 'audio' ? 'rgba(255,255,255,0.15)' : 'transparent', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: libTab === 'audio' ? 600 : 400, color: libTab === 'audio' ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)', boxShadow: libTab === 'audio' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                  >
                    音乐库
                  </div>
                </div>
                <Button
                  appearance="primary"
                  style={{ borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', height: 32, fontSize: 12, fontWeight: 600, padding: '0 12px', backdropFilter: 'blur(10px)', color: '#fff' }}
                  onClick={() => handleImport(libTab)}
                >
                  <span style={{ marginRight: 4 }}>+</span> 导入素材
                </Button>
              </div>

              {/* 搜索框 */}
              <Input
                value={searchQuery}
                onChange={(_e, data) => setSearchQuery(data.value)}
                placeholder="🔍 搜索素材..."
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
              />

              {/* 第二排：操作栏按逻辑顺序排列 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button size="small" appearance="subtle" style={{ borderRadius: 8, fontSize: 12, padding: '0 8px', color: 'rgba(255,255,255,0.8)' }} onClick={() => {
                  const allIds = filteredResources.map(r => r.id);
                  if (selectedResourceIds.size === allIds.length && allIds.length > 0) {
                    setSelectedResourceIds(new Set());
                  } else {
                    setSelectedResourceIds(new Set(allIds));
                  }
                }}>
                  {filteredResources.length > 0 && selectedResourceIds.size === filteredResources.length ? '反选' : '全选'}
                </Button>

                <Button appearance="primary" size="small" disabled={selectedResourceIds.size === 0} style={{ flex: 1, borderRadius: 8, background: selectedResourceIds.size > 0 ? 'var(--ios-indigo)' : 'rgba(255,255,255,0.05)', color: selectedResourceIds.size > 0 ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: 13, border: 'none' }} onClick={async () => {
                  const selectedList = resources.filter(r => r.type === libTab && selectedResourceIds.has(r.id));
                  for (const r of selectedList) {
                    if (r.type === 'image') {
                      setTimeline(p => [...p, {
                        id: `tm_${Date.now()}_${Math.random()}`,
                        resourceId: r.id,
                        duration: 3,
                        transition: 'fade',
                        rotation: 0,
                        contrast: 1.0,
                        saturation: 1.0,
                        exposure: 1.0,
                        brilliance: 1.0,
                        temp: 0,
                        tint: 0,
                        zoom: 1.0,
                        fontSize: 24,
                        fontWeight: 'normal'
                      }]);
                    } else {
                      const dur = await getMediaDuration(r.path);
                      setAudioItems(prev => {
                        let startPos = 0;
                        if (prev.length > 0) {
                          const last = prev[prev.length - 1];
                          startPos = last.timelineStart + last.duration;
                        }
                        return [...prev, { id: `au_${Date.now()}_${Math.random()}`, resourceId: r.id, timelineStart: startPos, startOffset: 0, duration: dur, volume: 1.0 }];
                      });
                    }
                  }
                  setSelectedResourceIds(new Set());
                }}>
                  {selectedResourceIds.size > 0 ? `+ 编入轨道 ${selectedResourceIds.size} 项` : '+ 批量编入轨道'}
                </Button>

                <Button size="small" appearance="subtle" disabled={selectedResourceIds.size === 0} style={{ borderRadius: 8, minWidth: 32, padding: 0, color: selectedResourceIds.size > 0 ? '#FF3B30' : 'rgba(255,255,255,0.1)' }} onClick={() => removeFromLibrary(selectedResourceIds)}>
                  🗑️
                </Button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredResources.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: 100, opacity: 0.2, fontSize: 12 }}>暂无素材</div>
              ) : (
                filteredResources.map(res => (
                  <ResourceCardItem
                    key={res.id} res={res}
                    isAdded={addedResourceIds.has(res.id)}
                    isChecked={selectedResourceIds.has(res.id)}
                    onToggle={(id: string) => {
                      const n = new Set(selectedResourceIds);
                      n.has(id) ? n.delete(id) : n.add(id);
                      setSelectedResourceIds(n);
                    }}
                    onSelectPreview={(r: Resource) => setMonitorRes(r)}
                    onAdd={async (r: Resource) => {
                      if (r.type === 'image') setTimeline(p => [...p, {
                        id: `tm_${Date.now()}`,
                        resourceId: r.id,
                        duration: 3,
                        transition: 'fade',
                        rotation: 0,
                        contrast: 1.0,
                        saturation: 1.0,
                        exposure: 1.0,
                        brilliance: 1.0,
                        temp: 0,
                        tint: 0,
                        zoom: 1.0,
                        fontSize: 24,
                        fontWeight: 'normal'
                      }]);
                      else {
                        const dur = await getMediaDuration(r.path);
                        setAudioItems(prev => {
                          let startPos = 0;
                          if (prev.length > 0) {
                            const last = prev[prev.length - 1];
                            startPos = last.timelineStart + last.duration;
                          }
                          return [...prev, { id: `au_${Date.now()}`, resourceId: r.id, timelineStart: startPos, startOffset: 0, duration: dur, volume: 1.0 }];
                        });
                      }
                    }}
                    onRemove={removeFromLibrary}
                    onConvert={handleConvertDNG}
                    onReveal={handleRevealInExplorer}
                    previewUrl={previewCache[res.path]}
                  />
                ))
              )}
            </div>
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
                isCropping ? (
                  <ReactCrop crop={crop} onChange={c => setCrop(c)} style={{ maxWidth: '85%', maxHeight: '85%' }}>
                    <img src={monitorSrc.src} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="" />
                  </ReactCrop>
                ) : (
                  <div style={{ position: 'relative', maxWidth: '85%', maxHeight: '85%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={monitorSrc.src} style={{
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
                    }} alt="" />
                    {monitorSrc.currentItem?.overlayText && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#fff', fontSize: monitorSrc.currentItem.fontSize || 36, fontWeight: monitorSrc.currentItem.fontWeight === 'bold' ? 700 : 400, textShadow: '0 0 20px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>{monitorSrc.currentItem.overlayText}</div>
                    )}
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
                style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative' }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setPlayTime(maxPlayTime * pct);
                }}
              >
                <div style={{ width: `${maxPlayTime > 0 ? (playTime / maxPlayTime * 100) : 0}%`, height: '100%', borderRadius: 2, background: 'var(--ios-indigo)', transition: isPlaying ? 'none' : 'width 0.2s' }} />
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

          {/* 3. 属性面板 */}
          <div className="glass-panel" style={{ width: 320, flexShrink: 0 }}>
            <div className="panel-header-ios">
              <span className="header-title">专业调节</span>
            </div>
            <div style={{ padding: '8px 16px' }}>
              <div style={{
                display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 2,
                border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.2)'
              }}>
                {(['effects', 'export'] as const).map(tab => (
                  <div
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
                      boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)' : 'none'
                    }}
                  >
                    {tab === 'effects' ? '🎨 效果调节' : '🚀 渲染输出'}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', scrollBehavior: 'smooth' }}>
              {activeTab === 'effects' ? (
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

                      {/* 置顶的一键分发 */}
                      <Button appearance="primary" style={{ borderRadius: 12, background: 'var(--ios-indigo)', height: 42, fontWeight: 600, fontSize: 13 }} onClick={applyAllToTimeline} >
                        ✨ 一键分发至全部图片
                      </Button>

                      {/* 自动适配音乐时长 */}
                      {audioItems.length > 0 && timeline.length > 0 && (
                        <Button
                          appearance="subtle"
                          style={{ borderRadius: 12, height: 36, fontWeight: 500, fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                          onClick={() => {
                            const totalAudioDur = Math.max(...audioItems.map(a => a.timelineStart + a.duration));
                            if (totalAudioDur <= 0 || timeline.length === 0) return;
                            pushSnapshot();
                            const perItemDur = totalAudioDur / timeline.length;
                            setTimeline(prev => prev.map(t => ({ ...t, duration: Math.round(perItemDur * 10) / 10 })));
                            setStatusMsg(`🎵 已将 ${timeline.length} 张图片均匀分配到 ${totalAudioDur.toFixed(1)}s 音乐时长`); setTimeout(() => setStatusMsg(''), 2000);
                          }}
                        >
                          🎵 自动适配音乐时长
                        </Button>
                      )}

                      {/* GROUP 1: 影像调优 */}
                      <div className="ios-prop-group">
                        <Text weight="bold" style={{ color: 'var(--ios-indigo)', fontSize: 13, marginBottom: 8, display: 'block' }}>🌓 影像调优矩阵 {selectedIds.size > 1 && <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>({selectedIds.size} 项已选)</span>}</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                          <Field label={`入点时长: ${localDuration !== null ? localDuration : (selectedItem?.duration || 3)}秒`}>
                            <div style={{ width: '100%', minWidth: 0 }} onMouseUp={() => { if (localDuration !== null) { pushSnapshot(); updateSelectedProperty('duration', localDuration); setLocalDuration(null); } }}>
                              <Slider min={0.1} max={10} step={0.1} value={localDuration !== null ? localDuration : (selectedItem?.duration || 3)} onChange={(_e, d) => setLocalDuration(Math.round(d.value * 10) / 10)} style={{ width: '100%', maxWidth: '100%' }} />
                            </div>
                          </Field>
                          <Field label={<span onDoubleClick={() => { pushSnapshot(); updateSelectedProperty('exposure', 1.0); }} style={{ cursor: 'pointer' }} title="双击重置">{`曝光: ${selectedItem?.exposure?.toFixed(2) || '1.00'}`}</span>}><div style={{ width: '100%', minWidth: 0 }} onMouseUp={finalizeSliderUndo}><Slider style={{ width: '100%', maxWidth: '100%' }} min={0.5} max={2.0} step={0.05} value={selectedItem?.exposure || 1.0} onChange={(_e, d) => updatePropertyWithUndo('exposure', d.value)} /></div></Field>
                          <Field label={<span onDoubleClick={() => { pushSnapshot(); updateSelectedProperty('brilliance', 1.0); }} style={{ cursor: 'pointer' }} title="双击重置">{`鲜明度: ${selectedItem?.brilliance?.toFixed(2) || '1.00'}`}</span>}><div style={{ width: '100%', minWidth: 0 }} onMouseUp={finalizeSliderUndo}><Slider style={{ width: '100%', maxWidth: '100%' }} min={0.5} max={2.0} step={0.05} value={selectedItem?.brilliance || 1.0} onChange={(_e, d) => updatePropertyWithUndo('brilliance', d.value)} /></div></Field>
                          <Field label={<span onDoubleClick={() => { pushSnapshot(); updateSelectedProperty('contrast', 1.0); }} style={{ cursor: 'pointer' }} title="双击重置">{`对比度: ${selectedItem?.contrast?.toFixed(2) || '1.00'}`}</span>}><div style={{ width: '100%', minWidth: 0 }} onMouseUp={finalizeSliderUndo}><Slider style={{ width: '100%', maxWidth: '100%' }} min={0.5} max={2.0} step={0.05} value={selectedItem?.contrast || 1.0} onChange={(_e, d) => updatePropertyWithUndo('contrast', d.value)} /></div></Field>
                          <Field label={<span onDoubleClick={() => { pushSnapshot(); updateSelectedProperty('saturation', 1.0); }} style={{ cursor: 'pointer' }} title="双击重置">{`饱和度: ${selectedItem?.saturation?.toFixed(2) || '1.00'}`}</span>}><div style={{ width: '100%', minWidth: 0 }} onMouseUp={finalizeSliderUndo}><Slider style={{ width: '100%', maxWidth: '100%' }} min={0.0} max={2.0} step={0.05} value={selectedItem?.saturation || 1.0} onChange={(_e, d) => updatePropertyWithUndo('saturation', d.value)} /></div></Field>
                        </div>
                      </div>

                      {/* GROUP 2: 色彩平衡 */}
                      <div className="ios-prop-group">
                        <Text weight="bold" style={{ color: '#C084FC', fontSize: 13, marginBottom: 8, display: 'block' }}>🎨 色彩平衡</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                          <Field label={<span onDoubleClick={() => { pushSnapshot(); updateSelectedProperty('temp', 0); }} style={{ cursor: 'pointer' }} title="双击重置">{`色温: ${selectedItem?.temp || 0}`}</span>}><div style={{ width: '100%', minWidth: 0 }} onMouseUp={finalizeSliderUndo}><Slider style={{ width: '100%', maxWidth: '100%' }} min={-100} max={100} step={1} value={selectedItem?.temp || 0} onChange={(_e, d) => updatePropertyWithUndo('temp', d.value)} /></div></Field>
                          <Field label={<span onDoubleClick={() => { pushSnapshot(); updateSelectedProperty('tint', 0); }} style={{ cursor: 'pointer' }} title="双击重置">{`色调: ${selectedItem?.tint || 0}`}</span>}><div style={{ width: '100%', minWidth: 0 }} onMouseUp={finalizeSliderUndo}><Slider style={{ width: '100%', maxWidth: '100%' }} min={-100} max={100} step={1} value={selectedItem?.tint || 0} onChange={(_e, d) => updatePropertyWithUndo('tint', d.value)} /></div></Field>
                        </div>
                      </div>

                      {/* GROUP 3: 文字工坊 */}
                      <div className="ios-prop-group">
                        <Text weight="bold" style={{ color: '#34D399', fontSize: 13, marginBottom: 8, display: 'block' }}>⌨️ 文字工坊 (虚幻底)</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                          <Input value={selectedItem?.overlayText || ''} onChange={(_e, data) => updateSelectedProperty('overlayText', data.value)} placeholder="输入浮空文字..." style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 8, width: '100%' }} />
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
                            <Field label={`字号: ${selectedItem?.fontSize || 24}`} style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ width: '100%', minWidth: 0 }}>
                                <Slider style={{ width: '100%', maxWidth: '100%' }} min={12} max={120} step={2} value={selectedItem?.fontSize || 24} onChange={(_e, d) => updateSelectedProperty('fontSize', d.value)} />
                              </div>
                            </Field>
                            <Button
                              size="small"
                              appearance={selectedItem?.fontWeight === 'bold' ? 'primary' : 'subtle'}
                              style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10 }}
                              onClick={() => updateSelectedProperty('fontWeight', selectedItem?.fontWeight === 'bold' ? 'normal' : 'bold')}
                            >B</Button>
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
                      <div className="ios-prop-group" style={{ padding: '16px', borderRadius: 16, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <Field label={`播放音量: ${Math.round((audioItems.find(a => selectedAudioIds.has(a.id))?.volume || 1) * 100)}%`}>
                          <div style={{ width: '100%', minWidth: 0 }}>
                            <Slider style={{ width: '100%', maxWidth: '100%' }} min={0} max={2} step={0.1} value={audioItems.find(a => selectedAudioIds.has(a.id))?.volume || 1} onChange={(_e, d) => selectedAudioIds.forEach(id => updateAudioItem(id, { volume: d.value }))} />
                          </div>
                        </Field>
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                          <Button
                            appearance={isEditingAudio ? "primary" : "outline"}
                            style={{ height: 38, borderRadius: 10 }}
                            onClick={() => setIsEditingAudio(!isEditingAudio)}
                            disabled={selectedAudioIds.size > 1}
                          >
                            {isEditingAudio ? "✅ 正在剪辑" : "✂️ 进入剪辑模式 (单音频)"}
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
                  <div style={{ textAlign: 'center', marginTop: 100, opacity: 0.15, fontSize: 12 }}>请在轨道中选择项</div>
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
            style={{ height: 36, padding: '0 20px', background: 'rgba(0,0,0,0.1)', cursor: 'pointer' }}
            onDoubleClick={() => { setPlayTime(0); setIsPlaying(false); setStatusMsg(' ⏮ 跳至开头'); setTimeout(() => setStatusMsg(''), 1000); }}
            onClick={handleTripleClickZone}
            title="双击此区域指针快速归零"
          >
            <span style={{ fontSize: 9, fontWeight: 300, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.0, textTransform: 'uppercase' }}>
              照片合成视频王 <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 8px' }}>|</span> {playTime.toFixed(2)}s / {maxPlayTime.toFixed(2)}s
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Button size="small" appearance="subtle" style={{ fontSize: 10, padding: '0 4px' }} onClick={(e) => { e.stopPropagation(); saveProject(); }} title="Ctrl+S">💾</Button>
              <Button size="small" appearance="subtle" style={{ fontSize: 10, padding: '0 4px' }} onClick={(e) => { e.stopPropagation(); loadProject(); }} title="Ctrl+O">📂</Button>
              <Button size="small" appearance="subtle" style={{ fontSize: 10, padding: '0 4px' }} onClick={(e) => { e.stopPropagation(); splitAtPlayhead(); }} title="Ctrl+B 分割">✂️</Button>
              <span style={{ color: 'rgba(255,255,255,0.12)', margin: '0 2px' }}>|</span>
              <div className="zoom-control" onClick={e => e.stopPropagation()}>
                <span>🔍</span>
                <input type="range" min={8} max={120} value={pps} onChange={e => setPps(Number(e.target.value))} />
                <span>{Math.round(pps / 24 * 100)}%</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.12)', margin: '0 2px' }}>|</span>
              <Button size="small" appearance="subtle" style={{ fontSize: 10, padding: '0 4px' }} onClick={(e) => { e.stopPropagation(); pushSnapshot(); setTimeline([]); setAudioItems([]); }}>清空轨道</Button>
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
              <div style={{ display: 'flex', alignItems: 'center', height: 210, marginBottom: 30 }}>
                <div style={{ width: 60, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 900, opacity: 0.5 }}>图片</div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
                  const { active, over } = e;
                  if (over && active.id !== over.id) setTimeline(items => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id)));
                }}>
                  <div style={{ display: 'flex', gap: 4, height: '100%' }}>
                    <SortableContext items={timeline.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                      {timeline.map(item => (
                        <SortableImageCard
                          key={item.id} item={item} resource={resourceMap.get(item.resourceId)}
                          isSelected={selectedIds.has(item.id)} onSelect={(id, isCtrl) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (isCtrl) {
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                              } else {
                                next.clear();
                                next.add(id);
                              }
                              return next;
                            });
                            setSelectedAudioIds(new Set());
                          }}
                          onRemove={(id) => { pushSnapshot(); setTimeline(p => p.filter(t => t.id !== id)); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }}
                          pps={pps} previewUrl={previewCache[resourceMap.get(item.resourceId)?.path || '']}
                          onContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, type: 'image', targetId: item.id })}
                          onTrimDuration={(id, delta) => { pushSnapshot(); setTimeline(p => p.map(t => t.id === id ? { ...t, duration: Math.max(0.3, t.duration + delta) } : t)); }}
                          onDoubleClickCard={() => {
                            // 计算此卡片的起始时间并跳转播放头
                            let startTime = 0;
                            for (const t of timeline) {
                              if (t.id === item.id) break;
                              startTime += t.duration;
                            }
                            setPlayTime(startTime);
                            setIsPlaying(true);
                            // 滚动时间轴到该位置
                            const scrollEl = timelineScrollRef.current;
                            if (scrollEl) {
                              let accX = 0;
                              for (let i = 0; i < timeline.length; i++) {
                                if (timeline[i].id === item.id) break;
                                accX += timeline[i].duration * pps + 4;
                              }
                              scrollEl.scrollLeft = Math.max(0, accX - scrollEl.clientWidth / 3);
                            }
                          }}
                        />
                      ))}
                    </SortableContext>
                  </div>
                </DndContext>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', height: 35, marginTop: 0 }}>
                <div style={{ width: 60, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 900, opacity: 0.5 }}>音频</div>
                <div style={{ position: 'relative', flex: 1, height: 35, overflow: 'visible' }}>
                  {audioItems.map(item => {
                    const isItPlaying = isPlaying && playTime >= item.timelineStart && playTime < (item.timelineStart + item.duration);
                    return (
                      <>
                      <AudioTrackItem
                        key={item.id}
                        item={item}
                        resource={resourceMap.get(item.resourceId)}
                        isSelected={selectedAudioIds.has(item.id)}
                        onSelect={(id: string, isCtrl: boolean) => {
                          setSelectedAudioIds(prev => {
                            const next = new Set(prev);
                            if (isCtrl) {
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                            } else {
                              next.clear();
                              next.add(id);
                            }
                            return next;
                          });
                          setSelectedIds(new Set());
                        }}
                        pps={pps}
                        isPlaying={isItPlaying}
                        editingMode={isEditingAudio && selectedAudioIds.has(item.id)}
                        onUpdateItem={updateAudioItem}
                      />
                      {/* 音频右键菜单触发层 */}
                      <div
                        key={`ctx_${item.id}`}
                        style={{ position: 'absolute', left: item.timelineStart * pps, top: 0, bottom: 0, width: item.duration * pps, zIndex: 1 }}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'audio', targetId: item.id }); }}
                      />
                      </>
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
