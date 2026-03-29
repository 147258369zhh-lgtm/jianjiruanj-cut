import React from 'react';
import ProSlider from './ProSlider';

interface VoiceoverPropertyPanelProps {
  selectedVoiceoverIds: Set<string>;
  setSelectedAudioIds: (val: Set<string>) => void;
  setSelectedVoiceoverIds: (val: Set<string>) => void;
  voiceoverClips: any[];
  setVoiceoverClips: React.Dispatch<React.SetStateAction<any[]>>;
}

export const VoiceoverPropertyPanel: React.FC<VoiceoverPropertyPanelProps> = ({
  selectedVoiceoverIds,
  setSelectedAudioIds,
  setSelectedVoiceoverIds,
  voiceoverClips,
  setVoiceoverClips,
}) => {
  const updateVoiceoverItem = (id: string, patch: Partial<any>) => {
    setVoiceoverClips(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));
  };

  const selectedItem = voiceoverClips.find(v => selectedVoiceoverIds.has(v.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      
      {/* GROUP 1: 配音专属属性卡片 */}
      <div className="ios-prop-group" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#10B981', letterSpacing: 1 }}>🎙️ AI 配音工坊 {selectedVoiceoverIds.size > 1 && <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>({selectedVoiceoverIds.size} 项)</span>}</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid rgba(16,185,129,0.1)' }}>
          {([
            ['volume', '配音音量', 0, 2, 0.05, 1, 'linear-gradient(90deg, rgba(16,185,129,0.2), #10B981)'],
            ['fadeIn', '平滑淡入', 0, 5, 0.1, 0, 'linear-gradient(90deg, rgba(52,211,153,0.2), #34D399)'],
            ['fadeOut', '平滑淡出', 0, 5, 0.1, 0, 'linear-gradient(90deg, rgba(52,211,153,0.2), #34D399)']
          ] as any).map(([key, label, min, max, step, defVal, gradient]: any) => {
            const val = selectedItem ? (selectedItem[key] !== undefined ? selectedItem[key] : defVal) : defVal;
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#10B981', fontVariantNumeric: 'tabular-nums' }}>
                    {key === 'volume' ? Math.round(val * 100) + '%' : Number(val).toFixed(step < 1 ? 1 : 0) + 's'}
                  </span>
                </div>
                <ProSlider 
                  min={min} max={max} step={step} value={val} 
                  onChange={d => selectedVoiceoverIds.forEach(id => updateVoiceoverItem(id, { [key]: d }))} 
                  gradient={gradient}
                />
              </div>
            );
          })}
        </div>

        <button className="ios-button ios-button-primary" style={{ marginTop: 8, background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, height: 40, fontWeight: 600, transition: 'all 0.2s', boxShadow: 'none' }} onClick={() => {
          setVoiceoverClips(p => p.filter(v => !selectedVoiceoverIds.has(v.id)));
          setSelectedVoiceoverIds(new Set());
          setSelectedAudioIds(new Set());
        }}>
          🗑️ 彻底删除选定的配音轨
        </button>
      </div>
    </div>
  );
};
