import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { generateThumbnail } from '../utils/thumbnail';
import { TimelineItem, Resource } from '../types';

export const SortableImageCard = memo(function SortableImageCard({
  item, resource, isSelected, onSelect, onRemove, pps, previewUrl, onContextMenu, onTrimDuration, onDoubleClickCard, multiSelectIndex, isMultiSelected
}: {
  item: TimelineItem; resource?: Resource; isSelected: boolean; onSelect: (id: string, isCtrl: boolean) => void; onRemove: (id: string) => void; pps: number; previewUrl?: string; onContextMenu?: (e: React.MouseEvent, id: string) => void; onTrimDuration?: (id: string, delta: number) => void; onDoubleClickCard?: (id: string) => void; multiSelectIndex?: number; isMultiSelected?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: item.id });
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
    width: '100%', height: '100%', objectFit: item.fillMode === 'contain' ? 'contain' : 'cover',
    transform: `rotate(${item.rotation}deg) scale(${item.zoom || 1})`,
    filter: `
      brightness(${item.exposure ?? 1.0}) 
      contrast(${(item.contrast ?? 1.0) + ((item.brilliance ?? 1.0) - 1.0) * 0.2}) 
      saturate(${(item.saturation ?? 1.0) + ((item.brilliance ?? 1.0) - 1.0) * 0.1})
      sepia(${(item.temp ?? 0) > 0 ? (item.temp ?? 0) / 100 : 0})
      hue-rotate(${(item.tint ?? 0)}deg)
    `,
    clipPath: item.cropPos ? `inset(${item.cropPos.y}% ${100 - item.cropPos.x - item.cropPos.width}% ${100 - item.cropPos.y - item.cropPos.height}% ${item.cropPos.x}%)` : 'none',
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
        zIndex: isHovered || isSelected ? 50 : 1, // 抬升层级防止放大时右侧被隔壁覆盖
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
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickCard?.(item.id); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, item.id); }}
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
            item.resourceId.startsWith('__TEXT__') ? (
              <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.textBg || 'rgba(30,30,30,0.9)', padding: '4px' }}>
                <span style={{ fontSize: Math.min(item.fontSize || 14, 14), fontWeight: 700, color: item.fontColor || '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '95%' }}>
                  {item.overlayText || '缺失'}
                </span>
              </div>
            ) : isVideo ? (() => {
              if (isDragging) {
                const frameSrc = `${imgSrc}#t=1`;
                return (
                  <div style={{ width: 60, height: '100%', position: 'relative', overflow: 'hidden', background: '#111', borderRadius: 12 }}>
                    <video src={frameSrc} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: thumbStyle.filter }} preload="metadata" />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 16 }}>🎬</span>
                    </div>
                  </div>
                );
              }

              const blockWidth = item.duration * pps;
              const frameWidth = 60; 
              const numFrames = Math.min(60, Math.max(1, Math.ceil(blockWidth / frameWidth)));
              
              return (
                <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111', display: 'flex', alignItems: 'stretch', pointerEvents: 'none', overflow: 'hidden' }}>
                  {Array.from({ length: numFrames }).map((_, i) => {
                     // 算时间偏移
                     const timeOffset = item.duration > 0 ? (i / numFrames) * item.duration : 0;
                     const frameSrc = `${imgSrc}#t=${Math.max(0.1, timeOffset)}`;
                     return (
                       <div key={i} style={{ width: `${100 / numFrames}%`, height: '100%', position: 'relative', overflow: 'hidden' }}>
                         <video src={frameSrc} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: thumbStyle.filter }} preload="metadata" />
                       </div>
                     );
                  })}
                  {/* 半透明覆盖层与影视图标 */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', pointerEvents: 'none' }}>
                    <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', backdropFilter: 'blur(4px)' }}>
                      <span style={{ fontSize: 16 }}>🎬</span>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <img src={imgSrc} style={thumbStyle} draggable={false} alt="" />
            )
          ) : null}
        </>
      ) : null}

      {/* 右上角删除按钮 (hover 时显示) */}
      {isHovered && !isDragging && (
        <div
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(item.id); }}
          style={{
            position: 'absolute', 
            top: isVideo ? 6 : 4, 
            right: isVideo ? 10 : 4, 
            zIndex: 60,
            width: isVideo ? 22 : 18, 
            height: isVideo ? 22 : 18, 
            borderRadius: isVideo ? 6 : 5,
            background: 'rgba(255, 59, 48, 0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', 
            fontSize: isVideo ? 12 : 10, 
            color: '#fff',
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