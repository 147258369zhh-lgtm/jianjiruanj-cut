const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
content = content.replace(
  "import { AudioPropertyPanel } from './components/AudioPropertyPanel';",
  "import { AudioPropertyPanel } from './components/AudioPropertyPanel';\nimport { ImagePropertyPanel } from './components/ImagePropertyPanel';"
);

const startMarker = "<div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40, minHeight: '100%' }}>";
const endMarker = "                      </AudioPropertyPanel>";

const startIdx = content.indexOf(startMarker);
const searchRegion = content.substring(startIdx);
const endIdxLocal = searchRegion.indexOf("                    ) : (\n                      <AudioPropertyPanel");

if (startIdx !== -1 && endIdxLocal !== -1) {
  const endIdx = startIdx + endIdxLocal;
  const replacement = `<ImagePropertyPanel
                        selectedIds={selectedIds}
                        timeline={timeline}
                        setTimeline={setTimeline}
                        selectedItem={selectedItem}
                        propertyTab={propertyTab}
                        setPropertyTab={setPropertyTab}
                        setStatusMsg={setStatusMsg}
                        updateSelectedProperty={updateSelectedProperty as any}
                        commitSnapshotNow={commitSnapshotNow}
                        isOverridden={isOverridden}
                        restoreInheritance={restoreInheritance}
                        resourceMap={resourceMap}
                        localDuration={localDuration}
                        setLocalDuration={setLocalDuration}
                        updatePropertyWithUndo={updatePropertyWithUndo}
                        finalizeSliderUndo={finalizeSliderUndo}
                        applyAllToTimeline={applyAllToTimeline}
                        audioItems={audioItems}
                        selectedTextIds={selectedTextIds}
                        setSelectedTextIds={setSelectedTextIds}
                        isCropping={isCropping}
                        setIsCropping={setIsCropping}
                        crop={crop}
                        setCrop={setCrop}
                        favTrans={favTrans}
                        toggleFavTrans={toggleFavTrans}
                      />
`;
  content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync('src/App.tsx', content);
  console.log('Successfully replaced ImagePropertyPanel in App.tsx');
} else {
  console.log('Could not find markers', startIdx, endIdxLocal);
}
