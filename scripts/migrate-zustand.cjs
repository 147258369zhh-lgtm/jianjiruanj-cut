const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(appTsxPath, 'utf8');

// The slices expose these state names:
const validStoreKeys = new Set([
  'timeline', 'selectedIds', 'selectedTextIds', 'pps',
  'resources', 'previewCache', 'searchQuery', 'selectedResourceIds',
  'isPlaying', 'playTime', 'playbackSpeed',
  'audioItems', 'voiceoverClips', 'audioBlobs', 'selectedAudioIds', 'selectedVoiceoverIds', 'ttsText', 'ttsVoice', 'ttsRate', 'ttsGenerating', 'generatedVoiceovers', 'musicSubTab',
  'activeTab', 'propertyTab', 'libTab', 'leftTab',
  'statusMsg', 'showShortcuts', 'showSortMenu', 'showExportPanel', 'showGlobalDefaults', 'showMoreMenu', 'isEditingProjectName', 'isDragOver', 'isGenerating', 'contextMenu', 'selectionBox', 'crop', 'isCropping', 'isEditingAudio', 'isDraggingHead', 'isJumping', 'localDuration', 'theme', 'exportFormat', 'exportResolution', 'exportFps', 'exportQuality', 'exportCodec', 'exportHdr',
  'projectName', 'sortMode', 'sortDirection', 'globalDefaults', 'monitorRes'
]);

// We need to inject the import path for useStore
if (!content.includes("import { useStore }")) {
  content = content.replace(
    'import { useState, useEffect, useRef, useMemo, useCallback } from "react";',
    'import { useState, useEffect, useRef, useMemo, useCallback } from "react";\nimport { useStore } from "./store";'
  );
}

// Regex to find all: const [key, setKey] = useState<...>(...);
// Due to multiline init functions like `() => { ... }`, this naive regex might fail.
// So we use a safer approach: split by lines, iterate over them in the state block.
const lines = content.split('\n');
let insideApp = false;
let inUseStateCluster = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('export default function App() {')) {
    insideApp = true;
    inUseStateCluster = true;
    continue;
  }
  
  if (inUseStateCluster && line.trim().startsWith('const [') && line.includes('] = useState')) {
    const match = line.match(/const\s*\[([a-zA-Z0-9_]+),\s*([a-zA-Z0-9_]+)\]\s*=\s*useState/);
    if (match) {
      const stateName = match[1];
      let stateNameToCheck = stateName;
      
      // Some states start with underscore to suppress TS unused warnings, let's clean them, wait actually _isFullscreen is not in store.
      
      if (validStoreKeys.has(stateName)) {
        const setterName = match[2];
        // Replace this line AND possibly following lines if it's a multiline useState
        // We find the closing `);` of the useState call.
        let j = i;
        let block = line;
        let openBrackets = (block.match(/\(/g) || []).length - (block.match(/\)/g) || []).length;
        
        while (openBrackets > 0 && j < lines.length - 1) {
          j++;
          block += '\n' + lines[j];
          openBrackets = (block.match(/\(/g) || []).length - (block.match(/\)/g) || []).length;
        }
        
        // Replace from line i to line j with useStore hooks
        for (let k = i; k <= j; k++) {
          lines[k] = ''; // blank them out
        }
        
        lines[i] = `  const ${stateName} = useStore(s => s.${stateName});\n  const ${setterName} = useStore(s => s.${setterName});`;
        i = j; // skip forward
      }
    }
  }
  
  // If we hit useEffect or useRef inside App, the main cluster is over
  if (insideApp && (line.trim().startsWith('useEffect(') || line.trim().startsWith('const lastScrubTimeRef'))) {
    inUseStateCluster = false;
  }
}

fs.writeFileSync(appTsxPath, lines.filter(l => l !== '').join('\n'), 'utf8');
console.log('Successfully migrated valid useStates to useStore hooks!');
