const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Insert Target: normalize newlines for search
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

// Escape regexp function
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Create whitespace-agnostic regex for insertTarget
const wsAgnosticTarget = escapeRegExp(insertTarget).replace(/\\\s+/g, '\\s+');
const targetRegex = new RegExp(wsAgnosticTarget);

if (targetRegex.test(content) && !content.includes('selectedResourceIds: state.selectedResourceIds')) {
    content = content.replace(targetRegex, match => match + '\n\n' + replacement);
    console.log('Successfully inserted Zustand hooks.');
} else {
    console.log('Target hooks missing or already inserted.');
}

// 2. Remove resources
const resourcesStart = content.indexOf('const [resources, setResources] = useState<Resource[]>([');
if (resourcesStart !== -1) {
    const nextBracket = content.indexOf(']);', resourcesStart);
    if (nextBracket !== -1) {
        content = content.slice(0, resourcesStart) + '// resources 迁移至 Zustand\n  ' + content.slice(nextBracket + 4);
        console.log('Replaced resources.');
    }
}

// 3. Remove selectedResourceIds
const selectedIdsRegex = /  const \[selectedResourceIds, setSelectedResourceIds\] = useState\<Set\<string\>\>\(new Set\(\)\);/;
if (selectedIdsRegex.test(content)) {
    content = content.replace(selectedIdsRegex, `  // selectedResourceIds 迁移至 Zustand`);
    console.log('Replaced selectedResourceIds.');
}

// 4. Remove AI Voice
const aiVoiceRegex = /  \/\/ AI 配音相关状态\s*const \[musicSubTab, setMusicSubTab\] = useState\<'audio' \| 'tts'\>\('audio'\);\s*const \[ttsText, setTtsText\] = useState\(''\);\s*const \[ttsVoice, setTtsVoice\] = useState\('zh-CN-YunyangNeural'\);\s*const \[ttsRate, setTtsRate\] = useState\('\+0%'\);\s*const \[ttsGenerating, setTtsGenerating\] = useState\(false\);\s*const \[generatedVoiceovers, setGeneratedVoiceovers\] = useState\<\{ id: string; name: string; path: string; duration: number; selected: boolean \}\[\]\>\(\[\]\);/;
if (aiVoiceRegex.test(content)) {
    content = content.replace(aiVoiceRegex, `  // AI 配音相关状态迁移至 Zustand`);
    console.log('Replaced AI voice states.');
}

// 5. Remove audioBlobs and previewCache
// Using a lazy search since they are near each other
const blobCacheRegex = /  const \[audioBlobs, setAudioBlobs\] = useState\<\{ \[id: string\]: string \}\>\(\{\}\);[^\n]*\n\s*const \[previewCache, setPreviewCache\] = useState\<\{ \[path: string\]: string \}\>\(\{\}\);[^\n]*\n/;
if (blobCacheRegex.test(content)) {
    content = content.replace(blobCacheRegex, `  // audioBlobs 和 previewCache 迁移至 Zustand\n`);
    console.log('Replaced audioBlobs and previewCache.');
}

// 6. Remove searchQuery
const searchQueryRegex = /  const \[searchQuery, setSearchQuery\] = useState\(''\);/;
if (searchQueryRegex.test(content)) {
    content = content.replace(searchQueryRegex, `  // searchQuery 迁移至 Zustand`);
    console.log('Replaced searchQuery.');
}

fs.writeFileSync(targetFile, content);
console.log('Phase 2/3 Re-Application Done!');
