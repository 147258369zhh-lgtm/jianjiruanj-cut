const fs = require('fs');
let file = fs.readFileSync('src/components/ContextMenuWidget.tsx', 'utf8');

// Replace the escaped backticks and string interpolation from the file
// Currently it is: id: \`tm_\${Date.now()}_cp\`
file = file.replace(/\\`tm_\\\$\{Date.now\(\)\}_cp\\`/g, "`tm_${Date.now()}_cp`");

fs.writeFileSync('src/components/ContextMenuWidget.tsx', file);
