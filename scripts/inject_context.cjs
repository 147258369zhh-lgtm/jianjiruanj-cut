const fs = require('fs');

function updateComponent(file) {
  let code = fs.readFileSync(file, 'utf8');
  const name = file.match(/([a-zA-Z0-9]+)\.tsx$/)[1];
  
  if (!code.includes('useAppContext')) {
    code = `import { useAppContext } from '../hooks/useAppContext';\n` + code;
  }
  
  const regex = new RegExp(`export function ${name}\\(props: [a-zA-Z0-9_]+\\)\\s*\\{([\\s\\S]*?)const\\s+\\{([\\s\\S]*?)\\}\\s*=\\s*props;`, 'm');
  const match = code.match(regex);
  if (match) {
    code = code.replace(regex, `export function ${name}() {${match[1]}const {${match[2]}} = useAppContext() as any;`);
  } else {
    // try finding Without explicit props typing
    const backupRegex = new RegExp(`export function ${name}\\(\\{([^}]*)\\}\\s*:?\\s*[^)]*\\)\\s*\\{`, 'm');
    const backupMatch = code.match(backupRegex);
    if (backupMatch) {
       code = code.replace(backupRegex, `export function ${name}() {\n  const { ${backupMatch[1]} } = useAppContext() as any;`);
    } else {
       console.log("Could not update component:", name);
    }
  }
  
  fs.writeFileSync(file, code);
  console.log("Updated:", file);
}

["RightPanel", "LeftPanel", "TimelinePanel", "MonitorPanel", "ProjectToolbar"].forEach(name => {
  const path = `src/components/${name}.tsx`;
  if (fs.existsSync(path)) {
     updateComponent(path);
  }
});

// Update App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
if (!appCode.includes('AppContext')) {
  appCode = appCode.replace(/import \{ useAppController \}.*/, "import { useAppController } from './hooks/useAppController';\nimport { AppContext } from './hooks/useAppContext';");
}

appCode = appCode.replace(/return \(\s*<div className="app-root-container">/, `return (\n    <AppContext.Provider value={controller as any}>\n    <div className="app-root-container">`);
appCode = appCode.replace(/<\/div>\s*<\/div>\s*\);\s*}\s*export default App;/, `</div>\n    </div>\n    </AppContext.Provider>\n  );\n}\n\nexport default App;`);

// Remove props passed to components
appCode = appCode.replace(/<RightPanel[^>]*\/>/m, `<RightPanel />`);
appCode = appCode.replace(/<LeftPanel[^>]*\/>/m, `<LeftPanel />`);
appCode = appCode.replace(/<TimelinePanel[\s\S]*?handleTripleClickZone=\{handleTripleClickZone\}\s*\/>/m, `<TimelinePanel />`);
appCode = appCode.replace(/<MonitorPanel[\s\S]*?monitorVideoRef=\{monitorVideoRef\}\s*\/>/m, `<MonitorPanel />`);
appCode = appCode.replace(/<ProjectToolbar[\s\S]*?loadProject=\{loadProject\}\s*\/>/m, `<ProjectToolbar />`);

// Update controller definition
appCode = appCode.replace(/const \{([\s\S]*?)\} = useAppController\(\);/, `const controller = useAppController();\n  const { statusMsg, showShortcuts, isDragOver, contextMenu, setContextMenu, commitSnapshotNow, setTimeline, setSelectedIds, splitAtPlayhead, setAudioItems, setSelectedAudioIds, setSelectedVoiceoverIds, showSortMenu, setShowSortMenu, showMoreMenu, setShowMoreMenu, theme, setShowShortcuts } = controller;`);

fs.writeFileSync('src/App.tsx', appCode);
console.log("Updated App.tsx");
