import { useAppContext } from '../hooks/useAppContext';
import { GlobalDefaultsPanel } from './GlobalDefaultsPanel';
import { ImagePropertyPanel } from './ImagePropertyPanel';
import { VideoPropertyPanel } from './VideoPropertyPanel';
import { AudioPropertyPanel } from './AudioPropertyPanel';
import { VoiceoverPropertyPanel } from './VoiceoverPropertyPanel';
import { ExportPanel } from './ExportPanel';
import { ProjectDashboard } from './ProjectDashboard';
import './RightPanel.css';




export function RightPanel() {
  const {
    showGlobalDefaults, setShowGlobalDefaults,
    showExportPanel, setShowExportPanel,
    activeTab, setActiveTab,
    selectedIds,
    selectedAudioIds,
    timeline,
    setTimeline,
    selectedItem,
    propertyTab, setPropertyTab,
    setStatusMsg,
    updateSelectedProperty,
    commitSnapshotNow,
    isOverridden,
    restoreInheritance,
    resourceMap,
    localDuration, setLocalDuration,
    updatePropertyWithUndo,
    finalizeSliderUndo,
    applyAllToTimeline,
    audioItems, setAudioItems,
    selectedTextIds, setSelectedTextIds,
    isCropping, setIsCropping,
    crop, setCrop,
    favTrans, toggleFavTrans,
    favAnims, toggleFavAnim,
    setSelectedAudioIds,
    setSelectedVoiceoverIds,
    selectedVoiceoverIds,
    voiceoverClips, setVoiceoverClips,
    updateAudioItem,
    isEditingAudio, setIsEditingAudio,
    executeAudioCut,
    stitchSelectedAudioGaps,
    handleGenerate
  } = useAppContext();

  return (
    <div className="glass-panel" style={{ flex: '0 0 24%', minWidth: 260, maxWidth: 380, display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header-ios" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="header-title" style={{ fontSize: 12 }}>
          {showGlobalDefaults ? '⚙️ 全局默认设置' : showExportPanel ? '🚀 导出设置' : (
            selectedIds.size > 1 ? `🎨 批量编辑 (${selectedIds.size}项)` :
              selectedIds.size === 1 ? (
                (() => {
                  const item = Array.from(selectedIds)[0];
                  const tItem = timeline.find(t => t.id === item);
                  const isVid = tItem && resourceMap.get(tItem.resourceId)?.type === 'video';
                  return isVid ? '🎬 视频属性' : '🎨 照片属性';
                })()
              ) :
                selectedAudioIds.size > 0 ? '🎵 音频属性' :
                selectedVoiceoverIds.size > 0 ? '🎙️ 配音属性' :
                  '💡 项目信息'
          )}
        </span>
        {(showGlobalDefaults || showExportPanel) && <button className="ios-button-small ios-button ios-button-subtle" style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, color: 'rgba(255,255,255,0.5)' }} onClick={() => { setShowGlobalDefaults(false); setShowExportPanel(false); setActiveTab('effects'); }}>← 返回</button>}
      </div>
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto', scrollBehavior: 'smooth' }}>
        {showGlobalDefaults ? (
          <GlobalDefaultsPanel favAnims={favAnims} toggleFavAnim={toggleFavAnim} commitSnapshotNow={commitSnapshotNow} />
        ) : showExportPanel ? (
          <ExportPanel handleGenerate={handleGenerate} />
        ) :
          activeTab === 'effects' ? (
            (() => {
              if (selectedIds.size > 0) {
                const firstId = Array.from(selectedIds)[0];
                const tItem = timeline.find(t => t.id === firstId);
                const isVideoSelected = tItem && resourceMap.get(tItem.resourceId)?.type === 'video';
                if (isVideoSelected) {
                  return (
                    <VideoPropertyPanel
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
                      restoreInheritance={restoreInheritance as any}
                      resourceMap={resourceMap}
                      updatePropertyWithUndo={updatePropertyWithUndo as any}
                      finalizeSliderUndo={finalizeSliderUndo}
                      applyAllToTimeline={applyAllToTimeline}
                      audioItems={audioItems}
                      selectedTextIds={selectedTextIds}
                      setSelectedTextIds={setSelectedTextIds}
                      favTrans={favTrans}
                      toggleFavTrans={toggleFavTrans}
                    />
                  );
                } else {
                  return (
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
                  restoreInheritance={restoreInheritance as any}
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
                );
                }
              } else if (selectedAudioIds.size > 0) {
                return (
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
                );
              } else if (selectedVoiceoverIds.size > 0) {
                return (
                  <VoiceoverPropertyPanel
                    selectedVoiceoverIds={selectedVoiceoverIds}
                    setSelectedAudioIds={setSelectedAudioIds}
                    setSelectedVoiceoverIds={setSelectedVoiceoverIds}
                    voiceoverClips={voiceoverClips}
                    setVoiceoverClips={setVoiceoverClips}
                  />
                );
              } else {
                return <ProjectDashboard />;
              }
            })()
          ) : (
            <ExportPanel handleGenerate={handleGenerate} />
          )}
      </div>
    </div>
  );
}
