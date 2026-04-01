const fs = require('fs');

const file = 'src/components/MonitorPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// The transform string we need to update
const regex = /transform:\s*`translate[^`]+`/g;

const newTransform = "transform: `perspective(1000px) translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) rotateY(${monitorSrc.currentItem?.keystoneX || 0}deg) rotateX(${monitorSrc.currentItem?.keystoneY || 0}deg) scale(${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, ${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})`";

content = content.replace(regex, newTransform);

fs.writeFileSync(file, content);
console.log('MonitorPanel keystone transforms injected!');
