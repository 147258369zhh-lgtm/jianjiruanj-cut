const fs = require('fs');
const appContent = fs.readFileSync('src/App.tsx', 'utf8');

const appFunctionStart = 'function App() {';
const returnStart = '  return (\n    <div className="app-container"';

const startIdx = appContent.indexOf(appFunctionStart);
const endIdx = appContent.lastIndexOf(returnStart);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found');
  process.exit(1);
}

const logicSection = appContent.substring(startIdx + appFunctionStart.length, endIdx);

// We need to parse all imports out of App.tsx, but some stay in App.tsx (like Component imports)
// For useAppLogic, we'll just copy most imports.
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

// Extract returned keys by doing a simplistic regex match for all consts declared
const constMatches = [...logicSection.matchAll(/const (?:\[|{)?\s*([a-zA-Z0-9_,$\s]+)\s*(?:\]|})?\s*=/g)];
let returnedKeys = new Set();
for (const match of constMatches) {
  const vars = match[1].split(',').map(v => v.trim()).filter(v => v && !v.includes(' '));
  vars.forEach(v => returnedKeys.add(v));
}
// Add explicit ones that might be missed or functions defined differently
const funcMatches = [...logicSection.matchAll(/function ([a-zA-Z0-9_]+)\(/g)];
for (const match of funcMatches) {
  returnedKeys.add(match[1]);
}

const ignoreList = ['audioRef', 'canvasRef', 'videoRef']; // Some local refs if they are just inside components
const returns = Array.from(returnedKeys).filter(k => k !== 'prev' && k !== 'val' && k !== 'e' && !ignoreList.includes(k));

const hookFile = `
${imports}

export function useAppLogic() {
  ${logicSection}

  return {
    ${returns.join(',\n    ')}
  };
}
`;

fs.writeFileSync('src/hooks/useAppLogic.ts', hookFile);
console.log('Extracted ' + returns.length + ' variables to useAppLogic');
