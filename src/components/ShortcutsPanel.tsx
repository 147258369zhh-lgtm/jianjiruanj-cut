import React from 'react';
import './ShortcutsPanel.css';

export const ShortcutsPanel: React.FC<{ showShortcuts: boolean }> = ({ showShortcuts }) => {
  if (!showShortcuts) return null;

  return (
    <div className="shortcuts-panel" onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⌨️ 快捷键速查</div>
      {[
        ['Space', '播放/暂停'], ['Delete', '删除选中'], ['← →', '微调 ±0.1s'],
        ['Shift+←→', '微调 ±1s'], ['Ctrl+Z', '撤销'], ['Ctrl+Y', '重做'],
        ['Ctrl+A', '全选'], ['Ctrl+S', '保存工程'], ['Ctrl+O', '加载工程'],
        ['Ctrl+B', '分割片段'], ['Ctrl+滚轮', '时间轴缩放'], ['?', '显示/隐藏此面板'],
      ].map(([key, desc]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{key}</span>
          <span style={{ opacity: 0.7 }}>{desc}</span>
        </div>
      ))}
    </div>
  );
};
