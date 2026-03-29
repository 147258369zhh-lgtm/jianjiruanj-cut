import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { IngestItem } from '../../hooks/useDragImport';
import { TimelineItem } from '../../types';
import './IngestCurationModal.css';

export const IngestCurationModal: React.FC = () => {
  const { 
    ingestQueue, 
    setIngestQueue, 
    setResources, 
    setTimeline, 
    globalDefaults, 
    commitSnapshotNow, 
    setStatusMsg 
  } = useAppContext();

  if (!ingestQueue || ingestQueue.length === 0) return null;

  const approvedItems = ingestQueue.filter((i: IngestItem) => i.status === 'approved');
  const rejectedItems = ingestQueue.filter((i: IngestItem) => i.status === 'rejected');

  const handleToggleStatus = (id: string, currentStatus: 'approved' | 'rejected') => {
    setIngestQueue((prev: IngestItem[]) => prev.map(i => 
      i.id === id 
        ? { 
            ...i, 
            status: currentStatus === 'approved' ? 'rejected' : 'approved', 
            reason: currentStatus === 'approved' ? '您手动隔离了此文件' : undefined 
          } 
        : i
    ));
  };

  const handleConfirm = () => {
    commitSnapshotNow();

    const newResources = approvedItems.map((i: IngestItem) => ({ 
      id: i.id, 
      name: i.name, 
      path: i.path, 
      type: i.type 
    }));
    
    const newTimelineItems: TimelineItem[] = [];
    newResources.forEach((res) => {
      if (res.type === 'image') {
        newTimelineItems.push({
          ...globalDefaults,
          id: `tm_${Date.now()}_${res.id}`,
          resourceId: res.id,
          overrides: []
        } as unknown as TimelineItem);
      }
    });

    setResources((prev: any) => [...prev, ...newResources]);
    if (newTimelineItems.length > 0) {
      setTimeline((prev: any) => [...prev, ...newTimelineItems]);
    }
    
    setStatusMsg(`入库完成: 成功接入 ${newResources.length} 个素材，拦截 ${rejectedItems.length} 个废片。`);
    setTimeout(() => setStatusMsg(''), 3500);
    setIngestQueue([]);
  };

  const handleCancel = () => {
    setIngestQueue([]);
  };

  const convertFileSrc = (path: string) => {
    // 简易 mock convertFileSrc，实际由于安全协议需要 tauri API，这里使用通用 asset://
    if (path.startsWith('/')) return path;
    if (path.startsWith('http')) return path;
    return `asset://${path.replace(/\\/g, '/')}`;
  };

  return (
    <div className="ingest-modal-overlay">
      <div className="ingest-modal-box">
        <div className="ingest-header">
          <div className="ingest-title-area">
            <div className="ingest-title">安全防线：智能素材预筛查</div>
            <div className="ingest-desc">
              发现拖拽了 {ingestQueue.length} 个文件。系统已依靠算法自动为您拦截了 <strong className="reject-count">{rejectedItems.length}</strong> 个疑似低质量内容。
            </div>
          </div>
          <div className="ingest-actions">
            <button className="ingest-btn cancel" onClick={handleCancel}>放弃本次导入</button>
            <button className="ingest-btn confirm" onClick={handleConfirm}>
              导入剩余的 {approvedItems.length} 个并上轴
            </button>
          </div>
        </div>

        <div className="ingest-body">
          {/* 左侧：保留区 */}
          <div className="ingest-col left">
            <div className="ingest-col-header approved">
              ✅ 验证通过的可用素材 ({approvedItems.length})
            </div>
            <div className="ingest-grid-scroll">
              <div className="ingest-grid">
                {approvedItems.map((item: IngestItem) => (
                  <div 
                    key={item.id} 
                    className="ingest-item-card approved"
                    onClick={() => handleToggleStatus(item.id, 'approved')}
                  >
                    <img src={convertFileSrc(item.path)} alt={item.name} />
                    <div className="ingest-action-hint">点击送入垃圾小黑屋</div>
                  </div>
                ))}
                {approvedItems.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center', marginTop: 40 }}>
                    没有任何通过校验的素材
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：拦截区 */}
          <div className="ingest-col right">
            <div className="ingest-col-header rejected">
              🛑 已被自动隔离的废片 ({rejectedItems.length})
            </div>
            <div className="ingest-grid-scroll">
              <div className="ingest-grid">
                {rejectedItems.map((item: IngestItem) => (
                  <div 
                    key={item.id} 
                    className="ingest-item-card rejected"
                    onClick={() => handleToggleStatus(item.id, 'rejected')}
                  >
                    <img src={convertFileSrc(item.path)} alt={item.name} />
                    <div className="ingest-reason-badge" title={item.reason}>
                      {item.reason}
                    </div>
                    <div className="ingest-action-hint">点击误判恢复</div>
                  </div>
                ))}
                {rejectedItems.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center', marginTop: 40 }}>
                    完美！没有发现任何废片或截图。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
