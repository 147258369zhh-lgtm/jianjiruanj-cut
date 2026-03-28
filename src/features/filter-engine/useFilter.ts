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
  const calcSepia = Math.abs(temp) / 100 * 0.6;
  const calcHueRotate = (temp < 0 ? 180 + tint : tint);
  
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
  
  if (item.textShadowColor) {
    shadows.push(`${item.textShadowOffsetX ?? 2}px ${item.textShadowOffsetY ?? 2}px ${item.textShadowBlur ?? 8}px ${item.textShadowColor}`);
  } else if (!item.textGlow) {
    shadows.push('0 4px 16px rgba(0,0,0,0.5)');
  }
  
  if (item.textGlow) {
    const gc = item.textGlowColor || item.fontColor || '#fff';
    const gr = item.textGlowRadius ?? 20;
    shadows.push(`0 0 ${gr}px ${gc}`, `0 0 ${gr * 2}px ${gc}80`);
  }

  return {
    textAlign: (item.textAlign || 'center') as any,
    color: item.fontColor || '#fff',
    fontSize: item.fontSize || 36,
    fontWeight: item.fontWeight === 'bold' ? 700 : 400,
    fontFamily: item.fontFamily && item.fontFamily !== '默认' ? item.fontFamily : 'sans-serif',
    textShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
    WebkitTextStroke: item.textStrokeColor ? `${item.textStrokeWidth ?? 1}px ${item.textStrokeColor}` : undefined,
    background: item.textBg || 'transparent',
    padding: item.textBg && item.textBg !== 'transparent' ? `${item.textBgPadding ?? 12}px ${item.textBgPadding ? item.textBgPadding * 2 : 24}px` : 0,
    borderRadius: item.textBgRadius ?? 8,
    letterSpacing: `${item.textLetterSpacing ?? 0}px`,
    lineHeight: item.textLineHeight ?? 1.2,
    opacity: item.textOpacity ?? 1,
  };
}
