import { Play, Square, Pause, RotateCcw, Download, Upload, Undo2, Redo2 } from 'lucide-react'
import type { DAWActions } from '../hooks/useDAWActions'
import { formatTime } from '../utils/formatTime'

export function Transport({
  isPlaying,
  project,
  playheadBeat,
  loopEnabled,
  loopLengthBeats,
  metronomeEnabled,
  undoDepth,
  redoDepth,
  setProject,
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
      <div className="transport-primary flex items-center px-4 h-8 gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-md">
          <button
            className={`play-btn primary-btn p-2 rounded ${isPlaying ? 'bg-emerald-600 text-white is-playing' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
            onClick={() => { void startPlayback() }}
            data-testid="play-btn"
            disabled={isPlaying}
            title="Play"
          >
            <Play size={18} />
          </button>
          <button
            className={`pause-btn p-2 rounded ${isPlaying ? 'text-emerald-400 is-paused' : 'text-gray-400 hover:bg-gray-800'}`}
            onClick={pausePlayback}
            data-testid="pause-btn"
            disabled={!isPlaying}
            title="Pause"
          >
            <Pause size={18} />
          </button>
          <button
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
            onClick={stopPlayback}
            data-testid="stop-btn"
            title="Stop"
          >
            <Square size={18} />
          </button>
          <button
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
            onClick={() => { stopPlayback() }}
            title="Reset"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="status flex items-center gap-4 bg-[#1a1a1a] px-4 py-2 rounded-md font-mono text-emerald-400 text-lg tracking-wider w-48 justify-center">
          {formatTime(playheadBeat, project.bpm)}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">BPM</span>
          <input
            data-testid="bpm-input"
            type="number"
            value={project.bpm}
            onChange={(e) => setProject({ ...project, bpm: Number(e.target.value) || 120 })}
            disabled={isPlaying}
            className="w-16 bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-emerald-500"
            min={60}
            max={200}
          />
          <button
            onClick={handleTapTempo}
            disabled={isPlaying}
            data-testid="tap-tempo-btn"
            className="px-2 py-1 bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-xs text-gray-400 active:bg-emerald-900"
          >
            Tap Tempo
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMetronomeEnabled(v => !v)}
            className={`px-1.5 py-0.5 rounded text-xs ${metronomeEnabled ? 'bg-emerald-900/50 text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Metronome"
            data-testid="metronome-btn"
            aria-pressed={metronomeEnabled}
          >
            {metronomeEnabled ? 'Metronome: ON' : 'Metronome: OFF'}
          </button>

          <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-md">
            <button
              onClick={() => setLoopEnabled(!loopEnabled)}
              className={`px-2 py-1 text-xs rounded ${loopEnabled ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              data-testid="loop-enabled"
            >
              LOOP
            </button>
            <select
              value={loopLengthBeats}
              onChange={(e) => setLoopLengthBeats(Number(e.target.value))}
              disabled={!loopEnabled}
              data-testid="loop-length"
              className="bg-transparent text-xs text-gray-400 focus:outline-none cursor-pointer"
            >
              <option value="4">4 Bars</option>
              <option value="8">8 Bars</option>
              <option value="12">12 Bars</option>
              <option value="16">16 Bars</option>
            </select>
          </div>
        </div>
      </div>

      <details className="transport-advanced">
        <summary className="text-xs text-gray-500 cursor-pointer px-4 py-1">Advanced Controls</summary>
        <div className="transport-secondary flex items-center gap-2 px-4 py-1 flex-wrap">
          <input
            data-testid="midi-import-input"
            type="file"
            accept=".mid,.midi"
            onChange={handleMIDIImport}
            disabled={isPlaying}
            className="hidden"
          />
          <button
            data-testid="midi-import-btn"
            onClick={() => document.querySelector<HTMLInputElement>('[data-testid="midi-import-input"]')?.click()}
            disabled={isPlaying}
            className="p-2 text-gray-500 hover:text-gray-300"
            title="Import MIDI"
          >
            <Upload size={18} />
          </button>
          <button
            onClick={handleMIDIExport}
            disabled={isPlaying}
            data-testid="midi-export-btn"
            className="p-2 text-gray-500 hover:text-gray-300"
            title="Export MIDI"
          >
            <Download size={18} />
          </button>
          <button
            onClick={undo}
            disabled={undoDepth === 0 || isPlaying}
            data-testid="undo-btn"
            className="p-2 text-gray-500 hover:text-gray-300 disabled:opacity-30"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={redoDepth === 0 || isPlaying}
            data-testid="redo-btn"
            className="p-2 text-gray-500 hover:text-gray-300 disabled:opacity-30"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
          <button
            onClick={() => { resetProjectState(); clearHistory(); }}
            disabled={isPlaying}
            data-testid="reset-project-btn"
            className="px-3 py-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50"
          >
            Reset
          </button>
        </div>
      </details>
    </section>
  )
}
