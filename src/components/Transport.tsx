import type { DAWActions } from '../hooks/useDAWActions'
import { formatTime } from '../utils/formatTime'

export function Transport({
  isPlaying,
  project,
  masterVolume,
  playheadBeat,
  loopEnabled,
  loopLengthBeats,
  metronomeEnabled,
  undoDepth,
  redoDepth,
  setProject,
  setMasterVolume,
  setLoopEnabled,
  setLoopLengthBeats,
  setMetronomeEnabled,
  undo,
  redo,
  resetProjectState,
  clearHistory,
  handleMIDIImport,
  handleMIDIExport,
  handleTapTempo,
  startPlayback,
  pausePlayback,
  stopPlayback,
}: DAWActions) {
  return (
    <section className="transport" data-testid="transport">
      <div className="transport-primary">
        <button className={`play-btn primary-btn ${isPlaying ? "is-playing" : ""}`} data-testid="play-btn" onClick={startPlayback} disabled={isPlaying} >▶ Play</button>
        <button className={`pause-btn ${!isPlaying ? "" : "is-paused"}`} data-testid="pause-btn" onClick={pausePlayback} disabled={!isPlaying} >⏸ Pause</button>
        <button className="stop-btn" data-testid="stop-btn" onClick={stopPlayback} >⏹ Stop</button>
        
        <label>
          BPM
          <input
            data-testid="bpm-input"
            type="number"
            min={60}
            max={200}
            value={project.bpm}
            onChange={(e) => setProject({ ...project, bpm: Number(e.target.value) || 120 })}
            disabled={isPlaying}
          />
        </label>

        

        <label>
  Vol
  <input data-testid="master-volume" type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => setMasterVolume(Number(e.target.value))} />
  <span className="master-volume-value">{(masterVolume * 100).toFixed(0)}%</span>
</label>

        <div className="status">{formatTime(playheadBeat, project.bpm)}</div>
      </div>

      <details className="transport-advanced">
        <summary>Advanced Controls</summary>
        <div className="transport-secondary">
          <label>
            Loop
            <input data-testid="loop-enabled" type="checkbox" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} disabled={isPlaying} />
          </label>
          <label>
            Beats
            <select data-testid="loop-length" value={loopLengthBeats} onChange={(e) => setLoopLengthBeats(Number(e.target.value))} disabled={isPlaying || !loopEnabled}>
              {[4, 8, 12, 16].map((beats) => (<option key={beats} value={beats}>{beats}</option>))}
            </select>
          </label>

          <button data-testid="metronome-btn" onClick={() => setMetronomeEnabled(v => !v)} aria-pressed={metronomeEnabled}>{metronomeEnabled ? 'Metronome: ON' : 'Metronome: OFF'}</button>

          <button data-testid="undo-btn" onClick={undo} disabled={undoDepth === 0 || isPlaying}>Undo</button>
          <button data-testid="redo-btn" onClick={redo} disabled={redoDepth === 0 || isPlaying}>Redo</button>
          <button data-testid="reset-project-btn" onClick={() => {
            resetProjectState()
            clearHistory()
          }} disabled={isPlaying}>Reset</button>

          <label>
            <input data-testid="midi-import-input" type="file" accept=".mid,.midi" onChange={handleMIDIImport} disabled={isPlaying} />
            <button data-testid="midi-import-btn" onClick={() => document.querySelector<HTMLInputElement>('[data-testid="midi-import-input"]')?.click()} disabled={isPlaying}>Import MIDI</button>
          </label>
          <button data-testid="midi-export-btn" onClick={handleMIDIExport} disabled={isPlaying}>Export MIDI</button>
          <button data-testid="tap-tempo-btn" onClick={handleTapTempo} disabled={isPlaying}>Tap Tempo</button>
        </div>
      </details>
    </section>
  )
}
