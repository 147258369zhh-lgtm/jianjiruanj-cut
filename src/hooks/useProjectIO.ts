import { useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Resource, TimelineItem, AudioTimelineItem } from '../types';

interface UseProjectIOArgs {
  resourcesRef: MutableRefObject<Resource[]>;
  timelineRef: MutableRefObject<TimelineItem[]>;
  audioItemsRef: MutableRefObject<AudioTimelineItem[]>;
  ppsRef: MutableRefObject<number>;
  setResources: (refs: Resource[]) => void;
  setTimeline: (tl: TimelineItem[]) => void;
  setAudioItems: (ai: AudioTimelineItem[]) => void;
  setPps: (pps: number) => void;
  setStatusMsg: (msg: string) => void;
  // Triggered by manual load/save to clear the "dirty" autosave recovery flag
  onClearAutosaveFlag?: () => void;
}

export function useProjectIO({
  resourcesRef, timelineRef, audioItemsRef, ppsRef,
  setResources, setTimeline, setAudioItems, setPps,
  setStatusMsg, onClearAutosaveFlag
}: UseProjectIOArgs) {

  const saveProject = useCallback(async () => {
    const projectData = JSON.stringify({
      resources: resourcesRef.current,
      timeline: timelineRef.current,
      audioItems: audioItemsRef.current,
      pps: ppsRef.current
    }, null, 2);
    const outputPath = await save({ filters: [{ name: '工程文件', extensions: ['proj.json'] }] });
    if (!outputPath) return;
    try {
      await invoke('write_file', { path: outputPath, content: projectData });
      setStatusMsg('💾 工程已保存'); 
      setTimeout(() => setStatusMsg(''), 2000);
      if (onClearAutosaveFlag) onClearAutosaveFlag(); // 保存成功后不再提示异常恢复
      localStorage.removeItem('__editor_autosave_v2__'); 
    } catch {
      localStorage.setItem('__editor_project__', projectData);
      setStatusMsg('💾 工程已保存到本地缓存'); setTimeout(() => setStatusMsg(''), 2000);
    }
  }, [resourcesRef, timelineRef, audioItemsRef, ppsRef, setStatusMsg, onClearAutosaveFlag]);

  const loadProject = useCallback(async () => {
    const selected = await open({ filters: [{ name: '工程文件', extensions: ['proj.json', 'json'] }] });
    if (!selected) return;
    try {
      const path = typeof selected === 'string' ? selected : (selected as any).path;
      const content = await invoke<string>('read_file', { path });
      const data = JSON.parse(content);
      if (data.resources) setResources(data.resources);
      if (data.timeline) setTimeline(data.timeline);
      if (data.audioItems) setAudioItems(data.audioItems);
      if (data.pps) setPps(data.pps);
      setStatusMsg('📂 工程已加载'); 
      setTimeout(() => setStatusMsg(''), 2000);
      if (onClearAutosaveFlag) onClearAutosaveFlag();
      localStorage.removeItem('__editor_autosave_v2__'); 
    } catch {
      setStatusMsg('❌ 加载失败'); setTimeout(() => setStatusMsg(''), 2000);
    }
  }, [setResources, setTimeline, setAudioItems, setPps, setStatusMsg, onClearAutosaveFlag]);

  // ─── 新版安全气囊：智能差量自动保存 ───
  const lastSavedHash = useRef<string>('');
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 采用 2 秒防抖静默保存，不占用每一帧的硬盘 I/O
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    
    autosaveTimeout.current = setTimeout(() => {
      // 没有任何实质轨道内容时不保存空快照
      if (timelineRef.current.length === 0 && audioItemsRef.current.length === 0) return;

      const snapshot = JSON.stringify({
        resources: resourcesRef.current,
        timeline: timelineRef.current,
        audioItems: audioItemsRef.current,
        pps: ppsRef.current,
        timestamp: Date.now()
      });

      // 计算内容 Hash，如果内容没变（除了时间戳）说明没有真正的 UI 变更，则不覆写
      const hashData = JSON.stringify({ t: timelineRef.current, a: audioItemsRef.current, r: resourcesRef.current });
      if (lastSavedHash.current === hashData) return;

      try {
        localStorage.setItem('__editor_autosave_v2__', snapshot);
        lastSavedHash.current = hashData;
      } catch (e) {
        console.warn('Auto-save failed: LS full');
      }
    }, 2000);

    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    };
  }, [timelineRef.current, audioItemsRef.current, resourcesRef.current]); // 仅当依赖变化时才走一遍防抖

  return { saveProject, loadProject };
}
