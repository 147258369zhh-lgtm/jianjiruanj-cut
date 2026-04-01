import React, { useState } from 'react';
import { TimelineItem } from '../types';
import { FILTER_PRESETS, FilterPreset } from '../features/filter-engine/filterPresets';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

interface FilterPresetGridProps {
  selectedIds: Set<string>;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineItem[]>>;
  commitSnapshotNow: () => void;
  setStatusMsg: (msg: string) => void;
  selectedItem?: TimelineItem;
}

export const FilterPresetGrid: React.FC<FilterPresetGridProps> = ({
  selectedIds,
  setTimeline,
  commitSnapshotNow,
  setStatusMsg,
  selectedItem: _selectedItem
}) => {
  const { customFilters, hiddenFilterNames, setCustomFilters, setHiddenFilterNames, setHoveredPreviewPreset } = useStore(useShallow(s => ({
    customFilters: s.customFilters,
    hiddenFilterNames: s.hiddenFilterNames,
    setCustomFilters: s.setCustomFilters,
    setHiddenFilterNames: s.setHiddenFilterNames,
    setHoveredPreviewPreset: s.setHoveredPreviewPreset
  })));

  const [showRestoreModal, setShowRestoreModal] = useState(false);


  // We are completely ditching buggy Drag & Drop and Context Menus
  // Right click immediately folds the filter.

  const applyPreset = (preset: FilterPreset) => {
    commitSnapshotNow();
    setTimeline(prev => prev.map(t => selectedIds.has(t.id) ? {
      ...t,
      exposure: preset.exposure,
      contrast: preset.contrast,
      saturation: preset.saturation,
      temp: preset.temp,
      tint: preset.tint,
      brilliance: preset.brilliance,
      highlights: preset.highlights ?? t.highlights,
      shadows: preset.shadows ?? t.shadows,
      whites: preset.whites ?? t.whites,
      blacks: preset.blacks ?? t.blacks,
      vignette: preset.vignette ?? t.vignette,
      fade: preset.fade ?? t.fade,
      grain: preset.grain ?? t.grain,
      curveMaster: preset.curveMaster ? JSON.parse(JSON.stringify(preset.curveMaster)) : t.curveMaster,
      curveRed: preset.curveRed ? JSON.parse(JSON.stringify(preset.curveRed)) : t.curveRed,
      curveGreen: preset.curveGreen ? JSON.parse(JSON.stringify(preset.curveGreen)) : t.curveGreen,
      curveBlue: preset.curveBlue ? JSON.parse(JSON.stringify(preset.curveBlue)) : t.curveBlue,
      ...(preset.name === '重置' ? {
        curveMaster: undefined, curveRed: undefined, curveGreen: undefined, curveBlue: undefined,
        fade: 0, vignette: 0, grain: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0
      } : {})
    } : t));
    setStatusMsg(`✨ 已应用 ${preset.name} 预设`);
  };

  const foldOrDeletePreset = (preset: FilterPreset) => {
    if (preset.isCustom) {
      if (window.confirm(`🚨 确定要彻底删除专属滤镜「${preset.name}」吗？`)) {
        setCustomFilters(customFilters.filter(f => f.name !== preset.name));
        setStatusMsg(`🗑️ 已彻底删除「${preset.name}」`);
        setTimeout(() => setStatusMsg(''), 1500);
      }
    } else {
      if (!hiddenFilterNames.includes(preset.name)) {
        setHiddenFilterNames([...hiddenFilterNames, preset.name]);
        setStatusMsg(`📦 已将「${preset.name}」移入折叠收纳舱`);
        setTimeout(() => setStatusMsg(''), 1500);
      }
    }
  };

  const restoreFilter = (name: string) => {
    setHiddenFilterNames(hiddenFilterNames.filter(n => n !== name));
  };
  
  const allFilters = [...FILTER_PRESETS, ...customFilters];
  const visibleFilters = allFilters.filter(f => !hiddenFilterNames.includes(f.name));
  const hiddenFiltersList = allFilters.filter(f => hiddenFilterNames.includes(f.name));

  return (
    <div 
      className="filter-preset-scroll ios-scroll-hidden" 
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 'none', paddingRight: 4, marginLeft: -4 }}
    >
      {visibleFilters.map((preset) => (
        <div
          key={preset.name}
          className="filter-preset-card"
          onContextMenu={(e) => {
             e.preventDefault();
             e.stopPropagation();
             foldOrDeletePreset(preset);
          }}
          onMouseEnter={() => setHoveredPreviewPreset(preset)}
          onMouseLeave={() => setHoveredPreviewPreset(null)}
          style={{ padding: '8px 0px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => {
            applyPreset(preset);
            setHoveredPreviewPreset(null); // Click confirms it, no need to hover preview it anymore
          }}
          title="点击应用滤镜，右键直接折叠隐藏"
        >
          <div style={{ display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            <span style={{ flexShrink: 0, fontSize: 13, marginRight: 6 }}>{preset.icon}</span>
            <span style={{ width: preset.isCustom ? 'auto' : 42, display: 'flex', justifyContent: preset.isCustom ? 'center' : 'space-between', fontSize: 11, whiteSpace: 'nowrap', fontWeight: 500, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {preset.isCustom ? preset.name : preset.name.split('').map((c, i) => <span key={i}>{c}</span>)}
            </span>
          </div>
        </div>
      ))}

      {/* 🗑️ 滤镜收纳舱 卡片 */}
      <div
        className="filter-preset-card"
        onClick={() => {
          if (hiddenFilterNames.length === 0) {
             setStatusMsg('📦 收纳舱为空，右键点击不用的滤镜即可将其收入哦');
             setTimeout(() => setStatusMsg(''), 1500);
             return;
          }
          setShowRestoreModal(true);
        }}
        style={{ 
          padding: '8px 0px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          border: '1px dashed rgba(239,68,68,0.4)', 
          backgroundColor: 'rgba(239,68,68,0.05)',
          transition: 'all 0.2s', cursor: 'pointer'
        }}
        title="点击展开收纳舱，查看或恢复已折叠的滤镜"
      >
         <span style={{ fontSize: 11, fontWeight: 500, color: '#ef4444', pointerEvents: 'none' }}>📦 折叠收纳舱</span>
      </div>

      {/* 展开已隐藏滤镜的轻量蒙版 */}
      {showRestoreModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(20,20,30,0.95)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 'bold', color: '#10B981' }}>📦 收纳舱 (点击恢复)</span>
            <span style={{ cursor: 'pointer', fontSize: 16, opacity: 0.7 }} onClick={() => setShowRestoreModal(false)}>✕</span>
          </div>
          <div className="ios-scroll-hidden" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, overflowY: 'auto', alignContent: 'start' }}>
            {hiddenFiltersList.map(preset => (
              <div
                key={preset.name}
                className="filter-preset-card"
                style={{ padding: '8px 0px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, cursor: 'pointer' }}
                onClick={() => restoreFilter(preset.name)}
                title="点击恢复到可用滤镜列表"
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ flexShrink: 0, fontSize: 13, marginRight: 6 }}>{preset.icon}</span>
                  <span style={{ width: preset.isCustom ? 'auto' : 42, display: 'flex', justifyContent: preset.isCustom ? 'center' : 'space-between', fontSize: 11, whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {preset.isCustom ? preset.name : preset.name.split('').map((c, i) => <span key={i}>{c}</span>)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
