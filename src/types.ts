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
export interface TextOverlay {
  id: string; // 唯一文本ID
  text: string;
  fontFamily?: string;
  fontColor?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  textOpacity?: number;
  textLetterSpacing?: number;
  textLineHeight?: number;
  textRotation?: number;
  textX?: number;
  textY?: number;
  textBg?: string;     
  textBgPadding?: number; 
  textBgRadius?: number; 
  textShadowColor?: string;  
  textShadowBlur?: number;   
  textShadowOffsetX?: number; 
  textShadowOffsetY?: number; 
  textStrokeColor?: string;  
  textStrokeWidth?: number;  
  textGlow?: boolean;        
  textGlowColor?: string;    
  textGlowRadius?: number;   
  textAnimation?: string; 
  textAnimDuration?: number;
  textAnimOut?: string;
  textAnimOutDuration?: number;
  textAnimLoop?: string;
  textAnimLoopDuration?: number;
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
  curveMaster?: {x: number, y: number}[];
  curveRed?: {x: number, y: number}[];
  curveGreen?: {x: number, y: number}[];
  curveBlue?: {x: number, y: number}[];
  opacity?: number;      // 不透明度 (1.0)
  blendMode?: string;    // 混合模式 (normal, multiply, screen, overlay)
  flipX?: boolean;       // 水平镜像翻转
  flipY?: boolean;       // 垂直镜像翻转
  vignette: number;      // 暗角 (0)
  fade: number;          // 褪色 (0)
  
  // 视频专属属性
  volume?: number;       // 音量 (默认 1.0)
  playbackRate?: number; // 播放倍速 (默认 1.0)
  trimStart?: number;    // 视频源修剪起始点 (秒，默认 0)
  mute?: boolean;        // 是否静音
  
  posX?: number;         // X轴坐标偏移 (-100 ~ 100)
  posY?: number;         // Y轴坐标偏移 (-100 ~ 100)
  overlayText?: string;
  fontSize?: number;   // 24
  fontWeight?: string; // "bold"
  fontColor?: string;  // 文字颜色 (#fff)
  fontFamily?: string; // 字体
  textAlign?: 'left' | 'center' | 'right'; // 对齐方式
  textBg?: string;     // 文字背景色 (rgba)
  textBgPadding?: number; // 文字底板内边距
  textBgRadius?: number; // 文字底板圆角
  textBgEnable?: boolean; // 文字底板开关
  textBgPadX?: number; // 文字底板 X padding
  textBgPadY?: number; // 文字底板 Y padding
  textShadow?: boolean;      // 文字阴影开关
  textShadowColor?: string;  // 文字阴影颜色
  textShadowBlur?: number;   // 文字阴影模糊半径
  textShadowOffsetX?: number; // 文字阴影 X 偏移
  textShadowOffsetY?: number; // 文字阴影 Y 偏移
  textStroke?: boolean;      // 文字描边开关
  textStrokeColor?: string;  // 文字描边颜色
  textStrokeWidth?: number;  // 文字描边宽度
  textGlow?: boolean;        // 文字发光开关
  textGlowColor?: string;    // 文字发光颜色
  textGlowRadius?: number;   // 文字发光半径
  textLetterSpacing?: number;// 字间距
  textLineHeight?: number;   // 行间距
  textOpacity?: number;      // 不透明度 (0-1)
  textRotation?: number;     // 文字旋转角度
  textX?: number;            // 文字X位置 (0-100%, 默认50)
  textY?: number;            // 文字Y位置 (0-100%, 默认50)
  cropPos?: Crop;
  textAnimation?: string; // 文字入场动画，如 'fadeIn' | 'slideLeft' | 'slideUp' | 'zoom' | 'bounce' | 'typewriter' 等
  textAnimDuration?: number; // 动画时长 (秒，默认 0.6)
  textAnimOut?: string;
  textAnimOutDuration?: number;
  textAnimLoop?: string;
  textAnimLoopDuration?: number;
  
  // 新引入的多图层复数文字组件系统
  textOverlays?: TextOverlay[];
  animation?: string; // 图片入场动效 / 镜头推进
  fillMode?: 'contain' | 'cover'; // 画面填充模式
  overrides?: string[]; // 被手动修改过的字段名列表（全局覆盖模型）
  collapsed?: boolean; // 视频折叠：折叠后在时间轴中只显示一帧缩略图
  maskShape?: string;
  keystoneX?: number; // 水平形变 (度)
  keystoneY?: number; // 垂直形变 (度)
  // 色阶 Levels
  levelInBlack?: number; // 0 to 255
  levelInGamma?: number; // 0.1 to 9.99
  levelInWhite?: number; // 0 to 255
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
  keystoneX: number;
  keystoneY: number;
  levelInBlack: number;
  levelInGamma: number;
  levelInWhite: number;
}

export const GLOBAL_DEFAULTS_INIT: GlobalDefaults = {
  duration: 3, transition: 'fade',
  exposure: 1.0, brilliance: 1.0, contrast: 1.0, saturation: 1.0,
  highlights: 1.0, shadows: 1.0, whites: 1.0, blacks: 1.0, vibrance: 1.0,
  sharpness: 0, grain: 0,
  temp: 0, tint: 0, zoom: 1.0, rotation: 0, animation: 'none',
  opacity: 1.0, blendMode: 'normal', flipX: false, flipY: false,
  vignette: 0, fade: 0, posX: 0, posY: 0,
  keystoneX: 0, keystoneY: 0,
  levelInBlack: 0, levelInGamma: 1.0, levelInWhite: 255
};

export const ANIMATION_PRESETS = ['anim-img-fadeIn', 'anim-img-slideLeft', 'anim-img-slideRight', 'anim-img-slideUp', 'anim-img-slideDown', 'anim-img-zoomIn', 'anim-img-zoomOut', 'anim-img-panLeft', 'anim-img-panRight'];
// Added dynamically
// Extended properties for TimelineItem
