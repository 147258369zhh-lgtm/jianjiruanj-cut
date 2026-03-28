const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. 替换重复的 store 引用和增加 useShallow
content = content.replace(
  /import \{ useStore \} from "\.\/store";\r?\nimport \{ useStore \} from "\.\/store";/,
  `import { useStore } from "./store";\nimport { useShallow } from 'zustand/react/shallow';`
);

// 2. 替换 lines 91-96 (monitorRes 到 libTab)
const replacement1 = `  const {
    activeTab, setActiveTab,
    propertyTab, setPropertyTab,
    libTab, setLibTab,
    leftTab, setLeftTab,
    statusMsg, setStatusMsg,
    showShortcuts, setShowShortcuts,
    showSortMenu, setShowSortMenu,
    showExportPanel, setShowExportPanel,
    showGlobalDefaults, setShowGlobalDefaults,
    showMoreMenu, setShowMoreMenu,
    isEditingProjectName, setIsEditingProjectName,
    isDragOver, setIsDragOver,
    isGenerating, setIsGenerating,
    contextMenu, setContextMenu,
    selectionBox, setSelectionBox,
    crop, setCrop,
    isCropping, setIsCropping,
    isEditingAudio, setIsEditingAudio,
    isDraggingHead, setIsDraggingHead,
    isJumping, setIsJumping,
    localDuration, setLocalDuration,
    theme, setTheme,
    exportFormat, setExportFormat,
    exportResolution, setExportResolution,
    exportFps, setExportFps,
    exportQuality, setExportQuality,
    exportCodec, setExportCodec,
    exportHdr, setExportHdr
  } = useStore(useShallow(state => ({
    activeTab: state.activeTab, setActiveTab: state.setActiveTab,
    propertyTab: state.propertyTab, setPropertyTab: state.setPropertyTab,
    libTab: state.libTab, setLibTab: state.setLibTab,
    leftTab: state.leftTab, setLeftTab: state.setLeftTab,
    statusMsg: state.statusMsg, setStatusMsg: state.setStatusMsg,
    showShortcuts: state.showShortcuts, setShowShortcuts: state.setShowShortcuts,
    showSortMenu: state.showSortMenu, setShowSortMenu: state.setShowSortMenu,
    showExportPanel: state.showExportPanel, setShowExportPanel: state.setShowExportPanel,
    showGlobalDefaults: state.showGlobalDefaults, setShowGlobalDefaults: state.setShowGlobalDefaults,
    showMoreMenu: state.showMoreMenu, setShowMoreMenu: state.setShowMoreMenu,
    isEditingProjectName: state.isEditingProjectName, setIsEditingProjectName: state.setIsEditingProjectName,
    isDragOver: state.isDragOver, setIsDragOver: state.setIsDragOver,
    isGenerating: state.isGenerating, setIsGenerating: state.setIsGenerating,
    contextMenu: state.contextMenu, setContextMenu: state.setContextMenu,
    selectionBox: state.selectionBox, setSelectionBox: state.setSelectionBox,
    crop: state.crop, setCrop: state.setCrop,
    isCropping: state.isCropping, setIsCropping: state.setIsCropping,
    isEditingAudio: state.isEditingAudio, setIsEditingAudio: state.setIsEditingAudio,
    isDraggingHead: state.isDraggingHead, setIsDraggingHead: state.setIsDraggingHead,
    isJumping: state.isJumping, setIsJumping: state.setIsJumping,
    localDuration: state.localDuration, setLocalDuration: state.setLocalDuration,
    theme: state.theme, setTheme: state.setTheme,
    exportFormat: state.exportFormat, setExportFormat: state.setExportFormat,
    exportResolution: state.exportResolution, setExportResolution: state.setExportResolution,
    exportFps: state.exportFps, setExportFps: state.setExportFps,
    exportQuality: state.exportQuality, setExportQuality: state.setExportQuality,
    exportCodec: state.exportCodec, setExportCodec: state.setExportCodec,
    exportHdr: state.exportHdr, setExportHdr: state.setExportHdr
  })));

  const {
    projectName, setProjectName,
    sortMode, setSortMode,
    sortDirection, setSortDirection,
    globalDefaults, setGlobalDefaults,
    monitorRes, setMonitorRes
  } = useStore(useShallow(state => ({
    projectName: state.projectName, setProjectName: state.setProjectName,
    sortMode: state.sortMode, setSortMode: state.setSortMode,
    sortDirection: state.sortDirection, setSortDirection: state.setSortDirection,
    globalDefaults: state.globalDefaults, setGlobalDefaults: state.setGlobalDefaults,
    monitorRes: state.monitorRes, setMonitorRes: state.setMonitorRes
  })));`;

content = content.replace(
  /  const \[monitorRes, setMonitorRes\] = useState<Resource \| null>\(null\);\r?\n  const \[isGenerating, setIsGenerating\] = useState\(false\);\r?\n  const \[statusMsg, setStatusMsg\] = useState\(''\);\r?\n  const \[activeTab, setActiveTab\] = useState<'effects' \| 'export'>\('effects'\);\r?\n  const \[propertyTab, setPropertyTab\] = useState\<'presets' \| 'color' \| 'text' \| 'transform'\>\('presets'\);\r?\n  const \[libTab, setLibTab\] = useState\<'image' \| 'audio' \| 'video'\>\('image'\);/,
  replacement1
);

