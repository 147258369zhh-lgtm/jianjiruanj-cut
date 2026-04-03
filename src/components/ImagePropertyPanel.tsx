import React, { SetStateAction } from 'react';
import { useStore } from '../store/index';
import { useAppContext } from '../hooks/useAppContext';
import { convertFileSrc } from '@tauri-apps/api/core';
// { SetStateAction } from 'react';
import { TimelineItem, AudioTimelineItem, GlobalDefaults, Resource } from '../types';
import ProSlider from './ProSlider';
import IosSelect from './IosSelect';
import { FILTER_PRESETS } from '../features/filter-engine/filterPresets';
import ColorPicker from '../features/text-workshop/ColorPicker';
import { PropertyAccordionBlock } from './PropertyAccordionBlock';
import ProFontSelectComp from '../features/text-workshop/FontSelector';
import { ColorCurvePanel } from './ColorCurvePanel';

import { FilterPresetGrid } from './FilterPresetGrid';
import { CreateFilterButton } from './CreateFilterButton';
import { HistogramLevelsControl } from './HistogramLevelsControl';
import { TransformAndMaskPanel } from './TransformAndMaskPanel';
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
  localDuration: number | null;
  setLocalDuration: (val: number | null) => void;
  updatePropertyWithUndo: (key: string, val: any) => void;
  finalizeSliderUndo: () => void;
  applyAllToTimeline: () => void;
  audioItems: AudioTimelineItem[];
  selectedTextIds: Set<string>;
  setSelectedTextIds: React.Dispatch<SetStateAction<Set<string>>>;
  isCropping: boolean;
  setIsCropping: (val: boolean) => void;
  crop: any;
  setCrop: (val: any) => void;
  favTrans: string[];
  toggleFavTrans: (val: string) => void;
}

