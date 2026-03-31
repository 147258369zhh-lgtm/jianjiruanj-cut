const fs = require('fs');

// Fix VideoPropertyPanel.tsx - add missing variables
const f = 'src/components/VideoPropertyPanel.tsx';
let c = fs.readFileSync(f, 'utf8');

const oldStr = '}) => {\r\n  const renderPremiumColorPicker';
const insertion = [
  '}) => {',
  '  const [textAnimTab, setTextAnimTab] = React.useState<\'in\' | \'loop\' | \'out\'>(\'in\');',
  '',
  '  const { panelOrderImage, setPanelOrderImage, panelOrderText, setPanelOrderText, panelCollapsed, togglePanelCollapsed } = useStore();',
  '',
  '  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {',
  '    e.dataTransfer.setData(\'sourceId\', id);',
  '    e.currentTarget.style.opacity = \'0.4\';',
  '  };',
  '  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {',
  '    e.preventDefault();',
  '    const sourceId = e.dataTransfer.getData(\'sourceId\');',
  '    if (!sourceId || sourceId === targetId) return;',
  '    if (sourceId.startsWith(\'text-\') && targetId.startsWith(\'text-\')) {',
  '      const items = [...panelOrderText];',
  '      const srcIdx = items.indexOf(sourceId);',
  '      const tgtIdx = items.indexOf(targetId);',
  '      if (srcIdx > -1 && tgtIdx > -1) {',
  '        items.splice(srcIdx, 1);',
  '        items.splice(tgtIdx, 0, sourceId);',
  '        setPanelOrderText(items);',
  '      }',
  '    } else {',
  '      const items = [...panelOrderImage];',
  '      const srcIdx = items.indexOf(sourceId);',
  '      const tgtIdx = items.indexOf(targetId);',
  '      if (srcIdx > -1 && tgtIdx > -1) {',
  '        items.splice(srcIdx, 1);',
  '        items.splice(tgtIdx, 0, sourceId);',
  '        setPanelOrderImage(items);',
  '      }',
  '    }',
  '  };',
  '',
  '  const renderPremiumColorPicker'
].join('\r\n');

if (c.includes(oldStr)) {
  c = c.replace(oldStr, insertion);
  fs.writeFileSync(f, c, 'utf8');
  console.log('SUCCESS: VideoPropertyPanel.tsx patched');
} else {
  console.log('ERROR: pattern not found in VideoPropertyPanel.tsx');
  const idx = c.indexOf('}) => {');
  if (idx > -1) {
    console.log('Found "}) => {" at index', idx);
    console.log('Next chars:', JSON.stringify(c.substring(idx, idx+80)));
  }
}

// Fix ImagePropertyPanel.tsx - add missing resetKeys function
const f2 = 'src/components/ImagePropertyPanel.tsx';
let c2 = fs.readFileSync(f2, 'utf8');

const oldStr2 = 'const renderPremiumColorPicker = (propKey: string, currentVal: string, defVal: string) =>';
const insertion2 = [
  '  const resetKeys = (keys: string[]) => {',
  '    keys.forEach((k: string) => updateSelectedProperty(k as keyof TimelineItem, undefined));',
  '    commitSnapshotNow();',
  '  };',
  '',
  '  const renderPremiumColorPicker = (propKey: string, currentVal: string, defVal: string) =>'
].join('\r\n');

// Only replace the first occurrence in ImagePropertyPanel
const firstIdx = c2.indexOf(oldStr2);
if (firstIdx > -1) {
  c2 = c2.substring(0, firstIdx) + insertion2 + c2.substring(firstIdx + oldStr2.length);
  fs.writeFileSync(f2, c2, 'utf8');
  console.log('SUCCESS: ImagePropertyPanel.tsx patched (resetKeys added)');
} else {
  console.log('ERROR: pattern not found in ImagePropertyPanel.tsx');
}
