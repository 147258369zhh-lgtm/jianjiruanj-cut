import { TimelineItem } from '../types';

export interface TimelineLayout {
  items: Array<{
    id: string;
    logicalStart: number;
    logicalEnd: number;
    visualX: number;
    visualWidth: number;
    ppsEffective: number;
  }>;
  totalVisualWidth: number;
}

/**
 * 计算非线性时间轴布局
 * @param timeline 逻辑时间轴片段数组
 * @param pps 基础像素每秒 (Pixels Per Second)
 * @param collapsedWidth 缩回状态下的视觉宽度（秒级单位）
 */
export function calculateTimelineLayout(
  timeline: TimelineItem[],
  pps: number,
  collapsedWidth: number = 3 // 默认折叠后占 3 秒的宽度
): TimelineLayout {
  let currentLogicalTime = 0;
  let currentVisualX = 0;
  
  const items = timeline.map((item) => {
    const logicalStart = currentLogicalTime;
    const logicalDuration = item.duration;
    const logicalEnd = logicalStart + logicalDuration;
    
    // 核心逻辑：如果折叠了，视觉上只占 collapsedWidth 的空间
    const visualDuration = item.collapsed ? Math.min(collapsedWidth, logicalDuration) : logicalDuration;
    const visualWidth = visualDuration * pps;
    
    // 该片段内部的有效倍率 (1.0 为正常，< 1.0 为压缩)
    const ppsEffective = logicalDuration > 0 ? (visualDuration / logicalDuration) : 1;
    
    const layoutItem = {
      id: item.id,
      logicalStart,
      logicalEnd,
      visualX: currentVisualX,
      visualWidth,
      ppsEffective
    };
    
    currentLogicalTime += logicalDuration;
    currentVisualX += visualWidth;
    
    return layoutItem;
  });

  return {
    items,
    totalVisualWidth: currentVisualX
  };
}

/**
 * 逻辑时间 -> 视觉像素 X
 */
export function timeToX(time: number, layout: TimelineLayout, pps: number, offset: number = 60): number {
  if (time <= 0) return offset;
  
  // 查找所属片段
  for (const item of layout.items) {
    if (time >= item.logicalStart && time < item.logicalEnd) {
      const internalOffset = (time - item.logicalStart) * (pps * item.ppsEffective);
      return offset + item.visualX + internalOffset;
    }
  }
  
  // 超出最后一段逻辑时间的处理 (按线性处理)
  const lastItem = layout.items[layout.items.length - 1];
  if (lastItem && time >= lastItem.logicalEnd) {
    const overflow = (time - lastItem.logicalEnd) * pps;
    return offset + lastItem.visualX + lastItem.visualWidth + overflow;
  }
  
  return offset + time * pps;
}

/**
 * 视觉像素 X -> 逻辑时间
 */
export function xToTime(x: number, layout: TimelineLayout, pps: number, offset: number = 60): number {
  const relativeX = x - offset;
  if (relativeX <= 0) return 0;
  
  for (const item of layout.items) {
    if (relativeX >= item.visualX && relativeX < item.visualX + item.visualWidth) {
      const localX = relativeX - item.visualX;
      const localTime = item.ppsEffective > 0 ? (localX / (pps * item.ppsEffective)) : 0;
      return item.logicalStart + localTime;
    }
  }
  
  // 超出最后一段视觉宽度的处理
  const lastItem = layout.items[layout.items.length - 1];
  if (lastItem && relativeX >= lastItem.visualX + lastItem.visualWidth) {
    const overflowX = relativeX - (lastItem.visualX + lastItem.visualWidth);
    return lastItem.logicalEnd + (overflowX / pps);
  }
  
  return relativeX / pps;
}
