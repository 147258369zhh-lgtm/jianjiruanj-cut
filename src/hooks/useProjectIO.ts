import { useEffect, useCallback, MutableRefObject } from 'react';
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
}

export function useProjectIO({
  resourcesRef, timelineRef, audioItemsRef, ppsRef,
  setResources, setTimeline, setAudioItems, setPps,
  setStatusMsg
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
      setStatusMsg('💾 工程已保存'); setTimeout(() => setStatusMsg(''), 2000);
    } catch {
      localStorage.setItem('__editor_project__', projectData);
      setStatusMsg('💾 工程已保存到本地缓存'); setTimeout(() => setStatusMsg(''), 2000);
    }
  }, [resourcesRef, timelineRef, audioItemsRef, ppsRef, setStatusMsg]);

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
      setStatusMsg('📂 工程已加载'); setTimeout(() => setStatusMsg(''), 2000);
    } catch {
      const cached = localStorage.getItem('__editor_project__');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.resources) setResources(data.resources);
        if (data.timeline) setTimeline(data.timeline);
        if (data.audioItems) setAudioItems(data.audioItems);
        if (data.pps) setPps(data.pps);
        setStatusMsg('📂 已从本地缓存恢复'); setTimeout(() => setStatusMsg(''), 2000);
      } else {
        setStatusMsg('❌ 加载失败'); setTimeout(() => setStatusMsg(''), 2000);
      }
    }
  }, [setResources, setTimeline, setAudioItems, setPps, setStatusMsg]);

  // ─── 自动保存 (每60秒) ───
  useEffect(() => {
    const timer = setInterval(() => {
      if (timelineRef.current.length > 0 || audioItemsRef.current.length > 0) {
        localStorage.setItem('__editor_autosave__', JSON.stringify({
          resources: resourcesRef.current,
          timeline: timelineRef.current,
          audioItems: audioItemsRef.current,
          pps: ppsRef.current
        }));
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [timelineRef, audioItemsRef, resourcesRef, ppsRef]);

  // 启动时检查自动保存
  useEffect(() => {
    const saved = localStorage.getItem('__editor_autosave__');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.timeline?.length > 0 || data.audioItems?.length > 0) {
          setStatusMsg('💡 发现自动保存数据 (上次会话)');
        }
      } catch { /* ignore */ }
    }
  }, [setStatusMsg]);

  return { saveProject, loadProject };
}
