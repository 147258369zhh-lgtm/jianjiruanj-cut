import { useEffect, useMemo, MutableRefObject } from 'react';
import { TimelineItem, AudioTimelineItem } from '../types';
import { formatTime as formatTimeMod } from '../utils/formatTime';
import { TimelineLayout, timeToX } from '../utils/timelineLayout';

export interface PlaybackEngineRefs {
  timelineRef: MutableRefObject<TimelineItem[]>;
  audioItemsRef: MutableRefObject<AudioTimelineItem[]>;
  ppsRef: MutableRefObject<number>;
  playheadRef: MutableRefObject<HTMLDivElement | null>;
  timelineScrollRef: MutableRefObject<HTMLDivElement | null>;
  timeTextRef: MutableRefObject<HTMLSpanElement | null>;
  playTimeRef: MutableRefObject<number>;
  lastSyncTimeRef: MutableRefObject<number>;
  clickTimesRef: MutableRefObject<number[]>;
  voiceoverClipsRef: MutableRefObject<any[]>;
}

interface UsePlaybackEngineArgs {
  isPlaying: boolean;
  playbackSpeed: number;
  playTime: number;
  timeline: TimelineItem[];
  audioItems: AudioTimelineItem[];
  voiceoverClips: any[];
  pps: number;
  setPlayTime: (t: number) => void;
  setIsPlaying: (v: boolean) => void;
  setStatusMsg: (msg: string) => void;
  layout: TimelineLayout;
  refs: PlaybackEngineRefs;
}

export function usePlaybackEngine({
  isPlaying, playbackSpeed, playTime, timeline, audioItems, voiceoverClips, pps,
  setPlayTime, setIsPlaying, setStatusMsg,
  layout, refs
}: UsePlaybackEngineArgs) {
  const {
    timelineRef, audioItemsRef, ppsRef,
    playheadRef, timelineScrollRef, timeTextRef,
    playTimeRef, lastSyncTimeRef, clickTimesRef
  } = refs;

  // ─── 核心：高性能播放引擎 (RequestAnimationFrame + DOM 直操作) ───
  useEffect(() => {
    if (!isPlaying) return;

    let rafId: number;
    const startTs = performance.now();
    const baseTime = playTimeRef.current;

    let lastActiveItemId: string | null = null;

    const tick = () => {
      const tl = timelineRef.current;
      const currentPps = ppsRef.current;
      const elapsed = (performance.now() - startTs) / 1000 * playbackSpeed;
      const currentT = baseTime + elapsed;

      const maxAudio = audioItemsRef.current.length > 0
        ? Math.max(...audioItemsRef.current.map((a: AudioTimelineItem) => a.timelineStart + a.duration))
        : 0;
      const maxVoiceover = refs.voiceoverClipsRef.current.length > 0
        ? Math.max(...refs.voiceoverClipsRef.current.map((v: any) => v.timelineStart + v.duration))
        : 0;
      const maxT = tl.reduce((s: number, t: TimelineItem) => s + t.duration, 0);
      const maxPt = Math.max(maxT, maxAudio, maxVoiceover) + 0.01;

      if (maxPt <= 0.05) {
        setPlayTime(0);
        setIsPlaying(false);
        return;
      }

      if (currentT >= maxPt) {
        setPlayTime(maxPt);
        setIsPlaying(false);
        return;
      }

      let currentActiveItemId: string | null = null;

      // 直接操作 DOM，绕过 React 重绘
      if (playheadRef.current) {
        const headX = timeToX(currentT, layout, currentPps);
        playheadRef.current.style.transform = `translateX(${headX}px)`;

        const scrollEl = timelineScrollRef.current;
        if (scrollEl) {
          const viewLeft = scrollEl.scrollLeft;
          const viewRight = viewLeft + scrollEl.clientWidth;
          if (headX > viewRight - 100) {
            scrollEl.scrollLeft = headX - scrollEl.clientWidth / 2;
          } else if (headX < viewLeft + 60) {
            scrollEl.scrollLeft = Math.max(0, headX - 100);
          }
        }
      }

      if (timeTextRef.current) {
        timeTextRef.current.textContent = formatTimeMod(currentT);
      }

      playTimeRef.current = currentT;

      const boundaryCrossed = lastActiveItemId !== null && lastActiveItemId !== currentActiveItemId;
      lastActiveItemId = currentActiveItemId;

      if (boundaryCrossed || performance.now() - lastSyncTimeRef.current > 1000) {
        setPlayTime(currentT);
        lastSyncTimeRef.current = performance.now();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      const finalElapsed = (performance.now() - startTs) / 1000;
      setPlayTime(baseTime + finalElapsed * playbackSpeed);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackSpeed]);

  // 计算整个工程的物理最远时间点
  const maxPlayTime = useMemo(() => {
    const maxT = timeline.length > 0 ? timeline.reduce((acc, t) => acc + t.duration, 0) : 0;
    const maxA = audioItems.length > 0 ? Math.max(...audioItems.map(a => a.timelineStart + a.duration)) : 0;
    const maxV = voiceoverClips.length > 0 ? Math.max(...voiceoverClips.map(v => v.timelineStart + v.duration)) : 0;
    return Math.max(maxT, maxA, maxV) + 0.01;
  }, [timeline, audioItems, voiceoverClips]);

  // 精确计算 playLine 的左边距
  const playLineLeft = useMemo(() => {
    return timeToX(playTime, layout, pps);
  }, [playTime, layout, pps]);

  // 三连击检测算法
  const handleTripleClickZone = () => {
    const now = Date.now();
    clickTimesRef.current.push(now);

    if (clickTimesRef.current.length > 3) {
      clickTimesRef.current.shift();
    }

    if (clickTimesRef.current.length === 3) {
      const duration = clickTimesRef.current[2] - clickTimesRef.current[0];
      if (duration < 500) {
        setPlayTime(0);
        setIsPlaying(false);
        setStatusMsg(' ⚡ 三击重置，指针归零');
        setTimeout(() => setStatusMsg(''), 1500);
        clickTimesRef.current = [];
      }
    }
  };

  const togglePlay = () => {
    const nextState = !isPlaying;
    if (nextState) setStatusMsg("");
    setIsPlaying(nextState);
  };

  return { maxPlayTime, playLineLeft, handleTripleClickZone, togglePlay };
}
