const fs = require('fs');
const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf-8');

// For track
code = code.replace(
  '<div className="inspector-group" data-testid="inspector-track">',
  '<details className="inspector-group" data-testid="inspector-track" open>'
);
code = code.replace(
  '<div className="inspector-subtitle">Track</div>',
  '<summary className="inspector-subtitle" style={{cursor: "pointer"}}>Track Settings</summary>'
);
// the end of track inspector is before inspector-empty
// Actually, they are in a ternary:
// {selectedTrackId ? ( <details>...</details> ) : ( <div className="inspector-empty">... )}
// We need to replace the `</div>` that closes the track group.
const trackEndOld = `            </div>
          </div>
        ) : (
          <div className="inspector-empty" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}`;
const trackEndNew = `            </div>
          </details>
        ) : (
          <div className="inspector-empty" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}`;
code = code.replace(trackEndOld, trackEndNew);

// For clip
code = code.replace(
  '<div className="inspector-group" data-testid="inspector-clip">',
  '<details className="inspector-group" data-testid="inspector-clip" open>'
);
code = code.replace(
  '<div className="inspector-subtitle">Clip</div>',
  '<summary className="inspector-subtitle" style={{cursor: "pointer"}}>Clip Settings</summary>'
);
const clipEndOld = `              </select>
            </div>
          </div>
        ) : (
          <div className="inspector-empty" data-testid="inspector-clip-empty">Select a clip to view details.</div>
        )}`;
const clipEndNew = `              </select>
            </div>
          </details>
        ) : (
          <div className="inspector-empty" data-testid="inspector-clip-empty">Select a clip to view details.</div>
        )}`;
code = code.replace(clipEndOld, clipEndNew);

fs.writeFileSync(file, code);

// Update CSS for details
let css = fs.readFileSync('src/App.css', 'utf-8');
const detailsCss = `
details.inspector-group summary {
  list-style: none;
  outline: none;
  user-select: none;
}
details.inspector-group summary::-webkit-details-marker {
  display: none;
}
details.inspector-group summary::before {
  content: '▶';
  display: inline-block;
  margin-right: 8px;
  font-size: 0.8em;
  transition: transform 0.2s;
}
details.inspector-group[open] summary::before {
  transform: rotate(90deg);
}
`;
if (!css.includes('details.inspector-group')) {
  fs.writeFileSync('src/App.css', css + detailsCss);
}
console.log('Inspector patched');
