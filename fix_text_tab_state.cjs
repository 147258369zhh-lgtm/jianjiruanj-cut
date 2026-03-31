const fs = require('fs');

function fixPanel(filepath) {
  let code = fs.readFileSync(filepath, 'utf8');

  // Insert Import
  if (!code.includes("import PropertyAccordionBlock")) {
    code = code.replace("import ProFontSelect", "import PropertyAccordionBlock from './PropertyAccordionBlock';\nimport ProFontSelect");
  }

  // Check if textAnimTab exists
  if (!code.includes("const [textAnimTab, setTextAnimTab] =")) {
    // find State definition area
    code = code.replace("const [statusMsg, setStatusMsg] =", "const [statusMsg, setStatusMsg] = useState('');\n  const [textAnimTab, setTextAnimTab] = useState<'in' | 'loop' | 'out'>('in'); // override");
  }

  // check if useUIStore contains text states
  if (!code.includes("panelOrderText") && code.includes("const { panelOrderImage")) {
    code = code.replace("const { panelOrderImage,", "const { panelOrderImage, panelOrderText, panelCollapsed, togglePanelCollapsed,");
  } else if (!code.includes("panelOrderText") && code.includes("const { leftTab")) {
    code = code.replace("const { leftTab", "const { leftTab, panelOrderText, panelCollapsed, togglePanelCollapsed");
  } else if (!code.includes("panelOrderText") && code.includes("const { theme")) {
    code = code.replace("const { theme", "const { theme, panelOrderText, panelCollapsed, togglePanelCollapsed");
  } else if (!code.includes("panelOrderText") && code.includes("const {")) {
     // fallback
     code = code.replace("const {", "const { panelOrderText, panelCollapsed, togglePanelCollapsed,");
  }

  // Also import handleDragStart and handleDrop if missing
  if (code.includes("setPanelOrderImage") && !code.includes("setPanelOrderText")) {
    code = code.replace("setPanelOrderImage", "setPanelOrderImage, setPanelOrderText");
  }

  // Update drag logic to support text order
  const dragLogic = `  // --- 积木拖拽逻辑 ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.currentTarget.style.opacity = '0.5';
    e.dataTransfer.setData('sourceId', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.currentTarget.style.opacity = '1';
    const sourceId = e.dataTransfer.getData('sourceId');
    if (!sourceId || sourceId === targetId) return;
    
    // 区分处理图片积木和文字积木
    const isTextBlock = sourceId.startsWith('text-') && targetId.startsWith('text-');
    if (isTextBlock) {
      const arr = [...panelOrderText];
      const srcIdx = arr.indexOf(sourceId);
      const tgtIdx = arr.indexOf(targetId);
      if (srcIdx > -1 && tgtIdx > -1) {
        arr.splice(srcIdx, 1);
        arr.splice(tgtIdx, 0, sourceId);
        setPanelOrderText(arr);
      }
    } else {
      const arr = [...panelOrderImage];
      const srcIdx = arr.indexOf(sourceId);
      const tgtIdx = arr.indexOf(targetId);
      if (srcIdx > -1 && tgtIdx > -1) {
        arr.splice(srcIdx, 1);
        arr.splice(tgtIdx, 0, sourceId);
        setPanelOrderImage(arr);
      }
    }
  };`;

  if (!code.includes("setPanelOrderText(arr)")) {
    code = code.replace(/\/\/ --- 积木拖拽逻辑 ---[\s\S]*?};(?=\n)/m, dragLogic);
  }

  fs.writeFileSync(filepath, code);
  console.log("Fixed state in " + filepath);
}

fixPanel('src/components/ImagePropertyPanel.tsx');
fixPanel('src/components/VideoPropertyPanel.tsx');
