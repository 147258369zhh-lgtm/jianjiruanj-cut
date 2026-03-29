import { useEffect } from 'react';
import { Resource } from '../types';

interface UseDragImportArgs {
  setIsDragOver: (isOver: boolean) => void;
  setResources: (fn: (prev: Resource[]) => Resource[]) => void;
  setStatusMsg: (msg: string) => void;
}

export function useDragImport({
  setIsDragOver,
  setResources,
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
      const newResources: Resource[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let type: 'image' | 'audio' | null = null;
        if (imageExts.includes(ext)) type = 'image';
        else if (audioExts.includes(ext)) type = 'audio';
        if (type) {
          newResources.push({
            id: `res_drop_${Date.now()}_${i}`,
            name: file.name,
            path: (file as any).path || file.name, // Tauri 提供 path
            type,
          });
        }
      }

      if (newResources.length > 0) {
        setResources(prev => [...prev, ...newResources]);
        setStatusMsg(`📥 已导入 ${newResources.length} 个素材文件`);
        setTimeout(() => setStatusMsg(''), 2000);
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
  }, [setIsDragOver, setResources, setStatusMsg]);
}
