const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// remove ProFontSelect
content = content.replace(/import ProFontSelectComp from '\.\/features\/text-workshop\/FontSelector';\s*const ProFontSelect = ProFontSelectComp;/, '');
// remove ProSlider
content = content.replace("import ProSlider from './components/ProSlider';\n", '');
// remove IosSelect
content = content.replace("import IosSelect from './components/IosSelect';\n", '');
// remove FILTER_PRESETS
content = content.replace(/import \{ FILTER_PRESETS as FILTER_PRESETS_MOD \} from '\.\/features\/filter-engine\/filterPresets';\s*const FILTER_PRESETS = FILTER_PRESETS_MOD;/, '');
// replace renderPremiumColorPicker with empty string or comment out
content = content.replace(/const renderPremiumColorPicker = \([^)]*\) => \(\s*<ColorPicker[^>]*\/>\s*\);/m, '');
content = content.replace("import { TimelineItem, AudioTimelineItem, GlobalDefaults, TextOverlay, GLOBAL_DEFAULTS_INIT, ANIMATION_PRESETS }", "import { TimelineItem, AudioTimelineItem, GlobalDefaults, TextOverlay, GLOBAL_DEFAULTS_INIT }");

fs.writeFileSync('src/App.tsx', content);
