// ─── 资源类型 ────────────────────────────────────────────────────────
export interface Resource {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'audio' | 'video' | 'voiceover';
  focusX?: number;
  focusY?: number;
  hasFace?: boolean;
  dHash?: string;
  sharpnessScore?: number;
  burstGroupId?: string;
  isDiscarded?: boolean;
  meanBrightness?: number;
  aspectRatio?: number;
}
