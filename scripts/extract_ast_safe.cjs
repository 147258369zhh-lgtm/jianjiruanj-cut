const fs = require('fs');
const ts = require('typescript');

const APP_PATH = 'src/App.tsx';
const HOOK_PATH = 'src/hooks/useAppController.ts';

const srcFile = ts.createSourceFile(
  'App.tsx',
  fs.readFileSync(APP_PATH, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);

// Collect imports
const importStatements = [];
// Find the App function node
let appFuncNode = null;

ts.forEachChild(srcFile, node => {
  if (ts.isImportDeclaration(node)) {
    importStatements.push(node.getText());
  } else if (ts.isFunctionDeclaration(node) && node.name && node.name.text === 'App') {
    appFuncNode = node;
  }
});

if (!appFuncNode) {
  console.error('App func not found!');
  process.exit(1);
}

// Extract variables from App func
const exportedVars = new Set();

appFuncNode.body.statements.forEach(stmt => {
  // If it's a return statement, we stop
  if (ts.isReturnStatement(stmt)) {
    return;
  }

  if (ts.isVariableStatement(stmt)) {
    stmt.declarationList.declarations.forEach(decl => {
      if (ts.isIdentifier(decl.name)) {
        exportedVars.add(decl.name.text);
      } else if (ts.isArrayBindingPattern(decl.name)) {
        decl.name.elements.forEach(el => {
          if (!ts.isOmittedExpression(el) && ts.isIdentifier(el.name)) {
            exportedVars.add(el.name.text);
          }
        });
      } else if (ts.isObjectBindingPattern(decl.name)) {
        decl.name.elements.forEach(el => {
          if (ts.isIdentifier(el.name)) {
            exportedVars.add(el.name.text);
          }
        });
      }
    });
  } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
    exportedVars.add(stmt.name.text);
  }
});

const varArray = Array.from(exportedVars).filter(v => v !== '_isFullscreen' && v !== '_showAdvancedExport'); // ignore these unused

// Now generate the body logic perfectly
const originalLines = fs.readFileSync(APP_PATH, 'utf8').split('\n');

const logicStart = appFuncNode.body.statements[0].getStart(srcFile);
const logicEndLine = originalLines.findIndex(l => l.startsWith('  return ('));

const hookBodyLines = originalLines.slice(
  srcFile.getLineAndCharacterOfPosition(logicStart).line,
  logicEndLine
);

// Generate hook code
const hookCode = `
${importStatements.join('\n').replace(/from '\.\/components/g, "from '../components").replace(/from '\.\/hooks/g, "from '.")}

export function useAppController() {
${hookBodyLines.join('\n')}

  return {
    ${varArray.join(',\n    ')}
  };
}
`;

fs.writeFileSync(HOOK_PATH, hookCode);
console.log('Successfully wrote', HOOK_PATH);

// Generate App.tsx code
const appTop = originalLines.slice(0, srcFile.getLineAndCharacterOfPosition(appFuncNode.getStart(srcFile)).line);

const appCode = `
${appTop.join('\n').replace(/import \{ useAppController \}.*/, '')}
import { useAppController } from './hooks/useAppController';

function App() {
  const {
    ${varArray.join(',\n    ')}
  } = useAppController();

${originalLines.slice(logicEndLine).join('\n')}
`;

fs.writeFileSync(APP_PATH, appCode);
console.log('Successfully updated App.tsx');
