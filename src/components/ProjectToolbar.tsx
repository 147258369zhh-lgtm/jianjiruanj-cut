import { useAppContext } from '../hooks/useAppContext';
import React from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';


export const ProjectToolbar: React.FC = () => {
  const {
    handleImport,
    timeline,
    setTimeline,
    resources,
    commitSnapshotNow,
    undo,
    redo,
    historyLength,
    redoLength,
    saveProject,
    loadProject,
  } = useAppContext();
  const {
    leftTab,
    setStatusMsg,
    showSortMenu, setShowSortMenu,
    showMoreMenu, setShowMoreMenu,
    isEditingProjectName, setIsEditingProjectName,
    theme, setTheme,
    showExportPanel, setShowExportPanel,
    setShowGlobalDefaults
  } = useStore(useShallow(state => ({
    leftTab: state.leftTab,
    statusMsg: state.statusMsg, setStatusMsg: state.setStatusMsg,
    showSortMenu: state.showSortMenu, setShowSortMenu: state.setShowSortMenu,
    showMoreMenu: state.showMoreMenu, setShowMoreMenu: state.setShowMoreMenu,
    isEditingProjectName: state.isEditingProjectName, setIsEditingProjectName: state.setIsEditingProjectName,
    theme: state.theme, setTheme: state.setTheme,
    showExportPanel: state.showExportPanel, setShowExportPanel: state.setShowExportPanel,
    setShowGlobalDefaults: state.setShowGlobalDefaults
  })));

  const {
    projectName, setProjectName,
    sortMode, setSortMode,
    sortDirection, setSortDirection
  } = useStore(useShallow(state => ({
    projectName: state.projectName, setProjectName: state.setProjectName,
    sortMode: state.sortMode, setSortMode: state.setSortMode,
    sortDirection: state.sortDirection, setSortDirection: state.setSortDirection
  })));

  return (
    <div className="project-toolbar" style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
      background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--ios-hairline)',
      flexShrink: 0, minHeight: 40,
    }}>

      {/* 左侧：主流程按钮组 */}
      <button className="ios-button-small ios-button ios-button-primary" style={{ borderRadius: 6, background: 'var(--ios-indigo)', fontWeight: 600, fontSize: 12, padding: '0 14px', height: 30, border: 'none' }} onClick={() => handleImport(leftTab === 'music' ? 'audio' : leftTab === 'video' ? 'video' : 'image')}>
        📥 导入
      </button>

      {/* 排序下拉菜单 */}
      <div style={{ position: 'relative' }}>
        <button className="ios-button-small ios-button ios-button-subtle" style={{ borderRadius: 6, fontSize: 12, padding: '0 10px', height: 30, color: 'rgba(255,255,255,0.7)' }} onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}>
          {sortMode === 'manual' ? '📂 排序' : `📂 ${sortMode === 'time' ? '时间序' : '名称序'}${sortDirection === 'desc' ? '↓' : '↑'}`}
        </button>
        {showSortMenu && (
          <div className="sort-dropdown" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'rgba(30,30,46,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6, zIndex: 999, minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            {[
              { mode: 'manual' as const, label: '✋ 手动排序', dir: 'asc' as const },
              { mode: 'name' as const, label: '🔤 按名称 A→Z', dir: 'asc' as const },
              { mode: 'name' as const, label: '🔤 按名称 Z→A', dir: 'desc' as const },
              { mode: 'time' as const, label: '🕐 按文件名数字 ↑', dir: 'asc' as const },
              { mode: 'time' as const, label: '🕐 按文件名数字 ↓', dir: 'desc' as const },
            ].map((opt, idx) => (
              <div key={idx} style={{ padding: '6px 12px', fontSize: 12, color: (sortMode === opt.mode && sortDirection === opt.dir) ? '#fff' : 'rgba(255,255,255,0.65)', background: (sortMode === opt.mode && sortDirection === opt.dir) ? 'rgba(94,92,230,0.3)' : 'transparent', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = (sortMode === opt.mode && sortDirection === opt.dir) ? 'rgba(94,92,230,0.3)' : 'transparent'; }}
                onClick={() => {
                  if (opt.mode === 'manual') {
                    setSortMode('manual');
                    setStatusMsg('✋ 已切换为手动排序'); setTimeout(() => setStatusMsg(''), 1500);
                  } else {
                    if (sortMode === 'manual' && timeline.length > 0) {
                      setStatusMsg('⚠️ 排序将覆盖当前手动顺序（可 Ctrl+Z 撤销）');
                      setTimeout(() => setStatusMsg(''), 2500);
                    }
                    commitSnapshotNow();
                    setSortMode(opt.mode);
                    setSortDirection(opt.dir);
                    const sorted = [...timeline].sort((a, b) => {
                      const ra = resources.find(r => r.id === a.resourceId);
                      const rb = resources.find(r => r.id === b.resourceId);
                      const nameA = ra?.name || '';
                      const nameB = rb?.name || '';
                      if (opt.mode === 'name') {
                        return opt.dir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
                      } else {
                        const numA = parseInt((nameA.match(/\d+/) || ['0'])[0], 10);
                        const numB = parseInt((nameB.match(/\d+/) || ['0'])[0], 10);
                        return opt.dir === 'asc' ? numA - numB : numB - numA;
                      }
                    });
                    setTimeline(sorted);
                    setStatusMsg(`📂 已按${opt.mode === 'name' ? '名称' : '数字'}${opt.dir === 'asc' ? '升序' : '降序'}排列`);
                    setTimeout(() => setStatusMsg(''), 1500);
                  }
                  setShowSortMenu(false);
                }}>
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 撤销重做按钮组 */}
      <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
        <button
          className="ios-btn ios-hover-scale"
          onClick={undo}
          disabled={historyLength === 0}
          style={{ width: 30, height: 30, padding: 0, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: historyLength === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', border: 'none', color: historyLength === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)', cursor: historyLength === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
          title="撤销上一步 (Ctrl+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
        </button>
        <button
          className="ios-btn ios-hover-scale"
          onClick={redo}
          disabled={redoLength === 0}
          style={{ width: 30, height: 30, padding: 0, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: redoLength === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', border: 'none', color: redoLength === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)', cursor: redoLength === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
          title="重做 (Ctrl+Shift+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 3.7" /></svg>
        </button>
      </div>

      {/* 中间：项目名称居中 */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {isEditingProjectName ? (
          <input
            autoFocus
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onBlur={() => setIsEditingProjectName(false)}
            onKeyDown={e => { if (e.key === 'Enter') setIsEditingProjectName(false); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--ios-indigo)', borderRadius: 4, color: '#fff', fontSize: 13, fontWeight: 600, padding: '2px 8px', width: 160, outline: 'none', textAlign: 'center' }}
          />
        ) : (
          <span
            onClick={() => setIsEditingProjectName(true)}
            style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: '2px 8px', borderRadius: 4, transition: 'background 0.15s' }}
            title="点击编辑项目名称"
          >{projectName}</span>
        )}
      </div>

      {/* 右侧：··· 更多菜单 + 🚀导出 */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 1, padding: '0 10px', height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
          title="更多选项"
        >···</button>
        {showMoreMenu && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'rgba(28,28,42,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6, zIndex: 1000, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {[
              { icon: '💾', label: '保存工程  Ctrl+S', action: () => { saveProject(); setShowMoreMenu(false); } },
              { icon: '📂', label: '加载工程  Ctrl+O', action: () => { loadProject(); setShowMoreMenu(false); } },
            ].map(item => (
              <div key={item.label}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                onClick={item.action}
              ><span>{item.icon}</span><span>{item.label}</span></div>
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 6px' }} />
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              onClick={() => { const next = theme === 'ios' ? 'win11' : 'ios'; setTheme(next); localStorage.setItem('__editor_theme__', next); setShowMoreMenu(false); }}
            >
              <span>{theme === 'ios' ? '🍃' : '🪩'}</span>
              <span>切换主题（{theme === 'ios' ? 'iOS' : 'Win11'}）</span>
            </div>
            {timeline.length > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 6px' }} />
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  onClick={() => { setShowGlobalDefaults(true); setShowExportPanel(false); setShowMoreMenu(false); }}
                >
                  <span>⚙️</span><span>全局默认设置</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <button className="ios-button-small ios-button ios-button-primary" style={{ borderRadius: 6, background: '#10B981', fontWeight: 600, fontSize: 12, padding: '0 16px', height: 30, border: 'none' }} onClick={() => { setShowExportPanel(!showExportPanel); setShowGlobalDefaults(false); }}>
        🚀 导出
      </button>

    </div>
  );
};
