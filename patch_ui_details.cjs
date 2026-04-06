const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The start of the advanced effects in track-header is around:
//               <label>
//                 Filter
//                 <div className="track-chorus-controls"

// The end of advanced effects is right before:
//               <button
//                 data-testid={`mute-${track.id}`}

let startPattern = `              <label>
                Filter`;

let endPattern = `              </label>
              <button
                data-testid={\`mute-\${track.id}\`}`;

let replacementStart = `              <details className="track-effects-details" style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#a0aec0' }}>Effects & Filters</summary>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginTop: '4px' }}>
              <label>
                Filter`;

let replacementEnd = `              </label>
              </div>
              </details>
              <button
                data-testid={\`mute-\${track.id}\`}`;

content = content.replace(startPattern, replacementStart);
content = content.replace(endPattern, replacementEnd);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx');
