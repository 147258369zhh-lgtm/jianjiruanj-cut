import { useAppContext } from '../hooks/useAppContext';
import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { invoke } from '@tauri-apps/api/core';
import { getMediaDuration } from '../utils/mediaUtils';
import { ResourceCardItem } from './ResourceCardItem';
import { WebMusicPanel } from './WebMusicPanel';
import './LeftPanel.css';

export const LeftPanel: React.FC = () => {
  const {
    resources, setResources, getEffectiveSrc, globalDefaultsRef, commitSnapshotNow, setTimeline, setAudioItems, removeFromLibrary, handleLibToggle, handleLibSelectPreview, handleLibAdd, handleConvertDNG, handleRevealInExplorer, previewCache, handleImport, setVoiceoverClips, addedResourceIds, playTimeRef
  } = useAppContext();
  const {
    leftTab, setLeftTab,
    libTab, setLibTab,
    setStatusMsg,
    selectedResourceIds, setSelectedResourceIds,
  } = useStore(useShallow(state => ({
    leftTab: state.leftTab, setLeftTab: state.setLeftTab,
    libTab: state.libTab, setLibTab: state.setLibTab,
    setStatusMsg: state.setStatusMsg,
    selectedResourceIds: state.selectedResourceIds, setSelectedResourceIds: state.setSelectedResourceIds,
  })));

  // AI 配音与网络爬虫相关状态
  const [musicSubTab, setMusicSubTab] = useState<'audio' | 'tts' | 'web'>('audio');
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('zh-CN-YunyangNeural');
  const [ttsRate, setTtsRate] = useState('+0%');
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [generatedVoiceovers, setGeneratedVoiceovers] = useState<{ id: string; name: string; path: string; duration: number; selected: boolean }[]>([]);

  // 资源列表过滤与虚拟滚动状态
  const [searchQuery, setSearchQuery] = useState('');
  const [libScrollTop, setLibScrollTop] = useState(0);
  const libScrollRef = useRef<HTMLDivElement>(null);

  const filteredResources = useMemo(() => {
    const byType = resources.filter(r => r.type === libTab);
    if (!searchQuery.trim()) return byType;
    const q = searchQuery.toLowerCase();
    return byType.filter(r => r.name.toLowerCase().includes(q));
  }, [resources, libTab, searchQuery]);

  const libItemHeight = (libTab === 'image' || libTab === 'video') ? 72 : 52;
  const libStartIndex = Math.max(0, Math.floor(libScrollTop / libItemHeight) - 3);
  const libEndIndex = Math.min(filteredResources.length - 1, Math.floor((libScrollTop + 800) / libItemHeight) + 8);
  const visibleResources = filteredResources.slice(libStartIndex, libEndIndex + 1);

  return (
    <div className="glass-panel" style={{ width: 336, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

      {/* 三标签头部 */}
      <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--ios-hairline)' }}>
        <div className="ios-segmented-control">
          {([['photo', '照片'], ['music', '音乐'], ['video', '视频']] as const).map(([key, label]) => (
            <div
              key={key}
              className={`ios-segment ${leftTab === key ? 'active' : ''}`}
              onClick={() => { setLeftTab(key); if (key === 'photo') setLibTab('image'); else if (key === 'music') setLibTab('audio'); else if (key === 'video') setLibTab('video'); }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* 左侧内容区 */}
      <>
        {/* 音乐 sub-tab 切换栏 */}
          {leftTab === 'music' && (
            <div style={{ padding: '6px 10px 0' }}>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 3 }}>
                {[{ id: 'audio', label: '🎵 插入音频' }, { id: 'tts', label: '🎙️ AI 配音' }, { id: 'web', label: '🌐 网络曲库' }].map(t => (
                  <div key={t.id} onClick={() => setMusicSubTab(t.id as any)} style={{
                    flex: 1, textAlign: 'center', padding: '5px 0', fontSize: 11, borderRadius: 17, cursor: 'pointer',
                    fontWeight: musicSubTab === t.id ? 'bold' : 'normal',
                    color: musicSubTab === t.id ? '#10B981' : 'rgba(255,255,255,0.45)',
                    background: musicSubTab === t.id ? 'rgba(16,185,129,0.12)' : 'transparent',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}>{t.label}</div>
                ))}
              </div>
            </div>
          )}

          {leftTab === 'music' && musicSubTab === 'tts' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px', flex: 1 }}>
              <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} placeholder="输入需要配音的文字内容..." style={{ width: '100%', height: 80, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '8px 10px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 10, padding: '4px 6px', outline: 'none', cursor: 'pointer' }}>
                  <optgroup label="🎙️ 专业播音" style={{ background: '#1a1a2e', color: '#ccc' }}>
                    <option value="zh-CN-YunyangNeural" style={{ background: '#1a1a2e' }}>云扬 · 新闻播音（推荐）</option>
                    <option value="zh-CN-YunjianNeural" style={{ background: '#1a1a2e' }}>云健 · 热情解说</option>
                  </optgroup>
                  <optgroup label="🎵 自然亲和" style={{ background: '#1a1a2e', color: '#ccc' }}>
                    <option value="zh-CN-YunxiNeural" style={{ background: '#1a1a2e' }}>云希 · 阳光男声</option>
                    <option value="zh-CN-XiaoxiaoNeural" style={{ background: '#1a1a2e' }}>晓晓 · 温暖女声</option>
                    <option value="zh-CN-XiaoyiNeural" style={{ background: '#1a1a2e' }}>晓依 · 活泼女声</option>
                    <option value="zh-CN-YunxiaNeural" style={{ background: '#1a1a2e' }}>云夏 · 少年男声</option>
                  </optgroup>
                </select>
                <select value={ttsRate} onChange={e => setTtsRate(e.target.value)} style={{ width: 66, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 10, padding: '4px 4px', outline: 'none', cursor: 'pointer' }}>
                  <option value="-30%" style={{ background: '#1a1a2e' }}>0.7x</option>
                  <option value="-20%" style={{ background: '#1a1a2e' }}>0.8x</option>
                  <option value="-10%" style={{ background: '#1a1a2e' }}>0.9x</option>
                  <option value="+0%" style={{ background: '#1a1a2e' }}>1.0x</option>
                  <option value="+10%" style={{ background: '#1a1a2e' }}>1.1x</option>
                  <option value="+20%" style={{ background: '#1a1a2e' }}>1.2x</option>
                  <option value="+50%" style={{ background: '#1a1a2e' }}>1.5x</option>
                  <option value="+100%" style={{ background: '#1a1a2e' }}>2.0x</option>
                </select>
              </div>
              <button disabled={ttsGenerating || !ttsText.trim()} onClick={async () => {
                setTtsGenerating(true); setStatusMsg('🎙️ 正在生成配音...');
                try {
                  const filePath: string = await invoke('generate_tts', { req: { text: ttsText, voice: ttsVoice, rate: ttsRate } });
                  const dur = await getMediaDuration(filePath);
                  const name = `配音_${(generatedVoiceovers.length + 1).toString().padStart(3, '0')}`;
                  setGeneratedVoiceovers(prev => [...prev, { id: `vo_${Date.now()}`, name, path: filePath, duration: dur, selected: false }]);
                  setStatusMsg(`✅ ${name} 已生成 (${dur.toFixed(1)}s)`);
                } catch (err: any) { setStatusMsg(`❌ 配音失败: ${err?.toString()?.substring(0, 80)}`); }
                setTtsGenerating(false); setTimeout(() => setStatusMsg(''), 3000);
              }} style={{ width: '100%', height: 34, borderRadius: 8, border: 'none', cursor: ttsGenerating || !ttsText.trim() ? 'not-allowed' : 'pointer', background: ttsGenerating ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontWeight: 600, fontSize: 12, opacity: ttsGenerating || !ttsText.trim() ? 0.5 : 1 }}>
                {ttsGenerating ? '⏳ 生成中...' : '🎙️ 生成配音'}
              </button>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4, flex: 1, overflowY: 'auto' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>已生成的配音</div>
                {generatedVoiceovers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, opacity: 0.15, fontSize: 10 }}>暂无配音，输入文字后点击生成</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {generatedVoiceovers.map(vo => (
                      <div key={vo.id} onClick={() => setGeneratedVoiceovers(prev => prev.map(v => v.id === vo.id ? { ...v, selected: !v.selected } : v))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: vo.selected ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${vo.selected ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                        <span style={{ fontSize: 14 }}>🎙️</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vo.name}</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{vo.duration.toFixed(1)}s</div>
                        </div>
                        <div style={{ width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: vo.selected ? '#10B981' : 'rgba(255,255,255,0.06)', fontSize: 10, color: '#fff' }}>{vo.selected ? '✓' : ''}</div>
                        <div onClick={(e) => { e.stopPropagation(); setGeneratedVoiceovers(prev => prev.filter(v => v.id !== vo.id)); }} style={{ width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>✕</div>
                      </div>
                    ))}
                  </div>
                )}
                {generatedVoiceovers.some(v => v.selected) && (
                  <button onClick={() => {
                    commitSnapshotNow();
                    const selected = generatedVoiceovers.filter(v => v.selected);
                    setVoiceoverClips((prev: any[]) => {
                      // 如果配音轨为空，从0开始；否则从播放头位置插入
                      let sp = prev.length === 0 ? 0 : playTimeRef.current;
                      return [...prev, ...selected.map((vo, i) => {
                        const mapped = { id: `vc_${Date.now()}_${i}`, resourceId: vo.id, path: vo.path, name: vo.name, timelineStart: sp, startOffset: 0, duration: vo.duration, volume: 1.0 };
                        sp += vo.duration;
                        return mapped;
                      })];
                    });
                    setGeneratedVoiceovers(prev => prev.map(v => ({ ...v, selected: false })));
                    setStatusMsg(`✅ 已插入 ${selected.length} 段配音到配音轨`);
                    setTimeout(() => setStatusMsg(''), 1500);
                  }} style={{ width: '100%', height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', marginTop: 6, background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontWeight: 600, fontSize: 11 }}>
                    + 插入 {generatedVoiceovers.filter(v => v.selected).length} 段到配音轨
                  </button>
                )}
              </div>
            </div>
          ) : leftTab === 'music' && musicSubTab === 'web' ? (
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, marginTop: 10 }}>
              <WebMusicPanel />
            </div>
          ) : (
            <>
              <div style={{ padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'stretch' }}>
                {/* 左列：巨大的导入按钮 */}
                <button 
                  className="ios-button-primary" 
                  style={{ 
                    width: 106,
                    flexShrink: 0, 
                    borderRadius: 8,
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 4,
                    padding: '8px 4px'
                  }}
                  onClick={() => handleImport(libTab as 'image' | 'audio' | 'video')}
                >
                  <div style={{ fontSize: 18, lineHeight: 1 }}>{libTab === 'image' ? '📸' : libTab === 'audio' ? '🎵' : '🎬'}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                    导入{libTab === 'image' ? '照片' : libTab === 'audio' ? '音乐' : '视频'}
                  </div>
                </button>

                {/* 右列：搜索 + 操作区 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <input className="ios-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 搜索..." style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                  
                  <div style={{ display: 'flex', gap: 4, alignItems: 'stretch', flex: 1 }}>
                    <button className="ios-button-small ios-button" style={{ flex: 1, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', boxShadow: 'none', fontSize: 11, padding: '0 4px', color: 'rgba(255,255,255,0.8)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => { const allIds = filteredResources.map(r => r.id); if (selectedResourceIds.size === allIds.length && allIds.length > 0) setSelectedResourceIds(new Set()); else setSelectedResourceIds(new Set(allIds)); }}>
                      {filteredResources.length > 0 && selectedResourceIds.size === filteredResources.length ? '反选' : '全选'}
                    </button>
                    <button className="ios-button-small ios-button ios-button-primary" disabled={selectedResourceIds.size === 0} style={{ flex: 1.2, borderRadius: 8, background: selectedResourceIds.size > 0 ? 'var(--ios-indigo)' : 'rgba(255,255,255,0.06)', color: selectedResourceIds.size > 0 ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: 11, border: 'none', boxShadow: 'none', padding: '0 4px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={async () => {
                      const selectedList = resources.filter(r => r.type === libTab && selectedResourceIds.has(r.id));
                      const pt = playTimeRef.current;
                      let audioSp = pt;
                      
                      const newVideoItems: any[] = [];
                      const newAudioItems: any[] = [];

                      for (const r of selectedList) {
                        if (r.type === 'image' || r.type === 'video') {
                          let fileDur = 3;
                          if (r.type === 'video') {
                            fileDur = await getMediaDuration(r.path);
                          }
                          newVideoItems.push({ id: `tm_${Date.now()}_${Math.random()}`, resourceId: r.id, duration: fileDur, transition: 'fade' as any, rotation: 0, contrast: 1.0, saturation: 1.0, exposure: 1.0, brilliance: 1.0, temp: 0, tint: 0, zoom: 1.0, highlights: 1.0, shadows: 1.0, whites: 1.0, blacks: 1.0, vibrance: 1.0, sharpness: 0, fade: 0, vignette: 0, grain: 0, fontSize: 24, fontWeight: 'normal' });
                        } else if (r.type === 'audio') {
                          const dur = await getMediaDuration(r.path);
                          newAudioItems.push({ id: `au_${Date.now()}_${Math.random()}`, resourceId: r.id, timelineStart: audioSp, startOffset: 0, duration: dur, volume: 1.0 });
                          audioSp += dur;
                        }
                      }
                      
                      if (newVideoItems.length > 0) {
                        setTimeline(prev => {
                          let insertIndex = prev.length;
                          let sum = 0;
                          for (let i = 0; i < prev.length; i++) {
                            const nextSum = sum + prev[i].duration;
                            if (pt >= sum && pt <= nextSum) {
                              const distStart = pt - sum;
                              const distEnd = nextSum - pt;
                              insertIndex = distStart < distEnd ? i : i + 1;
                              break;
                            }
                            sum = nextSum;
                          }
                          if (insertIndex === prev.length && pt < sum) insertIndex = prev.length;
                          const newTimeline = [...prev];
                          newTimeline.splice(insertIndex, 0, ...newVideoItems);
                          return newTimeline;
                        });
                      }
                      
                      if (newAudioItems.length > 0) {
                        setAudioItems(prev => {
                          // 如果音频轨为空，重新计算起始位置从0开始
                          if (prev.length === 0) {
                            let sp = 0;
                            const adjusted = newAudioItems.map(a => {
                              const item = { ...a, timelineStart: sp };
                              sp += a.duration;
                              return item;
                            });
                            return [...prev, ...adjusted];
                          }
                          return [...prev, ...newAudioItems];
                        });
                      }

                      setSelectedResourceIds(new Set());
                    }}>
                      {selectedResourceIds.size > 0 ? `+ 编入${selectedResourceIds.size}` : '+ 轨道'}
                    </button>
                    <button className="ios-button-small ios-button" disabled={selectedResourceIds.size === 0} style={{ flexShrink: 0, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', boxShadow: 'none', width: 28, minWidth: 28, padding: 0, fontSize: 12, color: selectedResourceIds.size > 0 ? '#FF3B30' : 'rgba(255,255,255,0.3)' }} onClick={() => removeFromLibrary(selectedResourceIds)}>🗑</button>
                  </div>
                </div>
              </div>
              <div className="custom-media-scroll" ref={libScrollRef} onScroll={(e) => setLibScrollTop(e.currentTarget.scrollTop)} style={{ flex: 1, overflowY: 'auto', position: 'relative', overflowX: 'hidden' }}>
                {filteredResources.length === 0 ? (
                  <div style={{ textAlign: 'center', marginTop: 60, opacity: 0.2, fontSize: 11 }}>{leftTab === 'photo' ? '暂无照片，点击顶部 📥导入' : '暂无音乐'}</div>
                ) : (
                  <div style={{ height: filteredResources.length * libItemHeight, position: 'relative' }}>
                    {visibleResources.map((res, idx) => {
                      const absIndex = libStartIndex + idx; return (
                        <div key={res.id} style={{ position: 'absolute', top: absIndex * libItemHeight, width: '100%', height: libItemHeight, padding: '0', boxSizing: 'border-box' }}>
                          <ResourceCardItem res={res} isChecked={selectedResourceIds.has(res.id)} isAdded={addedResourceIds.has(res.id)} onToggle={handleLibToggle} onSelectPreview={handleLibSelectPreview} onRemove={removeFromLibrary} onConvert={handleConvertDNG} onReveal={handleRevealInExplorer} previewUrl={previewCache[res.path]} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
    </div>
  );
};
