const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '..', 'src', 'App.tsx');
const waveformPath = path.join(__dirname, '..', 'src', 'components', 'AudioWaveform.tsx');
const trackItemPath = path.join(__dirname, '..', 'src', 'components', 'AudioTrackItem.tsx');

const content = fs.readFileSync(appTsxPath, 'utf-8');
const lines = content.split(/\r?\n/);

// --- 1. Extract AudioWaveform ---
// lines 62 to 187
let waveformLines = lines.slice(62 - 1, 187);
waveformLines[0] = waveformLines[0].replace('const AudioWaveform = memo(', 'export const AudioWaveform = memo(');

const waveformContent = [
  "import React, { memo, useRef, useEffect } from 'react';",
  "import { AUDIO_RAINBOW, AUDIO_PALETTES } from '../utils/constants';",
  "",
  ...waveformLines
].join('\r\n');
fs.writeFileSync(waveformPath, waveformContent, 'utf-8');
console.log('Wrote AudioWaveform.tsx');


// --- 2. Extract AudioTrackItem ---
// lines 202 to 435 (includes AudioTrackItemProps and AudioTrackItem)
let trackItemLines = lines.slice(202 - 1, 435);
const compLineIdx = trackItemLines.findIndex(l => l.includes('const AudioTrackItem ='));
if(compLineIdx !== -1) {
  trackItemLines[compLineIdx] = trackItemLines[compLineIdx].replace('const AudioTrackItem = memo(', 'export const AudioTrackItem = memo(');
}

const trackItemContent = [
  "import React, { memo, useRef, useState, useMemo } from 'react';",
  "import { AudioTimelineItem } from '../types';",
  "import { AUDIO_PALETTES } from '../utils/constants';",
  "import { AudioWaveform } from './AudioWaveform';",
  "import { formatTime } from '../utils/formatTime';",
  "",
  ...trackItemLines
].join('\r\n');
fs.writeFileSync(trackItemPath, trackItemContent, 'utf-8');
console.log('Wrote AudioTrackItem.tsx');

// --- 3. Replace in App.tsx ---
// We replace the whole chunk from 39 to 435 with imports!
// Wait, is there anything else in 39 to 435? Let's check:
// 39-60 is AUDIO_PALETTES and AUDIO_RAINBOW
// 62-187 is AudioWaveform
// 195-200 is some comments and import SortableImageCard
// 202-435 is AudioTrackItemProps and AudioTrackItem

// So we can replace:
// 39-187 => import { AudioWaveform } from './components/AudioWaveform';
// 202-435 => import { AudioTrackItem } from './components/AudioTrackItem';

const replacements = [
  [202, 435, [
    "// AudioTrackItem 已迁移到 components/AudioTrackItem.tsx",
    "import { AudioTrackItem } from './components/AudioTrackItem';"
  ]],
  [39, 187, [
    "// 莫兰迪绚烂色谱常量已迁移至 utils/constants",
    "import { AUDIO_PALETTES } from './utils/constants';",
    "// AudioWaveform 已迁移到 components/AudioWaveform.tsx" // AudioWaveform doesn't seem to be used directly in App.tsx! It's used by AudioTrackItem!
    // We'll see.
  ]]
];

replacements.sort((a,b) => b[0] - a[0]);

for (const [start, end, newL] of replacements) {
    lines.splice(start - 1, end - start + 1, ...newL);
}

fs.writeFileSync(appTsxPath, lines.join('\r\n'), 'utf-8');
console.log('Updated App.tsx. New total lines:', lines.length);
