const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf-8').split('\n');

let startIdx = lines.findIndex(l => l.includes('label htmlFor="selected-clip-gain"')) - 1;
let muteIdx = lines.findIndex(l => l.includes('data-testid="selected-clip-mute-btn"')) - 1;

lines.splice(startIdx, 0, '            <details className="inspector-group" data-testid="inspector-clip-advanced">', '              <summary className="inspector-subtitle" style={{cursor: "pointer", marginBottom: "8px"}}>Advanced Clip Params</summary>');

// because we added 2 lines, muteIdx shifted by 2
muteIdx += 2;

lines.splice(muteIdx, 0, '            </details>', '            <div style={{display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "12px"}}>');

let duplicateIdx = lines.findIndex(l => l.includes('Duplicate Clip')) + 1; // line with </button>
lines.splice(duplicateIdx + 1, 0, '            </div>');

fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log("Layout final patched");
