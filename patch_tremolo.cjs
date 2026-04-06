const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add types
code = code.replace(
  /chorusRate\?: number/,
  "chorusRate?: number\n  tremoloEnabled?: boolean\n  tremoloDepth?: number\n  tremoloRate?: number"
);

// 2. Add validation
code = code.replace(
  /\(t\.chorusRate \!== undefined && typeof t\.chorusRate \!== 'number'\) \|\|/,
  "(t.chorusRate !== undefined && typeof t.chorusRate !== 'number') ||\n      (t.tremoloEnabled !== undefined && typeof t.tremoloEnabled !== 'boolean') ||\n      (t.tremoloDepth !== undefined && typeof t.tremoloDepth !== 'number') ||\n      (t.tremoloRate !== undefined && typeof t.tremoloRate !== 'number') ||"
);

// 3. Add to createInitialProject
code = code.replace(
  /chorusRate: track\.chorusRate \?\? 1\.5,/,
  "chorusRate: track.chorusRate ?? 1.5,\n        tremoloEnabled: track.tremoloEnabled ?? false,\n        tremoloDepth: track.tremoloDepth ?? 0.5,\n        tremoloRate: track.tremoloRate ?? 5.0,"
);

// 4. Add to audio processing
const audioLogic = `
        if (track.tremoloEnabled) {
          const tremoloGain = ctx.createGain();
          tremoloGain.gain.value = 1 - (track.tremoloDepth ?? 0.5) / 2;
          
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = track.tremoloRate ?? 5.0;
          
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = (track.tremoloDepth ?? 0.5) / 2;
          
          lfo.connect(lfoGain);
          lfoGain.connect(tremoloGain.gain);
          
          lfo.start(clipStart);
          lfo.stop(clipEnd);
          
          trackOutput.connect(tremoloGain);
          trackOutput = tremoloGain;
        }
`;
code = code.replace(
  /if \(track\.distortionEnabled\) \{/,
  audioLogic.trim() + "\n        if (track.distortionEnabled) {"
);

// 5. Add to __DAW_DEBUG__
code = code.replace(
  /reverbEnabledTrackCount: number\n\s*distortionEnabledTrackCount: number/,
  "reverbEnabledTrackCount: number\n      distortionEnabledTrackCount: number\n      tremoloEnabledTrackCount: number"
);
code = code.replace(
  /const distortionEnabledTrackCount = useMemo\(\(\) => project\.tracks\.filter\(\(t\) => t\.distortionEnabled\)\.length, \[project\.tracks\]\)/,
  "const distortionEnabledTrackCount = useMemo(() => project.tracks.filter((t) => t.distortionEnabled).length, [project.tracks])\n  const tremoloEnabledTrackCount = useMemo(() => project.tracks.filter((t) => t.tremoloEnabled).length, [project.tracks])"
);
code = code.replace(
  /distortionEnabledTrackCount,\n\s*firstTrackReverbMix:/,
  "distortionEnabledTrackCount,\n      tremoloEnabledTrackCount,\n      firstTrackReverbMix:"
);
code = code.replace(
  /distortionEnabledTrackCount,\n\s*masterVolume,/,
  "distortionEnabledTrackCount,\n    tremoloEnabledTrackCount,\n    masterVolume,"
);

// 6. Add to UI
const uiLogic = `
                <div className="track-tremolo-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                    <input
                      type="checkbox"
                      data-testid={\`tremolo-enabled-\${track.id}\`}
                      checked={!!track.tremoloEnabled}
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
  /(<div className="track-chorus-controls"[^>]*>[\s\S]*?<\/div>)/,
  "$1\n" + uiLogic
);

fs.writeFileSync('src/App.tsx', code);
