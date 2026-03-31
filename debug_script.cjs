const fs = require('fs');
const filepath = 'src/components/ImagePropertyPanel.tsx';
let txt = fs.readFileSync(filepath, 'utf8');

// I will just read lines 120-220 and print them nicely to a local utf8 file
const lines = txt.split('\n').slice(120, 220);
fs.writeFileSync('debug_utf8.txt', lines.join('\n'), 'utf8');
