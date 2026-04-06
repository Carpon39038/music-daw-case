const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf-8').split('\n');

// 2790 is `<div className="inspector-row">` for Gain. Let's insert `<details>` before it.
// Wait, we need to find it by content.

let gainRowIdx = lines.findIndex(l => l.includes('<label htmlFor="selected-clip-gain">Gain</label>'));
// it's inside `<div className="inspector-row">` on previous line.
if (gainRowIdx > 0 && lines[gainRowIdx-1].includes('inspector-row')) {
  lines.splice(gainRowIdx-1, 0, '            <details className="inspector-group" data-testid="inspector-clip-advanced">', '              <summary className="inspector-subtitle" style={{cursor: "pointer", marginBottom: "8px"}}>Advanced Clip Params</summary>');
}

// Now find where to close it.
// `<button` line 2886 `data-testid="selected-clip-mute-btn"`
let muteBtnIdx = lines.findIndex(l => l.includes('data-testid="selected-clip-mute-btn"'));
if (muteBtnIdx > 0) {
  // It's `<button` on the previous line
  let buttonLineIdx = muteBtnIdx - 1;
  lines.splice(buttonLineIdx, 0, '            </details>', '            <div style={{display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "12px"}}>');
}

// And close the div after Duplicate Clip
let duplicateBtnIdx = lines.findIndex(l => l.includes('Duplicate Clip'));
// `Duplicate Clip` is text inside the button. The closing tag is `</button>` on the next line.
if (duplicateBtnIdx > 0) {
  lines.splice(duplicateBtnIdx + 2, 0, '            </div>');
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log("Layout 4 patched");