export const ImagePropertyPanel: React.FC<Props> = ({
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
  localDuration,
  setLocalDuration,
  updatePropertyWithUndo,
  finalizeSliderUndo,
  applyAllToTimeline,
  audioItems,
  selectedTextIds,
  setSelectedTextIds,
  isCropping: _isCropping,
  setIsCropping: _setIsCropping,
  crop: _crop,
  setCrop: _setCrop,
  favTrans,
  toggleFavTrans
}) => {
  const [textAnimTab, setTextAnimTab] = React.useState<'in' | 'loop' | 'out'>('in');
  const [randomBaseDuration, setRandomBaseDuration] = React.useState<number | null>(null);

  React.useEffect(() => {
    setRandomBaseDuration(null);
  }, [selectedItem?.id]);

  const { panelOrderImage, setPanelOrderImage, panelOrderText, setPanelOrderText, panelCollapsed, togglePanelCollapsed } = useStore();
  
  const appContext = useAppContext();
  const previewCache = appContext?.previewCache || {};

  const [isEnhancing, setIsEnhancing] = React.useState(false);

  const handleAutoEnhance = () => {
    const dlog = (msg: string) => { fetch('http://127.0.0.1:11111/', { method: 'POST', body: msg }).catch(_=>{}); };
    dlog(`1. Clicked Auto Enhance. selectedItem=${!!selectedItem}, id=${selectedItem?.resourceId}`);

    const res = resourceMap.get(selectedItem?.resourceId || '');
    if (!selectedItem || !res || (res.type !== 'image' && res.type !== 'video')) {
      dlog(`2. Early return. type=${res?.type}`);
      return;
    }
    
    let imgUrl = previewCache[res.path];
    if (!imgUrl && res.type === 'image') {
       imgUrl = convertFileSrc(res.path);
       dlog(`3. Rebuilt imgUrl via convertFileSrc: ${imgUrl.substring(0, 15)}`);
    }

    if (!imgUrl) {
      dlog('3. imgUrl is MISSING and no fallback possible');
      setStatusMsg('⚠️ 等待缩略图加载完成...'); setTimeout(() => setStatusMsg(''), 2000);
      return;
    }
    
    dlog('4. Starting fetch...');
    setIsEnhancing(true);
    fetch(imgUrl)
      .then(res => res.blob())
      .then(blob => {
        dlog(`5. blob retrieved size=${blob.size}`);
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        
        img.onerror = () => {
          dlog('6. img.onerror fired');
          setIsEnhancing(false);
          setStatusMsg('⚠️ 图像跨域或读取失败，无法智能分析');
          setTimeout(() => setStatusMsg(''), 3000);
          URL.revokeObjectURL(objUrl);
        };

        img.onload = () => {
          dlog('7. img.onload fired');
          const canvas = document.createElement('canvas');
          canvas.width = 128; // Small size for extreme speed
          canvas.height = 128;
          const ctx = canvas.getContext('2d');
          if (!ctx) { setIsEnhancing(false); return; }
          ctx.drawImage(img, 0, 0, 128, 128);
          
          let data;
          try {
            data = ctx.getImageData(0, 0, 128, 128).data;
            dlog(`8. getImageData retrieved. len=${data.length}`);
          } catch (e: any) {
            dlog(`8. canvas tainted error! ${e}`);
            setIsEnhancing(false);
            setStatusMsg('⚠️ 画布读取被拦截 (Canvas Tainted)');
            setTimeout(() => setStatusMsg(''), 3000);
            return;
          }
      
      let sumLuma = 0, sumR = 0, sumG = 0, sumB = 0;
      let lumas = [];
      let sumSat = 0;
      let skinPixelCount = 0;
      
      for (let i = 0; i < data.length; i += 4) {
         const r = data[i], g = data[i+1], b = data[i+2];
         sumR += r; sumG += g; sumB += b;
         
         // 1. Rec. 709 Luminance
         const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
         sumLuma += luma;
         lumas.push(luma);
         
         // 2. Saturation
         const cmax = Math.max(r, g, b), cmin = Math.min(r, g, b);
         sumSat += cmax === 0 ? 0 : (cmax - cmin) / cmax;
         
         // 3. YCbCr Conversion for Skin Tone Detection
         // using standard BT.601 constants to derive chrominance
         const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
         const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
         
         // Mathematical skin bounds commonly used by camera ISPs
         if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
            skinPixelCount++;
         }
      }
      const pixelCount = data.length / 4;
      const avgLuma = sumLuma / pixelCount;
      const avgR = sumR / pixelCount;
      const avgB = sumB / pixelCount;
      const avgSat = sumSat / pixelCount;
      
      // Standard deviation of Luma
      let varianceSum = 0;
      for (let l of lumas) { varianceSum += (l - avgLuma) ** 2; }
      const stdDev = Math.sqrt(varianceSum / pixelCount);
      
      const skinRatio = skinPixelCount / pixelCount;
      // Extrema analysis for Histogram Stretching (White/Black points)
      lumas.sort((a,b)=>a-b);
      const p1 = lumas[Math.floor(lumas.length * 0.01)]; // True black point
      const p5 = lumas[Math.floor(lumas.length * 0.05)];
      const p50 = lumas[Math.floor(lumas.length * 0.50)]; // Median luma
      const p95 = lumas[Math.floor(lumas.length * 0.95)];
      const p99 = lumas[Math.floor(lumas.length * 0.99)]; // True white point

      // --- ADVANCED COMPUTATIONAL HEURISTICS (Fuzzy Logic Weighted Blends) ---
      // Helper function for continuous linear interpolation (lerp)
      const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
      const mapRange = (val: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
         return clamp(outMin + (val - inMin) * (outMax - outMin) / (inMax - inMin), Math.min(outMin, outMax), Math.max(outMin, outMax));
      };

      // 1. Semantic Weights (Continuous Factors 0.0 ~ 1.0 instead of strict boolean triggers)
      const portraitWeight = mapRange(skinRatio, 0.02, 0.15, 0, 1);    // 0=Landscape, 1=Heavy Portrait
      const moodWeight = mapRange(stdDev, 15, 40, 1, 0);               // 1=Atmospheric/Fog/Low-key, 0=Hard light
      const backlightWeight = mapRange(p95 - p5, 180, 230, 0, 1) * mapRange(p50, 40, 90, 1, 0); // High spread but dark median = Backlit
      const fadeWeight = mapRange(avgSat, 0.05, 0.25, 1, 0);           // 1=Washed out/Dull, 0=Healthy color
      const neonWeight = mapRange(avgSat, 0.45, 0.70, 0, 1);           // 1=Over-saturated/Neon, 0=Normal
      const optimalLightWeight = mapRange(Math.abs(avgLuma - 115), 0, 40, 1, 0); // 1=Already beautifully exposed

      // 2. Exposure & Tone Mapping
      const targetLuma = 110 + (portraitWeight * 15) - (moodWeight * 20); // Portraits want 125, Mood wants 90
      let rawExposure = 1.0 + (targetLuma - avgLuma) / 255;
      
      // Zero-Touch Policy: heavily dampen adjustment if it's already well-exposed
      let newExposure = rawExposure * (1 - optimalLightWeight * 0.6) + 1.0 * (optimalLightWeight * 0.6);
      newExposure = clamp(newExposure, 0.6, 1.5); 
      
      // 3. Contrast 
      let newContrast = 1.0 + (60 - stdDev) / 100;
      // Mood preservation: strictly suppress contrast boosting in moody/foggy photos
      newContrast = newContrast * (1 - moodWeight * 0.8) + 1.0 * (moodWeight * 0.8);
      newContrast = clamp(newContrast, 0.8, 1.3);

      // 4. Smart HDR (Continuous Highlights/Shadows)
      let newHighlights = 1.0;
      let newShadows = 1.0;
      let newWhites = 1.0;
      let newBlacks = 1.0;
      
      // Shadow Recovery
      newShadows += mapRange(p5, 0, 30, 0.35, 0);         // General shadow lift
      newShadows += backlightWeight * 0.2;                // Extra lift if backlit
      newShadows = clamp(newShadows, 0.8, 1.4);

      // Highlight Suppression
      newHighlights -= mapRange(p95, 220, 255, 0, 0.25);  // General highlight recovery
      newHighlights -= backlightWeight * 0.15;            // Extra suppress if bright sky behind subject
      newHighlights = clamp(newHighlights, 0.65, 1.1);
      
      // Histogram Edge Stretching (The "Pop" factor)
      // Only stretch if it's NOT intentionally moody
      const stretchFactor = 1.0 - moodWeight;
      newBlacks -= mapRange(p1, 5, 40, 0, 0.2) * stretchFactor;
      newWhites += mapRange(p99, 210, 245, 0.2, 0) * stretchFactor;

      // 5. Intelligent White Balance (Portrait Protection)
      let tempDiff = (avgB - avgR); 
      let rawTemp = tempDiff * 0.15; 
      
      // Smoothly blend from landscape logic (allow mild cooling) to portrait logic (force warmth)
      let landscapeTemp = clamp(rawTemp, -10, 10);
      let portraitTemp = Math.max(2, rawTemp + 5); // Minimum +2 warmth for faces, adds a bit more if naturally warm
      let finalTemp = landscapeTemp * (1 - portraitWeight) + portraitTemp * portraitWeight;
      
      // 6. Color Analytics (Vibrance & Saturation)
      let newSat = 1.0;
      let newVib = 1.0;
      
      // Add punch to dull photos, pull back neon, protect skin tones preferably via vibrance
      newSat += fadeWeight * 0.15 - neonWeight * 0.08;
      newVib += fadeWeight * 0.25 + portraitWeight * 0.15 - neonWeight * 0.1;
      
      newSat = clamp(newSat, 0.9, 1.25);
      newVib = clamp(newVib, 0.9, 1.3);

      setTimeout(() => { // slight delay for visual effect
        commitSnapshotNow(); // Start undo block

        dlog(`9. Applying continuous fuzzy updates. Expo:${newExposure.toFixed(2)}, BW:[${newBlacks.toFixed(2)},${newWhites.toFixed(2)}], PortW:${portraitWeight.toFixed(2)}`);
        // Use the native property updater which safely handles `overrides` arrays and React functional batching!
        updateSelectedProperty('exposure', parseFloat(newExposure.toFixed(2)));
        updateSelectedProperty('contrast', parseFloat(newContrast.toFixed(2)));
        updateSelectedProperty('highlights', parseFloat(newHighlights.toFixed(2)));
        updateSelectedProperty('shadows', parseFloat(newShadows.toFixed(2)));
        updateSelectedProperty('whites', parseFloat(newWhites.toFixed(2)));
        updateSelectedProperty('blacks', parseFloat(newBlacks.toFixed(2)));
        updateSelectedProperty('temp', Math.round(finalTemp));
        updateSelectedProperty('saturation', parseFloat(newSat.toFixed(2)));
        updateSelectedProperty('vibrance', parseFloat(newVib.toFixed(2)));
        
        setIsEnhancing(false);
        setStatusMsg('✨ 图像色彩与光影已智能优化');
        dlog('10. Success!');
        setTimeout(() => setStatusMsg(''), 2000);
        
        URL.revokeObjectURL(objUrl);
      }, 100);
    };
    img.src = objUrl;
  })
  .catch(err => {
    dlog(`fetch fail! ${err.message || err}`);
    setIsEnhancing(false);
    setStatusMsg(`⚠️ 分析被拦截: ${err.message || err}`);
    setTimeout(() => setStatusMsg(''), 3000);
  });
  };
  
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
  
  
    const resetKeys = (keys: string[]) => {
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

      
      {propertyTab === 'color' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          
          {/* 一键修图独立模块 */}
          <div style={{
            background: 'var(--ios-card)', borderRadius: 16, padding: 12, marginBottom: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>✨</span> 智能一键修图
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>AI COLOR</span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>
                智能分析画面光影色彩标准差，瞬间推算最佳亮度、对比、白平衡等全套参数。
              </p>
              <button 
                className="ios-button"
                disabled={isEnhancing}
                style={{
                  background: isEnhancing ? 'var(--ios-card)' : 'linear-gradient(135deg, #10B981, #059669)',
                  color: isEnhancing ? 'rgba(255,255,255,0.5)' : '#fff',
                  border: isEnhancing ? '1px dashed rgba(16,185,129,0.4)' : 'none',
                  boxShadow: isEnhancing ? 'none' : '0 4px 12px rgba(16,185,129,0.3)',
                  height: 36, marginTop: 4, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative', overflow: 'hidden'
                }}
                onClick={handleAutoEnhance}
              >
                {isEnhancing ? '正在极速分析像素...' : '一键自动优化'}
                {!isEnhancing && <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  transform: 'skewX(-20deg)',
                  animation: 'shimmer 3s infinite'
                }} />}
              </button>
            </div>
          </div>



          {(() => {
            const renderOrder = [...panelOrderImage];
            if (!renderOrder.includes('levels')) {
              const curIdx = renderOrder.indexOf('curves');
              if (curIdx >= 0) renderOrder.splice(curIdx, 0, 'levels');
              else renderOrder.push('levels');
            }
            return renderOrder.filter(id => ['base', 'light', 'color', 'texture', 'levels', 'curves'].includes(id)).map(blockId => {
            switch(blockId) {
              case 'base': {
                const activeDurationBase = localDuration !== null 
                  ? localDuration 
                  : (randomBaseDuration !== null ? randomBaseDuration : (selectedItem?.duration || 3));
                  
                return (
                <PropertyAccordionBlock key="base" id="base" title="⚙️ 基础与混合" order={Math.max(0, panelOrderImage.indexOf('base'))}
                  isCollapsed={!!panelCollapsed['base']} onToggle={() => togglePanelCollapsed('base')}
                  onDragStart={(e) => handleDragStart(e, 'base')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'base')}
                  onReset={() => { commitSnapshotNow(); updateSelectedProperty('animation', 'none'); updateSelectedProperty('duration', 3); updateSelectedProperty('opacity', 1.0); updateSelectedProperty('blendMode', 'normal'); }}
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
                        <label className="ios-field-label">{`时长: ${activeDurationBase}s`}</label>
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }} onMouseUp={() => { if (localDuration !== null) { commitSnapshotNow(); updateSelectedProperty('duration', localDuration); setLocalDuration(null); setRandomBaseDuration(null); } }}>
                          <ProSlider min={0.1} max={10} step={0.1} value={activeDurationBase} onChange={d => { setLocalDuration(Math.round(d * 10) / 10); setRandomBaseDuration(null); }} style={{ width: '100%', maxWidth: '100%' }} />
                        </div>
                        <div title="随机波动时长" className="ios-hover-scale" style={{ height: 32, width: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', cursor: 'pointer', fontSize: 16 }} onClick={() => { setRandomBaseDuration(activeDurationBase); commitSnapshotNow(); setTimeline(prev => prev.map(t => { if (resourceMap.get(t.resourceId)?.type === 'image') { const f = 0.7 + Math.random() * 0.6; const ov = new Set(t.overrides || []); ov.add('duration'); return { ...t, duration: Math.max(0.1, Math.round(activeDurationBase * f * 10)/10), overrides: Array.from(ov) }; } return t; })); }}>🎲</div>
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
              }
              
              case 'light': return (
                <PropertyAccordionBlock key="light" id="light" title="💡 光影明暗" order={Math.max(0, panelOrderImage.indexOf('light'))}
                  isCollapsed={!!panelCollapsed['light']} onToggle={() => togglePanelCollapsed('light')}
                  onDragStart={(e) => handleDragStart(e, 'light')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'light')}
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
                  onDragStart={(e) => handleDragStart(e, 'color')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'color')}
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
                  onDragStart={(e) => handleDragStart(e, 'texture')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'texture')}
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

              case 'levels': return (
                <PropertyAccordionBlock key="levels" id="levels" title="📈 色阶与直方图" order={Math.max(0, panelOrderImage.indexOf('levels'))}
                  isCollapsed={!!panelCollapsed['levels']} onToggle={() => togglePanelCollapsed('levels')}
                  onDragStart={(e) => handleDragStart(e, 'levels')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'levels')}
                  onReset={() => { updateSelectedProperty('levelInBlack', 0); updateSelectedProperty('levelInGamma', 1.0); updateSelectedProperty('levelInWhite', 255); commitSnapshotNow(); }}
                >
                  <HistogramLevelsControl
                    imageUrl={selectedItem ? resourceMap.get(selectedItem.resourceId)?.path : undefined}
                    levelInBlack={selectedItem?.levelInBlack ?? 0}
                    levelInGamma={selectedItem?.levelInGamma ?? 1.0}
                    levelInWhite={selectedItem?.levelInWhite ?? 255}
                    onChange={(b: number, g: number, w: number) => {
                      updateSelectedProperty('levelInBlack', b);
                      updateSelectedProperty('levelInGamma', g);
                      updateSelectedProperty('levelInWhite', w);
                    }}
                    onUndoCommit={commitSnapshotNow}
                  />
                </PropertyAccordionBlock>
              );

              case 'curves': return (
                <PropertyAccordionBlock key="curves" id="curves" title="📈 高级色彩曲线" order={Math.max(0, panelOrderImage.indexOf('curves'))}
                  isCollapsed={!!panelCollapsed['curves']} onToggle={() => togglePanelCollapsed('curves')}
                  onDragStart={(e) => handleDragStart(e, 'curves')} onDragOver={(e) => e.preventDefault()} onDragEnd={(e: any)=>{e.currentTarget.style.opacity='1'}} onDrop={(e) => handleDrop(e, 'curves')}
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
          });
          })()}

        </div>
      )}

      {/* 保存当前参数为专属滤镜 - 放在影像色彩栏目最下方 */}
      {propertyTab === 'color' && (
        <CreateFilterButton selectedItem={selectedItem} setStatusMsg={setStatusMsg} />
      )}

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
                            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, maxHeight: 120, overflowY: 'auto' as const }}>
                              {(!selectedItem?.textOverlays || selectedItem.textOverlays.length === 0) && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '6px 12px', gridColumn: '1 / -1', textAlign: 'center' }}>无独立文本层 (仅使用主轴文字)</div>
                              )}
                              {(selectedItem?.textOverlays || []).map((overlay: any) => (
                                <div key={overlay.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedTextIds.has(overlay.id) ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)', border: `1px solid ${selectedTextIds.has(overlay.id) ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.05)'}`, padding: '4px 6px', borderRadius: 8, cursor: 'pointer', transition: '0.2s', fontSize: 10, color: '#fff', overflow: 'hidden' }}
                                  onClick={() => { const newSet = new Set(selectedTextIds); if (newSet.has(overlay.id)) newSet.delete(overlay.id); else newSet.add(overlay.id); setSelectedTextIds(newSet); }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{overlay.text || '空文本'}</span>
                                  <span style={{ marginLeft: 4, opacity: 0.5, cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); setTimeline(prev => prev.map(t => { if (t.id === selectedItem?.id) { return { ...t, textOverlays: (t.textOverlays || []).filter((o: any) => o.id !== overlay.id) }; } return t; })); }}>×</span>
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
                                value={getActiveTextProp('fontFamily', 'sans-serif')}
                                onChange={v => updateSelectedProperty('fontFamily', v)}
                                optGroups={[
                                  { label: '🖌️ 书法大家 (已内置)', options: [
                                    { label: '志莽行书 · 米芾风韵', value: 'ZhiMangXing' },
                                    { label: '马善政楷书 · 颜柳正楷', value: 'MaShanZheng' },
                                    { label: '龙藏体 · 碑刻古韵', value: 'LongCang' },
                                    { label: '流建毛草 · 怀素狂草', value: 'LiuJianMaoCao' }
                                  ]},
                                  { label: '🎨 萌趣艺术 (已内置)', options: [
                                    { label: '庆科黄油体 · 圆润可爱', value: 'ZCOOLQingKeHuangYou' },
                                    { label: '快乐体 · 童趣跳跃', value: 'ZCOOLKuaiLe' },
                                    { label: '小薇体 · 清秀典雅', value: 'ZCOOLXiaoWei' }
                                  ]},
                                  { label: '💻 系统字体', options: [
                                    { label: '默认黑体', value: 'sans-serif' },
                                    { label: '微软雅黑', value: "'Microsoft YaHei', sans-serif" },
                                    { label: '黑体 SimHei', value: "'SimHei', sans-serif" },
                                    { label: '宋体 SimSun', value: "'SimSun', serif" },
                                    { label: '楷体 KaiTi', value: "'KaiTi', serif" },
                                    { label: '华文行楷', value: "'STXingkai', cursive" },
                                    { label: '幼圆', value: "'YouYuan', sans-serif" }
                                  ]},
                                  { label: '🔤 西文经典', options: [
                                    { label: 'Impact 海报体', value: "'Impact', sans-serif" },
                                    { label: 'Georgia 衬线', value: "'Georgia', serif" },
                                    { label: 'Courier 打字机', value: "'Courier New', monospace" }
                                  ]}
                                ]}
                              />
                            </div>
                            
                            <div onClick={() => { const cur = getActiveTextProp('fontWeight', 'normal'); updateSelectedProperty('fontWeight', cur === 'bold' ? 'normal' : 'bold'); }} style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: getActiveTextProp('fontWeight', 'normal') === 'bold' ? 'rgba(99,102,241,0.3)' : 'transparent', color: getActiveTextProp('fontWeight', 'normal') === 'bold' ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)', transition: '0.2s' }}>B</div>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {(['left', 'center', 'right'] as const).map(a => (
                              <div key={a} onClick={() => updateSelectedProperty('textAlign', a)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: getActiveTextProp('textAlign', 'center') === a ? 'rgba(255,255,255,0.15)' : 'transparent', border: '1px solid rgba(255,255,255,0.05)', color: getActiveTextProp('textAlign', 'center') === a ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 11, transition: '0.2s' }}>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textGlow', !getActiveTextProp('textGlow', false))}>
                              <span style={{ fontSize: 12, color: getActiveTextProp('textGlow', false) ? '#6EE7B7' : 'rgba(255,255,255,0.6)', fontWeight: getActiveTextProp('textGlow', false) ? 600 : 400 }}>✨ 霓虹发光 (Glow)</span>
                              <div style={{ width: 36, height: 20, borderRadius: 10, background: getActiveTextProp('textGlow', false) ? '#34D399' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: getActiveTextProp('textGlow', false) ? 18 : 2, transition: '0.2s' }} />
                              </div>
                            </div>
                            {getActiveTextProp('textGlow', false) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>光谱色</span>
                                  {renderPremiumColorPicker('textGlowColor', getActiveTextProp('textGlowColor', getActiveTextProp('fontColor', '#FFFFFF')), getActiveTextProp('fontColor', '#FFFFFF'))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>扩散半径</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{getActiveTextProp('textGlowRadius', 20)}</span></div>
                                  <ProSlider min={0} max={100} step={1} value={getActiveTextProp('textGlowRadius', 20)} onChange={d => updatePropertyWithUndo('textGlowRadius', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #6EE7B7)" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 涂装子模块：阴影 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textShadow', !getActiveTextProp('textShadow', false))}>
                              <span style={{ fontSize: 12, color: getActiveTextProp('textShadow', false) ? '#C4B5FD' : 'rgba(255,255,255,0.6)', fontWeight: getActiveTextProp('textShadow', false) ? 600 : 400 }}>🌑 物理投影 (Shadow)</span>
                              <div style={{ width: 36, height: 20, borderRadius: 10, background: getActiveTextProp('textShadow', false) ? '#A78BFA' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: getActiveTextProp('textShadow', false) ? 18 : 2, transition: '0.2s' }} />
                              </div>
                            </div>
                            {getActiveTextProp('textShadow', false) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>阴影色</span>
                                  {renderPremiumColorPicker('textShadowColor', (getActiveTextProp('textShadowColor', '') || '').length === 7 ? getActiveTextProp('textShadowColor', '') : '#000000', '#000000')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>模糊度</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{getActiveTextProp('textShadowBlur', 10)}</span></div>
                                  <ProSlider min={0} max={100} step={1} value={getActiveTextProp('textShadowBlur', 10)} onChange={d => updatePropertyWithUndo('textShadowBlur', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #C4B5FD)" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Y轴偏移</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{getActiveTextProp('textShadowOffsetY', 4)}</span></div>
                                  <ProSlider min={-50} max={50} step={1} value={getActiveTextProp('textShadowOffsetY', 4)} isCentered centerValue={0} onChange={d => updatePropertyWithUndo('textShadowOffsetY', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #C4B5FD)" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 涂装子模块：描边 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textStroke', !getActiveTextProp('textStroke', false))}>
                              <span style={{ fontSize: 12, color: getActiveTextProp('textStroke', false) ? '#93C5FD' : 'rgba(255,255,255,0.6)', fontWeight: getActiveTextProp('textStroke', false) ? 600 : 400 }}>🔲 坚实描边 (Stroke)</span>
                              <div style={{ width: 36, height: 20, borderRadius: 10, background: getActiveTextProp('textStroke', false) ? '#60A5FA' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: getActiveTextProp('textStroke', false) ? 18 : 2, transition: '0.2s' }} />
                              </div>
                            </div>
                            {getActiveTextProp('textStroke', false) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>描边色</span>
                                  {renderPremiumColorPicker('textStrokeColor', getActiveTextProp('textStrokeColor', '#000000'), '#000000')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>描边粗细</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{getActiveTextProp('textStrokeWidth', 2)}</span></div>
                                  <ProSlider min={1} max={50} step={1} value={getActiveTextProp('textStrokeWidth', 2)} onChange={d => updatePropertyWithUndo('textStrokeWidth', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #93C5FD)" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 涂装子模块：底板 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSelectedProperty('textBgEnable', !getActiveTextProp('textBgEnable', false))}>
                              <span style={{ fontSize: 12, color: getActiveTextProp('textBgEnable', false) ? '#FCA5A5' : 'rgba(255,255,255,0.6)', fontWeight: getActiveTextProp('textBgEnable', false) ? 600 : 400 }}>🏷️ 遮罩底板 (Plate)</span>
                              <div style={{ width: 36, height: 20, borderRadius: 10, background: getActiveTextProp('textBgEnable', false) ? '#F87171' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: getActiveTextProp('textBgEnable', false) ? 18 : 2, transition: '0.2s' }} />
                              </div>
                            </div>
                            {getActiveTextProp('textBgEnable', false) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 60 }}>底板选色</span>
                                  {renderPremiumColorPicker('textBg', (getActiveTextProp('textBg', '') || '').length === 7 ? getActiveTextProp('textBg', '') : '#1A1A1A', '#1A1A1A')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>底板圆角</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{getActiveTextProp('textBgRadius', 8)}</span></div>
                                  <ProSlider min={0} max={100} step={1} value={getActiveTextProp('textBgRadius', 8)} onChange={d => updatePropertyWithUndo('textBgRadius', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #FCA5A5)" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>横向扩充</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{getActiveTextProp('textBgPadX', 20)}</span></div>
                                  <ProSlider min={0} max={200} step={1} value={getActiveTextProp('textBgPadX', 20)} onChange={d => updatePropertyWithUndo('textBgPadX', d)} onMouseUp={finalizeSliderUndo} gradient="linear-gradient(90deg, rgba(255,255,255,0.1), #FCA5A5)" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </PropertyAccordionBlock>
                    );


                    case 'text-presets': return null;
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