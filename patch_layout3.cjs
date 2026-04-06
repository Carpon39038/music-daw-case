const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// The clip settings part has:
// <div className="inspector-row">
//   <label htmlFor="selected-clip-gain">Gain</label>

const gainStr = '<div className="inspector-row">\n              <label htmlFor="selected-clip-gain">Gain</label>';
const gainReplacement = `<details className="inspector-group" data-testid="inspector-clip-advanced">
              <summary className="inspector-subtitle" style={{cursor: "pointer", marginBottom: "8px"}}>Advanced Clip Params</summary>
            <div className="inspector-row">
              <label htmlFor="selected-clip-gain">Gain</label>`;

const buttonsStr = '<button\n              data-testid="selected-clip-mute-btn"';
const buttonsReplacement = `</details>\n            <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '12px'}}>\n            <button\n              data-testid="selected-clip-mute-btn"`;

const duplicateBtnStr = 'onClick={() => duplicateClip(selectedClipData.track.id, selectedClipData.clip.id)}\n              disabled={isPlaying || selectedClipData.track.locked}\n            >\n              Duplicate Clip\n            </button>';
const duplicateBtnReplacement = `onClick={() => duplicateClip(selectedClipData.track.id, selectedClipData.clip.id)}\n              disabled={isPlaying || selectedClipData.track.locked}\n            >\n              Duplicate Clip\n            </button>\n            </div>`;

code = code.replace(gainStr, gainReplacement);
code = code.replace(buttonsStr, buttonsReplacement);
code = code.replace(duplicateBtnStr, duplicateBtnReplacement);

// Let's also verify that duplicateBtnReplacement didn't mess up tags
fs.writeFileSync('src/App.tsx', code);
console.log("Layout 3 patched");
