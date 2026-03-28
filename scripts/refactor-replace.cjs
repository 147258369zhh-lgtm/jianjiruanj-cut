// Safe line-range replacement script for App.tsx
// Reads file as raw Buffer to preserve UTF-8 encoding

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

// Define replacements: [startLine (1-indexed), endLine (1-indexed), replacement lines]
const replacements = [
  // 1) Replace FILTER_PRESETS useMemo block (line 1197-1239)
  [1197, 1239, [
    '  // ─── 滤镜预设 (已迁移到 features/filter-engine/filterPresets.ts) ───',
    '  const FILTER_PRESETS = FILTER_PRESETS_MOD;',
  ]],
  // 2) Replace formatTime (line 1789-1795)
  [1789, 1795, [
    '  // formatTime 已迁移到 utils/formatTime.ts',
    '  const formatTime = formatTimeMod;',
  ]],
  // 3) Replace computeFilter + computeTextStyles (line 2480-2568)
  [2480, 2568, [
    '  // computeFilter + computeTextStyles 已迁移到 features/filter-engine/useFilter.ts',
    '  const computeFilter = computeFilterMod;',
    '  const computeTextStyles = computeTextStylesMod;',
  ]],
];

// Apply replacements from bottom to top (so line numbers don't shift)
replacements.sort((a, b) => b[0] - a[0]);

for (const [start, end, newLines] of replacements) {
  const startIdx = start - 1;
  const endIdx = end; // exclusive since splice uses count
  const count = endIdx - startIdx;
  lines.splice(startIdx, count, ...newLines);
  console.log(`Replaced lines ${start}-${end} (${count} lines) -> ${newLines.length} lines`);
}

fs.writeFileSync(filePath, lines.join('\r\n'), 'utf-8');
console.log('Done! Total lines:', lines.length);
