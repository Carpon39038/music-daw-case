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
    <section className="transport bg-[#0a0a0a] border-b border-gray-800 flex flex-col flex-shrink-0" data-testid="transport">
      <div className="transport-primary flex items-center px-4 py-1 gap-4 flex-wrap border-b border-gray-800/50">
        <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-md">
          <button
            className={`play-btn primary-btn px-2 py-0.5 rounded text-xs font-medium ${isPlaying ? 'bg-emerald-600 text-white is-playing' : 'text-gray-400 hover:bg-gray-800'}`}
            data-testid="play-btn"
            onClick={startPlayback}
            disabled={isPlaying}
          >
            ▶ Play
          </button>
          <button
            className={`pause-btn px-2 py-0.5 rounded text-xs font-medium ${isPlaying ? 'text-emerald-400 is-paused' : ''}`}
            data-testid="pause-btn"
            onClick={pausePlayback}
            disabled={!isPlaying}
          >
            ⏸ Pause
          </button>
          <button
            className="stop-btn px-2 py-0.5 rounded text-xs font-medium text-gray-400 hover:bg-gray-800"
            data-testid="stop-btn"
            onClick={stopPlayback}
          >
            ⏹ Stop
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">BPM</span>
          <input
            data-testid="bpm-input"
            type="number"
            min={60}
            max={200}
            value={project.bpm}
            onChange={(e) => setProject({ ...project, bpm: Number(e.target.value) || 120 })}
            disabled={isPlaying}
            className="w-14 bg-[#1a1a1a] border border-gray-800 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:border-emerald-500 text-gray-200"
          />
        </div>

        <label className="flex items-center gap-1 text-xs text-gray-500">
          Vol
          <input
            data-testid="master-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            className="w-16 h-1 accent-emerald-500"
          />
          <span className="master-volume-value text-[10px] text-gray-600">{(masterVolume * 100).toFixed(0)}%</span>
        </label>

        <div className="status font-mono text-emerald-400 text-sm tracking-wider bg-[#1a1a1a] px-3 py-0.5 rounded border border-gray-800">
          {formatTime(playheadBeat, project.bpm)}
        </div>
      </div>

      <details className="transport-advanced">
        <summary className="text-xs text-gray-500 cursor-pointer px-4 py-1">Advanced Controls</summary>
        <div className="transport-secondary flex items-center gap-2 px-4 py-1 flex-wrap">
          <button
            data-testid="metronome-btn"
            onClick={() => setMetronomeEnabled(v => !v)}
            className={`px-1.5 py-0.5 rounded text-xs ${metronomeEnabled ? 'bg-emerald-900/50 text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
            aria-pressed={metronomeEnabled}
          >
            {metronomeEnabled ? 'Metronome: ON' : 'Metronome: OFF'}
          </button>

          <button
            data-testid="tap-tempo-btn"
            onClick={handleTapTempo}
            disabled={isPlaying}
            className="px-1.5 py-0.5 bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-[10px] text-gray-400"
          >
            Tap Tempo
          </button>

          <label className="flex items-center gap-1 text-xs text-gray-500">
            Loop
            <input
              data-testid="loop-enabled"
              type="checkbox"
              checked={loopEnabled}
              onChange={(e) => setLoopEnabled(e.target.checked)}
              disabled={isPlaying}
              className="accent-emerald-500"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            Beats
            <select
              data-testid="loop-length"
              value={loopLengthBeats}
              onChange={(e) => setLoopLengthBeats(Number(e.target.value))}
              disabled={isPlaying || !loopEnabled}
              className="bg-transparent text-[10px] text-gray-400 focus:outline-none cursor-pointer"
            >
              {[4, 8, 12, 16].map((beats) => (<option key={beats} value={beats}>{beats}</option>))}
            </select>
          </label>

          <input
            data-testid="midi-import-input"
            type="file"
            accept=".mid,.midi"
            onChange={handleMIDIImport}
            disabled={isPlaying}
            className="hidden"
          />
          <button data-testid="midi-import-btn" onClick={() => document.querySelector<HTMLInputElement>('[data-testid="midi-import-input"]')?.click()} disabled={isPlaying} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 border border-gray-800 rounded">Import MIDI</button>
          <button data-testid="midi-export-btn" onClick={handleMIDIExport} disabled={isPlaying} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 border border-gray-800 rounded">Export MIDI</button>

          <button data-testid="undo-btn" onClick={undo} disabled={undoDepth === 0 || isPlaying} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-30 border border-gray-800 rounded">Undo</button>
          <button data-testid="redo-btn" onClick={redo} disabled={redoDepth === 0 || isPlaying} className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-30 border border-gray-800 rounded">Redo</button>

          <button
            data-testid="reset-project-btn"
            onClick={() => { resetProjectState(); clearHistory(); }}
            disabled={isPlaying}
            className="px-1.5 py-0.5 text-[10px] bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50"
          >
            Reset
          </button>
        </div>
      </details>
    </section>
  )
}
