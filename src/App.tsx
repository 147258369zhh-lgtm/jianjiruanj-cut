
// import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
// Core Layout
import './styles/Base.css';
import './styles/Animations.css';
import './styles/Inputs.css';
import './styles/FluentOverrides.css';
import "./Win11Theme.css";
import "./HarmonyTheme.css";


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
import { CrashRecoveryModal } from './features/project-manager/CrashRecoveryModal';
import { IngestCurationModal } from './features/project-manager/IngestCurationModal';
import { ExportProgressOverlay } from './features/export-module/ExportProgressOverlay';
import { DropOverlay } from './components/DropOverlay';
import { ContextMenuWidget } from './components/ContextMenuWidget';
import { ActivationGateway } from './components/ActivationGateway';

import { MonitorPanel } from './components/MonitorPanel';
import { ProjectToolbar } from './components/ProjectToolbar';
import { RightPanel } from './components/RightPanel';
// import { ResourceCardItem } from './components/ResourceCardItem';

// ─── 主应用 ──────────────────────────────────────────────────────
import { useAppController } from './hooks/useAppController';
import { AppContext } from './hooks/useAppContext';
import { useStore } from './store';
import { useAuthStore } from './store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import React, { useEffect } from 'react';

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

  useEffect(() => {
    // 启动严格授权与试用时长校验
    useAuthStore.getState().initAuth();
    
    // 每秒滴答更新试用剩余时间
    const timer = setInterval(() => {
      useAuthStore.getState().clockTick();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 🖥️ 全局同比例缩放适配 (防遮挡)
    const handleResize = () => {
      // 设定最佳设计体验的基准分辨率（当窗口小于此时，界面将整体等比缩小）
      const BASE_WIDTH = 1366; 
      const BASE_HEIGHT = 768; 
      
      const scaleW = window.innerWidth / BASE_WIDTH;
      const scaleH = window.innerHeight / BASE_HEIGHT;
      
      // 取最小比例，且上限为 1.0 (大屏保持原大小不粗糙化)
      const scale = Math.min(1.0, scaleW, scaleH);
      
      // 取消使用原生 zoom 避免因为 vw/vh 引起的计算挤压问题
      document.body.style.removeProperty('zoom');
      // 改用 CSS var 透传给 app-root-container 进行 transform: scale
      document.documentElement.style.setProperty('--app-scale', scale.toString());
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // 挂载时立即执行一次以匹配初始状态

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AppContext.Provider value={controller as any}>
    <div className="app-root-container">
      <div className={`ios-layout ${theme === 'win11' ? 'theme-win11' : theme === 'harmony' ? 'theme-harmony' : ''}`} onClick={() => { setContextMenu(null); setShowShortcuts(false); setShowSortMenu(false); setShowMoreMenu(false); }}>


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
      <CrashRecoveryModal />
      <IngestCurationModal />
      <ExportProgressOverlay />
      <ActivationGateway />
    </div>
    </AppContext.Provider>
  );
}

export default App;

