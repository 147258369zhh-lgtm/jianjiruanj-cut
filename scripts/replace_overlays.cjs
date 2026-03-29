const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const imports = "import { ShortcutsPanel } from './components/ShortcutsPanel';\nimport { DropOverlay } from './components/DropOverlay';\nimport { ContextMenuWidget } from './components/ContextMenuWidget';\n";

content = content.replace("import { TimelinePanel } from './components/TimelinePanel';", "import { TimelinePanel } from './components/TimelinePanel';\n" + imports);

const s1 = content.indexOf('{showShortcuts && (');
const m1 = content.indexOf('{/* 右键上下文菜单 */}');
if (s1 !== -1 && m1 !== -1) {
  const m2 = content.indexOf('</div>\n        )}', m1);
  if (m2 !== -1) {
    const end = m2 + '</div>\n        )}'.length;
    const replacement = `
        <ShortcutsPanel showShortcuts={showShortcuts} />
        <DropOverlay isDragOver={isDragOver} />
        <ContextMenuWidget
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          commitSnapshotNow={commitSnapshotNow}
          setTimeline={setTimeline as any}
          setSelectedIds={setSelectedIds}
          splitAtPlayhead={splitAtPlayhead}
          setAudioItems={setAudioItems as any}
          setSelectedAudioIds={setSelectedAudioIds}
          setSelectedVoiceoverIds={setSelectedVoiceoverIds}
        />
`;
    content = content.substring(0, s1) + replacement + content.substring(end);
    fs.writeFileSync('src/App.tsx', content);
    console.log('Success!');
  } else {
    console.log('Failed m2');
  }
} else {
  console.log('Failed s1/m1', s1, m1);
}
