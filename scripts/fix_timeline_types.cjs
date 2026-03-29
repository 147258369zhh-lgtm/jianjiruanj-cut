const fs = require('fs');

let panel = fs.readFileSync('src/components/TimelinePanel.tsx', 'utf8');
panel = panel.replace('handleTimelineMouseUp: () => void;', 'handleTimelineMouseUp: (e?: React.MouseEvent) => void;');
panel = panel.replace('sortMode: string;', 'sortMode: "manual" | "time" | "name";');
panel = panel.replace('setSortMode: (val: string) => void;', 'setSortMode: (val: "manual" | "time" | "name") => void;');
// also setVoiceoverClips is actually React.Dispatch<React.SetStateAction<any[]>> or similar, but any works if the param signature matches. The error did not point there.

fs.writeFileSync('src/components/TimelinePanel.tsx', panel);

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/const sensors = useSensors\([^)]*\)[^)]*\);\n/, '');
app = app.replace(/const sensors = useSensors[\s\S]*?\);\n/m, '');
fs.writeFileSync('src/App.tsx', app);
