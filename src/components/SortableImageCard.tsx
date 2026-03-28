import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { TimelineItem, Resource } from '../types';

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
    const doWork = () => new Promise<void>(async (done) => {
      try {
        // 先 Fetch 成 Blob 绕过 Tauri 的 CORS 跨域污染画布问题
        const res = await fetch(srcUrl);
        const fileBlob = await res.blob();
        const objUrl = URL.createObjectURL(fileBlob);

        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, THUMB_WIDTH / img.naturalWidth);
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            try {
              canvas.toBlob((blob) => {
                const url = blob ? URL.createObjectURL(blob) : srcUrl;
                thumbCache.set(srcUrl, url);
                thumbPending.delete(srcUrl);
                resolve(url);
                canvas.width = 0; canvas.height = 0;
                URL.revokeObjectURL(objUrl);
                done();
              }, 'image/webp', 0.65);
            } catch (err) {
              // 处理可能的安全异常
              thumbCache.set(srcUrl, srcUrl);
              thumbPending.delete(srcUrl);
              resolve(srcUrl);
              URL.revokeObjectURL(objUrl);
              done();
            }
          } else {
             resolve(srcUrl);
             URL.revokeObjectURL(objUrl);
             done();
          }
        };
        img.onerror = () => {
          thumbCache.set(srcUrl, srcUrl);
          thumbPending.delete(srcUrl);
          resolve(srcUrl);
          URL.revokeObjectURL(objUrl);
          done();
        };
        img.src = objUrl;
      } catch (err) {
        thumbCache.set(srcUrl, srcUrl);
        thumbPending.delete(srcUrl);
        resolve(srcUrl);
        done();
      }
    });
    thumbQueue.push(doWork);
    runThumbQueue();
  });

  thumbPending.set(srcUrl, p);
  return p;
};

// ─── 子组件: 极简图片卡片 ──────────────────────────────────────────
export const SortableImageCard = memo(function SortableImageCard({
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
    transform: `rotate(${item.rotation || 0}deg) scale(${item.zoom || 1})`,
    clipPath: item.cropPos ? `inset(${item.cropPos.y}% ${100 - (item.cropPos.x + item.cropPos.width)}% ${100 - (item.cropPos.y + item.cropPos.height)}% ${item.cropPos.x}%)` : undefined,
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

      {/* 顶部居中删除按钮 (hover 时显示) */}
      {isHovered && (
        <div
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1.15)'; e.currentTarget.style.background = 'rgba(255, 59, 48, 0.95)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; e.currentTarget.style.background = 'rgba(255, 59, 48, 0.75)'; }}
          style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%) scale(1)', zIndex: 20,
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(255, 59, 48, 0.75)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, color: '#fff',
            boxShadow: '0 4px 15px rgba(255, 59, 48, 0.5), inset 0 0 8px rgba(255,255,255,0.3)',
            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          title="彻底移除"
        >🗑️</div>
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
