const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const startIdx = app.indexOf('<details className="inspector-group" data-testid="inspector-clip" open>');
const endIdx = app.indexOf('<div className="inspector-empty" data-testid="inspector-clip-empty">');
let block = app.substring(startIdx, endIdx);

// We will construct a completely clean block for the clip.
const newBlock = `<details className="inspector-group" data-testid="inspector-clip" open>
            <summary className="inspector-subtitle" style={{cursor: "pointer"}}>Clip Settings</summary>
            
            {/* Top Level: Name, Color, Wave */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
              <div className="inspector-row">
                <label htmlFor="selected-clip-name">Name</label>
                <input
                  id="selected-clip-name"
                  data-testid="selected-clip-name-input"
                  type="text"
                  placeholder="Custom Clip Name"
                  value={selectedClipData.clip.name ?? ''}
                  onChange={(e) => setClipName(selectedClipData.track.id, selectedClipData.clip.id, e.target.value)}
                  disabled={isPlaying || selectedClipData.track.locked}
                />
              </div>
              <div className="inspector-row">
                <label htmlFor="selected-clip-color">Color</label>
                <input
                  id="selected-clip-color"
                  data-testid="selected-clip-color-picker"
                  type="color"
                  value={selectedClipData.clip.color || '#4299e1'}
                  onChange={(e) => setClipColor(selectedClipData.track.id, selectedClipData.clip.id, e.target.value)}
                />
              </div>
              <div className="inspector-row">
                <label htmlFor="selected-clip-wave">Waveform</label>
                <select
                  id="selected-clip-wave"
                  data-testid="selected-clip-wave-select"
                  value={selectedClipData.clip.wave}
                  onChange={(e) => setSelectedClipWave(selectedClipData.track.id, selectedClipData.clip.id, e.target.value as WaveType)}
                  disabled={isPlaying || selectedClipData.track.locked}
                >
                  <option value="sine">Sine</option>
                  <option value="square">Square</option>
                  <option value="sawtooth">Sawtooth</option>
                  <option value="triangle">Triangle</option>
                </select>
              </div>
            </div>

            <details className="inspector-subgroup" style={{ marginBottom: '8px' }}>
              <summary style={{ cursor: 'pointer', color: '#9cb4d8', fontSize: '11px' }}>Tuning & Gain</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
                <div className="inspector-row">
                  <label htmlFor="selected-clip-gain">Gain</label>
                  <input
                    id="selected-clip-gain"
                    data-testid="selected-clip-gain-input"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={selectedClipData.clip.gain ?? 1.0}
                    onChange={(e) => updateClipGain(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))}
                    disabled={isPlaying || selectedClipData.track.locked}
                  />
                </div>
                <div className="inspector-row">
                  <label htmlFor="selected-clip-transpose">Transpose (st)</label>
                  <input
                    id="selected-clip-transpose"
                    data-testid="selected-clip-transpose-input"
                    type="number"
                    min={-24}
                    max={24}
                    step={1}
                    value={selectedClipData.clip.transposeSemitones ?? 0}
                    onChange={(e) => updateClipTranspose(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))}
                    disabled={isPlaying || selectedClipData.track.locked}
                  />
                </div>
                <div className="inspector-row">
                  <label htmlFor="selected-clip-note">Note (Hz)</label>
                  <input
                    id="selected-clip-note"
                    data-testid="selected-clip-note-input"
                    type="number"
                    min={55}
                    max={1760}
                    step={1}
                    value={Math.round(selectedClipData.clip.noteHz)}
                    onChange={(e) =>
                      setSelectedClipNote(
                        selectedClipData.track.id,
                        selectedClipData.clip.id,
                        Number(e.target.value) || selectedClipData.clip.noteHz,
                      )
                    }
                    disabled={isPlaying || selectedClipData.track.locked}
                  />
                </div>
                <div className="inspector-meta" data-testid="selected-clip-scheduled-frequency">
                  Scheduled: {selectedClipData.scheduledFrequencyHz.toFixed(2)} Hz
                </div>
              </div>
            </details>

            <details className="inspector-subgroup" style={{ marginBottom: '8px' }}>
              <summary style={{ cursor: 'pointer', color: '#9cb4d8', fontSize: '11px' }}>Timing & Fades</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
                <div className="inspector-row">
                  <label htmlFor="selected-clip-length">Length (beats)</label>
                  <input
                    id="selected-clip-length"
                    data-testid="selected-clip-length-input"
                    type="number"
                    min={1}
                    max={32}
                    step={1}
                    value={selectedClipData.clip.lengthBeats}
                    onChange={(e) => updateClipLengthBeats(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))}
                    disabled={isPlaying || selectedClipData.track.locked}
                  />
                </div>
                <div className="inspector-row">
                  <label htmlFor="selected-clip-fade-in">Fade In</label>
                  <input
                    id="selected-clip-fade-in"
                    data-testid="selected-clip-fade-in-input"
                    type="number"
                    min={0}
                    max={selectedClipData.clip.lengthBeats / 2}
                    step={0.1}
                    value={selectedClipData.clip.fadeIn ?? 0}
                    onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value), selectedClipData.clip.fadeOut ?? 0)}
                    disabled={isPlaying || selectedClipData.track.locked}
                  />
                </div>
                <div className="inspector-row">
                  <label htmlFor="selected-clip-fade-out">Fade Out</label>
                  <input
                    id="selected-clip-fade-out"
                    data-testid="selected-clip-fade-out-input"
                    type="number"
                    min={0}
                    max={selectedClipData.clip.lengthBeats / 2}
                    step={0.1}
                    value={selectedClipData.clip.fadeOut ?? 0}
                    onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, selectedClipData.clip.fadeIn ?? 0, Number(e.target.value))}
                    disabled={isPlaying || selectedClipData.track.locked}
                  />
                </div>
                <div className="inspector-meta" data-testid="selected-clip-duplicate-target-beat">
                  Duplicate target beat: {selectedClipData.duplicateStartBeat}
                </div>
              </div>
            </details>

            <div className="clip-actions-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', borderTop: '1px solid #2d3748', paddingTop: '12px' }}>
              <button
                data-testid="selected-clip-mute-btn"
                onClick={() => toggleClipMute(selectedClipData.track.id, selectedClipData.clip.id)}
                disabled={isPlaying || selectedClipData.track.locked}
                aria-pressed={selectedClipData.clip.muted}
              >
                {selectedClipData.clip.muted ? 'Unmute Clip' : 'Mute Clip'}
              </button>
              <button
                data-testid="selected-clip-delete-btn"
                onClick={() => deleteClip(selectedClipData.track.id, selectedClipData.clip.id)}
                disabled={isPlaying || selectedClipData.track.locked}
                className="danger-btn"
              >
                Delete Clip
              </button>
              <button
                data-testid="selected-clip-copy-btn"
                onClick={() => {
                  if (selectedClipData) copyClip(selectedClipData.track.id, selectedClipData.clip.id)
                }}
                disabled={!selectedClipData}
              >
                Copy Clip
              </button>
              <button
                data-testid="paste-clip-btn"
                onClick={() => {
                  if (selectedTrackId) pasteClip(selectedTrackId)
                }}
                disabled={!selectedTrackId || !clipboard || isPlaying}
              >
                Paste Clip
              </button>
              <button
                data-testid="selected-clip-duplicate-btn"
                onClick={() => duplicateClip(selectedClipData.track.id, selectedClipData.clip.id)}
                disabled={!selectedClipData.canDuplicate}
              >
                Duplicate Clip
              </button>
              <button
                data-testid="selected-clip-split-btn"
                onClick={() => splitClip(selectedClipData.track.id, selectedClipData.clip.id)}
                disabled={!selectedClipData.canSplit}
              >
                Split Clip
              </button>
            </div>
          </details>
        ) : (
`;

fs.writeFileSync('src/App.tsx', app.replace(block, newBlock));
console.log("Rewrite clip inspector successful");
