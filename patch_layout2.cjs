const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace Gain row to start details
code = code.replace(
  '<div className="inspector-row">\n              <label htmlFor="selected-clip-gain">Gain</label>',
  `<details className="inspector-group" data-testid="inspector-clip-advanced">
    <summary className="inspector-subtitle" style={{cursor: "pointer", marginBottom: "8px"}}>Advanced Clip Params</summary>
    <div className="inspector-row">
              <label htmlFor="selected-clip-gain">Gain</label>`
);

// We need to close the details block before the buttons.
// The buttons start with <button data-testid="selected-clip-mute-btn"
code = code.replace(
  '<button\n              data-testid="selected-clip-mute-btn"',
  `</details>\n            <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '12px'}}>\n            <button\n              data-testid="selected-clip-mute-btn"`
);

code = code.replace(
  'onClick={() => duplicateClip(selectedClipData.track.id, selectedClipData.clip.id)}\n              disabled={isPlaying || selectedClipData.track.locked}\n            >\n              Duplicate Clip\n            </button>',
  `onClick={() => duplicateClip(selectedClipData.track.id, selectedClipData.clip.id)}\n              disabled={isPlaying || selectedClipData.track.locked}\n            >\n              Duplicate Clip\n            </button>\n            </div>`
);

// Track header styling: group vol and buttons in track-header-controls
// I will not touch the JSX for track header too much if it's already neat, but let's check it.
code = code.replace(
  'className={`track-header ${selectedTrackId === track.id ? \'selected\' : \'\'}`}',
  'className={`track-header ${selectedTrackId === track.id ? \'selected\' : \'\'} ${track.locked ? \'locked\' : \'\'}`}'
)

fs.writeFileSync('src/App.tsx', code);
console.log("Layout patched");
