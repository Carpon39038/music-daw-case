const fs = require('fs');
const appPath = './src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

if (!code.includes('flangerEnabled')) {
  // 1. Add types
  code = code.replace(/delayFeedback\?: number\n/, "delayFeedback?: number\n  flangerEnabled?: boolean\n  flangerSpeed?: number\n  flangerDepth?: number\n  flangerFeedback?: number\n");
  
  // 2. Add default state mapping in project load
  code = code.replace(/delayFeedback: track\.delayFeedback \?\? 0\.4,\n/, "delayFeedback: track.delayFeedback ?? 0.4,\n        flangerEnabled: track.flangerEnabled ?? false,\n        flangerSpeed: track.flangerSpeed ?? 0.5,\n        flangerDepth: track.flangerDepth ?? 0.002,\n        flangerFeedback: track.flangerFeedback ?? 0.5,\n");

  // 3. Add default properties in new track
  code = code.replace(/delayFeedback: 0\.4,\n/, "delayFeedback: 0.4,\n            flangerEnabled: false,\n            flangerSpeed: 0.5,\n            flangerDepth: 0.002,\n            flangerFeedback: 0.5,\n");

  // 4. Add audio routing in playTrack
  const audioLogic = `
        if (track.flangerEnabled) {
          const flangerDelay = ctx.createDelay(0.02)
          flangerDelay.delayTime.value = 0.005
          
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = track.flangerSpeed ?? 0.5
          
          const depth = ctx.createGain()
          depth.gain.value = track.flangerDepth ?? 0.002
          
          osc.connect(depth)
          depth.connect(flangerDelay.delayTime)
          osc.start(startTime)
          activeOscillators.push(osc)
          
          const fbGain = ctx.createGain()
          fbGain.gain.value = track.flangerFeedback ?? 0.5
          
          trackOutput.connect(flangerDelay)
          flangerDelay.connect(fbGain)
          fbGain.connect(flangerDelay)
          
          const wetGain = ctx.createGain()
          wetGain.gain.value = 0.5
          const dryGain = ctx.createGain()
          dryGain.gain.value = 0.5
          
          trackOutput.connect(dryGain)
          flangerDelay.connect(wetGain)
          
          const mix = ctx.createGain()
          dryGain.connect(mix)
          wetGain.connect(mix)
          
          trackOutput = mix
        }
`;
  code = code.replace(/(if \(track\.delayEnabled\) \{)/, audioLogic + "\n        $1");

  // 5. Add UI in inspector
  const uiLogic = `
                <div className="track-flanger-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      data-testid={\`flanger-enable-\${track.id}\`}
                      checked={!!track.flangerEnabled}
                      onChange={(e) => setProject(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t =>
                            t.id === track.id ? { ...t, flangerEnabled: e.target.checked } : t
                        )
                      }))}
                    />
                    Flanger
                  </label>
                  {track.flangerEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Spd:
                        <input
                          type="range"
                          min="0.1" max="5.0" step="0.1"
                          data-testid={\`flanger-speed-\${track.id}\`}
                          value={track.flangerSpeed ?? 0.5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProject(prev => ({
                              ...prev,
                              tracks: prev.tracks.map(t =>
                                t.id === track.id ? { ...t, flangerSpeed: val } : t
                              )
                            }))
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Dep:
                        <input
                          type="range"
                          min="0.001" max="0.01" step="0.001"
                          data-testid={\`flanger-depth-\${track.id}\`}
                          value={track.flangerDepth ?? 0.002}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProject(prev => ({
                              ...prev,
                              tracks: prev.tracks.map(t =>
                                t.id === track.id ? { ...t, flangerDepth: val } : t
                              )
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
`;
  code = code.replace(/(<div className="track-delay-controls")/, uiLogic + "\n                $1");

  fs.writeFileSync(appPath, code);
  console.log('Patched Flanger effect to App.tsx');
} else {
  console.log('Flanger already exists.');
}
