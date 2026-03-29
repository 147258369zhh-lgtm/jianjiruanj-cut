import { useAppContext } from '../hooks/useAppContext';
import { GlobalDefaultsPanel } from './GlobalDefaultsPanel';
import { ImagePropertyPanel } from './ImagePropertyPanel';
import { AudioPropertyPanel } from './AudioPropertyPanel';
import { ExportPanel } from './ExportPanel';




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
    updateAudioItem,
    isEditingAudio, setIsEditingAudio,
    executeAudioCut,
    stitchSelectedAudioGaps,
    handleGenerate
  } = useAppContext();

  return (
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
  );
}
