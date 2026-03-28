const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

const replacements = [
  // Remove renderPremiumColorPicker inline (line 2257-2276)
  [2257, 2276, [
    "  // 影视级色盘已迁移",
    "  const renderPremiumColorPicker = (propKey: string, currentVal: string, defVal: string) => (",
    "    <ColorPicker currentVal={currentVal} defVal={defVal} onChange={c => updateSelectedProperty(propKey as keyof TimelineItem, c)} />",
    "  );"
  ]],
  // Add import near existing imported components (around line 273/274)
  [273, 273, [
    "import ColorPicker from './features/text-workshop/ColorPicker';",
    "// ProFontSelect 已迁移到 features/text-workshop/FontSelector.tsx (通过 import ProFontSelect 引入)",
  ]]
];

replacements.sort((a, b) => b[0] - a[0]);

for (const [start, end, newLines] of replacements) {
  const startIdx = start - 1;
  const count = end - start + 1;
  lines.splice(startIdx, count, ...newLines);
  console.log(`Replaced lines ${start}-${end} (${count} lines) -> ${newLines.length} lines`);
}

fs.writeFileSync(filePath, lines.join('\r\n'), 'utf-8');
console.log('Done! Total lines:', lines.length);
