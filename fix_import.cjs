const fs = require('fs');

function fixImport(file) {
  let code = fs.readFileSync(file, 'utf8');
  
  // replace useUIStore with useStore from index
  code = code.replace("import { useUIStore } from '../store/slices/uiSlice';", "import { useStore } from '../store/index';");
  
  // replace const {...} = useUIStore(); with const { ... } = useStore();
  code = code.replace("= useUIStore();", "= useStore();");

  fs.writeFileSync(file, code);
  console.log("Fixed store in " + file);
}

fixImport('src/components/ImagePropertyPanel.tsx');
fixImport('src/components/VideoPropertyPanel.tsx');
