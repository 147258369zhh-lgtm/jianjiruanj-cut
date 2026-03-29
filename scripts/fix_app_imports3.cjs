let fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The file has const ProSlider = ProSliderMod; - let's remove it
content = content.replace(/const ProSlider = ProSliderMod;\s*/, '');
// The file has import ProSliderMod from './components/ProSlider'; - remove
content = content.replace(/import ProSliderMod from '\.\/components\/ProSlider';\s*/, '');

// The file has const FILTER_PRESETS = FILTER_PRESETS_MOD; - let's remove it
content = content.replace(/const FILTER_PRESETS = FILTER_PRESETS_MOD;\s*/, '');
// The file has import { FILTER_PRESETS as FILTER_PRESETS_MOD } - let's remove it
content = content.replace(/import \{ FILTER_PRESETS as FILTER_PRESETS_MOD \} from '\.\/features\/filter-engine\/filterPresets';\s*/, '');

// The file has updatePropertyWithUndo={updatePropertyWithUndo}
content = content.replace('updatePropertyWithUndo={updatePropertyWithUndo}', 'updatePropertyWithUndo={updatePropertyWithUndo as any}');

// Just in case updateSelectedProperty={updateSelectedProperty} wasn't matched properly in the previous script:
content = content.replace('updateSelectedProperty={updateSelectedProperty}', 'updateSelectedProperty={updateSelectedProperty as any}');

fs.writeFileSync('src/App.tsx', content);

// And ImagePropertyPanel had TextOverlay unused import.
let panelContent = fs.readFileSync('src/components/ImagePropertyPanel.tsx', 'utf8');
panelContent = panelContent.replace('TextOverlay, ', '');
fs.writeFileSync('src/components/ImagePropertyPanel.tsx', panelContent);
