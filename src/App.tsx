import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import './App.css'

type WaveType = 'sine' | 'square'

interface Clip {
  id: string
  startBeat: number
  lengthBeats: number
  noteHz: number
  wave: WaveType
}

interface Track {
  id: string
  name: string
  volume: number
  muted: boolean
  solo: boolean
  transposeSemitones: number
  clips: Clip[]
}

interface ProjectState {
  bpm: number
  tracks: Track[]
}

const TRACK_COUNT = 4
const TIMELINE_BEATS = 16
const PROJECT_STORAGE_KEY = 'music-daw-case.project.v1'

function semitoneToRatio(semitones: number) {
  return 2 ** (semitones / 12)
}

function rangesOverlap(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen
  const bEnd = bStart + bLen
  return aStart < bEnd && bStart < aEnd
}

function resolveNonOverlappingStart(
  clips: Clip[],
  clipLength: number,
  desiredStart: number,
  currentClipId?: string,
) {
  const maxStart = Math.max(0, TIMELINE_BEATS - clipLength)
  const clamped = Math.min(maxStart, Math.max(0, desiredStart))

  const conflicts = (start: number) =>
    clips.some(
      (c) => c.id !== currentClipId && rangesOverlap(start, clipLength, c.startBeat, c.lengthBeats),
    )

  if (!conflicts(clamped)) return clamped

  for (let offset = 1; offset <= TIMELINE_BEATS; offset++) {
    const right = clamped + offset
    if (right <= maxStart && !conflicts(right)) return right

    const left = clamped - offset
    if (left >= 0 && !conflicts(left)) return left
  }

  return clamped
}

function createInitialProject(): ProjectState {
  const defaultNotes = [261.63, 329.63, 392.0, 523.25]
  return {
    bpm: 120,
    tracks: Array.from({ length: TRACK_COUNT }).map((_, i) => ({
      id: `track-${i + 1}`,
      name: `Track ${i + 1}`,
      volume: 0.7,
      muted: false,
      solo: false,
      transposeSemitones: 0,
      clips: [
        {
          id: `clip-${i + 1}-1`,
          startBeat: i * 2,
          lengthBeats: 2,
          noteHz: defaultNotes[i],
          wave: i % 2 === 0 ? 'sine' : 'square',
        },
      ],
    })),
  }
}

function isValidProjectState(value: unknown): value is ProjectState {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<ProjectState>
  if (typeof p.bpm !== 'number' || !Array.isArray(p.tracks)) return false
  return p.tracks.every((t) => {
    if (!t || typeof t !== 'object') return false
    if (
      typeof t.id !== 'string' ||
      typeof t.name !== 'string' ||
      typeof t.volume !== 'number' ||
      typeof t.muted !== 'boolean' ||
      typeof t.solo !== 'boolean' ||
      typeof t.transposeSemitones !== 'number'
    )
      return false
    if (!Array.isArray(t.clips)) return false
    return t.clips.every((c) => {
      if (!c || typeof c !== 'object') return false
      return (
        typeof c.id === 'string' &&
        typeof c.startBeat === 'number' &&
        typeof c.lengthBeats === 'number' &&
        typeof c.noteHz === 'number' &&
        (c.wave === 'sine' || c.wave === 'square')
      )
    })
  })
}

function loadInitialProject(): ProjectState {
  if (typeof window === 'undefined') return createInitialProject()
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return createInitialProject()
    const parsed = JSON.parse(raw)
    if (!isValidProjectState(parsed)) return createInitialProject()
    return parsed
  } catch {
    return createInitialProject()
  }
}

declare global {
  interface Window {
    __DAW_DEBUG__?: {
      isPlaying: boolean
      scheduledNodeCount: number
      bpm: number
      trackCount: number
      clipCount: number
      firstTrackFirstClipStartBeat: number | null
      firstTrackFirstClipLengthBeats: number | null
      firstTrackFirstClipWave: WaveType | null
      playheadBeat: number
      undoDepth: number
      redoDepth: number
      masterLevel: number
      audioContextState: AudioContextState | 'uninitialized'
      beatDurationSec: number
      timelineDurationSec: number
      loopEnabled: boolean
      loopLengthBeats: number
      loopRestartCount: number
      mutedTrackCount: number
      audibleTrackCount: number
      soloTrackCount: number
      soloActive: boolean
      transposedTrackCount: number
      firstTrackTransposeSemitones: number | null
      scheduledFrequencyPreviewHz: number[]
    }
  }
}

