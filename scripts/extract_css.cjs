const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const stylesDir = path.join(srcDir, 'styles');
const componentsDir = path.join(srcDir, 'components');

if (!fs.existsSync(stylesDir)) fs.mkdirSync(stylesDir, { recursive: true });

const cssPath = path.join(srcDir, 'App.css');
const originalCss = fs.readFileSync(cssPath, 'utf8');
const lines = originalCss.split(/\r?\n/);

const sections = [
  { name: 'Base.css', file: path.join(stylesDir, 'Base.css'), start: 0, end: 118 },
  { name: 'LeftPanel.css', file: path.join(componentsDir, 'LeftPanel.css'), start: 119, end: 153 },
  { name: 'MonitorPanel.css', file: path.join(componentsDir, 'MonitorPanel.css'), start: 154, end: 222 },
  { name: 'TimelinePanel.css', file: path.join(componentsDir, 'TimelinePanel.css'), start: 223, end: 396 },
  { name: 'RightPanel.css', file: path.join(componentsDir, 'RightPanel.css'), start: 397, end: 476 },
  { name: 'DropOverlay.css', file: path.join(componentsDir, 'DropOverlay.css'), start: 477, end: 536 },
  { name: 'ContextMenuWidget.css', file: path.join(componentsDir, 'ContextMenuWidget.css'), start: 537, end: 592 },
  { name: 'TimelineItem.css', file: path.join(componentsDir, 'TimelineItem.css'), start: 593, end: 643 },
  { name: 'Inputs.css', file: path.join(stylesDir, 'Inputs.css'), start: 644, end: 766 },
  { name: 'ShortcutsPanel.css', file: path.join(componentsDir, 'ShortcutsPanel.css'), start: 767, end: 831 },
  { name: 'Animations.css', file: path.join(stylesDir, 'Animations.css'), start: 832, end: 1648 },
  { name: 'FluentOverrides.css', file: path.join(stylesDir, 'FluentOverrides.css'), start: 1649, end: lines.length }
];

let appCssContent = '';
let processedLines = new Set(); // To avoid extracting overlapping lines wrongly

sections.forEach(sec => {
  // start is index, end is index - we are 1-based in analysis, let's adjust:
  // actually wait! The analysis said:
  // [1] /* ─── 
  // [119] /* ─── 资源库项优化
  // so indices in JS are 0-based exactly like analysis
  const contentToExtract = lines.slice(sec.start, sec.end).join('\n');
  fs.writeFileSync(sec.file, contentToExtract, 'utf8');
  console.log(`Extracted ${sec.name}`);
});

console.log('Done extracting.');
