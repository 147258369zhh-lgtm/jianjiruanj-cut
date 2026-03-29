import { useEffect } from 'react';
import { Resource } from '../types';

export interface IngestItem extends Resource {
  status: 'approved' | 'rejected';
  reason?: string;
  originalIndex: number;
  lastModified?: number;
  size?: number;
}

interface UseDragImportArgs {
  setIsDragOver: (isOver: boolean) => void;
  setIngestQueue: (fn: (prev: IngestItem[]) => IngestItem[]) => void;
  setStatusMsg: (msg: string) => void;
}

export function useDragImport({
  setIsDragOver,
  setIngestQueue,
  setStatusMsg
}: UseDragImportArgs) {
  useEffect(() => {
    let dragCounter = 0;
    const handleDragEnter = (e: DragEvent) => { e.preventDefault(); dragCounter++; setIsDragOver(true); };
    const handleDragLeave = (e: DragEvent) => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; setIsDragOver(false); } };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'dng'];
      const audioExts = ['mp3', 'wav', 'm4a'];
      const newItems: IngestItem[] = [];

      // Helper for quick heuristics
      // HTML5 file gives us size, type, and lastModified
      let lastTime = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let type: 'image' | 'audio' | null = null;
        if (imageExts.includes(ext)) type = 'image';
        else if (audioExts.includes(ext)) type = 'audio';
        
        if (type) {
          let status: 'approved' | 'rejected' = 'approved';
          let reason: string | undefined = undefined;

          // Heuristic 1: Extremely small file (e.g. < 50KB) - likely useless icon or placeholder
          if (file.size < 50 * 1024 && type === 'image') {
            status = 'rejected';
            reason = '体积过小 (疑为废图或图标)';
          }

          // Heuristic 2: Burst duplicate detection
          // If photos are taken within 500ms of each other, it's a burst.
          // Note: macOS often assigns rapid exact same lastModified to screenshots.
          if (type === 'image' && file.lastModified) {
            const timeDiff = Math.abs(file.lastModified - lastTime);
            if (timeDiff < 600 && lastTime !== 0) {
              status = 'rejected';
              reason = '连拍冗余或同时生成';
            }
            lastTime = file.lastModified;
          }

          // Heuristic 3: Screenshot name guessing (macOS/Windows)
          if (file.name.includes('截屏') || file.name.includes('Screenshot') || file.name.includes('Screen Shot')) {
            status = 'rejected';
            reason = '疑为截屏画面 (根据名称特征)';
          }

          newItems.push({
            id: `res_drop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            path: (file as any).path || file.name, // Tauri 提供 path
            type,
            status,
            reason,
            originalIndex: i,
            lastModified: file.lastModified,
            size: file.size
          });
        }
      }

      if (newItems.length > 0) {
        setIngestQueue(prev => [...prev, ...newItems]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [setIsDragOver, setIngestQueue, setStatusMsg]);
}
