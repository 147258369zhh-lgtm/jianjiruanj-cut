const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import for TimelinePanel
content = content.replace("import { ImagePropertyPanel } from './components/ImagePropertyPanel';", "import { ImagePropertyPanel } from './components/ImagePropertyPanel';\nimport { TimelinePanel } from './components/TimelinePanel';");

const startMarker = '{/* BOTTOM ZONE */}';
const endMarker = '</div>\n    </div>\n  );\n}';

const startIdx = content.indexOf(startMarker);
const endIdx = content.lastIndexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `{/* BOTTOM ZONE */}
        <TimelinePanel
          playTime={playTime}
          maxPlayTime={maxPlayTime}
          setPlayTime={setPlayTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          setStatusMsg={setStatusMsg}
          setIsJumping={setIsJumping}
          isJumping={isJumping}
          splitAtPlayhead={splitAtPlayhead}
          pps={pps}
          setPps={setPps}
          commitSnapshotNow={commitSnapshotNow}
          timeline={timeline}
          setTimeline={setTimeline}
          audioItems={audioItems}
          setAudioItems={setAudioItems}
          timelineScrollRef={timelineScrollRef}
          handleTimelineMouseMove={handleTimelineMouseMove}
          handleTimelineMouseUp={handleTimelineMouseUp}
          handleTimelineWheel={handleTimelineWheel}
          timelineWidth={timelineWidth}
          seekToX={seekToX}
          setIsDraggingHead={setIsDraggingHead}
          isDraggingHead={isDraggingHead}
          playLineLeft={playLineLeft}
          playheadRef={playheadRef}
          selectionBox={selectionBox}
          setSelectionBox={setSelectionBox}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          selectedAudioIds={selectedAudioIds}
          setSelectedAudioIds={setSelectedAudioIds}
          selectedVoiceoverIds={selectedVoiceoverIds}
          setSelectedVoiceoverIds={setSelectedVoiceoverIds}
          resourceMap={resourceMap}
          previewCache={previewCache}
          sortMode={sortMode}
          setSortMode={setSortMode}
          handleTimelineSelect={handleTimelineSelect}
          handleTimelineRemove={handleTimelineRemove}
          handleTimelineContextMenu={handleTimelineContextMenu}
          handleTimelineTrim={handleTimelineTrim}
          handleTimelineDoubleClick={handleTimelineDoubleClick}
          isEditingAudio={isEditingAudio}
          updateAudioItem={updateAudioItem}
          handleAudioSelect={handleAudioSelect}
          voiceoverClips={voiceoverClips}
          setVoiceoverClips={setVoiceoverClips}
          handleTripleClickZone={handleTripleClickZone}
        />
      `;
  
  content = content.substring(0, startIdx) + replacement + '\n      ' + content.substring(endIdx);
  
  // also remove old imports from App.tsx
  content = content.replace(/import \{ DndContext.*\} from '@dnd-kit\/core';\n/, '');
  content = content.replace(/import \{ arrayMove.*\} from '@dnd-kit\/sortable';\n/, '');
  content = content.replace(/import \{ restrictToParentElement.*\} from '@dnd-kit\/modifiers';\n/, '');
  content = content.replace(/import \{ SortableImageCard.*\} from '\.\/components\/SortableImageCard';\n/, '');
  content = content.replace(/import \{ AudioTrackItem \} from '\.\/components\/AudioTrackItem';\n/, '');
  
  fs.writeFileSync('src/App.tsx', content);
  console.log('App.tsx updated effectively!');
} else {
  console.log('Could not find markers', startIdx, endIdx);
}
