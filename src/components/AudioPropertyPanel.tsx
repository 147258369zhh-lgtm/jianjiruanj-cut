import React from 'react';
import ProSlider from './ProSlider';
import { AudioTimelineItem } from '../types';

interface AudioPropertyPanelProps {
  selectedAudioIds: Set<string>;
  setSelectedAudioIds: (val: Set<string>) => void;
  setSelectedVoiceoverIds: (val: Set<string>) => void;
  audioItems: AudioTimelineItem[];
  setAudioItems: React.Dispatch<React.SetStateAction<AudioTimelineItem[]>>;
  updateAudioItem: (id: string, patch: Partial<AudioTimelineItem>, isDragging?: boolean) => void;
  isEditingAudio: boolean;
  setIsEditingAudio: (val: boolean) => void;
  executeAudioCut: (id: string) => void;
  stitchSelectedAudioGaps: () => void;
}

export const AudioPropertyPanel: React.FC<AudioPropertyPanelProps> = ({
  selectedAudioIds,
  setSelectedAudioIds,
  setSelectedVoiceoverIds,
  audioItems,
  setAudioItems,
  updateAudioItem,
  isEditingAudio,
  setIsEditingAudio,
  executeAudioCut,
  stitchSelectedAudioGaps
}) => {
  const selectedItem = audioItems.find(a => selectedAudioIds.has(a.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      
      {/* GROUP 1: 音频专属属性卡片 */}
      <div className="ios-prop-group" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#A855F7', letterSpacing: 1 }}>🎵 基础音轨设定 {selectedAudioIds.size > 1 && <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>({selectedAudioIds.size} 项)</span>}</span>
          {selectedAudioIds.size > 1 && (
            <span style={{ fontSize: 11, background: 'rgba(168,85,247,0.2)', color: '#D8B4FE', padding: '4px 10px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid rgba(168,85,247,0.3)' }} className="ios-hover-scale" onClick={stitchSelectedAudioGaps}>🧲 缝合分段</span>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid rgba(168,85,247,0.1)' }}>
          {([
            ['volume', '轨道音量', 0, 2, 0.05, 1, 'linear-gradient(90deg, rgba(168,85,247,0.2), #A855F7)'],
            ['fadeIn', '平滑淡入', 0, 5, 0.1, 0, 'linear-gradient(90deg, rgba(192,132,252,0.2), #C084FC)'],
            ['fadeOut', '平滑淡出', 0, 5, 0.1, 0, 'linear-gradient(90deg, rgba(192,132,252,0.2), #C084FC)']
          ] as any).map(([key, label, min, max, step, defVal, gradient]: any) => {
            const val = selectedItem ? (selectedItem as any)[key] !== undefined ? (selectedItem as any)[key] : defVal : defVal;
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#C084FC', fontVariantNumeric: 'tabular-nums' }}>
                    {key === 'volume' ? Math.round(val * 100) + '%' : Number(val).toFixed(step < 1 ? 1 : 0) + 's'}
                  </span>
                </div>
                <ProSlider 
                  min={min} max={max} step={step} value={val} 
                  onChange={d => selectedAudioIds.forEach(id => updateAudioItem(id, { [key]: d }))} 
                  gradient={gradient}
                />
              </div>
            );
          })}
        </div>

        {/* 剪辑模块 */}
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(168,85,247,0.1)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>波形段落剪辑</div>
          <button className={`ios-button ios-button-small ${isEditingAudio ? "ios-button-primary" : "ios-button-outline"}`}
            style={{ height: 34, borderRadius: 8, fontSize: 12, background: isEditingAudio ? '#A855F7' : 'transparent', border: `1px solid ${isEditingAudio ? '#A855F7' : 'rgba(255,255,255,0.2)'}` }}
            onClick={() => setIsEditingAudio(!isEditingAudio)}
            disabled={selectedAudioIds.size > 1}
          >
            {isEditingAudio ? "✅ 波形剪辑状态 (活跃)" : "✂️ 进入波形剪辑模式"}
          </button>
          
          {(isEditingAudio && selectedAudioIds.size === 1) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button className="ios-button-small ios-button" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={() => {
                const id = Array.from(selectedAudioIds)[0];
                const item = audioItems.find(a => a.id === id);
                if (item) {
                  const boundaries = [0, ...(item.cutPoints || []).sort((a, b) => a - b), item.duration];
                  const allIndices = boundaries.slice(0, -1).map((_, i) => i);
                  const selected = new Set(item.selectedRegions || []);
                  updateAudioItem(id, { selectedRegions: allIndices.filter(i => !selected.has(i)) });
                }
              }}>🔄 反选</button>
              <button className="ios-button-small ios-button ios-button-subtle" style={{ flex: 1, background: 'rgba(239,68,68,0.2)', color: '#EF4444' }} onClick={() => executeAudioCut(Array.from(selectedAudioIds)[0])}>🗑️ 确认剪除红区</button>
            </div>
          )}
        </div>

        <button className="ios-button ios-button-primary" style={{ marginTop: 8, background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, height: 40, fontWeight: 600, transition: 'all 0.2s', boxShadow: 'none' }} onClick={() => {
          setAudioItems(p => p.filter(a => !selectedAudioIds.has(a.id)));
          setSelectedAudioIds(new Set());
          setSelectedVoiceoverIds(new Set());
          setIsEditingAudio(false);
        }}>
          🗑️ 彻底删除选定的音频轨
        </button>
      </div>
    </div>
  );
};
