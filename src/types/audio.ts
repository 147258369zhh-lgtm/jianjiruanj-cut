// ─── 音频时间轴类型 ────────────────────────────────────────────────────────
export interface AudioTimelineItem {
  id: string;
  resourceId: string;
  timelineStart: number;
  startOffset: number;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  cutPoints?: number[];
  selectedRegions?: number[];
}
