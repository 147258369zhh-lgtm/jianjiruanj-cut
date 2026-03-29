const fs = require('fs');

const appContent = fs.readFileSync('src/App.tsx', 'utf8');

const appFunctionStart = 'function App() {';
const returnStart = '  return (\n    <div className="app-container"';

const startIdx = appContent.indexOf(appFunctionStart);
const endIdx = appContent.lastIndexOf(returnStart);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found');
  process.exit(1);
}

const logicSection = appContent.substring(startIdx + appFunctionStart.length, endIdx);

const imports = appContent.substring(0, startIdx).replace(/import .* from '\.\/components\/.*';/g, '');

// Collect all 'const [xxx, setXxx]'
let variables = new Set();

const regexConsts = /const \[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\] = useState/g;
let match;
while ((match = regexConsts.exec(logicSection)) !== null) {
  variables.add(match[1]);
  variables.add(match[2]);
}

const regexDestructure = /const \{\s*([^}]+)\s*\} = (useStore|useProjectHistory|usePlaybackEngine|useAudioSync|useProjectIO|useKeyboardShortcuts|useDragImport|useTimelineActions|useResourceManager)/g;
while ((match = regexDestructure.exec(logicSection)) !== null) {
  const vars = match[1].split(',').map(v => v.trim().split(':')[0].trim()).filter(v => v && !v.startsWith('//'));
  vars.forEach(v => variables.add(v));
}

const regexFuncs = /const ([a-zA-Z0-9_]+) = useCallback/g;
while ((match = regexFuncs.exec(logicSection)) !== null) {
  variables.add(match[1]);
}

const regexRefs = /const ([a-zA-Z0-9_]+) = useRef/g;
while ((match = regexRefs.exec(logicSection)) !== null) {
  variables.add(match[1]);
}

const regexNormalConsts = /const ([a-zA-Z0-9_]+) = /g;
while ((match = regexNormalConsts.exec(logicSection)) !== null) {
  if (!variables.has(match[1]) && !['faceWorkerRef', 'result', 'dur', 'x', 'y', 't', 'left', 'width', 'center'].includes(match[1])) {
       variables.add(match[1]);
  }
}

// Ignore list
const ignore = ['audioRef', 'videoRef', 'timeTextRef', 'timelineScrollRef', 'playheadRef', 'lastScrubTimeRef']; 
// refs should be kept in App.tsx or returned? If they are attached to DOM in App.tsx they MUST be returned.
// Let's just return all of them.

const hookFile = \`\${imports}

export function useAppController() {
  \${logicSection}

  return {
    \${Array.from(variables).join(',\\n    ')}
  };
}
\`;

fs.writeFileSync('src/hooks/useAppController.ts', hookFile);

const appReplacement = \`function App() {
  const ctrl = useAppController();

  return (
    <div className="app-container" onContextMenu={e => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#000', color: '#fff', userSelect: 'none' }}>
      {/* 遮罩及其他逻辑使用 ctrl.xxx */}
\`;
// Actually, it's easier to just pass the whole \`ctrl\` object by destructuring it in App.tsx.

const destructured = \`function App() {
  const {
    \${Array.from(variables).join(',\\n    ')}
  } = useAppController();

  return (
    <div className="app-container"\`;

let newAppContent = appContent.substring(0, startIdx) + destructured + appContent.substring(endIdx + returnStart.length);

fs.writeFileSync('src/App.tsx', newAppContent);
console.log('Extraction completed.');
