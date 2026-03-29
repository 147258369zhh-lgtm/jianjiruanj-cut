import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { useAppContext } from '../../hooks/useAppContext';
import './ExportProgressOverlay.css';

export const ExportProgressOverlay: React.FC = () => {
  const { isGenerating } = useStore(useShallow(state => ({
    isGenerating: state.isGenerating
  })));

  const { timeline } = useAppContext();

  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 当 isGenerating 变化时启停计时器
  useEffect(() => {
    if (isGenerating) {
      setProgress(0);
      setElapsedSec(0);
      startTimeRef.current = Date.now();

      // 前端模拟进度：基于轨道时长估算渲染速度 (~2x 实时)
      const totalDuration = timeline.reduce((acc, t) => acc + t.duration, 0);
      const estimatedTotalMs = Math.max(totalDuration * 500, 5000); // 粗估总耗时

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedSec(Math.floor(elapsed / 1000));

        // 使用 ease-out 曲线模拟进度（永远不到100%，等真正完成再跳满）
        const rawProgress = Math.min(elapsed / estimatedTotalMs, 0.95);
        const easedProgress = 1 - Math.pow(1 - rawProgress, 3); // ease-out cubic
        setProgress(Math.min(easedProgress * 100, 95));
      }, 200);
    } else {
      // 完成时短暂显示100%
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (startTimeRef.current > 0) {
        setProgress(100);
        const timer = setTimeout(() => {
          setProgress(0);
          setElapsedSec(0);
          startTimeRef.current = 0;
        }, 1500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isGenerating, timeline]);

  // 不显示（未在导出 且 进度归零）
  if (!isGenerating && progress === 0) return null;

  const circumference = 2 * Math.PI * 62;
  const dashOffset = circumference * (1 - progress / 100);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const estimatedRemaining = progress > 5
    ? Math.max(0, Math.round(elapsedSec * (100 - progress) / progress))
    : null;

  return (
    <div className="export-overlay">
      <div className="export-progress-card">
        <div className="export-title">
          {progress >= 100 ? '✅ 渲染完成！' : '正在极速渲染中'}
          {progress < 100 && (
            <span className="export-dots">
              <span /><span /><span />
            </span>
          )}
        </div>
        <div className="export-subtitle">请勿关闭窗口，后台正在全速运转</div>

        {/* 环形进度 */}
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
            {Math.round(progress)}<span>%</span>
          </div>
        </div>

        {/* 信息行 */}
        <div className="export-info">
          <div className="export-info-row">
            <span className="export-info-key">已用时间</span>
            <span className="export-info-val">{formatTime(elapsedSec)}</span>
          </div>
          {estimatedRemaining !== null && (
            <div className="export-info-row">
              <span className="export-info-key">预估剩余</span>
              <span className="export-info-val">≈ {formatTime(estimatedRemaining)}</span>
            </div>
          )}
          <div className="export-info-row">
            <span className="export-info-key">轨道片段</span>
            <span className="export-info-val">{timeline.length} 张</span>
          </div>
        </div>
      </div>
    </div>
  );
};
