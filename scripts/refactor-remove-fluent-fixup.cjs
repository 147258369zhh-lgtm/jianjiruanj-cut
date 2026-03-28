const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Fix onChange={(e, data) => setX(data.value)} or onChange={(_e, d) => setX(d.value)}
content = content.replace(/onChange=\{\s*\([^,]+,\s*([^)]+)\)\s*=>\s*([^{]+?)\(\s*\1\.value\s*\)\s*\}/g, 'onChange={(e) => $2(e.target.value)}');

// Fix inline onChange where it's multiline or has a body
content = content.replace(/onChange=\{\s*\([^,]+,\s*([^)]+)\)\s*=>\s*\{([^}]+)\1\.value([^}]+)\}\s*\}/g, (all, param, before, after) => {
    return 'onChange={(e) => {' + before + 'e.target.value' + after + '}}';
});

// Fix specific onChange={(ev, data) => handleSearch(data.value)}
content = content.replace(/onChange=\{\(\w+,\s*(\w+)\) => ([\w.]+)\(\1\.value\)\}/g, 'onChange={(e) => $2(e.target.value)}');

// 2. Fix stray label="..." on <div className="ios-field">
content = content.replace(/(<div\s+className="ios-field"[\s\S]*?)label="([^"]+)"([\s\S]*?>)/g, (match, part1, label, part2) => {
    // If it's closed immediately with >, we inject the label inside
    let tag = part1 + part2;
    // We can't easily inject the label element exactly inside if it has children unless we do it blindly right after the >. 
    // In our codebase, <Field> wraps children. So the first > is the opening tag end.
    const closeIdx = tag.indexOf('>');
    return tag.substring(0, closeIdx + 1) + `<label className="ios-field-label">${label}</label>` + tag.substring(closeIdx + 1);
});

// 3. Fix multiple className="abc" className="def"
content = content.replace(/<[^>]+>/g, (tag) => {
    const classMatches = [...tag.matchAll(/className="([^"]+)"/g)];
    if (classMatches.length > 1) {
        let combined = classMatches.map(m => m[1]).join(' ');
        // Remove all classNames from tag
        let cleanTag = tag.replace(/\s*className="[^"]+"/g, '');
        // Inject single className
        return cleanTag.replace(/<([a-zA-Z0-9]+)/, `<$1 className="${combined}"`);
    }
    return tag;
});

// Fix any leftover <Field> that got missed because of multiline props
content = content.replace(/<Field([\s\S]*?)>/g, (match, props) => {
    let labelMatch = props.match(/label="([^"]*)"/);
    let label = labelMatch ? labelMatch[1] : '';
    let cleanProps = props.replace(/label="[^"]*"/g, '');
    return `<div className="ios-field"${cleanProps}>${label ? `<label className="ios-field-label">${label}</label>` : ''}`;
});
content = content.replace(/<\/Field>/g, '</div>');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed up App.tsx TypeScript issues.');
