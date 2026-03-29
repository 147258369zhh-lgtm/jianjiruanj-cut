import { useCallback, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Resource, TimelineItem, AudioTimelineItem, GlobalDefaults, ANIMATION_PRESETS } from '../types';
import { getMediaDuration } from '../utils/mediaUtils';
import { thumbCache } from '../utils/thumbnail';

export interface UseResourceManagerArgs {
  resourceMap: Map<string, Resource>;
  previewCache: { [path: string]: string };
  setPreviewCache: Dispatch<SetStateAction<{ [path: string]: string }>>;
  setStatusMsg: (msg: string) => void;
  setResources: Dispatch<SetStateAction<Resource[]>>;
  setLibTab: (tab: 'image' | 'audio' | 'video') => void;
  faceWorkerRef: MutableRefObject<Worker | null>;
  resourcesRef: MutableRefObject<Resource[]>;
  setAudioBlobs: Dispatch<SetStateAction<{ [id: string]: string }>>;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  selectedResourceIds: Set<string>;
  setAudioItems: Dispatch<SetStateAction<AudioTimelineItem[]>>;
  setSelectedResourceIds: (ids: Set<string>) => void;
  setMonitorRes: (res: Resource | null) => void;
  globalDefaultsRef: MutableRefObject<GlobalDefaults>;
  playTimeRef: MutableRefObject<number>;
}

