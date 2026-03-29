import { useEffect, MutableRefObject } from 'react';
import { TimelineItem, AudioTimelineItem } from '../types';

interface UseKeyboardShortcutsArgs {
  setIsPlaying: (fn: (prev: boolean) => boolean) => void;
  setPlayTime: (time: number | ((prev: number) => number)) => void;
  selectedIdsRef: MutableRefObject<Set<string>>;
  selectedAudioIdsRef: MutableRefObject<Set<string>>;
  selectedVoiceoverIdsRef: MutableRefObject<Set<string>>;
  timelineRef: MutableRefObject<TimelineItem[]>;
  commitSnapshotNow: () => void;
  setTimeline: (fn: (prev: TimelineItem[]) => TimelineItem[]) => void;
  setAudioItems: (fn: (prev: AudioTimelineItem[]) => AudioTimelineItem[]) => void;
  setVoiceoverClips: (fn: (prev: any[]) => any[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setSelectedAudioIds: (ids: Set<string>) => void;
  setSelectedVoiceoverIds: (ids: Set<string>) => void;
  undo: () => void;
  redo: () => void;
  saveProject: () => void;
  loadProject: () => void;
  splitAtPlayhead: () => void;
  setShowShortcuts: (fn: (prev: boolean) => boolean) => void;
}

export function useKeyboardShortcuts({
  setIsPlaying, setPlayTime,
  selectedIdsRef, selectedAudioIdsRef, selectedVoiceoverIdsRef, timelineRef,
  commitSnapshotNow, setTimeline, setAudioItems, setVoiceoverClips,
  setSelectedIds, setSelectedAudioIds, setSelectedVoiceoverIds,
  undo, redo, saveProject, loadProject, splitAtPlayhead,
  setShowShortcuts
}: UseKeyboardShortcutsArgs) {

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
        return;
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        if (selectedIdsRef.current.size > 0) {
          commitSnapshotNow();
          setTimeline(p => p.filter(t => !selectedIdsRef.current.has(t.id)));
          setSelectedIds(new Set());
        }
        if (selectedAudioIdsRef.current.size > 0) {
          commitSnapshotNow();
          setAudioItems(p => p.filter(a => !selectedAudioIdsRef.current.has(a.id)));
          setSelectedAudioIds(new Set()); 
        }
        if (selectedVoiceoverIdsRef.current.size > 0) {
          commitSnapshotNow();
          setVoiceoverClips(p => p.filter(a => !selectedVoiceoverIdsRef.current.has(a.id)));
          setSelectedVoiceoverIds(new Set());
        }
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        const delta = e.code === 'ArrowLeft' ? -step : step;
        setPlayTime(prev => Math.max(0, prev + delta));
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (e.code === 'KeyY') { e.preventDefault(); redo(); return; }
        if (e.code === 'KeyA') { e.preventDefault(); setSelectedIds(new Set(timelineRef.current.map(t => t.id))); return; }
        if (e.code === 'KeyS') { e.preventDefault(); saveProject(); return; }
        if (e.code === 'KeyO') { e.preventDefault(); loadProject(); return; }
        if (e.code === 'KeyB') { e.preventDefault(); splitAtPlayhead(); return; }
      }

      // Home/End 跳转时间轴开头/末尾
      if (e.code === 'Home') { e.preventDefault(); setPlayTime(0); return; }
      if (e.code === 'End') {
        e.preventDefault();
        const total = timelineRef.current.reduce((s, t) => s + t.duration, 0);
        setPlayTime(total); return;
      }

      // [ / ] 调整选中项时长
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          const delta = e.code === 'BracketLeft' ? -0.5 : 0.5;
          commitSnapshotNow();
          setTimeline(p => p.map(t => selectedIdsRef.current.has(t.id) ? { ...t, duration: Math.max(0.3, t.duration + delta) } : t));
          return;
        }
      }

      // ? = 快捷键提示面板
      if (e.key === '?' || e.code === 'Slash') {
        setShowShortcuts(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setIsPlaying, setPlayTime, selectedIdsRef, selectedAudioIdsRef, selectedVoiceoverIdsRef,
    timelineRef, commitSnapshotNow, setTimeline, setAudioItems, setVoiceoverClips, setSelectedIds,
    setSelectedAudioIds, setSelectedVoiceoverIds, undo, redo, saveProject, loadProject,
    splitAtPlayhead, setShowShortcuts
  ]);
}
