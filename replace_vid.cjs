const fs = require('fs');

const file = 'src/components/VideoPropertyPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '{/* GROUP 4: 几何与时间 */}';
const startIndex = content.indexOf(startMarker);

if (startIndex !== -1) {
  const replacement = `      {/* GROUP 4: 几何、蒙版与转场 (独立组件) */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'transform' ? 'block' : 'none', padding: 0, background: 'transparent' }}>
        <TransformAndMaskPanel
          selectedItem={selectedItem!}
          updateSelectedProperty={updateSelectedProperty}
          updatePropertyWithUndo={updatePropertyWithUndo}
          finalizeSliderUndo={finalizeSliderUndo}
          commitSnapshotNow={commitSnapshotNow}
          isOverridden={isOverridden as any}
          restoreInheritance={restoreInheritance as any}
          
          favTrans={favTrans}
          toggleFavTrans={toggleFavTrans}
          setTimeline={setTimeline as any}
          setStatusMsg={setStatusMsg}
          
          orderTransform={Math.max(0, panelOrderImage.indexOf('transform'))}
          isCollapsedTransform={!!panelCollapsed['transform']}
          onToggleTransform={() => togglePanelCollapsed('transform')}
          onDragStartTransform={(e) => handleDragStart(e, 'transform')}
          onDropTransform={(e) => handleDrop(e, 'transform')}

          orderMask={Math.max(0, panelOrderImage.indexOf('mask'))}
          isCollapsedMask={!!panelCollapsed['mask']}
          onToggleMask={() => togglePanelCollapsed('mask')}
          onDragStartMask={(e) => handleDragStart(e, 'mask')}
          onDropMask={(e) => handleDrop(e, 'mask')}

          orderTransition={Math.max(0, panelOrderImage.indexOf('transition'))}
          isCollapsedTransition={!!panelCollapsed['transition']}
          onToggleTransition={() => togglePanelCollapsed('transition')}
          onDragStartTransition={(e) => handleDragStart(e, 'transition')}
          onDropTransition={(e) => handleDrop(e, 'transition')}
        />
      </div>
    </div>
  );
};`;
    
  // Find where it should end
  let lastIndex = content.lastIndexOf('</div>\n    </div>\n  );\n};');
  if (lastIndex === -1) lastIndex = content.lastIndexOf('</div>\n  );\n};'); // in case indentation differs
  if (lastIndex === -1) lastIndex = content.lastIndexOf('  );\n};'); // generic
  
  // Actually, VideoPropertyPanel end is:
  //       </div>
  //     </div>
  //   );
  // };
  // Let's just find the last occurrence of `  );`
  const lastReturnCbs = content.lastIndexOf('  );');
  
  if (lastReturnCbs !== -1) {
    // We just replace from startIndex up until the end of the file.
    let beforeReplace = content.substring(0, startIndex);
    content = beforeReplace + replacement;
    
    if (!content.includes('import { TransformAndMaskPanel } from \'./TransformAndMaskPanel\';')) {
        content = content.replace(
          /import \{ PropertyAccordionBlock \} from '\.\/PropertyAccordionBlock';/,
          "import { PropertyAccordionBlock } from './PropertyAccordionBlock';\nimport { TransformAndMaskPanel } from './TransformAndMaskPanel';"
        );
    }
    
    // Replace the state definition
    content = content.replace(
        /useState<string\[\]>\(\['video-base', 'img-colors', 'img-filters', 'img-keying', 'img-advanced'\]\)/g,
        "useState<string[]>(['video-base', 'img-colors', 'img-filters', 'img-keying', 'img-advanced', 'transform', 'mask', 'transition'])"
    );

    fs.writeFileSync(file, content);
    console.log('Fixed VideoPropertyPanel.tsx successfully!');
  } else {
    console.log('Could not find end of file structure');
  }
} else {
  console.log('Start marker not found');
}
