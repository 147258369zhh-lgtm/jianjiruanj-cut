import React from 'react';
import { VignetteAndGrain } from './VignetteAndGrain';
import { getClipPath } from '../utils/shapeUtils';
import { TimelineItem } from '../types';

interface MonitorViewProps {
  monitorSrc: any;
  renderItem: TimelineItem | null;
  applyingCurve: boolean;
  computeFilter: (item: any) => string;
  computeTextStyles: (txt: any) => React.CSSProperties;
  handleVideoRef: (el: HTMLVideoElement | null) => void;
  handleImgRef: (el: HTMLImageElement | null) => void;
  mediaDims: { w: number, h: number };
  animResetKey: number;
  buildMediaAnimation: (item: any) => string;
  buildTextAnimation: (txt: any, dur: number) => string;
  isPlaying: boolean;
  selectedIds: Set<string>;
  selectedTextIds: Set<string>;
  setSelectedTextIds: (ids: Set<string>) => void;
  setTimeline: (fn: (prev: TimelineItem[]) => TimelineItem[]) => void;
  showGrid: boolean;
}

export const MonitorView: React.FC<MonitorViewProps> = React.memo(({
  monitorSrc,
  renderItem,
  applyingCurve,
  computeFilter,
  computeTextStyles,
  handleVideoRef,
  handleImgRef,
  mediaDims,
  animResetKey,
  buildMediaAnimation,
  buildTextAnimation,
  isPlaying,
  selectedIds,
  selectedTextIds,
  setSelectedTextIds,
  setTimeline,
  showGrid
}) => {
  if (!monitorSrc) return null;

  const activeTexts: any[] = [];
  if (monitorSrc.currentItem) {
    if (monitorSrc.currentItem.textOverlays?.length) {
      activeTexts.push(...monitorSrc.currentItem.textOverlays);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Grid Overlay */}
      {showGrid && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
          zIndex: 5, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '10% 10%',
          opacity: 0.5
        }}>
          {/* Rule of Thirds Lines */}
          <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
        </div>
      )}

      {monitorSrc.type === 'video' ? (
        <div key={`video-anim-wrap-${monitorSrc.currentItem?.id}-${animResetKey}`} style={{ 
          position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
          animation: buildMediaAnimation(monitorSrc.currentItem)
        }}>
          <div style={{
            position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
            transform: `perspective(1000px) translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) rotateY(${monitorSrc.currentItem?.keystoneX || 0}deg) rotateX(${monitorSrc.currentItem?.keystoneY || 0}deg) scale(${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, ${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})`,
            opacity: monitorSrc.currentItem?.opacity ?? 1,
            mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
            transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
            clipPath: getClipPath(monitorSrc.currentItem),
          }}>
            <video ref={handleVideoRef} src={monitorSrc.src} style={{
              display: 'block', maxWidth: '100%', maxHeight: '100%',
              width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto',
              height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto',
              objectFit: monitorSrc.currentItem?.fillMode === 'cover' ? 'cover' : 'contain', borderRadius: '12px',
              filter: applyingCurve ? `url(#rgb-curves-filter) ${computeFilter(renderItem)}` : computeFilter(renderItem),
              transition: 'filter 0.4s'
            }} />
            <VignetteAndGrain vignette={renderItem?.vignette} grain={renderItem?.grain} width={mediaDims.w} height={mediaDims.h} />
          </div>
        </div>
      ) : (
        <div key={`img-anim-wrap-${monitorSrc.currentItem?.id}-${animResetKey}`} style={{ 
          position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
          animation: buildMediaAnimation(monitorSrc.currentItem)
        }}>
          <div style={{
            position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
            transform: `perspective(1000px) translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) rotateY(${monitorSrc.currentItem?.keystoneX || 0}deg) rotateX(${monitorSrc.currentItem?.keystoneY || 0}deg) scale(${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, ${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})`,
            opacity: monitorSrc.currentItem?.opacity ?? 1,
            mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
            transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
            clipPath: getClipPath(monitorSrc.currentItem),
          }}>
            <img ref={handleImgRef} src={monitorSrc.src} alt="" style={{
              display: 'block', maxWidth: '100%', maxHeight: '100%',
              width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto',
              height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto',
              objectFit: monitorSrc.currentItem?.fillMode === 'cover' ? 'cover' : 'contain', borderRadius: '12px',
              filter: applyingCurve ? `url(#rgb-curves-filter) ${computeFilter(renderItem)}` : computeFilter(renderItem),
              transition: 'filter 0.4s'
            }} draggable={false} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }} />
            <VignetteAndGrain vignette={renderItem?.vignette} grain={renderItem?.grain} width={mediaDims.w} height={mediaDims.h} />
          </div>
        </div>
      )}

      {activeTexts.map((txt, layerIdx) => {
        const isSelected = !isPlaying && (selectedTextIds.has(txt.id) || (txt.isRoot && selectedIds.has(monitorSrc.currentItem!.id) && selectedTextIds.size === 0));
        const textWidthPx = txt.textWidth ? `${txt.textWidth}px` : 'auto';
        return (
          <div
            key={`tlayer-${txt.id}-${animResetKey}`}
            style={{
              position: 'absolute',
              top: `${txt.textY ?? 50}%`,
              left: `${txt.textX ?? 50}%`,
              transform: `perspective(1000px) translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) rotateY(${monitorSrc.currentItem?.keystoneX || 0}deg) rotateX(${monitorSrc.currentItem?.keystoneY || 0}deg) scale(${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, ${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})`,
              animation: buildTextAnimation(txt, monitorSrc.currentItem?.duration || 3),
              cursor: 'move',
              width: textWidthPx,
              whiteSpace: txt.textWidth ? 'normal' : 'nowrap',
              userSelect: 'none',
              zIndex: 10 + layerIdx,
              outline: isSelected ? '2px dashed rgba(99,102,241,0.8)' : 'none',
              outlineOffset: '4px',
              padding: '4px 8px',
              ...computeTextStyles(txt as any)
            } as React.CSSProperties}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).dataset?.resizeHandle) return;
              e.preventDefault(); e.stopPropagation();
              
              let newSelectedSet = new Set(selectedTextIds);
              if (e.altKey) {
                if (newSelectedSet.has(txt.id)) newSelectedSet.delete(txt.id);
                else newSelectedSet.add(txt.id);
              } else {
                if (!newSelectedSet.has(txt.id)) newSelectedSet = new Set([txt.id]);
              }
              setSelectedTextIds(newSelectedSet);
              
              const container = e.currentTarget.parentElement;
              if (!container) return;
              const rect = container.getBoundingClientRect();
              const startX = e.clientX, startY = e.clientY;
              
              const startCoords: Record<string, {x: number, y: number}> = {};
              if (txt.isRoot) {
                startCoords[txt.id] = { x: txt.textX ?? 50, y: txt.textY ?? 50 };
              } else {
                const textItemContext = monitorSrc.currentItem?.textOverlays || [];
                textItemContext.forEach((layer: any) => {
                  if (newSelectedSet.has(layer.id) || layer.id === txt.id) {
                    startCoords[layer.id] = { x: layer.textX ?? 50, y: layer.textY ?? 50 };
                  }
                });
              }

              const onMove = (me: MouseEvent) => {
                const dx = ((me.clientX - startX) / rect.width) * 100;
                const dy = ((me.clientY - startY) / rect.height) * 100;
                
                if (txt.isRoot) {
                  setTimeline(p => p.map(t => t.id === monitorSrc.currentItem?.id
                    ? { ...t, textX: Math.max(0, Math.min(100, startCoords[txt.id].x + dx)), textY: Math.max(0, Math.min(100, startCoords[txt.id].y + dy)) }
                    : t));
                } else {
                  setTimeline(p => p.map(t => {
                    if (t.id !== monitorSrc.currentItem?.id) return t;
                    return {
                      ...t,
                      textOverlays: (t.textOverlays || []).map(layer => {
                        if (startCoords[layer.id]) {
                          return { 
                            ...layer, 
                            textX: Math.max(0, Math.min(100, startCoords[layer.id].x + dx)), 
                            textY: Math.max(0, Math.min(100, startCoords[layer.id].y + dy)) 
                          };
                        }
                        return layer;
                      })
                    };
                  }));
                }
              };
              const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            {txt.text}
            {isSelected && (
              <div
                data-resize-handle="true"
                style={{
                  position: 'absolute', right: -8, bottom: -8, width: 14, height: 14,
                  background: 'rgba(99,102,241,0.9)', border: '2px solid #fff',
                  borderRadius: 3, cursor: 'nwse-resize', zIndex: 100,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)'
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const startX = e.clientX;
                  const el = e.currentTarget.parentElement;
                  if (!el) return;
                  const startWidth = el.offsetWidth;
                  
                  const onMove = (me: MouseEvent) => {
                    const newWidth = Math.max(40, startWidth + (me.clientX - startX));
                    if (!txt.isRoot) {
                      setTimeline(p => p.map(t => {
                        if (t.id !== monitorSrc.currentItem?.id) return t;
                        return {
                          ...t,
                          textOverlays: (t.textOverlays || []).map((layer: any) =>
                            layer.id === txt.id ? { ...layer, textWidth: newWidth } : layer
                          )
                        };
                      }));
                    } else {
                      setTimeline(p => p.map(t =>
                        t.id === monitorSrc.currentItem?.id ? { ...t, textWidth: newWidth } : t
                      ));
                    }
                  };
                  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
