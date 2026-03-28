const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '..', 'src', 'App.tsx');
const cardPath = path.join(__dirname, '..', 'src', 'components', 'ResourceCardItem.tsx');

const content = fs.readFileSync(appTsxPath, 'utf-8');
const lines = content.split(/\r?\n/);

const startLine = 60 - 1;
const endLine = 283 - 1;

let cardLines = lines.slice(startLine, endLine + 1);
cardLines[0] = cardLines[0].replace('const ResourceCardItem = memo(', 'export const ResourceCardItem = memo(');

const cardContent = [
  "import React, { memo, useState, useMemo } from 'react';",
  "import { convertFileSrc } from '@tauri-apps/api/core';",
  "",
  ...cardLines
].join('\r\n');

fs.writeFileSync(cardPath, cardContent, 'utf-8');
console.log('Wrote ResourceCardItem.tsx, length: ' + cardLines.length);

const replacements = [
  [60, 283, [
    "// ResourceCardItem 已迁移到 components/ResourceCardItem.tsx",
    "import { ResourceCardItem } from './components/ResourceCardItem';"
  ]]
];

for (const [start, end, newL] of replacements) {
    lines.splice(start - 1, end - start + 1, ...newL);
}

fs.writeFileSync(appTsxPath, lines.join('\r\n'), 'utf-8');
console.log('Updated App.tsx. New total lines:', lines.length);
