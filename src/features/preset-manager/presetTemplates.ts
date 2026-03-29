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
    name: '标准幻灯片',
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
    id: 'preset-travel-vlog',
    name: '旅行胶片',
    icon: '✈️',
    description: '2秒快切，高对比鲜明度，带微颗粒和全图随机缓慢推拉。',
    color: '#10b981', // Emerald Drop
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 2.0,
      transition: 'fade',
      animation: 'random', // 特别标识：会在应用时触发 random 分配
      brilliance: 1.2,
      contrast: 1.15,
      saturation: 1.1,
      vibrance: 1.2,
      sharpness: 0.3,
      grain: 0.15
    }
  },
  {
    id: 'preset-product',
    name: '好物短视频',
    icon: '🛍️',
    description: '1.5秒硬切极快展示，高锐化突出纹理细节。',
    color: '#f59e0b', // Ambient Amber
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 1.5,
      transition: 'none',
      animation: 'none',
      exposure: 1.1,
      contrast: 1.2,
      sharpness: 0.8,
      blacks: 1.05
    }
  },
  {
    id: 'preset-narration',
    name: '解说/配音底图',
    icon: '🎙️',
    description: '长达 5秒静态展示，彻底屏蔽转场动画。给干货与字幕留足焦点。',
    color: '#a855f7', // Vivid Purple
    settings: {
      ...GLOBAL_DEFAULTS_INIT,
      duration: 5.0,
      transition: 'none',
      animation: 'none',
      exposure: 0.9, // 稍微压暗底图突出未来可能添加的字幕
      contrast: 1.05
    }
  }
];