export function useResourceManager({
  resourceMap, previewCache, setPreviewCache, setStatusMsg,
  setResources, setLibTab, faceWorkerRef, resourcesRef,
  setAudioBlobs, setTimeline, setAudioItems, selectedResourceIds, setSelectedResourceIds,
  setMonitorRes, globalDefaultsRef, playTimeRef
}: UseResourceManagerArgs) {

  const handleImport = async (type: 'image' | 'audio' | 'video') => {
    const selected = await open({
      multiple: true,
      filters: [{
        name: type === 'image' ? '图片' : type === 'video' ? '视频' : '音频',
        extensions: type === 'image' ? ['png', 'jpg', 'jpeg', 'webp', 'dng', 'DNG'] : type === 'video' ? ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'] : ['mp3', 'wav', 'm4a']
      }]
    });
    if (selected && Array.isArray(selected)) {
      const newResources: Resource[] = (selected as any[]).map(rawSelected => {
        const path = typeof rawSelected === 'string' ? rawSelected : rawSelected.path;
        const id = `res_${Date.now()}_${Math.random()}`;
        
        if (type === 'image') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = async () => {
            try {
              const bitmap = await createImageBitmap(img);
              faceWorkerRef.current?.postMessage({
                id,
                imageBitmap: bitmap,
                width: img.naturalWidth,
                height: img.naturalHeight
              }, [bitmap]);
            } catch (err) { console.error('Face detection task dispatch failed', err); }
          };
          img.src = convertFileSrc(path);
        }

        return { id, name: path.split(/[\\/]/).pop() || '', path, type };
      });
      setResources((prev: Resource[]) => [...prev, ...newResources]);
      setLibTab(type === 'image' ? 'image' : type === 'video' ? 'video' : 'audio');
      setStatusMsg(`🎉 素材处理完成 (${newResources.length}项)`);
      setTimeout(() => setStatusMsg(''), 2000);
    }
  };

  const handleRevealInExplorer = async (resourceId: string) => {
    const res = resourceMap.get(resourceId);
    if (!res) return;
    try {
      const targetPath = previewCache[res.path] || res.path;
      await invoke('reveal_in_explorer', { path: targetPath });
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertDNG = async (resourceId: string) => {
    const res = resourceMap.get(resourceId);
    if (!res) return;

    try {
      setStatusMsg(`正在转换 DNG: ${res.name}...`);
      const normalizedPath = await invoke<string>('normalize_image', { path: res.path });

      setPreviewCache((prev: any) => ({ ...prev, [res.path]: normalizedPath }));
      setStatusMsg("✨ DNG 转换成功 (已开启 AWB 算法)");

      if (normalizedPath && normalizedPath !== res.path) {
        setResources((prev: Resource[]) => prev.map(r => r.id === resourceId ? { ...r, path: normalizedPath } : r));
        setStatusMsg(`🎉 ${res.name} 已更新为转换后的文件`);
      }
    } catch (e: any) {
      console.error('DNG conversion failed:', e);
      setStatusMsg(`❌ 转换失败: ${String(e).slice(0, 50)}`);
    } finally {
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const removeFromLibrary = useCallback((id: string | Set<string>) => {
    const ids = typeof id === 'string' ? new Set([id]) : id;
    
    const toRemove = resourcesRef.current.filter(r => ids.has(r.id));
    toRemove.forEach(r => {
      let src = previewCache[r.path] || r.path;
      if (src && !src.startsWith('http') && !src.startsWith('blob:') && !src.startsWith('/')) src = convertFileSrc(src);
      if (thumbCache.has(src)) {
        const cachedUrl = thumbCache.get(src);
        if (cachedUrl && cachedUrl.startsWith('blob:')) URL.revokeObjectURL(cachedUrl);
        thumbCache.delete(src);
      }
      if (r.type === 'audio') {
         setAudioBlobs((prev: any) => {
            const next = {...prev};
            const blobUrl = next[r.id];
            if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
            delete next[r.id];
            return next;
         });
      }
    });

    setResources((prev: Resource[]) => prev.filter(r => !ids.has(r.id)));
    setTimeline((prev: TimelineItem[]) => prev.filter(t => !ids.has(t.resourceId)));
    setAudioItems((prev: AudioTimelineItem[]) => prev.filter(a => !ids.has(a.resourceId)));
    setSelectedResourceIds(new Set());
  }, [previewCache, resourcesRef, setAudioBlobs, setResources, setTimeline, setAudioItems, setSelectedResourceIds]);

  const handleLibToggle = useCallback((id: string) => {
    const n = new Set(selectedResourceIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedResourceIds(n);
  }, [selectedResourceIds, setSelectedResourceIds]);

  const handleLibSelectPreview = useCallback((r: Resource) => setMonitorRes(r), [setMonitorRes]);

  const handleLibAdd = useCallback(async (r: Resource) => {
    const pt = playTimeRef.current;
    
    if (r.type === 'image' || r.type === 'video') {
      let fileDur = 3;
      if (r.type === 'video') {
        fileDur = await getMediaDuration(r.path);
      }
      
      const gd = globalDefaultsRef.current;
      const isRandom = gd.animation === 'random';
      const anim = isRandom ? ANIMATION_PRESETS[Math.floor(Math.random() * ANIMATION_PRESETS.length)] : gd.animation;
      const overrides = isRandom ? ['animation'] : [];
      
      const newItem = {
        id: `tm_${Date.now()}_${Math.random()}`, resourceId: r.id, 
        duration: r.type === 'video' ? fileDur : gd.duration, transition: gd.transition, 
        rotation: gd.rotation, contrast: gd.contrast, saturation: gd.saturation, 
        exposure: gd.exposure, brilliance: gd.brilliance, temp: gd.temp, tint: gd.tint, zoom: gd.zoom,
        highlights: gd.highlights, shadows: gd.shadows, whites: gd.whites, blacks: gd.blacks, vibrance: gd.vibrance,
        sharpness: gd.sharpness, fade: gd.fade, vignette: gd.vignette, grain: gd.grain,
        animation: anim as any, overrides, fontSize: 24, fontWeight: 'normal'
      };
      
      setTimeline((p: TimelineItem[]) => {
        let insertIndex = p.length;
        let sum = 0;
        for (let i = 0; i < p.length; i++) {
          const nextSum = sum + p[i].duration;
          if (pt >= sum && pt <= nextSum) {
            const distStart = pt - sum;
            const distEnd = nextSum - pt;
            insertIndex = distStart < distEnd ? i : i + 1;
            break;
          }
          sum = nextSum;
        }
        if (insertIndex === p.length && pt < sum) insertIndex = p.length;
        const newP = [...p];
        newP.splice(insertIndex, 0, newItem);
        return newP;
      });
    } else {
      const dur = await getMediaDuration(r.path);
      setAudioItems((prev: AudioTimelineItem[]) => {
        // 如果音频轨为空，默认从0开始；否则从播放头位置插入
        const startPos = prev.length === 0 ? 0 : pt;
        return [...prev, { id: `au_${Date.now()}`, resourceId: r.id, timelineStart: startPos, startOffset: 0, duration: dur, volume: 1.0 }];
      });
    }
  }, [globalDefaultsRef, setTimeline, setAudioItems, playTimeRef]);

  return {
    handleImport,
    handleRevealInExplorer,
    handleConvertDNG,
    removeFromLibrary,
    handleLibToggle,
    handleLibSelectPreview,
    handleLibAdd
  };
}
