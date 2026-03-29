import { useEffect, useRef, MutableRefObject } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { Resource, AudioTimelineItem } from '../types';

interface UseAudioSyncArgs {
  isPlaying: boolean;
  resources: Resource[];
  audioItems: AudioTimelineItem[];
  voiceoverClips: any[];
  resourceMap: Map<string, Resource>;
  audioBlobs: Record<string, string>;
  previewCache: Record<string, string>;
  setAudioBlobs: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  setPreviewCache: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  playTimeRef: MutableRefObject<number>;
}

export function useAudioSync({
  isPlaying, resources, audioItems, voiceoverClips,
  resourceMap, audioBlobs, previewCache,
  setAudioBlobs, setPreviewCache, playTimeRef
}: UseAudioSyncArgs) {
  const audioElsRef = useRef<{ [id: string]: HTMLAudioElement }>({});

  // ─── 自动资源预热引擎 (Blob 转换 — 兼容 Tauri WebView2 音频播放) ───
  useEffect(() => {
    resources.filter(r => r.type === 'audio').forEach(res => {
      if (audioBlobs[res.id]) return;
      let fetchUrl: string;
      if (res.path.startsWith('http') || res.path.startsWith('blob:')) {
        fetchUrl = res.path;
      } else if (res.path.startsWith('/')) {
        fetchUrl = res.path;
      } else {
        fetchUrl = convertFileSrc(res.path);
      }
      fetch(fetchUrl)
        .then(r => r.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setAudioBlobs(prev => ({ ...prev, [res.id]: url }));
        })
        .catch(e => console.warn(`[Audio Blob] 预热失败: ${res.name}`, fetchUrl, e));
    });
  }, [resources, audioBlobs]);

  // ─── DNG 预览缓存 ───
  useEffect(() => {
    resources.filter(r => r.type === 'image' && r.path.toLowerCase().endsWith('.dng')).forEach(res => {
      if (previewCache[res.path]) return;
      invoke('get_preview_url', { path: res.path })
        .then((url: any) => {
          setPreviewCache(prev => ({ ...prev, [res.path]: url }));
        })
        .catch(e => console.error(`Failed to fetch DNG preview for ${res.name}`, e));
    });
  }, [resources, previewCache]);

  // ─── getEffectiveSrc: DNG 走预览缓存，其他走 convertFileSrc ───
  const getEffectiveSrc = (path: string) => {
    if (path.toLowerCase().endsWith('.dng')) {
      const p = previewCache[path];
      return p ? (p.startsWith('http') || p.startsWith('blob:') ? p : convertFileSrc(p)) : '';
    }
    return convertFileSrc(path);
  };

  // ─── 音频同步 RAF 循环 ───
  useEffect(() => {
    if (!isPlaying) {
      Object.values(audioElsRef.current).forEach(a => {
        try { a.pause(); } catch (e) { }
      });
      return;
    }

    let audioRafId: number;
    const syncAudio = () => {
      const currentPlayTime = playTimeRef.current;

      audioItems.forEach(item => {
        const res = resourceMap.get(item.resourceId);
        if (!res) return;

        // 优先用 blob 缓存，其次判断路径类型
        const playPath = audioBlobs[res.id]
          || (res.path.startsWith('http') || res.path.startsWith('/') || res.path.startsWith('blob:')
            ? res.path
            : convertFileSrc(res.path));

        let audio = audioElsRef.current[item.id];
        if (!audio || (audio.src !== playPath && !audio.src.startsWith('blob:'))) {
          if (audio) { audio.pause(); audio.src = ""; }
          audio = new Audio();
          // 仅对外部 URL 设置 crossOrigin，Tauri asset 协议不需要
          if (playPath.startsWith('http') && !playPath.includes('asset.localhost')) {
            audio.crossOrigin = 'anonymous';
          }
          audio.preload = 'auto';
          audio.src = playPath;
          audio.onerror = (e) => console.warn('[Audio Error]', item.id, playPath, e);
          audioElsRef.current[item.id] = audio;
        }

        const itemEnd = item.timelineStart + item.duration;
        const targetPos = item.startOffset + (currentPlayTime - item.timelineStart);

        if (currentPlayTime >= item.timelineStart && currentPlayTime < itemEnd) {
          // 计算淡入淡出音量 (任务7)
          const baseVol = item.volume ?? 1.0;
          const elapsed = currentPlayTime - item.timelineStart;
          const remaining = itemEnd - currentPlayTime;
          const fi = item.fadeIn || 0;
          const fo = item.fadeOut || 0;
          let fadeMul = 1.0;
          if (fi > 0 && elapsed < fi) fadeMul = Math.min(fadeMul, elapsed / fi);
          if (fo > 0 && remaining < fo) fadeMul = Math.min(fadeMul, remaining / fo);
          const effectiveVol = Math.max(0, Math.min(1, baseVol * fadeMul));

          if (audio.paused) {
            audio.currentTime = targetPos;
            audio.volume = effectiveVol;
            const p = audio.play();
            if (p) p.catch(() => { });
          } else {
            // 放宽容差到 0.5s，避免频繁 seek 导致反复卡顿
            if (Math.abs(audio.currentTime - targetPos) > 0.5) {
              audio.currentTime = targetPos;
            }
            audio.volume = effectiveVol;
          }
        } else {
          if (!audio.paused) audio.pause();
        }
      });

      // 配音轨同步播放
      voiceoverClips.forEach((clip: any) => {
        const playPath = convertFileSrc(clip.path);
        let audio = audioElsRef.current[clip.id];
        if (!audio) {
          audio = new Audio();
          audio.preload = 'auto';
          audio.src = playPath;
          audio.onerror = (e) => console.warn('[VO Error]', clip.id, e);
          audioElsRef.current[clip.id] = audio;
        }
        const itemEnd = clip.timelineStart + clip.duration;
        const targetPos = (clip.startOffset || 0) + (currentPlayTime - clip.timelineStart);
        if (currentPlayTime >= clip.timelineStart && currentPlayTime < itemEnd) {
          const vol = clip.volume ?? 1.0;
          if (audio.paused) {
            audio.currentTime = targetPos;
            audio.volume = vol;
            const p = audio.play(); if (p) p.catch(() => {});
          } else {
            if (Math.abs(audio.currentTime - targetPos) > 0.5) audio.currentTime = targetPos;
            audio.volume = vol;
          }
        } else {
          if (!audio.paused) audio.pause();
        }
      });

      audioRafId = requestAnimationFrame(syncAudio);
    };

    audioRafId = requestAnimationFrame(syncAudio);
    return () => cancelAnimationFrame(audioRafId);
  }, [isPlaying, audioItems, resourceMap, audioBlobs, voiceoverClips]);

  return { getEffectiveSrc, audioElsRef };
}
