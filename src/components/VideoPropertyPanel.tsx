import React, { SetStateAction } from 'react';
import { useStore } from '../store/index';
// { SetStateAction } from 'react';
import { TimelineItem, AudioTimelineItem, GlobalDefaults, GLOBAL_DEFAULTS_INIT, Resource } from '../types';
import ProSlider from './ProSlider';
import IosSelect from './IosSelect';
import { FILTER_PRESETS } from '../features/filter-engine/filterPresets';
import ColorPicker from '../features/text-workshop/ColorPicker';
import { PropertyAccordionBlock } from './PropertyAccordionBlock';
import { TransformAndMaskPanel } from './TransformAndMaskPanel';
import ProFontSelectComp from '../features/text-workshop/FontSelector';
import { ColorCurvePanel } from './ColorCurvePanel';

import { FilterPresetGrid } from './FilterPresetGrid';
import { CreateFilterButton } from './CreateFilterButton';
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
  const [textAnimTab, setTextAnimTab] = React.useState<'in' | 'loop' | 'out'>('in');

  const { panelOrderImage, setPanelOrderImage, panelOrderText, setPanelOrderText, panelCollapsed, togglePanelCollapsed } = useStore();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('sourceId', id);
    e.currentTarget.style.opacity = '0.4';
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('sourceId');
    if (!sourceId || sourceId === targetId) return;
    if (sourceId.startsWith('text-') && targetId.startsWith('text-')) {
      const items = [...panelOrderText];
      const srcIdx = items.indexOf(sourceId);
      const tgtIdx = items.indexOf(targetId);
      if (srcIdx > -1 && tgtIdx > -1) {
        items.splice(srcIdx, 1);
        items.splice(tgtIdx, 0, sourceId);
        setPanelOrderText(items);
      }
    } else {
      const items = [...panelOrderImage];
      const srcIdx = items.indexOf(sourceId);
      const tgtIdx = items.indexOf(targetId);
      if (srcIdx > -1 && tgtIdx > -1) {
        items.splice(srcIdx, 1);
        items.splice(tgtIdx, 0, sourceId);
        setPanelOrderImage(items);
      }
    }
  };

  const _resetKeys = (keys: string[]) => {
    keys.forEach((k: string) => updateSelectedProperty(k as keyof TimelineItem, undefined));
    commitSnapshotNow();
  };

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
        <FilterPresetGrid
          selectedIds={selectedIds}
          setTimeline={setTimeline}
          commitSnapshotNow={commitSnapshotNow}
          setStatusMsg={setStatusMsg}
          selectedItem={selectedItem}
        />
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

          {/* 源音量与静音 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>素材原声音量 (Volume)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span onClick={() => updateSelectedProperty('mute', !selectedItem?.mute)} style={{ cursor: 'pointer', fontSize: 12, marginRight: 4, transition: '0.2s', filter: selectedItem?.mute ? 'drop-shadow(0 0 4px #EF4444)' : 'none' }} title="点击切换静音">
                  {selectedItem?.mute ? '🔇' : '🔊'}
                </span>
                <span style={{ fontSize: 11, color: selectedItem?.mute ? '#EF4444' : '#10B981', fontVariantNumeric: 'tabular-nums', fontWeight: 600, textDecoration: selectedItem?.mute ? 'line-through' : 'none' }}>
                  {Math.round((selectedItem?.volume ?? 1.0) * 100)}%
                </span>
                <span onDoubleClick={() => { commitSnapshotNow(); updateSelectedProperty('volume', 1.0); }} style={{ cursor: 'pointer', fontSize: 11, opacity: 0.8 }} title="双击重置">↺</span>
              </div>
            </div>
            <div style={{ opacity: selectedItem?.mute ? 0.3 : 1, pointerEvents: selectedItem?.mute ? 'none' : 'auto', transition: '0.3s' }}>
              <ProSlider min={0.0} max={2.0} step={0.05} value={selectedItem?.volume ?? 1.0} onChange={d => updatePropertyWithUndo('volume', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, #6EE7B7, #10B981)" />
            </div>
          </div>

          {/* 视频片段裁切 (Trim) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span onDoubleClick={() => { commitSnapshotNow(); updateSelectedProperty('trimStart', 0); }} style={{ cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.85)' }} title="双击重置">播放起点 (Trim Start)</span>
                <span style={{ fontSize: 11, color: '#3B82F6', fontVariantNumeric: 'tabular-nums' }}>{selectedItem?.trimStart?.toFixed(2) || '0.00'}s</span>
              </div>
              <ProSlider min={0.0} max={600.0} step={0.1} value={selectedItem?.trimStart || 0} onChange={d => updatePropertyWithUndo('trimStart', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #3B82F6)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>截取长度 (Duration)</span>
                <span style={{ fontSize: 11, color: '#8B5CF6', fontVariantNumeric: 'tabular-nums' }}>{selectedItem?.duration?.toFixed(2) || '3.00'}s</span>
              </div>
              <ProSlider min={0.1} max={600.0} step={0.1} value={selectedItem?.duration || 3} onChange={d => updatePropertyWithUndo('duration', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #8B5CF6)" />
            </div>
          </div>

          {/* 追加功能：不透明度与混合模式 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>不透明度 (Opacity)</span>
                <span style={{ fontSize: 11, color: '#60A5FA' }}>{Math.round((selectedItem?.opacity ?? 1.0) * 100)}%</span>
              </div>
              <ProSlider min={0.0} max={1.0} step={0.01} value={selectedItem?.opacity ?? 1.0} onChange={d => updatePropertyWithUndo('opacity', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #60A5FA)" />
            </div>
            <div className="ios-field" >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><label className="ios-field-label">图层混合选项</label>
                <span>混合模式</span>
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <IosSelect
                  value={(selectedItem as any)?.blendMode || 'normal'}
                  onChange={val => {
                    commitSnapshotNow();
                    updateSelectedProperty('blendMode', val);
                  }}
                  style={{ flex: 1, height: 32 }}
                  options={[
                    { value: 'normal', label: '正常 (Normal)' },
                    { value: 'multiply', label: '正片叠底 (Multiply)' },
                    { value: 'screen', label: '滤色 (Screen)' },
                    { value: 'overlay', label: '叠加 (Overlay)' },
                    { value: 'darken', label: '变暗 (Darken)' },
                    { value: 'lighten', label: '变亮 (Lighten)' },
                    { value: 'color-dodge', label: '颜色减淡 (Color Dodge)' },
                    { value: 'color-burn', label: '颜色加深 (Color Burn)' },
                    { value: 'hard-light', label: '强光 (Hard Light)' }
                  ]}
                />
              </div>
            </div>
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
          
          <div style={{ padding: '0 8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
            <span className="ios-field-label" style={{ marginBottom: 12, display: 'block' }}>高级色彩曲线 (RGB Curves)</span>
            {selectedItem && (
              <ColorCurvePanel 
                curveMaster={selectedItem.curveMaster}
                curveRed={selectedItem.curveRed}
                curveGreen={selectedItem.curveGreen}
                curveBlue={selectedItem.curveBlue}
                onChange={(ch, pts) => {
                  const key = ch === 'master' ? 'curveMaster' : ch === 'red' ? 'curveRed' : ch === 'green' ? 'curveGreen' : 'curveBlue';
                  updatePropertyWithUndo(key, pts);
                }}
                commitUndo={finalizeSliderUndo}
              />
            )}
          </div>

          <button className="ios-button ios-button-subtle" style={{ width: '100%', marginTop: 12, borderRadius: 8, height: 36, color: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(255,255,255,0.15)', transition: 'all 0.15s' }} onClick={() => {
            commitSnapshotNow();
            setTimeline(prev => prev.map(t => {
              if (!selectedIds.has(t.id)) return t;
              const overrides = (t.overrides || []).filter(o => !['exposure', 'brilliance', 'highlights', 'shadows', 'whites', 'blacks', 'contrast', 'saturation', 'vibrance', 'temp', 'tint', 'sharpness', 'fade', 'vignette', 'grain', 'curveMaster', 'curveRed', 'curveGreen', 'curveBlue'].includes(o));
              return {
                ...t, overrides,
                exposure: GLOBAL_DEFAULTS_INIT.exposure, brilliance: GLOBAL_DEFAULTS_INIT.brilliance,
                highlights: GLOBAL_DEFAULTS_INIT.highlights, shadows: GLOBAL_DEFAULTS_INIT.shadows,
                whites: GLOBAL_DEFAULTS_INIT.whites, blacks: GLOBAL_DEFAULTS_INIT.blacks,
                contrast: GLOBAL_DEFAULTS_INIT.contrast, saturation: GLOBAL_DEFAULTS_INIT.saturation,
                vibrance: GLOBAL_DEFAULTS_INIT.vibrance, temp: GLOBAL_DEFAULTS_INIT.temp,
                tint: GLOBAL_DEFAULTS_INIT.tint, sharpness: GLOBAL_DEFAULTS_INIT.sharpness,
                fade: GLOBAL_DEFAULTS_INIT.fade, vignette: GLOBAL_DEFAULTS_INIT.vignette, grain: GLOBAL_DEFAULTS_INIT.grain,
                curveMaster: undefined, curveRed: undefined, curveGreen: undefined, curveBlue: undefined
              };
            }));
            setStatusMsg('✨ 已全部重置为全局默认参数'); setTimeout(() => setStatusMsg(''), 1500);
          }}>
            ↺ 一键重置全部色彩参数
          </button>

          <CreateFilterButton selectedItem={selectedItem} setStatusMsg={setStatusMsg} />
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
            if (resourceMap.get(t.resourceId)?.type === 'video') {
              const r = Math.pow(Math.random(), 1.6);
              const preset = validFilters[Math.floor(r * validFilters.length)];
              return { ...t, exposure: preset.exposure, contrast: preset.contrast, saturation: preset.saturation, temp: preset.temp, tint: preset.tint, brilliance: preset.brilliance };
            }
            return t;
          }));
          setStatusMsg(`🎨 已为全轨视频智能分配随机预设`); setTimeout(() => setStatusMsg(''), 2000);
        }}>
          🎨 智能化随机全轨预设
        </button>
        {audioItems.length > 0 && timeline.length > 0 && (
          <button className="ios-button ios-button-subtle" style={{ borderRadius: 10, height: 34, fontWeight: 500, fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => {
              const totalAudioDur = Math.max(...audioItems.map(a => a.timelineStart + a.duration));
              if (totalAudioDur <= 0 || timeline.length === 0) return;
              commitSnapshotNow();
              const perItemDur = totalAudioDur / timeline.length;
              setTimeline(prev => prev.map(t => ({ ...t, duration: Math.round(perItemDur * 10) / 10 })));
              setStatusMsg(`🎵 已将 ${timeline.length} 个视频均匀分布到 ${totalAudioDur.toFixed(1)}s 音乐时长`);
              setTimeout(() => setStatusMsg(''), 2000);
            }}>
            🎵 自动适配片段时长
          </button>
        )}
      </div>

                  {/* GROUP 2: 文字工坊 - 影视积木重构版 */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'text' ? 'flex' : 'none', flexDirection: 'column', gap: 12, padding: '0', background: 'transparent', border: 'none', minWidth: 0 }}>
          {(() => {
            const getActiveTextProp = (key: string, defVal: any) => {
              if (!selectedItem) return defVal;
              if (selectedTextIds.size > 0) {
                const activeOverlays = (selectedItem.textOverlays || []).filter((o: any) => selectedTextIds.has(o.id));
                if (activeOverlays.length > 0) {
                  let k = key;
                  if (key === 'overlayText') k = 'text';
                  return (activeOverlays[0] as any)[k] !== undefined ? (activeOverlays[0] as any)[k] : defVal;
                }
              }
              return (selectedItem as any)[key] !== undefined ? (selectedItem as any)[key] : defVal;
            };

            const activeOverlays = (selectedItem?.textOverlays || []).filter((o: any) => selectedTextIds.has(o.id));
            const displayVal = activeOverlays.length > 0 ? (activeOverlays.every((o: any) => o.text === activeOverlays[0].text) ? activeOverlays[0].text : '(多选状态 - 分别保留原文本)') : (selectedItem?.overlayText || '');

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
                {panelOrderText.filter(id => ['text-base', 'text-anim', 'text-effects', 'text-presets'].includes(id)).map(blockId => {
                  switch(blockId) {
                    case 'text-base': return (
                      <PropertyAccordionBlock key="text-base" id="text-base" title="📝 基础文本与排版" order={Math.max(0, panelOrderText.indexOf('text-base'))}
                        isCollapsed={!!panelCollapsed['text-base']} onToggle={() => togglePanelCollapsed('text-base')}
                        onDragStart={(e) => handleDragStart(e, 'text-base')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'text-base')}
                        onReset={() => console.log('Reset base')}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* 图层管理区 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' as const }}>
                              {(!selectedItem?.textOverlays || selectedItem.textOverlays.length === 0) && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '6px 12px', width: '100%', textAlign: 'center' }}>无独立文本层 (仅使用主轴文字)</div>
                              )}
                              {(selectedItem?.textOverlays || []).map((overlay: any) => (
                                <div key={overlay.id} style={{ display: 'flex', alignItems: 'center', background: selectedTextIds.has(overlay.id) ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)', border: `1px solid ${selectedTextIds.has(overlay.id) ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.05)'}`, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', transition: '0.2s', fontSize: 11, color: '#fff' }}
                                  onClick={() => { const newSet = new Set(selectedTextIds); if (newSet.has(overlay.id)) newSet.delete(overlay.id); else newSet.add(overlay.id); setSelectedTextIds(newSet); }}>
                                  <span style={{ maxWidth: 65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{overlay.text || '空文本'}</span>
                                  <span style={{ marginLeft: 6, opacity: 0.5, cursor: 'pointer', transform: 'scale(1.2)' }} onClick={(e) => { e.stopPropagation(); setTimeline(prev => prev.map(t => { if (t.id === selectedItem?.id) { return { ...t, textOverlays: (t.textOverlays || []).filter((o: any) => o.id !== overlay.id) }; } return t; })); }}>×</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              {selectedTextIds.size > 0 && (
                                <button className="ios-hover-scale" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', flex: 1 }} onClick={() => setSelectedTextIds(new Set())}>撤销选中</button>
                              )}
                              <button className="ios-hover-scale" style={{ background: 'rgba(99,102,241,0.8)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', flex: 1 }} onClick={() => {
                                const newId = 'txt_' + Math.random().toString(36).substr(2, 9);
                                setTimeline(prev => prev.map(t => {
                                  if (!selectedIds.has(t.id)) return t;
                                  return { ...t, textOverlays: [...(t.textOverlays || []), { id: newId, text: '新建文本层', fontSize: Math.floor(Math.random() * 15) + 20, fontColor: '#ffffff', fontFamily: 'sans-serif', textX: 50 + (Math.random() * 10 - 5), textY: 50 + (Math.random() * 10 - 5), textAlign: 'center' }] };
                                }));
                                setSelectedTextIds(new Set([newId]));
                              }}>✨ 插入独立文本图层</button>
                            </div>
                          </div>

                          <textarea
                            value={displayVal}
                            onChange={(e) => updateSelectedProperty('overlayText', e.target.value)}
                            placeholder={activeOverlays.length > 0 ? "输入选中文本..." : "输入主轴解说（全局备用）..."}
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', width: '100%', boxSizing: 'border-box', fontSize: 13, color: '#fff', outline: 'none', resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.5 }}
                          />

                          {/* 极度融合的紧凑字体颜色与格式行 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {renderPremiumColorPicker('fontColor', getActiveTextProp('fontColor', '#FFFFFF'), '#FFFFFF')}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <ProFontSelect
                                value={selectedItem?.fontFamily || 'sans-serif'}
                                onChange={v => updateSelectedProperty('fontFamily', v)}
                                optGroups={[
                                  { label: '✨ 系统预装', options: [ { label: '默认黑体', value: 'sans-serif' }, { label: '微软雅黑', value: "'Microsoft YaHei', sans-serif" }, { label: '黑体 SimHei', value: "'SimHei', sans-serif" }, { label: '宋体 SimSun', value: "'SimSun', serif" }, { label: '楷体 KaiTi', value: "'KaiTi', serif" }, { label: '华文行楷', value: "'STXingkai', cursive" }, { label: '华文隶书', value: "'STLiti', serif" }, { label: '华文彩云', value: "'STCaiyun', cursive" }, { label: '幼圆', value: "'YouYuan', sans-serif" } ] },
                                  { label: '🖌️ 云端书法', options: [ { label: '志莽行书', value: "'Zhi Mang Xing', cursive" }, { label: '马善政楷书', value: "'Ma Shan Zheng', cursive" }, { label: '龙藏体', value: "'Long Cang', cursive" }, { label: '流建毛草', value: "'Liu Jian Mao Cao', cursive" }, { label: '站酷庆科黄油体', value: "'ZCOOL QingKe HuangYou', cursive" }, { label: '站酷快乐体', value: "'ZCOOL KuaiLe', cursive" }, { label: '站酷小薇体', value: "'ZCOOL XiaoWei', serif" } ] },
                                  { label: '🎨 西文艺术', options: [ { label: 'Impact 海报体', value: "'Impact', sans-serif" }, { label: 'Georgia 优雅衬线', value: "'Georgia', serif" }, { label: 'Courier 打字机', value: "'Courier New', monospace" }, { label: 'Comic Sans 手写', value: "'Comic Sans MS', cursive" } ] }
                                ]}
                              />
                            </div>
                            
                            <div onClick={() => updateSelectedProperty('fontWeight', selectedItem?.fontWeight === 'bold' ? 'normal' : 'bold')} style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedItem?.fontWeight === 'bold' ? 'rgba(99,102,241,0.3)' : 'transparent', color: selectedItem?.fontWeight === 'bold' ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)', transition: '0.2s' }}>B</div>
                            <div onClick={() => updateSelectedProperty('fontWeight', selectedItem?.fontWeight === 'italic' ? 'normal' : 'italic')} style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedItem?.fontWeight === 'italic' ? 'rgba(99,102,241,0.3)' : 'transparent', color: selectedItem?.fontWeight === 'italic' ? '#fff' : 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: 13, border: '1px solid rgba(255,255,255,0.1)', transition: '0.2s' }}>I</div>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {(['left', 'center', 'right'] as const).map(a => (
                              <div key={a} onClick={() => updateSelectedProperty('textAlign', a)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: (selectedItem?.textAlign || 'center') === a ? 'rgba(255,255,255,0.15)' : 'transparent', border: '1px solid rgba(255,255,255,0.05)', color: (selectedItem?.textAlign || 'center') === a ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 11, transition: '0.2s' }}>
                                {a === 'left' ? '← 左对齐' : a === 'center' ? '— 居中' : '→ 右对齐'}
                              </div>
                            ))}
                          </div>

                          {/* 专业排版无极滑块矩阵 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
                            {([
                              ['fontSize', '字号', 8, 200, 1, 36],
                              ['textLetterSpacing', '字偶距', -10, 50, 1, 0],
                              ['textLineHeight', '行间距', 0.5, 3.0, 0.1, 1.2],
                              ['textOpacity', '不透明度', 0, 1, 0.05, 1],
                              ['textRotation', '旋转角度', -180, 180, 1, 0]
                            ]).map(([key, label, min, max, step, defVal]: any) => {
                              const val = getActiveTextProp(key, defVal);
                              return (
                                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{Number(val).toFixed(step < 1 ? 1 : 0)}</span>
                                  </div>
                                  <ProSlider min={min as number} max={max as number} step={step as number} value={val} isCentered={key === 'textRotation' || key === 'textLetterSpacing'} centerValue={0} onChange={d => updatePropertyWithUndo(key, d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #8B5CF6)" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </PropertyAccordionBlock>
                    );
                    
                    case 'text-anim': return (
                      <PropertyAccordionBlock key="text-anim" id="text-anim" title="🎬 时序动效引擎" order={Math.max(0, panelOrderText.indexOf('text-anim'))}
                        isCollapsed={!!panelCollapsed['text-anim']} onToggle={() => togglePanelCollapsed('text-anim')}
                        onDragStart={(e) => handleDragStart(e, 'text-anim')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'text-anim')}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* 这里采用与下方列表完全一致的 gridTemplateColumns 保证 100% 上下对齐 */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 4 }}>
                            {(['in', 'loop', 'out'] as const).map(tab => (
                              <div
                                key={tab}
                                onClick={() => setTextAnimTab(tab)}
                                style={{
                                  textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: textAnimTab === tab ? 600 : 400,
                                  color: textAnimTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                                  background: textAnimTab === tab ? 'rgba(99,102,241,0.5)' : 'transparent',
                                  borderRadius: 8, cursor: 'pointer', transition: '0.2s',
                                  boxShadow: textAnimTab === tab ? '0 2px 8px rgba(99,102,241,0.4)' : 'none'
                                }}
                              >
                                {tab === 'in' ? '✨ 入场' : tab === 'loop' ? '🔁 循环' : '💨 出场'}
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {textAnimTab === 'in' && ([
                              ['none', '🚫 刚性瞬间'], ['fadeIn', '☁️ 电影淡入'], ['slideUp', '↑ 稳重上升'],
                              ['typewriter', '⌨️ 原型打字'], ['zoom', '🔍 夸张冲刺'], ['bounce', '⬆ 俏皮弹跳'],
                              ['slideLeft', '→ 左划进入'], ['slideRight', '← 右划进入'], ['rotateIn', '🌀 炫酷旋入'],
                              ['blurIn', '💨 高斯聚焦'], ['dropIn', '☄️ 砸向屏幕'], ['elasticIn', '💢 弹力飞刺']
                            ] as [string, string][]).map(([val, label]) => (
                              <div
                                key={val}
                                onClick={() => updateSelectedProperty('textAnimation', val)}
                                style={{
                                  padding: '8px 0', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                                  fontSize: 11, fontWeight: (selectedItem?.textAnimation || 'none') === val ? 700 : 500,
                                  color: (selectedItem?.textAnimation || 'none') === val ? '#fff' : 'rgba(255,255,255,0.5)',
                                  background: (selectedItem?.textAnimation || 'none') === val ? 'rgba(99,102,241,0.3)' : 'rgba(0,0,0,0.2)',
                                  border: `1px solid ${(selectedItem?.textAnimation || 'none') === val ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.03)'}`,
                                  transition: '0.2s'
                                }}
                              >{label}</div>
                            ))}

                            {textAnimTab === 'loop' && ([
                              ['none', '🚫 无循环'], ['pulse', '💓 心跳呼吸'], ['shake', '📳 快速震动'],
                              ['float', '🎈 缓慢漂浮'], ['wave', '🌊 波浪蠕行'], ['glitch', '⚡ 信号故障'],
                              ['swing', '🔔 钟表摆动'], ['flash', '🔦 频闪警报'], ['spin', '🎡 疯狂旋转']
                            ] as [string, string][]).map(([val, label]) => (
                              <div
                                key={val}
                                onClick={() => updateSelectedProperty('textAnimLoop', val)}
                                style={{
                                  padding: '8px 0', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                                  fontSize: 11, fontWeight: (selectedItem?.textAnimLoop || 'none') === val ? 700 : 500,
                                  color: (selectedItem?.textAnimLoop || 'none') === val ? '#fff' : 'rgba(255,255,255,0.5)',
                                  background: (selectedItem?.textAnimLoop || 'none') === val ? 'rgba(52,211,153,0.3)' : 'rgba(0,0,0,0.2)',
                                  border: `1px solid ${(selectedItem?.textAnimLoop || 'none') === val ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.03)'}`,
                                  transition: '0.2s'
                                }}
                              >{label}</div>
                            ))}

                            {textAnimTab === 'out' && ([
                              ['none', '🚫 刚性切出'], ['fadeOut', '💨 渐隐消失'], ['zoomOut', '🌀 缩放抽离'],
                              ['slideDownOut', '↓ 直线下坠'], ['slideRightOut', '→ 划出右侧'], ['slideLeftOut', '← 划出左侧'],
                              ['blurOut', '👻 模糊消散'], ['rollOut', '🎡 滚轮退场'], ['sinkOut', '⚓ 沉入泥潭']
                            ] as [string, string][]).map(([val, label]) => (
                              <div
                                key={val}
                                onClick={() => updateSelectedProperty('textAnimOut', val)}
                                style={{
                                  padding: '8px 0', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                                  fontSize: 11, fontWeight: (selectedItem?.textAnimOut || 'none') === val ? 700 : 500,
                                  color: (selectedItem?.textAnimOut || 'none') === val ? '#fff' : 'rgba(255,255,255,0.5)',
                                  background: (selectedItem?.textAnimOut || 'none') === val ? 'rgba(248,113,113,0.3)' : 'rgba(0,0,0,0.2)',
                                  border: `1px solid ${(selectedItem?.textAnimOut || 'none') === val ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.03)'}`,
                                  transition: '0.2s'
                                }}
                              >{label}</div>
                            ))}
                          </div>

                          {(textAnimTab === 'in' && selectedItem?.textAnimation && selectedItem.textAnimation !== 'none') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>入场行进时长</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{(selectedItem?.textAnimDuration ?? 0.6).toFixed(1)}s</span></div>
                              <ProSlider min={0.1} max={5.0} step={0.1} value={selectedItem?.textAnimDuration ?? 0.6} onChange={d => updatePropertyWithUndo('textAnimDuration', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(99,102,241,0.2), #6366f1)" />
                            </div>
                          )}
                          {(textAnimTab === 'loop' && selectedItem?.textAnimLoop && selectedItem.textAnimLoop !== 'none') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>单词循环周期</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{(selectedItem?.textAnimLoopDuration ?? 2.0).toFixed(1)}s</span></div>
                              <ProSlider min={0.2} max={10.0} step={0.2} value={selectedItem?.textAnimLoopDuration ?? 2.0} onChange={d => updatePropertyWithUndo('textAnimLoopDuration', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(52,211,153,0.2), #34D399)" />
                            </div>
                          )}
                          {(textAnimTab === 'out' && selectedItem?.textAnimOut && selectedItem.textAnimOut !== 'none') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>出场行进时长</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{(selectedItem?.textAnimOutDuration ?? 0.6).toFixed(1)}s</span></div>
                              <ProSlider min={0.1} max={5.0} step={0.1} value={selectedItem?.textAnimOutDuration ?? 0.6} onChange={d => updatePropertyWithUndo('textAnimOutDuration', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(248,113,113,0.2), #f87171)" />
                            </div>
                          )}
                        </div>
                      </PropertyAccordionBlock>
                    );

                    case 'text-effects': return (
                      <PropertyAccordionBlock key="text-effects" id="text-effects" title="✨ 高阶特效容器" order={Math.max(0, panelOrderText.indexOf('text-effects'))}
                        isCollapsed={!!panelCollapsed['text-effects']} onToggle={() => togglePanelCollapsed('text-effects')}
                        onDragStart={(e) => handleDragStart(e, 'text-effects')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'text-effects')}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>光谱色</span>
                                  {renderPremiumColorPicker('textGlowColor', selectedItem?.textGlowColor || selectedItem?.fontColor || '#FFFFFF', selectedItem?.fontColor || '#FFFFFF')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>扩散半径</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{selectedItem?.textGlowRadius ?? 20}</span></div>
                                  <ProSlider min={0} max={100} step={1} value={selectedItem?.textGlowRadius ?? 20} onChange={d => updatePropertyWithUndo('textGlowRadius', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #6EE7B7)" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 涂装子模块：阴影 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textShadow', !selectedItem?.textShadow)}>
                              <span style={{ fontSize: 12, color: selectedItem?.textShadow ? '#C4B5FD' : 'rgba(255,255,255,0.6)', fontWeight: selectedItem?.textShadow ? 600 : 400 }}>🌑 物理投影 (Shadow)</span>
                              <div style={{ width: 36, height: 20, borderRadius: 10, background: selectedItem?.textShadow ? '#A78BFA' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: selectedItem?.textShadow ? 18 : 2, transition: '0.2s' }} />
                              </div>
                            </div>
                            {selectedItem?.textShadow && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>阴影色</span>
                                  {renderPremiumColorPicker('textShadowColor', selectedItem?.textShadowColor?.length === 7 ? selectedItem.textShadowColor : '#000000', '#000000')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>模糊度</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{selectedItem?.textShadowBlur ?? 10}</span></div>
                                  <ProSlider min={0} max={100} step={1} value={selectedItem?.textShadowBlur ?? 10} onChange={d => updatePropertyWithUndo('textShadowBlur', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #C4B5FD)" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Y轴偏移</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{selectedItem?.textShadowOffsetY ?? 4}</span></div>
                                  <ProSlider min={-50} max={50} step={1} value={selectedItem?.textShadowOffsetY ?? 4} isCentered centerValue={0} onChange={d => updatePropertyWithUndo('textShadowOffsetY', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #C4B5FD)" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 涂装子模块：描边 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textStroke', !selectedItem?.textStroke)}>
                              <span style={{ fontSize: 12, color: selectedItem?.textStroke ? '#93C5FD' : 'rgba(255,255,255,0.6)', fontWeight: selectedItem?.textStroke ? 600 : 400 }}>🔲 坚实描边 (Stroke)</span>
                              <div style={{ width: 36, height: 20, borderRadius: 10, background: selectedItem?.textStroke ? '#60A5FA' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: selectedItem?.textStroke ? 18 : 2, transition: '0.2s' }} />
                              </div>
                            </div>
                            {selectedItem?.textStroke && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>描边色</span>
                                  {renderPremiumColorPicker('textStrokeColor', selectedItem?.textStrokeColor || '#000000', '#000000')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>描边粗细</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{selectedItem?.textStrokeWidth ?? 2}</span></div>
                                  <ProSlider min={1} max={50} step={1} value={selectedItem?.textStrokeWidth ?? 2} onChange={d => updatePropertyWithUndo('textStrokeWidth', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #93C5FD)" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 涂装子模块：底板 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textBgEnable', !selectedItem?.textBgEnable)}>
                              <span style={{ fontSize: 12, color: selectedItem?.textBgEnable ? '#FCA5A5' : 'rgba(255,255,255,0.6)', fontWeight: selectedItem?.textBgEnable ? 600 : 400 }}>🏷️ 遮罩底板 (Plate)</span>
                              <div style={{ width: 36, height: 20, borderRadius: 10, background: selectedItem?.textBgEnable ? '#F87171' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: selectedItem?.textBgEnable ? 18 : 2, transition: '0.2s' }} />
                              </div>
                            </div>
                            {selectedItem?.textBgEnable && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>底板选色</span>
                                  {renderPremiumColorPicker('textBg', selectedItem?.textBg?.length === 7 ? selectedItem.textBg : '#1A1A1A', '#1A1A1A')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>底板圆角</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{selectedItem?.textBgRadius ?? 8}</span></div>
                                  <ProSlider min={0} max={100} step={1} value={selectedItem?.textBgRadius ?? 8} onChange={d => updatePropertyWithUndo('textBgRadius', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #FCA5A5)" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>横向扩充</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{selectedItem?.textBgPadX ?? 20}</span></div>
                                  <ProSlider min={0} max={200} step={1} value={selectedItem?.textBgPadX ?? 20} onChange={d => updatePropertyWithUndo('textBgPadX', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #FCA5A5)" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </PropertyAccordionBlock>
                    );

                    case 'text-presets': return (
                      <PropertyAccordionBlock key="text-presets" id="text-presets" title="🎨 一键应用画廊" order={Math.max(0, panelOrderText.indexOf('text-presets'))}
                        isCollapsed={!!panelCollapsed['text-presets']} onToggle={() => togglePanelCollapsed('text-presets')}
                        onDragStart={(e) => handleDragStart(e, 'text-presets')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'text-presets')}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          <div
                            onClick={() => { updateSelectedProperty('textGlow', false); updateSelectedProperty('textShadow', false); updateSelectedProperty('textStroke', false); updateSelectedProperty('textBgEnable', false); updateSelectedProperty('fontColor', '#FFFFFF'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)' }}
                          >✨ 恢复初始</div>
                          <div
                            onClick={() => { updateSelectedProperty('textGlow', true); updateSelectedProperty('textGlowColor', '#00f2fe'); updateSelectedProperty('textGlowRadius', 40); updateSelectedProperty('fontColor', '#ffffff'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#00f2fe', textShadow: '0 0 10px #00f2fe', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid #00f2fe' }}
                          >浪漫霓虹</div>
                          <div
                            onClick={() => { updateSelectedProperty('textGlow', true); updateSelectedProperty('textGlowColor', '#F59E0B'); updateSelectedProperty('textGlowRadius', 15); updateSelectedProperty('textShadow', true); updateSelectedProperty('textShadowColor', '#000000'); updateSelectedProperty('textShadowBlur', 5); updateSelectedProperty('fontColor', '#FDE68A'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: 'linear-gradient(45deg, #B45309, #F59E0B)', color: '#FFF', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid #FCD34D' }}
                          >烈火重金</div>
                          <div
                            onClick={() => { updateSelectedProperty('textShadow', true); updateSelectedProperty('textShadowColor', '#FF00FF'); updateSelectedProperty('textShadowBlur', 0); updateSelectedProperty('textShadowOffsetY', 4); updateSelectedProperty('fontColor', '#00FFFF'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: '#111', color: '#00FFFF', textShadow: '2px 2px 0px #FF00FF', fontSize: 11, cursor: 'pointer', fontWeight: 800, border: '1px solid rgba(255,255,255,0.2)' }}
                          >赛博朋克</div>
                          <div
                            onClick={() => { updateSelectedProperty('textGlow', true); updateSelectedProperty('textGlowColor', '#EF4444'); updateSelectedProperty('textGlowRadius', 40); updateSelectedProperty('fontColor', '#ffffff'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#EF4444', textShadow: '0 0 10px #EF4444', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid #EF4444' }}
                          >血色警告</div>
                          <div
                            onClick={() => { updateSelectedProperty('textGlow', true); updateSelectedProperty('textGlowColor', '#3B82F6'); updateSelectedProperty('textGlowRadius', 40); updateSelectedProperty('fontColor', '#ffffff'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#3B82F6', textShadow: '0 0 10px #3B82F6', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid #3B82F6' }}
                          >极简冰寒</div>
                          <div
                            onClick={() => { updateSelectedProperty('textShadow', true); updateSelectedProperty('textShadowColor', '#000000'); updateSelectedProperty('textShadowBlur', 5); updateSelectedProperty('fontColor', '#D4AF37'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: '#2C2B29', color: '#D4AF37', textShadow: '0 2px 4px #000', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid #D4AF37' }}
                          >古典碑刻</div>
                          <div
                            onClick={() => { updateSelectedProperty('textGlow', true); updateSelectedProperty('textGlowColor', '#8B5CF6'); updateSelectedProperty('textGlowRadius', 40); updateSelectedProperty('fontColor', '#ffffff'); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#8B5CF6', textShadow: '0 0 10px #8B5CF6', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid #8B5CF6' }}
                          >毒液侵袭</div>
                          <div
                            onClick={() => { updateSelectedProperty('textBgEnable', true); updateSelectedProperty('textBg', '#E53E3E'); updateSelectedProperty('textBgRadius', 4); updateSelectedProperty('fontColor', '#FFFFFF'); updateSelectedProperty('textShadow', true); updateSelectedProperty('textShadowColor', '#000000'); updateSelectedProperty('textShadowBlur', 4); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 4, background: '#E53E3E', color: '#FFF', textShadow: '0 1px 2px #000', fontSize: 11, cursor: 'pointer', fontWeight: 800, border: 'none' }}
                          >红底白字</div>
                          <div
                            onClick={() => { updateSelectedProperty('textStroke', true); updateSelectedProperty('textStrokeColor', '#000000'); updateSelectedProperty('textStrokeWidth', 6); updateSelectedProperty('fontColor', '#FFD700'); updateSelectedProperty('textShadow', true); updateSelectedProperty('textShadowColor', '#000000'); updateSelectedProperty('textShadowBlur', 10); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: '#111', color: '#FFD700', textShadow: '0 0 5px #000', WebkitTextStroke: '1px #000', fontSize: 11, cursor: 'pointer', fontWeight: 900, border: '1px solid #FFD700' }}
                          >美式油管</div>
                          <div
                            onClick={() => { updateSelectedProperty('textStroke', true); updateSelectedProperty('textStrokeColor', '#FFFFFF'); updateSelectedProperty('textStrokeWidth', 4); updateSelectedProperty('fontColor', '#000000'); updateSelectedProperty('textShadow', true); updateSelectedProperty('textShadowColor', '#000000'); updateSelectedProperty('textShadowBlur', 8); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: '#E5E7EB', color: '#000', textShadow: '0 2px 4px rgba(0,0,0,0.3)', WebkitTextStroke: '1px #FFF', fontSize: 11, cursor: 'pointer', fontWeight: 900, border: '2px solid #000' }}
                          >黑白印章</div>
                          <div
                            onClick={() => { updateSelectedProperty('textGlow', true); updateSelectedProperty('textGlowColor', '#10B981'); updateSelectedProperty('textGlowRadius', 25); updateSelectedProperty('fontColor', '#A7F3D0'); updateSelectedProperty('textShadow', true); updateSelectedProperty('textShadowColor', '#064E3B'); updateSelectedProperty('textShadowBlur', 2); updateSelectedProperty('textShadowOffsetY', 2); }}
                            style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background: 'linear-gradient(135deg, #064E3B, #047857)', color: '#A7F3D0', textShadow: '0 2px 2px #064E3B', fontSize: 11, cursor: 'pointer', fontWeight: 600, border: '1px solid #10B981' }}
                          >翡翠灵光</div>
                        </div>
                      </PropertyAccordionBlock>
                    );
                    default: return null;
                  }
                })}
              </div>
            );
          })()}
      </div>

        {/* GROUP 4: 几何、蒙版与转场 (独立组件) */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'transform' ? 'block' : 'none', padding: 0, background: 'transparent' }}>
        <TransformAndMaskPanel
          selectedItem={selectedItem!}
          updateSelectedProperty={updateSelectedProperty}
          updatePropertyWithUndo={updatePropertyWithUndo}
          finalizeSliderUndo={finalizeSliderUndo}
          commitSnapshotNow={commitSnapshotNow}
          isOverridden={isOverridden as any}
          restoreInheritance={restoreInheritance as any}
          
          favTrans={favTrans}
          toggleFavTrans={toggleFavTrans}
          setTimeline={setTimeline as any}
          setStatusMsg={setStatusMsg}
          
          orderTransform={Math.max(0, panelOrderImage.indexOf('transform'))}
          isCollapsedTransform={!!panelCollapsed['transform']}
          onToggleTransform={() => togglePanelCollapsed('transform')}
          onDragStartTransform={(e) => handleDragStart(e, 'transform')}
          onDropTransform={(e) => handleDrop(e, 'transform')}

          orderMask={Math.max(0, panelOrderImage.indexOf('mask'))}
          isCollapsedMask={!!panelCollapsed['mask']}
          onToggleMask={() => togglePanelCollapsed('mask')}
          onDragStartMask={(e) => handleDragStart(e, 'mask')}
          onDropMask={(e) => handleDrop(e, 'mask')}

          orderTransition={Math.max(0, panelOrderImage.indexOf('transition'))}
          isCollapsedTransition={!!panelCollapsed['transition']}
          onToggleTransition={() => togglePanelCollapsed('transition')}
          onDragStartTransition={(e) => handleDragStart(e, 'transition')}
          onDropTransition={(e) => handleDrop(e, 'transition')}
        />
      </div>
    </div>
  );
};