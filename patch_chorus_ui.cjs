const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /<div className="track-compressor-controls"/,
  `<div className="track-chorus-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                    <input
                      type="checkbox"
                      data-testid={\`chorus-enabled-\${track.id}\`}
                      checked={!!track.chorusEnabled}
                      onChange={(e) => {
                        updateProject((p) => ({
                          ...p,
                          tracks: p.tracks.map((t) =>
                            t.id === track.id ? { ...t, chorusEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Chorus
                  </label>
                  
                  {track.chorusEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                        Rate
                        <input
                          type="range"
                          data-testid={\`chorus-rate-\${track.id}\`}
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={track.chorusRate ?? 1.5}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            updateProject((p) => ({
                              ...p,
                              tracks: p.tracks.map((t) =>
                                t.id === track.id ? { ...t, chorusRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                        Depth
                        <input
                          type="range"
                          data-testid={\`chorus-depth-\${track.id}\`}
                          min="0.1"
                          max="5"
                          step="0.1"
                          value={track.chorusDepth ?? 0.5}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            updateProject((p) => ({
                              ...p,
                              tracks: p.tracks.map((t) =>
                                t.id === track.id ? { ...t, chorusDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="track-compressor-controls"`
);

fs.writeFileSync('src/App.tsx', code);
console.log("UI added");
