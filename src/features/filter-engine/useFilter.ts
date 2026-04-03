// ─── 滤镜计算引擎 ────────────────────────────────────────────────────────
// 纯函数：输入 TimelineItem 调色参数，输出 CSS filter 字符串

import type { TimelineItem } from '../../types';

/**
 * 计算 CSS filter 字符串
 * 模拟 Lightroom 级别的色彩调整链
 */
export function computeFilter(item: Partial<TimelineItem> | null): string {
  if (!item) return '';
  const exp = Number(item.exposure ?? 1.0);
  const hi = Number(item.highlights ?? 1.0);
  const sh = Number(item.shadows ?? 1.0);
  const wh = Number(item.whites ?? 1.0);
  const bl = Number(item.blacks ?? 1.0);
  const fade = Number(item.fade ?? 0.0);
  
  const dHi = hi - 1.0;
  const dSh = sh - 1.0;
  const dWh = wh - 1.0;
  const dBl = bl - 1.0;

  const brightOffset = (dHi * 0.15) + (dSh * 0.15) + (dWh * 0.1) + (dBl * 0.1);
  const contrastOffset = (dHi * 0.1) - (dSh * 0.15) + (dWh * 0.2) - (dBl * 0.2);

  const fadeSatDrop = fade * 0.6;
  const fadeBrightLift = fade * 0.05;

  const baseBrightness = exp + brightOffset + fadeBrightLift;
  const calcBrightness = Math.max(0, baseBrightness);
  
  const cnt = Number(item.contrast ?? 1.0);
  const bri = Number(item.brilliance ?? 1.0);
  const sharp = Number(item.sharpness ?? 0);
  const dBri = bri - 1.0;
  
  const baseContrast = cnt + contrastOffset + (dBri * 0.15) + (sharp > 0 ? sharp * 0.15 : 0);
  const calcContrast = Math.max(0, baseContrast);
  
  const sat = Number(item.saturation ?? 1.0);
  const vib = Number(item.vibrance ?? 1.0);
  
  const baseSaturate = (sat * vib) * (1 - fadeSatDrop) + (dBri * 0.1);
  const calcSaturate = Math.max(0, baseSaturate);
  
  const temp = Number(item.temp ?? 0);
  const tint = Number(item.tint ?? 0);
  const calcSepia = temp > 0 ? (temp / 100 * 0.5) : 0;
  // A negative temp (cool) doesn't work well with sepia. We simulate cooling by slightly reducing brightness of red/green via hue-rotate, but we NEVER flip 180.
  const calcHueRotate = tint + (temp < 0 ? (temp * -0.15) : 0);
  
  const blurStr = sharp < 0 ? `blur(${Math.abs(sharp) * 4}px) ` : '';
  
  return `${blurStr}brightness(${calcBrightness}) contrast(${calcContrast}) saturate(${calcSaturate}) sepia(${calcSepia}) hue-rotate(${calcHueRotate}deg)`;
}

/**
 * 计算文字样式
 * 融合各种 CSS Text 属性实现影视级文字特效
 */
export function computeTextStyles(item: any): React.CSSProperties {
  if (!item) return {};
  let shadows: string[] = [];
  
  // 1. 发光优先 (外发光效果更好叠加)
  if (item.textGlow) {
    const gc = item.textGlowColor || item.fontColor || '#fff';
    const gr = item.textGlowRadius ?? 20;
    shadows.push(`0 0 ${gr}px ${gc}`, `0 0 ${gr * 2}px ${gc}80`);
  }

  // 2. 物理阴影叠加
  if (item.textShadow) {
    const sc = item.textShadowColor || '#000000';
    const ox = item.textShadowOffsetX ?? 4;
    const oy = item.textShadowOffsetY ?? 4;
    const bl = item.textShadowBlur ?? 10;
    shadows.push(`${ox}px ${oy}px ${bl}px ${sc}`);
  } else if (!item.textGlow && item.textShadow !== false) {
    // 如果都没有开启，默认给出一点点柔和阴影以便看清白字
    shadows.push('0 4px 16px rgba(0,0,0,0.5)');
  }
  
  // 3. 背景遮罩计算
  let bgProps: any = { background: 'transparent', padding: 0 };
  if (item.textBgEnable) {
    bgProps.background = item.textBg || '#1A1A1A';
    // padding 取 X 和 Y
    const px = item.textBgPadX ?? 20;
    const py = item.textBgPadY ?? 12; // 遗留字段 textBgPadding 迁移或者统一使用默认 12
    bgProps.padding = `${py}px ${px}px`;
    bgProps.borderRadius = item.textBgRadius ?? 8;
  }

  return {
    textAlign: (item.textAlign || 'center') as any,
    color: item.fontColor || '#fff',
    fontSize: item.fontSize || 36,
    fontWeight: item.fontWeight === 'bold' ? 700 : 400,
    fontFamily: item.fontFamily && item.fontFamily !== '默认' ? item.fontFamily : 'sans-serif',
    textShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
    WebkitTextStroke: item.textStroke ? `${item.textStrokeWidth ?? 2}px ${item.textStrokeColor || '#000'}` : undefined,
    ...bgProps,
    letterSpacing: `${item.textLetterSpacing ?? 0}px`,
    lineHeight: item.textLineHeight ?? 1.2,
    opacity: item.textOpacity ?? 1,
  };
}

/**
 * 计算 色阶映射表 (Levels) 256 位离散值
 * 供 SVG <feComponentTransfer type="table"> 使用
 */
export function computeLevelsTable(black: number = 0, gamma: number = 1.0, white: number = 255): string {
  if (black === 0 && white === 255 && Math.abs(gamma - 1.0) < 0.01) return '';
  
  const b = Math.max(0, Math.min(253, black));
  const w = Math.max(b + 2, Math.min(255, white));
  const g = Math.max(0.1, Math.min(9.99, gamma));
  
  const invGamma = 1 / g;
  const range = w - b;
  
  const table = new Array(256);
  for (let i = 0; i < 256; i++) {
    // 线性归一化到黑白点之间
    let val = (i - b) / range;
    val = Math.max(0, Math.min(1, val)); // 截断黑白场
    // 应用 Gamma 核心曲线
    val = Math.pow(val, invGamma);
    table[i] = val.toFixed(4);
  }
  return table.join(' ');
}
