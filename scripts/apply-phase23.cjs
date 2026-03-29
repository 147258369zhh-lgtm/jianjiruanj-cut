const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// Insert Zustand hooks after the project hooks
const insertTarget = `  const {
    projectName, setProjectName,
    sortMode, setSortMode,
    sortDirection, setSortDirection,
    globalDefaults, setGlobalDefaults,
    monitorRes, setMonitorRes
  } = useStore(useShallow(state => ({
    projectName: state.projectName, setProjectName: state.setProjectName,
    sortMode: state.sortMode, setSortMode: state.setSortMode,
    sortDirection: state.sortDirection, setSortDirection: state.setSortDirection,
    globalDefaults: state.globalDefaults, setGlobalDefaults: state.setGlobalDefaults,
    monitorRes: state.monitorRes, setMonitorRes: state.setMonitorRes
  })));`;

const replacement = `  const {
    resources, setResources,
    previewCache, setPreviewCache,
    searchQuery, setSearchQuery,
    selectedResourceIds, setSelectedResourceIds,
  } = useStore(useShallow(state => ({
    resources: state.resources, setResources: state.setResources,
    previewCache: state.previewCache, setPreviewCache: state.setPreviewCache,
    searchQuery: state.searchQuery, setSearchQuery: state.setSearchQuery,
    selectedResourceIds: state.selectedResourceIds, setSelectedResourceIds: state.setSelectedResourceIds,
  })));

  const {
    musicSubTab, setMusicSubTab,
    ttsText, setTtsText,
    ttsVoice, setTtsVoice,
    ttsRate, setTtsRate,
    ttsGenerating, setTtsGenerating,
    generatedVoiceovers, setGeneratedVoiceovers,
    audioBlobs, setAudioBlobs,
  } = useStore(useShallow(state => ({
    musicSubTab: state.musicSubTab, setMusicSubTab: state.setMusicSubTab,
    ttsText: state.ttsText, setTtsText: state.setTtsText,
    ttsVoice: state.ttsVoice, setTtsVoice: state.setTtsVoice,
    ttsRate: state.ttsRate, setTtsRate: state.setTtsRate,
    ttsGenerating: state.ttsGenerating, setTtsGenerating: state.setTtsGenerating,
    generatedVoiceovers: state.generatedVoiceovers, setGeneratedVoiceovers: state.setGeneratedVoiceovers,
    audioBlobs: state.audioBlobs, setAudioBlobs: state.setAudioBlobs,
  })));`;

if (content.includes(insertTarget) && !content.includes('selectedResourceIds: state.selectedResourceIds')) {
    content = content.replace(insertTarget, insertTarget + '\n\n' + replacement);
}

// Remove resources
content = content.replace(
  /  const \[resources, setResources\] = useState\<Resource\[\]\>\(\[\s*\{[\s\S]*?\}\s*\]\);/,
  `  // resources 迁移至 Zustand`
);

// Remove selectedResourceIds
content = content.replace(
  /  const \[selectedResourceIds, setSelectedResourceIds\] = useState\<Set\<string\>\>\(new Set\(\)\);/,
  ``
);

// Remove AI voice
content = content.replace(
  /  \/\/ AI 配音相关状态\r?\n  const \[musicSubTab, setMusicSubTab\] = useState\<'audio' \| 'tts'\>\('audio'\);\r?\n  const \[ttsText, setTtsText\] = useState\(''\);\r?\n  const \[ttsVoice, setTtsVoice\] = useState\('zh-CN-YunyangNeural'\);\r?\n  const \[ttsRate, setTtsRate\] = useState\('\+0%'\);\r?\n  const \[ttsGenerating, setTtsGenerating\] = useState\(false\);\r?\n  const \[generatedVoiceovers, setGeneratedVoiceovers\] = useState\<\{ id: string; name: string; path: string; duration: number; selected: boolean \}\[\]\>\(\[\]\);/,
  `  // AI 配音相关状态迁移至 Zustand`
);

// Remove audioBlobs and previewCache
content = content.replace(
  /  const \[audioBlobs, setAudioBlobs\] = useState\<\{ \[id: string\]: string \}\>\(\{\}\); \/\/ 核心：URL 映射缓存\r?\n  const \[previewCache, setPreviewCache\] = useState\<\{ \[path: string\]: string \}\>\(\{\}\); \/\/ RAW 预览图映射缓存/,
  ``
);

// Remove searchQuery
content = content.replace(
  /  const \[searchQuery, setSearchQuery\] = useState\(''\);/,
  ``
);

fs.writeFileSync(targetFile, content);
console.log('Phase 2/3 Applied');
