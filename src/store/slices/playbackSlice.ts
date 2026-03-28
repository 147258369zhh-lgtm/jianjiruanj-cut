import { StateCreator } from 'zustand';

export interface PlaybackSlice {
  isPlaying: boolean;
  playTime: number;
  playbackSpeed: number;
  
  setIsPlaying: (v: boolean) => void;
  setPlayTime: (v: number) => void;
  setPlaybackSpeed: (v: number) => void;
  togglePlay: () => void;
}

export const createPlaybackSlice: StateCreator<PlaybackSlice> = (set) => ({
  isPlaying: false,
  playTime: 0,
  playbackSpeed: 1.0,
  
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlayTime: (v) => set({ playTime: v }),
  setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
  togglePlay: () => set((state) => {
    const next = !state.isPlaying;
    return { isPlaying: next };
  }),
});
