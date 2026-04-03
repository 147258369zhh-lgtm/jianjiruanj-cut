import React, { useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import './ProjectDashboard.css';

export const ProjectDashboard: React.FC = () => {
  const {
    timeline, audioItems, voiceoverClips,
    resources, historyLength, redoLength,
    setTimeline, setStatusMsg, commitSnapshotNow,
    setShowGlobalDefaults, setShowExportPanel
  } = useAppContext();

  const imageCount = useMemo(() => timeline.length, [timeline]);
  const audioCount = useMemo(() => audioItems.length, [audioItems]);
  const voiceoverCount = useMemo(() => voiceoverClips.length, [voiceoverClips]);
  const totalDuration = useMemo(() => timeline.reduce((acc, t) => acc + t.duration, 0), [timeline]);
  const resourceCount = useMemo(() => resources.filter(r => r.type === 'image' || r.type === 'video').length, [resources]);
  const transitionCount = useMemo(() => timeline.filter(t => t.transition && t.transition !== 'none').length, [timeline]);
  const avgClipLength = useMemo(() => imageCount > 0 ? (totalDuration / imageCount).toFixed(1) : 0, [imageCount, totalDuration]);

  const formatDuration = (s: number) => {
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleShuffle = () => {
    commitSnapshotNow();
    const shuffled = [...timeline].sort(() => Math.random() - 0.5);
    setTimeline(shuffled);
    setStatusMsg('🔀 已随机打乱轨道顺序');
    setTimeout(() => setStatusMsg(''), 2000);
  };

  const handleReverse = () => {
    commitSnapshotNow();
    setTimeline([...timeline].reverse());
    setStatusMsg('🔄 已反转轨道顺序');
    setTimeout(() => setStatusMsg(''), 2000);
  };

  const handleClearTimeline = () => {
    if (timeline.length === 0) return;
    commitSnapshotNow();
    setTimeline([]);
    setStatusMsg('🗑️ 轨道已清空 (可 Ctrl+Z 撤销)');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  return (
    <div className="project-dashboard">
      {/* 统计卡片 */}
      <div className="dash-section">
        <div className="dash-section-title">项目数据一览</div>
        <div className="dash-stats-grid">
          <div className="dash-stat-card">
            <span className="dash-stat-icon">📷</span>
            <span className="dash-stat-value">{imageCount}</span>
            <span className="dash-stat-label">轨道片段</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon">⏱️</span>
            <span className="dash-stat-value">{formatDuration(totalDuration)}</span>
            <span className="dash-stat-label">总时长</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon">🎵</span>
            <span className="dash-stat-value">{audioCount + voiceoverCount}</span>
            <span className="dash-stat-label">音频轨道</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon">🗂️</span>
            <span className="dash-stat-value">{resourceCount}</span>
            <span className="dash-stat-label">导入素材库</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon">✨</span>
            <span className="dash-stat-value">{transitionCount}</span>
            <span className="dash-stat-label">特效转场</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-icon">✂️</span>
            <span className="dash-stat-value">{avgClipLength}s</span>
            <span className="dash-stat-label">平均片段长</span>
          </div>
        </div>
      </div>

      {/* 项目状态 */}
      <div className="dash-section">
        <div className="dash-section-title">安全与历史</div>
        <div className="dash-status-row">
          <span className="dash-status-key">撤销步数</span>
          <span className="dash-status-val">{historyLength} 步可撤</span>
        </div>
        <div className="dash-status-row">
          <span className="dash-status-key">重做步数</span>
          <span className="dash-status-val">{redoLength} 步可重做</span>
        </div>
        <div className="dash-status-row">
          <span className="dash-status-key">崩溃保护</span>
          <span className="dash-status-val green">✅ 已启用</span>
        </div>
      </div>

      {/* 快捷操作 */}
      {timeline.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-title">快捷操作</div>
          <div className="dash-actions-row">
            <button className="dash-action-btn" onClick={handleShuffle}>
              <span className="action-icon">🔀</span>
              随机打乱轨道顺序
            </button>
            <button className="dash-action-btn" onClick={handleReverse}>
              <span className="action-icon">🔄</span>
              反转轨道播放顺序
            </button>
            <button className="dash-action-btn" onClick={handleClearTimeline}>
              <span className="action-icon">🗑️</span>
              清空轨道 (可撤销)
            </button>
            <button className="dash-action-btn" onClick={() => { setShowGlobalDefaults(true); setShowExportPanel(false); }}>
              <span className="action-icon">⚙️</span>
              配置全局默认参数
            </button>
          </div>
        </div>
      )}

      {/* 空状态快速开始 */}
      {timeline.length === 0 && (
        <div className="dash-section">
          <div className="dash-section-title">快速开始</div>
          <div className="dash-actions-row">
            <button className="dash-action-btn" onClick={() => { setShowGlobalDefaults(true); setShowExportPanel(false); }}>
              <span className="action-icon">⚙️</span>
              配置全局默认参数
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.8, marginTop: 12 }}>
            💡 将照片拖入窗口 或 点击左侧「📸 导入照片」来开始创建您的作品。
          </div>
        </div>
      )}
    </div>
  );
};
