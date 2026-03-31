const fs = require('fs');

const extractProps = (file) => {
  const code = fs.readFileSync(file, 'utf8');
  const props = new Set();
  const matches = [...code.matchAll(/updateSelectedProperty\('([^']+)'/g)];
  matches.forEach(m => props.add(m[1]));
  return [...props];
};

const imageProps = extractProps('src/components/ImagePropertyPanel.tsx');
const videoProps = extractProps('src/components/VideoPropertyPanel.tsx');
const allProps = [...new Set([...imageProps, ...videoProps])];

const monitorCode = fs.readFileSync('src/components/MonitorPanel.tsx', 'utf8');
const exportCode = fs.readFileSync('src/hooks/useAppController.ts', 'utf8');

console.log("=== COMPREHENSIVE COMPATIBILITY REPORT ===\n");

allProps.forEach(prop => {
  const inMonitor = monitorCode.includes(`.${prop}`) || monitorCode.includes(`['${prop}']`);
  const inExport = exportCode.includes(`.${prop}`) || exportCode.includes(`['${prop}']`);
  
  if (!inMonitor || !inExport) {
    let status = [];
    if (!inMonitor) status.push("NO PREVIEW");
    if (!inExport) status.push("NO EXPORT");
    console.log(`- ${prop.padEnd(20)}: ${status.join(' | ')}`);
  }
});
