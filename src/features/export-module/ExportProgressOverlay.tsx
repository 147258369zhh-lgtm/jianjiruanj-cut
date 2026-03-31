import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { useAppContext } from '../../hooks/useAppContext';
import { listen } from '@tauri-apps/api/event';
import './ExportProgressOverlay.css';

export const ExportProgressOverlay: React.FC = () => {
  const { isGenerating, exportMinimized, setExportMinimized, exportProgress, setExportProgress } = useStore(useShallow(state => ({
    isGenerating: state.isGenerating,
    exportMinimized: state.exportMinimized,
    setExportMinimized: state.setExportMinimized,
    exportProgress: state.exportProgress,
    setExportProgress: state.setExportProgress
  })));

  const { timeline } = useAppContext();

  const [elapsedSec, setElapsedSec] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const startTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen to accurate progress from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<{ progress: number }>('export-progress', (e) => {
        setExportProgress(e.payload.progress);
      });
    };
    
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [setExportProgress]);

  // Manage elapsed time timer and completion state
  useEffect(() => {
    if (isGenerating) {
      setElapsedSec(0);
      setExportProgress(0);
      setShowSuccess(false);
      startTimeRef.current = Date.now();

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedSec(Math.floor(elapsed / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // If we were generating but now stopped, show success if progress reached 100%
      if (startTimeRef.current > 0) {
        setExportProgress(100);
        setShowSuccess(true);
        const timer = setTimeout(() => {
          setShowSuccess(false);
          setExportProgress(0);
          setElapsedSec(0);
          startTimeRef.current = 0;
          setExportMinimized(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isGenerating, setExportProgress, setExportMinimized]);

  // Hide if not generating and not showing success, OR if minimized
  if ((!isGenerating && !showSuccess) || (exportMinimized && !showSuccess)) return null;

  const circumference = 2 * Math.PI * 62;
  const clampedProgress = Math.max(0, Math.min(100, exportProgress));
  const dashOffset = circumference * (1 - clampedProgress / 100);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const estimatedRemaining = clampedProgress > 5 && clampedProgress < 100
    ? Math.max(0, Math.round(elapsedSec * (100 - clampedProgress) / clampedProgress))
    : null;

  return (
    <div className="export-overlay">
      <div className="export-progress-card">
        {/* Minimize Action Header */}
        <div className="export-card-header">
          <div className="export-minimize-btn" onClick={() => setExportMinimized(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            <span>最小化后台</span>
          </div>
        </div>

        <div className="export-title">
          {showSuccess ? '✅ 渲染完成！' : '正在极速渲染中'}
          {!showSuccess && (
            <span className="export-dots">
              <span /><span /><span />
            </span>
          )}
        </div>
        <div className="export-subtitle">后端硬件编码进行中，可后台执行</div>

        {/* Circular Progress Ring */}
        <div className="export-ring-wrap">
          <svg className="export-ring-svg" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="export-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
            <circle className="export-ring-bg" cx="70" cy="70" r="62" />
            <circle
              className="export-ring-fg"
              cx="70" cy="70" r="62"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="export-percent">
            {Math.round(clampedProgress)}<span>%</span>
          </div>
        </div>

        {/* Info rows */}
        <div className="export-info">
          <div className="export-info-row">
            <span className="export-info-key">已用时间</span>
            <span className="export-info-val">{formatTime(elapsedSec)}</span>
          </div>
          {estimatedRemaining !== null && (
            <div className="export-info-row">
              <span className="export-info-key">预估剩余</span>
              <span className="export-info-val" style={{ color: '#10B981' }}>≈ {formatTime(estimatedRemaining)}</span>
            </div>
          )}
          <div className="export-info-row">
            <span className="export-info-key">渲染片段总数</span>
            <span className="export-info-val">{timeline.length} 张图片</span>
          </div>
          <div className="export-info-row">
            <span className="export-info-key">后台状态</span>
            <span className="export-info-val">稳定编码中...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
