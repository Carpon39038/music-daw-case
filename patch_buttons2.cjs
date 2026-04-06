const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `            <div className="inspector-meta" data-testid="selected-clip-duplicate-target-beat">
              Duplicate target beat: {selectedClipData.duplicateStartBeat}
            </div>
            <button
              data-testid="selected-clip-mute-btn"`;

const replacement = `            <div className="inspector-meta" data-testid="selected-clip-duplicate-target-beat">
              Duplicate target beat: {selectedClipData.duplicateStartBeat}
            </div>
            <div className="clip-actions-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', borderTop: '1px solid #2d3748', paddingTop: '12px' }}>
            <button
              data-testid="selected-clip-mute-btn"`;

const splitStr = `onClick={() => splitClip(selectedClipData.track.id, selectedClipData.clip.id)}
              disabled={!selectedClipData.canSplit}
            >
              Split Clip
            </button>`;

const splitReplacement = `onClick={() => splitClip(selectedClipData.track.id, selectedClipData.clip.id)}
              disabled={!selectedClipData.canSplit}
            >
              Split Clip
            </button>
            </div>`;

code = code.replace(targetStr, replacement);
code = code.replace(splitStr, splitReplacement);

fs.writeFileSync('src/App.tsx', code);
console.log("Buttons layout patched");
