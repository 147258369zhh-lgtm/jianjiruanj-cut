const fs = require('fs');

const appContent = fs.readFileSync('src/App.tsx', 'utf8');

const appFunctionStart = 'function App() {';
const returnStart = '  return (\n    <div className="app-container"';

const startIdx = appContent.indexOf(appFunctionStart);
const endIdx = appContent.lastIndexOf(returnStart);

const logicSection = appContent.substring(startIdx + appFunctionStart.length, endIdx);

// Now we need to parse what variables to return.
// Instead of risky regex, I'll export ALL locally defined top-level variables.
const lines = logicSection.split('\n');
const toExport = [];

for (const line of lines) {
  // Capture basic consts, e.g. const [a, b] = ..., const { a, b } = ..., const myFunc = ...
  let match = line.match(/^  const \[([\w\s,]+)\] =/);
  if (match) {
    match[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => toExport.push(v));
    continue;
  }
  match = line.match(/^  const \{([\w\s,]+)\} =/);
  if (match) {
    match[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => toExport.push(v));
    continue;
  }
  match = line.match(/^  const ([\w]+) =/);
  if (match) {
    toExport.push(match[1]);
    continue;
  }
  match = line.match(/^  let ([\w]+) =/);
  if (match) {
    toExport.push(match[1]);
    continue;
  }
}

// Special destructures tracking over multiple lines:
/*
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
*/
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
    'saveProject', 'loadProject'
];
specialVars.forEach(v => {
   if(!toExport.includes(v)) toExport.push(v);
});

// Avoid exporting variables that are just block scoped or irrelevant.
const finalExports = new Set(toExport.filter(v => v !== 'timelineRef' && v !== 'next' && v !== 'audioItemsRef' && v !== 'ppsRef' && v !== 'selectedIdsRef' && v !== 'selectedAudioIdsRef' && v !== 'selectedVoiceoverIdsRef' && v !== 'resourcesRef' && v !== 'playTimeRef' && v !== 'lastSyncTimeRef' && v !== 'clickTimesRef' && v !== 'faceWorkerRef' && v !== 'globalDefaultsRef' && !v.includes('Ref')));

// We MUST export the Refs used in UI components: playheadRef, timeTextRef, monitorVideoRef, timelineScrollRef
finalExports.add('timelineScrollRef');
finalExports.add('playheadRef');
finalExports.add('timeTextRef');
finalExports.add('monitorVideoRef');

// Generate the hook code
const imports = `import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useStore } from "../store";
import { useShallow } from 'zustand/react/shallow';
import { useProjectHistory } from './useProjectHistory';
import { usePlaybackEngine } from './usePlaybackEngine';
import { useAudioSync } from './useAudioSync';
import { useProjectIO } from './useProjectIO';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useDragImport } from './useDragImport';
import { useTimelineActions } from './useTimelineActions';
import { useResourceManager } from './useResourceManager';
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from '@tauri-apps/api/core';
import { Resource, AudioTimelineItem, TimelineItem, GlobalDefaults, GLOBAL_DEFAULTS_INIT } from '../types';
`;

const hookFile = \`\${imports}

export function useAppController() {
\${logicSection}

  return {
    \${Array.from(finalExports).join(',\\n    ')}
  };
}
\`;

fs.writeFileSync('src/hooks/useAppController.ts', hookFile);
console.log('Hook file written with ' + finalExports.size + ' exports!');

const appFileImports = appContent.substring(0, startIdx).replace(/import .* from '.\/hooks\/.*';\\n/g, '').replace(/import \{ useStore \} from ".\/store";\\n/g, '').replace(/import \{ useShallow \} from 'zustand\\/react\\/shallow';\\n/g, '');
const baseAppContent = appContent.substring(0, startIdx) + \`import { useAppController } from './hooks/useAppController';\\n\\nfunction App() {\\n  const {\n    \${Array.from(finalExports).join(',\\n    ')}\n  } = useAppController();\\n\\n  return (\\n    <div className="app-container"\` + appContent.substring(endIdx + returnStart.length);

fs.writeFileSync('src/App.tsx', baseAppContent);
console.log('App.tsx transformed!');
