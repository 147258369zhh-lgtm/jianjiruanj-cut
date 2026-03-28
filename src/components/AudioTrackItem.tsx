import React, { memo, useRef, useState, useMemo } from 'react';
import { AudioTimelineItem } from '../types';
import { AUDIO_PALETTES } from '../utils/constants';
import { AudioWaveform } from './AudioWaveform';


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

export const AudioTrackItem = memo(({ item, resource, isSelected, onSelect, pps, isPlaying, editingMode, onUpdateItem }: AudioTrackItemProps) => {
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