// 3. 移除 export variables (保留注释)
content = content.replace(
  /  \/\/ 导出设置\r?\n  const \[exportFormat, setExportFormat\] = useState\<'mp4' \| 'mov'\>\('mp4'\);\r?\n  const \[exportResolution, setExportResolution\] = useState\<'1080p' \| '4k' \| 'original'\>\('original'\);\r?\n  const \[exportFps, setExportFps\] = useState\<'30' \| '60'\>\('60'\);\r?\n  const \[exportQuality, setExportQuality\] = useState\<'medium' \| 'high' \| 'lossless'\>\('lossless'\);\r?\n  const \[exportCodec, setExportCodec\] = useState\<'h264' \| 'h265'\>\('h264'\);\r?\n  const \[exportHdr, setExportHdr\] = useState\(false\);/,
  `  // 导出设置 (已迁移至 Zustand)`
);

// 4. 移除 crop/audio/dragging (保留部分)
content = content.replace(
  /  \/\/ 裁切编辑\r?\n  const \[crop, setCrop\] = useState\<Crop\>\(\);\r?\n  const \[isCropping, setIsCropping\] = useState\(false\);\r?\n\r?\n  \/\/ 音频剪辑\r?\n  const \[isEditingAudio, setIsEditingAudio\] = useState\(false\);\r?\n\r?\n  \/\/ 播放指针拖拽\r?\n  const \[isDraggingHead, setIsDraggingHead\] = useState\(false\);\r?\n  const \[isJumping, setIsJumping\] = useState\(false\); \/\/ 控制双击时的平滑跳转\r?\n  const \[selectionBox, setSelectionBox\] = useState\<\{ x1: number; x2: number; y: number; h: number \} \| null\>\(null\);\r?\n  const \[localDuration, setLocalDuration\] = useState\<number \| null\>\(null\);/,
  `  // 裁切编辑 (已迁移至 Zustand)\n\n  // 音频剪辑 (已迁移至 Zustand)\n\n  // 播放指针拖拽 (已迁移至 Zustand)`
);

// 5. 替换 isDragOver, contextMenu, theme 等
content = content.replace(
  /  const \[isDragOver, setIsDragOver\] = useState\(false\);\r?\n  \r?\n  const lastScrubTimeRef = useRef\<number\>\(0\);\r?\n  const \[contextMenu, setContextMenu\] = useState\<\{ x: number; y: number; type: 'image' \| 'audio'; targetId: string \} \| null\>\(null\);\r?\n  const \[playbackSpeed, setPlaybackSpeed\] = useState\(1\.0\);\r?\n  const \[searchQuery, setSearchQuery\] = useState\(''\);\r?\n  const \[showShortcuts, setShowShortcuts\] = useState\(false\);\r?\n  const \[_isFullscreen, setIsFullscreen\] = useState\(false\);\r?\n  const \[theme, setTheme\] = useState\<'ios' \| 'win11'\>\(\(\) => \{\r?\n    return \(localStorage\.getItem\('__editor_theme__'\) as 'ios' \| 'win11'\) \|\| 'ios';\r?\n  \}\);/,
  `  const lastScrubTimeRef = useRef<number>(0);\n  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);\n  const [searchQuery, setSearchQuery] = useState('');\n  const [_isFullscreen, setIsFullscreen] = useState(false);`
);

// 6. 替换 project variables
content = content.replace(
  /  \/\/ ─── 改版新增状态 ────────────────────────────────────────────────────\r?\n  const \[projectName, setProjectName\] = useState\('未命名项目'\);\r?\n  const \[sortMode, setSortMode\] = useState\<'manual' \| 'time' \| 'name'\>\('manual'\);\r?\n  const \[sortDirection, setSortDirection\] = useState\<'asc' \| 'desc'\>\('asc'\);\r?\n  const \[showSortMenu, setShowSortMenu\] = useState\(false\);\r?\n  const \[showExportPanel, setShowExportPanel\] = useState\(false\);\r?\n  const \[leftTab, setLeftTab\] = useState\<'photo' \| 'music' \| 'video'\>\('photo'\);\r?\n  const \[_showAdvancedExport, _setShowAdvancedExport\] = useState\(false\);\r?\n  const \[isEditingProjectName, setIsEditingProjectName\] = useState\(false\);\r?\n  const \[showGlobalDefaults, setShowGlobalDefaults\] = useState\(false\);\r?\n  const \[showMoreMenu, setShowMoreMenu\] = useState\(false\);\r?\n\r?\n  \/\/ ─── 全局默认值系统 \(任务6\) ──────────────────────────────────────────\r?\n  const \[globalDefaults, setGlobalDefaults\] = useState\<GlobalDefaults\>\(GLOBAL_DEFAULTS_INIT\);/,
  `  // ─── 改版新增状态 ────────────────────────────────────────────────────\n  const [_showAdvancedExport, _setShowAdvancedExport] = useState(false);\n\n  // ─── 全局默认值系统 (任务6) ──────────────────────────────────────────`
);


fs.writeFileSync(targetFile, content);
console.log('App.tsx modifications applied.');
