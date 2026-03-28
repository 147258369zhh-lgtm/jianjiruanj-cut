const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Regex to safely replace Button
content = content.replace(/<Button([\s\S]*?)<\/Button>/g, (match) => {
  let inner = match.replace(/^<Button/, '<button className="ios-button"');
  inner = inner.replace(/<\/Button>$/, '</button>');
  
  // Now replace known Fluent UI props inside the tag ONLY (before the >)
  // We'll find the first > that closes the opening tag.
  const firstCloseIdx = inner.indexOf('>');
  if (firstCloseIdx === -1) return inner;

  let openTag = inner.substring(0, firstCloseIdx);
  let rest = inner.substring(firstCloseIdx);

  // Map properties to classes
  if (openTag.includes('appearance="primary"')) openTag = openTag.replace('className="ios-button"', 'className="ios-button ios-button-primary"');
  if (openTag.includes('appearance="subtle"')) openTag = openTag.replace('className="ios-button"', 'className="ios-button ios-button-subtle"');
  if (openTag.includes('appearance="transparent"')) openTag = openTag.replace('className="ios-button"', 'className="ios-button ios-button-transparent"');
  
  if (openTag.includes('size="small"')) openTag = openTag.replace('className="', 'className="ios-button-small ');

  // Strip FluentUI props safely
  openTag = openTag
    .replace(/\s+appearance="[^"]*"/g, '')
    .replace(/\s+size="[^"]*"/g, '')
    .replace(/\s+shape="[^"]*"/g, '')
    .replace(/\s+icon=\{[^}]+\}/g, '');

  return openTag + rest;
});

// Regex for <Input> (self closing or not)
content = content.replace(/<Input([^>]*?)>/g, (match, props) => {
  let openTag = '<input className="ios-input"' + props + '>';
  openTag = openTag
    .replace(/\s+appearance="[^"]*"/g, '')
    .replace(/\s+size="[^"]*"/g, '')
    .replace(/\s+onChange=\{\(e,\s*d\)\s*=>([^}]+)\}/g, (m, body) => {
        // FluentUI Input onChange gives (e, data) => set(data.value). We map to (e) => set(e.target.value)
        return ` onChange={(e) => { const d = { value: e.target.value }; (${body.trim()})(); } }`.replace(/\(\); \}\s*$/, '}');
        // Actually, safer to just replace standard occurrences in our codebase:
        // onChange={(e, d) => setVar(d.value)}
        // We will fix onChange manually if needed, but let's try a simple replace:
    });
  return openTag;
});

// Remove fluent imports
content = content.replace(/import\s*\{[^}]*FluentProvider([^}]*)\}\s*from\s*"@fluentui\/react-components";/, '');

content = content.replace(/<FluentProvider[^>]*>/, '<div className="app-root-container">');
content = content.replace(/<\/FluentProvider>/, '</div>');

content = content.replace(/<Field([^>]*?)>/g, '<div className="ios-field"$1>');
content = content.replace(/<\/Field>/g, '</div>');

content = content.replace(/<Text([^>]*?)>/g, '<div className="ios-text"$1>');
content = content.replace(/<\/Text>/g, '</div>');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fluent UI stripped safely.');
