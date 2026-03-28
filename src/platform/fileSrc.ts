// ─── 统一文件路径转换 ────────────────────────────────────────────────────────
// 在 Tauri WebView 中本地文件需要通过 convertFileSrc 转换
// 在浏览器调试中直接使用原始路径

import { isTauri } from './env';

let _convertFileSrc: ((path: string) => string) | null = null;

async function ensureConvertor() {
  if (_convertFileSrc) return;
  if (isTauri) {
    try {
      const mod = await import('@tauri-apps/api/core');
      _convertFileSrc = mod.convertFileSrc;
    } catch {
      _convertFileSrc = (p: string) => p;
    }
  } else {
    _convertFileSrc = (p: string) => p;
  }
}

/**
 * 统一文件路径转换
 * - Tauri 环境：调用 convertFileSrc 转为 asset:// 协议
 * - 浏览器环境：直接返回原始路径
 * - HTTP/Blob 路径：直接返回不转换
 */
export function toDisplaySrc(path: string): string {
  if (!path) return '';
  // 已经是 web URL 的直接返回
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('asset:')) {
    return path;
  }
  // Web 相对路径（/audio/xxx.mp3）直接返回
  if (path.startsWith('/')) {
    return path;
  }
  // 本地文件路径需要转换
  if (_convertFileSrc) {
    return _convertFileSrc(path);
  }
  return path;
}

/**
 * 初始化平台适配层（应用启动时调用一次）
 */
export async function initPlatform() {
  await ensureConvertor();
}

// 同步版（用于已经初始化后）
export function convertFileSrcSync(path: string): string {
  return toDisplaySrc(path);
}
