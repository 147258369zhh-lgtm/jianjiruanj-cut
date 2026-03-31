const fs = require('fs');

const lines = fs.readFileSync('errors.txt', 'utf8').split('\n');
for (let i = 0; i < 30 && i < lines.length; i++) {
  console.log(lines[i]);
}
