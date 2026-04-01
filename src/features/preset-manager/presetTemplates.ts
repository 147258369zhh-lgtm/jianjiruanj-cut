import { GlobalDefaults, GLOBAL_DEFAULTS_INIT } from '../../types';

export interface WorkflowPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  settings: Partial<GlobalDefaults>;
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'preset-standard',
    name: '基础幻灯片',
    icon: '🎞️',
    description: '3秒叠化，适合普通生活相册。平滑过渡无刺激。',
    color: '#6366f1', // iOS Indigo
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 3.0,
      transition: 'fade',
      animation: 'none'
    }
  },
  {
    id: 'preset-cinematic',
    name: '电影感叙事',
    icon: '🎬',
    description: '4秒长轴拉伸，附带电影级暗角与颗粒感，适合大片。',
    color: '#EC4899', // Pink
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 4.0,
      transition: 'fade',
      animation: 'random',
      vignette: 0.35,
      grain: 0.15,
      contrast: 1.1,
      saturation: 0.95,
      temp: 5
    }
  },
  {
    id: 'preset-travel-vlog',
    name: '旅行胶片 Vlog',
    icon: '✈️',
    description: '2秒快切，高对比鲜明度，带微颗粒和全图随机缓慢推拉。',
    color: '#10b981', // Emerald Drop
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 2.0,
      transition: 'slide',
      animation: 'random', 
      brilliance: 1.2,
      contrast: 1.15,
      saturation: 1.1,
      vibrance: 1.2,
      sharpness: 0.3,
      grain: 0.15
    }
  },
  {
    id: 'preset-rhythm-flash',
    name: '动感卡点快闪',
    icon: '⚡',
    description: '0.8秒极速硬切！适合搭配节奏感强烈的 BPM 音乐。',
    color: '#06B6D4', // Cyan
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 0.8,
      transition: 'none',
      animation: 'none',
      contrast: 1.25,
      vibrance: 1.15,
      sharpness: 0.5
    }
  },
  {
    id: 'preset-product',
    name: '好物种草展示',
    icon: '🛍️',
    description: '1.5秒硬切极快展示，高锐化突出纹理细节。',
    color: '#f59e0b', // Ambient Amber
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 1.5,
      transition: 'none',
      animation: 'zoom',
      exposure: 1.1,
      contrast: 1.2,
      sharpness: 0.8,
      blacks: 1.05
    }
  },
  {
    id: 'preset-narration',
    name: '口播解说底图',
    icon: '🎙️',
    description: '长达 5秒静态展示，彻底屏蔽转场组合，给干货留足焦点。',
    color: '#a855f7', // Vivid Purple
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 5.0,
      transition: 'none',
      animation: 'none',
      exposure: 0.9, 
      contrast: 1.05
    }
  }
];
