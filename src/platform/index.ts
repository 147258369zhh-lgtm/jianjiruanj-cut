// ─── 平台适配层统一导出 ────────────────────────────────────────────────────────
export { isTauri, isDev, isProd } from './env';
export { toDisplaySrc, initPlatform, convertFileSrcSync } from './fileSrc';
export { openFileDialog, saveFileDialog } from './dialog';
export type { FileDialogOptions } from './dialog';
