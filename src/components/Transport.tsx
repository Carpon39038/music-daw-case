import { Play, Square, RotateCcw, Download, Upload, Undo2, Redo2, FileAudio, Mic } from 'lucide-react'
import type { DAWActions } from '../hooks/useDAWActions'
import { formatTime } from '../utils/formatTime'
import { DEMOS } from '../utils/demos'
import { ShareButton } from './ShareButton'
import { useDAWStore } from '../store/useDAWStore'

export function Transport({
  isPlaying,
  project,
  
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
  handleAudioExport,
  handleMp3Export,
  handleTapTempo,
  startPlayback,
  pausePlayback,
  stopPlayback,
  isRecording,
  toggleRecording
}: DAWActions) {
  const performanceMode = useDAWStore(s => s.performanceMode)
  const setPerformanceMode = useDAWStore(s => s.setPerformanceMode)
  const playheadBeat = useDAWStore(s => s.playheadBeat)
  const checkpoints = useDAWStore(s => s.checkpoints || [])
  const restoreCheckpoint = useDAWStore(s => s.restoreCheckpoint)
  const projectTemplates = useDAWStore(s => s.projectTemplates || [])
  const saveProjectTemplate = useDAWStore(s => s.saveProjectTemplate)
  const loadProjectTemplate = useDAWStore(s => s.loadProjectTemplate)

  const handleSaveTemplate = () => {
    const suggested = `${project.name || 'Untitled'} Template`
    const templateName = window.prompt('保存为项目模板：请输入模板名称', suggested)
    if (!templateName) return
    saveProjectTemplate(templateName)
  }

  return (
    <section className="transport h-16 bg-[#111] border-b border-gray-800 flex items-center px-4 justify-between flex-shrink-0" data-testid="transport">
      <div className="transport-primary flex items-center gap-4">
        <div className="flex items-center gap-2 bg-[#1a1a1a] p-1 rounded-md">
          <button
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
            onClick={() => { stopPlayback() }}
            data-testid="stop-btn"
            title="Reset"
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
            onClick={pausePlayback}
            data-testid="pause-btn"
            disabled={!isPlaying}
            title="Pause"
          >
            <Square size={18} />
          </button>
          <button
            className={`play-btn primary-btn p-2 rounded ${isPlaying ? 'bg-emerald-600 text-white is-playing' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
            onClick={() => { void startPlayback() }}
            data-testid="play-btn"
            disabled={isPlaying}
            title="Play (Space)"
          >
            <Play size={18} />
          </button>
          
          <button
            className={`p-2 rounded ${isRecording ? 'bg-red-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
            onClick={() => void toggleRecording()}
            data-testid="record-btn"
            disabled={isPlaying && !isRecording}
            title="Record (Mic)"
          >
            <Mic size={18} />
          </button>
        </div>

        <div className="status flex flex-col items-center justify-center bg-[#1a1a1a] px-4 py-1 rounded-md w-48">
          <div className="font-mono text-emerald-400 text-lg tracking-wider">
            {formatTime(playheadBeat, project.bpm, { curveType: project.tempoCurveType, targetBpm: project.tempoCurveTargetBpm })}
          </div>
          <div className="text-[10px] text-gray-500 font-sans tracking-wide">
            SPACE TO {isPlaying ? 'PAUSE' : 'PLAY'}
          </div>
        </div>
        
        <div className="flex flex-col ml-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={project.name || 'Untitled Project'}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              className="bg-transparent text-sm font-semibold text-gray-200 border-b border-transparent hover:border-gray-600 focus:border-emerald-500 focus:outline-none w-32"
              placeholder="Project Name"
              data-testid="project-name-input"
            />
            <button
              onClick={() => setProject({ ...project, id: crypto.randomUUID(), name: `${project.name || 'Untitled Project'} (Copy)`, lastSavedAt: Date.now() }, { saveHistory: true })}
              className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700"
              title="Save as Copy"
              data-testid="save-as-copy-btn"
            >
              Clone
            </button>
          </div>
          <span className="text-[10px] text-gray-500">
            {project.lastSavedAt ? `Saved ${new Date(project.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">BPM</span>
          <input
            data-testid="bpm-input"
            type="number"
            value={project.bpm}
            onChange={(e) => {
              const nextBpm = Number(e.target.value) || 120
              setProject({
                ...project,
                bpm: nextBpm,
                tempoCurveTargetBpm: project.tempoCurveType === 'constant'
                  ? nextBpm
                  : project.tempoCurveTargetBpm,
              })
            }}
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
          <select
            data-testid="tempo-curve-type"
            value={project.tempoCurveType || 'constant'}
            onChange={(e) => {
              const curveType = e.target.value as 'constant' | 'accelerando' | 'ritardando'
              const fallbackTarget = curveType === 'accelerando'
                ? Math.min(200, project.bpm + 20)
                : curveType === 'ritardando'
                  ? Math.max(60, project.bpm - 20)
                  : project.bpm
              setProject({
                ...project,
                tempoCurveType: curveType,
                tempoCurveTargetBpm: curveType === 'constant'
                  ? project.bpm
                  : project.tempoCurveTargetBpm ?? fallbackTarget,
              })
            }}
            disabled={isPlaying}
            className="bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="constant">Constant</option>
            <option value="accelerando">Accelerando</option>
            <option value="ritardando">Ritardando</option>
          </select>
          <input
            data-testid="tempo-curve-target-bpm"
            type="number"
            min={60}
            max={200}
            value={project.tempoCurveTargetBpm ?? project.bpm}
            onChange={(e) => setProject({
              ...project,
              tempoCurveTargetBpm: Number(e.target.value) || project.bpm,
            })}
            disabled={isPlaying || (project.tempoCurveType || 'constant') === 'constant'}
            className="w-18 bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded">
          <select
            value={project.scaleKey || 'C'}
            onChange={(e) => setProject({ ...project, scaleKey: e.target.value })}
            className="bg-transparent text-xs text-gray-400 focus:outline-none cursor-pointer"
            data-testid="scale-key-select"
          >
            {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <select
            value={project.scaleType || 'chromatic'}
            onChange={(e) => setProject({ ...project, scaleType: e.target.value })}
            className="bg-transparent text-xs text-gray-400 focus:outline-none cursor-pointer"
            data-testid="scale-type-select"
          >
            <option value="chromatic">Chromatic</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="pentatonic_major">Major Pentatonic</option>
            <option value="pentatonic_minor">Minor Pentatonic</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPerformanceMode(performanceMode === 'auto' ? 'on' : performanceMode === 'on' ? 'off' : 'auto')}
            className={`px-1.5 py-0.5 rounded text-xs ${performanceMode === 'on' ? 'bg-amber-900/50 text-amber-400' : performanceMode === 'auto' ? 'text-gray-400' : 'text-gray-600'}`}
            title={`Performance Mode: ${performanceMode.toUpperCase()}`}
            data-testid="performance-mode-btn"
          >
            {performanceMode === 'on' ? 'Perf: ON' : performanceMode === 'auto' ? 'Perf: AUTO' : 'Perf: OFF'}
          </button>

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
        <ShareButton />

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

      <div className="flex items-center gap-2">
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
          onClick={() => { void handleAudioExport() }}
          disabled={isPlaying}
          data-testid="audio-export-btn"
          className="p-2 text-gray-500 hover:text-gray-300"
          title="Export WAV"
        >
          <FileAudio size={18} />
        </button>
        <button
          onClick={() => { void handleMp3Export() }}
          disabled={isPlaying}
          data-testid="mp3-export-btn"
          className="p-2 text-gray-500 hover:text-gray-300"
          title="Export MP3"
        >
          <span className="text-xs font-bold">MP3</span>
        </button>
        <button
          onClick={undo}
          disabled={undoDepth === 0 || isPlaying}
          data-testid="undo-btn"
          className="p-2 text-gray-500 hover:text-gray-300 disabled:opacity-30 flex items-center gap-1"
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo2 size={18} />
          <span className="text-[10px]">Ctrl+Z</span>
        </button>
        <button
          onClick={redo}
          disabled={redoDepth === 0 || isPlaying}
          data-testid="redo-btn"
          className="p-2 text-gray-500 hover:text-gray-300 disabled:opacity-30 flex items-center gap-1"
          title="Redo (Ctrl/Cmd+Shift+Z)"
        >
          <Redo2 size={18} />
        </button>
        
        <ShareButton />

        <select
          disabled={isPlaying}
          onChange={(e) => {
            if (e.target.value) {
              restoreCheckpoint(e.target.value);
              e.target.value = '';
            }
          }}
          className="px-2 py-1 text-xs bg-[#1a1a1a] text-gray-300 border border-gray-800 rounded focus:outline-none"
          defaultValue=""
          data-testid="checkpoint-select"
        >
          <option value="" disabled>Checkpoints</option>
          {checkpoints.map((cp) => (
            <option key={cp.id} value={cp.id}>{new Date(cp.timestamp).toLocaleTimeString()} - {cp.name}</option>
          ))}
        </select>
        
        <select
          disabled={isPlaying}
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            if (!isNaN(idx) && DEMOS[idx]) {
              setProject(DEMOS[idx].project, { saveHistory: true });
              e.target.value = '';
            }
          }}
          className="px-2 py-1 text-xs bg-[#1a1a1a] text-gray-300 border border-gray-800 rounded focus:outline-none"
          defaultValue=""
          data-testid="demo-select"
        >
          <option value="" disabled>Load Demo...</option>
          {DEMOS.map((demo, idx) => (
            <option key={idx} value={idx}>{demo.name}</option>
          ))}
        </select>

        <button
          onClick={handleSaveTemplate}
          disabled={isPlaying}
          data-testid="save-template-btn"
          className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded"
          title="Save current project as reusable template"
        >
          Save Template
        </button>

        <select
          disabled={isPlaying || projectTemplates.length === 0}
          onChange={(e) => {
            if (e.target.value) {
              loadProjectTemplate(e.target.value)
              e.target.value = ''
            }
          }}
          className="px-2 py-1 text-xs bg-[#1a1a1a] text-gray-300 border border-gray-800 rounded focus:outline-none disabled:opacity-50"
          defaultValue=""
          data-testid="load-template-select"
        >
          <option value="" disabled>{projectTemplates.length ? 'Load Template...' : 'No Templates'}</option>
          {projectTemplates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>

        <button
          onClick={() => { resetProjectState(); clearHistory(); }}
          disabled={isPlaying}
          data-testid="reset-project-btn"
          className="px-3 py-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50"
        >
          Reset
        </button>
      </div>
    </section>
  )
}
