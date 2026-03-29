
import { useProjectHistory } from './hooks/useProjectHistory';
import { usePlaybackEngine } from './hooks/usePlaybackEngine';
import { useAudioSync } from './hooks/useAudioSync';
import { useProjectIO } from './hooks/useProjectIO';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDragImport } from './hooks/useDragImport';
import { useTimelineActions } from './hooks/useTimelineActions';
import { useResourceManager } from './hooks/useResourceManager';


import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import { convertFileSrc } from '@tauri-apps/api/core';
// import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import 'react-image-crop/dist/ReactCrop.css';
import "./App.css";
import "./Win11Theme.css";

import { Resource, AudioTimelineItem, TimelineItem, GlobalDefaults, GLOBAL_DEFAULTS_INIT, TextOverlay } from './types';
// import { computeFilter as computeFilterMod, computeTextStyles as computeTextStylesMod } from './features/filter-engine/useFilter';
// import { formatTime as formatTimeMod } from './utils/formatTime';



// ProSlider 已迁移到 components/ProSlider.tsx
// import { getMediaDuration } from './utils/mediaUtils';

// 莫兰迪绚烂色谱常量已迁移至 utils/constants

// AudioWaveform 已迁移到 components/AudioWaveform.tsx

// IosSelect 已迁移到 components/IosSelect.tsx




// 缩略图引擎已迁移到 utils/thumbnail.ts
// SortableImageCard 已迁移到 components/SortableImageCard.tsx

// AudioTrackItem 已迁移到 components/AudioTrackItem.tsx

import { LeftPanel } from './components/LeftPanel';
import { ExportPanel } from './components/ExportPanel';
import { GlobalDefaultsPanel } from './components/GlobalDefaultsPanel';
import { AudioPropertyPanel } from './components/AudioPropertyPanel';
import { ImagePropertyPanel } from './components/ImagePropertyPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { ShortcutsPanel } from './components/ShortcutsPanel';
import { DropOverlay } from './components/DropOverlay';
import { ContextMenuWidget } from './components/ContextMenuWidget';

import { MonitorPanel } from './components/MonitorPanel';
import { ProjectToolbar } from './components/ProjectToolbar';
// import { ResourceCardItem } from './components/ResourceCardItem';

// ─── 主应用 ──────────────────────────────────────────────────────
import { useAppController } from './hooks/useAppController';

