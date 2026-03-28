import { StateCreator } from 'zustand';
import type { Resource } from '../../types';

export interface ResourceSlice {
  resources: Resource[];
  previewCache: Record<string, string>;
  searchQuery: string;
  selectedResourceIds: Set<string>;
  
  setResources: (updater: Resource[] | ((prev: Resource[]) => Resource[])) => void;
  setPreviewCache: (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setSearchQuery: (q: string) => void;
  setSelectedResourceIds: (ids: Set<string>) => void;
}

export const createResourceSlice: StateCreator<ResourceSlice> = (set) => ({
  resources: [
    { id: 'lib_aud_1', name: '🎵 宁静心境 (Please Calm My Mind)', path: '/audio/please-calm-my-mind.mp3', type: 'audio' },
    { id: 'lib_aud_2', name: '🎹 遗忘的华尔兹 (Forgotten Waltz)', path: '/audio/forgotten-waltz.mp3', type: 'audio' },
    { id: 'lib_aud_3', name: '🌿 钢琴小品 (Piano Music)', path: '/audio/piano-music.mp3', type: 'audio' },
    { id: 'lib_aud_4', name: '✨ 温柔恬静 (Calm Soft)', path: '/audio/calm-soft.mp3', type: 'audio' },
    { id: 'lib_aud_5', name: '🌊 柔和背景 (Background Soft Calm)', path: '/audio/background-soft-calm.mp3', type: 'audio' },
  ],
  previewCache: {},
  searchQuery: '',
  selectedResourceIds: new Set(),
  
  setResources: (updater) => set((state) => ({
    resources: typeof updater === 'function' ? updater(state.resources) : updater
  })),
  setPreviewCache: (updater) => set((state) => ({
    previewCache: typeof updater === 'function' ? updater(state.previewCache) : updater
  })),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedResourceIds: (ids) => set({ selectedResourceIds: ids }),
});
