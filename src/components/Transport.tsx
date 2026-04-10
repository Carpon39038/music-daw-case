import { Play, Square, RotateCcw, Download, Upload, Undo2, Redo2, FileAudio, Mic } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DAWActions } from '../hooks/useDAWActions'
import { formatTime } from '../utils/formatTime'
import { DEMOS } from '../utils/demos'
import { ShareButton } from './ShareButton'
import { ProjectGallery } from './ProjectGallery'
import { useDAWStore } from '../store/useDAWStore'

function buildProjectEditSignature(project: DAWActions['project']) {
  return JSON.stringify({
    bpm: project.bpm,
    scaleKey: project.scaleKey,
    scaleType: project.scaleType,
    tracks: project.tracks.map((track) => ({
      id: track.id,
      volume: track.volume,
      pan: track.pan,
      muted: track.muted,
      solo: track.solo,
      transposeSemitones: track.transposeSemitones,
      clips: track.clips.map((clip) => ({
        id: clip.id,
        startBeat: clip.startBeat,
        lengthBeats: clip.lengthBeats,
        noteHz: clip.noteHz,
        wave: clip.wave,
        gain: clip.gain,
        muted: clip.muted,
        transposeSemitones: clip.transposeSemitones,
      })),
    })),
  })
}

const CHALLENGE_STYLES = [
  { key: 'lofi', label: 'Lo-Fi' },
  { key: 'edm', label: 'EDM' },
  { key: 'hiphop', label: 'HipHop' },
] as const

const ACHIEVEMENT_META = {
  firstExport: { label: '首次导出', description: '第一次导出作品' },
  firstChord: { label: '首次用和弦', description: '第一次使用和弦功能' },
  first16Bars: { label: '16 小节完成', description: '时间轴覆盖到 16 小节' },
} as const

type ChallengeStyle = (typeof CHALLENGE_STYLES)[number]['key']

function toChallengeStyle(value: string): ChallengeStyle {
  if (value === 'edm' || value === 'hiphop') return value
  return 'lofi'
}

function styleLabel(style: ChallengeStyle | null) {
  if (style === 'edm') return 'EDM'
  if (style === 'hiphop') return 'HipHop'
  if (style === 'lofi') return 'Lo-Fi'
  return '未选择'
}

function detectStep(project: DAWActions['project']) {
  return Math.max(...project.tracks.flatMap((t) => t.clips.map((c) => c.startBeat + c.lengthBeats)))
}

function has16Beats(project: DAWActions['project']) {
  return detectStep(project) >= 16
}

function getChallengeBadge(step: 1 | 2 | 3, currentStep: 1 | 2 | 3 | 4) {
  if (currentStep > step) return '✅'
  if (currentStep === step) return '👉'
  return '⬜'
}

function getStepClass(step: 1 | 2 | 3, currentStep: 1 | 2 | 3 | 4) {
  if (currentStep > step) return 'text-emerald-400'
  if (currentStep === step) return 'text-amber-300'
  return 'text-gray-500'
}

function getChallengeStepLabel(step: 1 | 2 | 3 | 4) {
  if (step === 1) return 'Step 1/3: 选风格'
  if (step === 2) return 'Step 2/3: 改一点'
  if (step === 3) return 'Step 3/3: 导出'
  return '挑战完成'
}

function getInitialChallengeStep(project: DAWActions['project']) {
  return has16Beats(project) ? 2 : 1
}

function computeStep(project: DAWActions['project'], baselineSignature: string | null, style: ChallengeStyle | null, completed: boolean) {
  if (completed) return 4 as const
  if (!style) return 1 as const
  if (!baselineSignature) return 2 as const
  return buildProjectEditSignature(project) !== baselineSignature ? 3 as const : 2 as const
}

function readCurrentProject() {
  return useDAWStore.getState().project
}

function isReadyForChallenge(project: DAWActions['project']) {
  return project.tracks.length > 0
}

function ensureChallengeStyle(value: string): ChallengeStyle {
  return toChallengeStyle(value)
}

