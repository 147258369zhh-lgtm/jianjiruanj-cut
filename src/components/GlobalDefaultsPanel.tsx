import React from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import ProSlider from './ProSlider';
import IosSelect from './IosSelect';
import { GLOBAL_DEFAULTS_INIT } from '../types';
import { WORKFLOW_PRESETS } from '../features/preset-manager/presetTemplates';
import './GlobalDefaultsPanel.css';

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

      <div className="ios-prop-group preset-group">
        <div className="ios-text" style={{ color: '#A855F7', fontSize: 13, marginBottom: 12, display: 'block', fontWeight: 600 }}>✨ 专属预设 (一键工作流)</div>
        <div className="preset-cards-container custom-media-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, paddingBottom: 8, maxHeight: 240, overflowY: 'auto' }}>
          {WORKFLOW_PRESETS.map(preset => (
            <div 
              key={preset.id}
              className="preset-card ios-hover-scale"
              style={{ 
                background: 'rgba(255,255,255,0.04)', 
                border: `1px solid ${preset.color}30`,
                borderRadius: 14, 
                padding: '12px', 
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, rgba(255,255,255,0.08), ${preset.color}15)`;
                (e.currentTarget as HTMLElement).style.borderColor = `${preset.color}80`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = `${preset.color}30`;
              }}
              onClick={() => {
                commitSnapshotNow();
                const newDefaults = { ...globalDefaults, ...preset.settings };
                setGlobalDefaults(newDefaults);
                
                // 覆盖未手动修改的时间轴元素
                setTimeline((prev: any[]) => prev.map(t => {
                   const next: any = { ...t };
                   Object.keys(preset.settings).forEach(k => {
                      if (!next.overrides?.includes(k)) {
                         let val = (preset.settings as any)[k];
                         if (k === 'animation' && val === 'random') {
                            const pool = favAnims.length > 0 ? favAnims : ['anim-img-fadeIn', 'anim-img-slideLeft', 'anim-img-slideRight', 'anim-img-slideUp', 'anim-img-slideDown', 'anim-img-zoomIn', 'anim-img-zoomOut', 'anim-img-panLeft', 'anim-img-panRight'];
                            val = pool[Math.floor(Math.random() * pool.length)];
                            if (!next.overrides) next.overrides = [];
                            next.overrides.push('animation');
                         }
                         next[k] = val;
                      }
                   });
                   return next;
                }));
                setStatusMsg(`✨ 已应用预设: ${preset.name}`);
                setTimeout(() => setStatusMsg(''), 2500);
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8, filter: `drop-shadow(0 0 12px ${preset.color}60)` }}>{preset.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: preset.color, marginBottom: 6 }}>{preset.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, flex: 1 }}>{preset.description}</div>
            </div>
          ))}
        </div>
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
        <div className="ios-text" style={{ color: '#F59E0B', fontSize: 13, marginBottom: 8, display: 'block' }}>📐 几何变换默认值 (Keystone)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>默认水平透视 (X): {globalDefaults.keystoneX}°</span>
            <ProSlider min={-45} max={45} step={1} value={globalDefaults.keystoneX} onChange={v => {
              setGlobalDefaults(p => ({ ...p, keystoneX: v }));
              setTimeline(prev => prev.map(t => !(t.overrides?.includes('keystoneX')) ? { ...t, keystoneX: v } : t));
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>默认垂直透视 (Y): {globalDefaults.keystoneY}°</span>
            <ProSlider min={-45} max={45} step={1} value={globalDefaults.keystoneY} onChange={v => {
              setGlobalDefaults(p => ({ ...p, keystoneY: v }));
              setTimeline(prev => prev.map(t => !(t.overrides?.includes('keystoneY')) ? { ...t, keystoneY: v } : t));
            }} />
          </div>
        </div>
      </div>
      {/* Deleted Image Parameters */}
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