function App() {
  const [project, setProject] = useState<ProjectState>(() => loadInitialProject())
  const [isPlaying, setIsPlaying] = useState(false)
  const [playheadBeat, setPlayheadBeat] = useState(0)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopLengthBeats, setLoopLengthBeats] = useState(8)
  const undoStackRef = useRef<ProjectState[]>([])
  const redoStackRef = useRef<ProjectState[]>([])
  const dragStateRef = useRef<{
    trackId: string
    clipId: string
    startClientX: number
    originStartBeat: number
    beatWidthPx: number
    lengthBeats: number
    originProject: ProjectState
    hasMoved: boolean
  } | null>(null)
  const resizeStateRef = useRef<{
    trackId: string
    clipId: string
    startClientX: number
    originLengthBeats: number
    originStartBeat: number
    beatWidthPx: number
    originProject: ProjectState
    hasMoved: boolean
  } | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const meterRafRef = useRef<number | null>(null)
  const meterCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const masterLevelRef = useRef<number>(0)

  const scheduledNodesRef = useRef<Array<{ osc: OscillatorNode; gain: GainNode }>>([])
  const scheduledFrequencyPreviewRef = useRef<number[]>([])
  const startTimeRef = useRef<number>(0)
  const animationRef = useRef<number | null>(null)
  const loopRestartCountRef = useRef<number>(0)

  const beatDuration = useMemo(() => 60 / project.bpm, [project.bpm])
  const effectiveTimelineBeats = loopEnabled ? loopLengthBeats : TIMELINE_BEATS
  const totalDurationSec = effectiveTimelineBeats * beatDuration
  const totalClipCount = useMemo(
    () => project.tracks.reduce((sum, t) => sum + t.clips.length, 0),
    [project.tracks],
  )
  const mutedTrackCount = useMemo(() => project.tracks.filter((t) => t.muted).length, [project.tracks])
  const soloTrackCount = useMemo(() => project.tracks.filter((t) => t.solo).length, [project.tracks])
  const transposedTrackCount = useMemo(
    () => project.tracks.filter((t) => t.transposeSemitones !== 0).length,
    [project.tracks],
  )
  const soloActive = soloTrackCount > 0

  const ensureAudio = async () => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext()
      const masterGain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      masterGain.gain.value = 0.8
      masterGain.connect(analyser)
      analyser.connect(ctx.destination)

      audioCtxRef.current = ctx
      masterGainRef.current = masterGain
      analyserRef.current = analyser
    }

    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume()
    }
  }

  const clearScheduledNodes = () => {
    scheduledFrequencyPreviewRef.current = []
    scheduledNodesRef.current.forEach(({ osc, gain }) => {
      try {
        osc.stop()
      } catch {
        // ignore
      }
      try {
        osc.disconnect()
        gain.disconnect()
      } catch {
        // ignore
      }
    })
    scheduledNodesRef.current = []
  }

  const stopPlayback = () => {
    setIsPlaying(false)
    setPlayheadBeat(0)
    loopRestartCountRef.current = 0
    clearScheduledNodes()

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  const pausePlayback = () => {
    setIsPlaying(false)
    clearScheduledNodes()

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  const scheduleProject = () => {
    const ctx = audioCtxRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return

    const loopBeats = loopEnabled ? loopLengthBeats : TIMELINE_BEATS
    const loopDurationSec = loopBeats * beatDuration
    const startAt = ctx.currentTime + 0.05
    startTimeRef.current = startAt

    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.startBeat >= loopBeats) return

        const clipOffsetSec = clip.startBeat * beatDuration
        const clipDurationSec = Math.min(loopDurationSec - clipOffsetSec, clip.lengthBeats * beatDuration)
        if (clipDurationSec <= 0) return

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        const clipStart = startAt + clipOffsetSec
        const clipEnd = clipStart + clipDurationSec

        osc.type = clip.wave
        const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones)
        osc.frequency.value = scheduledFrequencyHz

        gain.gain.setValueAtTime(0.0001, clipStart)
        const isTrackAudible = !track.muted && (!soloActive || track.solo)
        const effectiveTrackVolume = isTrackAudible ? track.volume : 0
        gain.gain.linearRampToValueAtTime(effectiveTrackVolume * 0.15, clipStart + 0.01)
        gain.gain.setValueAtTime(effectiveTrackVolume * 0.15, Math.max(clipStart + 0.01, clipEnd - 0.02))
        gain.gain.linearRampToValueAtTime(0.0001, clipEnd)

        osc.connect(gain)
        gain.connect(master)

        osc.start(clipStart)
        osc.stop(clipEnd)

        scheduledFrequencyPreviewRef.current.push(scheduledFrequencyHz)
        scheduledNodesRef.current.push({ osc, gain })
      })
    })
  }

  const startPlayback = async () => {
    await ensureAudio()
    loopRestartCountRef.current = 0
    clearScheduledNodes()
    scheduleProject()
    setPlayheadBeat(0)
    setIsPlaying(true)
  }

  useEffect(() => {
    if (!isPlaying) return

    const update = () => {
      const ctx = audioCtxRef.current
      if (!ctx) return

      const elapsed = Math.max(0, ctx.currentTime - startTimeRef.current)
      const beat = elapsed / beatDuration
      const wrappedBeat = loopEnabled ? beat % effectiveTimelineBeats : beat
      setPlayheadBeat(wrappedBeat)

      if (elapsed >= totalDurationSec) {
        if (loopEnabled) {
          loopRestartCountRef.current += 1
          clearScheduledNodes()
          scheduleProject()
          animationRef.current = requestAnimationFrame(update)
          return
        }
        stopPlayback()
        return
      }

      animationRef.current = requestAnimationFrame(update)
    }

    animationRef.current = requestAnimationFrame(update)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, beatDuration, totalDurationSec])

  useEffect(() => {
    const drawMeter = () => {
      const analyser = analyserRef.current
      const canvas = meterCanvasRef.current
      if (!analyser || !canvas) {
        meterRafRef.current = requestAnimationFrame(drawMeter)
        return
      }

      const ctx2d = canvas.getContext('2d')
      if (!ctx2d) return

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteTimeDomainData(dataArray)

      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / bufferLength)
      const level = Math.min(1, rms * 3)
      masterLevelRef.current = level
      if (window.__DAW_DEBUG__) {
        window.__DAW_DEBUG__.masterLevel = level
      }

      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      ctx2d.fillStyle = '#1d2a3a'
      ctx2d.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = canvas.width * level
      ctx2d.fillStyle = level > 0.75 ? '#ff5d5d' : '#31d187'
      ctx2d.fillRect(0, 0, barWidth, canvas.height)

      meterRafRef.current = requestAnimationFrame(drawMeter)
    }

    meterRafRef.current = requestAnimationFrame(drawMeter)

    return () => {
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopPlayback()
      audioCtxRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.__DAW_DEBUG__ = {
      isPlaying,
      scheduledNodeCount: scheduledNodesRef.current.length,
      bpm: project.bpm,
      trackCount: project.tracks.length,
      clipCount: totalClipCount,
      firstTrackFirstClipStartBeat: project.tracks[0]?.clips[0]?.startBeat ?? null,
      firstTrackFirstClipLengthBeats: project.tracks[0]?.clips[0]?.lengthBeats ?? null,
      firstTrackFirstClipWave: project.tracks[0]?.clips[0]?.wave ?? null,
      playheadBeat,
      undoDepth: undoStackRef.current.length,
      redoDepth: redoStackRef.current.length,
      masterLevel: masterLevelRef.current,
      audioContextState: audioCtxRef.current?.state ?? 'uninitialized',
      beatDurationSec: beatDuration,
      timelineDurationSec: totalDurationSec,
      loopEnabled,
      loopLengthBeats: effectiveTimelineBeats,
      loopRestartCount: loopRestartCountRef.current,
      mutedTrackCount,
      audibleTrackCount: project.tracks.filter((t) => !t.muted && (!soloActive || t.solo)).length,
      soloTrackCount,
      soloActive,
      transposedTrackCount,
      firstTrackTransposeSemitones: project.tracks[0]?.transposeSemitones ?? null,
      scheduledFrequencyPreviewHz: [...scheduledFrequencyPreviewRef.current],
    }
  }, [
    isPlaying,
    playheadBeat,
    project,
    totalClipCount,
    beatDuration,
    totalDurationSec,
    loopEnabled,
    effectiveTimelineBeats,
    mutedTrackCount,
    soloTrackCount,
    soloActive,
    transposedTrackCount,
  ])

  useEffect(() => {
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project))
    } catch {
      // ignore persistence errors
    }
  }, [project])

  const applyProjectUpdate = (updater: (prev: ProjectState) => ProjectState) => {
    setProject((prev) => {
      const next = updater(prev)
      if (next === prev) return prev
      undoStackRef.current.push(structuredClone(prev))
      if (undoStackRef.current.length > 100) undoStackRef.current.shift()
      redoStackRef.current = []
      return next
    })
  }

  const addClip = (trackId: string) => {
    applyProjectUpdate((prev) => {
      const next = structuredClone(prev)
      const track = next.tracks.find((t) => t.id === trackId)
      if (!track) return prev
      const lengthBeats = 2
      const desiredStart = Math.floor(Math.random() * 12)
      const startBeat = resolveNonOverlappingStart(track.clips, lengthBeats, desiredStart)
      const newClip: Clip = {
        id: `${trackId}-clip-${Date.now()}`,
        startBeat,
        lengthBeats,
        noteHz: [220, 261.63, 329.63, 392, 440][Math.floor(Math.random() * 5)],
        wave: Math.random() > 0.5 ? 'sine' : 'square',
      }
      track.clips.push(newClip)
      return next
    })
  }

  const removeClip = (trackId: string, clipId: string) => {
    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track) return prev
      if (track.clips.length <= 1) return prev

      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t,
        ),
      }
    })
  }

  const cycleClipWave = (trackId: string, clipId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId) return t
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId) return c
            return {
              ...c,
              wave: c.wave === 'sine' ? 'square' : 'sine',
            }
          }),
        }
      }),
    }))
  }

  const setTrackVolume = (trackId: string, volume: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, volume } : t)),
    }))
  }

  const toggleTrackMute = (trackId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
    }))
  }

  const toggleTrackSolo = (trackId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, solo: !t.solo } : t)),
    }))
  }

  const setTrackTranspose = (trackId: string, transposeSemitones: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              transposeSemitones: Math.max(-12, Math.min(12, Math.round(transposeSemitones))),
            }
          : t,
      ),
    }))
  }

  const updateClipStartBeat = (trackId: string, clipId: string, startBeat: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId) return t
        const current = t.clips.find((c) => c.id === clipId)
        if (!current) return t
        const resolved = resolveNonOverlappingStart(t.clips, current.lengthBeats, startBeat, clipId)
        return {
          ...t,
          clips: t.clips.map((c) => (c.id === clipId ? { ...c, startBeat: resolved } : c)),
        }
      }),
    }))
  }

  const updateClipLengthBeats = (trackId: string, clipId: string, lengthBeats: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId) return t
        const current = t.clips.find((c) => c.id === clipId)
        if (!current) return t

        const maxLengthByTimeline = TIMELINE_BEATS - current.startBeat
        const clampedLength = Math.min(maxLengthByTimeline, Math.max(1, lengthBeats))
        const resolvedStart = resolveNonOverlappingStart(t.clips, clampedLength, current.startBeat, clipId)
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, startBeat: resolvedStart, lengthBeats: clampedLength } : c,
          ),
        }
      }),
    }))
  }

  const undo = () => {
    const prev = undoStackRef.current.pop()
    if (!prev) return
    redoStackRef.current.push(structuredClone(project))
    setProject(prev)
  }

  const redo = () => {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(structuredClone(project))
    setProject(next)
  }

  const startClipDrag = (
    e: ReactMouseEvent<HTMLButtonElement>,
    trackId: string,
    clipId: string,
    originStartBeat: number,
    lengthBeats: number,
  ) => {
    if (isPlaying) return
    if (e.button !== 0) return

    const grid = timelineRef.current
    if (!grid) return

    const beatWidthPx = grid.getBoundingClientRect().width / TIMELINE_BEATS
    if (!Number.isFinite(beatWidthPx) || beatWidthPx <= 0) return

    dragStateRef.current = {
      trackId,
      clipId,
      startClientX: e.clientX,
      originStartBeat,
      beatWidthPx,
      lengthBeats,
      originProject: structuredClone(project),
      hasMoved: false,
    }

    let cancelled = false

    const onMove = (moveEvent: MouseEvent) => {
      const state = dragStateRef.current
      if (!state) return

      const deltaBeatRaw = (moveEvent.clientX - state.startClientX) / state.beatWidthPx
      const deltaBeat = Math.round(deltaBeatRaw)
      const maxStart = Math.max(0, TIMELINE_BEATS - state.lengthBeats)
      const nextStart = Math.min(maxStart, Math.max(0, state.originStartBeat + deltaBeat))

      if (nextStart !== state.originStartBeat) {
        state.hasMoved = true
      }
      updateClipStartBeat(state.trackId, state.clipId, nextStart)
    }

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const state = dragStateRef.current
      if (!state) return
      if (keyEvent.key !== 'Escape') return
      cancelled = true
      setProject(state.originProject)
      cleanup()
    }

    const cleanup = () => {
      const state = dragStateRef.current
      if (state && state.hasMoved && !cancelled) {
        undoStackRef.current.push(structuredClone(state.originProject))
        if (undoStackRef.current.length > 100) undoStackRef.current.shift()
        redoStackRef.current = []
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
      window.removeEventListener('keydown', onKeyDown)
      dragStateRef.current = null
      dragCleanupRef.current = null
    }

    dragCleanupRef.current = cleanup
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
    window.addEventListener('keydown', onKeyDown)
  }

  const startClipResize = (
    e: ReactMouseEvent<HTMLSpanElement>,
    trackId: string,
    clipId: string,
    originStartBeat: number,
    originLengthBeats: number,
  ) => {
    if (isPlaying) return
    if (e.button !== 0) return
    e.stopPropagation()

    const grid = timelineRef.current
    if (!grid) return

    const beatWidthPx = grid.getBoundingClientRect().width / TIMELINE_BEATS
    if (!Number.isFinite(beatWidthPx) || beatWidthPx <= 0) return

    resizeStateRef.current = {
      trackId,
      clipId,
      startClientX: e.clientX,
      originLengthBeats,
      originStartBeat,
      beatWidthPx,
      originProject: structuredClone(project),
      hasMoved: false,
    }

    let cancelled = false

    const onMove = (moveEvent: MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) return

      const deltaBeatRaw = (moveEvent.clientX - state.startClientX) / state.beatWidthPx
      const deltaBeat = Math.round(deltaBeatRaw)
      const maxLength = TIMELINE_BEATS - state.originStartBeat
      const nextLength = Math.min(maxLength, Math.max(1, state.originLengthBeats + deltaBeat))

      if (nextLength !== state.originLengthBeats) {
        state.hasMoved = true
      }
      updateClipLengthBeats(state.trackId, state.clipId, nextLength)
    }

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const state = resizeStateRef.current
      if (!state) return
      if (keyEvent.key !== 'Escape') return
      cancelled = true
      setProject(state.originProject)
      cleanup()
    }

    const cleanup = () => {
      const state = resizeStateRef.current
      if (state && state.hasMoved && !cancelled) {
        undoStackRef.current.push(structuredClone(state.originProject))
        if (undoStackRef.current.length > 100) undoStackRef.current.shift()
        redoStackRef.current = []
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
      window.removeEventListener('keydown', onKeyDown)
      resizeStateRef.current = null
      resizeCleanupRef.current = null
    }

    resizeCleanupRef.current = cleanup
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
    window.addEventListener('keydown', onKeyDown)
  }

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
      resizeCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName.toLowerCase()
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      const isMetaUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z'
      if (isMetaUndo) {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        if (isPlaying) {
          pausePlayback()
        } else {
          void startPlayback()
        }
        return
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        stopPlayback()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlaying, project])

  return (
    <div className="app">
      <h1>Music DAW Case (Harness MVP)</h1>

      <section className="transport" data-testid="transport">
        <button data-testid="play-btn" onClick={startPlayback} disabled={isPlaying}>Play</button>
        <button data-testid="pause-btn" onClick={pausePlayback} disabled={!isPlaying}>Pause</button>
        <button data-testid="stop-btn" onClick={stopPlayback}>Stop</button>
        <button data-testid="undo-btn" onClick={undo} disabled={undoStackRef.current.length === 0 || isPlaying}>Undo</button>
        <button data-testid="redo-btn" onClick={redo} disabled={redoStackRef.current.length === 0 || isPlaying}>Redo</button>
        <button
          data-testid="reset-project-btn"
          onClick={() => {
            applyProjectUpdate(() => createInitialProject())
            undoStackRef.current = []
            redoStackRef.current = []
            try {
              window.localStorage.removeItem(PROJECT_STORAGE_KEY)
            } catch {
              // ignore
            }
          }}
          disabled={isPlaying}
        >
          Reset
        </button>

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
          Loop
          <input
            data-testid="loop-enabled"
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => setLoopEnabled(e.target.checked)}
            disabled={isPlaying}
          />
        </label>

        <label>
          Loop Beats
          <select
            data-testid="loop-length"
            value={loopLengthBeats}
            onChange={(e) => setLoopLengthBeats(Number(e.target.value))}
            disabled={isPlaying || !loopEnabled}
          >
            {[4, 8, 12, 16].map((beats) => (
              <option key={beats} value={beats}>
                {beats}
              </option>
            ))}
          </select>
        </label>

        <div className="status">Playhead: {playheadBeat.toFixed(2)} beat</div>
      </section>

      <section className="meter">
        <div className="meter-label">Master Output Meter</div>
        <canvas ref={meterCanvasRef} width={320} height={16} />
      </section>

      <section className="timeline">
        {project.tracks.map((track) => (
          <div className="track-row" key={track.id}>
            <div className="track-header" data-testid={`track-header-${track.id}`}>
              <div className="track-name">{track.name}</div>
              <label>
                Vol
                <input
                  data-testid={`vol-${track.id}`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
                  disabled={isPlaying}
                />
              </label>
              <label>
                Pitch
                <input
                  data-testid={`transpose-${track.id}`}
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={track.transposeSemitones}
                  onChange={(e) => setTrackTranspose(track.id, Number(e.target.value))}
                  disabled={isPlaying}
                />
                <span className="transpose-value">{track.transposeSemitones >= 0 ? '+' : ''}{track.transposeSemitones} st</span>
              </label>
              <button
                data-testid={`mute-${track.id}`}
                onClick={() => toggleTrackMute(track.id)}
                disabled={isPlaying}
                aria-pressed={track.muted}
              >
                {track.muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                data-testid={`solo-${track.id}`}
                onClick={() => toggleTrackSolo(track.id)}
                disabled={isPlaying}
                aria-pressed={track.solo}
              >
                {track.solo ? 'Unsolo' : 'Solo'}
              </button>
              <button data-testid={`add-clip-${track.id}`} onClick={() => addClip(track.id)} disabled={isPlaying}>+ Clip</button>
            </div>

            <div className="track-grid" ref={timelineRef}>
              {Array.from({ length: TIMELINE_BEATS }).map((_, beat) => (
                <div className="beat-cell" key={beat} />
              ))}
              <div className="playhead" style={{ left: `${(Math.min(playheadBeat, effectiveTimelineBeats) / effectiveTimelineBeats) * 100}%` }} />
              {track.clips.map((clip) => (
                <button
                  key={clip.id}
                  data-testid={`clip-${track.id}-${clip.id}`}
                  className={`clip ${clip.wave}`}
                  style={{
                    left: `${(clip.startBeat / TIMELINE_BEATS) * 100}%`,
                    width: `${(clip.lengthBeats / TIMELINE_BEATS) * 100}%`,
                  }}
                  title={`${clip.wave} ${clip.noteHz.toFixed(2)}Hz @ beat ${clip.startBeat}（双击切换波形，Alt+双击删除）`}
                  onMouseDown={(e) => startClipDrag(e, track.id, clip.id, clip.startBeat, clip.lengthBeats)}
                  onDoubleClick={(e) => {
                    if (isPlaying) return
                    if (e.altKey) {
                      removeClip(track.id, clip.id)
                      return
                    }
                    cycleClipWave(track.id, clip.id)
                  }}
                >
                  <span className="clip-label">
                    {clip.wave} {Math.round(clip.noteHz)}Hz · {clip.lengthBeats} beat
                    {clip.lengthBeats > 1 ? 's' : ''}
                  </span>
                  <span
                    className="clip-resize-handle"
                    data-testid={`clip-resize-${track.id}-${clip.id}`}
                    onMouseDown={(e) =>
                      startClipResize(e, track.id, clip.id, clip.startBeat, clip.lengthBeats)
                    }
                    role="slider"
                    aria-label={`Resize ${track.name} clip`}
                    aria-valuemin={1}
                    aria-valuemax={TIMELINE_BEATS - clip.startBeat}
                    aria-valuenow={clip.lengthBeats}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="hint">双击 clip 切换波形；Alt+双击删除。播放时禁用新增 clip 与 BPM 修改。快捷键：Space 播放/暂停，S 停止，⌘/Ctrl+Z 撤销，⌘/Ctrl+Shift+Z 重做。</p>
    </div>
  )
}

export default App