function getCurrentChallengeStep(project: DAWActions['project'], baselineSignature: string | null, style: ChallengeStyle | null, completed: boolean) {
  return computeStep(project, baselineSignature, style, completed)
}

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
  handleSocialPublish,
  generateStyleStarter,
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
  const achievements = useDAWStore(s => s.achievements)
  const unlockAchievement = useDAWStore(s => s.unlockAchievement)

  const [challengeOpen, setChallengeOpen] = useState(false)
  const [challengeStyle, setChallengeStyle] = useState<ChallengeStyle | null>(null)
  const [challengeBaselineSignature, setChallengeBaselineSignature] = useState<string | null>(null)
  const [challengeCompleted, setChallengeCompleted] = useState(false)
  const [challengeExporting, setChallengeExporting] = useState(false)
  const [achievementToast, setAchievementToast] = useState<keyof typeof ACHIEVEMENT_META | null>(null)
  const achievementTimerRef = useRef<number | null>(null)

  const challengeStep = useMemo(
    () => getCurrentChallengeStep(project, challengeBaselineSignature, challengeStyle, challengeCompleted),
    [project, challengeBaselineSignature, challengeStyle, challengeCompleted],
  )

  useEffect(() => {
    if (!challengeOpen) return
    if (!isReadyForChallenge(project)) {
      setChallengeStyle(null)
      setChallengeBaselineSignature(null)
      setChallengeCompleted(false)
      return
    }
    if (!challengeStyle) {
      setChallengeCompleted(false)
      setChallengeBaselineSignature(null)
    }
  }, [challengeOpen, challengeStyle, project])

  useEffect(() => {
    return () => {
      if (achievementTimerRef.current) {
        window.clearTimeout(achievementTimerRef.current)
      }
    }
  }, [])

  const showAchievementToast = useCallback((key: keyof typeof ACHIEVEMENT_META) => {
    setAchievementToast(key)
    if (achievementTimerRef.current) {
      window.clearTimeout(achievementTimerRef.current)
    }
    achievementTimerRef.current = window.setTimeout(() => {
      setAchievementToast(null)
      achievementTimerRef.current = null
    }, 2400)
  }, [])

  const unlockIfNeeded = useCallback((key: keyof typeof ACHIEVEMENT_META) => {
    if (achievements[key]?.unlocked) return
    unlockAchievement(key)
    showAchievementToast(key)
  }, [achievements, showAchievementToast, unlockAchievement])

  useEffect(() => {
    const hasChordClip = project.tracks.some((track) =>
      track.clips.some((clip) => (clip.name || '').includes('Chord')),
    )
    if (hasChordClip) {
      unlockIfNeeded('firstChord')
    }
  }, [project.tracks, unlockIfNeeded])

  useEffect(() => {
    if (has16Beats(project)) {
      unlockIfNeeded('first16Bars')
    }
  }, [project, unlockIfNeeded])

  const handleSaveTemplate = () => {
    const suggested = `${project.name || 'Untitled'} Template`
    const templateName = window.prompt('保存为项目模板：请输入模板名称', suggested)
    if (!templateName) return
    saveProjectTemplate(templateName)
  }

  const handleChallengeStart = (style: ChallengeStyle) => {
    const targetStyle = ensureChallengeStyle(style)
    generateStyleStarter(targetStyle)
    const nextProject = readCurrentProject()
    setChallengeStyle(targetStyle)
    setChallengeBaselineSignature(buildProjectEditSignature(nextProject))
    setChallengeCompleted(false)
  }

  const handleChallengeExport = async () => {
    setChallengeExporting(true)
    try {
      await handleMp3Export()
      unlockIfNeeded('firstExport')
      setChallengeCompleted(true)
    } finally {
      setChallengeExporting(false)
    }
  }

  const challengeStatusLabel = challengeCompleted
    ? '挑战完成：已导出 MP3'
    : getChallengeStepLabel(challengeStep)

  const challengeCanExport = challengeStep >= 3 && !isPlaying && !challengeExporting

  const challengeNote = challengeCompleted
    ? `风格：${styleLabel(challengeStyle)} · 已完成 30 秒闭环`
    : challengeStyle
      ? `当前风格：${styleLabel(challengeStyle)}`
      : '先选一个风格，系统会自动生成可播放草稿'

  const challenge16BeatDone = has16Beats(project)

  const challengeInitialStep = getInitialChallengeStep(project)

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
          onClick={async () => {
            await handleAudioExport()
            unlockIfNeeded('firstExport')
          }}
          disabled={isPlaying}
          data-testid="audio-export-btn"
          className="p-2 text-gray-500 hover:text-gray-300"
          title="Export WAV"
        >
          <FileAudio size={18} />
        </button>
        <button
          onClick={async () => {
            await handleMp3Export()
            unlockIfNeeded('firstExport')
          }}
          disabled={isPlaying}
          data-testid="mp3-export-btn"
          className="p-2 text-gray-500 hover:text-gray-300"
          title="Export MP3"
        >
          <span className="text-xs font-bold">MP3</span>
        </button>
        <button
          onClick={async () => {
            await handleSocialPublish()
            unlockIfNeeded('firstExport')
          }}
          disabled={isPlaying}
          data-testid="social-publish-btn"
          className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded"
          title="Export social package ZIP (MP3 + cover card)"
        >
          Publish
        </button>
        <button
          onClick={() => setChallengeOpen((prev) => !prev)}
          disabled={isPlaying}
          data-testid="challenge-mode-toggle"
          className={`px-2 py-1 text-xs border rounded ${challengeOpen ? 'bg-amber-900/40 border-amber-700 text-amber-300' : 'bg-[#1a1a1a] hover:bg-gray-800 border-gray-800 text-gray-300'}`}
          title="30 秒出歌挑战模式"
        >
          30s Challenge
        </button>

        <div className="flex items-center gap-1" data-testid="achievement-status-row">
          {Object.entries(ACHIEVEMENT_META).map(([key, meta]) => {
            const unlocked = achievements[key as keyof typeof ACHIEVEMENT_META]?.unlocked
            return (
              <span
                key={key}
                data-testid={`achievement-badge-${key}`}
                className={`px-1.5 py-0.5 text-[10px] rounded border ${unlocked ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-[#171717] border-gray-800 text-gray-500'}`}
                title={`${meta.label}：${meta.description}`}
              >
                {unlocked ? '🏅' : '⬜'} {meta.label}
              </span>
            )
          })}
        </div>
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

        <ProjectGallery />

        {challengeOpen && (
          <div
            className="ml-2 px-2 py-2 rounded border border-amber-800/60 bg-[#14120f] min-w-[280px]"
            data-testid="challenge-mode-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-amber-300 font-semibold">30 秒出歌挑战</span>
              <span className="text-[10px] text-gray-400" data-testid="challenge-status-label">{challengeStatusLabel}</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1" data-testid="challenge-note">{challengeNote}</p>

            <div className="grid grid-cols-3 gap-1 mt-2" data-testid="challenge-style-grid">
              {CHALLENGE_STYLES.map((style) => (
                <button
                  key={style.key}
                  type="button"
                  data-testid={`challenge-style-${style.key}`}
                  onClick={() => handleChallengeStart(style.key)}
                  disabled={isPlaying}
                  className={`text-[10px] px-2 py-1 rounded border ${challengeStyle === style.key ? 'bg-amber-900/40 border-amber-600 text-amber-200' : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:bg-gray-800'}`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            <ul className="mt-2 space-y-1 text-[10px]" data-testid="challenge-steps">
              <li className={getStepClass(1, challengeStep)} data-testid="challenge-step-1">
                {getChallengeBadge(1, challengeStep)} Step 1：选风格并生成草稿
              </li>
              <li className={getStepClass(2, challengeStep)} data-testid="challenge-step-2">
                {getChallengeBadge(2, challengeStep)} Step 2：改一点（音色/音高/片段）
              </li>
              <li className={getStepClass(3, challengeStep)} data-testid="challenge-step-3">
                {getChallengeBadge(3, challengeStep)} Step 3：导出 MP3
              </li>
            </ul>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-500" data-testid="challenge-16beat-status">
                {challenge16BeatDone ? '已达到 16 小节以上片段覆盖' : `当前进度：${challengeInitialStep === 2 ? '已具备基础片段' : '建议先补到 16 小节'}`}
              </span>
              <button
                type="button"
                data-testid="challenge-export-btn"
                onClick={() => { void handleChallengeExport() }}
                disabled={!challengeCanExport}
                className="text-[10px] px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40"
              >
                {challengeExporting ? '导出中…' : challengeCompleted ? '再次导出' : '完成并导出'}
              </button>
            </div>
          </div>
        )}

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
      {achievementToast && (
        <div
          data-testid="achievement-toast"
          className="fixed bottom-4 right-4 z-50 rounded border border-emerald-700 bg-emerald-900/90 px-3 py-2 text-xs text-emerald-100 shadow-lg"
        >
          <div className="font-semibold">🏆 成就达成：{ACHIEVEMENT_META[achievementToast].label}</div>
          <div className="text-[10px] text-emerald-200">{ACHIEVEMENT_META[achievementToast].description}</div>
        </div>
      )}
    </section>
  )
}
