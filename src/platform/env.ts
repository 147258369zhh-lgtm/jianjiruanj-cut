// ─── 环境检测 ────────────────────────────────────────────────────────
// 在Tauri应用运行时 window.__TAURI__ 存在
// 在浏览器调试（不通过 Tauri）时可能不存在

export const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__;
export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
