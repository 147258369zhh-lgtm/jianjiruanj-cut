import React from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

interface ExportPanelProps {
  handleGenerate: () => void;
}

// 可复用的紧凑分段控制器 (替代原生 Select)
const SegmentedControl = ({ value, onChange, options, disabled = false }: { value: any, onChange: (v: any) => void, options: { label: string | React.ReactNode, value: any }[], disabled?: boolean }) => (
  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 2, gap: 2, opacity: disabled ? 0.3 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
    {options.map(opt => (
      <div 
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{
          flex: 1, textAlign: 'center', padding: '4px 2px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
          background: value === opt.value ? 'rgba(255,255,255,0.15)' : 'transparent',
          color: value === opt.value ? '#fff' : 'rgba(255,255,255,0.5)',
          transition: 'all 0.2s', fontWeight: value === opt.value ? 500 : 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
        }}
      >
        {opt.label}
      </div>
    ))}
  </div>
);

export const ExportPanel: React.FC<ExportPanelProps> = ({ handleGenerate }) => {
  const {
    exportFormat, setExportFormat,
    exportResolution, setExportResolution,
    exportFps, setExportFps,
    exportQuality, setExportQuality,
    exportCodec, setExportCodec,
    exportHdr, setExportHdr,
    exportEncodingPreset, setExportEncodingPreset,
    exportBitrateMode, setExportBitrateMode,
    exportTargetBitrate, setExportTargetBitrate,
    exportDeband, setExportDeband,
    exportForceCpu, setExportForceCpu,
    exportMasterAudio, setExportMasterAudio,
    isGenerating, setStatusMsg
  } = useStore(useShallow(state => ({
    exportFormat: state.exportFormat, setExportFormat: state.setExportFormat,
    exportResolution: state.exportResolution, setExportResolution: state.setExportResolution,
    exportFps: state.exportFps, setExportFps: state.setExportFps,
    exportQuality: state.exportQuality, setExportQuality: state.setExportQuality,
    exportCodec: state.exportCodec, setExportCodec: state.setExportCodec,
    exportHdr: state.exportHdr, setExportHdr: state.setExportHdr,
    exportEncodingPreset: state.exportEncodingPreset, setExportEncodingPreset: state.setExportEncodingPreset,
    exportBitrateMode: state.exportBitrateMode, setExportBitrateMode: state.setExportBitrateMode,
    exportTargetBitrate: state.exportTargetBitrate, setExportTargetBitrate: state.setExportTargetBitrate,
    exportDeband: state.exportDeband, setExportDeband: state.setExportDeband,
    exportForceCpu: state.exportForceCpu, setExportForceCpu: state.setExportForceCpu,
    exportMasterAudio: state.exportMasterAudio, setExportMasterAudio: state.setExportMasterAudio,
    isGenerating: state.isGenerating, setStatusMsg: state.setStatusMsg
  })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
      {/* 核心引擎设置 */}
      <div className="ios-prop-group" style={{ padding: '8px 10px' }}>
        <div style={{ color: 'var(--ios-indigo)', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>📦 容器与前置编码</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>封装格式</span>
            <div style={{ width: 220 }}>
              <SegmentedControl 
                value={exportFormat} onChange={setExportFormat} 
                options={[{label: 'MP4', value: 'mp4'}, {label: 'MOV', value: 'mov'}, {label: 'WebP', value: 'webp'}, {label: 'GIF', value: 'gif'}]} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>帧速率 (FPS)</span>
            <div style={{ width: 170 }}>
              <SegmentedControl 
                value={exportFps} onChange={setExportFps} 
                options={[{label: '30 电影感', value: '30'}, {label: '60 高刷', value: '60'}]} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>硬编解码器</span>
            <div style={{ width: 170 }}>
              <SegmentedControl 
                value={exportCodec} onChange={(v) => { setExportCodec(v); if(v === 'h264') setExportHdr(false); }} 
                options={[{label: 'H.264', value: 'h264'}, {label: 'H.265 (HEVC)', value: 'h265'}]} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: exportCodec === 'h265' ? 1 : 0.4 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{exportCodec === 'h265' ? '开启 10-bit HDR (BT.2020)' : 'HDR 激活 (请先选 H.265)'}</span>
            <input
              type="checkbox"
              checked={exportHdr}
              disabled={exportCodec !== 'h265'}
              onChange={e => setExportHdr(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--ios-indigo)', cursor: exportCodec === 'h265' ? 'pointer' : 'not-allowed', margin: 0 }}
            />
          </div>
        </div>
      </div>

      {/* 码率发电机区块 */}
      <div className="ios-prop-group" style={{ padding: '8px 10px' }}>
        <div style={{ color: '#F59E0B', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>🎛️ 码率发电机</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          
           <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
               <span>输出分辨率</span>
             </div>
            <SegmentedControl 
              value={exportResolution} onChange={setExportResolution} 
              options={[{label: '📐 原比例', value: 'original'}, {label: '🖥️ 4K', value: '4k'}, {label: '📱 1080P', value: '1080p'}]} 
            />
          </div>

          <div>
             <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
               <span>体积流场引擎</span>
               {exportBitrateMode === 'crf' ? <span style={{ color: '#F59E0B', fontSize: 11 }}>画质最优锁</span> : <span style={{ color: '#3B82F6', fontSize: 11 }}>防越界拦截</span>}
             </div>
             <SegmentedControl 
              value={exportBitrateMode} onChange={setExportBitrateMode} 
              options={[
                {label: '智能流 CRF', value: 'crf'}, 
                {label: '锁死极限 VBR', value: 'vbr'}
              ]} 
            />
          </div>

          {exportBitrateMode === 'crf' ? (
             <div style={{ padding: '10px 0 4px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>画质浮动档位</div>
              <SegmentedControl 
                value={exportQuality} onChange={setExportQuality} 
                options={[
                  {label: '无损', value: 'lossless'}, 
                  {label: '超清', value: 'high'}, 
                  {label: '压缩', value: 'medium'}
                ]} 
              />
            </div>
          ) : (
            <div style={{ padding: '10px 0 4px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>目标强制码率 (Mbps)</span>
                <span style={{ fontWeight: 600 }}>{exportTargetBitrate} Mbps</span>
              </div>
              <input 
                type="range" min="1" max="100" step="1" 
                value={exportTargetBitrate} onChange={e => setExportTargetBitrate(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3B82F6' }}
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>1M(极小)</span><span>一分钟约占 {((exportTargetBitrate || 1) * 60 / 8).toFixed(1)} MB</span><span>100M(顶配)</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 影院级特效挂载 */}
      <div className="ios-prop-group" style={{ padding: '8px 10px' }}>
        <div style={{ color: '#10B981', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>✨ 影院级包装</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          
           <div>
             <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
               <span>封装暗部演算</span>
               {exportEncodingPreset === 'quality' && <span style={{ color: '#A855F7', fontSize: 11 }}>启用算力换取平滑</span>}
             </div>
             <SegmentedControl 
              value={exportEncodingPreset} onChange={setExportEncodingPreset} 
              options={[
                {label: '极速预扫', value: 'speed'}, 
                {label: 'Slower 极限压制', value: 'quality'}
              ]} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
            <div style={{ flex: 1, paddingRight: 10 }}>
              <div style={{ fontSize: 12, color: '#FCD34D' }}>消除色彩阶梯断层 (Deband)</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>注入无感素描点抹平色带(耗时+30%)</div>
            </div>
            <input type="checkbox" checked={exportDeband} onChange={e => setExportDeband(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#FCD34D', margin: 0, flexShrink: 0 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
            <div style={{ flex: 1, paddingRight: 10 }}>
              <div style={{ fontSize: 12, color: '#34D399' }}>母带级无损音频</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>锁定 48000Hz 320kbps 顶配立体声封装引擎</div>
            </div>
            <input type="checkbox" checked={exportMasterAudio} onChange={e => setExportMasterAudio(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#34D399', margin: 0, flexShrink: 0 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
            <div style={{ flex: 1, paddingRight: 10 }}>
              <div style={{ fontSize: 12, color: '#EF4444' }}>强制关闭硬件加速 (禁 GPU)</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>纯以 x265 软编死磕极致画质</div>
            </div>
            <input type="checkbox" checked={exportForceCpu} onChange={e => setExportForceCpu(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#EF4444', margin: 0, flexShrink: 0 }} />
          </div>

        </div>
      </div>

      <button className="ios-button ios-button-primary ios-hover-scale"
        style={{
          marginTop: 4, height: 36, borderRadius: 8,
          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3), inset 0 1px 1px rgba(255,255,255,0.2)',
          fontWeight: 600, fontSize: 12, border: 'none',
          transition: 'all 0.3s ease', letterSpacing: 1
        }}
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? '正在渲染并处理封装...' : '🚀 开始执行极速渲染'}
      </button>

    </div>
  );
};
