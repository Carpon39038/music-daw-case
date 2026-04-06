const fs = require('fs');

const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf-8');

// The goal is to reshape the track header.
// Original:
/*
            <div
              className={`track-header ${selectedTrackId === track.id ? 'selected' : ''}`}
              ...
              <div className="track-name" style={{ color: track.color || "#e2e8f0" }}>{track.name}</div>
              <label>
                Vol
...
*/

// We'll use simple string replacements.

// 1. Find the track-header open tag until <div className="track-name"...
// 2. We wrap the main controls in <div className="track-header-main">

const mainOpen = `<div className="track-header-main" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>`;

code = code.replace(
  /<div className="track-name"/,
  `${mainOpen}\n              <div className="track-name"`
);

// We need to move Pan and Pitch into the details block.
const panRegex = /<label>\s*Pan\s*<input\s*data-testid={`pan-\${track\.id}`}[\s\S]*?<\/label>/;
const panMatch = code.match(panRegex);
if(panMatch) code = code.replace(panMatch[0], '');

const pitchRegex = /<label>\s*Pitch\s*<input\s*data-testid={`transpose-\${track\.id}`}[\s\S]*?<\/label>/;
const pitchMatch = code.match(pitchRegex);
if(pitchMatch) code = code.replace(pitchMatch[0], '');

// Now we need to find the details block
const detailsRegex = /<details className="track-effects-details" style={{ marginTop: '8px' }}>/;
// We will change the summary text and inject Pan and Pitch just inside the div
code = code.replace(detailsRegex, `<details className="track-effects-details" style={{ width: '100%', marginTop: '4px' }}>`);

code = code.replace(
  /<summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#a0aec0' }}>Effects & Filters<\/summary>/,
  `<summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#a0aec0' }}>Parameters & Effects</summary>`
);

code = code.replace(
  /<div style={{ padding: '8px', background: 'rgba\(0,0,0,0\.2\)', borderRadius: '4px', marginTop: '4px' }}>/,
  `<div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  ${panMatch ? panMatch[0] : ''}
                  ${pitchMatch ? pitchMatch[0] : ''}
                </div>`
);

// We need to close the `track-header-main` div. Where does it end?
// It should end right before the `<details>` starts.
code = code.replace(
  /<details className="track-effects-details"/,
  `  <button
                data-testid={\`mute-\${track.id}\`}
                onClick={() => toggleTrackMute(track.id)}
                disabled={isPlaying}
                aria-pressed={track.muted}
              >
                {track.muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                data-testid={\`solo-\${track.id}\`}
                onClick={() => toggleTrackSolo(track.id)}
                disabled={isPlaying}
                aria-pressed={track.solo}
              >
                {track.solo ? 'Unsolo' : 'Solo'}
              </button>
              <button
                data-testid={\`lock-\${track.id}\`}
                onClick={() => toggleTrackLock(track.id)}
                disabled={isPlaying}
                aria-pressed={track.locked}
              >
                {track.locked ? 'Unlock' : 'Lock'}
              </button>
              <button
                data-testid={\`add-clip-\${track.id}\`}
                onClick={() => addClip(track.id)}
                disabled={isPlaying || track.locked}
              >
                + Clip
              </button>
            </div>
            <details className="track-effects-details"`
);

// Then we must remove the original Mute/Solo/Lock/+Clip buttons that are AFTER the details block
const btnBlockRegex = /<\/details>\s*<button\s*data-testid={`mute-\${track\.id}`}[\s\S]*?\+ Clip\s*<\/button>/;
code = code.replace(btnBlockRegex, '</details>');

// Also need to fix the track-header CSS to column
// But we can do that in App.css

fs.writeFileSync(file, code);
console.log('Patched App.tsx layout');
