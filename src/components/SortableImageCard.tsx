import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { generateThumbnail } from '../utils/thumbnail';
import { TimelineItem, Resource } from '../types';
import { useThumbnail } from '../hooks/useThumbnail';
import { computeFilter } from '../features/filter-engine/useFilter';

const VideoFrame = ({ src, timeOffset, style }: { src: string, timeOffset: number, style: React.CSSProperties }) => {
  const thumbUrl = useThumbnail(src, timeOffset);
  return (
    <div style={{ ...style, position: 'relative', overflow: 'hidden' }}>
      {thumbUrl ? (
        <img src={thumbUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="frame" draggable={false} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#222' }} />
      )}
    </div>
  );
};

export const SortableImageCard = memo(function SortableImageCard({
  item, resource, isSelected, onSelect, onRemove, pps, previewUrl, onContextMenu, onTrimDuration, onDoubleClickCard, isMultiSelected, layout
}: {
  item: TimelineItem; resource?: Resource; isSelected: boolean; onSelect: (id: string, isCtrl: boolean) => void; onRemove: (id: string) => void; pps: number; previewUrl?: string; onContextMenu?: (e: React.MouseEvent, id: string) => void; onTrimDuration?: (id: string, delta: number) => void; onDoubleClickCard?: (id: string) => void; isMultiSelected?: boolean;
  layout: any;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: item.id });
  const [isHovered, setIsHovered] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const hoverVideoRef = useRef<HTMLVideoElement | null>(null);

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

  const getClipPath = (it: any) => {
    if (it?.maskShape && it.maskShape !== 'none') {
      switch (it.maskShape) {
        case 'circle': return 'circle(50% at 50% 50%)';
        case 'ellipse': return 'ellipse(45% 35% at 50% 50%)';
        case 'heart': return 'polygon(50% 15%, 61% 0%, 85% 0%, 100% 15%, 100% 38%, 50% 100%, 0% 38%, 0% 15%, 15% 0%, 39% 0%)';
        case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        case 'triangle': return 'polygon(50% 0%, 0% 100%, 100% 100%)';
        case 'rhombus': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        case 'hexagon': return 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)';
      }
    }
    return it?.cropPos ? `inset(${it.cropPos.y}% ${100 - it.cropPos.x - it.cropPos.width}% ${100 - it.cropPos.y - it.cropPos.height}% ${it.cropPos.x}%)` : 'none';
  };

  const thumbStyle: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: item.fillMode === 'contain' ? 'contain' : 'cover',
    transform: `perspective(1000px) translate(${item.posX || 0}%, ${item.posY || 0}%) rotate(${item.rotation || 0}deg) rotateY(${item.keystoneX || 0}deg) rotateX(${item.keystoneY || 0}deg) scale(${(item.zoom || 1) * (item.flipX ? -1 : 1)}, ${(item.zoom || 1) * (item.flipY ? -1 : 1)})`,
    filter: computeFilter(item),
    clipPath: getClipPath(item),
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
        transform: transform ? CSS.Transform.toString(transform) : 'none',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        width: `${layout.items.find((i: any) => i.id === item.id)?.visualWidth || (item.duration * pps)}px`,
        height: '100%',
        flexShrink: 0,
        position: 'relative',
        zIndex: isHovered || isSelected ? 50 : 1, // 抬升层级防止放大时右侧被隔壁覆盖
        cursor: 'grab',
        overflow: 'hidden',
        borderRadius: '12px',
        background: isSelected ? 'rgba(94, 92, 230, 0.08)' : 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.06)', // Maintain static border to avoid layout shift gaps
        boxShadow: isSelected ? 'none' : '0 4px 6px rgba(0,0,0,0.2)',
        boxSizing: 'border-box',
        outline: 'none', // Prevent default browser focus rings (which cause the double line artifact)
      }}
      {...attributes} {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id, e.ctrlKey || e.metaKey); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickCard?.(item.id); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, item.id); }}
      onMouseEnter={() => {
        setIsHovered(true);
        // Collapsed video: start playing on hover
        if (item.collapsed && isVideo && hoverVideoRef.current) {
          hoverVideoRef.current.currentTime = 0;
          hoverVideoRef.current.play().catch(() => {});
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        // Collapsed video: pause on leave
        if (item.collapsed && isVideo && hoverVideoRef.current) {
          hoverVideoRef.current.pause();
        }
      }}
    >
      {/* 专用选中光环，覆盖在最上层，避免 Chromium 亚像素渲染导致漏气留白和双层边框 */}
      {isSelected && (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: 12, // Match parent
          border: isMultiSelected ? '3px dashed #6366f1' : '3px solid #6366f1',
          pointerEvents: 'none', zIndex: 100,
          boxShadow: 'inset 0 0 0 1px rgba(94, 92, 230, 0.2)' // Optional inner crisp ring
        }} />
      )}

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
                return (
                  <div style={{ width: 60, height: '100%', position: 'relative', overflow: 'hidden', background: '#111', borderRadius: 12 }}>
                    <VideoFrame src={imgSrc} timeOffset={1} style={{ width: '100%', height: '100%' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 16 }}>🎬</span>
                    </div>
                  </div>
                );
              }

              // === 折叠模式：视频自身作为封面 + 悬浮播放 ===
              if (item.collapsed) {
                return (
                  <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
                    {/* 直接用 video 原生封面，不需要经过缩略图引擎更可靠 */}
                    <video
                      ref={hoverVideoRef}
                      src={imgSrc}
                      muted
                      loop
                      playsInline
                      preload="auto"
                      onLoadedMetadata={(e) => {
                        // 初始跳转到 0.0s 作为封面
                        (e.target as HTMLVideoElement).currentTime = 0;
                      }}
                      style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        position: 'absolute', inset: 0,
                        opacity: isHovered ? 1 : 0.6, // 未悬浮时略微暗淡，更像缩略图
                        transition: 'opacity 0.3s ease',
                        pointerEvents: 'none',
                        filter: isHovered ? 'none' : 'brightness(0.8)',
                      }}
                    />
                    {/* 折叠图标 */}
                    {!isHovered && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ 
                          background: 'rgba(0,0,0,0.6)', 
                          borderRadius: '50%', 
                          width: 36, height: 36, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          backdropFilter: 'blur(8px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          <span style={{ fontSize: 16 }}>📁</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // === 展开模式：多帧胶卷 ===
              const blockWidth = item.duration * pps;
              const frameWidth = 60; 
              const numFrames = Math.min(100, Math.max(1, Math.ceil(blockWidth / frameWidth)));
              
              return (
                <div style={{ width: '100%', height: '100%', position: 'relative', background: 'repeating-linear-gradient(90deg, #111 0px, #111 40px, #222 40px, #222 42px)', borderTop: '2px solid #000', borderBottom: '2px solid #000', display: 'flex', alignItems: 'stretch', pointerEvents: 'none', overflow: 'hidden' }}>
                  {Array.from({ length: numFrames }).map((_, i) => {
                     const timeOffset = item.duration > 0 ? (i / numFrames) * item.duration : 0.1;
                     return (
                       <VideoFrame 
                         key={i} 
                         src={imgSrc} 
                         timeOffset={timeOffset} 
                         style={{ width: `${100 / numFrames}%`, height: '100%', borderRight: i < numFrames - 1 ? '1px solid rgba(0,0,0,0.5)' : 'none' }} 
                       />
                     );
                  })}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', pointerEvents: 'none' }}>
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

      {/* Removed numerical badge as requested by user to save resources */}

      {/* 浮空文字预览层 (新版多文本图层支持) */}
      {item.textOverlays?.map((txt) => (
        <div key={txt.id} style={{
          position: 'absolute',
          top: `${txt.textY ?? 50}%`,
          left: `${txt.textX ?? 50}%`,
          transform: `perspective(1000px) translate(-50%, -50%) rotate(${txt.textRotation || 0}deg)`,
          color: txt.fontColor || '#fff',
          fontSize: `${(txt.fontSize || 24) * 0.3}px`, // Scaled down for tiny thumbnail
          fontWeight: txt.fontWeight === 'bold' ? 700 : 400,
          fontFamily: txt.fontFamily || 'inherit',
          textAlign: 'center',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          zIndex: 5,
        }}>
          {txt.text}
        </div>
      ))}

      {/* 浮空文字预览层 (旧版兼容) */}
      {item.overlayText && (
        <div style={textStyle}>
          {item.overlayText}
        </div>
      )}
      {/* 折叠指示角标 */}
      {item.collapsed && (
        <div style={{
          position: 'absolute', top: 4, right: 4, zIndex: 60,
          background: 'rgba(99,102,241,0.9)', color: '#fff',
          fontSize: 9, fontWeight: 700, borderRadius: 4,
          padding: '1px 5px', pointerEvents: 'none',
          backdropFilter: 'blur(4px)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
        }}>▶ {item.duration.toFixed(1)}s</div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding: '4px 8px', fontSize: 9, color: '#fff', display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <span>{item.collapsed ? '📁' : item.duration.toFixed(1) + 's'}</span>
        <span style={{ opacity: 0.6 }}>{item.transition !== 'none' ? '✨' : ''}</span>
      </div>
    </div>
  );
});