const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src/App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add fields to Track interface
content = content.replace(
  /color\?: string\n  locked: boolean/g,
  "color?: string\n  locked: boolean\n  delayEnabled?: boolean\n  delayTime?: number\n  delayFeedback?: number"
);

// 2. Add default values in `addTrack`
content = content.replace(
  /filterType: 'none',?\n      color: '#4b5563',/g,
  "filterType: 'none',\n      color: '#4b5563',\n      delayEnabled: false,\n      delayTime: 0.3,\n      delayFeedback: 0.4,"
);

// 3. Audio routing
const audioWiringOld = `
        osc.connect(gain)
        gain.connect(panner)
        if (track.filterType && track.filterType !== 'none') {
          panner.connect(filter)
          filter.connect(master)
        } else {
          panner.connect(master)
        }
`;

const audioWiringNew = `
        osc.connect(gain)
        gain.connect(panner)
        
        let trackOutput: AudioNode = panner;
        
        if (track.filterType && track.filterType !== 'none') {
          panner.connect(filter)
          trackOutput = filter;
        }
        
        if (track.delayEnabled) {
          const delayNode = ctx.createDelay(5.0)
          delayNode.delayTime.value = track.delayTime ?? 0.3
          const feedbackGain = ctx.createGain()
          feedbackGain.gain.value = track.delayFeedback ?? 0.4
          
          trackOutput.connect(delayNode)
          delayNode.connect(feedbackGain)
          feedbackGain.connect(delayNode)
          delayNode.connect(master)
        }
        
        trackOutput.connect(master)
`;

content = content.replace(audioWiringOld, audioWiringNew);

// 4. Track UI changes
const trackHeaderUIOld = `
                <select
                  data-testid={\`filter-type-\${track.id}\`}
                  value={track.filterType}
`;

const trackHeaderUINew = `
                <div className="track-delay-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      data-testid={\`delay-enable-\${track.id}\`}
                      checked={!!track.delayEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, delayEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                      style={{ margin: 0, marginRight: '4px' }}
                    />
                    Delay
                  </label>
                  {track.delayEnabled && (
                    <>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        data-testid={\`delay-time-\${track.id}\`}
                        value={track.delayTime ?? 0.3}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, delayTime: val } : t
                            ),
                          }))
                        }}
                        style={{ width: '40px' }}
                      />
                      <input
                        type="range"
                        min="0"
                        max="0.9"
                        step="0.1"
                        data-testid={\`delay-fb-\${track.id}\`}
                        value={track.delayFeedback ?? 0.4}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, delayFeedback: val } : t
                            ),
                          }))
                        }}
                        style={{ width: '40px' }}
                      />
                    </>
                  )}
                </div>

                <select
                  data-testid={\`filter-type-\${track.id}\`}
                  value={track.filterType}
`;

content = content.replace(trackHeaderUIOld, trackHeaderUINew);

fs.writeFileSync(targetFile, content);
console.log('Patched Track Delay cleanly');
