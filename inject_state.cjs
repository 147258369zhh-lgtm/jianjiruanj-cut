const fs = require('fs');

function inject(file) {
  let code = fs.readFileSync(file, 'utf8');

  if (!code.includes("import { useUIStore }")) {
    code = code.replace("import React,", "import React, { SetStateAction } from 'react';\nimport { useUIStore } from '../store/slices/uiSlice';\n//");
  }

  // Inside component
  const storeHookStr = `
  const { panelOrderImage, setPanelOrderImage, panelOrderText, setPanelOrderText, panelCollapsed, togglePanelCollapsed } = useUIStore();
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('sourceId', id);
    e.currentTarget.style.opacity = '0.4';
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('sourceId');
    if (!sourceId || sourceId === targetId) return;
    
    if (sourceId.startsWith('text-') && targetId.startsWith('text-')) {
      const items = [...panelOrderText];
      const srcIdx = items.indexOf(sourceId);
      const tgtIdx = items.indexOf(targetId);
      if (srcIdx > -1 && tgtIdx > -1) {
        items.splice(srcIdx, 1);
        items.splice(tgtIdx, 0, sourceId);
        setPanelOrderText(items);
      }
    } else {
      const items = [...panelOrderImage];
      const srcIdx = items.indexOf(sourceId);
      const tgtIdx = items.indexOf(targetId);
      if (srcIdx > -1 && tgtIdx > -1) {
        items.splice(srcIdx, 1);
        items.splice(tgtIdx, 0, sourceId);
        setPanelOrderImage(items);
      }
    }
  };
  `;

  if (!code.includes("const { panelOrderImage, setPanelOrderImage, panelOrderText")) {
    code = code.replace("const [textAnimTab, setTextAnimTab] = React.useState<'in' | 'loop' | 'out'>('in');", "const [textAnimTab, setTextAnimTab] = React.useState<'in' | 'loop' | 'out'>('in');\n" + storeHookStr);
  }

  fs.writeFileSync(file, code);
  console.log("Injected into " + file);
}

inject('src/components/ImagePropertyPanel.tsx');
inject('src/components/VideoPropertyPanel.tsx');
