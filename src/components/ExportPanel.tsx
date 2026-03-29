import React from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

interface ExportPanelProps {
  handleGenerate: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ handleGenerate }) => {
  const {
    exportFormat, setExportFormat,
    exportResolution, setExportResolution,
    exportFps, setExportFps,
    exportQuality, setExportQuality,
    exportCodec, setExportCodec,
    exportHdr, setExportHdr,
    isGenerating, setStatusMsg
  } = useStore(useShallow(state => ({
    exportFormat: state.exportFormat, setExportFormat: state.setExportFormat,
    exportResolution: state.exportResolution, setExportResolution: state.setExportResolution,
    exportFps: state.exportFps, setExportFps: state.setExportFps,
    exportQuality: state.exportQuality, setExportQuality: state.setExportQuality,
    exportCodec: state.exportCodec, setExportCodec: state.setExportCodec,
    exportHdr: state.exportHdr, setExportHdr: state.setExportHdr,
    isGenerating: state.isGenerating, setStatusMsg: state.setStatusMsg
  })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* 一键导出预设 */}
      <div className="ios-prop-group">
        <div className="ios-text" style={{ color: '#10B981', fontSize: 13, marginBottom: 8, display: 'block' }}>⚡ 快捷导出预设</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { name: '📱 抖音/快手', fmt: 'mp4', res: '1080p', fps: '60', codec: 'h264', quality: 'high' as const },
            { name: '🅱️ B站高清', fmt: 'mp4', res: '1080p', fps: '60', codec: 'h264', quality: 'high' as const },
            { name: '🎬 Apple ProRes', fmt: 'mov', res: 'original', fps: '60', codec: 'h265', quality: 'lossless' as const },
            { name: '📺 4K HDR', fmt: 'mp4', res: '4k', fps: '60', codec: 'h265', quality: 'lossless' as const },
          ].map(preset => (
            <div
              key={preset.name}
              className="filter-preset-card"
              onClick={() => {
                setExportFormat(preset.fmt as any);
                setExportResolution(preset.res as any);
                setExportFps(preset.fps as any);
                setExportCodec(preset.codec as any);
                setExportQuality(preset.quality);
                if (preset.codec === 'h265' && preset.name.includes('HDR')) setExportHdr(true);
                setStatusMsg(`✅ 已应用「${preset.name}」预设`); setTimeout(() => setStatusMsg(''), 1500);
              }}
            >{preset.name}</div>
          ))}
        </div>
      </div>

      <div className="ios-prop-group" style={{ marginTop: 0 }}>
        <div className="ios-text" style={{ color: 'var(--ios-indigo)', fontSize: 13, marginBottom: 12, display: 'block' }}>🎬 输出格式与帧率</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="ios-field" >
            <select className="ios-dark-select" value={exportFormat} onChange={e => setExportFormat(e.target.value as any)}>
              <option value="mp4">MP4 (通用媒体容器)</option>
              <option value="mov">MOV (Apple 专业容器)</option>
            </select>
          </div>
          <div className="ios-field" ><label className="ios-field-label">编码标准 (Codec)</label>
            <select className="ios-dark-select" value={exportCodec} onChange={e => setExportCodec(e.target.value as any)}>
              <option value="h264">H.264 / AVC (最强兼容性)</option>
              <option value="h265">H.265 / HEVC (极致压缩 & 4K 推荐)</option>
            </select>
          </div>
          <div className="ios-field" ><label className="ios-field-label">HDR 10-bit & 杜比色彩空间 (只支持 H.265)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={exportHdr}
                disabled={exportCodec !== 'h265'}
                onChange={e => setExportHdr(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--ios-indigo)', cursor: exportCodec === 'h265' ? 'pointer' : 'not-allowed' }}
              />
              <div className="ios-text" style={{ fontSize: 13, opacity: exportCodec === 'h265' ? 0.8 : 0.3 }}>
                开启高动态范围 (BT.2020 PQ) {exportCodec !== 'h265' && "(请先切换编码为 H.265)"}
              </div>
            </div>
          </div>
          <div className="ios-field" ><label className="ios-field-label">帧速率 (FPS)</label>
            <select className="ios-dark-select" value={exportFps} onChange={e => setExportFps(e.target.value as any)}>
              <option value="30">30 FPS (标准电影感)</option>
              <option value="60">60 FPS (丝滑高刷无拖影)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="ios-prop-group">
        <div className="ios-text" style={{ color: '#F59E0B', fontSize: 13, marginBottom: 12, display: 'block' }}>👁️‍🗨️ 画质极限控制</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="ios-field" ><label className="ios-field-label">输出分辨率</label>
            <select className="ios-dark-select" value={exportResolution} onChange={e => setExportResolution(e.target.value as any)}>
              <option value="original">🔰 原尺寸装配 (100% 不缩放超清)</option>
              <option value="4k">4K 标准 (3840x2160)</option>
              <option value="1080p">1080P 全高清 (1920x1080)</option>
            </select>
          </div>
          <div className="ios-field" ><label className="ios-field-label">渲染画质 (CRF Engine)</label>
            <select className="ios-dark-select" value={exportQuality} onChange={e => setExportQuality(e.target.value as any)}>
              <option value="lossless">💎 无损直出 (-crf 10, 体积大极清晰)</option>
              <option value="high">✨ 专业高画质 (-crf 15, 清晰度优先)</option>
              <option value="medium">📱 互联网传播 (-crf 23, 体积最优)</option>
            </select>
          </div>
        </div>
      </div>

      <button className="ios-button ios-button-primary ios-hover-scale"
        style={{
          marginTop: 16, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
          boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3), inset 0 1px 1px rgba(255,255,255,0.2)',
          fontWeight: 600, fontSize: 13, border: 'none',
          transition: 'all 0.3s ease'
        }}
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? '正在拼尽全力导出...' : '开始执行极速渲染'}
      </button>

    </div>
  );
};
