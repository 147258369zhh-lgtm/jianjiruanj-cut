import { useAppContext } from '../hooks/useAppContext';
import React from 'react';
import { timeToX, xToTime as xToLogicalTime } from '../utils/timelineLayout';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { SortableImageCard } from './SortableImageCard';
import { AudioTrackItem } from './AudioTrackItem';
import './TimelinePanel.css';
import './TimelineItem.css';

export const TimelinePanel: React.FC = () => {
  const {
    playTime, maxPlayTime, setPlayTime, isPlaying, setIsPlaying, setStatusMsg,
    setIsJumping, isJumping, splitAtPlayhead, pps, setPps, commitSnapshotNow,
    timeline, setTimeline, audioItems, setAudioItems, timelineScrollRef,
    handleTimelineMouseMove, handleTimelineMouseUp, handleTimelineWheel,
    timelineWidth, seekToX, setIsDraggingHead, isDraggingHead, playLineLeft,
    playheadRef, selectionBox, setSelectionBox, selectedIds, setSelectedIds,
    selectedAudioIds, setSelectedAudioIds, selectedVoiceoverIds, setSelectedVoiceoverIds,
    resourceMap, previewCache, sortMode, setSortMode, handleTimelineSelect,
    handleTimelineRemove, handleTimelineContextMenu, handleTimelineTrim,
    handleTimelineDoubleClick, isEditingAudio, updateAudioItem, handleAudioSelect,
    voiceoverClips, setVoiceoverClips, handleTripleClickZone, layout
  } = useAppContext();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const autoFitAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    const visualEnd = timeline.reduce((acc, t) => acc + t.duration, 0);
    
    let changed = false;
    setAudioItems(prev => {
      const next = prev.map(a => {
        const audioEnd = a.timelineStart + a.duration;
        if (audioEnd > visualEnd + 0.1) {
          changed = true;
          const newDuration = Math.max(0.5, visualEnd - a.timelineStart);
          return {
            ...a,
            duration: newDuration,
            fadeOut: Math.min(newDuration, 2.0)
          };
        }
        return a;
      });
      return changed ? next : prev;
    });
    
    if (changed) {
      commitSnapshotNow();
      setStatusMsg("🎶 音乐已智能对齐画面总帧率，并增加尾部淡出");
    } else {
      setStatusMsg("🎶 音乐与画面已匹配，无需截断");
    }
    setTimeout(() => setStatusMsg(""), 2500);
  };

  return (
    <div className="glass-panel ios-timeline" style={{ flex: '0 0 400px', height: 400, display: 'flex', flexDirection: 'column' }}>
      <div
        className="panel-header-ios"
        style={{ height: 30, padding: '0 12px', background: 'rgba(0,0,0,0.1)', cursor: 'pointer' }}
        onDoubleClick={() => { setPlayTime(0); setIsPlaying(false); setStatusMsg(' ⏮ 跳至开头'); setTimeout(() => setStatusMsg(''), 1000); }}
        onClick={handleTripleClickZone}
        title="双击归零"
      >
        <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
          {playTime.toFixed(2)}s / {maxPlayTime.toFixed(2)}s
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="timeline-tool-btn timeline-tool-btn-primary" onClick={autoFitAudio} title="智能切断超出画面的音乐残端并添加淡出">适配长度</button>
          <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
          <button className="timeline-tool-btn" onClick={(e) => { e.stopPropagation(); setPlayTime(0); setIsPlaying(false); setIsJumping(true); setTimeout(() => setIsJumping(false), 350); setStatusMsg('⏮ 已回到起点'); setTimeout(() => setStatusMsg(''), 1200); }} title="回到起点">⏮ 跳至起点</button>
          <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
          <button className="timeline-tool-btn" onClick={(e) => { e.stopPropagation(); splitAtPlayhead(); }} title="Ctrl+B 分割">✂️ 分割</button>
          <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
          <div className="zoom-control" onClick={e => e.stopPropagation()}>
            <span>🔍</span>
            <input type="range" title="Zoom" min={8} max={120} value={pps} onChange={e => setPps(Number(e.target.value))} />
            <span>{Math.round(pps / 24 * 100)}%</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
          <button className="timeline-tool-btn" onClick={(e) => { e.stopPropagation(); commitSnapshotNow(); setTimeline([]); setAudioItems([]); }}>🗑️ 清空</button>
        </div>
      </div>

      <div
        ref={timelineScrollRef}
        className="ios-timeline-scroll"
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          position: 'relative',
          cursor: 'default',
          background: 'rgba(0,0,0,0.2)'
        }}
        onMouseMove={handleTimelineMouseMove}
        onMouseUp={handleTimelineMouseUp}
        onMouseLeave={handleTimelineMouseUp}
        onWheel={handleTimelineWheel}
      >
        {/* 1. 时间刻度尺 (Time Ruler) - 专用导航区 */}
        <div
          className="ios-time-ruler"
          style={{ width: timelineWidth }}
          onMouseDown={(e) => {
            e.stopPropagation(); // 阻止背景框选触发
            seekToX(e.clientX);
            setIsDraggingHead(true);
            const onMove = (me: MouseEvent) => seekToX(me.clientX);
            const onUp = () => {
              setIsDraggingHead(false);
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
          onDoubleClick={(e) => {
            // 需求③：双击刻度 → 跳到该时间点 + 暂停
            e.stopPropagation();
            seekToX(e.clientX);
            setIsPlaying(false);
            setIsJumping(true);
            setTimeout(() => setIsJumping(false), 350);
          }}
        >
          {/* 渲染刻度线 - 自适应密度，折叠区域自动稀疏 */}
          {(() => {
            const totalSeconds = Math.max(maxPlayTime, 30);
            let majorStep = 5;
            let minorStep = 1;
            if (pps < 10) { majorStep = 30; minorStep = 10; }
            else if (pps < 20) { majorStep = 10; minorStep = 5; }
            else if (pps < 40) { majorStep = 5; minorStep = 1; }
            else if (pps > 80) { majorStep = 2; minorStep = 0.5; }

            // 辅助函数：获取某时间点所在区段的有效 ppsEffective
            const getLocalPpsE = (t: number): number => {
              for (const item of layout.items) {
                if (t >= item.logicalStart && t < item.logicalEnd) {
                  return item.ppsEffective;
                }
              }
              return 1; // 超出区段按原速
            };

            const ticks: React.ReactNode[] = [];
            let lastMajorX = -Infinity;
            let lastMinorX = -Infinity;

            for (let t = 0; t <= totalSeconds; t += minorStep) {
              const x = timeToX(t, layout, pps);
              const isMajor = Math.abs(t % majorStep) < 0.001;
              const localE = getLocalPpsE(t);

              // 折叠区内自动稀疏：major标签至少间隔40px，minor刻度至少间隔8px
              if (isMajor) {
                if (x - lastMajorX < 40 && localE < 0.9) continue;
                lastMajorX = x;
              } else {
                if (x - lastMinorX < 8 && localE < 0.9) continue;
                lastMinorX = x;
              }

              ticks.push(
                <React.Fragment key={t}>
                  <div
                    className={`ruler-tick ${isMajor ? 'major' : ''}`}
                    style={{ left: x }}
                  />
                  {isMajor && (
                    <div className="ruler-label" style={{ left: x }}>
                      {t >= 60 ? `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}` : `${Math.floor(t)}s`}
                    </div>
                  )}
                </React.Fragment>
              );
            }
            return ticks;
          })()}
        </div>

        {/* 播放指针 (三角形拓展抓手 + 加大热区) */}
        <div
          ref={playheadRef}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 1,
            zIndex: 800,
            transform: `translateX(${playLineLeft}px)`,
            transition: isJumping ? 'transform 0.3s ease-out' : ((isPlaying || isDraggingHead) ? 'none' : 'transform 0.1s linear'),
            pointerEvents: 'none',
          }}
        >
          {/* 三角形头部抓手 */}
          <div style={{
            position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
            borderTop: '10px solid var(--ios-indigo)',
            filter: 'drop-shadow(0 2px 4px rgba(99,102,241,0.5))',
            pointerEvents: 'auto', cursor: 'grab',
            zIndex: 810,
          }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsDraggingHead(true);
              document.body.style.cursor = 'grabbing';
              document.body.style.userSelect = 'none';
              const onMove = (me: MouseEvent) => { me.preventDefault(); seekToX(me.clientX); };
              const onUp = () => {
                setIsDraggingHead(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
          {/* 竖线 */}
          <div style={{
            position: 'absolute', top: 8, bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: 2, background: 'var(--ios-indigo)',
            boxShadow: '0 0 8px var(--ios-indigo-glow)',
            borderRadius: 1,
          }} />
          {/* 透明宽热区 (20px 宽可点击拖拽) */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: 20, cursor: 'grab', pointerEvents: 'auto',
          }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsDraggingHead(true);
              document.body.style.cursor = 'grabbing';
              document.body.style.userSelect = 'none';
              const onMove = (me: MouseEvent) => { me.preventDefault(); seekToX(me.clientX); };
              const onUp = () => {
                setIsDraggingHead(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
        </div>

        <div
          style={{
            width: timelineWidth,
            padding: '10px 0 10px 0',
            position: 'relative',
            marginTop: 0
          }}
          onMouseDown={(e) => {
            // 只有点击背景（非元素）时才触发框选
            if (e.button === 0 && e.currentTarget === e.target) {
              if (e.ctrlKey) {
                const rect = timelineScrollRef.current?.getBoundingClientRect();
                if (rect) {
                  const startX = e.clientX - rect.left + timelineScrollRef.current!.scrollLeft;
                  setSelectionBox({ x1: startX, x2: startX, y: 0, h: 370 });
                }
              } else {
                setSelectedIds(new Set());
                setSelectedAudioIds(new Set()); setSelectedVoiceoverIds(new Set());
                setSelectedVoiceoverIds(new Set());
              }
            }
          }}
        >
          {selectionBox && (
            <div
              className="ios-selection-box"
              style={{
                left: Math.min(selectionBox.x1, selectionBox.x2),
                width: Math.abs(selectionBox.x2 - selectionBox.x1),
                top: 10,
                height: 250
              }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', height: 210, marginBottom: 8 }}>
            {/* 🔴 高级感“图片轨道”表头：全覆盖区块 + 顶级参数级对齐 */}
            <div style={{ width: 60, flexShrink: 0, height: '100%', padding: '2px 4px 2px 2px', boxSizing: 'border-box' }}>
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderRadius: 6, cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(12px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (timeline.length > 0 && selectedIds.size === timeline.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(timeline.map((t: any) => t.id)));
                }
                setSelectedAudioIds(new Set());
                setSelectedVoiceoverIds(new Set());
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1', opacity: 0.9 }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1, opacity: 0.9 }}>图片</div>
              </div>
            </div>
            {timeline.length === 0 && (
              <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.18)', fontSize: 12, border: '1.5px dashed rgba(255,255,255,0.07)', borderRadius: 12, margin: '0 4px', userSelect: 'none' }}>
                <span style={{ fontSize: 24, opacity: 0.5 }}>📷</span>
                <span>将照片/视频拖入此处，或在左侧导入并点击卡片添加</span>
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToParentElement, restrictToHorizontalAxis]} onDragEnd={(e) => {
              const { active, over } = e;
              // 拖动后自动标记为手动排序
              if (over && active.id !== over.id && sortMode !== 'manual') {
                setSortMode('manual');
                setStatusMsg('✋ 拖动后已切换为手动排序'); setTimeout(() => setStatusMsg(''), 1500);
              }
              if (over && active.id !== over.id) setTimeline(items => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id)));
            }}>
              <div style={{ display: 'flex', gap: 0, height: '100%' }}>
                <SortableContext items={timeline.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                  {timeline.map((item, _idx) => {
                    const isMulti = selectedIds.size > 1 && selectedIds.has(item.id);
                    return (
                      <SortableImageCard
                        key={item.id} item={item} resource={resourceMap.get(item.resourceId)}
                        isSelected={selectedIds.has(item.id)}
                        isMultiSelected={isMulti}
                        onSelect={handleTimelineSelect}
                        onRemove={handleTimelineRemove}
                        pps={pps} previewUrl={previewCache[resourceMap.get(item.resourceId)?.path || '']}
                        onContextMenu={handleTimelineContextMenu}
                        onTrimDuration={handleTimelineTrim}
                        onDoubleClickCard={handleTimelineDoubleClick}
                        layout={layout}
                      />
                    );
                  })}
                </SortableContext>
              </div>
            </DndContext>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', height: 50, marginTop: 0 }}>
            {/* 🔴 高级感“音频轨道”表头：全覆盖区块 + 顶级参数级对齐 */}
            <div style={{ width: 60, flexShrink: 0, height: '100%', padding: '2px 4px 2px 2px', boxSizing: 'border-box' }}>
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                borderRadius: 6, cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(12px)', boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (audioItems.length > 0 && selectedAudioIds.size === audioItems.length) {
                  setSelectedAudioIds(new Set());
                } else {
                  setSelectedAudioIds(new Set(audioItems.map((a: any) => a.id)));
                }
                setSelectedIds(new Set());
                setSelectedVoiceoverIds(new Set());
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 8px #a855f7', opacity: 0.9 }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1 }}>音频</div>
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1, height: 50, overflow: 'visible' }}>
              {audioItems.map(item => {
                const isItPlaying = isPlaying && playTime >= item.timelineStart && playTime < (item.timelineStart + item.duration);
                return (
                  <AudioTrackItem
                    key={item.id}
                    item={item}
                    resource={resourceMap.get(item.resourceId)}
                    isSelected={selectedAudioIds.has(item.id)}
                    onSelect={handleAudioSelect}
                    pps={pps}
                    isPlaying={isItPlaying}
                    editingMode={isEditingAudio && selectedAudioIds.has(item.id)}
                    onUpdateItem={updateAudioItem}
                    layout={layout}
                  />
                );
              })}
            </div>
          </div>

          {/* 配音轨 (绿色主题) */}
          <div style={{ display: 'flex', alignItems: 'center', height: 50, marginTop: 0 }}>
            {/* 🔴 高级感“配音轨道”表头：全覆盖区块 + 顶级参数级对齐 */}
            <div style={{ width: 60, flexShrink: 0, height: '100%', padding: '2px 4px 2px 2px', boxSizing: 'border-box' }}>
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderRadius: 6, cursor: 'pointer',
                background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)',
                backdropFilter: 'blur(12px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (voiceoverClips.length > 0 && selectedVoiceoverIds.size === voiceoverClips.length) {
                  setSelectedVoiceoverIds(new Set());
                } else {
                  setSelectedVoiceoverIds(new Set(voiceoverClips.map((v: any) => v.id)));
                }
                setSelectedIds(new Set());
                setSelectedAudioIds(new Set());
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', opacity: 1 }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: 1 }}>配音</div>
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1, height: 50, overflow: 'visible' }}>
              {voiceoverClips.map((clip: any) => {
                const left = timeToX(clip.timelineStart, layout, pps, 0);
                const right = timeToX(clip.timelineStart + clip.duration, layout, pps, 0);
                const width = right - left;
                const isActive = isPlaying && playTime >= clip.timelineStart && playTime < (clip.timelineStart + clip.duration);
                return (
                  <div key={clip.id}
                    onMouseDown={(e) => {
                      if (e.target instanceof HTMLDivElement && e.target.innerText === '✕') return; // Cancel if closing
                      e.stopPropagation();
                      // Toggle: 再次点击已选中的配音则取消选择
                      if (selectedVoiceoverIds.size === 1 && selectedVoiceoverIds.has(clip.id)) {
                        setSelectedVoiceoverIds(new Set());
                      } else {
                        setSelectedVoiceoverIds(new Set([clip.id]));
                      }
                      setSelectedIds(new Set());
                      setSelectedAudioIds(new Set());
                      const startX = e.clientX;
                      const startVisualX = timeToX(clip.timelineStart, layout, pps, 0);
                      const onMove = (me: MouseEvent) => {
                        const deltaX = me.clientX - startX;
                        const newVisualX = startVisualX + deltaX;
                        const newTime = xToLogicalTime(newVisualX, layout, pps, 0);
                        setVoiceoverClips((prev: any[]) => prev.map((v: any) => v.id === clip.id ? { ...v, timelineStart: Math.max(0, newTime) } : v));
                      };
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                    style={{
                      position: 'absolute', left, width, height: 40, top: 5, boxSizing: 'border-box',
                      background: isActive ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.1)',
                      border: selectedVoiceoverIds.has(clip.id) ? '2px solid #34d399' : '1px solid rgba(16,185,129,0.4)',
                      borderRadius: 8,
                      boxShadow: selectedVoiceoverIds.has(clip.id) ? '0 0 12px rgba(52,211,153,0.5)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
                      cursor: 'grab', transition: 'all 0.2s', overflow: 'hidden',
                      zIndex: selectedVoiceoverIds.has(clip.id) ? 10 : 1,
                    }}>
                    <span style={{ fontSize: 12 }}>🎙️</span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: '#10B981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.name || '配音'}</div>
                      <div style={{ fontSize: 8, color: 'rgba(16,185,129,0.6)' }}>{clip.duration.toFixed(1)}s</div>
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setVoiceoverClips((prev: any[]) => prev.filter((v: any) => v.id !== clip.id)); }} style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', zIndex: 50 }}>✕</div>
                    
                    {/* 配音轨左侧缩放手柄 */}
                    <div
                      className="trim-handle trim-handle-left"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const startX = e.clientX;
                        const startDur = clip.duration;
                        const startStart = clip.timelineStart;
                        const onMove = (me: MouseEvent) => {
                          const deltaPx = me.clientX - startX;
                          const deltaDur = deltaPx / pps;
                          const newDur = Math.max(0.3, startDur - deltaDur);
                          const actualDelta = startDur - newDur;
                          setVoiceoverClips((prev: any[]) => prev.map((v: any) => v.id === clip.id ? { ...v, duration: newDur, timelineStart: startStart + actualDelta } : v));
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                      }}
                    />
                    
                    {/* 配音轨右侧缩放手柄 */}
                    <div
                      className="trim-handle trim-handle-right"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const startX = e.clientX;
                        const startDur = clip.duration;
                        const onMove = (me: MouseEvent) => {
                          const deltaPx = me.clientX - startX;
                          const deltaDur = deltaPx / pps;
                          const newDur = Math.max(0.3, startDur + deltaDur);
                          setVoiceoverClips((prev: any[]) => prev.map((v: any) => v.id === clip.id ? { ...v, duration: newDur } : v));
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
