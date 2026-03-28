const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The issue happens because we replaced:
// <div ... label={<span...></span>}> with <div ...>{<span...<label...></label></span>}>
// The trailing `}>` is a syntax error in JSX. We should remove the `}>` and the opening `{`.

// Look for `<div className="ios-field" >{`
// And `}>` closing it.
let parts = content.split('<div className="ios-field" >{');
if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
        // Find the matching `}>`
        let closeIdx = parts[i].indexOf('}>\n');
        if (closeIdx === -1) closeIdx = parts[i].indexOf('}>\r\n');
        if (closeIdx !== -1) {
            parts[i] = parts[i].substring(0, closeIdx) + '\n' + parts[i].substring(closeIdx + 2); // remove `}>`
        }
    }
    content = parts.join('<div className="ios-field" >\n'); // remove opening `{`
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed stray }> in App.tsx');
