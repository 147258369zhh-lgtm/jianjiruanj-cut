const fs = require('fs');

const file = 'src/components/ImagePropertyPanel.tsx';
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
          
          isCropping={isCropping}
          setIsCropping={setIsCropping}
          crop={crop}
          setCrop={setCrop}
          favTrans={favTrans}
          toggleFavTrans={toggleFavTrans}
          setTimeline={setTimeline as any}
          setStatusMsg={setStatusMsg}
          
          orderTransform={Math.max(0, panelOrderImage.indexOf('transform'))}
          isCollapsedTransform={!!panelCollapsedImage['transform']}
          onToggleTransform={() => togglePanelCollapsedImage('transform')}
          onDragStartTransform={(e) => handleDragStart(e, 'transform')}
          onDropTransform={(e) => handleDrop(e, 'transform')}

          orderMask={Math.max(0, panelOrderImage.indexOf('mask'))}
          isCollapsedMask={!!panelCollapsedImage['mask']}
          onToggleMask={() => togglePanelCollapsedImage('mask')}
          onDragStartMask={(e) => handleDragStart(e, 'mask')}
          onDropMask={(e) => handleDrop(e, 'mask')}

          orderTransition={Math.max(0, panelOrderImage.indexOf('transition'))}
          isCollapsedTransition={!!panelCollapsedImage['transition']}
          onToggleTransition={() => togglePanelCollapsedImage('transition')}
          onDragStartTransition={(e) => handleDragStart(e, 'transition')}
          onDropTransition={(e) => handleDrop(e, 'transition')}
        />
      </div>
    </div>
  );
};`;
    
  content = content.substring(0, startIndex) + replacement;
  
  if (!content.includes('import { TransformAndMaskPanel } from \'./TransformAndMaskPanel\';')) {
      content = content.replace(
        /import \{ PropertyAccordionBlock \} from '\.\/PropertyAccordionBlock';/,
        "import { PropertyAccordionBlock } from './PropertyAccordionBlock';\nimport { TransformAndMaskPanel } from './TransformAndMaskPanel';"
      );
  }
  
  content = content.replace(
      /useState<string\[\]>\(\['img-colors', 'img-filters', 'img-keying', 'img-advanced'\]\)/,
      "useState<string[]>(['img-colors', 'img-filters', 'img-keying', 'img-advanced', 'transform', 'mask', 'transition'])"
  );
  
  fs.writeFileSync(file, content);
  console.log('Fixed ImagePropertyPanel.tsx successfully.');
} else {
  console.log('Start marker not found');
}
