import { SetStateAction } from 'react';
import { AudioTimelineItem } from '../types';

interface UseAudioOperationsProps {
  audioItems: AudioTimelineItem[];
  setAudioItems: React.Dispatch<SetStateAction<AudioTimelineItem[]>>;
  selectedAudioIds: Set<string>;
  setSelectedAudioIds: React.Dispatch<SetStateAction<Set<string>>>;
  setSelectedVoiceoverIds: React.Dispatch<SetStateAction<Set<string>>>;
  setIsEditingAudio: (val: boolean) => void;
  setStatusMsg: (msg: string) => void;
}

export function useAudioOperations({
  audioItems,
  setAudioItems,
  selectedAudioIds,
  setSelectedAudioIds,
  setSelectedVoiceoverIds,
  setIsEditingAudio,
  setStatusMsg,
}: UseAudioOperationsProps) {

  const updateAudioItem = (id: string, patch: Partial<AudioTimelineItem>, isDragging: boolean = false) => {
    setAudioItems(prev => {
      return prev.map(a => {
        if (a.id === id) {
          let newPatch = { ...patch };

          // ─── 吸附碰撞算法 (Magnetic Snapping) ───
          if (isDragging && newPatch.timelineStart !== undefined) {
            const snapThreshold = 0.4; // 吸附触发距离 (0.4秒)
            const myDur = a.duration;
            let candidateT = newPatch.timelineStart;
            let bestDiff = snapThreshold;

            for (const other of prev) {
              if (other.id === id) continue;
              const otherStart = other.timelineStart;
              const otherEnd = other.timelineStart + other.duration;

              // 我的开始碰别人结束
              if (Math.abs(candidateT - otherEnd) < bestDiff) { candidateT = otherEnd; bestDiff = Math.abs(newPatch.timelineStart - otherEnd); }
              // 我的结束碰别人开始
              if (Math.abs(candidateT + myDur - otherStart) < bestDiff) { candidateT = otherStart - myDur; bestDiff = Math.abs(newPatch.timelineStart + myDur - otherStart); }

              // 并行对齐 (头对头，尾对尾)
              if (Math.abs(candidateT - otherStart) < bestDiff) { candidateT = otherStart; bestDiff = Math.abs(newPatch.timelineStart - otherStart); }
              if (Math.abs(candidateT + myDur - otherEnd) < bestDiff) { candidateT = otherEnd - myDur; bestDiff = Math.abs(newPatch.timelineStart + myDur - otherEnd); }
            }

            if (Math.abs(candidateT - 0) < bestDiff) { candidateT = 0; }

            newPatch.timelineStart = Math.max(0, candidateT);
          }
          return { ...a, ...newPatch };
        }
        return a;
      });
    });
  };

  const stitchSelectedAudioGaps = () => {
    if (selectedAudioIds.size < 2) {
      setStatusMsg("聚合失败：请按住 Ctrl 选定至少 2 段音频残片");
      setTimeout(() => setStatusMsg(""), 3000);
      return;
    }
    setAudioItems(prev => {
      const sortedSelected = prev.filter(a => selectedAudioIds.has(a.id)).sort((a, b) => a.timelineStart - b.timelineStart);
      let anchorTime = sortedSelected[0].timelineStart;
      const shifts = new Map<string, number>();
      for (const piece of sortedSelected) {
        shifts.set(piece.id, anchorTime);
        anchorTime += piece.duration;
      }
      return prev.map(item => {
        if (shifts.has(item.id)) {
          return { ...item, timelineStart: shifts.get(item.id)! };
        }
        return item;
      });
    });
    setStatusMsg("🧲 已成功跨越时空缝合选中的残片！");
    setTimeout(() => setStatusMsg(""), 3000);
  };

  const executeAudioCut = (itemId: string) => {
    const item = audioItems.find(a => a.id === itemId);
    if (!item) return;
    const cuts = (item.cutPoints || []).slice().sort((a, b) => a - b);
    const selected = new Set(item.selectedRegions || []);
    const boundaries = [0, ...cuts, item.duration];

    const newFragments: AudioTimelineItem[] = [];
    let currentTimelinePos = item.timelineStart;

    for (let i = 0; i < boundaries.length - 1; i++) {
      const startClip = boundaries[i];
      const endClip = boundaries[i + 1];
      const dur = endClip - startClip;

      if (!selected.has(i)) {
        if (dur > 0.01) {
          newFragments.push({
            ...item,
            id: `aud_${Date.now()}_${i}`,
            timelineStart: currentTimelinePos,
            startOffset: item.startOffset + startClip,
            duration: dur,
            cutPoints: [],
            selectedRegions: []
          });
        }
      }
      currentTimelinePos += dur;
    }

    if (newFragments.length === 0) {
      setAudioItems(prev => prev.filter(a => a.id !== itemId));
      setSelectedAudioIds(new Set()); setSelectedVoiceoverIds(new Set());
    } else {
      setAudioItems(prev => {
        const idx = prev.findIndex(a => a.id === itemId);
        const next = [...prev];
        next.splice(idx, 1, ...newFragments);
        return next;
      });
      setSelectedAudioIds(new Set(newFragments.map(f => f.id)));
    }

    setIsEditingAudio(false);
    setStatusMsg("✂️ 残片已切除。此时已留出空隙，如需拼合缝合可点击上方 '缝合选区'");
    setTimeout(() => setStatusMsg(""), 4000);
  };

  return {
    updateAudioItem,
    stitchSelectedAudioGaps,
    executeAudioCut,
  };
}
