import React, { SetStateAction } from 'react';
import { TimelineItem, AudioTimelineItem, GlobalDefaults, GLOBAL_DEFAULTS_INIT, Resource } from '../types';
import ProSlider from './ProSlider';
import IosSelect from './IosSelect';
import { FILTER_PRESETS } from '../features/filter-engine/filterPresets';
import ColorPicker from '../features/text-workshop/ColorPicker';
import ProFontSelectComp from '../features/text-workshop/FontSelector';

const ProFontSelect = ProFontSelectComp;

interface Props {
  selectedIds: Set<string>;
  timeline: TimelineItem[];
  setTimeline: React.Dispatch<SetStateAction<TimelineItem[]>>;
  selectedItem?: TimelineItem;
  propertyTab: string;
  setPropertyTab: (val: any) => void;
  setStatusMsg: (msg: string) => void;
  updateSelectedProperty: (key: keyof TimelineItem | string, val: any) => void;
  commitSnapshotNow: () => void;
  isOverridden: (item: TimelineItem, key: string) => boolean;
  restoreInheritance: (itemId: string, key: keyof GlobalDefaults | string) => void;
  resourceMap: Map<string, Resource>;
  updatePropertyWithUndo: (key: string, val: any) => void;
  finalizeSliderUndo: () => void;
  applyAllToTimeline: () => void;
  audioItems: AudioTimelineItem[];
  selectedTextIds: Set<string>;
  setSelectedTextIds: React.Dispatch<SetStateAction<Set<string>>>;
  favTrans: string[];
  toggleFavTrans: (val: string) => void;
}

