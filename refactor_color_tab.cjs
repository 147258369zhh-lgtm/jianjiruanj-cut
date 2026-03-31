const fs = require('fs');
let code = fs.readFileSync('src/components/ImagePropertyPanel.tsx', 'utf8');

// The main goal is to replace the entire <div className="ios-prop-group" style={{ display: propertyTab === 'color' ? 'block' : 'none' }}>
// down to its closing tag before the 批量操作按钮组.

const searchStart = `{/* GROUP 1: 影像与色彩 (合并) */}`;
const searchEndStr = `{/* 批量操作按钮组 */}`;

const startIndex = code.indexOf(searchStart);
const endIndex = code.indexOf(searchEndStr);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find bounds: Start=" + startIndex + " End=" + endIndex);
  process.exit(1);
}

// Ensure PropertyAccordionBlock is imported
if (!code.includes('PropertyAccordionBlock')) {
  // Insert import at top
  const importIdx = code.indexOf('\n', code.indexOf('globalDefaults'));
  code = code.substring(0, importIdx + 1) + `import { PropertyAccordionBlock } from './PropertyAccordionBlock';\n` + code.substring(importIdx + 1);
}

// We need to inject the drag state logic into ImagePropertyPanel
const dragLogic = `
  const { panelOrderImage, setPanelOrderImage, panelCollapsed, togglePanelCollapsed } = useAppContext();
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('sourceId', id);
    e.currentTarget.style.opacity = '0.4';
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    const sourceId = e.dataTransfer.getData('sourceId');
    if (!sourceId || sourceId === targetId) return;
    const items = [...panelOrderImage];
    const sourceIdx = items.indexOf(sourceId);
    const targetIdx = items.indexOf(targetId);
    if (sourceIdx > -1 && targetIdx > -1) {
      items.splice(sourceIdx, 1);
      items.splice(targetIdx, 0, sourceId);
      setPanelOrderImage(items);
    }
  };
  const resetKeys = (keys: string[]) => {
    commitSnapshotNow();
    setTimeline(prev => prev.map(t => {
      if (!selectedIds.has(t.id)) return t;
      const overrides = (t.overrides || []).filter(o => !keys.includes(o));
      let stateUpdates = {} as any;
      keys.forEach(k => { stateUpdates[k] = (GLOBAL_DEFAULTS_INIT as any)[k]; });
      return { ...t, overrides, ...stateUpdates };
    }));
    setStatusMsg('✨ 已重置该模块参数'); setTimeout(() => setStatusMsg(''), 1500);
  };
`;
// Insert drag logic inside component, before `const [textAnimTab...`
const compStart = `export const ImagePropertyPanel: React.FC<ImagePropertyPanelProps> = ({`;
const afterProps = code.indexOf(`const [textAnimTab, setTextAnimTab] = React.useState<'in' | 'loop' | 'out'>('in');`);
if (afterProps !== -1 && !code.includes('handleDragStart')) {
  code = code.substring(0, afterProps) + dragLogic + '\n  ' + code.substring(afterProps);
}

