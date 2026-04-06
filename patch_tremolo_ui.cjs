const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const uiLogic = `
                <div className="track-tremolo-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                    <input
                      type="checkbox"
                      data-testid={\`tremolo-enabled-\${track.id}\`}
                      checked={!!track.tremoloEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, tremoloEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Tremolo
                  </label>
                  
                  {track.tremoloEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                        Rate
                        <input
                          type="range"
                          data-testid={\`tremolo-rate-\${track.id}\`}
                          min="0.1"
                          max="20"
                          step="0.1"
                          value={track.tremoloRate ?? 5.0}
                          disabled={isPlaying}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, tremoloRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
                        Depth
                        <input
                          type="range"
                          data-testid={\`tremolo-depth-\${track.id}\`}
                          min="0"
                          max="1"
                          step="0.05"
                          value={track.tremoloDepth ?? 0.5}
                          disabled={isPlaying}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, tremoloDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
`;

code = code.replace(
  /<div className="track-reverb-controls"/,
  uiLogic + '\n<div className="track-reverb-controls"'
);

fs.writeFileSync('src/App.tsx', code);
