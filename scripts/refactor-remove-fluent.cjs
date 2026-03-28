const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(appTsxPath, 'utf-8');

// 1. Remote FluentUI imports
content = content.replace(/import\s*\{[^}]*FluentProvider,[^}]*\}\s*from\s*"@fluentui\/react-components";/, '');

// 2. Remove FluentProvider wrapper
// This is `<FluentProvider theme={webDarkTheme} style={{ height: '100vh', width: '100vw', background: 'transparent' }}>`
content = content.replace(/<FluentProvider[^>]*>/, '<div className="app-root-container" style={{ height: "100vh", width: "100vw", background: "transparent", color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>');
content = content.replace(/<\/FluentProvider>/, '</div>');

// 3. Replace <Button> with <button>
// E.g. <Button size="small" appearance="primary" ...> => <button className="ios-button ios-button-primary ios-button-small" ...>
content = content.replace(/<Button([^>]*)>/g, (match, props) => {
  let className = "ios-button";
  if (props.includes('appearance="primary"')) className += " ios-button-primary";
  else if (props.includes('appearance="subtle"')) className += " ios-button-subtle";
  else if (props.includes('appearance="transparent"')) className += " ios-button-transparent";
  else className += " ios-button-default";

  if (props.includes('size="small"')) className += " ios-button-small";
  if (props.includes('shape="circular"')) className += " ios-button-circular";

  // clean up unsupported attributes from raw button
  let cleanProps = props
    .replace(/appearance="[^"]*"/g, '')
    .replace(/size="[^"]*"/g, '')
    .replace(/shape="[^"]*"/g, '')
    .replace(/icon=\{<[^>]*>\}/g, ''); // we'll lose icon but fluent icons are an issue anyway

  // Merge with existing className if any
  const classMatch = cleanProps.match(/className="([^"]*)"/);
  if (classMatch) {
    className += ' ' + classMatch[1];
    cleanProps = cleanProps.replace(/className="[^"]*"/, `className="${className}"`);
  } else {
    cleanProps += ` className="${className}"`;
  }

  return `<button${cleanProps}>`;
});
content = content.replace(/<\/Button>/g, '</button>');

// 4. Replace <Input> with <input>
content = content.replace(/<Input([^>]*)(\/?)>/g, (match, props, selfClosing) => {
  let className = "ios-input";
  let cleanProps = props
    .replace(/appearance="[^"]*"/g, '')
    .replace(/size="[^"]*"/g, '');
  
  const classMatch = cleanProps.match(/className="([^"]*)"/);
  if (classMatch) {
    className += ' ' + classMatch[1];
    cleanProps = cleanProps.replace(/className="[^"]*"/, `className="${className}"`);
  } else {
    cleanProps += ` className="${className}"`;
  }

  return `<input${cleanProps} ${selfClosing ? '/>' : '>'}`;
});
// in case there's an </Input> (which Input shouldn't have children)
content = content.replace(/<\/Input>/g, '');

// 5. Replace <Field> and <Text> with <div>
content = content.replace(/<Field([^>]*)>/g, (match, props) => {
  let labelMatch = props.match(/label="([^"]*)"/);
  let label = labelMatch ? labelMatch[1] : '';
  let cleanProps = props.replace(/label="[^"]*"/g, '');
  return `<div className="ios-field"${cleanProps}>${label ? `<label className="ios-field-label">${label}</label>` : ''}`;
});
content = content.replace(/<\/Field>/g, '</div>');

content = content.replace(/<Text([^>]*)>/g, '<div className="ios-text"$1>');
content = content.replace(/<\/Text>/g, '</div>');

fs.writeFileSync(appTsxPath, content, 'utf-8');
console.log('Fluent UI stripped and replaced.');
