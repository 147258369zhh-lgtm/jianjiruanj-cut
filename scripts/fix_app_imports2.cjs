const fs = require('fs');

// Fix ImagePropertyPanel.tsx
let panelContent = fs.readFileSync('src/components/ImagePropertyPanel.tsx', 'utf8');
panelContent = panelContent.replace('TextOverlay, ', '');
fs.writeFileSync('src/components/ImagePropertyPanel.tsx', panelContent);

// Fix App.tsx
let appContent = fs.readFileSync('src/App.tsx', 'utf8');
appContent = appContent.replace(', ANIMATION_PRESETS', '');
appContent = appContent.replace(/import ProFontSelectComp from '\.\/features\/text-workshop\/FontSelector';\s*const ProFontSelect = ProFontSelectComp;/, '');
appContent = appContent.replace("import ProSlider from './components/ProSlider';\n", '');
appContent = appContent.replace("import IosSelect from './components/IosSelect';\n", '');
appContent = appContent.replace(/import \{ FILTER_PRESETS as FILTER_PRESETS_MOD \} from '\.\/features\/filter-engine\/filterPresets';\s*const FILTER_PRESETS = FILTER_PRESETS_MOD;/, '');
appContent = appContent.replace(/const renderPremiumColorPicker = \([^)]*\) => \(\s*<ColorPicker[^>]*\/>\s*\);/m, '');
appContent = appContent.replace(/updateSelectedProperty=\{updateSelectedProperty\}/, "updateSelectedProperty={updateSelectedProperty as any}");

fs.writeFileSync('src/App.tsx', appContent);
