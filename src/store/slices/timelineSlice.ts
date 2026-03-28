import { StateCreator } from 'zustand';
import type { TimelineItem } from '../../types';

export interface TimelineSlice {
  timeline: TimelineItem[];
  selectedIds: Set<string>;
  selectedTextIds: Set<string>;
  pps: number; // pixels per second
  
  setTimeline: (updater: TimelineItem[] | ((prev: TimelineItem[]) => TimelineItem[])) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setSelectedTextIds: (ids: Set<string>) => void;
  setPps: (updater: number | ((prev: number) => number)) => void;
}

export const createTimelineSlice: StateCreator<TimelineSlice> = (set) => ({
  timeline: [],
  selectedIds: new Set(),
  selectedTextIds: new Set(),
  pps: 24,
  
  setTimeline: (updater) => set((state) => ({
    timeline: typeof updater === 'function' ? updater(state.timeline) : updater
  })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setSelectedTextIds: (ids) => set({ selectedTextIds: ids }),
  setPps: (updater) => set((state) => ({
    pps: typeof updater === 'function' ? updater(state.pps) : updater
  })),
});
