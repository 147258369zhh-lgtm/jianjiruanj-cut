import { StateCreator } from 'zustand';
import { Crop } from 'react-image-crop';
import { FilterPreset } from '../../features/filter-engine/filterPresets';

export interface UiSlice {
  // Tab 状态
  activeTab: 'effects' | 'export';
  propertyTab: 'presets' | 'color' | 'text' | 'transform';
  libTab: 'image' | 'audio' | 'video';
  leftTab: 'photo' | 'music' | 'video';
  panelOrderImage: string[];
  panelOrderText: string[];
  panelCollapsed: Record<string, boolean>;
  
  // 自定义与折叠滤镜
  customFilters: FilterPreset[];
  hiddenFilterNames: string[];

  // 全局 UI
  statusMsg: string;
  showShortcuts: boolean;
  showSortMenu: boolean;
  showExportPanel: boolean;
  showGlobalDefaults: boolean;
  showMoreMenu: boolean;
  isEditingProjectName: boolean;
  isDragOver: boolean;
  isGenerating: boolean;
  exportMinimized: boolean;
  exportEstimatedTime: number | null;
  exportProgress: number;
  contextMenu: { x: number; y: number; type: 'image' | 'audio'; targetId: string } | null;
  selectionBox: { x1: number; x2: number; y: number; h: number } | null;
  
  // 裁切
  crop: Crop | undefined;
  isCropping: boolean;
  isEditingAudio: boolean;
  
  // 播放指针
  isDraggingHead: boolean;
  isJumping: boolean;
  localDuration: number | null;
  
  // 主题
  theme: 'ios' | 'win11' | 'harmony';
  
  // 导出设置
  exportFormat: 'mp4' | 'mov';
  exportResolution: '1080p' | '4k' | 'original';
  exportFps: '30' | '60';
  exportQuality: 'medium' | 'high' | 'lossless';
  exportCodec: 'h264' | 'h265';
  exportHdr: boolean;
  
  // Setters
  setActiveTab: (v: 'effects' | 'export') => void;
  setPropertyTab: (v: 'presets' | 'color' | 'text' | 'transform') => void;
  setLibTab: (v: 'image' | 'audio' | 'video') => void;
  setLeftTab: (v: 'photo' | 'music' | 'video') => void;
  setPanelOrderImage: (v: string[]) => void;
  setPanelOrderText: (v: string[]) => void;
  togglePanelCollapsed: (id: string) => void;
  setCustomFilters: (v: FilterPreset[]) => void;
  setHiddenFilterNames: (v: string[]) => void;
  setStatusMsg: (v: string) => void;
  setShowShortcuts: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowSortMenu: (v: boolean) => void;
  setShowExportPanel: (v: boolean) => void;
  setShowGlobalDefaults: (v: boolean) => void;
  setShowMoreMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  setIsEditingProjectName: (v: boolean) => void;
  setIsDragOver: (v: boolean) => void;
  setIsGenerating: (v: boolean) => void;
  setExportMinimized: (v: boolean) => void;
  setExportEstimatedTime: (v: number | null) => void;
  setExportProgress: (v: number) => void;
  setContextMenu: (v: UiSlice['contextMenu']) => void;
  setSelectionBox: (v: UiSlice['selectionBox'] | ((prev: UiSlice['selectionBox']) => UiSlice['selectionBox'])) => void;
  setCrop: (v: Crop | undefined) => void;
  setIsCropping: (v: boolean) => void;
  setIsEditingAudio: (v: boolean) => void;
  setIsDraggingHead: (v: boolean) => void;
  setIsJumping: (v: boolean) => void;
  setLocalDuration: (v: number | null) => void;
  setTheme: (v: 'ios' | 'win11' | 'harmony') => void;
  setExportFormat: (v: 'mp4' | 'mov') => void;
  setExportResolution: (v: '1080p' | '4k' | 'original') => void;
  setExportFps: (v: '30' | '60') => void;
  setExportQuality: (v: 'medium' | 'high' | 'lossless') => void;
  setExportCodec: (v: 'h264' | 'h265') => void;
  setExportHdr: (v: boolean) => void;
}