export const VideoPropertyPanel: React.FC<Props> = ({
  selectedIds,
  timeline,
  setTimeline,
  selectedItem,
  propertyTab,
  setPropertyTab,
  setStatusMsg,
  updateSelectedProperty,
  commitSnapshotNow,
  isOverridden,
  restoreInheritance,
  resourceMap,
  updatePropertyWithUndo,
  finalizeSliderUndo,
  applyAllToTimeline,
  audioItems,
  selectedTextIds,
  setSelectedTextIds,
  favTrans,
  toggleFavTrans
}) => {
  const renderPremiumColorPicker = (propKey: string, currentVal: string, defVal: string) => (
    <ColorPicker currentVal={currentVal} defVal={defVal} onChange={c => updateSelectedProperty(propKey as keyof TimelineItem, c)} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40, minHeight: '100%' }}>

      {/* ======= 胶囊切换栏 ======= */}
      <div style={{
        display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '24px', padding: 4,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)', marginBottom: 8
      }}>
        {[
          { id: 'basic', label: '基础设置' },
          { id: 'presets', label: '一键滤镜' },
          { id: 'color', label: '影像色彩' },
          { id: 'text', label: '文字工坊' },
          { id: 'transform', label: '位置形变' }
        ].map(t => (
          <div
            key={t.id}
            onClick={() => setPropertyTab(t.id as any)}
            style={{
              flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              fontWeight: propertyTab === t.id ? 'bold' : 'normal',
              color: propertyTab === t.id ? '#10B981' : 'rgba(255,255,255,0.5)',
              background: propertyTab === t.id ? 'rgba(16,185,129,0.1)' : 'transparent',
              boxShadow: propertyTab === t.id ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {/* 滤镜预设 */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'presets' ? 'block' : 'none' }}>
        <div className="ios-text" style={{ color: '#10B981', fontSize: 13, marginBottom: 8, display: 'block' }}>🎨 一键滤镜预设</div>
        <div className="filter-preset-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 'none', paddingRight: 14, marginLeft: -4 }}>
          {FILTER_PRESETS.map((preset) => (
            <div
              key={preset.name}
              className="filter-preset-card"
              style={{ padding: '8px 0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => {
                commitSnapshotNow();
                setTimeline(prev => prev.map(t => selectedIds.has(t.id) ? {
                  ...t, exposure: preset.exposure, contrast: preset.contrast, saturation: preset.saturation, temp: preset.temp, tint: preset.tint, brilliance: preset.brilliance
                } : t));
                setStatusMsg(`✨ 已应用${preset.name}预设`); setTimeout(() => setStatusMsg(''), 1500);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flexShrink: 0, fontSize: 13, marginRight: 6 }}>{preset.icon}</span>
                <span style={{ width: 42, display: 'flex', justifyContent: 'space-between', fontSize: 11, whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {preset.name.split('').map((c, i) => <span key={i}>{c}</span>)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GROUP 0: 基础设置 (Basic) */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'basic' ? 'block' : 'none' }}>
        <div className="ios-text" style={{ color: '#F59E0B', fontSize: 13, marginBottom: 12, display: 'block' }}>⚙️ 基本原声与速度控制</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 播放倍速 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>播放倍速 (Speed)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#F59E0B', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {selectedItem?.playbackRate?.toFixed(2) || '1.00'}x
                </span>
                <span onDoubleClick={() => { commitSnapshotNow(); updateSelectedProperty('playbackRate', 1.0); }} style={{ cursor: 'pointer', fontSize: 11, opacity: 0.8 }} title="双击重置">↺</span>
              </div>
            </div>
            <ProSlider min={0.1} max={5.0} step={0.1} value={selectedItem?.playbackRate || 1.0} onChange={d => updatePropertyWithUndo('playbackRate', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, #FCD34D, #F59E0B)" />
          </div>

          {/* 源音量 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>素材原声音量 (Volume)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#10B981', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {Math.round((selectedItem?.volume ?? 1.0) * 100)}%
                </span>
                <span onDoubleClick={() => { commitSnapshotNow(); updateSelectedProperty('volume', 1.0); }} style={{ cursor: 'pointer', fontSize: 11, opacity: 0.8 }} title="双击重置">↺</span>
              </div>
            </div>
            <ProSlider min={0.0} max={2.0} step={0.05} value={selectedItem?.volume ?? 1.0} onChange={d => updatePropertyWithUndo('volume', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, #6EE7B7, #10B981)" />
          </div>
        </div>
      </div>

      <div className="ios-prop-group" style={{ display: propertyTab === 'color' ? 'block' : 'none' }}>
        <div className="ios-text" style={{ color: 'var(--ios-indigo)', fontSize: 11, marginBottom: 2, display: 'block' }}>🎨 影像与色彩 {selectedIds.size > 1 && <span style={{ fontSize: 9, opacity: 0.5, fontWeight: 400 }}>({selectedIds.size} 项)</span>}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>

          {/* Duration Row removed as Video duration is bound to actual file runtime / speed */}
          {([
            ['exposure', '曝光', 0.0, 2.0, 0.01],
            ['brilliance', '鲜明度', 0.0, 2.0, 0.01],
            ['highlights', '高光', 0.0, 2.0, 0.01],
            ['shadows', '阴影', 0.0, 2.0, 0.01],
            ['whites', '白色色阶', 0.0, 2.0, 0.01],
            ['blacks', '黑色色阶', 0.0, 2.0, 0.01],
            ['contrast', '对比度', 0.0, 2.0, 0.01],
            ['saturation', '饱和度', 0.0, 2.0, 0.01, 'linear-gradient(90deg, #9CA3AF, #EF4444)'],
            ['vibrance', '自然饱和度', 0.0, 2.0, 0.01, 'linear-gradient(90deg, #9CA3AF, #818CF8, #F472B6)'],
            ['temp', '色温', -100, 100, 1, 'linear-gradient(90deg, #60A5FA, #E5E7EB, #FBBF24)'],
            ['tint', '色调', -100, 100, 1, 'linear-gradient(90deg, #34D399, #E5E7EB, #C084FC)'],
            ['sharpness', '清晰度', -3.0, 3.0, 0.01],
            ['fade', '褪色', 0.0, 1.0, 0.01],
            ['vignette', '暗角', -1.0, 1.0, 0.01],
            ['grain', '颗粒', 0.0, 1.0, 0.01]
          ] as any).map(([key, label, min, max, step, gradient]: any) => {
            const isCentered = !['fade', 'grain'].includes(key);
            const centerValue = ['temp', 'tint', 'sharpness', 'vignette'].includes(key) ? 0 : 1.0;
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span onDoubleClick={() => { commitSnapshotNow(); updateSelectedProperty(key, centerValue); }} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }} title="双击重置">
                    {label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {isCentered && centerValue === 0 ? ((selectedItem as any)?.[key] || 0) : ((selectedItem as any)?.[key] as number)?.toFixed(2) || ((GLOBAL_DEFAULTS_INIT as any)[key] as number).toFixed(2)}
                    </span>
                    {selectedItem && isOverridden(selectedItem, key) && (
                      <span onClick={(e) => { e.stopPropagation(); restoreInheritance(selectedItem.id, key); }} style={{ cursor: 'pointer', fontSize: 12, opacity: 0.9, color: '#10B981', userSelect: 'none', marginLeft: 2 }} title='恢复继承全局默认'>•</span>
                    )}
                  </div>
                </div>
                <div style={{ width: '100%', minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  <ProSlider gradient={gradient} isCentered={isCentered} centerValue={centerValue} style={{ width: '100%', maxWidth: '100%' }} min={min} max={max} step={step} value={isCentered && centerValue === 0 ? ((selectedItem as any)?.[key] || 0) : ((selectedItem as any)?.[key] || (GLOBAL_DEFAULTS_INIT as any)[key])} onChange={d => updatePropertyWithUndo(key, d)} onMouseUp={finalizeSliderUndo} />
                </div>
              </div>
            );
          })}
          <button className="ios-button ios-button-subtle" style={{ width: '100%', marginTop: 12, borderRadius: 8, height: 36, color: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(255,255,255,0.15)', transition: 'all 0.15s' }} onClick={() => {
            commitSnapshotNow();
            setTimeline(prev => prev.map(t => {
              if (!selectedIds.has(t.id)) return t;
              const overrides = (t.overrides || []).filter(o => !['exposure', 'brilliance', 'highlights', 'shadows', 'whites', 'blacks', 'contrast', 'saturation', 'vibrance', 'temp', 'tint', 'sharpness', 'fade', 'vignette', 'grain'].includes(o));
              return {
                ...t, overrides,
                exposure: GLOBAL_DEFAULTS_INIT.exposure, brilliance: GLOBAL_DEFAULTS_INIT.brilliance,
                highlights: GLOBAL_DEFAULTS_INIT.highlights, shadows: GLOBAL_DEFAULTS_INIT.shadows,
                whites: GLOBAL_DEFAULTS_INIT.whites, blacks: GLOBAL_DEFAULTS_INIT.blacks,
                contrast: GLOBAL_DEFAULTS_INIT.contrast, saturation: GLOBAL_DEFAULTS_INIT.saturation,
                vibrance: GLOBAL_DEFAULTS_INIT.vibrance, temp: GLOBAL_DEFAULTS_INIT.temp,
                tint: GLOBAL_DEFAULTS_INIT.tint, sharpness: GLOBAL_DEFAULTS_INIT.sharpness,
                fade: GLOBAL_DEFAULTS_INIT.fade, vignette: GLOBAL_DEFAULTS_INIT.vignette, grain: GLOBAL_DEFAULTS_INIT.grain
              };
            }));
            setStatusMsg('✨ 已全部重置为全局默认参数'); setTimeout(() => setStatusMsg(''), 1500);
          }}>
            ↺ 一键重置全部色彩参数
          </button>
        </div>
      </div>

      {/* 批量操作按钮组 */}
      <div style={{ display: propertyTab === 'presets' ? 'flex' : 'none', flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
        <button className="ios-button ios-button-primary" style={{ flex: 1, borderRadius: 10, background: 'var(--ios-indigo)', height: 38, fontWeight: 600, fontSize: 11, padding: '0 4px' }} onClick={applyAllToTimeline}>
          ✨ 一键分发至全轨
        </button>
        <button className="ios-button ios-button-subtle" style={{ flex: 1, borderRadius: 10, height: 38, fontWeight: 500, fontSize: 11, padding: '0 4px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => {
          commitSnapshotNow();
          const validFilters = FILTER_PRESETS.slice(1);
          setTimeline(prev => prev.map(t => {
            if (resourceMap.get(t.resourceId)?.type === 'image') {
              const r = Math.pow(Math.random(), 1.6);
              const preset = validFilters[Math.floor(r * validFilters.length)];
              return { ...t, exposure: preset.exposure, contrast: preset.contrast, saturation: preset.saturation, temp: preset.temp, tint: preset.tint, brilliance: preset.brilliance };
            }
            return t;
          }));
          setStatusMsg(`🎨 已为全轨照片根据权重随机分配滤镜`); setTimeout(() => setStatusMsg(''), 2000);
        }}>
          🎨 智能化随机全轨滤镜
        </button>
        {audioItems.length > 0 && timeline.length > 0 && (
          <button className="ios-button ios-button-subtle" style={{ borderRadius: 10, height: 34, fontWeight: 500, fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => {
              const totalAudioDur = Math.max(...audioItems.map(a => a.timelineStart + a.duration));
              if (totalAudioDur <= 0 || timeline.length === 0) return;
              commitSnapshotNow();
              const perItemDur = totalAudioDur / timeline.length;
              setTimeline(prev => prev.map(t => ({ ...t, duration: Math.round(perItemDur * 10) / 10 })));
              setStatusMsg(`🎵 已将 ${timeline.length} 张图片均匀分配到 ${totalAudioDur.toFixed(1)}s 音乐时长`);
              setTimeout(() => setStatusMsg(''), 2000);
            }}>
            🎵 自动适配音乐时长
          </button>
        )}
      </div>

      {/* GROUP 2: 文字工坊 - 影视级重构版 */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'text' ? 'flex' : 'none', flexDirection: 'column', gap: 16, padding: '0', background: 'transparent', border: 'none' }}>

        {/* 模块一：基础排版区域 */}
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F3F4F6', letterSpacing: 1 }}>基础排版</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="ios-hover-scale" style={{ minWidth: 0, padding: '0 12px', height: 26, fontSize: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }} onClick={() => {
                if (!selectedItem) return;
                commitSnapshotNow();
                const newId = `txt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                setTimeline(prev => prev.map(t => {
                  if (!selectedIds.has(t.id)) return t;
                  return {
                    ...t,
                    textOverlays: [...(t.textOverlays || []), { id: newId, text: '新建文本层', fontSize: Math.floor(Math.random() * 15) + 20, fontColor: '#ffffff', fontFamily: 'sans-serif', textX: 50 + (Math.random() * 10 - 5), textY: 50 + (Math.random() * 10 - 5), textAlign: 'center' }]
                  };
                }));
                setSelectedTextIds(new Set([newId]));
              }}>✨ 插入文本图层</button>
            </div>
          </div>

          {(() => {
            const getActiveTextProp = (key: string, defVal: any) => {
              if (!selectedItem) return defVal;
              if (selectedTextIds.size > 0) {
                const activeOverlays = (selectedItem.textOverlays || []).filter(o => selectedTextIds.has(o.id));
                if (activeOverlays.length > 0) {
                  let k = key;
                  if (key === 'overlayText') k = 'text';
                  return (activeOverlays[0] as any)[k] !== undefined ? (activeOverlays[0] as any)[k] : defVal;
                }
              }
              return (selectedItem as any)[key] !== undefined ? (selectedItem as any)[key] : defVal;
            };

            const activeOverlays = (selectedItem?.textOverlays || []).filter(o => selectedTextIds.has(o.id));
            const displayVal = activeOverlays.length > 0 ? (activeOverlays.every(o => o.text === activeOverlays[0].text) ? activeOverlays[0].text : '(多选状态 - 分别保留原文本)') : (selectedItem?.overlayText || '');

            return (
              <>
                <textarea
                  value={displayVal}
                  onChange={(e) => updateSelectedProperty('overlayText', e.target.value)}
                  placeholder={activeOverlays.length > 0 ? "输入选中文本..." : "输入片头字幕、标题或解说（全局备用）..."}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', width: '100%', boxSizing: 'border-box', fontSize: 13, color: '#fff', outline: 'none', resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.5 }}
                />

                {/* 极简色盘挂载：字色 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>文字主色 (Font Color)</span>
                  {renderPremiumColorPicker('fontColor', getActiveTextProp('fontColor', '#FFFFFF'), '#FFFFFF')}
                </div>

                {/* 字体配置 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ProFontSelect
                    value={selectedItem?.fontFamily || 'sans-serif'}
                    onChange={v => updateSelectedProperty('fontFamily', v)}
                    optGroups={[
                      {
                        label: '✨ 系统预装', options: [
                          { label: '默认黑体', value: 'sans-serif' },
                          { label: '微软雅黑', value: "'Microsoft YaHei', sans-serif" },
                          { label: '黑体 SimHei', value: "'SimHei', sans-serif" },
                          { label: '宋体 SimSun', value: "'SimSun', serif" },
                          { label: '楷体 KaiTi', value: "'KaiTi', serif" },
                          { label: '华文行楷', value: "'STXingkai', cursive" },
                          { label: '华文隶书', value: "'STLiti', serif" },
                          { label: '华文彩云', value: "'STCaiyun', cursive" },
                          { label: '幼圆', value: "'YouYuan', sans-serif" },
                        ]
                      },
                      {
                        label: '🖌️ 云端书法 (免安装即用)', options: [
                          { label: '志莽行书 · 行草奔放', value: "'Zhi Mang Xing', cursive" },
                          { label: '马善政楷书 · 端庄大气', value: "'Ma Shan Zheng', cursive" },
                          { label: '龙藏体 · 古朴苍劲', value: "'Long Cang', cursive" },
                          { label: '流建毛草 · 飘逸草书', value: "'Liu Jian Mao Cao', cursive" },
                          { label: '站酷庆科黄油体', value: "'ZCOOL QingKe HuangYou', cursive" },
                          { label: '站酷快乐体', value: "'ZCOOL KuaiLe', cursive" },
                          { label: '站酷小薇体', value: "'ZCOOL XiaoWei', serif" },
                        ]
                      },
                      {
                        label: '🎨 西文艺术', options: [
                          { label: 'Impact 海报体', value: "'Impact', sans-serif" },
                          { label: 'Georgia 优雅衬线', value: "'Georgia', serif" },
                          { label: 'Courier 打字机', value: "'Courier New', monospace" },
                          { label: 'Comic Sans 手写', value: "'Comic Sans MS', cursive" },
                        ]
                      }
                    ]}
                  />

                  {/* 对齐与格式控制栏 */}
                  <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 10 }}>
                    <div onClick={() => updateSelectedProperty('fontWeight', selectedItem?.fontWeight === 'bold' ? 'normal' : 'bold')} style={{ flex: 1, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedItem?.fontWeight === 'bold' ? 'rgba(99,102,241,0.2)' : 'transparent', color: selectedItem?.fontWeight === 'bold' ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: 800, fontSize: 13, transition: '0.2s' }}>B</div>
                    <div onClick={() => updateSelectedProperty('fontWeight', selectedItem?.fontWeight === 'italic' ? 'normal' : 'italic')} style={{ flex: 1, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedItem?.fontWeight === 'italic' ? 'rgba(99,102,241,0.2)' : 'transparent', color: selectedItem?.fontWeight === 'italic' ? '#fff' : 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: 13, transition: '0.2s' }}>I</div>
                    <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', alignSelf: 'center', margin: '0 4px' }} />
                    {(['left', 'center', 'right'] as const).map(a => (
                      <div key={a} onClick={() => updateSelectedProperty('textAlign', a)} style={{ flex: 1, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: (selectedItem?.textAlign || 'center') === a ? 'rgba(255,255,255,0.1)' : 'transparent', color: (selectedItem?.textAlign || 'center') === a ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 11, transition: '0.2s' }}>
                        {a === 'left' ? '←' : a === 'center' ? '—' : '→'}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 专业排版无极滑块矩阵 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                  {([
                    ['fontSize', '字号', 8, 200, 1, 36],
                    ['textLetterSpacing', '字偶距', -10, 50, 1, 0],
                    ['textLineHeight', '行间距', 0.5, 3.0, 0.1, 1.2],
                    ['textOpacity', '不透明度', 0, 1, 0.05, 1],
                    ['textRotation', '旋转轴向', -180, 180, 1, 0]
                  ]).map(([key, label, min, max, step, defVal]: any) => {
                    const val = getActiveTextProp(key, defVal);
                    return (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>{Number(val).toFixed(step < 1 ? 1 : 0)}</span>
                        </div>
                        <ProSlider min={min as number} max={max as number} step={step as number} value={val} isCentered={key === 'textRotation' || key === 'textLetterSpacing'} centerValue={0} onChange={d => updatePropertyWithUndo(key, d)} onMouseUp={finalizeSliderUndo} />
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

        {/* 模块二：场控动效（入场时间线）调至排版之下 */}
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F3F4F6', letterSpacing: 1 }}>🎬 入场时间线</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {([
              ['none', '🚫 刚性瞬间'], ['fadeIn', '☁️ 电影淡入'], ['slideUp', '↑ 稳重上升'],
              ['typewriter', '⌨️ 原型打字'], ['zoom', '🔍 夸张冲刺'], ['bounce', '⬆ 俏皮弹跳'],
              ['slideLeft', '→ 左侧划入'], ['slideRight', '← 右侧划入'], ['rotateIn', '🌀 炫酷旋入'],
              ['flipInX', '🔁 翻转入场'], ['zoomInDown', '🛸 空降缩放'], ['jackInTheBox', '📦 魔盒弹出']
            ] as [string, string][]).map(([val, label]) => (
              <div
                key={val}
                onClick={() => updateSelectedProperty('textAnimation', val)}
                style={{
                  padding: '8px 4px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                  fontSize: 10, fontWeight: (selectedItem?.textAnimation || 'none') === val ? 700 : 500,
                  color: (selectedItem?.textAnimation || 'none') === val ? '#fff' : 'rgba(255,255,255,0.5)',
                  background: (selectedItem?.textAnimation || 'none') === val ? 'rgba(99,102,241,0.3)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${(selectedItem?.textAnimation || 'none') === val ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.03)'}`,
                  transition: '0.2s'
                }}
              >{label}</div>
            ))}
          </div>
          {(selectedItem?.textAnimation && selectedItem.textAnimation !== 'none') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>动效行进总时长</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{(selectedItem?.textAnimDuration ?? 0.6).toFixed(1)}s</span></div>
              <ProSlider min={0.1} max={5.0} step={0.1} value={selectedItem?.textAnimDuration ?? 0.6} onChange={d => updatePropertyWithUndo('textAnimDuration', d)} onMouseUp={finalizeSliderUndo} />
            </div>
          )}
        </div>

        {/* 模块三：特效涂装系统（发光、阴影、描边、底板高度定制） */}
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F3F4F6', letterSpacing: 1, marginBottom: 4 }}>高阶特效容器</span>

          {/* 涂装子模块：发光 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textGlow', !selectedItem?.textGlow)}>
              <span style={{ fontSize: 12, color: selectedItem?.textGlow ? '#6EE7B7' : 'rgba(255,255,255,0.6)', fontWeight: selectedItem?.textGlow ? 600 : 400 }}>✨ 霓虹发光 (Glow)</span>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: selectedItem?.textGlow ? '#34D399' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: selectedItem?.textGlow ? 18 : 2, transition: '0.2s' }} />
              </div>
            </div>
            {selectedItem?.textGlow && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>发光光谱色</span>
                  {renderPremiumColorPicker('textGlowColor', selectedItem?.textGlowColor || selectedItem?.fontColor || '#FFFFFF', selectedItem?.fontColor || '#FFFFFF')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>扩散半径</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{selectedItem?.textGlowRadius ?? 20}</span></div>
                  <ProSlider min={0} max={100} step={1} value={selectedItem?.textGlowRadius ?? 20} onChange={d => updatePropertyWithUndo('textGlowRadius', d)} onMouseUp={finalizeSliderUndo} />
                </div>
              </div>
            )}
          </div>

          {/* 涂装子模块：阴影 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textShadowColor', selectedItem?.textShadowColor ? '' : 'rgba(0,0,0,0.8)')}>
              <span style={{ fontSize: 12, color: selectedItem?.textShadowColor ? '#A78BFA' : 'rgba(255,255,255,0.6)', fontWeight: selectedItem?.textShadowColor ? 600 : 400 }}>🌑 物理投影 (Shadow)</span>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: selectedItem?.textShadowColor ? '#8B5CF6' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: selectedItem?.textShadowColor ? 18 : 2, transition: '0.2s' }} />
              </div>
            </div>
            {selectedItem?.textShadowColor && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>阴影深度色</span>
                  {renderPremiumColorPicker('textShadowColor', selectedItem?.textShadowColor?.length === 7 ? selectedItem.textShadowColor : '#000000', '#000000')}
                </div>
                {([['textShadowBlur', '柔焦模糊度', 0, 50, 1, 8], ['textShadowOffsetX', '水平光偏 X', -50, 50, 1, 2], ['textShadowOffsetY', '垂直光偏 Y', -50, 50, 1, 2]] as any).map(([key, label, min, max, step, defVal]: any) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{((selectedItem as any)?.[key] ?? defVal)}</span></div>
                    <ProSlider min={min} max={max} step={step} value={(selectedItem as any)?.[key] ?? defVal} isCentered={min < 0} centerValue={0} onChange={d => updatePropertyWithUndo(key, d)} onMouseUp={finalizeSliderUndo} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 涂装子模块：描边 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textStrokeColor', selectedItem?.textStrokeColor ? '' : '#000000')}>
              <span style={{ fontSize: 12, color: selectedItem?.textStrokeColor ? '#F472B6' : 'rgba(255,255,255,0.6)', fontWeight: selectedItem?.textStrokeColor ? 600 : 400 }}>🔲 坚实描边 (Stroke)</span>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: selectedItem?.textStrokeColor ? '#EC4899' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: selectedItem?.textStrokeColor ? 18 : 2, transition: '0.2s' }} />
              </div>
            </div>
            {selectedItem?.textStrokeColor && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>边界色彩</span>
                  {renderPremiumColorPicker('textStrokeColor', selectedItem?.textStrokeColor || '#000000', '#000000')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>边界粗细</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{selectedItem?.textStrokeWidth ?? 1}px</span></div>
                  <ProSlider min={0.5} max={15} step={0.5} value={selectedItem?.textStrokeWidth ?? 1} onChange={d => updatePropertyWithUndo('textStrokeWidth', d)} onMouseUp={finalizeSliderUndo} />
                </div>
              </div>
            )}
          </div>

          {/* 涂装子模块：底板 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textBg', selectedItem?.textBg && selectedItem.textBg !== 'transparent' ? 'transparent' : 'rgba(0,0,0,0.5)')}>
              <span style={{ fontSize: 12, color: (selectedItem?.textBg && selectedItem.textBg !== 'transparent') ? '#60A5FA' : 'rgba(255,255,255,0.6)', fontWeight: (selectedItem?.textBg && selectedItem.textBg !== 'transparent') ? 600 : 400 }}>◼ 遮罩底板 (Plate)</span>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: (selectedItem?.textBg && selectedItem.textBg !== 'transparent') ? '#3B82F6' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: (selectedItem?.textBg && selectedItem.textBg !== 'transparent') ? 18 : 2, transition: '0.2s' }} />
              </div>
            </div>
            {(selectedItem?.textBg && selectedItem.textBg !== 'transparent') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>填充材质色</span>
                  {renderPremiumColorPicker('textBg', selectedItem?.textBg?.length === 7 ? selectedItem.textBg : '#1A1A1A', '#1A1A1A')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>容器内边距</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{selectedItem?.textBgPadding ?? 12}px</span></div>
                  <ProSlider min={0} max={60} step={1} value={selectedItem?.textBgPadding ?? 12} onChange={d => updatePropertyWithUndo('textBgPadding', d)} onMouseUp={finalizeSliderUndo} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>裁剪圆角</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{selectedItem?.textBgRadius ?? 8}px</span></div>
                  <ProSlider min={0} max={100} step={1} value={selectedItem?.textBgRadius ?? 8} onChange={d => updatePropertyWithUndo('textBgRadius', d)} onMouseUp={finalizeSliderUndo} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 模块四：艺术字材质预设（展示全部平铺态） */}
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F3F4F6', letterSpacing: 1 }}>一键应用画廊</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 6 }}>
            {([
              { label: '清除', color: '#FFFFFF', shadow: '', stroke: '', glow: false, font: 'sans-serif' },
              { label: '浪漫霓虹', color: '#00FFFF', shadow: '#00FFFF', stroke: '', glow: true, font: 'sans-serif' },
              { label: '重金属', color: '#FFD700', shadow: '#B8860B', stroke: '#DAA520', glow: false, font: "'Impact', sans-serif" },
              { label: '国风水墨', color: '#2F2F2F', shadow: 'rgba(0,0,0,0.3)', stroke: '', glow: false, font: "'STXingkai', cursive" },
              { label: '赛博朋克', color: '#FF00FF', shadow: '#FF00FF', stroke: '#00FF00', glow: true, font: "'Impact', sans-serif" },
              { label: '烈焰红玫', color: '#FF6B35', shadow: '#FF0000', stroke: '#FFD700', glow: true, font: "'SimHei', sans-serif" },
              { label: '高冷极冰', color: '#E0F4FF', shadow: '#4FC3F7', stroke: '#81D4FA', glow: true, font: 'serif' },
              { label: '古典碑帖', color: '#8B7355', shadow: '#5C4033', stroke: '#DEB887', glow: false, font: "'STLiti', serif" },
              { label: '毒液侵袭', color: '#9D00FF', shadow: '#4A00E0', stroke: '#00B4DB', glow: true, font: "'Impact', sans-serif" },
              { label: '血金王座', color: '#8B0000', shadow: '#3E0000', stroke: '#FFD700', glow: false, font: "'Microsoft YaHei', sans-serif" },
              { label: '纯享豆沙', color: '#D9B8B5', shadow: '', stroke: '', glow: false, font: "'KaiTi', serif" },
            ]).map(preset => (
              <div
                key={preset.label}
                onClick={() => {
                  commitSnapshotNow();
                  setTimeline(p => p.map(t => selectedIds.has(t.id) ? {
                    ...t,
                    fontColor: preset.color,
                    textShadowColor: preset.shadow,
                    textStrokeColor: preset.stroke,
                    textGlow: preset.glow,
                    fontFamily: preset.font,
                  } : t));
                }}
                style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'center', fontSize: 13, color: preset.color, fontWeight: 800, textShadow: preset.shadow ? `0 0 8px ${preset.shadow}` : 'none', letterSpacing: 1 }}
              >{preset.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* GROUP 4: 几何与时间 */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'transform' ? 'block' : 'none' }}>
        <div className="ios-text" style={{ color: '#F87171', fontSize: 13, marginBottom: 8, display: 'block' }}>📐 几何、时间与转场</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ios-button-small ios-button" style={{ flex: 1 }} onClick={() => updateSelectedProperty('rotation', (selectedItem!.rotation + 90) % 360)}>↺ 旋转 90°</button>
            <button className="ios-button-small ios-button" style={{ flex: 1 }} onClick={() => updateSelectedProperty('flipX', !(selectedItem as any)?.flipX)}>↔️ 水平翻转</button>
          </div>
          <div className="ios-field" >
            <IosSelect
              value={selectedItem?.fillMode || 'cover'}
              onChange={val => {
                commitSnapshotNow();
                updateSelectedProperty('fillMode', val);
              }}
              style={{ height: 32 }}
              options={[
                { value: 'cover', label: '智能匹配 (Cover)' },
                { value: 'contain', label: '适应比例 (Contain)' },
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>缩放: {selectedItem?.zoom?.toFixed(2) || '1.0'}</span>
            <ProSlider min={1.0} max={3.0} step={0.1} value={selectedItem?.zoom || 1.0} onChange={d => updateSelectedProperty('zoom', d)} />
          </div>
          <div className="ios-field" >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><label className="ios-field-label">封装格式</label>
              <span>转场方式</span>
              {selectedItem && <span onClick={() => selectedItem && (isOverridden(selectedItem, 'transition') ? restoreInheritance(selectedItem.id, 'transition') : null)} style={{ cursor: isOverridden(selectedItem, 'transition') ? 'pointer' : 'default', fontSize: 11, opacity: 0.7 }} title={isOverridden(selectedItem, 'transition') ? '点击恢复继承' : '继承全局默认'}>{isOverridden(selectedItem, 'transition') ? '✏️' : '🔗'}</span>}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <IosSelect
                value={selectedItem?.transition || 'none'}
                onChange={val => {
                  commitSnapshotNow();
                  updateSelectedProperty('transition', val);
                }}
                style={{ flex: 1, height: 32 }}
                options={[
                  { value: 'none', label: '直接切入 (Cut)' },
                  { value: 'fade', label: '经典叠化 (Dissolve)' },
                  { value: 'white', label: '模糊闪白 (Dip to White)' },
                  { value: 'iris', label: '中心扩散 (Iris)' },
                  { value: 'slide', label: '平滑推入 (Push)' },
                  { value: 'slide_up', label: '垂直推开 (Slide Up)' },
                  { value: 'zoom', label: '专业缩放 (Zoom)' },
                  { value: 'wipe', label: '硬核擦除 (Wipe)' },
                  { value: 'cube', label: '立体旋转 (Cube)' },
                  { value: 'glitch', label: '故障艺术 (Glitch)' },
                  { value: 'flip', label: '水平翻转 (Flip)' }
                ]}
                favSet={favTrans}
                onToggleFav={toggleFavTrans}
              />
              <div
                title="为时间线所有片段随机分配转场（仅来自收藏）"
                className="ios-hover-scale"
                style={{
                  height: 32, width: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: 16,
                  boxShadow: '0 2px 8px rgba(99,102,241,0.2)', transition: 'all 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0
                }}
                onClick={() => {
                  commitSnapshotNow();
                  const transPool = favTrans.length > 0 ? favTrans : ['none', 'fade', 'white', 'iris', 'slide', 'slide_up', 'zoom', 'wipe', 'cube', 'glitch', 'flip'];
                  setTimeline(prev => prev.map(t => {
                    const randTrans = transPool[Math.floor(Math.random() * transPool.length)];
                    const ov = new Set(t.overrides || []);
                    ov.add('transition');
                    return { ...t, transition: randTrans, overrides: Array.from(ov) };
                  }));
                  setStatusMsg('🎲 已为全轨随机分配新转场！'); setTimeout(() => setStatusMsg(''), 2000);
                }}
              >🎲</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
