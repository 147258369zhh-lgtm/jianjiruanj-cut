import { Crop } from 'react-image-crop';

// ─── 类型定义 ────────────────────────────────────────────────────────
export interface Resource { id: string; name: string; path: string; type: 'image' | 'audio' | 'video' | 'voiceover'; focusX?: number; focusY?: number; hasFace?: boolean; dHash?: string; sharpnessScore?: number; burstGroupId?: string; isDiscarded?: boolean; meanBrightness?: number; aspectRatio?: number; }

export interface AudioTimelineItem {
  id: string;
  resourceId: string;
  timelineStart: number;
  startOffset: number;
  duration: number;
  volume: number;
  fadeIn?: number;   // 淡入时长 (秒，默认0)
  fadeOut?: number;  // 淡出时长 (秒，默认0)
  // 剪辑点系统
  cutPoints?: number[];      // 在夹内的时间位置 (0~duration)，左闭右开
  selectedRegions?: number[]; // 被选中待删除的区域索引
}

export interface TimelineItem {
  id: string;
  resourceId: string;
  duration: number;
  transition: string;
  rotation: number;
  contrast: number;
  saturation: number;
  exposure: number;    // 曝光 (1.0)
  brilliance: number;  // 鲜明度 (1.0)
  highlights: number;  // 高光 (1.0)
  shadows: number;     // 阴影 (1.0)
  whites: number;      // 白色色阶 (1.0)
  blacks: number;      // 黑色色阶 (1.0)
  temp: number;        // 色温 (0)
  tint: number;        // 色调 (0)
  vibrance: number;    // 自然饱和度 (1.0)
  sharpness: number;   // 锐度/清晰度 (0.0)
  grain: number;       // 颗粒 (0.0)
  zoom: number;
  opacity?: number;      // 不透明度 (1.0)
  blendMode?: string;    // 混合模式 (normal, multiply, screen, overlay)
  flipX?: boolean;       // 水平镜像翻转
  flipY?: boolean;       // 垂直镜像翻转
  vignette: number;      // 暗角 (0)
  fade: number;          // 褪色 (0)
  posX?: number;         // X轴坐标偏移 (-100 ~ 100)
  posY?: number;         // Y轴坐标偏移 (-100 ~ 100)
  overlayText?: string;
  fontSize?: number;   // 24
  fontWeight?: string; // "bold"
  fontColor?: string;  // 文字颜色 (#fff)
  fontFamily?: string; // 字体
  textAlign?: 'left' | 'center' | 'right'; // 对齐方式
  textBg?: string;     // 文字背景色 (rgba)
  textShadowColor?: string;  // 文字阴影颜色
  textStrokeColor?: string;  // 文字描边颜色
  textStrokeWidth?: number;  // 文字描边宽度
  textGlow?: boolean;        // 文字发光
  textX?: number;            // 文字X位置 (0-100%, 默认50)
  textY?: number;            // 文字Y位置 (0-100%, 默认50)
  cropPos?: Crop;
  textAnimation?: string; // 文字入场动画，如 'fadeIn' | 'slideLeft' | 'slideUp' | 'zoom' | 'bounce' | 'typewriter' 等
  textAnimDuration?: number; // 动画时长 (秒，默认 0.6)
  animation?: string; // 图片入场动效 / 镜头推进
  fillMode?: 'contain' | 'cover'; // 画面填充模式
  overrides?: string[]; // 被手动修改过的字段名列表（全局覆盖模型）
}

// 全局默认值接口
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

export const ANIMATION_PRESETS = ['anim-img-fadeIn', 'anim-img-slideLeft', 'anim-img-slideRight', 'anim-img-slideUp', 'anim-img-slideDown', 'anim-img-zoomIn', 'anim-img-zoomOut', 'anim-img-panLeft', 'anim-img-panRight'];
// Added dynamically
// Extended properties for TimelineItem
