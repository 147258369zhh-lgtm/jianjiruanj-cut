import { useCallback, useRef, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent, RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { TimelineItem } from '../types';

interface UseTimelineActionsArgs {
  pps: number;
  ppsRef: MutableRefObject<number>;
  setPps: Dispatch<SetStateAction<number>>;
  
  timeline: TimelineItem[];
  timelineRef: MutableRefObject<TimelineItem[]>;
  setTimeline: Dispatch<SetStateAction<TimelineItem[]>>;
  
  playheadRef: RefObject<HTMLDivElement | null>;
  timelineScrollRef: RefObject<HTMLDivElement | null>;
  
  setPlayTime: Dispatch<SetStateAction<number>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setIsJumping: (b: boolean) => void;
  
  isDraggingHead: boolean;
  setIsDraggingHead: (b: boolean) => void;
  
  selectionBox: { x1: number, x2: number, y: number, h: number } | null | any;
  setSelectionBox: Dispatch<SetStateAction<any>>;
  
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedAudioIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedVoiceoverIds: Dispatch<SetStateAction<Set<string>>>;
  
  commitSnapshotNow: () => void;
  setContextMenu: Dispatch<SetStateAction<any>>;
}

export function useTimelineActions({
  pps, ppsRef, setPps,
  timeline, timelineRef, setTimeline,
  playheadRef, timelineScrollRef,
  setPlayTime, setIsPlaying, setIsJumping,
  isDraggingHead, setIsDraggingHead,
  selectionBox, setSelectionBox,
  selectedIds, setSelectedIds, setSelectedAudioIds, setSelectedVoiceoverIds,
  commitSnapshotNow, setContextMenu
}: UseTimelineActionsArgs) {

  const lastScrubTimeRef = useRef<number>(0);

  const handleTimelineWheel = useCallback((e: ReactWheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -4 : 4;
      setPps(prev => Math.max(8, Math.min(120, prev + delta)));
    }
  }, [setPps]);

  const seekToX = useCallback((clientX: number) => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rawX = clientX - rect.left + el.scrollLeft - 60;
    
    const targetTime = Math.max(0, rawX / ppsRef.current);
    const maxT = timelineRef.current.reduce((s, t) => s + t.duration, 0);
    const finalTime = Math.max(0, Math.min(targetTime, maxT + 5));

    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${60 + finalTime * ppsRef.current}px)`;
    }

    const now = Date.now();
    if (now - lastScrubTimeRef.current > 32 || finalTime === 0 || finalTime === maxT + 5) {
      lastScrubTimeRef.current = now;
      setPlayTime(finalTime);
    }
  }, [ppsRef, timelineRef, timelineScrollRef, playheadRef, setPlayTime]);

  const handleTimelineMouseMove = useCallback((e: ReactMouseEvent) => {
    if (isDraggingHead) {
      seekToX(e.clientX);
    } else if (selectionBox) {
      const rect = timelineScrollRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX = e.clientX - rect.left + timelineScrollRef.current!.scrollLeft;
        setSelectionBox((prev: any) => prev ? { ...prev, x2: currentX } : null);
      }
    }
  }, [isDraggingHead, seekToX, selectionBox, timelineScrollRef, setSelectionBox]);

  const handleTimelineMouseUp = useCallback((e: ReactMouseEvent) => {
    if (isDraggingHead) setIsDraggingHead(false);
    if (selectionBox) {
      const xStart = Math.min(selectionBox.x1, selectionBox.x2) - 60;
      const xEnd = Math.max(selectionBox.x1, selectionBox.x2) - 60;

      const newlySelected = new Set(e.ctrlKey ? selectedIds : []);
      let currentAcc = 0;
      timeline.forEach(item => {
        const itemStart = currentAcc * pps;
        const itemEnd = (currentAcc + item.duration) * pps;
        if (!(itemEnd < xStart || itemStart > xEnd)) {
          newlySelected.add(item.id);
        }
        currentAcc += item.duration;
      });
      setSelectedIds(newlySelected);
      setSelectionBox(null);
    }
  }, [isDraggingHead, setIsDraggingHead, selectionBox, selectedIds, timeline, pps, setSelectedIds, setSelectionBox]);

  const handleTimelineSelect = useCallback((id: string, isCtrl: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isCtrl) { if (next.has(id)) next.delete(id); else next.add(id); }
      else { next.clear(); next.add(id); }
      return next;
    });
    setSelectedAudioIds(new Set()); setSelectedVoiceoverIds(new Set());
    
    if (!isCtrl) {
      setIsPlaying(false);
      const tl = timelineRef.current;
      let startTime = 0;
      for (const t of tl) {
        if (t.id === id) break;
        startTime += t.duration;
      }
      setPlayTime(startTime);
      setIsJumping(true);
      setTimeout(() => setIsJumping(false), 350);
      
      const scrollEl = timelineScrollRef.current;
      if (scrollEl) {
        let accX = 0;
        for (let i = 0; i < tl.length; i++) {
          if (tl[i].id === id) break;
          accX += tl[i].duration * ppsRef.current;
        }
        scrollEl.scrollTo({ left: Math.max(0, accX - scrollEl.clientWidth / 3), behavior: 'smooth' });
      }
    }
  }, [setSelectedIds, setSelectedAudioIds, setSelectedVoiceoverIds, setIsPlaying, timelineRef, setPlayTime, setIsJumping, timelineScrollRef, ppsRef]);

  const handleTimelineRemove = useCallback((id: string) => {
    commitSnapshotNow();
    setTimeline(p => p.filter(t => t.id !== id));
    setSelectedIds((prev: Set<string>) => { const n = new Set(prev); n.delete(id); return n; });
  }, [commitSnapshotNow, setTimeline, setSelectedIds]);

  const handleTimelineTrim = useCallback((id: string, delta: number) => {
    commitSnapshotNow();
    setTimeline(p => p.map(t => t.id === id ? { ...t, duration: Math.max(0.3, t.duration + delta) } : t));
  }, [commitSnapshotNow, setTimeline]);

  const handleTimelineContextMenu = useCallback((e: ReactMouseEvent, id: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'image', targetId: id });
  }, [setContextMenu]);

  const handleAudioSelect = useCallback((id: string, isCtrl: boolean) => {
    setSelectedAudioIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (isCtrl) { if (next.has(id)) next.delete(id); else next.add(id); }
      else { next.clear(); next.add(id); }
      return next;
    });
    setSelectedIds(new Set());
  }, [setSelectedAudioIds, setSelectedIds]);

  const handleTimelineDoubleClick = useCallback((id: string) => {
    const tl = timelineRef.current;
    let startTime = 0;
    for (const t of tl) { if (t.id === id) break; startTime += t.duration; }
    setPlayTime(startTime);
    setIsPlaying(false);
    setIsJumping(true);
    setTimeout(() => setIsJumping(false), 350);
    const scrollEl = timelineScrollRef.current;
    if (scrollEl) {
      let accX = 0;
      for (let i = 0; i < tl.length; i++) {
        if (tl[i].id === id) break;
        accX += tl[i].duration * ppsRef.current;
      }
      scrollEl.scrollTo({ left: Math.max(0, accX - scrollEl.clientWidth / 3), behavior: 'smooth' });
    }
  }, [timelineRef, setPlayTime, setIsPlaying, setIsJumping, timelineScrollRef, ppsRef]);

  return {
    handleTimelineWheel,
    seekToX,
    handleTimelineMouseMove,
    handleTimelineMouseUp,
    handleTimelineSelect,
    handleTimelineRemove,
    handleTimelineTrim,
    handleTimelineContextMenu,
    handleAudioSelect,
    handleTimelineDoubleClick
  };
}
