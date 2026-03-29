export interface FilterPreset {
  icon: string;
  name: string;
  exposure: number;
  contrast: number;
  saturation: number;
  temp: number;
  tint: number;
  brilliance: number;
  highlights?: number;
  shadows?: number;
  whites?: number;
  blacks?: number;
  vignette?: number;
  fade?: number;
  grain?: number;
  curveMaster?: {x: number, y: number}[];
  curveRed?: {x: number, y: number}[];
  curveGreen?: {x: number, y: number}[];
  curveBlue?: {x: number, y: number}[];
  isCustom?: boolean; // Flag to indicate if it's a custom preset
}

export const FILTER_PRESETS: FilterPreset[] = [
  { icon: '🔄', name: '重置', exposure: 1.0, contrast: 1.0, saturation: 1.0, temp: 0, tint: 0, brilliance: 1.0 },
  { icon: '🎞', name: '胶片', exposure: 0.95, contrast: 1.15, saturation: 0.85, temp: 15, tint: 5, brilliance: 1.0 },
  { icon: '🌸', name: '日系', exposure: 1.1, contrast: 0.9, saturation: 0.7, temp: -10, tint: -5, brilliance: 1.05 },
  { icon: '🎬', name: '电影', exposure: 0.9, contrast: 1.3, saturation: 0.8, temp: 10, tint: -10, brilliance: 1.1 },
  { icon: '⬛', name: '黑白', exposure: 1.0, contrast: 1.2, saturation: 0.0, temp: 0, tint: 0, brilliance: 1.0 },
  { icon: '🌅', name: '暖阳', exposure: 1.05, contrast: 1.1, saturation: 1.1, temp: 30, tint: 10, brilliance: 1.05 },
  { icon: '❄️', name: '冷调', exposure: 1.0, contrast: 1.15, saturation: 0.9, temp: -25, tint: -15, brilliance: 1.0 },
  { icon: '📷', name: '复古', exposure: 0.92, contrast: 1.1, saturation: 0.65, temp: 20, tint: 8, brilliance: 0.95 },
  { icon: '🍃', name: '清新', exposure: 1.08, contrast: 0.95, saturation: 1.15, temp: -5, tint: 5, brilliance: 1.1 },
  { icon: '🔮', name: '梦幻', exposure: 1.1, contrast: 0.85, saturation: 0.9, temp: -15, tint: 15, brilliance: 1.15 },
  { icon: '🎨', name: '鲜艳', exposure: 1.0, contrast: 1.2, saturation: 1.5, temp: 5, tint: 0, brilliance: 1.1 },
  { icon: '🏚', name: '褪色', exposure: 1.05, contrast: 0.85, saturation: 0.5, temp: 10, tint: 5, brilliance: 0.9 },
  { icon: '🌇', name: '夕照', exposure: 0.95, contrast: 1.15, saturation: 1.2, temp: 40, tint: 15, brilliance: 1.0 },
  { icon: '🧊', name: '青橙', exposure: 1.0, contrast: 1.2, saturation: 1.1, temp: -20, tint: 20, brilliance: 1.05 },
  { icon: '✨', name: '柔光', exposure: 1.15, contrast: 0.88, saturation: 0.95, temp: 5, tint: 0, brilliance: 1.2 },
  { icon: '🌌', name: '赛博', exposure: 0.9, contrast: 1.25, saturation: 1.3, temp: -15, tint: 30, brilliance: 1.1 },
  { icon: '☕', name: '拿铁', exposure: 1.05, contrast: 0.9, saturation: 0.8, temp: 25, tint: 10, brilliance: 0.9 },
  { icon: '🌲', name: '森系', exposure: 0.95, contrast: 1.1, saturation: 1.05, temp: -10, tint: -5, brilliance: 0.9 },
  { icon: '🍂', name: '秋意', exposure: 1.0, contrast: 1.1, saturation: 1.2, temp: 35, tint: 15, brilliance: 1.05 },
  { icon: '🍒', name: '元气', exposure: 1.1, contrast: 1.05, saturation: 1.2, temp: 5, tint: 10, brilliance: 1.1 },
  { icon: '🖤', name: '银灰', exposure: 0.95, contrast: 1.1, saturation: 0.2, temp: -5, tint: -5, brilliance: 0.95 },
  { icon: '🍰', name: '奶油', exposure: 1.15, contrast: 0.85, saturation: 0.9, temp: 10, tint: 0, brilliance: 1.1 },
  { icon: '🥂', name: '香槟', exposure: 1.1, contrast: 0.95, saturation: 0.85, temp: 15, tint: 5, brilliance: 1.15 },
  { icon: '🌙', name: '夜景', exposure: 1.15, contrast: 1.2, saturation: 1.1, temp: -10, tint: -5, brilliance: 1.2 },
  { icon: '🗻', name: '富士CC', exposure: 0.95, contrast: 1.2, saturation: 0.8, temp: -5, tint: 10, brilliance: 1.05 },
  { icon: '📸', name: '柯达金', exposure: 1.05, contrast: 1.1, saturation: 1.2, temp: 15, tint: 5, brilliance: 1.1 },
  { icon: '🔴', name: '徕卡德', exposure: 0.9, contrast: 1.3, saturation: 0.9, temp: 5, tint: 5, brilliance: 0.95 },
  { icon: '📹', name: '索尼C', exposure: 1.0, contrast: 1.15, saturation: 1.1, temp: 0, tint: -5, brilliance: 1.0 },
  { icon: '🌸', name: '佳能人', exposure: 1.1, contrast: 0.9, saturation: 0.95, temp: -10, tint: -5, brilliance: 1.15 },
  { icon: '🔲', name: '伊尔福', exposure: 1.0, contrast: 1.4, saturation: 0.0, temp: 0, tint: 0, brilliance: 0.9 },
  { icon: '📷', name: '爱克发', exposure: 1.05, contrast: 1.15, saturation: 1.25, temp: 5, tint: 0, brilliance: 1.1 },
  { icon: '⬛', name: '哈苏然', exposure: 1.0, contrast: 1.05, saturation: 1.0, temp: 0, tint: -5, brilliance: 1.05 },
  { icon: '🍃', name: '宾得绿', exposure: 0.95, contrast: 1.1, saturation: 1.15, temp: -10, tint: 15, brilliance: 1.0 },
  { icon: '🌸', name: '奥林巴', exposure: 1.1, contrast: 0.95, saturation: 0.9, temp: 5, tint: 5, brilliance: 1.1 },
  { icon: '🎨', name: '柯达E', exposure: 1.0, contrast: 1.25, saturation: 1.3, temp: 10, tint: 5, brilliance: 1.15 },
  { icon: '🌆', name: '柯达P', exposure: 1.05, contrast: 1.1, saturation: 1.05, temp: 20, tint: 0, brilliance: 1.1 },
  { icon: '🌲', name: '富士S', exposure: 0.95, contrast: 1.15, saturation: 1.1, temp: -5, tint: 5, brilliance: 1.0 },
  { icon: '⬛', name: '伊尔福D', exposure: 0.95, contrast: 1.45, saturation: 0.0, temp: 0, tint: 0, brilliance: 0.85 },
  { icon: '📷', name: '宝丽来', exposure: 1.15, contrast: 0.85, saturation: 0.8, temp: 15, tint: -10, brilliance: 0.95 },
  { icon: '🎢', name: 'Lomo', exposure: 0.85, contrast: 1.5, saturation: 1.4, temp: 10, tint: 15, brilliance: 0.8 },
];
