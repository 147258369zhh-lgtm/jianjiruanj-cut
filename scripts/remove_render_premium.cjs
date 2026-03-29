const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const strToFind = `  const renderPremiumColorPicker = (propKey: string, currentVal: string, defVal: string) => (
    <ColorPicker currentVal={currentVal} defVal={defVal} onChange={c => updateSelectedProperty(propKey as keyof TimelineItem, c)} />
  );`;

content = content.replace(strToFind, '');
// just in case it is different white space:
content = content.replace(/const renderPremiumColorPicker[\s\S]*?<\/ColorPicker>/g, '');
content = content.replace(/const renderPremiumColorPicker[\s\S]*?\);\n/g, '');

fs.writeFileSync('src/App.tsx', content);
