// Phase 2: Remove getMediaDuration + thumbnailEngine from App.tsx
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

const replacements = [
  // 1) Remove getMediaDuration (line 33-76, includes comment on line 33)
  [33, 76, [
    "// getMediaDuration 已迁移到 utils/mediaUtils.ts",
    "import { getMediaDuration } from './utils/mediaUtils';",
  ]],
  
  // 2) Remove thumbnail engine (line 320-376)
  [320, 376, [
    "// 缩略图引擎已迁移到 utils/thumbnail.ts",
    "import { generateThumbnail, thumbCache, THUMB_WIDTH } from './utils/thumbnail';",
  ]],
];

// Apply replacements from bottom to top
replacements.sort((a, b) => b[0] - a[0]);

for (const [start, end, newLines] of replacements) {
  const startIdx = start - 1;
  const count = end - start + 1;
  lines.splice(startIdx, count, ...newLines);
  console.log(`Replaced lines ${start}-${end} (${count} lines) -> ${newLines.length} lines`);
}

fs.writeFileSync(filePath, lines.join('\r\n'), 'utf-8');
console.log('Done! Total lines:', lines.length);
