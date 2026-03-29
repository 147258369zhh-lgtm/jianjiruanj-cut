import React, { useState } from 'react';
import { TimelineItem } from '../types';
import { FILTER_PRESETS, FilterPreset } from '../features/filter-engine/filterPresets';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

interface CreateFilterButtonProps {
  selectedItem?: TimelineItem;
  setStatusMsg: (msg: string) => void;
}

export const CreateFilterButton: React.FC<CreateFilterButtonProps> = ({
  selectedItem,
  setStatusMsg
}) => {
  const { customFilters, setCustomFilters } = useStore(useShallow(s => ({
    customFilters: s.customFilters,
    setCustomFilters: s.setCustomFilters,
  })));

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('我的专属滤镜');

  const handleCreateCustom = () => {
    if (!selectedItem) {
      setStatusMsg('⚠️ 请先选中一个已调色的片段');
      setTimeout(() => setStatusMsg(''), 1500);
      setShowCreateModal(false);
      return;
    }
    const name = newFilterName.trim();
    if (!name) return;

    if ([...FILTER_PRESETS, ...customFilters].some(f => f.name === name)) {
      setStatusMsg('⚠️ 滤镜名已存在，请换一个名字');
      setTimeout(() => setStatusMsg(''), 1500);
      return;
    }

    const newPreset: FilterPreset = {
      icon: '🎨',
      name,
      isCustom: true,
      exposure: selectedItem.exposure ?? 1.0,
      contrast: selectedItem.contrast ?? 1.0,
      saturation: selectedItem.saturation ?? 1.0,
      temp: selectedItem.temp ?? 0,
      tint: selectedItem.tint ?? 0,
      brilliance: selectedItem.brilliance ?? 1.0,
      highlights: selectedItem.highlights,
      shadows: selectedItem.shadows,
      whites: selectedItem.whites,
      blacks: selectedItem.blacks,
      vignette: selectedItem.vignette,
      fade: selectedItem.fade,
      grain: selectedItem.grain,
      curveMaster: selectedItem.curveMaster ? JSON.parse(JSON.stringify(selectedItem.curveMaster)) : undefined,
      curveRed: selectedItem.curveRed ? JSON.parse(JSON.stringify(selectedItem.curveRed)) : undefined,
      curveGreen: selectedItem.curveGreen ? JSON.parse(JSON.stringify(selectedItem.curveGreen)) : undefined,
      curveBlue: selectedItem.curveBlue ? JSON.parse(JSON.stringify(selectedItem.curveBlue)) : undefined,
    };

    setCustomFilters([...customFilters, newPreset]);
    setShowCreateModal(false);
    setStatusMsg(`✅ 自定义滤镜「${name}」已保存！可以在一键滤镜预设中找到它。`);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  return (
    <div style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={() => {
          if (!selectedItem) {
            setStatusMsg('⚠️ 请先选中一个已调色的片段');
            setTimeout(() => setStatusMsg(''), 1500);
            return;
          }
          setShowCreateModal(true);
        }}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}
        className="ios-hover-scale"
        title="抓取当前所有的颜色参数，另存为你的专属滤镜"
      >
        <span>🎨 保存当前参数为「我的专属滤镜」</span>
      </button>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center', lineHeight: 1.4 }}>
        一键捕获上方的曝光、色彩曲线及暗角参数<br/>并生成永久卡片
      </span>

      {/* 建立滤镜 精致弹窗 */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: 320, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#fff', fontWeight: 600 }}>保存为自定义滤镜</h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.5 }}>
              此操作会将当前您辛勤调出的一切参数（包含所有曲线色彩）打包固定下来。
            </p>
            <input 
              autoFocus
              value={newFilterName}
              onChange={e => setNewFilterName(e.target.value)}
              placeholder="例如：冷调赛博朋克风..."
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 8, outline: 'none', marginBottom: 24, fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13, padding: '8px 16px' }}>取消</button>
              <button 
                onClick={handleCreateCustom} 
                style={{ background: '#10B981', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: '8px 20px', borderRadius: 8, fontWeight: 500, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
              >确认封装滤镜</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