const loadCustomFilters = (): FilterPreset[] => {
  try { return JSON.parse(localStorage.getItem('__editor_custom_filters__') || '[]'); } catch { return []; }
};
const loadHiddenFilters = (): string[] => {
  try { return JSON.parse(localStorage.getItem('__editor_hidden_filters__') || '[]'); } catch { return []; }
};

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  activeTab: 'effects',
  propertyTab: 'presets',
  libTab: 'image',
  leftTab: 'photo',
  panelOrderImage: (() => { try { return JSON.parse(localStorage.getItem('__editor_panel_order_image__') as string) || ["base", "light", "color", "texture", "curves"]; } catch { return ["base", "light", "color", "texture", "curves"]; } })(),
  panelOrderText: (() => { try { return JSON.parse(localStorage.getItem('__editor_panel_order_text__') as string) || ["text-base", "text-anim", "text-effects", "text-presets"]; } catch { return ["text-base", "text-anim", "text-effects", "text-presets"]; } })(),
  panelCollapsed: (() => { try { return JSON.parse(localStorage.getItem('__editor_panel_collapsed__') as string) || {}; } catch { return {}; } })(),
  customFilters: loadCustomFilters(),
  hiddenFilterNames: loadHiddenFilters(),
  statusMsg: '',
  showShortcuts: false,
  showSortMenu: false,
  showExportPanel: false,
  showGlobalDefaults: false,
  showMoreMenu: false,
  isEditingProjectName: false,
  isDragOver: false,
  isGenerating: false,
  exportMinimized: false,
  exportEstimatedTime: null,
  exportProgress: 0,
  contextMenu: null,
  selectionBox: null,
  crop: undefined,
  isCropping: false,
  isEditingAudio: false,
  isDraggingHead: false,
  isJumping: false,
  localDuration: null,
  theme: (localStorage.getItem('__editor_theme__') as 'ios' | 'win11' | 'harmony') || 'ios',
  exportFormat: 'mp4',
  exportResolution: 'original',
  exportFps: '60',
  exportQuality: 'lossless',
  exportCodec: 'h264',
  exportHdr: false,
  
  setActiveTab: (v) => set({ activeTab: v }),
  setPropertyTab: (v) => set({ propertyTab: v }),
  setLibTab: (v) => set({ libTab: v }),
  setLeftTab: (v) => set({ leftTab: v }),
  setPanelOrderImage: (v) => {
    localStorage.setItem('__editor_panel_order_image__', JSON.stringify(v));
    set({ panelOrderImage: v });
  },
  setPanelOrderText: (v) => {
    localStorage.setItem('__editor_panel_order_text__', JSON.stringify(v));
    set({ panelOrderText: v });
  },
  togglePanelCollapsed: (id) => set(s => {
    const next = { ...s.panelCollapsed, [id]: !s.panelCollapsed[id] };
    localStorage.setItem('__editor_panel_collapsed__', JSON.stringify(next));
    return { panelCollapsed: next };
  }),
  setCustomFilters: (v) => { localStorage.setItem('__editor_custom_filters__', JSON.stringify(v)); set({ customFilters: v }); },
  setHiddenFilterNames: (v) => { localStorage.setItem('__editor_hidden_filters__', JSON.stringify(v)); set({ hiddenFilterNames: v }); },
  setStatusMsg: (v) => set({ statusMsg: v }),
  setShowShortcuts: (v) => set(s => ({ showShortcuts: typeof v === 'function' ? v(s.showShortcuts) : v })),
  setShowSortMenu: (v) => set({ showSortMenu: v }),
  setShowExportPanel: (v) => set({ showExportPanel: v }),
  setShowGlobalDefaults: (v) => set({ showGlobalDefaults: v }),
  setShowMoreMenu: (v) => set(s => ({ showMoreMenu: typeof v === 'function' ? v(s.showMoreMenu) : v })),
  setIsEditingProjectName: (v) => set({ isEditingProjectName: v }),
  setIsDragOver: (v) => set({ isDragOver: v }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setExportMinimized: (v) => set({ exportMinimized: v }),
  setExportEstimatedTime: (v) => set({ exportEstimatedTime: v }),
  setExportProgress: (v) => set({ exportProgress: v }),
  setContextMenu: (v) => set({ contextMenu: v }),
  setSelectionBox: (v) => set(s => ({ selectionBox: typeof v === 'function' ? v(s.selectionBox) : v })),
  setCrop: (v) => set({ crop: v }),
  setIsCropping: (v) => set({ isCropping: v }),
  setIsEditingAudio: (v) => set({ isEditingAudio: v }),
  setIsDraggingHead: (v) => set({ isDraggingHead: v }),
  setIsJumping: (v) => set({ isJumping: v }),
  setLocalDuration: (v) => set({ localDuration: v }),
  setTheme: (v) => { localStorage.setItem('__editor_theme__', v); set({ theme: v }); },
  setExportFormat: (v) => set({ exportFormat: v }),
  setExportResolution: (v) => set({ exportResolution: v }),
  setExportFps: (v) => set({ exportFps: v }),
  setExportQuality: (v) => set({ exportQuality: v }),
  setExportCodec: (v) => set({ exportCodec: v }),
  setExportHdr: (v) => set({ exportHdr: v }),
});
