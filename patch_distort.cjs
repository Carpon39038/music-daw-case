const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/App.tsx');
let code = fs.readFileSync(p, 'utf-8');

if (!code.includes('distortionEnabled?: boolean')) {
  code = code.replace(
    'delayFeedback?: number',
    'delayFeedback?: number\n  distortionEnabled?: boolean'
  );
}

if (!code.includes('distortionEnabled: false')) {
  code = code.replace(
    /reverbEnabled: false,/g,
    'reverbEnabled: false,\n      distortionEnabled: false,'
  );
  
  code = code.replace(
    /reverbEnabled: track\.reverbEnabled \?\? false,/g,
    'reverbEnabled: track.reverbEnabled ?? false,\n        distortionEnabled: track.distortionEnabled ?? false,'
  );
}

if (!code.includes('distortionEnabledTrackCount')) {
  code = code.replace(
    /reverbEnabledTrackCount: number/g,
    'reverbEnabledTrackCount: number\n      distortionEnabledTrackCount: number'
  );
  code = code.replace(
    /const reverbEnabledTrackCount = /g,
    'const distortionEnabledTrackCount = useMemo(() => project.tracks.filter((t) => t.distortionEnabled).length, [project.tracks])\n  const reverbEnabledTrackCount = '
  );
  code = code.replace(
    /reverbEnabledTrackCount,/g,
    'reverbEnabledTrackCount,\n      distortionEnabledTrackCount,'
  );
}

if (!code.includes('track.distortionEnabled') && code.includes('track.reverbEnabled')) {
  code = code.replace(
    '<label className="checkbox-label" title="Reverb">',
    `<label className="checkbox-label" title="Distortion">
                    <input
                      type="checkbox"
                      data-testid={\`track-distortion-toggle-\${track.id}\`}
                      checked={!!track.distortionEnabled}
                      onChange={(e) =>
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, distortionEnabled: e.target.checked } : t
                          ),
                        }))
                      }
                    />
                    Dist
                  </label>
                  <label className="checkbox-label" title="Reverb">`
  );
}

if (!code.includes('createWaveShaper') && code.includes('createConvolver')) {
  code = code.replace(
    /if \(track\.reverbEnabled\) {/g,
    `if (track.distortionEnabled) {
          const distortion = ctx.createWaveShaper()
          function makeDistortionCurve(amount = 50) {
            const k = typeof amount === 'number' ? amount : 50
            const n_samples = 44100
            const curve = new Float32Array(n_samples)
            const deg = Math.PI / 180
            for (let i = 0; i < n_samples; ++i) {
              const x = (i * 2) / n_samples - 1
              curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
            }
            return curve
          }
          distortion.curve = makeDistortionCurve(400)
          distortion.oversample = '4x'
          lastNode.connect(distortion)
          lastNode = distortion
        }
        if (track.reverbEnabled) {`
  );
}

fs.writeFileSync(p, code);
console.log('Patched distortion');
