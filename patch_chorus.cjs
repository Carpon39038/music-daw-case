const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

if (!code.includes('chorusEnabled?: boolean')) {
  // Add to Track interface
  code = code.replace(
    /compressorRatio\?\: number/,
    `compressorRatio?: number
  chorusEnabled?: boolean
  chorusDepth?: number
  chorusRate?: number`
  );

  // Add to validation
  code = code.replace(
    /\(t\.compressorRatio \!\=\= undefined \&\& typeof t\.compressorRatio \!\=\= \'number\'\) \|\|/,
    `(t.compressorRatio !== undefined && typeof t.compressorRatio !== 'number') ||
      (t.chorusEnabled !== undefined && typeof t.chorusEnabled !== 'boolean') ||
      (t.chorusDepth !== undefined && typeof t.chorusDepth !== 'number') ||
      (t.chorusRate !== undefined && typeof t.chorusRate !== 'number') ||`
  );

  // Add to loadInitialProject
  code = code.replace(
    /compressorRatio\: track\.compressorRatio \?\? 12\,/,
    `compressorRatio: track.compressorRatio ?? 12,
        chorusEnabled: track.chorusEnabled ?? false,
        chorusDepth: track.chorusDepth ?? 0.5,
        chorusRate: track.chorusRate ?? 1.5,`
  );

  // Add audio routing
  code = code.replace(
    /if \(track\.compressorEnabled\) \{/,
    `if (track.chorusEnabled) {
          const chorus = ctx.createDelay();
          chorus.delayTime.value = 0.03;
          
          const depth = ctx.createGain();
          depth.gain.value = track.chorusDepth ?? 0.5;
          
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = track.chorusRate ?? 1.5;
          
          lfo.connect(depth);
          depth.connect(chorus.delayTime);
          lfo.start(startTime);
          activeOscillators.push(lfo);
          
          const dryGain = ctx.createGain();
          dryGain.gain.value = 1;
          const wetGain = ctx.createGain();
          wetGain.gain.value = 0.5;
          
          trackOutput.connect(dryGain);
          trackOutput.connect(chorus);
          chorus.connect(wetGain);
          
          const mix = ctx.createGain();
          dryGain.connect(mix);
          wetGain.connect(mix);
          
          trackOutput = mix;
        }

        if (track.compressorEnabled) {`
  );

  // Add UI controls
  code = code.replace(
    /\{\/\* Compressor \*\/\}/,
    `{/* Chorus */}
                <div className="track-chorus-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
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

                {/* Compressor */}`
  );

  fs.writeFileSync('src/App.tsx', code);
  console.log("Chorus added");
}
