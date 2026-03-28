// ─── 统一文件对话框 ────────────────────────────────────────────────────────
// Tauri 环境使用原生 dialog API
// 浏览器环境使用 <input type="file"> 兜底

import { isTauri } from './env';

export interface FileDialogOptions {
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
  title?: string;
}

/**
 * 打开文件选择对话框
 * @returns 选中的文件路径数组（Tauri）或 File 对象数组（浏览器）
 */
export async function openFileDialog(options: FileDialogOptions = {}): Promise<string[] | null> {
  if (isTauri) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: options.multiple ?? true,
        filters: options.filters,
        title: options.title,
      });
      if (!result) return null;
      return Array.isArray(result) ? result : [result];
    } catch (e) {
      console.warn('[Dialog] Tauri dialog failed, falling back to browser:', e);
    }
  }

  // 浏览器兜底
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple ?? true;
    if (options.filters?.length) {
      input.accept = options.filters
        .flatMap(f => f.extensions.map(ext => `.${ext}`))
        .join(',');
    }
    input.onchange = () => {
      if (!input.files?.length) { resolve(null); return; }
      const paths = Array.from(input.files).map(f => (f as any).path || f.name);
      resolve(paths);
    };
    input.click();
  });
}

/**
 * 保存文件对话框
 */
export async function saveFileDialog(options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> } = {}): Promise<string | null> {
  if (isTauri) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      return await save({
        defaultPath: options.defaultPath,
        filters: options.filters,
      });
    } catch (e) {
      console.warn('[Dialog] Save dialog failed:', e);
    }
  }
  return null;
}
