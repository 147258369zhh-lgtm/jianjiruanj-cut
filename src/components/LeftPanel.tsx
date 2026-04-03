import { useAppContext } from '../hooks/useAppContext';
import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { invoke } from '@tauri-apps/api/core';
import { getMediaDuration } from '../utils/mediaUtils';
import { ResourceCardItem } from './ResourceCardItem';
import { WebMusicPanel } from './WebMusicPanel';
import './LeftPanel.css';

const TTS_VOICES = [
  { id: 'zh-CN-F-QingCui', label: '清脆女声', gender: 'F', icon: '💁‍♀️' },
  { id: 'zh-CN-F-RouMei', label: '柔美女声', gender: 'F', icon: '🌸' },
  { id: 'zh-CN-F-ZhiXing', label: '知性女声', gender: 'F', icon: '👩‍🏫' },
  { id: 'zh-CN-F-QingLeng', label: '清冷御姐', gender: 'F', icon: '❄️' },
  { id: 'zh-CN-F-HuoPo', label: '活泼女大', gender: 'F', icon: '🎒' },
  { id: 'zh-CN-F-BaQi', label: '霸气女主', gender: 'F', icon: '👑' },
  { id: 'zh-CN-F-TianZhen', label: '天真萝莉', gender: 'F', icon: '🎀' },
  { id: 'zh-CN-F-WenWan', label: '温婉闺蜜', gender: 'F', icon: '🍵' },
  { id: 'zh-CN-F-LuoLi', label: '傲娇幼女', gender: 'F', icon: '🦋' },
  { id: 'zh-CN-F-ZhiBo', label: '电台女播', gender: 'F', icon: '📻' },
  { id: 'zh-CN-M-WenZhong', label: '稳重男声', gender: 'M', icon: '👨‍💼' },
  { id: 'zh-CN-M-QingNian', label: '青年男声', gender: 'M', icon: '🎧' },
  { id: 'zh-CN-M-YangGuang', label: '阳光少年', gender: 'M', icon: '🏀' },
  { id: 'zh-CN-M-ZhiYu', label: '治愈暖男', gender: 'M', icon: '☕' },
  { id: 'zh-CN-M-DaShu', label: '沧桑大叔', gender: 'M', icon: '🚬' },
  { id: 'zh-CN-M-BaZong', label: '霸道总裁', gender: 'M', icon: '🥂' },
  { id: 'zh-CN-M-ZhengTai', label: '清心正太', gender: 'M', icon: '👦' },
  { id: 'zh-CN-M-DuoLuo', label: '慵懒男主', gender: 'M', icon: '🛋️' },
  { id: 'zh-CN-M-DiYin', label: '深感低音', gender: 'M', icon: '🎵' },
  { id: 'zh-CN-M-XinWen', label: '新闻男播', gender: 'M', icon: '🎙️' },
];



export const LeftPanel: React.FC = () => {
  const {
    resources, setResources: _setResources, getEffectiveSrc: _getEffectiveSrc, globalDefaultsRef: _globalDefaultsRef, commitSnapshotNow, setTimeline, setAudioItems, removeFromLibrary, handleLibToggle, handleLibSelectPreview, handleLibAdd: _handleLibAdd, handleConvertDNG, handleRevealInExplorer, previewCache, handleImport, setVoiceoverClips, addedResourceIds, playTimeRef
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
  const [ttsVoice, setTtsVoice] = useState('zh-CN-F-QingCui');
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const selectedVoiceObj = TTS_VOICES.find(v => v.id === ttsVoice) || TTS_VOICES[0];
  const [ttsRate, setTtsRate] = useState(1.0);
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
    <div className="glass-panel" style={{ flex: '0 0 24%', minWidth: 260, maxWidth: 360, display: 'flex', flexDirection: 'column' }}>

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <div 
                      onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#fff', fontSize: 11 }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{selectedVoiceObj.icon}</span>
                        <span style={{ fontWeight: 500 }}>{selectedVoiceObj.label}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>({selectedVoiceObj.gender === 'F' ? '女声' : '男声'})</span>
                      </span>
                      <span style={{ transform: isVoiceDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.5 }}>▼</span>
                    </div>
                    {isVoiceDropdownOpen && (
                      <>
                        <div onClick={() => setIsVoiceDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 4, zIndex: 100, maxHeight: 180, overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {['F', 'M'].map(gender => (
                            <React.Fragment key={gender}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '6px 8px 2px 8px' }}>{gender === 'F' ? '🎙️ 女声系列' : '🎵 男声系列'}</div>
                              {TTS_VOICES.filter(v => v.gender === gender).map(v => (
                                <div 
                                  key={v.id}
                                  onClick={() => { setTtsVoice(v.id); setIsVoiceDropdownOpen(false); }}
                                  style={{ padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: ttsVoice === v.id ? 'rgba(16,185,129,0.15)' : 'transparent', color: ttsVoice === v.id ? '#10B981' : '#fff', fontSize: 11, transition: 'background 0.15s' }}
                                >
                                  <span style={{ fontSize: 14 }}>{v.icon}</span>
                                  <span>{v.label}</span>
                                  {ttsVoice === v.id && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                                </div>
                              ))}
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '0 10px', borderRadius: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>速 {ttsRate.toFixed(2)}x</span>
                    <input 
                      type="range" 
                      min="0.5" max="2.0" step="0.01" 
                      value={ttsRate} 
                      onChange={e => setTtsRate(parseFloat(e.target.value))} 
                      onDoubleClick={() => setTtsRate(1.0)}
                      title="双击恢复 1.0x 原速"
                      style={{ flex: 1, accentColor: '#10B981', cursor: 'pointer', margin: 0, minWidth: 50 }}
                    />
                  </div>
                </div>
              </div>
              <button disabled={ttsGenerating || !ttsText.trim()} onClick={async () => {
                setTtsGenerating(true); setStatusMsg('🎙️ 正在生成配音...');
                try {
                  const rateStr = `${ttsRate >= 1.0 ? '+' : ''}${Math.round((ttsRate - 1.0) * 100)}%`;
                  const filePath: string = await invoke('generate_tts', { req: { text: ttsText, voice: ttsVoice, rate: rateStr } });
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
