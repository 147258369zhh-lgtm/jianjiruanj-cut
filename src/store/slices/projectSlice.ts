import { StateCreator } from 'zustand';
import type { GlobalDefaults } from '../../types';
import { GLOBAL_DEFAULTS_INIT } from '../../types';

export interface ProjectSlice {
  projectName: string;
  sortMode: 'manual' | 'time' | 'name';
  sortDirection: 'asc' | 'desc';
  globalDefaults: GlobalDefaults;
  monitorRes: any | null;
  
  setProjectName: (v: string) => void;
  setSortMode: (v: 'manual' | 'time' | 'name') => void;
  setSortDirection: (v: 'asc' | 'desc') => void;
  setGlobalDefaults: (v: GlobalDefaults | ((prev: GlobalDefaults) => GlobalDefaults)) => void;
  setMonitorRes: (v: any) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
  projectName: '未命名项目',
  sortMode: 'manual',
  sortDirection: 'asc',
  globalDefaults: GLOBAL_DEFAULTS_INIT,
  monitorRes: null,
  
  setProjectName: (v) => set({ projectName: v }),
  setSortMode: (v) => set({ sortMode: v }),
  setSortDirection: (v) => set({ sortDirection: v }),
  setGlobalDefaults: (v) => set(s => ({ globalDefaults: typeof v === 'function' ? v(s.globalDefaults) : v })),
  setMonitorRes: (v) => set({ monitorRes: v }),
});
