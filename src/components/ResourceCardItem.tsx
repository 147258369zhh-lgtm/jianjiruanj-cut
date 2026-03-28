import React, { memo, useState, useMemo } from 'react';
import { Button } from "@fluentui/react-components";
import { convertFileSrc } from '@tauri-apps/api/core';

export const ResourceCardItem = memo(({ res, isAdded, isChecked, onToggle, onSelectPreview, onAdd, onRemove, onConvert, onReveal: _onReveal, previewUrl }: any) => {
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
                onClick={async (e: React.MouseEvent) => { e.stopPropagation(); setIsConverting(true); await onConvert(res.id); setIsConverting(false); }}
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