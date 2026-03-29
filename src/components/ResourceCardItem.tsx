import React, { memo, useState, useMemo, useRef, useEffect } from 'react';
import { Button } from "@fluentui/react-components";
import { convertFileSrc } from '@tauri-apps/api/core';

const HoverMarqueeText = memo(({ text, isHovered, style }: { text: string; isHovered: boolean; style?: React.CSSProperties }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const dist = Math.max(0, textRef.current.scrollWidth - containerRef.current.clientWidth);
      setScrollDistance(dist);
    }
  }, [text, isHovered]);

  const shouldScroll = isHovered && scrollDistance > 0;

  return (
    <div ref={containerRef} style={{ flex: 1, minWidth: 0, overflow: 'hidden', ...style }}>
      <div
        ref={textRef}
        title={text}
        style={{
          whiteSpace: 'nowrap',
          display: 'block',
          overflow: shouldScroll ? 'visible' : 'hidden',
          textOverflow: shouldScroll ? 'clip' : 'ellipsis',
          willChange: 'transform',
          transition: shouldScroll ? `transform ${(scrollDistance / 35).toFixed(1)}s linear 0.3s` : 'transform 0.5s cubic-bezier(0.2, 0, 0, 1) 0.1s',
          transform: shouldScroll ? `translateX(-${scrollDistance + 10}px)` : 'translateX(0)',
        }}
      >
        {text}
      </div>
    </div>
  );
});

const ActionCheckbox = ({ isChecked, onToggle }: { isChecked: boolean, onToggle: (e: React.MouseEvent) => void }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isChecked ? '#10B981' : (hover ? 'rgba(255,255,255,0.08)' : 'transparent'),
        border: isChecked ? '1px solid #10B981' : (hover ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.12)'),
        color: isChecked ? '#fff' : 'transparent',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        fontSize: 13, fontWeight: 700
      }}
    >
      {isChecked ? '✓' : ''}
    </div>
  );
};

const ActionDelete = ({ onRemove }: { onRemove: (e: React.MouseEvent) => void }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onRemove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? '#EF4444' : 'rgba(239,68,68,0.15)',
        color: hover ? '#fff' : '#EF4444',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        fontSize: 16, fontWeight: 400, paddingBottom: 2
      }}
      title="移除"
    >
      ×
    </div>
  );
};

