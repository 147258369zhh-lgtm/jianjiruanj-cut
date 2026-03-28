// ─── 全局默认值 ────────────────────────────────────────────────────────
export interface GlobalDefaults {
  duration: number;
  transition: string;
  exposure: number;
  brilliance: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  temp: number;
  tint: number;
  sharpness: number;
  grain: number;
  zoom: number;
  rotation: number;
  animation: string;
  opacity: number;
  blendMode: string;
  flipX: boolean;
  flipY: boolean;
  vignette: number;
  fade: number;
  posX: number;
  posY: number;
}

export const GLOBAL_DEFAULTS_INIT: GlobalDefaults = {
  duration: 3, transition: 'fade',
  exposure: 1.0, brilliance: 1.0, contrast: 1.0, saturation: 1.0,
  highlights: 1.0, shadows: 1.0, whites: 1.0, blacks: 1.0, vibrance: 1.0,
  sharpness: 0, grain: 0,
  temp: 0, tint: 0, zoom: 1.0, rotation: 0, animation: 'none',
  opacity: 1.0, blendMode: 'normal', flipX: false, flipY: false,
  vignette: 0, fade: 0, posX: 0, posY: 0
};

export const ANIMATION_PRESETS = [
  'anim-img-fadeIn', 'anim-img-slideLeft', 'anim-img-slideRight',
  'anim-img-slideUp', 'anim-img-slideDown', 'anim-img-zoomIn',
  'anim-img-zoomOut', 'anim-img-panLeft', 'anim-img-panRight'
];

// ─── 项目状态 ────────────────────────────────────────────────────────
export interface ProjectState {
  projectName: string;
  sortMode: 'manual' | 'time' | 'name';
  sortDirection: 'asc' | 'desc';
}
