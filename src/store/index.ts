// ─── Zustand 状态总线 ────────────────────────────────────────────────────────
// 所有模块通过 useStore(s => s.xxx) 读写状态
// 不需要 Provider，不需要 Context，任意文件直接 import 使用

import { create } from 'zustand';
import { createTimelineSlice, TimelineSlice } from './slices/timelineSlice';
import { createResourceSlice, ResourceSlice } from './slices/resourceSlice';
import { createPlaybackSlice, PlaybackSlice } from './slices/playbackSlice';
import { createAudioSlice, AudioSlice } from './slices/audioSlice';
import { createUiSlice, UiSlice } from './slices/uiSlice';
import { createProjectSlice, ProjectSlice } from './slices/projectSlice';

// 合并所有 slice 类型
export type AppStore = TimelineSlice & ResourceSlice & PlaybackSlice & AudioSlice & UiSlice & ProjectSlice;

// 创建全局 Store
export const useStore = create<AppStore>()((...a) => ({
  ...createTimelineSlice(...a),
  ...createResourceSlice(...a),
  ...createPlaybackSlice(...a),
  ...createAudioSlice(...a),
  ...createUiSlice(...a),
  ...createProjectSlice(...a),
}));

// 便捷 hooks（按功能域导出，减少组件重渲染范围）
export const useTimeline = () => useStore(s => s.timeline);
export const useResources = () => useStore(s => s.resources);
export const usePlayback = () => useStore(s => ({ isPlaying: s.isPlaying, playTime: s.playTime, playbackSpeed: s.playbackSpeed }));
export const useSelectedIds = () => useStore(s => s.selectedIds);
export const useHoveredPreviewPreset = () => useStore(s => s.hoveredPreviewPreset);
