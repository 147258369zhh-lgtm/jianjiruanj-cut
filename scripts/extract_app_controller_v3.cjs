const fs = require('fs');

const appContent = fs.readFileSync('src/App.tsx', 'utf8');
const appFunctionStart = 'function App() {';
const returnStart = '  return (\n    <div className="app-container"';

const startIdx = appContent.indexOf(appFunctionStart);
const endIdx = appContent.lastIndexOf(returnStart);

const logicSection = appContent.substring(startIdx + appFunctionStart.length, endIdx);

// We will construct the hook without writing raw JS strings containing escaping.
const importLines = [
  'import { useState, useEffect, useRef, useMemo, useCallback } from "react";',
  'import { useStore } from "../store";',
  "import { useShallow } from 'zustand/react/shallow';",
  "import { useProjectHistory } from './useProjectHistory';",
  "import { usePlaybackEngine } from './usePlaybackEngine';",
  "import { useAudioSync } from './useAudioSync';",
  "import { useProjectIO } from './useProjectIO';",
  "import { useKeyboardShortcuts } from './useKeyboardShortcuts';",
  "import { useDragImport } from './useDragImport';",
  "import { useTimelineActions } from './useTimelineActions';",
  "import { useResourceManager } from './useResourceManager';",
  'import { invoke } from "@tauri-apps/api/core";',
  'import { save } from "@tauri-apps/plugin-dialog";',
  "import { convertFileSrc } from '@tauri-apps/api/core';",
  "import { Resource, AudioTimelineItem, TimelineItem, GlobalDefaults, GLOBAL_DEFAULTS_INIT } from '../types';"
].join('\n');

const specialVars = [
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

let lines = logicSection.split('\n');
let toExport = [...specialVars];

for (let line of lines) {
  let match = line.match(/^  const \[([^\]]+)\] =/);
  if (match) match[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => toExport.push(v));
  
  match = line.match(/^  const \{([^\}]+)\} =/);
  if (match) match[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => toExport.push(v));

  match = line.match(/^  const ([\w]+) =/);
  if (match) toExport.push(match[1]);

  match = line.match(/^  let ([\w]+) =/);
  if (match) toExport.push(match[1]);
}

let finalExports = Array.from(new Set(toExport)).filter(v => v !== 'next');

const hookParts = [];
hookParts.push(importLines);
hookParts.push('');
hookParts.push('export function useAppController() {');
hookParts.push(logicSection);
hookParts.push('  return {');
hookParts.push('    ' + finalExports.join(',\n    '));
hookParts.push('  };');
hookParts.push('}');
fs.writeFileSync('src/hooks/useAppController.ts', hookParts.join('\n'));

// Now transform App.tsx
let topPart = appContent.substring(0, startIdx);
// Strip out the hooks and zustand imports that are now in useAppController
const linesTop = topPart.split('\n');
const newTopLines = [];
for (let line of linesTop) {
  if (line.includes('./hooks/')) continue;
  if (line.includes('./store')) continue;
  if (line.includes('zustand/react/shallow')) continue;
  newTopLines.push(line);
}
topPart = newTopLines.join('\n');

const appHeader = [
  "import { useAppController } from './hooks/useAppController';",
  "",
  "function App() {",
  "  const {",
  "    " + finalExports.join(',\n    '),
  "  } = useAppController();",
  "",
  "  return (",
  '    <div className="app-container"'
];

const newAppContent = topPart + appHeader.join('\n') + appContent.substring(endIdx + returnStart.length);
fs.writeFileSync('src/App.tsx', newAppContent);
console.log('Successfully completed state extraction.');
