import React from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import ProSlider from './ProSlider';
import IosSelect from './IosSelect';
import { GLOBAL_DEFAULTS_INIT, GlobalDefaults } from '../types';

interface GlobalDefaultsPanelProps {
  favAnims: string[];
  toggleFavAnim: (val: string) => void;
  commitSnapshotNow: () => void;
}

export const GlobalDefaultsPanel: React.FC<GlobalDefaultsPanelProps> = ({
  favAnims,
  toggleFavAnim,
  commitSnapshotNow
}) => {
  const {
    globalDefaults, setGlobalDefaults,
    setTimeline, setStatusMsg
  } = useStore(useShallow(state => ({
    globalDefaults: state.globalDefaults, setGlobalDefaults: state.setGlobalDefaults,
    setTimeline: state.setTimeline, setStatusMsg: state.setStatusMsg,
  })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
        修改全局默认值将自动应用到所有<strong style={{ color: 'rgba(255,255,255,0.65)' }}>未手动覆盖</strong>的图片。单独修改过的图片参数旁会显示 ✏️ 标记。
      </div>
      <div className="ios-prop-group">
        <div className="ios-text" style={{ color: '#10B981', fontSize: 13, marginBottom: 8, display: 'block' }}>⏱ 基础参数</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>默认时长: {globalDefaults.duration}s</span>
            <ProSlider min={0.5} max={10} step={0.1} value={globalDefaults.duration} onChange={d => {
              const v = Math.round(d * 10) / 10;
              setGlobalDefaults(p => ({ ...p, duration: v }));
              setTimeline(prev => prev.map(t => !(t.overrides?.includes('duration')) ? { ...t, duration: v } : t));
            }} />
          </div>
          <div className="ios-field" ><label className="ios-field-label">默认片段转场</label>
            <IosSelect
              value={globalDefaults.transition}
              onChange={v => {
                setGlobalDefaults(p => ({ ...p, transition: v }));
                setTimeline(prev => prev.map(t => !(t.overrides?.includes('transition')) ? { ...t, transition: v } : t));
              }}
              style={{ height: 36 }}
              options={[
                { value: 'none', label: '直接切入 (Cut)' },
                { value: 'fade', label: '经典叠化 (Dissolve)' },
                { value: 'white', label: '模糊闪白 (Dip to White)' },
                { value: 'iris', label: '中心扩散 (Iris)' },
                { value: 'slide', label: '平滑推入 (Push)' },
                { value: 'zoom', label: '专业缩放 (Zoom)' }
              ]}
            />
          </div>
          <div className="ios-field" ><label className="ios-field-label">默认照片动效 (入场)</label>
            <IosSelect
              value={globalDefaults.animation || 'none'}
              onChange={v => {
                setGlobalDefaults(p => ({ ...p, animation: v }));
                setTimeline(prev => prev.map(t => {
                  if (t.overrides?.includes('animation')) return t;
                  const animPool = favAnims.length > 0 ? favAnims : ['anim-img-fadeIn', 'anim-img-slideLeft', 'anim-img-slideRight', 'anim-img-slideUp', 'anim-img-slideDown', 'anim-img-zoomIn', 'anim-img-zoomOut', 'anim-img-panLeft', 'anim-img-panRight'];
                  const finalAnim = v === 'random' ? animPool[Math.floor(Math.random() * animPool.length)] : v;
                  return { ...t, animation: finalAnim, overrides: v === 'random' ? [...(t.overrides || []), 'animation'] : (t.overrides || []) };
                }));
              }}
              style={{ height: 36 }}
              options={[
                { value: 'none', label: '无动效 (None)' },
                { value: 'random', label: '🎲 照片随机分配 (Random)' },
                { value: 'anim-img-fadeIn', label: '平滑淡入 (Fade In)' },
                { value: 'anim-img-slideLeft', label: '从右滑入 (Slide Left)' },
                { value: 'anim-img-slideRight', label: '从左滑入 (Slide Right)' },
                { value: 'anim-img-slideUp', label: '向上浮现 (Slide Up)' },
                { value: 'anim-img-slideDown', label: '向下降落 (Slide Down)' },
                { value: 'anim-img-zoomIn', label: '缓慢放大 (Zoom In)' },
                { value: 'anim-img-zoomOut', label: '缓慢缩小 (Zoom Out)' },
                { value: 'anim-img-panLeft', label: '向左推移 (Pan Left)' },
                { value: 'anim-img-panRight', label: '向右推移 (Pan Right)' }
              ]}
              favSet={favAnims}
              onToggleFav={toggleFavAnim}
            />
          </div>
        </div>
      </div>
      <div className="ios-prop-group">
        <div className="ios-text" style={{ color: 'var(--ios-indigo)', fontSize: 13, marginBottom: 8, display: 'block' }}>🌓 影像参数默认值</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {([
            ['exposure', '曝光', 0.0, 3.0, 0.01],
            ['brilliance', '鲜明度', 0.0, 3.0, 0.01],
            ['highlights', '高光', 0.0, 3.0, 0.01],
            ['shadows', '阴影', 0.0, 3.0, 0.01],
            ['whites', '白色色阶', 0.0, 3.0, 0.01],
            ['blacks', '黑色色阶', 0.0, 3.0, 0.01],
            ['contrast', '对比度', 0.0, 3.0, 0.01],
            ['saturation', '饱和度', 0.0, 3.0, 0.01, 'linear-gradient(90deg, #9CA3AF, #EF4444)'],
            ['vibrance', '自然饱和度', 0.0, 3.0, 0.01, 'linear-gradient(90deg, #9CA3AF, #818CF8, #F472B6)'],
            ['temp', '色温', -100, 100, 1, 'linear-gradient(90deg, #60A5FA, #E5E7EB, #FBBF24)'],
            ['tint', '色调', -100, 100, 1, 'linear-gradient(90deg, #34D399, #E5E7EB, #C084FC)'],
            ['sharpness', '清晰度', -3.0, 3.0, 0.01],
            ['fade', '褪色', 0.0, 1.0, 0.01],
            ['vignette', '暗角', -1.0, 1.0, 0.01],
            ['grain', '颗粒', 0.0, 1.0, 0.01]
          ] as any).map(([key, label, min, max, step, gradient]: any) => {
            const isCentered = (key === 'temp' || key === 'tint' || key === 'sharpness' || key === 'vignette');
            const defaultVal = globalDefaults[key as keyof GlobalDefaults] as number;
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {isCentered ? defaultVal : defaultVal.toFixed(2)}
                  </span>
                </div>
                <div style={{ width: '100%', minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  <ProSlider gradient={gradient} isCentered={isCentered} style={{ width: '100%', maxWidth: '100%' }} min={min} max={max} step={step} value={defaultVal} onChange={d => {
                    setGlobalDefaults(p => ({ ...p, [key]: d }));
                    setTimeline(prev => prev.map(t => !(t.overrides?.includes(key)) ? { ...t, [key]: d } : t));
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <button className="ios-button ios-button-subtle" style={{ marginTop: 8, borderRadius: 10, height: 36, fontSize: 12, color: '#FF3B30', border: '1px solid rgba(255,59,48,0.2)' }} onClick={() => {
        commitSnapshotNow();
        setGlobalDefaults(GLOBAL_DEFAULTS_INIT);
        setTimeline(prev => prev.map(t => {
          const clean: any = { ...t };
          Object.keys(GLOBAL_DEFAULTS_INIT).forEach(k => {
            if (!(t.overrides?.includes(k))) clean[k] = (GLOBAL_DEFAULTS_INIT as any)[k];
          });
          return clean;
        }));
        setStatusMsg('🔄 已重置所有全局参数为默认值'); setTimeout(() => setStatusMsg(''), 1500);
      }}>
        🔄 重置全部为默认
      </button>
    </div>
  );
};
