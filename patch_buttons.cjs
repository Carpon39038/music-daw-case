const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf-8').split('\n');

let muteBtnIdx = lines.findIndex(l => l.includes('data-testid="selected-clip-mute-btn"'));
let splitBtnEndIdx = lines.findIndex(l => l.includes('Split Clip'));
if (muteBtnIdx > 0 && splitBtnEndIdx > 0) {
  // `<button` is at muteBtnIdx - 1
  lines.splice(muteBtnIdx - 1, 0, '            <div className="inspector-actions" style={{display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px", borderTop: "1px solid #2d3748", paddingTop: "12px"}}>');
  
  // `Split Clip` is at splitBtnEndIdx, `</button>` is at splitBtnEndIdx + 1
  lines.splice(splitBtnEndIdx + 2, 0, '            </div>');
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log("Buttons patched");
