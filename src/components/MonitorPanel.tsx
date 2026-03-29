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
  const { isCropping, crop, setCrop, theme } = useStore(useShallow(state => ({
    isCropping: state.isCropping,
    crop: state.crop,
    setCrop: state.setCrop,
    theme: state.theme
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

  // Catmull-Rom interpolator directly interpolating Y based on strict X monotonic lookup
  const generateCurveTable = (pts: {x:number, y:number}[] | undefined) => {
    if (!pts || pts.length < 2) return "";
    const resolution = 256;
    const table = [];
    for (let i = 0; i < resolution; i++) {
        const xVal = i / (resolution - 1);
        let segment = 0;
        for (let j = 0; j < pts.length - 1; j++) {
            if (xVal >= pts[j].x && xVal <= pts[j+1].x) {
                segment = j;
                break;
            }
        }
        if (xVal >= pts[pts.length - 1].x) segment = pts.length - 2;

        const p1 = pts[segment];
        const p2 = pts[segment + 1];
        const dx = p2.x - p1.x;
        
        if (dx === 0) {
            table.push(p2.y.toFixed(4));
            continue;
        }

        const p0 = segment > 0 ? pts[segment - 1] : p1;
        const p3 = segment < pts.length - 2 ? pts[segment + 2] : p2;

        const m1 = (p2.y - p0.y) / Math.max(0.001, p2.x - p0.x);
        const m2 = (p3.y - p1.y) / Math.max(0.001, p3.x - p1.x);

        const S = 0.5; // Tension
        const t = (xVal - p1.x) / dx;
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2*t3 - 3*t2 + 1;
        const h10 = t3 - 2*t2 + t;
        const h01 = -2*t3 + 3*t2;
        const h11 = t3 - t2;

        let yVal = h00 * p1.y + h10 * (m1 * dx * S) + h01 * p2.y + h11 * (m2 * dx * S);
        yVal = Math.max(0, Math.min(1, yVal)); // clamp to 0-1
        table.push(yVal.toFixed(4));
    }
    return table.join(' ');
  };

  const hasCurve = (pts: any) => pts && pts.length >= 5 && pts.some((p: any) => Math.abs(p.x - p.y) > 0.01);
  const activeCurveMaster = hasCurve(monitorSrc?.currentItem?.curveMaster) ? generateCurveTable(monitorSrc?.currentItem?.curveMaster) : '';
  const activeCurveRed = hasCurve(monitorSrc?.currentItem?.curveRed) ? generateCurveTable(monitorSrc?.currentItem?.curveRed) : '';
  const activeCurveGreen = hasCurve(monitorSrc?.currentItem?.curveGreen) ? generateCurveTable(monitorSrc?.currentItem?.curveGreen) : '';
  const activeCurveBlue = hasCurve(monitorSrc?.currentItem?.curveBlue) ? generateCurveTable(monitorSrc?.currentItem?.curveBlue) : '';
  const applyingCurve = activeCurveMaster || activeCurveRed || activeCurveGreen || activeCurveBlue;


  const getClipPath = (item: any) => {
    if (item?.maskShape && item.maskShape !== 'none') {
      switch (item.maskShape) {
        case 'circle': return 'circle(50% at 50% 50%)';
        case 'ellipse': return 'ellipse(45% 35% at 50% 50%)';
        case 'heart': return 'polygon(50% 15%, 61% 0%, 85% 0%, 100% 15%, 100% 38%, 50% 100%, 0% 38%, 0% 15%, 15% 0%, 39% 0%)';
        case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        case 'triangle': return 'polygon(50% 0%, 0% 100%, 100% 100%)';
        case 'rhombus': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        case 'hexagon': return 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)';
      }
    }
    return item?.cropPos ? `inset(${item.cropPos.y}% ${100 - item.cropPos.x - item.cropPos.width}% ${100 - item.cropPos.y - item.cropPos.height}% ${item.cropPos.x}%)` : 'none';
  };

  const buildTextAnimation = (txt: any, totalDur: number) => {
    const anims = [];
    if (txt.textAnimation && txt.textAnimation !== 'none') {
      anims.push(`text-${txt.textAnimation} ${txt.textAnimDuration ?? 0.6}s cubic-bezier(0.16,1,0.3,1) forwards`);
    }
    if (txt.textAnimLoop && txt.textAnimLoop !== 'none') {
      const wait = (txt.textAnimDuration ?? 0.6);
      anims.push(`text-loop-${txt.textAnimLoop} ${txt.textAnimLoopDuration ?? 2}s ease-in-out infinite ${wait}s`);
    }
    if (txt.textAnimOut && txt.textAnimOut !== 'none' && totalDur) {
      const outDur = txt.textAnimOutDuration ?? 0.6;
      const delay = totalDur - outDur;
      if (delay > 0) {
        anims.push(`text-out-${txt.textAnimOut} ${outDur}s ease-out forwards ${delay}s`);
      }
    }
    return anims.join(', ') || 'none';
  };

  return (
    <div
      className="glass-panel monitor-container"
      style={{ flex: 2, display: 'flex', flexDirection: 'column', padding: 8, gap: 8, overflow: 'hidden', alignItems: 'stretch' }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'INPUT') return;
        const el = e.currentTarget;
        if (!document.fullscreenElement) { el.requestFullscreen().catch(() => {}); setIsFullscreen(true); }
        else { document.exitFullscreen(); setIsFullscreen(false); }
      }}
    >
      {/* 隐藏的色彩曲线 SVG 滤镜引擎 */}
      {applyingCurve && (
        <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
          <filter id="rgb-curves-filter" colorInterpolationFilters="sRGB">
            {activeCurveMaster && activeCurveMaster.length > 5 && (
              <feComponentTransfer>
                <feFuncR type="table" tableValues={activeCurveMaster} />
                <feFuncG type="table" tableValues={activeCurveMaster} />
                <feFuncB type="table" tableValues={activeCurveMaster} />
              </feComponentTransfer>
            )}
            {(activeCurveRed || activeCurveGreen || activeCurveBlue) && (
              <feComponentTransfer>
                <feFuncR type={activeCurveRed ? "table" : "identity"} tableValues={activeCurveRed || undefined} />
                <feFuncG type={activeCurveGreen ? "table" : "identity"} tableValues={activeCurveGreen || undefined} />
                <feFuncB type={activeCurveBlue ? "table" : "identity"} tableValues={activeCurveBlue || undefined} />
              </feComponentTransfer>
            )}
          </filter>
        </svg>
      )}

      {/* 🔴 框1：大底的套框里的第一个“小框” —— 视频渲染画板区域 (全方位圆角，自带黑色底色) */}
      <div style={{ flex: 1, width: '100%', boxSizing: 'border-box', backgroundColor: '#0a0a0f', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* 照片合成视频王 预览 (去掉底色和细线，直接融入红框大黑底里！) */}
        <div className="panel-header-ios" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', padding: '12px 16px 0', alignItems: 'flex-start', background: 'transparent', borderBottom: 'none', zIndex: 10 }}>
          <span className="header-title" style={{ opacity: 0.8 }}>照片合成视频王 - 预览</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span ref={timeTextRef} style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', letterSpacing: -1, lineHeight: 1 }}>{formatTime(playTime)}</span>
            <span style={{ fontSize: 9, opacity: 0.4, fontWeight: 600, letterSpacing: 1, marginTop: 2 }}>ENGINE ACTIVE</span>
          </div>
        </div>

        {/* 真正的视频画面播放区 (占用红框里剩下来的全部空间) */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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
                    position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
                    transform: `translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${monitorSrc.currentItem?.zoom || 1})`,
                    opacity: monitorSrc.currentItem?.opacity ?? 1,
                    mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
                    transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                  }}>
                    <video ref={monitorVideoRef} src={monitorSrc.src} style={{
                      display: 'block', maxWidth: '100%', maxHeight: '100%', width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', objectFit: monitorSrc.currentItem?.fillMode === 'cover' ? 'cover' : 'contain', borderRadius: '12px',
                      clipPath: getClipPath(monitorSrc.currentItem),
                      filter: applyingCurve ? `url(#rgb-curves-filter) ${computeFilter(monitorSrc.currentItem)}` : computeFilter(monitorSrc.currentItem),
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
                    position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
                    transform: `translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${monitorSrc.currentItem?.zoom || 1})`,
                    opacity: monitorSrc.currentItem?.opacity ?? 1,
                    mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
                    transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                  }}>
                    <img src={monitorSrc.src} alt="" style={{
                      display: 'block', maxWidth: '100%', maxHeight: '100%', width: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', height: monitorSrc.currentItem?.fillMode === 'cover' ? '100%' : 'auto', objectFit: monitorSrc.currentItem?.fillMode === 'cover' ? 'cover' : 'contain', borderRadius: '12px',
                      clipPath: getClipPath(monitorSrc.currentItem),
                      filter: applyingCurve ? `url(#rgb-curves-filter) ${computeFilter(monitorSrc.currentItem)}` : computeFilter(monitorSrc.currentItem),
                      transition: 'filter 0.4s'
                    }} draggable={false} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }} />
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
                        style={{
                          position: 'absolute',
                          top: `${txt.textY ?? 50}%`,
                          left: `${txt.textX ?? 50}%`,
                          transform: `translate(-50%, -50%) rotate(${txt.textRotation ?? 0}deg)`,
                          animation: buildTextAnimation(txt, monitorSrc.currentItem?.duration || 3),
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
          <div style={{ opacity: 0.03, color: '#fff', fontSize: 100, fontWeight: 900, transform: 'rotate(-10deg)', userSelect: 'none', letterSpacing: '4px' }}>{theme === 'harmony' ? 'HarmonyOS 4' : theme === 'win11' ? 'Windows 11' : 'iOS 26'}</div>
        )}
        </div>
      </div>

      {/* 🔴 框2：另外一个有底色的播放区域，也是作为“第二个小框”嵌套在大底框里 */}
      <div style={{
        flexShrink: 0, height: 48, width: '100%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'rgba(255, 255, 255, 0.04)', backdropFilter: 'blur(16px)',
        borderRadius: 12, padding: '0 16px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        {/* 新版加长播放按钮：带有“播放”文字，更好按，胶囊形状 */}
        <button
          className="ios-hover-scale"
          onClick={togglePlay}
          style={{
            height: 32, borderRadius: 16, minWidth: 84, padding: '0 16px',
            background: 'var(--ios-indigo)', color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.5)'
          }}
        >
          <span style={{ display: 'inline-block', transform: isPlaying ? 'none' : 'translateX(1px)', fontSize: 13 }}>
            {isPlaying ? '⏸' : '▶'}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>{isPlaying ? '暂停' : '播放'}</span>
        </button>

        {/* 居中的进度条 */}
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
          <div style={{
            position: 'absolute', top: '50%', left: `${maxPlayTime > 0 ? (playTime / maxPlayTime * 100) : 0}%`,
            width: 14, height: 14, borderRadius: '50%', background: '#fff',
            transform: 'translate(-50%, -50%)', boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
            transition: isPlaying ? 'none' : 'left 0.15s', pointerEvents: 'none', opacity: isPlaying ? 0 : 1
          }} />
        </div>

        {/* 倍速选项 */}
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className="ios-dark-select"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 11, padding: '4px 8px', cursor: 'pointer', minWidth: 54, outline: 'none' }}
        >
          <option value="0.5" style={{ background: '#1e1e2e', color: '#fff' }}>0.5x</option>
          <option value="0.75" style={{ background: '#1e1e2e', color: '#fff' }}>0.75x</option>
          <option value="1" style={{ background: '#1e1e2e', color: '#fff' }}>1.0x</option>
          <option value="1.5" style={{ background: '#1e1e2e', color: '#fff' }}>1.5x</option>
          <option value="2" style={{ background: '#1e1e2e', color: '#fff' }}>2.0x</option>
        </select>
      </div>
    </div>
  );
};
