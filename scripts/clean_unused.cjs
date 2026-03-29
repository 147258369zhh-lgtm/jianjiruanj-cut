const { execSync } = require('child_process');
const fs = require('fs');
try {
  execSync('npx tsc src/App.tsx --noEmit', {stdio: 'pipe'});
} catch(e) {
  const out = e.stdout.toString();
  const unusedSet = new Set([...out.matchAll(/error TS6133: '([^']+)' is/g)].map(m => m[1]));
  let code = fs.readFileSync('src/App.tsx', 'utf8');
  
  // Also clean up top unused imports
  const unusedImports = ['useStore', 'useShallow', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback'];
  unusedImports.forEach(i => unusedSet.add(i));

  const codeLines = code.split('\n');
  const newLines = codeLines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') && unusedImports.some(i => trimmed.includes(i))) return false;
    
    // Check if line is just "  unusedVar," or "unusedVar"
    const match = trimmed.match(/^([a-zA-Z0-9_]+),?$/);
    if (match && unusedSet.has(match[1])) {
      return false;
    }
    return true;
  });

  fs.writeFileSync('src/App.tsx', newLines.join('\n'));
  console.log('Cleaned up', unusedSet.size, 'unused vars');
}
