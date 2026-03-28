const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '..', 'src', 'App.tsx');
const compPath = path.join(__dirname, '..', 'src', 'components', 'SortableImageCard.tsx');

const content = fs.readFileSync(appTsxPath, 'utf-8');
const lines = content.split(/\r?\n/);

const startIdx = 199 - 1;
const endIdx = 402 - 1;

// Extract component block
const compLines = lines.slice(startIdx, endIdx + 1);
compLines[0] = compLines[0].replace('const SortableImageCard = memo(', 'export const SortableImageCard = memo(');

// Create component file content
const compFileContent = [
  "import React, { memo, useState, useRef, useEffect, useCallback } from 'react';",
  "import { useSortable } from '@dnd-kit/sortable';",
  "import { CSS } from '@dnd-kit/utilities';",
  "import { convertFileSrc } from '@tauri-apps/api/core';",
  "import { generateThumbnail } from '../utils/thumbnail';",
  "import { TimelineItem, Resource } from '../types';",
  "",
  ...compLines
].join('\r\n');

// Write component file
fs.writeFileSync(compPath, compFileContent, 'utf-8');
console.log('Wrote SortableImageCard.tsx, ' + compLines.length + ' lines.');

// Update App.tsx
const replacements = [
  [199, 402, [
    "// SortableImageCard 已迁移到 components/SortableImageCard.tsx",
    "import { SortableImageCard } from './components/SortableImageCard';"
  ]]
];

for (const [s, e, newL] of replacements) {
  lines.splice(s - 1, e - s + 1, ...newL);
}

fs.writeFileSync(appTsxPath, lines.join('\r\n'), 'utf-8');
console.log('Updated App.tsx. New total lines:', lines.length);
