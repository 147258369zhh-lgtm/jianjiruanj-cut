// ─── 统一类型导出 ────────────────────────────────────────────────────────
// 所有模块通过 import { xxx } from '@/types' 或 '../types' 获取类型

export type { Resource } from './resource';
export type { AudioTimelineItem } from './audio';
export type { TextOverlay, TimelineItem } from './timeline';
export type { GlobalDefaults, ProjectState } from './project';
export { GLOBAL_DEFAULTS_INIT, ANIMATION_PRESETS } from './project';
