import React from 'react';
import { TimelineItem, GlobalDefaults } from '../types';
import ProSlider from './ProSlider';
import IosSelect from './IosSelect';
import { PropertyAccordionBlock } from './PropertyAccordionBlock';

interface Props {
  selectedItem: TimelineItem;
  updateSelectedProperty: (key: keyof TimelineItem | string, val: any) => void;
  updatePropertyWithUndo: (key: string, val: any) => void;
  finalizeSliderUndo: () => void;
  commitSnapshotNow: () => void;
  
  isOverridden?: (item: TimelineItem, key: string) => boolean;
  restoreInheritance?: (itemId: string, key: keyof GlobalDefaults | string) => void;

  favTrans: string[];
  toggleFavTrans: (val: string) => void;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineItem[]>>;
  setStatusMsg: (msg: string) => void;

  // State handles for Transform Panel
  orderTransform: number;
  isCollapsedTransform: boolean;
  onToggleTransform: () => void;
  onDragStartTransform: (e: any) => void;
  onDropTransform: (e: any) => void;

  // State handles for Mask Panel
  orderMask: number;
  isCollapsedMask: boolean;
  onToggleMask: () => void;
  onDragStartMask: (e: any) => void;
  onDropMask: (e: any) => void;

  // State handles for Transition Panel
  orderTransition: number;
  isCollapsedTransition: boolean;
  onToggleTransition: () => void;
  onDragStartTransition: (e: any) => void;
  onDropTransition: (e: any) => void;
}

