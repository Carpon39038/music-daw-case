import type { WaveType } from '../types'
import type { DAWActions } from '../hooks/useDAWActions'

export function Inspector(d: DAWActions) {
  const {
    selectedTrackId, selectedClipData, isPlaying, project,
    renameTrack, setTrackColor, setTrackPan, setTrackTranspose,
    setProject, applyProjectUpdate, setTrackFilterType, setTrackFilterCutoff,
    duplicateTrack, moveTrack, deleteTrack,
    setClipName, setClipColor, setSelectedClipWave, updateClipGain,
    updateClipTranspose, setSelectedClipNote, updateClipLengthBeats,
    updateClipFades, toggleClipMute, deleteClip, copyClip, pasteClip,
    duplicateClip, splitClip, clipboard,
  } = d

  return (
    <section className="inspector" data-testid="inspector-panel">
      <div className="inspector-title">Inspector</div>
      {selectedTrackId ? (
        <details className="inspector-group sm" data-testid="inspector-track" open>
          <summary className="inspector-subtitle">Track Settings</summary>
          <div className="inspector-row">
            <label htmlFor="selected-track-name-input">Name</label>
            <input
              id="selected-track-name-input"
              data-testid="selected-track-name-input"
              type="text"
              value={project.tracks.find((t) => t.id === selectedTrackId)?.name ?? ''}
              onChange={(e) => renameTrack(selectedTrackId, e.target.value)}
              disabled={isPlaying}
            />
          </div>

          <div className="inspector-row">
            <label htmlFor="selected-track-color-input">Color</label>
            <input
              id="selected-track-color-input"
              data-testid="selected-track-color-input"
              type="color"
              value={project.tracks.find((t) => t.id === selectedTrackId)?.color || '#4a5568'}
              onChange={(e) => setTrackColor(selectedTrackId, e.target.value)}
              disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked}
            />
          </div>

          
          <details className="inspector-group sm" data-testid="inspector-track-effects">
            <summary className="inspector-subtitle">Track Effects & Params</summary>
            {(() => {
              const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
              if (!selectedTrack) return null;
              return (
                <div>
                    
                <details className="inspector-subgroup sm"><summary>Basic FX</summary><div>
                  <label>
                Pan
                <input
                  data-testid={`pan-${selectedTrack.id}`}
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={selectedTrack.pan}
                  onChange={(e) => setTrackPan(selectedTrack.id, Number(e.target.value))}
                  disabled={isPlaying}
                />
                <span className="pan-value">{selectedTrack.pan.toFixed(2)}</span>
              </label>
                  <label>
                Pitch
                <input
                  data-testid={`transpose-${selectedTrack.id}`}
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={selectedTrack.transposeSemitones}
                  onChange={(e) => setTrackTranspose(selectedTrack.id, Number(e.target.value))}
                  disabled={isPlaying}
                />
                <span className="transpose-value">{selectedTrack.transposeSemitones >= 0 ? '+' : ''}{selectedTrack.transposeSemitones} st</span>
              </label>
                </div>
              </details>
<details className="inspector-subgroup sm"><summary>Modulation & Time</summary><div>
                <div className="track-chorus-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`chorus-enabled-${selectedTrack.id}`}
                      checked={!!selectedTrack.chorusEnabled}
                      onChange={(e) => {
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === selectedTrack.id ? { ...t, chorusEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Chorus
                  </label>
                  
                  {selectedTrack.chorusEnabled && (
                    <>
                      <label className="fx-label-indented">
                        Rate
                        <input
                          type="range"
                          data-testid={`chorus-rate-${selectedTrack.id}`}
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={selectedTrack.chorusRate ?? 1.5}
                         
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === selectedTrack.id ? { ...t, chorusRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label className="fx-label">
                        Depth
                        <input
                          type="range"
                          data-testid={`chorus-depth-${selectedTrack.id}`}
                          min="0.1"
                          max="5"
                          step="0.1"
                          value={selectedTrack.chorusDepth ?? 0.5}
                         
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === selectedTrack.id ? { ...t, chorusDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="track-tremolo-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`tremolo-enabled-${selectedTrack.id}`}
                      checked={!!selectedTrack.tremoloEnabled}
                      onChange={(e) => {
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === selectedTrack.id ? { ...t, tremoloEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Tremolo
                  </label>
                  
                  {selectedTrack.tremoloEnabled && (
                    <>
                      <label className="fx-label-indented">
                        Rate
                        <input
                          type="range"
                          data-testid={`tremolo-rate-${selectedTrack.id}`}
                          min="0.1"
                          max="20"
                          step="0.1"
                          value={selectedTrack.tremoloRate ?? 5.0}
                         
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === selectedTrack.id ? { ...t, tremoloRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label className="fx-label-sub">
                        Depth
                        <input
                          type="range"
                          data-testid={`tremolo-depth-${selectedTrack.id}`}
                          min="0"
                          max="1"
                          step="0.05"
                          value={selectedTrack.tremoloDepth ?? 0.5}
                         
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === selectedTrack.id ? { ...t, tremoloDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                </div></details>
<details className="inspector-subgroup sm"><summary>Dynamics & EQ</summary>
<div className="track-effects-details">
                <div className="track-compressor-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`compressor-enabled-${selectedTrack.id}`}
                      checked={!!selectedTrack.compressorEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === selectedTrack.id ? { ...t, compressorEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                     
                    />
                    Comp
                  </label>
                  {selectedTrack.compressorEnabled && (
                    <>
                      <input
                        type="range"
                        min="-100"
                        max="0"
                        step="1"
                        data-testid={`compressor-threshold-${selectedTrack.id}`}
                        value={selectedTrack.compressorThreshold ?? -24}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === selectedTrack.id ? { ...t, compressorThreshold: val } : t
                            ),
                          }))
                        }}
                       
                      />
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.1"
                        data-testid={`compressor-ratio-${selectedTrack.id}`}
                        value={selectedTrack.compressorRatio ?? 12}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === selectedTrack.id ? { ...t, compressorRatio: val } : t
                            ),
                          }))
                        }}
                       
                      />
                    </>
                  )}
                </div>
                
                
                <div className="track-eq-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`eq-enable-${selectedTrack.id}`}
                      checked={!!selectedTrack.eqEnabled}
                      onChange={(e) => setProject(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t =>
                            t.id === selectedTrack.id ? { ...t, eqEnabled: e.target.checked } : t
                        )
                      }))}
                    />
                    EQ3
                  </label>
                  {selectedTrack.eqEnabled && (
                    <>
                      <label className="fx-label">
                        Low:
                        <input
                          type="range"
                          data-testid={`eq-low-${selectedTrack.id}`}
                          min="-24" max="24" step="1"
                          value={selectedTrack.eqLow ?? 0}
                          onChange={(e) => setProject(prev => ({
                            ...prev,
                            tracks: prev.tracks.map(t =>
                                t.id === selectedTrack.id ? { ...t, eqLow: parseFloat(e.target.value) } : t
                            )
                          }))}
                         
                        />
                      </label>
                      <label className="fx-label">
                        Mid:
                        <input
                          type="range"
                          data-testid={`eq-mid-${selectedTrack.id}`}
                          min="-24" max="24" step="1"
                          value={selectedTrack.eqMid ?? 0}
                          onChange={(e) => setProject(prev => ({
                            ...prev,
                            tracks: prev.tracks.map(t =>
                                t.id === selectedTrack.id ? { ...t, eqMid: parseFloat(e.target.value) } : t
                            )
                          }))}
                         
                        />
                      </label>
                      <label className="fx-label">
                        High:
                        <input
                          type="range"
                          data-testid={`eq-high-${selectedTrack.id}`}
                          min="-24" max="24" step="1"
                          value={selectedTrack.eqHigh ?? 0}
                          onChange={(e) => setProject(prev => ({
                            ...prev,
                            tracks: prev.tracks.map(t =>
                                t.id === selectedTrack.id ? { ...t, eqHigh: parseFloat(e.target.value) } : t
                            )
                          }))}
                         
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="track-flanger-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`flanger-enable-${selectedTrack.id}`}
                      checked={!!selectedTrack.flangerEnabled}
                      onChange={(e) => setProject(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t =>
                            t.id === selectedTrack.id ? { ...t, flangerEnabled: e.target.checked } : t
                        )
                      }))}
                    />
                    Flanger
                  </label>
                  {selectedTrack.flangerEnabled && (
                    <>
                      <label className="fx-label">
                        Spd:
                        <input
                          type="range"
                          min="0.1" max="5.0" step="0.1"
                          data-testid={`flanger-speed-${selectedTrack.id}`}
                          value={selectedTrack.flangerSpeed ?? 0.5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProject(prev => ({
                              ...prev,
                              tracks: prev.tracks.map(t =>
                                t.id === selectedTrack.id ? { ...t, flangerSpeed: val } : t
                              )
                            }))
                          }}
                        />
                      </label>
                      <label className="fx-label">
                        Dep:
                        <input
                          type="range"
                          min="0.001" max="0.01" step="0.001"
                          data-testid={`flanger-depth-${selectedTrack.id}`}
                          value={selectedTrack.flangerDepth ?? 0.002}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProject(prev => ({
                              ...prev,
                              tracks: prev.tracks.map(t =>
                                t.id === selectedTrack.id ? { ...t, flangerDepth: val } : t
                              )
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="track-delay-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`delay-enable-${selectedTrack.id}`}
                      checked={!!selectedTrack.delayEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === selectedTrack.id ? { ...t, delayEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                     
                    />
                    Delay
                  </label>
                  {selectedTrack.delayEnabled && (
                    <>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        data-testid={`delay-time-${selectedTrack.id}`}
                        value={selectedTrack.delayTime ?? 0.3}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === selectedTrack.id ? { ...t, delayTime: val } : t
                            ),
                          }))
                        }}
                       
                      />
                      <input
                        type="range"
                        min="0"
                        max="0.9"
                        step="0.1"
                        data-testid={`delay-fb-${selectedTrack.id}`}
                        value={selectedTrack.delayFeedback ?? 0.4}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === selectedTrack.id ? { ...t, delayFeedback: val } : t
                            ),
                          }))
                        }}
                       
                      />
                    </>
                  )}
                </div>
                
                <div className="track-tremolo-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`tremolo-enabled-${selectedTrack.id}`}
                      checked={!!selectedTrack.tremoloEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === selectedTrack.id ? { ...t, tremoloEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Tremolo
                  </label>
                  
                  {selectedTrack.tremoloEnabled && (
                    <>
                      <label className="fx-label-indented">
                        Rate
                        <input
                          type="range"
                          data-testid={`tremolo-rate-${selectedTrack.id}`}
                          min="0.1"
                          max="20"
                          step="0.1"
                          value={selectedTrack.tremoloRate ?? 5.0}
                          disabled={isPlaying}
                         
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === selectedTrack.id ? { ...t, tremoloRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label className="fx-label-sub">
                        Depth
                        <input
                          type="range"
                          data-testid={`tremolo-depth-${selectedTrack.id}`}
                          min="0"
                          max="1"
                          step="0.05"
                          value={selectedTrack.tremoloDepth ?? 0.5}
                          disabled={isPlaying}
                         
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === selectedTrack.id ? { ...t, tremoloDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

<div className="track-reverb-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`reverb-enable-${selectedTrack.id}`}
                      checked={!!selectedTrack.reverbEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === selectedTrack.id ? { ...t, reverbEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                     
                    />
                    Reverb
                  </label>
                  {selectedTrack.reverbEnabled && (
                    <>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        data-testid={`reverb-mix-${selectedTrack.id}`}
                        value={selectedTrack.reverbMix ?? 0.3}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === selectedTrack.id ? { ...t, reverbMix: val } : t
                            ),
                          }))
                        }}
                       
                      />
                      <input
                        type="range"
                        min="0.1"
                        max="5"
                        step="0.1"
                        data-testid={`reverb-decay-${selectedTrack.id}`}
                        value={selectedTrack.reverbDecay ?? 2}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === selectedTrack.id ? { ...t, reverbDecay: val } : t
                            ),
                          }))
                        }}
                       
                      />
                    </>
                  )}
                </div>
                <div className="track-distortion-controls">
                  <label className="fx-label">
                    <input
                      type="checkbox"
                      data-testid={`track-distortion-toggle-${selectedTrack.id}`}
                      checked={!!selectedTrack.distortionEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === selectedTrack.id ? { ...t, distortionEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                     
                    />
                    Distortion
                  </label>
                </div>

                <select
                  data-testid={`filter-type-${selectedTrack.id}`}
                  value={selectedTrack.filterType}
                  onChange={(e) => setTrackFilterType(selectedTrack.id, e.target.value as 'none' | 'lowpass' | 'highpass')}
                  disabled={isPlaying}
                >
                  <option value="none">None</option>
                  <option value="lowpass">LPF</option>
                  <option value="highpass">HPF</option>
                </select>
                {selectedTrack.filterType !== 'none' && (
                  <input
                    data-testid={`filter-cutoff-${selectedTrack.id}`}
                    type="range"
                    min={20}
                    max={20000}
                    step={1}
                    value={selectedTrack.filterCutoff}
                    onChange={(e) => setTrackFilterCutoff(selectedTrack.id, Number(e.target.value))}
                    disabled={isPlaying}
                  />
                )}
                            </div>
              </details>
              </div>
              
                );
              })()}
            </details>
            <div className="inspector-row">
              <button
                data-testid="duplicate-track-btn"
                onClick={() => duplicateTrack(selectedTrackId)}
                disabled={isPlaying}
              >
                Duplicate Track
              </button>
              <button
                data-testid="move-up-btn"
                onClick={() => moveTrack(selectedTrackId, 'up')}
                disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === 0}
              >
                Move Up
              </button>
              <button
                data-testid="move-down-btn"
                onClick={() => moveTrack(selectedTrackId, 'down')}
                disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === project.tracks.length - 1}
              >
                Move Down
              </button>
              <button
                data-testid="delete-track-btn"
                onClick={() => deleteTrack(selectedTrackId)}
                disabled={isPlaying || project.tracks.length <= 1}
                className="danger-btn"
              >
                Delete Track
              </button>
            </div>
          </details>
        ) : (
          <div className="inspector-empty" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}

        {selectedClipData ? (
          <details className="inspector-group sm" data-testid="inspector-clip" open>
            <summary className="inspector-subtitle">Clip Settings</summary>
            
            <div>
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

            <details className="inspector-subgroup sm"><summary>Tuning & Gain</summary>
              <div>
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

            <details className="inspector-subgroup sm"><summary>Timing & Fades</summary>
              <div>
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

            <div className="clip-actions-group">
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
<div className="inspector-empty" data-testid="inspector-clip-empty">Select a clip to edit note pitch.</div>
        )}
      </section>
  )
}
