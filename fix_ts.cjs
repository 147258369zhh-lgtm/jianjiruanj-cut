const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/e=>\{e\.currentTarget\.style\.opacity='1'\}/g, "(e: any)=>{e.currentTarget.style.opacity='1'}");
  fs.writeFileSync(file, code);
  console.log("Fixed any types in " + file);
}

fix('src/components/ImagePropertyPanel.tsx');
fix('src/components/VideoPropertyPanel.tsx');