// Now replace the color tab content
let replacement = `
      {propertyTab === 'color' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          {panelOrderImage.filter(id => ['base', 'light', 'color', 'texture', 'curves'].includes(id)).map(blockId => {
            switch(blockId) {
              case 'base': return (
                <PropertyAccordionBlock key="base" id="base" title="⚙️ 基础与混合" order={Math.max(0, panelOrderImage.indexOf('base'))}
                  isCollapsed={!!panelCollapsed['base']} onToggle={() => togglePanelCollapsed('base')}
                  onDragStart={(e) => handleDragStart(e, 'base')} onDragOver={(e) => e.preventDefault()} onDragEnd={e=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'base')}
                  onReset={() => resetKeys(['animation', 'duration', 'opacity', 'blendMode'])}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    
                    <div className="ios-field" >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><label className="ios-field-label">照片动效/入场</label></span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <IosSelect
                          value={(selectedItem as any)?.animation || 'none'}
                          onChange={val => { commitSnapshotNow(); updateSelectedProperty('animation', val); }}
                          style={{ flex: 1, height: 32 }}
                          options={[ { value: 'none', label: '无动效 (None)' }, { value: 'anim-img-zoomDynamic', label: '动态电影缩放 (Dynamic Zoom)' }, { value: 'anim-img-fadeIn', label: '平滑淡入 (Fade In)' }, { value: 'anim-img-slideLeft', label: '从右滑入 (Slide Left)' }, { value: 'anim-img-slideRight', label: '从左滑入 (Slide Right)' }, { value: 'anim-img-slideUp', label: '向上浮现 (Slide Up)' }, { value: 'anim-img-slideDown', label: '向下降落 (Slide Down)' }, { value: 'anim-img-zoomIn', label: '缓慢放大 (Zoom In)' }, { value: 'anim-img-zoomOut', label: '缓慢缩小 (Zoom Out)' }, { value: 'anim-img-panLeft', label: '向左推移 (Pan Left)' }, { value: 'anim-img-panRight', label: '向右推移 (Pan Right)' } ]}
                        />
                        <div title="随机动效" className="ios-hover-scale" style={{ height: 32, width: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: 16 }} onClick={() => { commitSnapshotNow(); setTimeline(prev => prev.map(t => { if (resourceMap.get(t.resourceId)?.type === 'image') { const ov = new Set(t.overrides || []); ov.add('animation'); return { ...t, animation: ['none', 'anim-img-zoomDynamic', 'anim-img-fadeIn', 'anim-img-slideLeft'][Math.floor(Math.random()*4)], overrides: Array.from(ov) }; } return t; })); setStatusMsg('🎲 已随机生成新动效'); setTimeout(() => setStatusMsg(''), 2000); }}>🎲</div>
                      </div>
                    </div>

                    <div className="ios-field" >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <label className="ios-field-label">{\`时长: \${localDuration !== null ? localDuration : (selectedItem?.duration || 3)}s\`}</label>
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }} onMouseUp={() => { if (localDuration !== null) { commitSnapshotNow(); updateSelectedProperty('duration', localDuration); setLocalDuration(null); } }}>
                          <ProSlider min={0.1} max={10} step={0.1} value={localDuration !== null ? localDuration : (selectedItem?.duration || 3)} onChange={d => setLocalDuration(Math.round(d * 10) / 10)} style={{ width: '100%', maxWidth: '100%' }} />
                        </div>
                        <div title="随机波动时长" className="ios-hover-scale" style={{ height: 32, width: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: 16 }} onClick={() => { const base = localDuration !== null ? localDuration : (selectedItem?.duration || 3); commitSnapshotNow(); setTimeline(prev => prev.map(t => { if (resourceMap.get(t.resourceId)?.type === 'image') { const f = 0.8 + Math.random() * 0.4; const ov = new Set(t.overrides || []); ov.add('duration'); return { ...t, duration: Math.max(0.1, Math.round(base * f * 10)/10), overrides: Array.from(ov) }; } return t; })); }}>🎲</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>不透明度 (Opacity)</span><span style={{ fontSize: 11, color: '#60A5FA' }}>{Math.round((selectedItem?.opacity ?? 1.0) * 100)}%</span></div>
                      <ProSlider min={0.0} max={1.0} step={0.01} value={selectedItem?.opacity ?? 1.0} onChange={d => updatePropertyWithUndo('opacity', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #60A5FA)" />
                    </div>
                    
                    <div className="ios-field" ><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><label className="ios-field-label">图层混合选项</label></span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <IosSelect value={(selectedItem as any)?.blendMode || 'normal'} onChange={val => { commitSnapshotNow(); updateSelectedProperty('blendMode', val); }} style={{ flex: 1, height: 32 }} options={[ { value: 'normal', label: '正常 (Normal)' }, { value: 'multiply', label: '正片叠底 (Multiply)' }, { value: 'screen', label: '滤色 (Screen)' }, { value: 'overlay', label: '叠加 (Overlay)' } ]} />
                      </div>
                    </div>

                  </div>
                </PropertyAccordionBlock>
              );
              
              case 'light': return (
                <PropertyAccordionBlock key="light" id="light" title="💡 光影明暗" order={Math.max(0, panelOrderImage.indexOf('light'))}
                  isCollapsed={!!panelCollapsed['light']} onToggle={() => togglePanelCollapsed('light')}
                  onDragStart={(e) => handleDragStart(e, 'light')} onDragOver={(e) => e.preventDefault()} onDragEnd={e=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'light')}
                  onReset={() => resetKeys(['exposure', 'brilliance', 'highlights', 'shadows', 'whites', 'blacks', 'contrast'])}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {([['exposure', '曝光', 0.0, 2.0, 0.01], ['brilliance', '鲜明度', 0.0, 2.0, 0.01], ['highlights', '高光', 0.0, 2.0, 0.01], ['shadows', '阴影', 0.0, 2.0, 0.01], ['whites', '白色色阶', 0.0, 2.0, 0.01], ['blacks', '黑色色阶', 0.0, 2.0, 0.01], ['contrast', '对比度', 0.0, 2.0, 0.01]] as any).map(([key, label, min, max, step]: any) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{((selectedItem as any)?.[key] ?? 1.0).toFixed(2)}</span>
                        </div>
                        <ProSlider min={min} max={max} step={step} value={(selectedItem as any)?.[key] ?? 1.0} onChange={d => updatePropertyWithUndo(key, d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #E5E7EB)" />
                      </div>
                    ))}
                  </div>
                </PropertyAccordionBlock>
              );

              case 'color': return (
                <PropertyAccordionBlock key="color" id="color" title="🌈 色彩调节" order={Math.max(0, panelOrderImage.indexOf('color'))}
                  isCollapsed={!!panelCollapsed['color']} onToggle={() => togglePanelCollapsed('color')}
                  onDragStart={(e) => handleDragStart(e, 'color')} onDragOver={(e) => e.preventDefault()} onDragEnd={e=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'color')}
                  onReset={() => resetKeys(['saturation', 'vibrance', 'temp', 'tint'])}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {([['saturation', '饱和度', 0.0, 2.0, 0.01, 'linear-gradient(90deg, #9CA3AF, #EF4444)'], ['vibrance', '自然饱和度', 0.0, 2.0, 0.01, 'linear-gradient(90deg, #9CA3AF, #818CF8, #F472B6)'], ['temp', '色温', -100, 100, 1, 'linear-gradient(90deg, #60A5FA, #E5E7EB, #FBBF24)'], ['tint', '色调', -100, 100, 1, 'linear-gradient(90deg, #34D399, #E5E7EB, #C084FC)']] as any).map(([key, label, min, max, step, gradient]: any) => {
                      const isCentered = ['temp', 'tint'].includes(key); const centerVal = 0;
                      const cVal = (selectedItem as any)?.[key] ?? (isCentered ? 0 : 1.0);
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{isCentered ? cVal : cVal.toFixed(2)}</span>
                          </div>
                          <ProSlider isCentered={isCentered} centerValue={centerVal} min={min} max={max} step={step} value={cVal} onChange={d => updatePropertyWithUndo(key, d)} onMouseUp={finalizeSliderUndo} gradient={gradient} />
                        </div>
                      )
                    })}
                  </div>
                </PropertyAccordionBlock>
              );

              case 'texture': return (
                <PropertyAccordionBlock key="texture" id="texture" title="✨ 画面质感" order={Math.max(0, panelOrderImage.indexOf('texture'))}
                  isCollapsed={!!panelCollapsed['texture']} onToggle={() => togglePanelCollapsed('texture')}
                  onDragStart={(e) => handleDragStart(e, 'texture')} onDragOver={(e) => e.preventDefault()} onDragEnd={e=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'texture')}
                  onReset={() => resetKeys(['sharpness', 'fade', 'vignette', 'grain'])}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {([['sharpness', '清晰度', -3.0, 3.0, 0.01], ['fade', '褪色', 0.0, 1.0, 0.01], ['vignette', '暗角', -1.0, 1.0, 0.01], ['grain', '颗粒', 0.0, 1.0, 0.01]] as any).map(([key, label, min, max, step]: any) => {
                      const isCentered = ['sharpness', 'vignette'].includes(key); const centerVal = 0;
                      const cVal = (selectedItem as any)?.[key] ?? 0.0;
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{cVal.toFixed(2)}</span>
                          </div>
                          <ProSlider isCentered={isCentered} centerValue={centerVal} min={min} max={max} step={step} value={cVal} onChange={d => updatePropertyWithUndo(key, d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #9CA3AF)" />
                        </div>
                      )
                    })}
                  </div>
                </PropertyAccordionBlock>
              );

              case 'curves': return (
                <PropertyAccordionBlock key="curves" id="curves" title="📈 高级色彩曲线" order={Math.max(0, panelOrderImage.indexOf('curves'))}
                  isCollapsed={!!panelCollapsed['curves']} onToggle={() => togglePanelCollapsed('curves')}
                  onDragStart={(e) => handleDragStart(e, 'curves')} onDragOver={(e) => e.preventDefault()} onDragEnd={e=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'curves')}
                  onReset={() => resetKeys(['curveMaster', 'curveRed', 'curveGreen', 'curveBlue'])}
                >
                  <div style={{ paddingTop: 4 }}>
                    {selectedItem && (
                      <ColorCurvePanel 
                        curveMaster={selectedItem.curveMaster} curveRed={selectedItem.curveRed} curveGreen={selectedItem.curveGreen} curveBlue={selectedItem.curveBlue}
                        onChange={(ch, pts) => { const key = ch === 'master' ? 'curveMaster' : ch === 'red' ? 'curveRed' : ch === 'green' ? 'curveGreen' : 'curveBlue'; updatePropertyWithUndo(key, pts); }}
                        commitUndo={finalizeSliderUndo}
                      />
                    )}
                  </div>
                </PropertyAccordionBlock>
              );
              
              default: return null;
            }
          })}

          <CreateFilterButton selectedItem={selectedItem} setStatusMsg={setStatusMsg} />
        </div>
      )}
`;

// Replace the entire old rendering chunk with the new cleanly structured blocks!
let originalStartIndex = code.indexOf(searchStart);
let originalEndIndex = code.indexOf(searchEndStr);

let newCode = code.substring(0, originalStartIndex) + replacement + '\n      ' + code.substring(originalEndIndex);
fs.writeFileSync('src/components/ImagePropertyPanel.tsx', newCode);
console.log("Rewrite completed successfully!");

