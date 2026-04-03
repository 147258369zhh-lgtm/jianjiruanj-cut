import { useAppContext } from '../hooks/useAppContext';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useHoveredPreviewPreset } from '../store';

import { formatTime } from '../utils/formatTime';
import { computeFilter as computeFilterMod, computeTextStyles as computeTextStylesMod, computeLevelsTable } from '../features/filter-engine/useFilter';
import { MonitorView } from './MonitorView';
import ReactCrop from 'react-image-crop';
import './MonitorPanel.css';

export const MonitorPanel: React.FC = () => {
  const {
    playTime, maxPlayTime, isPlaying, togglePlay, setPlayTime, monitorSrc, resourceMap: _resourceMap,
    selectedIds, selectedTextIds, setSelectedTextIds, setTimeline, playbackSpeed,
    setPlaybackSpeed, timeTextRef, monitorVideoRef
  } = useAppContext();
  const { isCropping, crop, setCrop, theme, showGrid, setShowGrid } = useStore(useShallow(state => ({
    isCropping: state.isCropping,
    crop: state.crop,
    setCrop: state.setCrop,
    theme: state.theme,
    showGrid: state.showGrid,
    setShowGrid: state.setShowGrid
  })));

  const hoveredPreviewPreset = useHoveredPreviewPreset();

  const [, setIsFullscreen] = useState(false);
  const monitorImgRef = useRef<HTMLImageElement>(null);
  const [mediaDims, setMediaDims] = useState<{w: number, h: number}>({w: 0, h: 0});

  // 用 ResizeObserver 精确测量当前 img/video 的渲染尺寸
  const mediaObserverRef = useRef<ResizeObserver | null>(null);
  const observeMedia = useCallback((el: HTMLElement | null) => {
    if (mediaObserverRef.current) {
      mediaObserverRef.current.disconnect();
    }
    if (!el) {
      setMediaDims({w: 0, h: 0});
      return;
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setMediaDims(prev => (prev.w === Math.round(width) && prev.h === Math.round(height)) ? prev : {w: Math.round(width), h: Math.round(height)});
      }
    });
    ro.observe(el);
    mediaObserverRef.current = ro;
    // 初始化一次
    setMediaDims({w: el.clientWidth, h: el.clientHeight});
  }, []);

  // 稳定的 ref 回调，防止每次渲染触发无限循环
  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    (monitorVideoRef as any).current = el;
    observeMedia(el);
  }, [observeMedia, monitorVideoRef]);

  const handleImgRef = useCallback((el: HTMLImageElement | null) => {
    monitorImgRef.current = el;
    observeMedia(el);
  }, [observeMedia]);

  // 清理 observer
  useEffect(() => {
    return () => { mediaObserverRef.current?.disconnect(); };
  }, []);

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

  const renderItem = React.useMemo(() => {
    if (!monitorSrc?.currentItem) return null;
    if (hoveredPreviewPreset && selectedIds.has(monitorSrc.currentItem.id)) {
      return {
        ...monitorSrc.currentItem,
        ...hoveredPreviewPreset,
        // Reset properties if "Reset" preset is hovered
        ...(hoveredPreviewPreset.name === '重置' ? {
          curveMaster: undefined, curveRed: undefined, curveGreen: undefined, curveBlue: undefined,
          fade: 0, vignette: 0, grain: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0
        } : {})
      };
    }
    return monitorSrc.currentItem;
  }, [monitorSrc?.currentItem, hoveredPreviewPreset, selectedIds]);

  const hasCurve = (pts: any) => pts && pts.length >= 5 && pts.some((p: any) => Math.abs(p.x - p.y) > 0.01);
  const activeCurveMaster = hasCurve(renderItem?.curveMaster) ? generateCurveTable(renderItem?.curveMaster) : '';
  const activeCurveRed = hasCurve(renderItem?.curveRed) ? generateCurveTable(renderItem?.curveRed) : '';
  const activeCurveGreen = hasCurve(renderItem?.curveGreen) ? generateCurveTable(renderItem?.curveGreen) : '';
  const activeCurveBlue = hasCurve(renderItem?.curveBlue) ? generateCurveTable(renderItem?.curveBlue) : '';
  
  const activeLevelsTable = React.useMemo(() => {
    if (!renderItem) return '';
    const b = renderItem.levelInBlack ?? 0;
    const g = renderItem.levelInGamma ?? 1.0;
    const w = renderItem.levelInWhite ?? 255;
    if (b === 0 && w === 255 && Math.abs(g - 1.0) < 0.01) return '';
    return computeLevelsTable(b, g, w);
  }, [renderItem?.levelInBlack, renderItem?.levelInGamma, renderItem?.levelInWhite]);

  const applyingCurve = activeCurveMaster || activeCurveRed || activeCurveGreen || activeCurveBlue || activeLevelsTable;



  const buildMediaAnimation = (item: any) => {
    const anims = [];

    // Transition Logic
    if (item?.transition && item.transition !== 'none') {
        let tDur = '0.6s';
        let tEase = 'ease-out';
        let animName = 'transFade';
        switch(item.transition) {
            case 'fade': animName = 'transFade'; tDur = '0.6s'; break;
            case 'white': animName = 'transWhite'; tDur = '0.8s'; break;
            case 'iris': animName = 'transIris'; tDur = '0.7s'; break;
            case 'slide': animName = 'transSlide'; tDur = '0.6s'; tEase = 'cubic-bezier(0.25,1,0.5,1)'; break;
            case 'slide_up': animName = 'transSlideUp'; tDur = '0.6s'; tEase = 'cubic-bezier(0.25,1,0.5,1)'; break;
            case 'zoom': animName = 'transZoom'; tDur = '0.7s'; tEase = 'cubic-bezier(0.1, 1, 0.2, 1)'; break;
            case 'wipe': animName = 'transWipe'; tDur = '0.6s'; tEase = 'linear'; break;
            case 'cube': animName = 'transCube'; tDur = '0.8s'; tEase = 'ease-in-out'; break;
            case 'glitch': animName = 'transGlitch'; tDur = '0.5s'; tEase = 'linear'; break;
            case 'flip': animName = 'transFlip'; tDur = '0.7s'; tEase = 'ease-in-out'; break;
            case 'burn': animName = 'transBurn'; tDur = '0.8s'; tEase = 'linear'; break;
            case 'door': animName = 'transDoor'; tDur = '0.7s'; tEase = 'cubic-bezier(0.25,1,0.5,1)'; break;
            case 'blur': animName = 'transBlur'; tDur = '0.7s'; tEase = 'cubic-bezier(0.25,1,0.5,1)'; break;
            case 'spin': animName = 'transSpin'; tDur = '0.7s'; tEase = 'cubic-bezier(0.175,0.885,0.32,1.275)'; break;
        }
        anims.push(`${animName} ${tDur} ${tEase} forwards`);
    }

    if (item?.animation && item.animation !== 'none') {
      const isPan = item.animation.includes('pan');
      const dur = isPan ? (item.duration || 3) + 's' : '1.2s';
      const timing = isPan ? 'linear' : 'cubic-bezier(0.16,1,0.3,1)';
      anims.push(`${item.animation} ${dur} ${timing} forwards`);
    }
    return anims.length > 0 ? anims.join(', ') : 'none';
  };

  const buildTextAnimation = (txt: any, totalDur: number) => {
    if (!totalDur || totalDur <= 0) return 'none';
    const anims = [];
    // 按百分比分配：入场 30% / 循环 30% / 出场 40%
    const enterDur = totalDur * 0.3;
    const loopDelay = enterDur;
    const exitDur = totalDur * 0.4;
    const exitDelay = totalDur - exitDur;

    if (txt.textAnimation && txt.textAnimation !== 'none') {
      anims.push(`text-${txt.textAnimation} ${enterDur.toFixed(2)}s cubic-bezier(0.16,1,0.3,1) forwards`);
    }
    if (txt.textAnimLoop && txt.textAnimLoop !== 'none') {
      // 循环的每次周期用用户设置的值（默认2s），但延迟到入场结束后才开始
      const cycleDur = txt.textAnimLoopDuration ?? 2;
      anims.push(`text-loop-${txt.textAnimLoop} ${cycleDur}s ease-in-out infinite ${loopDelay.toFixed(2)}s`);
    }
    if (txt.textAnimOut && txt.textAnimOut !== 'none') {
      anims.push(`text-out-${txt.textAnimOut} ${exitDur.toFixed(2)}s ease-out forwards ${exitDelay.toFixed(2)}s`);
    }
    return anims.join(', ') || 'none';
  };

  // 动画重置计时器：当点击播放时，强制刷新 CSS 动画状态
  const [animResetKey, setAnimResetKey] = React.useState(0);
  React.useEffect(() => {
    if (isPlaying) {
      setAnimResetKey(prev => prev + 1);
    }
  }, [isPlaying]);

  return (
    <div
      className="glass-panel monitor-container"
      style={{ flex: '1 1 auto', minWidth: 300, display: 'flex', flexDirection: 'column', padding: 8, gap: 8, overflow: 'hidden', alignItems: 'stretch' }}
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
            {activeLevelsTable && (
              <feComponentTransfer>
                <feFuncR type="table" tableValues={activeLevelsTable} />
                <feFuncG type="table" tableValues={activeLevelsTable} />
                <feFuncB type="table" tableValues={activeLevelsTable} />
              </feComponentTransfer>
            )}
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button 
                onClick={() => setShowGrid(!showGrid)}
                style={{ 
                  background: showGrid ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', 
                  border: `1px solid ${showGrid ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: showGrid ? '#818CF8' : 'rgba(255,255,255,0.5)',
                  fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 600
                }}
              >
                {showGrid ? '网格: 开' : '网格: 关'}
              </button>
              <span ref={timeTextRef} style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', letterSpacing: -1, lineHeight: 1 }}>{formatTime(playTime)}</span>
            </div>
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
              <MonitorView
                monitorSrc={monitorSrc}
                renderItem={renderItem}
                applyingCurve={!!applyingCurve}
                computeFilter={computeFilter}
                computeTextStyles={computeTextStyles}
                handleVideoRef={handleVideoRef}
                handleImgRef={handleImgRef}
                mediaDims={mediaDims}
                animResetKey={animResetKey}
                buildMediaAnimation={buildMediaAnimation}
                buildTextAnimation={buildTextAnimation}
                isPlaying={isPlaying}
                selectedIds={selectedIds}
                selectedTextIds={selectedTextIds}
                setSelectedTextIds={setSelectedTextIds}
                setTimeline={setTimeline}
                showGrid={showGrid}
              />
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.7, userSelect: 'none' }}>
            <div style={{ fontSize: 72, marginBottom: 16, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))' }}>🎬</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', letterSpacing: 1, marginBottom: 6 }}>监视器无信号输入</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>请在下方时间轴编排媒体，或选中素材进行编辑</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 30, letterSpacing: 1 }}>{theme === 'harmony' ? 'Powered by HarmonyOS Architecture' : theme === 'win11' ? 'Rendered via Windows 11 Core' : 'Built for iOS 26 Pro Engine'}</div>
          </div>
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
        {/* 播放控制按钮 */}
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
