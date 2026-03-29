
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useStore } from "../store";
import { useShallow } from 'zustand/react/shallow';
import { useProjectHistory } from './useProjectHistory';
import { usePlaybackEngine } from './usePlaybackEngine';
import { useAudioSync } from './useAudioSync';
import { useProjectIO } from './useProjectIO';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useDragImport, IngestItem } from './useDragImport';
import { useTimelineActions } from './useTimelineActions';
import { useResourceManager } from './useResourceManager';
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from '@tauri-apps/api/core';
import { Resource, AudioTimelineItem, TimelineItem, GlobalDefaults, GLOBAL_DEFAULTS_INIT, TextOverlay } from '../types';
import { calculateTimelineLayout } from '../utils/timelineLayout';

export function useAppController() {
  const [pps, setPps] = useState(24);
  const [resources, setResources] = useState<Resource[]>([
    { id: 'lib_aud_1', name: '🎵 宁静心境 (Please Calm My Mind)', path: '/audio/please-calm-my-mind.mp3', type: 'audio' },
    { id: 'lib_aud_2', name: '🎹 遗忘的华尔兹 (Forgotten Waltz)', path: '/audio/forgotten-waltz.mp3', type: 'audio' },
    { id: 'lib_aud_3', name: '🌿 钢琴小品 (Piano Music)', path: '/audio/piano-music.mp3', type: 'audio' },
    { id: 'lib_aud_4', name: '✨ 温柔恬静 (Calm Soft)', path: '/audio/calm-soft.mp3', type: 'audio' },
    { id: 'lib_aud_5', name: '🌊 柔和背景 (Background Soft Calm)', path: '/audio/background-soft-calm.mp3', type: 'audio' },
  ]);

  const {
    state: project,
    setTimeline,
    setAudioItems,
    setVoiceoverClips,
    undo,
    redo,
    historyLength,
    redoLength,
    commitSnapshotNow
  } = useProjectHistory({ timeline: [], audioItems: [], voiceoverClips: [] });

  const timeline = project.timeline;
  const audioItems = project.audioItems;
  const voiceoverClips = project.voiceoverClips;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set()); // 文字图层多选集合
  const [selectedAudioIds, setSelectedAudioIds] = useState<Set<string>>(new Set());
  const [selectedVoiceoverIds, setSelectedVoiceoverIds] = useState<Set<string>>(new Set());
  // const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const {
    activeTab, setActiveTab,
    propertyTab, setPropertyTab,
    setLibTab,
    statusMsg, setStatusMsg,
    showShortcuts, setShowShortcuts,
    setShowSortMenu,
    showExportPanel, setShowExportPanel,
    showGlobalDefaults, setShowGlobalDefaults,
    setShowMoreMenu,
    isDragOver, setIsDragOver,
    setIsGenerating,
    contextMenu, setContextMenu,
    selectionBox, setSelectionBox,
    crop, setCrop,
    isCropping, setIsCropping,
    isEditingAudio, setIsEditingAudio,
    isDraggingHead, setIsDraggingHead,
    isJumping, setIsJumping,
    localDuration, setLocalDuration,
    theme,
    exportFormat,
    exportResolution,
    exportFps,
    exportQuality,
    exportCodec,
    exportHdr
  } = useStore(useShallow((state: any) => ({
    activeTab: state.activeTab, setActiveTab: state.setActiveTab,
    propertyTab: state.propertyTab, setPropertyTab: state.setPropertyTab,
    setLibTab: state.setLibTab,
    // leftTab/libTab moved to LeftPanel
    statusMsg: state.statusMsg, setStatusMsg: state.setStatusMsg,
    showShortcuts: state.showShortcuts, setShowShortcuts: state.setShowShortcuts,
    showSortMenu: state.showSortMenu, setShowSortMenu: state.setShowSortMenu,
    showExportPanel: state.showExportPanel, setShowExportPanel: state.setShowExportPanel,
    showGlobalDefaults: state.showGlobalDefaults, setShowGlobalDefaults: state.setShowGlobalDefaults,
    showMoreMenu: state.showMoreMenu, setShowMoreMenu: state.setShowMoreMenu,
    isDragOver: state.isDragOver, setIsDragOver: state.setIsDragOver,
    isGenerating: state.isGenerating, setIsGenerating: state.setIsGenerating,
    contextMenu: state.contextMenu, setContextMenu: state.setContextMenu,
    selectionBox: state.selectionBox, setSelectionBox: state.setSelectionBox,
    crop: state.crop, setCrop: state.setCrop,
    isCropping: state.isCropping, setIsCropping: state.setIsCropping,
    isEditingAudio: state.isEditingAudio, setIsEditingAudio: state.setIsEditingAudio,
    isDraggingHead: state.isDraggingHead, setIsDraggingHead: state.setIsDraggingHead,
    isJumping: state.isJumping, setIsJumping: state.setIsJumping,
    localDuration: state.localDuration, setLocalDuration: state.setLocalDuration,
    theme: state.theme,
    exportFormat: state.exportFormat, setExportFormat: state.setExportFormat,
    exportResolution: state.exportResolution, setExportResolution: state.setExportResolution,
    exportFps: state.exportFps, setExportFps: state.setExportFps,
    exportQuality: state.exportQuality, setExportQuality: state.setExportQuality,
    exportCodec: state.exportCodec, setExportCodec: state.setExportCodec,
    exportHdr: state.exportHdr, setExportHdr: state.setExportHdr
  })));

  const {
    sortMode, setSortMode,
    globalDefaults,
    monitorRes, setMonitorRes,
    selectedResourceIds, setSelectedResourceIds
  } = useStore(useShallow(state => ({
    sortMode: state.sortMode, setSortMode: state.setSortMode,
    globalDefaults: state.globalDefaults,
    monitorRes: state.monitorRes, setMonitorRes: state.setMonitorRes,
    selectedResourceIds: state.selectedResourceIds,
    setSelectedResourceIds: state.setSelectedResourceIds
  })));

  // AI 配音相关状态等移入 LeftPanel

  // 导出设置 (已迁移至 Zustand)

  // 裁切编辑 (已迁移至 Zustand)

  // 音频剪辑 (已迁移至 Zustand)

  // 播放指针拖拽 (已迁移至 Zustand)
  const [audioBlobs, setAudioBlobs] = useState<{ [id: string]: string }>({}); // 核心：URL 映射缓存
  const [previewCache, setPreviewCache] = useState<{ [path: string]: string }>({}); // RAW 预览图映射缓存
  // lastScrubTimeRef 已移入 useTimelineActions
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  // const [searchQuery, setSearchQuery] = useState('');
  // const [_isFullscreen, setIsFullscreen] = useState(false);

  // ─── 改版新增状态 ────────────────────────────────────────────────────
  const [_showAdvancedExport, _setShowAdvancedExport] = useState(false);

  // ─── 全局默认值系统 (任务6) ──────────────────────────────────────────
  const globalDefaultsRef = useRef(globalDefaults);
  globalDefaultsRef.current = globalDefaults;

  // 检查字段是否被覆盖
  const isOverridden = useCallback((item: TimelineItem, key: string) => {
    return item.overrides?.includes(key) ?? false;
  }, []);

  // ─── 智能面部检测引擎 WebWorker ─────────────────────────
  const faceWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    faceWorkerRef.current = new Worker(new URL('./workers/faceDetector.worker.ts', import.meta.url), { type: 'module' });
    faceWorkerRef.current.onmessage = (e) => {
      const { id, focusX, focusY, found } = e.data;
      setResources(prev => prev.map(r => r.id === id ? { ...r, focusX, focusY, hasFace: found } : r));
    };
    return () => faceWorkerRef.current?.terminate();
  }, []);

  // ─── 性能优化：状态 Ref (消除播放时级联重渲染) ─────────────────
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const audioItemsRef = useRef(audioItems);
  audioItemsRef.current = audioItems;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const selectedAudioIdsRef = useRef(selectedAudioIds);
  selectedAudioIdsRef.current = selectedAudioIds;
  const selectedVoiceoverIdsRef = useRef(selectedVoiceoverIds);
  selectedVoiceoverIdsRef.current = selectedVoiceoverIds;
  const voiceoverClipsRef = useRef(voiceoverClips);
  voiceoverClipsRef.current = voiceoverClips;
  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;

  // 恢复单个字段的继承 (全局覆盖模型)
  const restoreInheritance = useCallback((itemId: string, key: keyof GlobalDefaults) => {
    commitSnapshotNow();
    setTimeline(prev => prev.map(t => {
      if (t.id === itemId || selectedIdsRef.current.has(t.id)) {
        const newOverrides = (t.overrides || []).filter(k => k !== key);
        return { ...t, [key]: globalDefaults[key], overrides: newOverrides };
      }
      return t;
    }));
    setStatusMsg(`🔗 已恢复「${key}」为全局默认值`); setTimeout(() => setStatusMsg(''), 1500);
  }, [globalDefaults, commitSnapshotNow, setTimeline]);

  // ─── 滤镜预设 (已迁移到 features/filter-engine/filterPresets.ts) ───
  // ─── 收藏预设管理 ───────────────────────────────────────────────
  const [favTrans, setFavTrans] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('__editor_fav_trans__') || '[]'); } catch { return []; }
  });
  const [favAnims, setFavAnims] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('__editor_fav_anims__') || '[]'); } catch { return []; }
  });

  const toggleFavTrans = useCallback((val: string) => {
    setFavTrans(prev => {
      const next = prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val];
      localStorage.setItem('__editor_fav_trans__', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleFavAnim = useCallback((val: string) => {
    setFavAnims(prev => {
      const next = prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val];
      localStorage.setItem('__editor_fav_anims__', JSON.stringify(next));
      return next;
    });
  }, []);


  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null); // 指针 DOM 引用
  // const libScrollRef = useRef<HTMLDivElement>(null);
  // const [libScrollTop, setLibScrollTop] = useState(0);
  const timeTextRef = useRef<HTMLSpanElement>(null); // 时间文字 DOM 引用
  const monitorVideoRef = useRef<HTMLVideoElement>(null); // 预览区视频元素引用
  const clickTimesRef = useRef<number[]>([]); // 用于记录点击时间戳实现三击

  // audioElsRef 已移入 useAudioSync hook
  const lastSyncTimeRef = useRef<number>(0);
  // 性能优化：将 playTime 同步到 ref，供音频同步 RAF 循环读取
  const playTimeRef = useRef(playTime);
  playTimeRef.current = playTime;

  const layout = useMemo(() => calculateTimelineLayout(timeline, pps), [timeline, pps]);

  // ─── 播放引擎 (已提取到 hooks/usePlaybackEngine.ts) ──────────────
  const { maxPlayTime, playLineLeft, handleTripleClickZone, togglePlay } = usePlaybackEngine({
    isPlaying, playbackSpeed, playTime, timeline, audioItems, voiceoverClips, pps,
    setPlayTime, setIsPlaying, setStatusMsg,
    layout, refs: {
      timelineRef, audioItemsRef, ppsRef,
      playheadRef, timelineScrollRef, timeTextRef,
      playTimeRef, lastSyncTimeRef, clickTimesRef,
      voiceoverClipsRef
    }
  });


  // ─── 播放头位置分割片段 (ref-based, 零依赖) ──────────────────
  const splitAtPlayhead = useCallback(() => {
    const pt = playTimeRef.current;
    let splitted = false;
    commitSnapshotNow();

    const selectedViz = selectedIdsRef.current;
    const selectedAud = selectedAudioIdsRef.current;
    const selectedVO = selectedVoiceoverIdsRef.current;
    const noSelection = selectedViz.size === 0 && selectedAud.size === 0 && selectedVO.size === 0;

    // 1. 尝试分割视频轨
    if (noSelection || selectedViz.size > 0) {
      const tl = timelineRef.current;
      let accDur = 0;
      for (let i = 0; i < tl.length; i++) {
        const item = tl[i];
        const isTarget = pt > accDur + 0.2 && pt < accDur + item.duration - 0.2;
        const canSplit = noSelection || selectedViz.has(item.id);
        if (isTarget && canSplit) {
          const splitPoint = pt - accDur;
          const left = { ...item, duration: splitPoint, id: `tm_${Date.now()}_L` };
          const right = { ...item, duration: item.duration - splitPoint, id: `tm_${Date.now()}_R` };
          setTimeline(prev => [...prev.slice(0, i), left, right, ...prev.slice(i + 1)]);
          splitted = true;
          break;
        }
        accDur += item.duration;
      }
    }

    // 2. 尝试分割音频轨
    if (noSelection || selectedAud.size > 0) {
      setAudioItems(prev => {
        let changed = false;
        const result: any[] = [];
        for (const item of prev) {
          const isTarget = pt > item.timelineStart + 0.2 && pt < item.timelineStart + item.duration - 0.2;
          const canSplit = noSelection || selectedAud.has(item.id);
          if (isTarget && canSplit) {
            const splitPoint = pt - item.timelineStart;
            const left = { ...item, duration: splitPoint, id: `au_${Date.now()}_${Math.random().toString().slice(2, 6)}_L` };
            const right = { ...item, duration: item.duration - splitPoint, timelineStart: pt, startOffset: (item.startOffset || 0) + splitPoint, id: `au_${Date.now()}_${Math.random().toString().slice(2, 6)}_R` };
            result.push(left, right);
            changed = true;
            splitted = true;
          } else {
            result.push(item);
          }
        }
        return changed ? result : prev;
      });
    }

    // 3. 尝试分割配音轨
    if (noSelection || selectedVO.size > 0) {
      setVoiceoverClips(prev => {
        let changed = false;
        const result: any[] = [];
        for (const clip of prev) {
          const isTarget = pt > clip.timelineStart + 0.2 && pt < clip.timelineStart + clip.duration - 0.2;
          const canSplit = noSelection || selectedVO.has(clip.id);
          if (isTarget && canSplit) {
            const splitPoint = pt - clip.timelineStart;
            const left = { ...clip, duration: splitPoint, id: `vo_${Date.now()}_${Math.random().toString().slice(2, 6)}_L` };
            const right = { ...clip, duration: clip.duration - splitPoint, timelineStart: pt, startOffset: (clip.startOffset || 0) + splitPoint, id: `vo_${Date.now()}_${Math.random().toString().slice(2, 6)}_R` };
            result.push(left, right);
            changed = true;
            splitted = true;
          } else {
            result.push(clip);
          }
        }
        return changed ? result : prev;
      });
    }

    if (splitted) {
      setStatusMsg('✂️ 已切断播放头下的所选片段');
    } else {
      setStatusMsg('⚠️ 没有可供切割的片段（请确认选中状态及位置）');
    }
    setTimeout(() => setStatusMsg(''), 1500);
  }, [commitSnapshotNow]);

  // ─── 工程保存/加载/自动保存 (已提取到 hooks/useProjectIO.ts) ───
  const { saveProject, loadProject } = useProjectIO({
    resourcesRef, timelineRef, audioItemsRef, ppsRef,
    setResources, setTimeline, setAudioItems, setPps,
    setStatusMsg
  });

  // 恢复：时间轴播放跟随同步联动
  useEffect(() => {
    if (isPlaying && timelineScrollRef.current) {
      const containerWidth = timelineScrollRef.current.clientWidth;
      const targetScroll = (playTime * 10) - (containerWidth / 2);
      if (Math.abs(timelineScrollRef.current.scrollLeft - targetScroll) > 5) {
        timelineScrollRef.current.scrollLeft = Math.max(0, targetScroll);
      }
    }
  }, [playTime, isPlaying]);

  // 恢复：选择图片片段时时间轴自动居中定位
  useEffect(() => {
    if (!isPlaying && selectedIds.size === 1 && timelineScrollRef.current) {
      const id = Array.from(selectedIds)[0];
      let start = 0;
      for (let i = 0; i < timeline.length; i++) {
        if (timeline[i].id === id) {
          const center = (start + timeline[i].duration / 2) * 10;
          const cw = timelineScrollRef.current.clientWidth;
          timelineScrollRef.current.scrollTo({ left: Math.max(0, center - cw / 2), behavior: 'smooth' });
          break;
        }
        start += timeline[i].duration;
      }
    }
  }, [selectedIds, isPlaying, timeline]);

  // ─── 全局快捷键系统 (已提取到 hooks/useKeyboardShortcuts.ts) ───
  useKeyboardShortcuts({
    setIsPlaying, setPlayTime,
    selectedIdsRef, selectedAudioIdsRef, selectedVoiceoverIdsRef, timelineRef,
    commitSnapshotNow, setTimeline, setAudioItems, setVoiceoverClips,
    setSelectedIds, setSelectedAudioIds, setSelectedVoiceoverIds,
    undo, redo, saveProject, loadProject, splitAtPlayhead,
    setShowShortcuts
  });

  // ─── 拖拽导入临时缓冲队列 (Module D) ───
  const [ingestQueue, setIngestQueue] = useState<IngestItem[]>([]);

  // ─── 拖拽导入文件 (已提取到 hooks/useDragImport.ts) ───
  useDragImport({ setIsDragOver, setIngestQueue, setStatusMsg });

  // ─── 时间轴 Ctrl+滚轮 缩放 ──────────────────────────────────────
  // ─── 时间轴交互集合 (已提取到 hooks/useTimelineActions.ts) ───
  const {
    handleTimelineWheel,
    seekToX,
    handleTimelineMouseMove,
    handleTimelineMouseUp,
    handleTimelineSelect,
    handleTimelineRemove,
    handleTimelineTrim,
    handleTimelineContextMenu,
    handleAudioSelect,
    handleTimelineDoubleClick
  } = useTimelineActions({
    pps, ppsRef, setPps,
    timeline, timelineRef, setTimeline,
    playheadRef, timelineScrollRef,
    setPlayTime, setIsPlaying, setIsJumping,
    isDraggingHead, setIsDraggingHead,
    selectionBox, setSelectionBox,
    selectedIds, setSelectedIds, setSelectedAudioIds, setSelectedVoiceoverIds,
    commitSnapshotNow, setContextMenu, layout
  });



  // 性能优化：资源 Map 索引 (O(1) 查找替代 O(n) 遍历)
  const resourceMap = useMemo(() => new Map(resources.map(r => [r.id, r])), [resources]);
  // [已提取] 播放引擎 RAF 循环 → hooks/usePlaybackEngine.ts

  // 性能优化：已添加资源 ID 集合 (替代 timeline.some() + audioItems.some())
  const addedResourceIds = useMemo(() => new Set([...timeline.map(t => t.resourceId), ...audioItems.map(a => a.resourceId)]), [timeline, audioItems]);

  // ─── 音频同步引擎 (已提取到 hooks/useAudioSync.ts) ──────────────
  const { getEffectiveSrc } = useAudioSync({
    isPlaying, resources, audioItems, voiceoverClips,
    resourceMap, audioBlobs, previewCache,
    setAudioBlobs, setPreviewCache, playTimeRef
  });

  // formatTime 已迁移到 utils/formatTime.ts
  // const formatTime = formatTimeMod;

  // playTimeRef 已在上方声明并持续同步


  const updateSelectedProperty = (key: keyof TimelineItem, val: any) => {
    if (selectedIds.size === 0) return;

    const textRelatedKeys = ['overlayText', 'fontFamily', 'fontColor', 'fontSize', 'fontWeight', 'textAlign', 'textBg', 'textBgPadding', 'textBgRadius', 'textShadowColor', 'textShadowBlur', 'textShadowOffsetX', 'textShadowOffsetY', 'textStrokeColor', 'textStrokeWidth', 'textGlow', 'textGlowColor', 'textGlowRadius', 'textLetterSpacing', 'textLineHeight', 'textOpacity', 'textRotation', 'textX', 'textY', 'textAnimation', 'textAnimDuration'];

    setTimeline(prev => prev.map(t => {
      if (!selectedIds.has(t.id)) return t;

      // 核心业务：当用户选定了一个或多个 TextOverlay，且修改的是文字专属属性时，仅改变子图层
      if (selectedTextIds.size > 0 && textRelatedKeys.includes(key as string)) {
        let textKey = key as keyof TextOverlay;
        if (key === 'overlayText') textKey = 'text'; // 兼容字段

        const newOverlays = (t.textOverlays || []).map(layer => {
          if (selectedTextIds.has(layer.id)) {
            return { ...layer, [textKey]: val };
          }
          return layer;
        });
        return { ...t, textOverlays: newOverlays };
      }

      // 全局修改，影响整体主属
      const globalKeys: string[] = Object.keys(GLOBAL_DEFAULTS_INIT);
      if (globalKeys.includes(key as string)) {
        const newOverrides = Array.from(new Set([...(t.overrides || []), key as string]));
        return { ...t, [key]: val, overrides: newOverrides };
      }
      return { ...t, [key]: val };
    }));
  };

  // Slider 撤销保护：拖动前压栈，拖动结束后自动保存
  const sliderUndoFlag = useRef(false);
  const updatePropertyWithUndo = (key: keyof TimelineItem, val: any) => {
    if (!sliderUndoFlag.current) { commitSnapshotNow(); sliderUndoFlag.current = true; }
    updateSelectedProperty(key, val);
  };
  const finalizeSliderUndo = () => { sliderUndoFlag.current = false; };

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

  // 合并选区缝合间隙
  const stitchSelectedAudioGaps = () => {
    if (selectedAudioIds.size < 2) {
      setStatusMsg("聚合失败：请按住 Ctrl 选定至少 2 段音频残片");
      setTimeout(() => setStatusMsg(""), 3000);
      return;
    }
    setAudioItems(prev => {
      // 1. 过滤并按照时间轴顺序排序所有选中的碎片
      const sortedSelected = prev.filter(a => selectedAudioIds.has(a.id)).sort((a, b) => a.timelineStart - b.timelineStart);

      // 2. 以最开头的那个碎片为锚点
      let anchorTime = sortedSelected[0].timelineStart;

      // 3. 构建新的位移映射表
      const shifts = new Map<string, number>();
      for (const piece of sortedSelected) {
        shifts.set(piece.id, anchorTime);
        anchorTime += piece.duration; // 紧随其后排队
      }

      // 4. 应用修改
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

  const applyAllToTimeline = () => {
    if (!selectedItem) return;
    setTimeline(prev => prev.map(t => ({
      ...t,
      duration: selectedItem.duration,
      transition: selectedItem.transition,
      contrast: selectedItem.contrast,
      saturation: selectedItem.saturation,
      exposure: selectedItem.exposure,
      brilliance: selectedItem.brilliance,
      temp: selectedItem.temp,
      tint: selectedItem.tint,
      zoom: selectedItem.zoom,
      rotation: selectedItem.rotation,
      overlayText: selectedItem.overlayText,
      fontSize: selectedItem.fontSize,
      fontWeight: selectedItem.fontWeight,
      cropPos: selectedItem.cropPos,
    })));
    setStatusMsg('效果已成功应用到所有图片');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  // ─── 音频剪辑核心算法 ───
  // 逻辑：将一个音轨项根据保留区域切分为多个独立音轨项，并自动计算起始位置留存空隙
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
      // 取消波纹删除：无论分段是否被保留，始终将其持续时间计入偏移累加中，制造真实的“缝隙”
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
      // 将剪除后存活下来的片段维持为选中状态，以免右侧面板丢失上下文
      setSelectedAudioIds(new Set(newFragments.map(f => f.id)));
    }

    setIsEditingAudio(false);
    setStatusMsg("✂️ 残片已切除。此时已留出空隙，如需拼合缝合可点击上方 '缝合选区'");
    setTimeout(() => setStatusMsg(""), 4000);
  };

  // 播放指针操作、拖拽动作均已提取至 hooks/useTimelineActions.ts

  // ─── 资源库与素材管理系统 (已提取到 hooks/useResourceManager.ts) ───
  const {
    handleImport,
    handleRevealInExplorer,
    handleConvertDNG,
    removeFromLibrary,
    handleLibToggle,
    handleLibSelectPreview,
    handleLibAdd
  } = useResourceManager({
    resourceMap, previewCache, setPreviewCache, setStatusMsg,
    setResources, setLibTab, faceWorkerRef, resourcesRef,
    setAudioBlobs, setTimeline, setAudioItems, selectedResourceIds, setSelectedResourceIds,
    setMonitorRes, globalDefaultsRef, playTimeRef
  });

  // 各种时间轴元素的鼠标与交互事件均已提取至 hooks/useTimelineActions.ts

  const selectedItem = useMemo(() => timeline.find(t => selectedIds.has(t.id)), [timeline, selectedIds]);

  const monitorSrc = useMemo(() => {
    if (timeline.length > 0) {
      let acc = 0;
      for (const t of timeline) {
        if (playTime >= acc && playTime < acc + t.duration) {
          const res = resourceMap.get(t.resourceId);
          if (res) {
            return { ...res, currentItem: t, src: getEffectiveSrc(res.path), localTime: playTime - acc };
          }
          // 纯文字项（无 resourceId）
          if (!t.resourceId && t.overlayText) {
            return { id: t.id, name: t.overlayText, type: 'text' as const, path: '', currentItem: t, src: '', localTime: 0 };
          }
          return null;
        }
        acc += t.duration;
      }
    }
    return monitorRes ? { ...monitorRes, currentItem: null, src: getEffectiveSrc(monitorRes.path), localTime: 0 } : null;
  }, [isPlaying, playTime, timeline, resources, monitorRes, previewCache]);

  // 同步视频播放与时间线
  useEffect(() => {
    const videoEl = monitorVideoRef.current;
    if (!videoEl || !monitorSrc || monitorSrc.type !== 'video') return;
    const localTime = monitorSrc.localTime || 0;
    
    // 同步速率与音量
    const itemSpeed = (monitorSrc.currentItem as any)?.playbackRate ?? 1.0;
    const targetRate = playbackSpeed * itemSpeed;
    if (videoEl.playbackRate !== targetRate) videoEl.playbackRate = targetRate;

    const vol = (monitorSrc.currentItem as any)?.volume ?? 1.0;
    if (videoEl.volume !== vol) videoEl.volume = vol;

    // 同步 currentTime（仅在差异超过 0.3s 时 seek，避免频繁跳帧）
    // 注意：如果是倍速播放，时间轴过了 localTime 时间，对应素材的原始进度应该为 localTime * itemSpeed
    const localTimeAdjusted = localTime * itemSpeed;
    if (Math.abs(videoEl.currentTime - localTimeAdjusted) > 0.3) {
      videoEl.currentTime = localTimeAdjusted;
    }
    if (isPlaying) {
      videoEl.play().catch(() => { });
    } else {
      videoEl.pause();
    }
  }, [isPlaying, monitorSrc, playbackSpeed]);

  const handleGenerate = async () => {
    const outputPath = await save({ filters: [{ name: '视频文件', extensions: [exportFormat] }] });
    if (!outputPath) return;
    setIsGenerating(true); setStatusMsg('正在极速渲染中...');

    let computedResolution = '1920:1080';
    if (exportResolution === '4k') computedResolution = '3840:2160';

    if (exportResolution === 'original') {
      setStatusMsg('正在探测全轨原图极致边界...');
      let maxW = 1920;
      let maxH = 1080;
      for (const t of timeline) {
        const res = resourceMap.get(t.resourceId);
        if (res && res.type === 'image') {
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = () => {
              maxW = Math.max(maxW, img.naturalWidth);
              maxH = Math.max(maxH, img.naturalHeight);
              resolve(null);
            };
            img.onerror = resolve;
            img.src = res.path.startsWith('http') ? res.path : convertFileSrc(res.path);
          });
        }
      }
      maxW = maxW + (maxW % 2); // FFmpeg H264 要求宽高为偶数
      maxH = maxH + (maxH % 2);
      computedResolution = `${maxW}:${maxH}`;
    }

    try {
      await invoke('generate_video', {
        payload: {
          items: timeline.map(t => ({ ...t, path: resourceMap.get(t.resourceId)?.path })),
          resourcePaths: resources.map(r => ({ id: r.id, path: r.path })),
          audioClips: audioItems.map(a => ({ ...a, path: resourceMap.get(a.resourceId)?.path })),
          outputPath,
          resolution: computedResolution,
          fps: parseInt(exportFps, 10),
          quality: exportQuality,
          codec: exportCodec,
          hdr: exportHdr,
          autoOpen: true
        }
      });
      setStatusMsg('导出成功！');
    } catch (e) { setStatusMsg(`导出失败: ${e}`); }
    finally { setIsGenerating(false); }
  };

  // 左侧面板搜索/虚拟滚动已抽离

  // 性能优化：memo 化计算，避免每次渲染重算
  const maxVideoEnd = useMemo(() => timeline.reduce((acc, t) => acc + t.duration, 0), [timeline]);
  const maxAudioEnd = useMemo(() => audioItems.length > 0 ? Math.max(...audioItems.map(a => a.timelineStart + a.duration)) : 0, [audioItems]);
  const maxTime = useMemo(() => Math.max(maxVideoEnd, maxAudioEnd, playTime), [maxVideoEnd, maxAudioEnd, playTime]);
  const timelineWidth = useMemo(() => Math.max(8000, layout.totalVisualWidth + 1000), [layout.totalVisualWidth]);

  // computeFilter + computeTextStyles 已迁移到 features/filter-engine/useFilter.ts
  // const computeFilter = computeFilterMod;
  // const computeTextStyles = computeTextStylesMod;

  // 影视级色盘已迁移



  return {
    pps,
    setPps,
    resources,
    setResources,
    project,
    setTimeline,
    setAudioItems,
    setVoiceoverClips,
    undo,
    redo,
    historyLength,
    redoLength,
    commitSnapshotNow,
    timeline,
    audioItems,
    voiceoverClips,
    selectedIds,
    setSelectedIds,
    selectedTextIds,
    setSelectedTextIds,
    selectedAudioIds,
    setSelectedAudioIds,
    selectedVoiceoverIds,
    setSelectedVoiceoverIds,
    isPlaying,
    setIsPlaying,
    playTime,
    setPlayTime,
    activeTab,
    setActiveTab,
    propertyTab,
    setPropertyTab,
    setLibTab,
    statusMsg,
    setStatusMsg,
    showShortcuts,
    setShowShortcuts,
    setShowSortMenu,
    showExportPanel,
    setShowExportPanel,
    showGlobalDefaults,
    setShowGlobalDefaults,
    setShowMoreMenu,
    isDragOver,
    setIsDragOver,
    setIsGenerating,
    contextMenu,
    setContextMenu,
    selectionBox,
    setSelectionBox,
    crop,
    setCrop,
    isCropping,
    setIsCropping,
    isEditingAudio,
    setIsEditingAudio,
    isDraggingHead,
    setIsDraggingHead,
    isJumping,
    setIsJumping,
    localDuration,
    setLocalDuration,
    theme,
    exportFormat,
    exportResolution,
    exportFps,
    exportQuality,
    exportCodec,
    exportHdr,
    sortMode,
    setSortMode,
    globalDefaults,
    monitorRes,
    setMonitorRes,
    selectedResourceIds,
    setSelectedResourceIds,
    audioBlobs,
    setAudioBlobs,
    previewCache,
    setPreviewCache,
    playbackSpeed,
    setPlaybackSpeed,
    _setShowAdvancedExport,
    globalDefaultsRef,
    isOverridden,
    faceWorkerRef,
    timelineRef,
    audioItemsRef,
    selectedIdsRef,
    selectedAudioIdsRef,
    selectedVoiceoverIdsRef,
    resourcesRef,
    ppsRef,
    restoreInheritance,
    favTrans,
    setFavTrans,
    favAnims,
    setFavAnims,
    toggleFavTrans,
    toggleFavAnim,
    timelineScrollRef,
    playheadRef,
    timeTextRef,
    monitorVideoRef,
    clickTimesRef,
    lastSyncTimeRef,
    playTimeRef,
    maxPlayTime,
    playLineLeft,
    handleTripleClickZone,
    togglePlay,
    splitAtPlayhead,
    saveProject,
    loadProject,
    handleTimelineWheel,
    seekToX,
    handleTimelineMouseMove,
    handleTimelineMouseUp,
    handleTimelineSelect,
    handleTimelineRemove,
    handleTimelineTrim,
    handleTimelineContextMenu,
    handleAudioSelect,
    handleTimelineDoubleClick,
    resourceMap,
    addedResourceIds,
    getEffectiveSrc,
    updateSelectedProperty,
    sliderUndoFlag,
    updatePropertyWithUndo,
    finalizeSliderUndo,
    updateAudioItem,
    stitchSelectedAudioGaps,
    applyAllToTimeline,
    executeAudioCut,
    handleImport,
    handleRevealInExplorer,
    handleConvertDNG,
    removeFromLibrary,
    handleLibToggle,
    handleLibSelectPreview,
    handleLibAdd,
    selectedItem,
    monitorSrc,
    handleGenerate,
    maxVideoEnd,
    maxAudioEnd,
    maxTime,
    timelineWidth,
    ingestQueue,
    setIngestQueue,
    layout
  };
}
