import React from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import './ContextMenuWidget.css';

export const ContextMenuWidget: React.FC = () => {
  const {
    contextMenu,
    setContextMenu,
    commitSnapshotNow,
    splitAtPlayhead,
    timeline,
    setTimeline,
  } = useAppContext();
  const { setSelectedIds, setAudioItems, setSelectedAudioIds, setSelectedVoiceoverIds } = useStore(useShallow(state => ({
    setSelectedIds: state.setSelectedIds,
    setAudioItems: state.setAudioItems,
    setSelectedAudioIds: state.setSelectedAudioIds,
    setSelectedVoiceoverIds: state.setSelectedVoiceoverIds
  })));
  if (!contextMenu) return null;

  const targetItem = timeline.find((t: any) => t.id === contextMenu.targetId);

  return (
    <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
      {contextMenu.type === 'image' ? (
        <>
          <div className="context-menu-item" onClick={() => { commitSnapshotNow(); setTimeline((p: any) => [...p, ...p.filter((t: any) => t.id === contextMenu.targetId).map((t: any) => ({ ...t, id: `tm_${Date.now()}_cp` }))]); setContextMenu(null); }}>📋 复制片段</div>
          {targetItem && (
            <div className="context-menu-item" onClick={() => {
              commitSnapshotNow();
              setTimeline((p: any) => p.map((t: any) => t.id === contextMenu.targetId ? { ...t, collapsed: !t.collapsed } : t));
              setContextMenu(null);
            }}>{targetItem.collapsed ? '📂 展开片段' : '📁 折叠片段'}</div>
          )}
          <div className="context-menu-item" onClick={() => { setContextMenu(null); splitAtPlayhead(); }}>✂️ 在播放头分割 (Ctrl+B)</div>
          <div className="context-menu-separator" />
          <div className="context-menu-item danger" onClick={() => { commitSnapshotNow(); setTimeline((p: any) => p.filter((t: any) => t.id !== contextMenu.targetId)); setSelectedIds(new Set()); setContextMenu(null); }}>🗑 删除</div>
        </>
      ) : (
        <>
          <div className="context-menu-item" onClick={() => { setContextMenu(null); splitAtPlayhead(); }}>✂️ 在播放头分割</div>
          <div className="context-menu-separator" />
          <div className="context-menu-item danger" onClick={() => { commitSnapshotNow(); setAudioItems((p: any) => p.filter((a: any) => a.id !== contextMenu.targetId)); setSelectedAudioIds(new Set()); setSelectedVoiceoverIds(new Set()); setContextMenu(null); }}>🗑 删除</div>
        </>
      )}
    </div>
  );
};
