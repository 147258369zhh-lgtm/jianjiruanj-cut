import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import './CrashRecoveryModal.css';

export const CrashRecoveryModal: React.FC = () => {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [show, setShow] = useState(false);
  const { setResources, setTimeline, setAudioItems, setPps, setStatusMsg } = useAppContext();

  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem('__editor_autosave_v2__');
      if (savedUrl) {
        const parsed = JSON.parse(savedUrl);
        // 如果上次保存的数据里确实有轨道数据，才提示恢复
        if ((parsed.timeline && parsed.timeline.length > 0) || (parsed.audioItems && parsed.audioItems.length > 0)) {
          setSnapshot(parsed);
          setShow(true);
        } else {
          localStorage.removeItem('__editor_autosave_v2__');
        }
      }
    } catch (e) {
      localStorage.removeItem('__editor_autosave_v2__');
    }
  }, []);

  if (!show || !snapshot) return null;

  const handleRestore = () => {
    if (snapshot.resources) setResources(snapshot.resources);
    if (snapshot.timeline) setTimeline(snapshot.timeline);
    if (snapshot.audioItems) setAudioItems(snapshot.audioItems);
    if (snapshot.pps) setPps(snapshot.pps);
    
    setStatusMsg('🚀 工程从防崩溃快照恢复成功');
    setTimeout(() => setStatusMsg(''), 3000);
    
    // 清除，防止下次再次弹窗
    localStorage.removeItem('__editor_autosave_v2__');
    setShow(false);
  };

  const handleDiscard = () => {
    localStorage.removeItem('__editor_autosave_v2__');
    setShow(false);
  };

  const formatDate = (ts: number) => {
    if (!ts) return '未知时间';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="crash-recovery-overlay">
      <div className="crash-recovery-box">
        <div className="crash-recovery-icon">🛡️</div>
        <div className="crash-recovery-title">检测到异常退出的未保存工程</div>
        <div className="crash-recovery-desc">
          系统在 <strong>{formatDate(snapshot.timestamp)}</strong> 为您自动保存了快照。<br />
          共包含 {snapshot.timeline?.length || 0} 个素材与 {snapshot.audioItems?.length || 0} 个音频轨。是否立即恢复？
        </div>
        
        <div className="crash-recovery-actions">
          <button className="crash-recovery-btn discard" onClick={handleDiscard}>
            丢弃进度 (开始新项目)
          </button>
          <button className="crash-recovery-btn restore" onClick={handleRestore}>
            恢复快照
          </button>
        </div>
      </div>
    </div>
  );
};