function App() {
  const {
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
    timelineWidth
  } = useAppController();

  return (
    <div className="app-root-container">
      <div className={`ios-layout ${theme === 'win11' ? 'theme-win11' : ''}`} onClick={() => { setContextMenu(null); setShowShortcuts(false); setShowSortMenu(false); setShowMoreMenu(false); }}>


        {/* 全局浮窗 Toast 通知 */}
        {statusMsg && (
          <div className="global-toast">
            {statusMsg}
          </div>
        )}

        {/* 快捷键提示面板 */}

        <ShortcutsPanel showShortcuts={showShortcuts} />
        <DropOverlay isDragOver={isDragOver} />
        <ContextMenuWidget
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          commitSnapshotNow={commitSnapshotNow}
          setTimeline={setTimeline as any}
          setSelectedIds={setSelectedIds}
          splitAtPlayhead={splitAtPlayhead}
          setAudioItems={setAudioItems as any}
          setSelectedAudioIds={setSelectedAudioIds}
          setSelectedVoiceoverIds={setSelectedVoiceoverIds}
        />



        {/* ═══ 顶部项目操作栏 (任务1: 项目级主流程) ═══ */}
        <ProjectToolbar
          handleImport={handleImport}
          timeline={timeline}
          setTimeline={setTimeline}
          resources={resources}
          commitSnapshotNow={commitSnapshotNow}
          undo={undo}
          redo={redo}
          historyLength={historyLength}
          redoLength={redoLength}
          saveProject={saveProject}
          loadProject={loadProject}
        />

        {/* ═══ 主内容区 ═══ */}
        <div style={{ flex: 1, display: 'flex', gap: 8, minHeight: 0 }}>

          {/* 1. 左侧资源区 (任务2: 照片/音乐/文字 三标签) */}
          <LeftPanel
            resources={resources}
            setResources={setResources}
            getEffectiveSrc={getEffectiveSrc}
            globalDefaultsRef={globalDefaultsRef}
            commitSnapshotNow={commitSnapshotNow}
            setTimeline={setTimeline}
            setAudioItems={setAudioItems}
            removeFromLibrary={removeFromLibrary}
            handleLibToggle={handleLibToggle}
            handleLibSelectPreview={handleLibSelectPreview}
            handleLibAdd={handleLibAdd}
            handleConvertDNG={handleConvertDNG}
            handleRevealInExplorer={handleRevealInExplorer}
            previewCache={previewCache}
            handleImport={handleImport}
            setVoiceoverClips={setVoiceoverClips}
            addedResourceIds={addedResourceIds}
          />


          {/* 2. 监视器 */}
          <MonitorPanel
            playTime={playTime}
            maxPlayTime={maxPlayTime}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            setPlayTime={setPlayTime}
            monitorSrc={monitorSrc}
            resourceMap={resourceMap}
            selectedIds={selectedIds}
            selectedTextIds={selectedTextIds}
            setSelectedTextIds={setSelectedTextIds}
            setTimeline={setTimeline}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
            timeTextRef={timeTextRef}
            monitorVideoRef={monitorVideoRef}
          />

          {/* 3. 右侧属性面板（上下文驱动 + 编辑/导出模式切换） */}
          <div className="glass-panel" style={{ width: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header-ios" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="header-title" style={{ fontSize: 12 }}>
                {showGlobalDefaults ? '⚙️ 全局默认设置' : showExportPanel ? '🚀 导出设置' : (
                  selectedIds.size > 1 ? `🎨 批量编辑 (${selectedIds.size}项)` :
                    selectedIds.size === 1 ? '🎨 照片属性' :
                      selectedAudioIds.size > 0 ? '🎵 音频属性' :
                        '💡 项目信息'
                )}
              </span>
              {(showGlobalDefaults || showExportPanel) && <button className="ios-button-small ios-button ios-button-subtle" style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, color: 'rgba(255,255,255,0.5)' }} onClick={() => { setShowGlobalDefaults(false); setShowExportPanel(false); setActiveTab('effects'); }}>← 返回</button>}
            </div>
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', scrollBehavior: 'smooth' }}>
              {/* ═══ 全局默认设置面板 (任务6) ═══ */}
              {showGlobalDefaults ? (
                <GlobalDefaultsPanel favAnims={favAnims} toggleFavAnim={toggleFavAnim} commitSnapshotNow={commitSnapshotNow} />
              ) :
                activeTab === 'effects' ? (
                  (selectedIds.size > 0 || selectedAudioIds.size > 0) ? (
                    selectedIds.size > 0 ? (
                      <ImagePropertyPanel
                        selectedIds={selectedIds}
                        timeline={timeline}
                        setTimeline={setTimeline}
                        selectedItem={selectedItem}
                        propertyTab={propertyTab}
                        setPropertyTab={setPropertyTab}
                        setStatusMsg={setStatusMsg}
                        updateSelectedProperty={updateSelectedProperty as any}
                        commitSnapshotNow={commitSnapshotNow}
                        isOverridden={isOverridden}
                        restoreInheritance={restoreInheritance}
                        resourceMap={resourceMap}
                        localDuration={localDuration}
                        setLocalDuration={setLocalDuration}
                        updatePropertyWithUndo={updatePropertyWithUndo as any}
                        finalizeSliderUndo={finalizeSliderUndo}
                        applyAllToTimeline={applyAllToTimeline}
                        audioItems={audioItems}
                        selectedTextIds={selectedTextIds}
                        setSelectedTextIds={setSelectedTextIds}
                        isCropping={isCropping}
                        setIsCropping={setIsCropping}
                        crop={crop}
                        setCrop={setCrop}
                        favTrans={favTrans}
                        toggleFavTrans={toggleFavTrans}
                      />
                    ) : (
                      <AudioPropertyPanel
                        selectedAudioIds={selectedAudioIds}
                        setSelectedAudioIds={setSelectedAudioIds}
                        setSelectedVoiceoverIds={setSelectedVoiceoverIds}
                        audioItems={audioItems}
                        setAudioItems={setAudioItems}
                        updateAudioItem={updateAudioItem}
                        isEditingAudio={isEditingAudio}
                        setIsEditingAudio={setIsEditingAudio}
                        executeAudioCut={executeAudioCut}
                        stitchSelectedAudioGaps={stitchSelectedAudioGaps}
                      />
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 20, alignItems: 'center' }}>
                      <div style={{ fontSize: 36, opacity: 0.15 }}>📷</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.8 }}>
                        在轨道中选择片段获取效果选项
                      </div>
                      {timeline.length === 0 && (
                        <div style={{ marginTop: 8, padding: '10px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, width: '100%', boxSizing: 'border-box' }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
                            💡 <strong style={{ color: 'rgba(255,255,255,0.7)' }}>快速开始</strong><br />
                            1. 左侧 《照片》 Tab 导入素材<br />
                            2. 单击卡片 → 添加到轨道<br />
                            3. 直接拖放文件到窗口也可导入
                          </div>
                          <div
                            style={{ marginTop: 10, padding: '6px 0', textAlign: 'center', fontSize: 11, color: 'var(--ios-indigo)', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => { setShowGlobalDefaults(true); setShowExportPanel(false); }}
                          >⚙️ 配置全局默认参数</div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <ExportPanel handleGenerate={handleGenerate} />
                )}
            </div>
          </div>
        </div>

        {/* BOTTOM ZONE */}
        <TimelinePanel
          playTime={playTime}
          maxPlayTime={maxPlayTime}
          setPlayTime={setPlayTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          setStatusMsg={setStatusMsg}
          setIsJumping={setIsJumping}
          isJumping={isJumping}
          splitAtPlayhead={splitAtPlayhead}
          pps={pps}
          setPps={setPps}
          commitSnapshotNow={commitSnapshotNow}
          timeline={timeline}
          setTimeline={setTimeline}
          audioItems={audioItems}
          setAudioItems={setAudioItems}
          timelineScrollRef={timelineScrollRef}
          handleTimelineMouseMove={handleTimelineMouseMove}
          handleTimelineMouseUp={handleTimelineMouseUp}
          handleTimelineWheel={handleTimelineWheel}
          timelineWidth={timelineWidth}
          seekToX={seekToX}
          setIsDraggingHead={setIsDraggingHead}
          isDraggingHead={isDraggingHead}
          playLineLeft={playLineLeft}
          playheadRef={playheadRef}
          selectionBox={selectionBox}
          setSelectionBox={setSelectionBox}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          selectedAudioIds={selectedAudioIds}
          setSelectedAudioIds={setSelectedAudioIds}
          selectedVoiceoverIds={selectedVoiceoverIds}
          setSelectedVoiceoverIds={setSelectedVoiceoverIds}
          resourceMap={resourceMap}
          previewCache={previewCache}
          sortMode={sortMode}
          setSortMode={setSortMode}
          handleTimelineSelect={handleTimelineSelect}
          handleTimelineRemove={handleTimelineRemove}
          handleTimelineContextMenu={handleTimelineContextMenu}
          handleTimelineTrim={handleTimelineTrim}
          handleTimelineDoubleClick={handleTimelineDoubleClick}
          isEditingAudio={isEditingAudio}
          updateAudioItem={updateAudioItem}
          handleAudioSelect={handleAudioSelect}
          voiceoverClips={voiceoverClips}
          setVoiceoverClips={setVoiceoverClips}
          handleTripleClickZone={handleTripleClickZone}
        />

      </div>
    </div>
  );
}

export default App;

