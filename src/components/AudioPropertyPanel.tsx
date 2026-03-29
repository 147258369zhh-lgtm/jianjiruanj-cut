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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="ios-text" style={{ color: '#C084FC', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🎵 音频实验室</span>
        {selectedAudioIds.size > 1 && (
          <span style={{ fontSize: 11, background: '#10B981', color: '#fff', padding: '4px 10px', borderRadius: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)', transition: 'all 0.2s' }} className="ios-hover-scale" onClick={stitchSelectedAudioGaps}>🧲 缝合所选残片</span>
        )}
      </div>
      <div className="ios-prop-group" style={{ padding: '16px', borderRadius: 16, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>播放音量: {Math.round((audioItems.find(a => selectedAudioIds.has(a.id))?.volume || 1) * 100)}%</span>
          <ProSlider min={0} max={2} step={0.1} value={audioItems.find(a => selectedAudioIds.has(a.id))?.volume || 1} onChange={d => selectedAudioIds.forEach(id => updateAudioItem(id, { volume: d }))} />
        </div>
        {/* 淡入淡出控制 (任务7) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>淡入: {(audioItems.find(a => selectedAudioIds.has(a.id))?.fadeIn || 0).toFixed(1)}s</span>
          <ProSlider min={0} max={5} step={0.1} value={audioItems.find(a => selectedAudioIds.has(a.id))?.fadeIn || 0} onChange={d => selectedAudioIds.forEach(id => updateAudioItem(id, { fadeIn: d }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>淡出: {(audioItems.find(a => selectedAudioIds.has(a.id))?.fadeOut || 0).toFixed(1)}s</span>
          <ProSlider min={0} max={5} step={0.1} value={audioItems.find(a => selectedAudioIds.has(a.id))?.fadeOut || 0} onChange={d => selectedAudioIds.forEach(id => updateAudioItem(id, { fadeOut: d }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <button className={`ios-button ios-button-small ${isEditingAudio ? "ios-button-primary" : "ios-button-outline"}`}
            style={{ height: 34, borderRadius: 8, fontSize: 12 }}
            onClick={() => setIsEditingAudio(!isEditingAudio)}
            disabled={selectedAudioIds.size > 1}
          >
            {isEditingAudio ? "✅ 正在剪辑" : "✂️ 剪辑模式"}
          </button>
          {(isEditingAudio && selectedAudioIds.size === 1) && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="ios-button-small ios-button" style={{ flex: 1 }} onClick={() => {
                const id = Array.from(selectedAudioIds)[0];
                const item = audioItems.find(a => a.id === id);
                if (item) {
                  const boundaries = [0, ...(item.cutPoints || []).sort((a, b) => a - b), item.duration];
                  const allIndices = boundaries.slice(0, -1).map((_, i) => i);
                  const selected = new Set(item.selectedRegions || []);
                  updateAudioItem(id, { selectedRegions: allIndices.filter(i => !selected.has(i)) });
                }
              }}>反选</button>
              <button className="ios-button-small ios-button ios-button-subtle" style={{ flex: 1 }} onClick={() => executeAudioCut(Array.from(selectedAudioIds)[0])}>确认剪除</button>
            </div>
          )}
        </div>
      </div>
      <button className="ios-button ios-button-primary" style={{ marginTop: 20, background: 'rgba(255,59,48,0.15)', color: '#FF453A', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 10, height: 44, fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(255,59,48,0.1)' }} onClick={() => { setAudioItems(p => p.filter(a => !selectedAudioIds.has(a.id))); setSelectedAudioIds(new Set()); setSelectedVoiceoverIds(new Set()); setIsEditingAudio(false); }}>🗑️ 从项目彻底移除选定音频</button>
    </div>
  );
};