export const TransformAndMaskPanel: React.FC<Props> = ({
  selectedItem,
  updateSelectedProperty,
  updatePropertyWithUndo,
  finalizeSliderUndo,
  commitSnapshotNow,
  isOverridden,
  restoreInheritance,
  favTrans,
  toggleFavTrans,
  setTimeline,
  setStatusMsg,

  orderTransform, isCollapsedTransform, onToggleTransform, onDragStartTransform, onDropTransform,
  orderMask, isCollapsedMask, onToggleMask, onDragStartMask, onDropMask,
  orderTransition, isCollapsedTransition, onToggleTransition, onDragStartTransition, onDropTransition,
}) => {

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragEnd = (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = '1'; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      
      {/* ======================================= */}
      {/* 1. 基础形变 (Transform)                   */}
      {/* ======================================= */}
      <PropertyAccordionBlock 
        id="transform" 
        title="📐 基础形变引擎 (Transform)" 
        order={orderTransform}
        isCollapsed={isCollapsedTransform} 
        onToggle={onToggleTransform}
        onReset={() => {
          commitSnapshotNow();
          updateSelectedProperty('zoom', 1);
          updateSelectedProperty('rotation', 0);
          updateSelectedProperty('keystoneX', 0);
          updateSelectedProperty('keystoneY', 0);
          updateSelectedProperty('posX', 0);
          updateSelectedProperty('posY', 0);
          updateSelectedProperty('flipX', false);
          updateSelectedProperty('flipY', false);
        }}
        onDragStart={onDragStartTransform} 
        onDragOver={handleDragOver} 
        onDragEnd={handleDragEnd} 
        onDrop={onDropTransform}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Flip Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="ios-hover-scale"
              style={{ flex: 1, padding: '8px 0', background: selectedItem.flipX ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)', color: selectedItem.flipX ? '#34D399' : '#fff', border: `1px solid ${selectedItem.flipX ? 'rgba(52,211,153,0.4)' : 'transparent'}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              onClick={() => { commitSnapshotNow(); updateSelectedProperty('flipX', !selectedItem.flipX); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-16M9 4l-5 5 5 5M15 20l5-5-5-5"/></svg>
              水平翻转
            </button>
            <button 
              className="ios-hover-scale"
              style={{ flex: 1, padding: '8px 0', background: selectedItem.flipY ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)', color: selectedItem.flipY ? '#34D399' : '#fff', border: `1px solid ${selectedItem.flipY ? 'rgba(52,211,153,0.4)' : 'transparent'}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              onClick={() => { commitSnapshotNow(); updateSelectedProperty('flipY', !selectedItem.flipY); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(90deg)' }}><path d="M12 20v-16M9 4l-5 5 5 5M15 20l5-5-5-5"/></svg>
              垂直翻转
            </button>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

          {/* Scale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }} onDoubleClick={() => updateSelectedProperty('zoom', 1.0)} title="双击重置">缩放 (Scale)</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>{selectedItem?.zoom?.toFixed(2) || '1.00'}</span>
            </div>
            <ProSlider gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #60A5FA)" min={0.1} max={5.0} step={0.05} value={selectedItem?.zoom || 1.0} onChange={d => updatePropertyWithUndo('zoom', d)} onMouseUp={finalizeSliderUndo} />
          </div>

          {/* Rotation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }} onDoubleClick={() => updateSelectedProperty('rotation', 0)} title="双击归零">旋转 (Rotation)</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>{selectedItem?.rotation?.toFixed(0) || '0'}°</span>
            </div>
            <ProSlider gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #FDBA74)" min={-180} max={180} step={1} isCentered centerValue={0} value={selectedItem?.rotation || 0} onChange={d => updatePropertyWithUndo('rotation', d)} onMouseUp={finalizeSliderUndo} />
          </div>

          {/* Keystone X/Y Offsets in a Grid (or flex row) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span onDoubleClick={() => { commitSnapshotNow(); updateSelectedProperty('keystoneX', 0); }} style={{ cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.85)' }} title="双击重置">水平校正 (H-Keystone)</span>
                <span style={{ fontSize: 11, color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>{selectedItem?.keystoneX?.toFixed(1) || '0.0'}°</span>
              </div>
              <ProSlider gradient="linear-gradient(90deg, rgba(52,211,153,0.3), #34D399)" min={-45} max={45} step={0.5} isCentered centerValue={0} value={selectedItem?.keystoneX || 0} onChange={d => updatePropertyWithUndo('keystoneX', d)} onMouseUp={finalizeSliderUndo} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span onDoubleClick={() => { commitSnapshotNow(); updateSelectedProperty('keystoneY', 0); }} style={{ cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.85)' }} title="双击重置">垂直校正 (V-Keystone)</span>
                <span style={{ fontSize: 11, color: '#A78BFA', fontVariantNumeric: 'tabular-nums' }}>{selectedItem?.keystoneY?.toFixed(1) || '0.0'}°</span>
              </div>
              <ProSlider gradient="linear-gradient(90deg, rgba(167,139,250,0.3), #A78BFA)" min={-45} max={45} step={0.5} isCentered centerValue={0} value={selectedItem?.keystoneY || 0} onChange={d => updatePropertyWithUndo('keystoneY', d)} onMouseUp={finalizeSliderUndo} />
            </div>
          </div>

        </div>
      </PropertyAccordionBlock>

      {/* ======================================= */}
      {/* 2. 创意蒙版裁剪 (Mask Shapes & Crop)      */}
      {/* ======================================= */}
      <PropertyAccordionBlock 
        id="mask" 
        title="🎭 创意蒙版与裁切 (Masks)" 
        order={orderMask}
        isCollapsed={isCollapsedMask} 
        onToggle={onToggleMask}
        onReset={() => {
          commitSnapshotNow();
          updateSelectedProperty('maskShape', 'none');
          updateSelectedProperty('maskFeather', 0);
          updateSelectedProperty('maskInvert', false);
          updateSelectedProperty('fillMode', 'cover');
        }}
        onDragStart={onDragStartMask} 
        onDragOver={handleDragOver} 
        onDragEnd={handleDragEnd} 
        onDrop={onDropMask}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div className="ios-field" >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><label className="ios-field-label">画面基底</label></span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <IosSelect
                value={selectedItem?.fillMode || 'cover'}
                onChange={val => {
                  commitSnapshotNow();
                  updateSelectedProperty('fillMode', val);
                }}
                style={{ flex: 1, height: 32 }}
                options={[
                  { value: 'cover', label: '智能匹配铺满 (Cover)' },
                  { value: 'contain', label: '保留完整比例 (Contain)' },
                ]}
              />
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

          {/* Mask Shapes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>蒙版形状</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {([
                ['none', '🚫', '无'],
                ['circle', '⚪', '正圆'],
                ['ellipse', '👁️', '椭圆'],
                ['heart', '❤️', '心形'],
                ['star', '⭐', '星型'],
                ['triangle', '🔺', '三角'],
                ['rhombus', '♦️', '菱形'],
                ['hexagon', '⬡', '六边形'],
              ]).map(([val, icon, label]) => {
                const isActive = (selectedItem?.maskShape || 'none') === val;
                return (
                  <div key={val} className="ios-hover-scale" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer',
                    opacity: isActive ? 1 : 0.4, transition: '0.2s',
                    background: isActive ? 'linear-gradient(135deg, rgba(192,132,252,0.2), rgba(139,92,246,0.1))' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(192,132,252,0.4)' : 'transparent'}`,
                    borderRadius: 12, padding: '8px 4px'
                  }} onClick={() => { commitSnapshotNow(); updateSelectedProperty('maskShape', val); }}>
                    <div style={{ fontSize: 20 }}>{icon}</div>
                    <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? '#fff' : 'rgba(255,255,255,0.7)' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced Mask Controls */}
          {selectedItem?.maskShape && selectedItem.maskShape !== 'none' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 12 }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('maskInvert', !selectedItem?.maskInvert)}>
                <span style={{ fontSize: 11, color: selectedItem?.maskInvert ? '#F472B6' : 'rgba(255,255,255,0.85)', transition: '0.2s' }}>☯️ 反向蒙版 (Invert)</span>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: selectedItem?.maskInvert ? '#EC4899' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: selectedItem?.maskInvert ? 18 : 2, transition: '0.2s' }} />
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>边缘羽化 (Feather)</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{selectedItem?.maskFeather?.toFixed(0) || '0'}px</span>
                </div>
                <ProSlider gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #9ca3af)" min={0} max={100} step={1} value={selectedItem?.maskFeather || 0} onChange={d => updatePropertyWithUndo('maskFeather', d)} onMouseUp={finalizeSliderUndo} />
              </div>

            </div>
          )}

        </div>
      </PropertyAccordionBlock>

      {/* ======================================= */}
      {/* 3. 转场动画 (Transitions)                 */}
      {/* ======================================= */}
      <PropertyAccordionBlock 
        id="transition" 
        title="🎬 影片转场逻辑 (Transition)" 
        order={orderTransition}
        isCollapsed={isCollapsedTransition} 
        onToggle={onToggleTransition}
        onReset={() => {
          commitSnapshotNow();
          updateSelectedProperty('transition', 'none');
        }}
        onDragStart={onDragStartTransition} 
        onDragOver={handleDragOver} 
        onDragEnd={handleDragEnd} 
        onDrop={onDropTransition}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Transitions Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {([
              ['none', '切', '直接切入'],
              ['fade', '叠', '经典叠化'],
              ['white', '白', '模糊闪白'],
              ['iris', '扩', '中心扩散'],
              ['slide', '推', '平滑推入'],
              ['slide_up', '顶', '垂直推开'],
              ['zoom', '缩', '专业缩放'],
              ['wipe', '擦', '硬核擦除'],
              ['cube', '立', '立体旋转'],
              ['glitch', '碎', '故障艺术'],
              ['flip', '翻', '水平翻转'],
              ['burn', '灼', '胶片烧灼'],
              ['door', '门', '双门推开'],
              ['blur', '波', '水波溶解'],
              ['spin', '旋', '疾速旋入']
            ]).map(([val, icon, label]) => {
              const isActive = (selectedItem?.transition || 'none') === val;
              return (
                <div key={val} className="ios-hover-scale" style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer',
                  opacity: isActive ? 1 : 0.6, transition: '0.2s',
                  background: isActive ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.1))' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'transparent'}`,
                  borderRadius: 8, padding: '10px 4px'
                }} onClick={() => { commitSnapshotNow(); updateSelectedProperty('transition', val); }}>
                  <div style={{ 
                    width: 28, height: 28, borderRadius: '50%', background: isActive ? '#3B82F6' : 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff'
                  }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? '#60A5FA' : 'rgba(255,255,255,0.7)' }}>{label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              title="为时间线所有片段随机分配最新转场"
              className="ios-hover-scale"
              style={{
                padding: '6px 12px', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'center',
                background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: 11, color: '#818CF8',
                transition: 'all 0.2s',
              }}
              onClick={() => {
                commitSnapshotNow();
                const transPool = ['none', 'fade', 'white', 'iris', 'slide', 'slide_up', 'zoom', 'wipe', 'cube', 'glitch', 'flip', 'burn', 'door', 'blur', 'spin'];
                setTimeline(prev => prev.map(t => {
                  const randTrans = transPool[Math.floor(Math.random() * transPool.length)];
                  const ov = new Set(t.overrides || []);
                  ov.add('transition');
                  return { ...t, transition: randTrans, overrides: Array.from(ov) };
                }));
                setStatusMsg('🎲 已为全轨随机分配新转场！'); 
                setTimeout(() => setStatusMsg(''), 2000);
              }}
            >
              <span style={{ fontSize: 14 }}>🎲</span> 全局随机转场
            </button>
          </div>
        </div>
      </PropertyAccordionBlock>

    </div>
  );
};
