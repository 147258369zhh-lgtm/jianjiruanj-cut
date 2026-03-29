
// import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import 'react-image-crop/dist/ReactCrop.css';
// Core Layout
import './styles/Base.css';
import './styles/Animations.css';
import './styles/Inputs.css';
import './styles/FluentOverrides.css';
import "./Win11Theme.css";


// import { computeFilter as computeFilterMod, computeTextStyles as computeTextStylesMod } from './features/filter-engine/useFilter';
// import { formatTime as formatTimeMod } from './utils/formatTime';



// ProSlider 已迁移到 components/ProSlider.tsx
// import { getMediaDuration } from './utils/mediaUtils';

// 莫兰迪绚烂色谱常量已迁移至 utils/constants

// AudioWaveform 已迁移到 components/AudioWaveform.tsx

// IosSelect 已迁移到 components/IosSelect.tsx




// 缩略图引擎已迁移到 utils/thumbnail.ts
// SortableImageCard 已迁移到 components/SortableImageCard.tsx

// AudioTrackItem 已迁移到 components/AudioTrackItem.tsx

import { LeftPanel } from './components/LeftPanel';

import { TimelinePanel } from './components/TimelinePanel';
import { ShortcutsPanel } from './components/ShortcutsPanel';
import { DropOverlay } from './components/DropOverlay';
import { ContextMenuWidget } from './components/ContextMenuWidget';

import { MonitorPanel } from './components/MonitorPanel';
import { ProjectToolbar } from './components/ProjectToolbar';
import { RightPanel } from './components/RightPanel';
// import { ResourceCardItem } from './components/ResourceCardItem';

// ─── 主应用 ──────────────────────────────────────────────────────
import { useAppController } from './hooks/useAppController';
import { AppContext } from './hooks/useAppContext';
import { useStore } from './store';
import { useShallow } from 'zustand/react/shallow';

function App() {
  const controller = useAppController();
  const { isDragOver, setContextMenu } = controller as any;
  const { statusMsg, showShortcuts, setShowShortcuts, setShowSortMenu, setShowMoreMenu, theme } = useStore(useShallow(state => ({
    statusMsg: state.statusMsg,
    showShortcuts: state.showShortcuts, setShowShortcuts: state.setShowShortcuts,
    setShowSortMenu: state.setShowSortMenu,
    showMoreMenu: state.showMoreMenu, setShowMoreMenu: state.setShowMoreMenu,
    theme: state.theme
  })));
  return (
    <AppContext.Provider value={controller as any}>
    <div className="app-root-container">
      <div className={`ios-layout ${theme === 'win11' ? 'theme-win11' : ''}`} onClick={() => { setContextMenu(null); setShowShortcuts(false); setShowSortMenu(false); setShowMoreMenu(false); }}>


        {/* 全局浮窗 Toast 通知 */}
        {statusMsg && (
          <div className="global-toast">
            {statusMsg}
          </div>
        )}

        {/* 快捷键提示面板 */}

        <ShortcutsPanel showShortcuts={showShortcuts} />
        <DropOverlay isDragOver={isDragOver} />
        <ContextMenuWidget />



        {/* ═══ 顶部项目操作栏 (任务1: 项目级主流程) ═══ */}
        <ProjectToolbar />

        {/* ═══ 主内容区 ═══ */}
        <div style={{ flex: 1, display: 'flex', gap: 8, minHeight: 0 }}>

          {/* 1. 左侧资源区 (任务2: 照片/音乐/文字 三标签) */}
          <LeftPanel />


          {/* 2. 监视器 */}
          <MonitorPanel />

          {/* 3. 右侧属性面板（上下文驱动 + 编辑/导出模式切换） */}
          <RightPanel />
        </div>

        {/* BOTTOM ZONE */}
        <TimelinePanel />

      </div>
    </div>
    </AppContext.Provider>
  );
}

export default App;

