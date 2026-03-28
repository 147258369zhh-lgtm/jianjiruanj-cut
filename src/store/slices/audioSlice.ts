import { StateCreator } from 'zustand';
import type { AudioTimelineItem } from '../../types';

export interface AudioSlice {
  audioItems: AudioTimelineItem[];
  voiceoverClips: any[];
  audioBlobs: Record<string, string>;
  selectedAudioIds: Set<string>;
  selectedVoiceoverIds: Set<string>;
  
  // AI 配音
  ttsText: string;
  ttsVoice: string;
  ttsRate: string;
  ttsGenerating: boolean;
  generatedVoiceovers: Array<{ id: string; name: string; path: string; duration: number; selected: boolean }>;
  musicSubTab: 'audio' | 'tts';
  
  setAudioItems: (updater: AudioTimelineItem[] | ((prev: AudioTimelineItem[]) => AudioTimelineItem[])) => void;
  setVoiceoverClips: (updater: any[] | ((prev: any[]) => any[])) => void;
  setAudioBlobs: (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setSelectedAudioIds: (ids: Set<string>) => void;
  setSelectedVoiceoverIds: (ids: Set<string>) => void;
  setTtsText: (v: string) => void;
  setTtsVoice: (v: string) => void;
  setTtsRate: (v: string) => void;
  setTtsGenerating: (v: boolean) => void;
  setGeneratedVoiceovers: (updater: any) => void;
  setMusicSubTab: (v: 'audio' | 'tts') => void;
}

export const createAudioSlice: StateCreator<AudioSlice> = (set) => ({
  audioItems: [],
  voiceoverClips: [],
  audioBlobs: {},
  selectedAudioIds: new Set(),
  selectedVoiceoverIds: new Set(),
  ttsText: '',
  ttsVoice: 'zh-CN-YunyangNeural',
  ttsRate: '+0%',
  ttsGenerating: false,
  generatedVoiceovers: [],
  musicSubTab: 'audio',
  
  setAudioItems: (updater) => set((state) => ({
    audioItems: typeof updater === 'function' ? updater(state.audioItems) : updater
  })),
  setVoiceoverClips: (updater) => set((state) => ({
    voiceoverClips: typeof updater === 'function' ? updater(state.voiceoverClips) : updater
  })),
  setAudioBlobs: (updater) => set((state) => ({
    audioBlobs: typeof updater === 'function' ? updater(state.audioBlobs) : updater
  })),
  setSelectedAudioIds: (ids) => set({ selectedAudioIds: ids }),
  setSelectedVoiceoverIds: (ids) => set({ selectedVoiceoverIds: ids }),
  setTtsText: (v) => set({ ttsText: v }),
  setTtsVoice: (v) => set({ ttsVoice: v }),
  setTtsRate: (v) => set({ ttsRate: v }),
  setTtsGenerating: (v) => set({ ttsGenerating: v }),
  setGeneratedVoiceovers: (updater) => set((state) => ({
    generatedVoiceovers: typeof updater === 'function' ? updater(state.generatedVoiceovers) : updater
  })),
  setMusicSubTab: (v) => set({ musicSubTab: v }),
});
