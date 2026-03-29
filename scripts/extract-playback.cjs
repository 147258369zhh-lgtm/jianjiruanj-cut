const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Replace the playback RAF effect (from "// 1. 核心" to the end of the useEffect deps)
const rafStart = content.indexOf('    // 1. 核心：高性能播放引擎');
const rafEnd = content.indexOf('}, [isPlaying, playbackSpeed]);', rafStart);
if (rafStart === -1 || rafEnd === -1) {
  console.error('RAF block not found. rafStart:', rafStart, 'rafEnd:', rafEnd);
  process.exit(1);
}
const rafEndFull = rafEnd + '}, [isPlaying, playbackSpeed]);'.length;

const hookCall = `    // 播放引擎已迁移到 hooks/usePlaybackEngine.ts
  const { maxPlayTime, playLineLeft, handleTripleClickZone, togglePlay } = usePlaybackEngine({
    isPlaying, playbackSpeed, playTime, timeline, audioItems, pps,
    setPlayTime, setIsPlaying, setStatusMsg,
    refs: { timelineRef, audioItemsRef, ppsRef, playheadRef, timelineScrollRef, timeTextRef, playTimeRef, lastSyncTimeRef, clickTimesRef }
  });`;

content = content.slice(0, rafStart) + hookCall + content.slice(rafEndFull);
console.log('1. Replaced RAF playback engine block');

// 2. Replace maxPlayTime memo
const maxPlayTimeStart = content.indexOf('  // 计算整个工程的物理最远时间点');
const maxPlayTimeEnd = content.indexOf('}, [timeline, audioItems]);', maxPlayTimeStart);
if (maxPlayTimeStart !== -1 && maxPlayTimeEnd !== -1) {
  const end = maxPlayTimeEnd + '}, [timeline, audioItems]);'.length;
  content = content.slice(0, maxPlayTimeStart) + '  // maxPlayTime 已迁移到 usePlaybackEngine' + content.slice(end);
  console.log('2. Replaced maxPlayTime');
}

// 3. Replace playLineLeft memo
const playLineStart = content.indexOf('  // 精确计算 playLine 的左边距');
const playLineEnd = content.indexOf('}, [playTime, timeline, pps]);', playLineStart);
if (playLineStart !== -1 && playLineEnd !== -1) {
  const end = playLineEnd + '}, [playTime, timeline, pps]);'.length;
  content = content.slice(0, playLineStart) + '  // playLineLeft 已迁移到 usePlaybackEngine' + content.slice(end);
  console.log('3. Replaced playLineLeft');
}

// 4. Replace triple click handler
const tripleStart = content.indexOf('  // 三连击检测算法');
const tripleEnd = content.indexOf('  };', tripleStart);
if (tripleStart !== -1 && tripleEnd !== -1) {
  // Find the end of the handleTripleClickZone function  
  const funcEnd = tripleEnd + '  };'.length;
  content = content.slice(0, tripleStart) + '  // handleTripleClickZone 已迁移到 usePlaybackEngine' + content.slice(funcEnd);
  console.log('4. Replaced triple click');
}

// 5. Replace togglePlay
const toggleStart = content.indexOf('  const togglePlay = () => {');
if (toggleStart !== -1) {
  const toggleEnd = content.indexOf('  };', toggleStart) + '  };'.length;
  content = content.slice(0, toggleStart) + '  // togglePlay 已迁移到 usePlaybackEngine' + content.slice(toggleEnd);
  console.log('5. Replaced togglePlay');
}

fs.writeFileSync(targetFile, content);
console.log('Done! Module 1 extraction applied.');
