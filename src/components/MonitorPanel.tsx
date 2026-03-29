import { useAppContext } from '../hooks/useAppContext';
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

import { formatTime } from '../utils/formatTime';
import { computeFilter as computeFilterMod, computeTextStyles as computeTextStylesMod } from '../features/filter-engine/useFilter';
import ReactCrop from 'react-image-crop';
import './MonitorPanel.css';

export const MonitorPanel: React.FC = () => {
  const {
    playTime, maxPlayTime, isPlaying, togglePlay, setPlayTime, monitorSrc, resourceMap,
    selectedIds, selectedTextIds, setSelectedTextIds, setTimeline, playbackSpeed,
    setPlaybackSpeed, timeTextRef, monitorVideoRef
  } = useAppContext();
  const { isCropping, crop, setCrop } = useStore(useShallow(state => ({
    isCropping: state.isCropping,
    crop: state.crop,
    setCrop: state.setCrop
  })));

  const [, setIsFullscreen] = useState(false);

  // 监听退出全屏
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const computeFilter = computeFilterMod;
  const computeTextStyles = computeTextStylesMod;

  return (
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
              <ReactCrop crop={crop} onChange={(c: any) => setCrop(c)} style={{ maxWidth: '85%', maxHeight: '85%' }}>
                <img src={monitorSrc.src} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="" />
              </ReactCrop>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {monitorSrc.type === 'video' ? (
                  <div style={{
                    position: 'relative', display: monitorSrc.currentItem?.fillMode === 'cover' ? 'flex' : 'inline-flex', width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', maxWidth: '100%', maxHeight: '100%', justifyContent: 'center', alignItems: 'center',
                    transform: `rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${monitorSrc.currentItem?.zoom || 1})`,
                    transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                  }}>
                    <video ref={monitorVideoRef} src={monitorSrc.src} muted style={{
                      display: 'block', maxWidth: '100%', maxHeight: '100%', width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', objectFit: monitorSrc.currentItem?.fillMode === 'contain' ? 'contain' : 'cover', borderRadius: '12px',
                      clipPath: monitorSrc.currentItem?.cropPos ? `inset(${monitorSrc.currentItem.cropPos.y}% ${100 - monitorSrc.currentItem.cropPos.x - monitorSrc.currentItem.cropPos.width}% ${100 - monitorSrc.currentItem.cropPos.y - monitorSrc.currentItem.cropPos.height}% ${monitorSrc.currentItem.cropPos.x}%)` : 'none',
                      filter: computeFilter(monitorSrc.currentItem),
                      transition: 'filter 0.4s'
                    }} />
                    {(monitorSrc.currentItem?.vignette || monitorSrc.currentItem?.grain) ? (
                      <div style={{
                        position: 'absolute', pointerEvents: 'none', inset: 0, zIndex: 5, borderRadius: 12, overflow: 'hidden',
                        background: monitorSrc.currentItem?.vignette ? `radial-gradient(ellipse at center, transparent ${60 - Math.abs(monitorSrc.currentItem.vignette)*40}%, rgba(${monitorSrc.currentItem.vignette > 0 ? '0,0,0' : '255,255,255'}, ${Math.abs(monitorSrc.currentItem.vignette)}) 120%)` : 'none',
                        mixBlendMode: 'overlay'
                      }}>
                        {monitorSrc.currentItem?.grain > 0 && (
                          <div style={{
                            position: 'absolute', inset: 0, opacity: monitorSrc.currentItem.grain, mixBlendMode: 'soft-light',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
                          }} />
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{
                    position: 'relative', display: monitorSrc.currentItem?.fillMode === 'cover' ? 'flex' : 'inline-flex', width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', maxWidth: '100%', maxHeight: '100%', justifyContent: 'center', alignItems: 'center',
                    transformOrigin: (monitorSrc.currentItem && resourceMap.get(monitorSrc.currentItem.resourceId)?.focusX) ? `${resourceMap.get(monitorSrc.currentItem.resourceId)?.focusX}% ${resourceMap.get(monitorSrc.currentItem.resourceId)?.focusY}%` : 'center center',
                    transform: `rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${monitorSrc.currentItem?.zoom || 1})`,
                    transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                  }}>
                    <img key={monitorSrc.currentItem?.id} src={monitorSrc.src} className={monitorSrc.currentItem?.animation && monitorSrc.currentItem.animation !== 'none' ? monitorSrc.currentItem.animation : ''} style={{
                      display: 'block', maxWidth: '100%', maxHeight: '100%', width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', objectFit: monitorSrc.currentItem?.fillMode === 'contain' ? 'contain' : 'cover', borderRadius: '12px',
                      clipPath: monitorSrc.currentItem?.cropPos ? `inset(${monitorSrc.currentItem.cropPos.y}% ${100 - monitorSrc.currentItem.cropPos.x - monitorSrc.currentItem.cropPos.width}% ${100 - monitorSrc.currentItem.cropPos.y - monitorSrc.currentItem.cropPos.height}% ${monitorSrc.currentItem.cropPos.x}%)` : 'none',
                      filter: computeFilter(monitorSrc.currentItem),
                      transition: 'filter 0.4s'
                    }} alt="" />
                    {(monitorSrc.currentItem?.vignette || monitorSrc.currentItem?.grain) ? (
                      <div style={{
                        position: 'absolute', pointerEvents: 'none', inset: 0, zIndex: 5, borderRadius: 12, overflow: 'hidden',
                        background: monitorSrc.currentItem?.vignette ? `radial-gradient(ellipse at center, transparent ${60 - Math.abs(monitorSrc.currentItem.vignette)*40}%, rgba(${monitorSrc.currentItem.vignette > 0 ? '0,0,0' : '255,255,255'}, ${Math.abs(monitorSrc.currentItem.vignette)}) 120%)` : 'none',
                        mixBlendMode: 'overlay'
                      }}>
                        {monitorSrc.currentItem?.grain > 0 && (
                          <div style={{
                            position: 'absolute', inset: 0, opacity: monitorSrc.currentItem.grain, mixBlendMode: 'soft-light',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
                          }} />
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
                {(() => {
                  const activeTexts: any[] = [];
                  if (monitorSrc.currentItem) {
                    if (monitorSrc.currentItem.overlayText) {
                      activeTexts.push({ ...monitorSrc.currentItem, id: monitorSrc.currentItem.id + '_root', text: monitorSrc.currentItem.overlayText, isRoot: true });
                    }
                    if (monitorSrc.currentItem.textOverlays?.length) {
                      activeTexts.push(...monitorSrc.currentItem.textOverlays);
                    }
                  }
                  
                  return activeTexts.map((txt, layerIdx) => {
                    const isSelected = selectedTextIds.has(txt.id) || (txt.isRoot && selectedIds.has(monitorSrc.currentItem!.id) && selectedTextIds.size === 0);
                    return (
                      <div
                        key={`tlayer-${txt.id}`}
                        className={`text-anim-${txt.textAnimation || 'none'}`}
                        style={{
                          position: 'absolute',
                          top: `${txt.textY ?? 50}%`,
                          left: `${txt.textX ?? 50}%`,
                          transform: `translate(-50%, -50%) rotate(${txt.textRotation ?? 0}deg)`,
                          '--text-anim-dur': `${txt.textAnimDuration ?? 0.6}s`,
                          cursor: 'move',
                          maxWidth: '100%',
                          userSelect: 'none',
                          zIndex: 10 + layerIdx,
                          outline: isSelected ? '2px dashed rgba(99,102,241,0.8)' : 'none',
                          outlineOffset: '4px',
                          padding: '4px 8px',
                          ...computeTextStyles(txt as any)
                        } as React.CSSProperties}
                        onMouseDown={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          
                          // 处理 Alt 多选逻辑
                          let newSelectedSet = new Set(selectedTextIds);
                          if (e.altKey) {
                            if (newSelectedSet.has(txt.id)) {
                              newSelectedSet.delete(txt.id);
                            } else {
                              newSelectedSet.add(txt.id);
                            }
                          } else {
                            if (!newSelectedSet.has(txt.id)) {
                              newSelectedSet = new Set([txt.id]);
                            }
                          }
                          setSelectedTextIds(newSelectedSet);
                          
                          const container = e.currentTarget.parentElement;
                          if (!container) return;
                          const rect = container.getBoundingClientRect();
                          const startX = e.clientX, startY = e.clientY;
                          
                          // 提取所有被选中图层的初始坐标，用于群体位移
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
                      >{txt.text}</div>
                    );
                  });
                })()}
              </div>
            )
          ) : (
            /* 纯文字项预览（无图片背景） */
            <div style={{ position: 'relative', width: '85%', height: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: monitorSrc.currentItem?.textBg || 'rgba(30,30,30,0.9)', border: `2px solid ${monitorSrc.currentItem?.fontColor || '#fff'}30` }}>
              <div style={{ 
                maxWidth: '80%', 
                wordBreak: 'break-word' as const,
                transform: `rotate(${monitorSrc.currentItem?.textRotation ?? 0}deg)`,
                ...computeTextStyles(monitorSrc.currentItem)
              }}>{monitorSrc.currentItem?.overlayText}</div>
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
  );
};
