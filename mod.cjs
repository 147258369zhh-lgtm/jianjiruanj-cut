const fs = require('fs');

function processPanel(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Add import
  if (!content.includes('TransformAndMaskPanel')) {
    content = content.replace(
      /import \{ PropertyAccordionBlock \} from '\.\/PropertyAccordionBlock';/,
      "import { PropertyAccordionBlock } from './PropertyAccordionBlock';\nimport { TransformAndMaskPanel } from './TransformAndMaskPanel';"
    );
  }

  // Find panelCollapsed match
  const panelCollapsedMatch = content.match(/const \[(panelCollapsed\w*?),/);
  const panelCollapsedVar = panelCollapsedMatch ? panelCollapsedMatch[1] : 'panelCollapsedImage';

  const toggleFnMatch = content.match(/const (togglePanelCollapsed\w*?) =/);
  const toggleFn = toggleFnMatch ? toggleFnMatch[1] : 'togglePanelCollapsed';

  // State update
  content = content.replace(
    /useState<string\[\]>\(\['img-colors', 'img-filters', 'img-keying', 'img-advanced'\]\)/,
    "useState<string[]>(['img-colors', 'img-filters', 'img-keying', 'img-advanced', 'transform', 'mask', 'transition'])"
  );
  content = content.replace(
    /useState<string\[\]>\(\['video-base', 'img-colors', 'img-filters', 'img-keying', 'img-advanced'\]\)/,
    "useState<string[]>(['video-base', 'img-colors', 'img-filters', 'img-keying', 'img-advanced', 'transform', 'mask', 'transition'])"
  );

  const startIndex = content.indexOf('{/* GROUP 4: 几何与时间 */}');
  if (startIndex === -1) {
    console.log('Start index not found in', file);
    return;
  }

  let endIndex = content.indexOf('{/* ======= 调试与占位 ======= */}', startIndex);
  if (endIndex === -1) {
    endIndex = content.indexOf('</div>\n\n    </div>\n  );\n};', startIndex);
  }
  
  if (endIndex === -1) {
    console.log('End index not found in', file);
    return;
  }

  let replacement = `      {/* GROUP 4: 几何、蒙版与转场 (独立组件) */}
      <div className="ios-prop-group" style={{ display: propertyTab === 'transform' ? 'block' : 'none', padding: 0, background: 'transparent' }}>
        <TransformAndMaskPanel
          selectedItem={selectedItem!}
          updateSelectedProperty={updateSelectedProperty}
          updatePropertyWithUndo={updatePropertyWithUndo}
          finalizeSliderUndo={finalizeSliderUndo}
          commitSnapshotNow={commitSnapshotNow}
          isOverridden={isOverridden}
          restoreInheritance={restoreInheritance}
          
          orderTransform={Math.max(0, panelOrderImage.indexOf('transform'))}
          isCollapsedTransform={!!${panelCollapsedVar}['transform']}
          onToggleTransform={() => ${toggleFn}('transform')}
          onDragStartTransform={(e) => handleDragStart(e, 'transform')}
          onDropTransform={(e) => handleDrop(e, 'transform')}

          orderMask={Math.max(0, panelOrderImage.indexOf('mask'))}
          isCollapsedMask={!!${panelCollapsedVar}['mask']}
          onToggleMask={() => ${toggleFn}('mask')}
          onDragStartMask={(e) => handleDragStart(e, 'mask')}
          onDropMask={(e) => handleDrop(e, 'mask')}

          orderTransition={Math.max(0, panelOrderImage.indexOf('transition'))}
          isCollapsedTransition={!!${panelCollapsedVar}['transition']}
          onToggleTransition={() => ${toggleFn}('transition')}
          onDragStartTransition={(e) => handleDragStart(e, 'transition')}
          onDropTransition={(e) => handleDrop(e, 'transition')}
        />
      </div>\n\n      `;
      
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

  fs.writeFileSync(file, content);
  console.log('Fixed', file);
}

processPanel('src/components/ImagePropertyPanel.tsx');
processPanel('src/components/VideoPropertyPanel.tsx');