export const ResourceCardItem = memo(({ res, isChecked, isAdded, onToggle, onSelectPreview, onRemove, onConvert, onReveal: _onReveal, previewUrl }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const accentColor = '#10B981';

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

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (res.type !== 'video' || !videoRef.current) return;
    const el = videoRef.current;
    el.muted = true;
    el.loop = true;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
          el.currentTime = 0.1;
        }
      });
    }, { root: null, threshold: 0.1 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [res.type, displaySrc]);

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
          borderLeft: 'none',
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
          fontSize: 15, position: 'relative',
          transition: 'transform 0.2s',
          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
        }}>
          ♪
          {isAdded && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981, 0 0 2px #10B981', zIndex: 10 }} title="已添至时间轴" />}
        </div>
        {/* 名称 */}
        <HoverMarqueeText
          text={res.name}
          isHovered={isHovered}
          style={{
            fontSize: 12.5, fontWeight: isChecked ? 600 : 400,
            color: isChecked ? '#fff' : 'rgba(255,255,255,0.8)',
            letterSpacing: 0.3,
          }}
        />
        {/* 行内操作按钮 */}
        {(isHovered || isChecked) && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <ActionCheckbox isChecked={isChecked} onToggle={e => { e.stopPropagation(); onToggle(res.id); }} />
            <ActionDelete onRemove={e => { e.stopPropagation(); onRemove(res.id); }} />
          </div>
        )}
      </div>
    );
  }

  // 视频项：类似音频的列表布局
  if (res.type === 'video') {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px',
          background: isChecked ? `${accentColor}15` : (isHovered ? 'rgba(255,255,255,0.03)' : 'transparent'),
          borderRadius: 10, cursor: 'pointer',
          borderLeft: 'none',
          transition: 'all 0.25s ease',
        }}
        onClick={() => onSelectPreview(res)}
        onDoubleClick={() => onToggle(res.id)}
      >
        <div style={{
          width: 106, height: 62, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
          background: '#000', position: 'relative',
          border: isHovered ? `1px solid ${accentColor}50` : '1px solid rgba(255,255,255,0.06)',
          boxShadow: isHovered ? `0 4px 12px ${accentColor}25` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
          transform: isHovered ? 'scale(1.04)' : 'scale(1)'
        }}>
          <video ref={videoRef} src={`${displaySrc}#t=0.1`} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {isAdded && <div style={{ position: 'absolute', bottom: 4, left: 4, width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981, 0 0 2px #10B981', zIndex: 10 }} title="已添至时间轴" />}
          <div style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 8, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '0 3px', borderRadius: 2 }}>🎬</div>
        </div>
        <HoverMarqueeText
          text={res.name}
          isHovered={isHovered}
          style={{
            fontSize: 12, fontWeight: isChecked ? 500 : 400, color: isChecked ? '#fff' : 'rgba(255,255,255,0.8)'
          }}
        />
        {(isHovered || isChecked) && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <ActionCheckbox isChecked={isChecked} onToggle={e => { e.stopPropagation(); onToggle(res.id); }} />
            <ActionDelete onRemove={e => { e.stopPropagation(); onRemove(res.id); }} />
          </div>
        )}
      </div>
    );
  }

  // 图片项：保持缩略图布局
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px',
        background: isChecked ? `${accentColor}12` : (isHovered ? `${accentColor}08` : 'transparent'),
        borderRadius: 10, cursor: 'pointer',
        borderLeft: 'none',
        transition: 'all 0.25s ease',
      }}
      onClick={() => onSelectPreview(res)}
      onDoubleClick={() => onToggle(res.id)}
    >
      {/* 图片缩略图 */}
      <div style={{
        width: 106, height: 62, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        background: '#151515', display: 'flex', justifyContent: 'center', alignItems: 'center',
        border: isHovered ? `1px solid ${accentColor}50` : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isHovered ? `0 4px 12px ${accentColor}25` : 'none',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        transform: isHovered ? 'scale(1.04)' : 'scale(1)',
        position: 'relative'
      }}>
        {displaySrc ? (
          <img src={displaySrc} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isDNG ? 0.6 : 1 }} alt="" />
        ) : (
          <div style={{ fontSize: 10, opacity: 0.3, color: '#fff' }}>...</div>
        )}
        {isAdded && <div style={{ position: 'absolute', bottom: 4, left: 4, width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981, 0 0 2px #10B981', zIndex: 10 }} title="已添至时间轴" />}
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
                onClick={async (e: React.MouseEvent) => { e.stopPropagation(); setIsConverting(true); await onConvert(res.id); setIsConverting(false); }}
              >{isConverting ? '...' : '转换'}</Button>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <HoverMarqueeText
          text={res.name}
          isHovered={isHovered}
          style={{
            fontSize: 12.5, fontWeight: isChecked ? 500 : 400, color: isChecked ? '#fff' : 'rgba(255,255,255,0.85)'
          }}
        />
        {isDNG && <div style={{ fontSize: 9, color: 'var(--ios-indigo)', letterSpacing: 1, marginTop: 2 }}>RAW</div>}
      </div>

      {/* 行内操作按钮 */}
      {(isHovered || isChecked) && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <ActionCheckbox isChecked={isChecked} onToggle={e => { e.stopPropagation(); onToggle(res.id); }} />
          <ActionDelete onRemove={e => { e.stopPropagation(); onRemove(res.id); }} />
        </div>
      )}
    </div>
  );
});