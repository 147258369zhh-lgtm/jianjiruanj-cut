const { execSync } = require('child_process');
try {
  execSync('npx tsc --noEmit', { encoding: 'utf8' });
  console.log("No TS errors!");
} catch (e) {
  const lines = e.stdout.split('\n');
  console.log("TS Errors found:");
  for (let i = 0; i < 30 && i < lines.length; i++) {
    console.log(lines[i]);
  }
}
