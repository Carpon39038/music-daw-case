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
    <section className="inspector w-80 bg-[#111] border-l border-gray-800 flex flex-col overflow-y-auto flex-shrink-0" data-testid="inspector-panel">
      <div className="h-8 border-b border-gray-800 flex items-center px-4 bg-[#0a0a0a] sticky top-0 z-10">
        <span className="text-xs text-gray-500 font-medium">INSPECTOR</span>
      </div>

      <div className="p-4 space-y-4">
        {selectedTrackId ? (
          <details className="inspector-group sm" data-testid="inspector-track" open>
            <summary className="inspector-subtitle">Track Settings</summary>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input
                  data-testid="selected-track-name-input"
                  type="text"
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.name ?? ''}
                  onChange={(e) => renameTrack(selectedTrackId, e.target.value)}
                  disabled={isPlaying}
                  className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Color</label>
                <input
                  data-testid="selected-track-color-input"
                  type="color"
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.color || '#4a5568'}
                  onChange={(e) => setTrackColor(selectedTrackId, e.target.value)}
                  disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked}
                  className="w-full h-8 bg-[#1a1a1a] border border-gray-800 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 flex justify-between mb-1">
                  <span>Pan</span>
                  <span>{(() => { const p = project.tracks.find(t => t.id === selectedTrackId)?.pan ?? 0; return p === 0 ? 'C' : p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`; })()}</span>
                </label>
                <input
                  data-testid={`pan-${selectedTrackId}`}
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.pan ?? 0}
                  onChange={(e) => setTrackPan(selectedTrackId, Number(e.target.value))}
                  disabled={isPlaying}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 flex justify-between mb-1">
                  <span>Transpose (semitones)</span>
                  <span>{(() => { const t = project.tracks.find(t => t.id === selectedTrackId)?.transposeSemitones ?? 0; return t > 0 ? '+' + t : '' + t; })()}</span>
                </label>
                <input
                  data-testid={`transpose-${selectedTrackId}`}
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.transposeSemitones ?? 0}
                  onChange={(e) => setTrackTranspose(selectedTrackId, Number(e.target.value))}
                  disabled={isPlaying}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Effects Section */}
              <details className="inspector-group sm" data-testid="inspector-track-effects" open>
                <summary className="inspector-subtitle">Track Effects & Params</summary>
                <div className="track-effects-details space-y-3">
                  {(() => {
                    const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
                    if (!selectedTrack) return null;
                    return (
                      <div className="space-y-3">
                        {/* Reverb */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`reverb-enable-${selectedTrack.id}`} checked={!!selectedTrack.reverbEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, reverbEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Reverb
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.reverbEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Mix</span><span>{Math.round((selectedTrack.reverbMix ?? 0.3) * 100)}%</span></label><input type="range" min="0" max="1" step="0.05" data-testid={`reverb-mix-${selectedTrack.id}`} value={selectedTrack.reverbMix ?? 0.3} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, reverbMix: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Decay</span><span>{selectedTrack.reverbDecay ?? 2}s</span></label><input type="range" min="0.1" max="5" step="0.1" data-testid={`reverb-decay-${selectedTrack.id}`} value={selectedTrack.reverbDecay ?? 2} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, reverbDecay: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Delay */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`delay-enable-${selectedTrack.id}`} checked={!!selectedTrack.delayEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, delayEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Delay
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.delayEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Time</span><span>{(selectedTrack.delayTime ?? 0.3).toFixed(2)}s</span></label><input type="range" min="0.1" max="2" step="0.1" data-testid={`delay-time-${selectedTrack.id}`} value={selectedTrack.delayTime ?? 0.3} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, delayTime: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Feedback</span><span>{Math.round((selectedTrack.delayFeedback ?? 0.4) * 100)}%</span></label><input type="range" min="0" max="0.9" step="0.1" data-testid={`delay-fb-${selectedTrack.id}`} value={selectedTrack.delayFeedback ?? 0.4} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, delayFeedback: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Filter */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium text-gray-300 block mb-2 p-3 cursor-pointer">Filter</summary>
                          <div className="p-3 pt-0">
                          <select data-testid={`filter-type-${selectedTrack.id}`} value={selectedTrack.filterType} onChange={(e) => setTrackFilterType(selectedTrack.id, e.target.value as 'none' | 'lowpass' | 'highpass')} disabled={isPlaying} className="w-full bg-[#111] border border-gray-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 mb-2 text-gray-300">
                            <option value="none">None</option><option value="lowpass">Lowpass</option><option value="highpass">Highpass</option>
                          </select>
                          {selectedTrack.filterType !== 'none' && (
                            <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Cutoff</span><span>{selectedTrack.filterCutoff}Hz</span></label><input type="range" min="20" max="20000" step="10" data-testid={`filter-cutoff-${selectedTrack.id}`} value={selectedTrack.filterCutoff} onChange={(e) => setTrackFilterCutoff(selectedTrack.id, Number(e.target.value))} disabled={isPlaying} className="w-full h-1 accent-emerald-500" /></div>
                          )}
                          </div>
                        </details>

                        {/* Distortion */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`track-distortion-toggle-${selectedTrack.id}`} checked={!!selectedTrack.distortionEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, distortionEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Distortion
                          </summary>
                        </details>

                        {/* Compressor */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`compressor-enabled-${selectedTrack.id}`} checked={!!selectedTrack.compressorEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, compressorEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Comp
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.compressorEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Threshold</span><span>{selectedTrack.compressorThreshold ?? -24}dB</span></label><input type="range" min="-100" max="0" step="1" data-testid={`compressor-threshold-${selectedTrack.id}`} value={selectedTrack.compressorThreshold ?? -24} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, compressorThreshold: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Ratio</span><span>{selectedTrack.compressorRatio ?? 12}:1</span></label><input type="range" min="1" max="20" step="0.1" data-testid={`compressor-ratio-${selectedTrack.id}`} value={selectedTrack.compressorRatio ?? 12} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, compressorRatio: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Chorus */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`chorus-enabled-${selectedTrack.id}`} checked={!!selectedTrack.chorusEnabled} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, chorusEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Chorus
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.chorusEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Rate</span><span>{selectedTrack.chorusRate ?? 1.5}</span></label><input type="range" min="0.1" max="10" step="0.1" data-testid={`chorus-rate-${selectedTrack.id}`} value={selectedTrack.chorusRate ?? 1.5} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, chorusRate: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Depth</span><span>{selectedTrack.chorusDepth ?? 0.5}</span></label><input type="range" min="0.1" max="5" step="0.1" data-testid={`chorus-depth-${selectedTrack.id}`} value={selectedTrack.chorusDepth ?? 0.5} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, chorusDepth: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Tremolo */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`tremolo-enabled-${selectedTrack.id}`} checked={!!selectedTrack.tremoloEnabled} disabled={isPlaying} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, tremoloEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Tremolo
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.tremoloEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Rate</span><span>{selectedTrack.tremoloRate ?? 5.0}</span></label><input type="range" min="0.1" max="20" step="0.1" data-testid={`tremolo-rate-${selectedTrack.id}`} value={selectedTrack.tremoloRate ?? 5.0} disabled={isPlaying} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, tremoloRate: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Depth</span><span>{selectedTrack.tremoloDepth ?? 0.5}</span></label><input type="range" min="0" max="1" step="0.05" data-testid={`tremolo-depth-${selectedTrack.id}`} value={selectedTrack.tremoloDepth ?? 0.5} disabled={isPlaying} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, tremoloDepth: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* EQ3 */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`eq-enable-${selectedTrack.id}`} checked={!!selectedTrack.eqEnabled} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            EQ3
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.eqEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Low</span><span>{selectedTrack.eqLow ?? 0}dB</span></label><input type="range" min="-24" max="24" step="1" data-testid={`eq-low-${selectedTrack.id}`} value={selectedTrack.eqLow ?? 0} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqLow: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Mid</span><span>{selectedTrack.eqMid ?? 0}dB</span></label><input type="range" min="-24" max="24" step="1" data-testid={`eq-mid-${selectedTrack.id}`} value={selectedTrack.eqMid ?? 0} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqMid: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>High</span><span>{selectedTrack.eqHigh ?? 0}dB</span></label><input type="range" min="-24" max="24" step="1" data-testid={`eq-high-${selectedTrack.id}`} value={selectedTrack.eqHigh ?? 0} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqHigh: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Flanger */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`flanger-enable-${selectedTrack.id}`} checked={!!selectedTrack.flangerEnabled} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, flangerEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Flanger
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.flangerEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Speed</span><span>{selectedTrack.flangerSpeed ?? 0.5}</span></label><input type="range" min="0.1" max="5" step="0.1" data-testid={`flanger-speed-${selectedTrack.id}`} value={selectedTrack.flangerSpeed ?? 0.5} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, flangerSpeed: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Depth</span><span>{selectedTrack.flangerDepth ?? 0.002}</span></label><input type="range" min="0.001" max="0.01" step="0.001" data-testid={`flanger-depth-${selectedTrack.id}`} value={selectedTrack.flangerDepth ?? 0.002} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, flangerDepth: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>
                      </div>
                    )
                  })()}
                </div>
              </details>

              {/* Track management buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-800">
                <button data-testid="duplicate-track-btn" onClick={() => duplicateTrack(selectedTrackId)} disabled={isPlaying} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 transition-colors">Duplicate Track</button>
                <button data-testid="move-up-btn" onClick={() => moveTrack(selectedTrackId, 'up')} disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === 0} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 transition-colors">Move Up</button>
                <button data-testid="move-down-btn" onClick={() => moveTrack(selectedTrackId, 'down')} disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === project.tracks.length - 1} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 transition-colors">Move Down</button>
                <button data-testid="delete-track-btn" onClick={() => deleteTrack(selectedTrackId)} disabled={isPlaying || project.tracks.length <= 1} className="danger-btn px-2 py-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50 transition-colors">Delete Track</button>
              </div>
            </div>
          </details>
        ) : (
          <div className="inspector-empty text-gray-500 text-sm" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}

        {selectedClipData ? (
          <details className="inspector-group sm" data-testid="inspector-clip" open>
            <summary className="inspector-subtitle">Clip Settings</summary>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input data-testid="selected-clip-name-input" type="text" placeholder="Clip Name" value={selectedClipData.clip.name ?? ''} onChange={(e) => setClipName(selectedClipData.track.id, selectedClipData.clip.id, e.target.value)} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 block mb-1">Color</label><input data-testid="selected-clip-color-picker" type="color" value={selectedClipData.clip.color || '#4299e1'} onChange={(e) => setClipColor(selectedClipData.track.id, selectedClipData.clip.id, e.target.value)} className="w-full h-7 bg-[#1a1a1a] border border-gray-800 rounded cursor-pointer" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Waveform</label><select data-testid="selected-clip-wave-select" value={selectedClipData.clip.wave} onChange={(e) => setSelectedClipWave(selectedClipData.track.id, selectedClipData.clip.id, e.target.value as WaveType)} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"><option value="sine">Sine</option><option value="square">Square</option><option value="sawtooth">Sawtooth</option><option value="triangle">Triangle</option></select></div>
              </div>
              <div><label className="text-xs text-gray-500 flex justify-between mb-1"><span>Gain</span><span>{selectedClipData.clip.gain ?? 1.0}</span></label><input data-testid="selected-clip-gain-input" type="number" min={0} max={2} step={0.1} value={selectedClipData.clip.gain ?? 1.0} onChange={(e) => updateClipGain(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
              <div><label className="text-xs text-gray-500 flex justify-between mb-1"><span>Transpose (st)</span><span>{selectedClipData.clip.transposeSemitones ?? 0}</span></label><input data-testid="selected-clip-transpose-input" type="number" min={-24} max={24} step={1} value={selectedClipData.clip.transposeSemitones ?? 0} onChange={(e) => updateClipTranspose(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
              <div><label className="text-xs text-gray-500 flex justify-between mb-1"><span>Note (Hz)</span><span>{Math.round(selectedClipData.clip.noteHz)}</span></label><input data-testid="selected-clip-note-input" type="number" min={55} max={1760} step={1} value={Math.round(selectedClipData.clip.noteHz)} onChange={(e) => setSelectedClipNote(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value) || selectedClipData.clip.noteHz)} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
              <div className="inspector-meta text-xs text-gray-600 font-mono" data-testid="selected-clip-scheduled-frequency">Scheduled: {selectedClipData.scheduledFrequencyHz.toFixed(2)} Hz</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 block mb-1">Length (beats)</label><input data-testid="selected-clip-length-input" type="number" min={1} max={32} step={1} value={selectedClipData.clip.lengthBeats} onChange={(e) => updateClipLengthBeats(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Fade In</label><input data-testid="selected-clip-fade-in-input" type="number" min={0} max={selectedClipData.clip.lengthBeats / 2} step={0.1} value={selectedClipData.clip.fadeIn ?? 0} onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value), selectedClipData.clip.fadeOut ?? 0)} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Fade Out</label><input data-testid="selected-clip-fade-out-input" type="number" min={0} max={selectedClipData.clip.lengthBeats / 2} step={0.1} value={selectedClipData.clip.fadeOut ?? 0} onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, selectedClipData.clip.fadeIn ?? 0, Number(e.target.value))} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
              <div className="inspector-meta text-xs text-gray-600 font-mono" data-testid="selected-clip-duplicate-target-beat">Duplicate target beat: {selectedClipData.duplicateStartBeat}</div>

              <div className="clip-actions-group grid grid-cols-2 gap-2 pt-4 border-t border-gray-800">
                <button data-testid="selected-clip-mute-btn" onClick={() => toggleClipMute(selectedClipData.track.id, selectedClipData.clip.id)} disabled={isPlaying || selectedClipData.track.locked} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300" aria-pressed={selectedClipData.clip.muted}>{selectedClipData.clip.muted ? 'Unmute Clip' : 'Mute Clip'}</button>
                <button data-testid="selected-clip-delete-btn" onClick={() => deleteClip(selectedClipData.track.id, selectedClipData.clip.id)} disabled={isPlaying || selectedClipData.track.locked} className="danger-btn px-2 py-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50">Delete Clip</button>
                <button data-testid="selected-clip-copy-btn" onClick={() => copyClip(selectedClipData.track.id, selectedClipData.clip.id)} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Copy Clip</button>
                <button data-testid="paste-clip-btn" onClick={() => { if (selectedTrackId) pasteClip(selectedTrackId) }} disabled={!selectedTrackId || !clipboard || isPlaying} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Paste Clip</button>
                <button data-testid="selected-clip-duplicate-btn" onClick={() => duplicateClip(selectedClipData.track.id, selectedClipData.clip.id)} disabled={!selectedClipData.canDuplicate} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Duplicate Clip</button>
                <button data-testid="selected-clip-split-btn" onClick={() => splitClip(selectedClipData.track.id, selectedClipData.clip.id)} disabled={!selectedClipData.canSplit} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Split Clip</button>
              </div>
            </div>
          </details>
        ) : (
          <div className="inspector-empty text-gray-500 text-sm" data-testid="inspector-clip-empty">Select a clip to edit note pitch.</div>
        )}
      </div>
    </section>
  )
}
