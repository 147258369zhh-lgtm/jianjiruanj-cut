let fs = require('fs');

let appContent = fs.readFileSync('src/App.tsx', 'utf8');

let appFunctionStart = 'function App() {';
let returnStart = '  return (\n    <div className="app-container"';

let startIdx = appContent.indexOf(appFunctionStart);
let endIdx = appContent.lastIndexOf(returnStart);

let logicSection = appContent.substring(startIdx + appFunctionStart.length, endIdx);

let lines = logicSection.split('\\n');
let toExport = [];

for (let line of lines) {
  let match = line.match(/^  const \\[(.+?)\\] =/);
  if (match) {
    match[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => toExport.push(v));
    continue;
  }
  match = line.match(/^  const \\{(.+?)\\} =/);
  if (match) {
    match[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => toExport.push(v));
    continue;
  }
  match = line.match(/^  const ([\\w]+) =/);
  if (match) {
    toExport.push(match[1]);
    continue;
  }
  match = line.match(/^  let ([\\w]+) =/);
  if (match) {
    toExport.push(match[1]);
    continue;
  }
}

let specialVars = [
    'project', 'setTimeline','setAudioItems','setVoiceoverClips','undo','redo','historyLength','redoLength','commitSnapshotNow',
    'activeTab', 'setActiveTab', 'propertyTab', 'setPropertyTab', 'setLibTab',
    'statusMsg', 'setStatusMsg', 'showShortcuts', 'setShowShortcuts',
    'showSortMenu', 'setShowSortMenu', 'showExportPanel', 'setShowExportPanel', 'showGlobalDefaults', 'setShowGlobalDefaults',
    'showMoreMenu', 'setShowMoreMenu', 'isDragOver', 'setIsDragOver',
    'isGenerating', 'setIsGenerating', 'contextMenu', 'setContextMenu',
    'selectionBox', 'setSelectionBox', 'crop', 'setCrop', 'isCropping', 'setIsCropping',
    'isEditingAudio', 'setIsEditingAudio', 'isDraggingHead', 'setIsDraggingHead',
    'isJumping', 'setIsJumping', 'localDuration', 'setLocalDuration',
    'theme', 'exportFormat', 'exportResolution', 'exportFps', 'exportQuality', 'exportCodec', 'exportHdr',
    'sortMode', 'setSortMode', 'globalDefaults', 'monitorRes', 'setMonitorRes', 'selectedResourceIds', 'setSelectedResourceIds',
    'maxPlayTime', 'playLineLeft', 'handleTripleClickZone', 'togglePlay',
    'saveProject', 'loadProject',
    'pps', 'setPps', 'resources', 'setResources', 'timeline', 'audioItems', 'voiceoverClips',
    'selectedIds', 'setSelectedIds', 'selectedTextIds', 'setSelectedTextIds',
    'selectedAudioIds', 'setSelectedAudioIds', 'selectedVoiceoverIds', 'setSelectedVoiceoverIds',
    'isPlaying', 'setIsPlaying', 'playTime', 'setPlayTime',
    'audioBlobs', 'setAudioBlobs', 'previewCache', 'setPreviewCache', 'playbackSpeed', 'setPlaybackSpeed',
    'isOverridden', 'restoreInheritance', 'favTrans', 'setFavTrans', 'favAnims', 'setFavAnims',
    'toggleFavTrans', 'toggleFavAnim',
    'splitAtPlayhead', 'handleImport', 'handleGenerate',
    'timelineScrollRef', 'playheadRef', 'timeTextRef', 'monitorVideoRef',
    'globalDefaultsRef', 'faceWorkerRef', 'timelineRef', 'audioItemsRef', 'ppsRef',
    'selectedIdsRef', 'selectedAudioIdsRef', 'selectedVoiceoverIdsRef', 'resourcesRef',
    'playTimeRef', 'lastSyncTimeRef', 'clickTimesRef', 'resourceMap',
    'handleTimelineMouseMove', 'handleTimelineMouseUp', 'handleTimelineWheel',
    'timelineWidth', 'seekToX', 'handleTimelineSelect', 'handleTimelineRemove',
    'handleTimelineContextMenu', 'handleTimelineTrim', 'handleTimelineDoubleClick',
    'updateAudioItem', 'handleAudioSelect', 'executeAudioCut', 'stitchSelectedAudioGaps',
    'selectedItem', 'updateSelectedProperty', 'updatePropertyWithUndo', 'finalizeSliderUndo',
    'applyAllToTimeline', 'getEffectiveSrc', 'removeFromLibrary', 'handleLibToggle',
    'handleLibSelectPreview', 'handleLibAdd', 'handleConvertDNG', 'handleRevealInExplorer',
    'addedResourceIds'
];
specialVars.forEach(v => {
   if(!toExport.includes(v)) toExport.push(v);
});

let finalExports = Array.from(new Set(toExport)).filter(v => v !== 'next');

let imports = "import { useState, useEffect, useRef, useMemo, useCallback } from \\"react\\";\\nimport { useStore } from \\"../store\\";\\nimport { useShallow } from 'zustand/react/shallow';\\nimport { useProjectHistory } from './useProjectHistory';\\nimport { usePlaybackEngine } from './usePlaybackEngine';\\nimport { useAudioSync } from './useAudioSync';\\nimport { useProjectIO } from './useProjectIO';\\nimport { useKeyboardShortcuts } from './useKeyboardShortcuts';\\nimport { useDragImport } from './useDragImport';\\nimport { useTimelineActions } from './useTimelineActions';\\nimport { useResourceManager } from './useResourceManager';\\nimport { invoke } from \\"@tauri-apps/api/core\\";\\nimport { save } from \\"@tauri-apps/plugin-dialog\\";\\nimport { convertFileSrc } from '@tauri-apps/api/core';\\nimport { Resource, AudioTimelineItem, TimelineItem, GlobalDefaults, GLOBAL_DEFAULTS_INIT } from '../types';\\n";

let hookFile = imports + "\\nexport function useAppController() {\\n" + logicSection + "\\n  return {\\n    " + finalExports.join(',\\n    ') + "\\n  };\\n}\\n";

fs.writeFileSync('src/hooks/useAppController.ts', hookFile);

let appFileImports = appContent.substring(0, startIdx).replace(/import .* from '\\.\\/hooks\\/.*';\\r?\\n/g, '').replace(/import \\{ useStore \\} from "\\.\\/store";\\r?\\n/g, '').replace(/import \\{ useShallow \\} from 'zustand\\/react\\/shallow';\\r?\\n/g, '');
let baseAppContent = appFileImports + "import { useAppController } from './hooks/useAppController';\\n\\nfunction App() {\\n  const {\\n    " + finalExports.join(',\\n    ') + "\\n  } = useAppController();\\n\\n  return (\\n    <div className=\\"app-container\\"" + appContent.substring(endIdx + returnStart.length);

fs.writeFileSync('src/App.tsx', baseAppContent);
console.log('App.tsx transformed successfully!');
