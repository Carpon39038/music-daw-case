import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import './App.css'

type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle'

interface Clip {
  name?: string
  id: string
  startBeat: number
  lengthBeats: number
  noteHz: number
  wave: WaveType
  muted?: boolean
  gain?: number
  transposeSemitones?: number
  color?: string
  fadeIn?: number
  fadeOut?: number
}

interface Track {
  id: string
  name: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  color?: string
  locked: boolean
  delayEnabled?: boolean
  delayTime?: number
  delayFeedback?: number
  flangerEnabled?: boolean
  flangerSpeed?: number
  flangerDepth?: number
  flangerFeedback?: number
  eqEnabled?: boolean
  eqLow?: number
  eqMid?: number
  eqHigh?: number
  distortionEnabled?: boolean
  compressorEnabled?: boolean
  compressorThreshold?: number
  compressorRatio?: number
  chorusEnabled?: boolean
  chorusDepth?: number
  chorusRate?: number
  tremoloEnabled?: boolean
  tremoloDepth?: number
  tremoloRate?: number
  reverbEnabled?: boolean
  reverbMix?: number
  reverbDecay?: number
  transposeSemitones: number
  filterType: 'none' | 'lowpass' | 'highpass'
  filterCutoff: number
  clips: Clip[]
}

interface ProjectState {
  bpm: number
  tracks: Track[]
}

const TRACK_COUNT = 4
const TIMELINE_BEATS = 16
const PROJECT_STORAGE_KEY = 'music-daw-case.project.v1'
const MASTER_VOLUME_KEY = 'music-daw-case.masterVolume.v1'
const MASTER_EQ_KEY = 'music-daw-case.masterEQ.v1'

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
      pan: 0,
      muted: false,
      solo: false,
            color: '#4a5568',
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      reverbEnabled: false,
      distortionEnabled: false,
      reverbMix: 0.3,
      reverbDecay: 2,
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

// MIDI parsing and conversion utilities
function midiNoteToFrequency(noteNumber: number): number {
  return 440 * Math.pow(2, (noteNumber - 69) / 12)
}

function frequencyToMIDINote(frequency: number): number {
  return Math.round(12 * Math.log2(frequency / 440) + 69)
}

function buildMIDIHeader(bpm: number): ArrayBuffer {
  const midiHeader = new ArrayBuffer(14)
  const headerView = new DataView(midiHeader)

  // MIDI header: MThd
  headerView.setUint8(0, 0x4D) // 'M'
  headerView.setUint8(1, 0x54) // 'T'
  headerView.setUint8(2, 0x68) // 'h'
  headerView.setUint8(3, 0x64) // 'd'
  headerView.setUint32(4, 6, false) // Header length
  headerView.setUint16(8, 0, false) // Format type 0
  headerView.setUint16(10, 1, false) // Number of tracks
  headerView.setUint16(12, Math.round((60 / bpm) * 500000), false) // Time division (ticks per beat)

  return midiHeader
}

function buildMIDITrack(clips: Clip[], bpm: number): ArrayBuffer {
  // Build MIDI track data from clips
  const ticksPerBeat = Math.round((60 / bpm) * 500000)
  const events: Uint8Array[] = []

  // Program change event
  events.push(new Uint8Array([0x00, 0xC0, 0x00]))

  for (const clip of clips) {
    const startTick = Math.round(clip.startBeat * ticksPerBeat)
    const endTick = Math.round((clip.startBeat + clip.lengthBeats) * ticksPerBeat)
    const noteNumber = frequencyToMIDINote(clip.noteHz)

    // Variable-length quantity encoding for MIDI ticks
    const encodeVLQ = (value: number): Uint8Array => {
      if (value < 0x80) return new Uint8Array([value])
      const bytes: number[] = []
      bytes.unshift(value & 0x7F)
      value >>= 7
      while (value > 0) {
        bytes.unshift((value & 0x7F) | 0x80)
        value >>= 7
      }
      return new Uint8Array(bytes)
    }

    // Note on event
    events.push(new Uint8Array([...encodeVLQ(startTick), 0x90, noteNumber, 0x60]))
    // Note off event
    events.push(new Uint8Array([...encodeVLQ(endTick - startTick), 0x80, noteNumber, 0x00]))
  }

  // End of track
  events.push(new Uint8Array([0x00, 0xFF, 0x2F, 0x00]))

  // Calculate total track length
  const trackDataLength = events.reduce((sum, e) => sum + e.length, 0)
  const trackHeader = new Uint8Array([
    0x4D, 0x54, 0x72, 0x6B, // 'MTrk'
    (trackDataLength >> 24) & 0xFF,
    (trackDataLength >> 16) & 0xFF,
    (trackDataLength >> 8) & 0xFF,
    trackDataLength & 0xFF,
  ])

  // Combine track header and events
  const result = new Uint8Array(trackHeader.length + trackDataLength)
  result.set(trackHeader, 0)
  let offset = trackHeader.length
  for (const event of events) {
    result.set(event, offset)
    offset += event.length
  }

  return result.buffer
}

function buildMIDIFromProject(tracks: Track[], bpm: number): ArrayBuffer {
  // Combine all clips from all tracks into a single MIDI track
  const allClips = tracks.flatMap((track, index) =>
    track.clips.map((clip) => ({
      ...clip,
      startBeat: clip.startBeat + index * TIMELINE_BEATS, // Offset tracks to avoid overlap
    })),
  )

  const header = buildMIDIHeader(bpm)
  const trackData = buildMIDITrack(allClips, bpm)

  const result = new Uint8Array(header.byteLength + trackData.byteLength)
  result.set(new Uint8Array(header), 0)
  result.set(new Uint8Array(trackData), header.byteLength)

  return result.buffer
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
      (typeof t.pan !== 'number' && typeof t.pan !== 'undefined') ||
      typeof t.muted !== 'boolean' ||
      typeof t.solo !== 'boolean' ||
      (typeof t.locked !== 'boolean' && typeof t.locked !== 'undefined') ||
      typeof t.transposeSemitones !== 'number' ||
      (t.compressorEnabled !== undefined && typeof t.compressorEnabled !== 'boolean') ||
      (t.compressorThreshold !== undefined && typeof t.compressorThreshold !== 'number') ||
      (t.compressorRatio !== undefined && typeof t.compressorRatio !== 'number') ||
      (t.chorusEnabled !== undefined && typeof t.chorusEnabled !== 'boolean') ||
      (t.chorusDepth !== undefined && typeof t.chorusDepth !== 'number') ||
      (t.chorusRate !== undefined && typeof t.chorusRate !== 'number') ||
      (t.tremoloEnabled !== undefined && typeof t.tremoloEnabled !== 'boolean') ||
      (t.tremoloDepth !== undefined && typeof t.tremoloDepth !== 'number') ||
      (t.tremoloRate !== undefined && typeof t.tremoloRate !== 'number') ||
      (t.reverbEnabled !== undefined && typeof t.reverbEnabled !== 'boolean') ||
      (t.reverbMix !== undefined && typeof t.reverbMix !== 'number') ||
      (t.reverbDecay !== undefined && typeof t.reverbDecay !== 'number') ||
      (t.filterType && !['none', 'lowpass', 'highpass'].includes(t.filterType)) ||
      (t.filterCutoff !== undefined && typeof t.filterCutoff !== 'number')
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

    return {
      ...parsed,
      tracks: parsed.tracks.map((track) => ({
        ...track,
        locked: track.locked ?? false,
        pan: track.pan ?? 0,
        filterType: track.filterType ?? 'none',
        compressorEnabled: track.compressorEnabled ?? false,
        compressorThreshold: track.compressorThreshold ?? -24,
        compressorRatio: track.compressorRatio ?? 12,
        chorusEnabled: track.chorusEnabled ?? false,
        chorusDepth: track.chorusDepth ?? 0.5,
        chorusRate: track.chorusRate ?? 1.5,
        tremoloEnabled: track.tremoloEnabled ?? false,
        tremoloDepth: track.tremoloDepth ?? 0.5,
        tremoloRate: track.tremoloRate ?? 5.0,
        reverbEnabled: track.reverbEnabled ?? false,
        distortionEnabled: track.distortionEnabled ?? false,
        reverbMix: track.reverbMix ?? 0.3,
        reverbDecay: track.reverbDecay ?? 2,
        filterCutoff: track.filterCutoff ?? 20000,
      })),
    }
  } catch {
    return createInitialProject()
  }
}

function createReverbIR(ctx: AudioContext, durationSec: number, sampleRate?: number): AudioBuffer {
  const sr = sampleRate ?? ctx.sampleRate
  const length = Math.max(1, Math.floor(sr * durationSec))
  const buffer = ctx.createBuffer(2, length, sr)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2)
    }
  }
  return buffer
}

declare global {
  interface Window {
    __DAW_DEBUG__?: {
      isPlaying: boolean
      scheduledNodeCount: number
      bpm: number
      trackCount: number
      trackNames: string[]
      clipCount: number
      firstTrackFirstClipStartBeat: number | null
      firstTrackFirstClipLengthBeats: number | null
      firstTrackFirstClipWave: WaveType | null
      firstTrackFirstClipGain: number | null
      playheadBeat: number
      undoDepth: number
      redoDepth: number
      masterLevel: number
      masterVolume: number
      masterEQ: { low: number; mid: number; high: number }
      audioContextState: AudioContextState | 'uninitialized'
      beatDurationSec: number
      timelineDurationSec: number
      loopEnabled: boolean
      loopLengthBeats: number
      loopRestartCount: number
      metronomeEnabled: boolean
      mutedClipCount: number
      mutedTrackCount: number
      audibleTrackCount: number
      soloTrackCount: number
      soloActive: boolean
      lockedTrackCount: number
      transposedTrackCount: number
      pannedTrackCount: number
      filteredTrackCount: number
      reverbEnabledTrackCount: number
      distortionEnabledTrackCount: number
      tremoloEnabledTrackCount: number
      firstTrackReverbMix: number | null
      firstTrackReverbDecay: number | null
      firstTrackTransposeSemitones: number | null
      firstTrackPan: number | null
      scheduledFrequencyPreviewHz: number[]
      selectedTrackId: string | null
      selectedClipId: string | null
      selectedClipTrackId: string | null
      selectedClipStartBeat: number | null
      selectedClipLengthBeats: number | null
      selectedClipWave: WaveType | null
      selectedClipNoteHz: number | null
      selectedClipTrackTransposeSemitones: number | null
      selectedClipScheduledFrequencyHz: number | null
      selectedClipCanDuplicate: boolean
      selectedClipDuplicateBlockedReason: 'none' | 'playing' | 'trackLocked' | 'noSpace' | 'noSelection'
      selectedClipCanSplit: boolean
      selectedClipSplitBlockedReason: 'none' | 'playing' | 'trackLocked' | 'clipTooShort' | 'noSelection'
      clipboardClipId: string | null
      clipboardSourceTrackId: string | null
    }
  }
}

function App() {
  const [project, setProject] = useState<ProjectState>(() => loadInitialProject())
  const [isPlaying, setIsPlaying] = useState(false)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [playheadBeat, setPlayheadBeat] = useState(0)
  const [masterVolume, setMasterVolume] = useState(() => {
    if (typeof window === 'undefined') return 0.8
    try {
      const stored = window.localStorage.getItem(MASTER_VOLUME_KEY)
      return stored !== null ? Number(stored) : 0.8
    } catch {
      return 0.8
    }
  })
  const [masterEQ, setMasterEQ] = useState(() => {
    if (typeof window === 'undefined') return { low: 0, mid: 0, high: 0 }
    try {
      const stored = window.localStorage.getItem(MASTER_EQ_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return { low: 0, mid: 0, high: 0 }
  })
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopLengthBeats, setLoopLengthBeats] = useState(8)
  const tapTempoRef = useRef<number[]>([])
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [selectedClipRef, setSelectedClipRef] = useState<{ trackId: string; clipId: string } | null>(null)
  const undoStackRef = useRef<ProjectState[]>([])
  const redoStackRef = useRef<ProjectState[]>([])
  const [clipboard, setClipboard] = useState<{ clip: Clip; sourceTrackId: string } | null>(null)
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
  const mutedClipCount = useMemo(() => project.tracks.reduce((sum, t) => sum + t.clips.filter((c) => c.muted).length, 0), [project.tracks])
  const mutedTrackCount = useMemo(() => project.tracks.filter((t) => t.muted).length, [project.tracks])
  const soloTrackCount = useMemo(() => project.tracks.filter((t) => t.solo).length, [project.tracks])
  const lockedTrackCount = useMemo(() => project.tracks.filter((t) => t.locked).length, [project.tracks])
  const transposedTrackCount = useMemo(
    () => project.tracks.filter((t) => t.transposeSemitones !== 0).length,
    [project.tracks],
  )
  const filteredTrackCount = useMemo(() => project.tracks.filter((t) => t.filterType !== 'none').length, [project.tracks])
  const distortionEnabledTrackCount = useMemo(() => project.tracks.filter((t) => t.distortionEnabled).length, [project.tracks])
  const tremoloEnabledTrackCount = useMemo(() => project.tracks.filter((t) => t.tremoloEnabled).length, [project.tracks])
  const reverbEnabledTrackCount = useMemo(() => project.tracks.filter((t) => t.reverbEnabled).length, [project.tracks])
  const pannedTrackCount = useMemo(
    () => project.tracks.filter((t) => Math.abs(t.pan) > 0.001).length,
    [project.tracks],
  )
  const soloActive = soloTrackCount > 0

  const selectedClipData = useMemo(() => {
    if (!selectedClipRef) return null
    const track = project.tracks.find((t) => t.id === selectedClipRef.trackId)
    if (!track) return null
    const clip = track.clips.find((c) => c.id === selectedClipRef.clipId)
    if (!clip) return null
    const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))
    const desiredStart = clip.startBeat + clip.lengthBeats
    const duplicateStartBeat = resolveNonOverlappingStart(track.clips, clip.lengthBeats, desiredStart, clip.id)
    const canDuplicate = !track.locked && !isPlaying && duplicateStartBeat + clip.lengthBeats <= TIMELINE_BEATS
    const canSplit = !track.locked && !isPlaying && clip.lengthBeats >= 2

    return {
      track,
      clip,
      scheduledFrequencyHz,
      duplicateStartBeat,
      canDuplicate,
      canSplit,
    }
  }, [project.tracks, selectedClipRef, isPlaying])

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVolume
    }
  }, [masterVolume, masterGainRef])

  useEffect(() => {
    try {
      window.localStorage.setItem(MASTER_VOLUME_KEY, String(masterVolume))
    } catch {
      // ignore
    }
  }, [masterVolume])
  useEffect(() => {
    try {
      window.localStorage.setItem(MASTER_EQ_KEY, JSON.stringify(masterEQ))
    } catch { /* ignore */ }
  }, [masterEQ])

  const ensureAudio = async () => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext()
      const masterGain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      masterGain.gain.value = masterVolume
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

  const handleTapTempo = () => {
    const now = performance.now()
    const taps = tapTempoRef.current
    // Remove taps older than 3 seconds
    while (taps.length > 0 && now - taps[0] > 3000) taps.shift()
    taps.push(now)

    if (taps.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1])
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const bpm = Math.round(60000 / avgInterval)
      if (bpm >= 60 && bpm <= 200) {
        setProject((prev) => ({ ...prev, bpm }))
      }
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

    
    if (metronomeEnabled) {
      for (let i = 0; i < loopBeats; i++) {
        const beatTime = startAt + i * beatDuration
        const clickOsc = ctx.createOscillator()
        const clickGain = ctx.createGain()

        clickOsc.type = 'square'
        clickOsc.frequency.value = i % 4 === 0 ? 880 : 440

        clickGain.gain.setValueAtTime(0, beatTime)
        clickGain.gain.linearRampToValueAtTime(0.3, beatTime + 0.005)
        clickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.05)

        clickOsc.connect(clickGain)
        clickGain.connect(master)

        clickOsc.start(beatTime)
        clickOsc.stop(beatTime + 0.05)

        scheduledNodesRef.current.push({ osc: clickOsc, gain: clickGain })
      }
    }

    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.startBeat >= loopBeats) return

        const clipOffsetSec = clip.startBeat * beatDuration
        const clipDurationSec = Math.min(loopDurationSec - clipOffsetSec, clip.lengthBeats * beatDuration)
        if (clipDurationSec <= 0) return

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const panner = ctx.createStereoPanner()
        const filter = ctx.createBiquadFilter()

        const clipStart = startAt + clipOffsetSec
        const clipEnd = clipStart + clipDurationSec

        osc.type = clip.wave
        const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))
        osc.frequency.value = scheduledFrequencyHz

        gain.gain.setValueAtTime(0.0001, clipStart)
        const isTrackAudible = !track.muted && (!soloActive || track.solo)
        const clipGain = clip.gain ?? 1.0
        const effectiveTrackVolume = isTrackAudible ? (track.volume * clipGain) : 0
        
        const fadeInSec = (clip.fadeIn || 0) * beatDuration
        const fadeOutSec = (clip.fadeOut || 0) * beatDuration
        const actualFadeIn = fadeInSec > 0 ? fadeInSec : 0.01;
        const actualFadeOut = fadeOutSec > 0 ? fadeOutSec : 0.02;

        gain.gain.linearRampToValueAtTime(effectiveTrackVolume * 0.15, Math.min(clipStart + actualFadeIn, clipEnd))
        gain.gain.setValueAtTime(effectiveTrackVolume * 0.15, Math.max(clipStart + actualFadeIn, clipEnd - actualFadeOut))
        gain.gain.linearRampToValueAtTime(0.0001, clipEnd)
        panner.pan.value = Math.max(-1, Math.min(1, track.pan))
        
        filter.type = track.filterType === 'highpass' ? 'highpass' : 'lowpass'
        filter.frequency.value = track.filterCutoff ?? 20000

        osc.connect(gain)
        gain.connect(panner)
        
        let trackOutput: AudioNode = panner;
        
        if (track.chorusEnabled) {
          const chorus = ctx.createDelay();
          chorus.delayTime.value = 0.03;
          
          const depth = ctx.createGain();
          depth.gain.value = track.chorusDepth ?? 0.5;
          
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = track.chorusRate ?? 1.5;
          
          lfo.connect(depth);
          depth.connect(chorus.delayTime);
          lfo.start(clipStart);
          lfo.stop(clipEnd);
          
          const dryGain = ctx.createGain();
          dryGain.gain.value = 1;
          const wetGain = ctx.createGain();
          wetGain.gain.value = 0.5;
          
          trackOutput.connect(dryGain);
          trackOutput.connect(chorus);
          chorus.connect(wetGain);
          
          const mix = ctx.createGain();
          dryGain.connect(mix);
          wetGain.connect(mix);
          
          trackOutput = mix;
        }

        if (track.compressorEnabled) {
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = track.compressorThreshold ?? -24;
          compressor.ratio.value = track.compressorRatio ?? 12;
          trackOutput.connect(compressor);
          trackOutput = compressor;
        }

        if (track.filterType && track.filterType !== 'none') {
          panner.connect(filter)
          trackOutput = filter;
        }
        
        
        
        if (track.eqEnabled) {
          const eqLow = ctx.createBiquadFilter()
          eqLow.type = 'lowshelf'
          eqLow.frequency.value = 250
          eqLow.gain.value = track.eqLow ?? 0

          const eqMid = ctx.createBiquadFilter()
          eqMid.type = 'peaking'
          eqMid.frequency.value = 1000
          eqMid.Q.value = 1
          eqMid.gain.value = track.eqMid ?? 0

          const eqHigh = ctx.createBiquadFilter()
          eqHigh.type = 'highshelf'
          eqHigh.frequency.value = 4000
          eqHigh.gain.value = track.eqHigh ?? 0

          trackOutput.connect(eqLow)
          eqLow.connect(eqMid)
          eqMid.connect(eqHigh)
          trackOutput = eqHigh
        }

        if (track.flangerEnabled) {
          const flangerDelay = ctx.createDelay(0.02)
          flangerDelay.delayTime.value = 0.005
          
          const flangerLfo = ctx.createOscillator()
          flangerLfo.type = 'sine'
          flangerLfo.frequency.value = track.flangerSpeed ?? 0.5
          
          const flangerDepthNode = ctx.createGain()
          flangerDepthNode.gain.value = track.flangerDepth ?? 0.002
          
          flangerLfo.connect(flangerDepthNode)
          flangerDepthNode.connect(flangerDelay.delayTime)
          flangerLfo.start(clipStart)
          flangerLfo.stop(clipEnd)
          
          const fbGain = ctx.createGain()
          fbGain.gain.value = track.flangerFeedback ?? 0.5
          
          trackOutput.connect(flangerDelay)
          flangerDelay.connect(fbGain)
          fbGain.connect(flangerDelay)
          
          const wetGain = ctx.createGain()
          wetGain.gain.value = 0.5
          const dryGain = ctx.createGain()
          dryGain.gain.value = 0.5
          
          trackOutput.connect(dryGain)
          flangerDelay.connect(wetGain)
          
          const mix = ctx.createGain()
          dryGain.connect(mix)
          wetGain.connect(mix)
          
          trackOutput = mix
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

        if (track.tremoloEnabled) {
          const tremoloGain = ctx.createGain();
          tremoloGain.gain.value = 1 - (track.tremoloDepth ?? 0.5) / 2;
          
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = track.tremoloRate ?? 5.0;
          
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = (track.tremoloDepth ?? 0.5) / 2;
          
          lfo.connect(lfoGain);
          lfoGain.connect(tremoloGain.gain);
          
          lfo.start(clipStart);
          lfo.stop(clipEnd);
          
          trackOutput.connect(tremoloGain);
          trackOutput = tremoloGain;
        }
        if (track.distortionEnabled) {
          const distortion = ctx.createWaveShaper()
          function makeDistortionCurve(amount = 50) {
            const k = typeof amount === 'number' ? amount : 50
            const n_samples = 44100
            const curve = new Float32Array(n_samples)
            const deg = Math.PI / 180
            for (let i = 0; i < n_samples; ++i) {
              const x = (i * 2) / n_samples - 1
              curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
            }
            return curve
          }
          distortion.curve = makeDistortionCurve(400)
          distortion.oversample = '4x'
          trackOutput.connect(distortion)
          trackOutput = distortion
        }
        if (track.reverbEnabled) {
          const convolver = ctx.createConvolver()
          const decay = Math.max(0.1, track.reverbDecay ?? 2)
          convolver.buffer = createReverbIR(ctx, decay)
          const wetGain = ctx.createGain()
          wetGain.gain.value = track.reverbMix ?? 0.3
          trackOutput.connect(convolver)
          convolver.connect(wetGain)
          wetGain.connect(master)
        }

        trackOutput.connect(master)

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
      trackNames: project.tracks.map((t) => t.name),
      clipCount: totalClipCount,
      firstTrackFirstClipStartBeat: project.tracks[0]?.clips[0]?.startBeat ?? null,
      firstTrackFirstClipLengthBeats: project.tracks[0]?.clips[0]?.lengthBeats ?? null,
      firstTrackFirstClipWave: project.tracks[0]?.clips[0]?.wave ?? null,
      firstTrackFirstClipGain: project.tracks[0]?.clips[0]?.gain ?? 1.0,
      playheadBeat,
      undoDepth: undoStackRef.current.length,
      redoDepth: redoStackRef.current.length,
      clipboardClipId: clipboard?.clip.id ?? null,
      clipboardSourceTrackId: clipboard?.sourceTrackId ?? null,
      masterLevel: masterLevelRef.current,
      masterVolume,
    masterEQ,
      audioContextState: audioCtxRef.current?.state ?? 'uninitialized',
      beatDurationSec: beatDuration,
      timelineDurationSec: totalDurationSec,
      loopEnabled,
      loopLengthBeats: effectiveTimelineBeats,
      loopRestartCount: loopRestartCountRef.current,
      metronomeEnabled,
      mutedClipCount,
      mutedTrackCount,
      audibleTrackCount: project.tracks.filter((t) => !t.muted && (!soloActive || t.solo)).length,
      soloTrackCount,
      soloActive,
      lockedTrackCount,
      transposedTrackCount,
      pannedTrackCount,
      filteredTrackCount,
      reverbEnabledTrackCount,
      distortionEnabledTrackCount,
      tremoloEnabledTrackCount,
      firstTrackReverbMix: project.tracks[0]?.reverbMix ?? null,
      firstTrackReverbDecay: project.tracks[0]?.reverbDecay ?? null,
      firstTrackTransposeSemitones: project.tracks[0]?.transposeSemitones ?? null,
      firstTrackPan: project.tracks[0]?.pan ?? null,
      scheduledFrequencyPreviewHz: [...scheduledFrequencyPreviewRef.current],
      selectedTrackId,
      selectedClipId: selectedClipData?.clip.id ?? null,
      selectedClipTrackId: selectedClipData?.track.id ?? null,
      selectedClipStartBeat: selectedClipData?.clip.startBeat ?? null,
      selectedClipLengthBeats: selectedClipData?.clip.lengthBeats ?? null,
      selectedClipWave: selectedClipData?.clip.wave ?? null,
      selectedClipNoteHz: selectedClipData?.clip.noteHz ?? null,
      selectedClipTrackTransposeSemitones: selectedClipData?.track.transposeSemitones ?? null,
      selectedClipScheduledFrequencyHz: selectedClipData?.scheduledFrequencyHz ?? null,
      selectedClipCanDuplicate: selectedClipData?.canDuplicate ?? false,
      selectedClipDuplicateBlockedReason: !selectedClipData
        ? 'noSelection'
        : isPlaying
          ? 'playing'
          : selectedClipData.track.locked
            ? 'trackLocked'
            : selectedClipData.canDuplicate
              ? 'none'
              : 'noSpace',
      selectedClipCanSplit: selectedClipData?.canSplit ?? false,
      selectedClipSplitBlockedReason: !selectedClipData
        ? 'noSelection'
        : isPlaying
          ? 'playing'
          : selectedClipData.track.locked
            ? 'trackLocked'
            : selectedClipData.canSplit
              ? 'none'
              : 'clipTooShort',
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
    lockedTrackCount,
    transposedTrackCount,
    pannedTrackCount,
    reverbEnabledTrackCount,
      distortionEnabledTrackCount,
    tremoloEnabledTrackCount,
    masterVolume,
      masterEQ,
    selectedTrackId,
    selectedClipData,
    clipboard,
    filteredTrackCount,
    metronomeEnabled,
    mutedClipCount,
  ])

  useEffect(() => {
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project))
    } catch {
      // ignore persistence errors
    }
  }, [project])

  useEffect(() => {
    if (!selectedClipRef) return
    const track = project.tracks.find((t) => t.id === selectedClipRef.trackId)
    const clipExists = !!track?.clips.some((c) => c.id === selectedClipRef.clipId)
    if (!clipExists) {
      setSelectedClipRef(null)
    }
  }, [project.tracks, selectedClipRef])

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
      if (!track || track.locked) return prev
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
      if (!track || track.locked) return prev
      if (track.clips.length <= 1) return prev

      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t,
        ),
      }
    })
  }

  const duplicateClip = (trackId: string, clipId: string) => {
    let duplicatedClipId: string | null = null

    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked) return prev

      const sourceClip = track.clips.find((c) => c.id === clipId)
      if (!sourceClip) return prev

      const desiredStart = sourceClip.startBeat + sourceClip.lengthBeats
      const nextStart = resolveNonOverlappingStart(track.clips, sourceClip.lengthBeats, desiredStart, clipId)
      const stillConflicts = track.clips.some(
        (c) => c.id !== clipId && rangesOverlap(nextStart, sourceClip.lengthBeats, c.startBeat, c.lengthBeats),
      )
      if (stillConflicts) return prev

      const nextId = `${sourceClip.id}-copy-${Date.now()}`
      duplicatedClipId = nextId

      return {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id !== trackId) return t
          return {
            ...t,
            clips: [
              ...t.clips,
              {
                ...sourceClip,
                id: nextId,
                startBeat: nextStart,
              },
            ],
          }
        }),
      }
    })

    if (duplicatedClipId) {
      setSelectedTrackId(trackId)
      setSelectedClipRef({ trackId, clipId: duplicatedClipId })
    }
  }

  const splitClip = (trackId: string, clipId: string) => {
    let rightClipId: string | null = null

    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked) return prev

      const sourceClip = track.clips.find((c) => c.id === clipId)
      if (!sourceClip || sourceClip.lengthBeats < 2) return prev

      const leftLength = Math.max(1, Math.floor(sourceClip.lengthBeats / 2))
      const rightLength = sourceClip.lengthBeats - leftLength
      if (rightLength < 1) return prev

      const rightStart = sourceClip.startBeat + leftLength
      const newRightId = `${sourceClip.id}-split-${Date.now()}`
      rightClipId = newRightId

      return {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id !== trackId) return t
          return {
            ...t,
            clips: t.clips.flatMap((c) => {
              if (c.id !== clipId) return [c]
              return [
                { ...c, lengthBeats: leftLength },
                {
                  ...c,
                  id: newRightId,
                  startBeat: rightStart,
                  lengthBeats: rightLength,
                },
              ]
            }),
          }
        }),
      }
    })

    if (rightClipId) {
      setSelectedTrackId(trackId)
      setSelectedClipRef({ trackId, clipId: rightClipId })
    }
  }


  const deleteClip = (trackId: string, clipId: string) => {
    if (isPlaying) return
    applyProjectUpdate((prev) => {
      return {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id === trackId && !t.locked) {
            return {
              ...t,
              clips: t.clips.filter((c) => c.id !== clipId),
            }
          }
          return t
        }),
      }
    })
    setSelectedClipRef(null)
  }

  const copyClip = (trackId: string, clipId: string) => {
    const track = project.tracks.find((t) => t.id === trackId)
    if (!track) return
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) return
    setClipboard({ clip: { ...clip }, sourceTrackId: trackId })
  }

  const pasteClip = (trackId: string) => {
    if (!clipboard) return
    const { clip: sourceClip } = clipboard
    const targetTrack = project.tracks.find((t) => t.id === trackId)
    if (!targetTrack || targetTrack.locked) return

    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked) return prev

      const newClip: Clip = {
        ...sourceClip,
        id: `${trackId}-paste-${Date.now()}`,
        startBeat: resolveNonOverlappingStart(track.clips, sourceClip.lengthBeats, sourceClip.startBeat),
      }

      // Check if resolved position conflicts (no space)
      const stillConflicts = track.clips.some((c) =>
        rangesOverlap(newClip.startBeat, newClip.lengthBeats, c.startBeat, c.lengthBeats),
      )
      if (stillConflicts) return prev

      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t,
        ),
      }
    })
  }

  const cycleClipWave = (trackId: string, clipId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
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

  const setTrackPan = (trackId: string, pan: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              pan: Math.max(-1, Math.min(1, pan)),
            }
          : t,
      ),
    }))
  }

  const toggleClipMute = (trackId: string, clipId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, muted: !c.muted } : c)),
            }
          : t,
      ),
    }))
  }

  
  const setTrackColor = (trackId: string, color: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, color } : t)),
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

  const toggleTrackLock = (trackId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)),
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

  const setTrackFilterType = (trackId: string, filterType: 'none' | 'lowpass' | 'highpass') => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, filterType } : t
      ),
    }))
  }

  const setTrackFilterCutoff = (trackId: string, filterCutoff: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, filterCutoff: Math.max(20, Math.min(20000, filterCutoff)) } : t
      ),
    }))
  }

  const renameTrack = (trackId: string, name: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              name,
            }
          : t,
      ),
    }))
  }

  const addTrack = () => {
    applyProjectUpdate((prev) => {
      const newTrackId = `track-${Date.now()}`
      return {
        ...prev,
        tracks: [
          ...prev.tracks,
          {
            id: newTrackId,
            name: `Track ${prev.tracks.length + 1}`,
            volume: 0.7,
            pan: 0,
            muted: false,
            solo: false,
            locked: false,
            transposeSemitones: 0,
            filterType: 'none',
            filterCutoff: 20000,
            reverbEnabled: false,
      distortionEnabled: false,
            reverbMix: 0.3,
            reverbDecay: 2,
            clips: [],
          },
        ],
      }
    })
  }

  const deleteTrack = (trackId: string) => {
    applyProjectUpdate((prev) => {
      if (prev.tracks.length <= 1) return prev
      return {
        ...prev,
        tracks: prev.tracks.filter((t) => t.id !== trackId),
      }
    })
    if (selectedTrackId === trackId) {
      setSelectedTrackId(null)
    }
  }

  const moveTrack = (trackId: string, direction: 'up' | 'down') => {
    applyProjectUpdate((prev) => {
      const idx = prev.tracks.findIndex(t => t.id === trackId)
      if (idx === -1) return prev
      if (direction === 'up' && idx === 0) return prev
      if (direction === 'down' && idx === prev.tracks.length - 1) return prev

      const newTracks = [...prev.tracks]
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      const temp = newTracks[idx]
      newTracks[idx] = newTracks[targetIdx]
      newTracks[targetIdx] = temp

      return { ...prev, tracks: newTracks }
    })
  }

  const duplicateTrack = (trackId: string) => {
    applyProjectUpdate((prev) => {
      const trackIndex = prev.tracks.findIndex(t => t.id === trackId)
      if (trackIndex === -1) return prev
      const sourceTrack = prev.tracks[trackIndex]
      const newTrackId = `track-${Date.now()}`
      
      const newTrack = {
        ...sourceTrack,
        id: newTrackId,
        name: `${sourceTrack.name} (Copy)`,
        clips: sourceTrack.clips.map((c, i) => ({
          ...c,
          id: `${newTrackId}-clip-${Date.now()}-${i}`
        }))
      }
      
      const newTracks = [...prev.tracks]
      newTracks.splice(trackIndex + 1, 0, newTrack)
      
      return {
        ...prev,
        tracks: newTracks
      }
    })
  }

  
  const setSelectedClipWave = (trackId: string, clipId: string, wave: WaveType) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, wave } : c
          ),
        }
      }),
    }))
  }

  const setSelectedClipNote = (trackId: string, clipId: string, noteHz: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  noteHz: Math.max(55, Math.min(1760, noteHz)),
                }
              : c,
          ),
        }
      }),
    }))
  }

  const updateClipStartBeat = (trackId: string, clipId: string, startBeat: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
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

  const setClipColor = (trackId: string, clipId: string, color: string) => {
    if (isPlaying) return
    setProject((prev) => {
      undoStackRef.current.push(structuredClone(prev))
      if (undoStackRef.current.length > 100) undoStackRef.current.shift()
      redoStackRef.current = []
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                clips: t.clips.map((c) => (c.id === clipId ? { ...c, color } : c)),
              }
            : t,
        ),
      }
    })
  }

  const setClipName = (trackId: string, clipId: string, name: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, name } : c)),
            }
          : t,
      ),
    }))
  }

  const updateClipGain = (trackId: string, clipId: string, gain: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, gain } : c
          ),
        }
      }),
    }))
  }

    const updateClipFades = (trackId: string, clipId: string, fadeIn: number, fadeOut: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, fadeIn, fadeOut } : c
          ),
        }
      }),
    }))
  }

  const updateClipTranspose = (trackId: string, clipId: string, transposeSemitones: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, transposeSemitones } : c
          ),
        }
      }),
    }))
  }

  const updateClipLengthBeats = (trackId: string, clipId: string, lengthBeats: number) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
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

  // MIDI import functionality
  const handleMIDIImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const midiData = e.target?.result as ArrayBuffer
        if (!midiData) return

        // Import MIDI file and convert to clips
        applyProjectUpdate((prev) => {
          const newTracks = prev.tracks.map((track, index) => {
            // Parse MIDI header to extract note events
            const midiBytes = new Uint8Array(midiData)
            const midiClips: { time: number; duration: number; noteNumber: number }[] = []

            // Simple MIDI parser: find Note On/Off events in first track
            let i = 22 // Skip header
            const dataLength = midiBytes.length
            while (i < dataLength - 2) {
              // Look for Note On (0x90-0x9F) and Note Off (0x80-0x8F)
              if (midiBytes[i] >= 0x90 && midiBytes[i] <= 0x9F && i + 2 < dataLength) {
                const noteNum = midiBytes[i + 1]
                // Find corresponding Note Off
                let j = i + 3
                while (j < dataLength - 2) {
                  if ((midiBytes[j] === 0x80 || midiBytes[j] === midiBytes[i]) && midiBytes[j + 1] === noteNum) {
                    midiClips.push({ time: i - 22, duration: j - i, noteNumber: noteNum })
                    break
                  }
                  j++
                }
              }
              i++
            }

            return {
              ...track,
              clips: [
                ...track.clips,
                ...midiClips.slice(index, index + 1).map((midiEvent, clipIndex) => ({
                  id: `midi-import-${track.id}-${Date.now()}-${clipIndex}`,
                  startBeat: Math.min(TIMELINE_BEATS - 1, Math.max(0, Math.round(midiEvent.noteNumber / 10))),
                  lengthBeats: Math.max(1, Math.min(TIMELINE_BEATS, Math.ceil(midiEvent.duration / 3))),
                  noteHz: midiNoteToFrequency(midiEvent.noteNumber),
                  wave: (index % 2 === 0 ? 'sine' : 'square') as WaveType,
                })),
              ],
            }
          })

          return {
            ...prev,
            tracks: newTracks,
          }
        })

        // Reset file input
        event.target.value = ''
      } catch (error) {
        console.error('Failed to import MIDI file:', error)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleMIDIExport = () => {
    try {
      const midiData = buildMIDIFromProject(project.tracks, project.bpm)
      const blob = new Blob([midiData], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `project-${Date.now()}.mid`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export MIDI file:', error)
    }
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
    const isLocked = project.tracks.find((t) => t.id === trackId)?.locked
    if (isLocked) return

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
    const isLocked = project.tracks.find((t) => t.id === trackId)?.locked
    if (isLocked) return
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
        return
      }

      if (event.key.toLowerCase() === 'c' && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        if (selectedClipRef) {
          event.preventDefault()
          copyClip(selectedClipRef.trackId, selectedClipRef.clipId)
        }
        return
      }

      if (event.key.toLowerCase() === 'v' && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        if (selectedTrackId) {
          event.preventDefault()
          pasteClip(selectedTrackId)
        }
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (selectedClipRef) {
          const track = project.tracks.find((t) => t.id === selectedClipRef.trackId)
          if (track && !track.locked && !isPlaying) {
            event.preventDefault()
            deleteClip(selectedClipRef.trackId, selectedClipRef.clipId)
          }
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlaying, project, copyClip, deleteClip, pasteClip, pausePlayback, redo, selectedClipRef, selectedTrackId, startPlayback, stopPlayback, undo])

  return (
    <div className="app">
      <h1>Music DAW Case (Harness MVP)</h1>

      <section className="transport" data-testid="transport">
        <button data-testid="play-btn" onClick={startPlayback} disabled={isPlaying}>Play</button>
        <button data-testid="pause-btn" onClick={pausePlayback} disabled={!isPlaying}>Pause</button>
        <button data-testid="stop-btn" onClick={stopPlayback}>Stop</button>
        <button data-testid="metronome-btn" onClick={() => setMetronomeEnabled(v => !v)} aria-pressed={metronomeEnabled}>{metronomeEnabled ? 'Metronome: ON' : 'Metronome: OFF'}</button>
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
          Import MIDI
          <input
            data-testid="midi-import-input"
            type="file"
            accept=".mid,.midi"
            onChange={handleMIDIImport}
            disabled={isPlaying}
            style={{ display: 'none' }}
          />
          <button
            data-testid="midi-import-btn"
            onClick={() => {
              document.querySelector<HTMLInputElement>('[data-testid="midi-import-input"]')?.click()
            }}
            disabled={isPlaying}
          >
            Import MIDI
          </button>
        </label>

        <button
          data-testid="midi-export-btn"
          onClick={handleMIDIExport}
          disabled={isPlaying}
        >
          Export MIDI
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

        <label>
          Master Vol
          <input
            data-testid="master-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
          />
          <span className="master-volume-value">{(masterVolume * 100).toFixed(0)}%</span>
        </label>

        <button
          data-testid="tap-tempo-btn"
          onClick={handleTapTempo}
          disabled={isPlaying}
        >
          Tap Tempo
        </button>
      </section>

      <section className="meter">
        <div className="master-eq-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>Master EQ:</span>
          <label>L: 
            <input type="range" min="-12" max="12" value={masterEQ.low} onChange={e => setMasterEQ((prev: { low: number; mid: number; high: number }) => ({...prev, low: Number(e.target.value)}))} data-testid="master-eq-low" />
          </label>
          <label>M: 
            <input type="range" min="-12" max="12" value={masterEQ.mid} onChange={e => setMasterEQ((prev: { low: number; mid: number; high: number }) => ({...prev, mid: Number(e.target.value)}))} data-testid="master-eq-mid" />
          </label>
          <label>H: 
            <input type="range" min="-12" max="12" value={masterEQ.high} onChange={e => setMasterEQ((prev: { low: number; mid: number; high: number }) => ({...prev, high: Number(e.target.value)}))} data-testid="master-eq-high" />
          </label>
        </div>
        <div className="meter-label">Master Output Meter</div>
        <canvas ref={meterCanvasRef} width={320} height={16} />
      </section>

      <section className="inspector" data-testid="inspector-panel">
        <div className="inspector-title">Inspector</div>
        {selectedTrackId ? (
          <div className="inspector-group" data-testid="inspector-track">
            <div className="inspector-subtitle">Track</div>
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

                        <div className="inspector-row" style={{ marginTop: '12px', gap: '8px', display: 'flex' }}>
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
          </div>
        ) : (
          <div className="inspector-empty" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}

        {selectedClipData ? (
          <div className="inspector-group" data-testid="inspector-clip">
            <div className="inspector-subtitle">Clip</div>
            <div className="inspector-row">
              
            <div className="inspector-row">
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
            <div className="inspector-meta" data-testid="selected-clip-duplicate-target-beat">
              Duplicate target beat: {selectedClipData.duplicateStartBeat}
            </div>
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
        ) : (
          <div className="inspector-empty" data-testid="inspector-clip-empty">Select a clip to edit note pitch.</div>
        )}
      </section>

      <section className="timeline">
        {project.tracks.map((track) => (
          <div className="track-row" key={track.id}>
            <div
              className={`track-header ${selectedTrackId === track.id ? 'selected' : ''}`}
              data-testid={`track-header-${track.id}`}
              onClick={() => setSelectedTrackId(track.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedTrackId(track.id)
                }
              }}
              aria-label={`Select ${track.name} track`}
            >
              <div className="track-name" style={{ color: track.color || "#e2e8f0" }}>{track.name}</div>
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
                Pan
                <input
                  data-testid={`pan-${track.id}`}
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={track.pan}
                  onChange={(e) => setTrackPan(track.id, Number(e.target.value))}
                  disabled={isPlaying}
                />
                <span className="pan-value">{track.pan.toFixed(2)}</span>
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
              <details className="track-effects-details" style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#a0aec0' }}>Effects & Filters</summary>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginTop: '4px' }}>
              <label>
                Filter
                <div className="track-chorus-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                    <input
                      type="checkbox"
                      data-testid={`chorus-enabled-${track.id}`}
                      checked={!!track.chorusEnabled}
                      onChange={(e) => {
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, chorusEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Chorus
                  </label>
                  
                  {track.chorusEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                        Rate
                        <input
                          type="range"
                          data-testid={`chorus-rate-${track.id}`}
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={track.chorusRate ?? 1.5}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, chorusRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                        Depth
                        <input
                          type="range"
                          data-testid={`chorus-depth-${track.id}`}
                          min="0.1"
                          max="5"
                          step="0.1"
                          value={track.chorusDepth ?? 0.5}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, chorusDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="track-tremolo-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                    <input
                      type="checkbox"
                      data-testid={`tremolo-enabled-${track.id}`}
                      checked={!!track.tremoloEnabled}
                      onChange={(e) => {
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, tremoloEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Tremolo
                  </label>
                  
                  {track.tremoloEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                        Rate
                        <input
                          type="range"
                          data-testid={`tremolo-rate-${track.id}`}
                          min="0.1"
                          max="20"
                          step="0.1"
                          value={track.tremoloRate ?? 5.0}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, tremoloRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
                        Depth
                        <input
                          type="range"
                          data-testid={`tremolo-depth-${track.id}`}
                          min="0"
                          max="1"
                          step="0.05"
                          value={track.tremoloDepth ?? 0.5}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, tremoloDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="track-effects-details" style={{ display: selectedTrackId === track.id ? "block" : "none" }}>
                <div className="track-compressor-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      data-testid={`compressor-enabled-${track.id}`}
                      checked={!!track.compressorEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, compressorEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                      style={{ margin: 0, marginRight: '4px' }}
                    />
                    Comp
                  </label>
                  {track.compressorEnabled && (
                    <>
                      <input
                        type="range"
                        min="-100"
                        max="0"
                        step="1"
                        data-testid={`compressor-threshold-${track.id}`}
                        value={track.compressorThreshold ?? -24}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, compressorThreshold: val } : t
                            ),
                          }))
                        }}
                        style={{ width: '40px' }}
                      />
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.1"
                        data-testid={`compressor-ratio-${track.id}`}
                        value={track.compressorRatio ?? 12}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, compressorRatio: val } : t
                            ),
                          }))
                        }}
                        style={{ width: '40px' }}
                      />
                    </>
                  )}
                </div>
                
                
                <div className="track-eq-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      data-testid={`eq-enable-${track.id}`}
                      checked={!!track.eqEnabled}
                      onChange={(e) => setProject(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t =>
                            t.id === track.id ? { ...t, eqEnabled: e.target.checked } : t
                        )
                      }))}
                    />
                    EQ3
                  </label>
                  {track.eqEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Low:
                        <input
                          type="range"
                          data-testid={`eq-low-${track.id}`}
                          min="-24" max="24" step="1"
                          value={track.eqLow ?? 0}
                          onChange={(e) => setProject(prev => ({
                            ...prev,
                            tracks: prev.tracks.map(t =>
                                t.id === track.id ? { ...t, eqLow: parseFloat(e.target.value) } : t
                            )
                          }))}
                          style={{ width: '40px' }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Mid:
                        <input
                          type="range"
                          data-testid={`eq-mid-${track.id}`}
                          min="-24" max="24" step="1"
                          value={track.eqMid ?? 0}
                          onChange={(e) => setProject(prev => ({
                            ...prev,
                            tracks: prev.tracks.map(t =>
                                t.id === track.id ? { ...t, eqMid: parseFloat(e.target.value) } : t
                            )
                          }))}
                          style={{ width: '40px' }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        High:
                        <input
                          type="range"
                          data-testid={`eq-high-${track.id}`}
                          min="-24" max="24" step="1"
                          value={track.eqHigh ?? 0}
                          onChange={(e) => setProject(prev => ({
                            ...prev,
                            tracks: prev.tracks.map(t =>
                                t.id === track.id ? { ...t, eqHigh: parseFloat(e.target.value) } : t
                            )
                          }))}
                          style={{ width: '40px' }}
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="track-flanger-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      data-testid={`flanger-enable-${track.id}`}
                      checked={!!track.flangerEnabled}
                      onChange={(e) => setProject(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t =>
                            t.id === track.id ? { ...t, flangerEnabled: e.target.checked } : t
                        )
                      }))}
                    />
                    Flanger
                  </label>
                  {track.flangerEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Spd:
                        <input
                          type="range"
                          min="0.1" max="5.0" step="0.1"
                          data-testid={`flanger-speed-${track.id}`}
                          value={track.flangerSpeed ?? 0.5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProject(prev => ({
                              ...prev,
                              tracks: prev.tracks.map(t =>
                                t.id === track.id ? { ...t, flangerSpeed: val } : t
                              )
                            }))
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Dep:
                        <input
                          type="range"
                          min="0.001" max="0.01" step="0.001"
                          data-testid={`flanger-depth-${track.id}`}
                          value={track.flangerDepth ?? 0.002}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProject(prev => ({
                              ...prev,
                              tracks: prev.tracks.map(t =>
                                t.id === track.id ? { ...t, flangerDepth: val } : t
                              )
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="track-delay-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      data-testid={`delay-enable-${track.id}`}
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
                        data-testid={`delay-time-${track.id}`}
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
                        data-testid={`delay-fb-${track.id}`}
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
                
                <div className="track-tremolo-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af' }}>
                    <input
                      type="checkbox"
                      data-testid={`tremolo-enabled-${track.id}`}
                      checked={!!track.tremoloEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, tremoloEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                    />
                    Tremolo
                  </label>
                  
                  {track.tremoloEnabled && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                        Rate
                        <input
                          type="range"
                          data-testid={`tremolo-rate-${track.id}`}
                          min="0.1"
                          max="20"
                          step="0.1"
                          value={track.tremoloRate ?? 5.0}
                          disabled={isPlaying}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, tremoloRate: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
                        Depth
                        <input
                          type="range"
                          data-testid={`tremolo-depth-${track.id}`}
                          min="0"
                          max="1"
                          step="0.05"
                          value={track.tremoloDepth ?? 0.5}
                          disabled={isPlaying}
                          style={{ width: '40px' }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                                t.id === track.id ? { ...t, tremoloDepth: val } : t
                              ),
                            }))
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

<div className="track-reverb-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      data-testid={`reverb-enable-${track.id}`}
                      checked={!!track.reverbEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, reverbEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                      style={{ margin: 0, marginRight: '4px' }}
                    />
                    Reverb
                  </label>
                  {track.reverbEnabled && (
                    <>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        data-testid={`reverb-mix-${track.id}`}
                        value={track.reverbMix ?? 0.3}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, reverbMix: val } : t
                            ),
                          }))
                        }}
                        style={{ width: '40px' }}
                      />
                      <input
                        type="range"
                        min="0.1"
                        max="5"
                        step="0.1"
                        data-testid={`reverb-decay-${track.id}`}
                        value={track.reverbDecay ?? 2}
                        disabled={isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, reverbDecay: val } : t
                            ),
                          }))
                        }}
                        style={{ width: '40px' }}
                      />
                    </>
                  )}
                </div>
                <div className="track-distortion-controls" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      data-testid={`track-distortion-toggle-${track.id}`}
                      checked={!!track.distortionEnabled}
                      disabled={isPlaying}
                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, distortionEnabled: e.target.checked } : t
                          ),
                        }))
                      }}
                      style={{ margin: 0, marginRight: '4px' }}
                    />
                    Distortion
                  </label>
                </div>

                <select
                  data-testid={`filter-type-${track.id}`}
                  value={track.filterType}
                  onChange={(e) => setTrackFilterType(track.id, e.target.value as 'none' | 'lowpass' | 'highpass')}
                  disabled={isPlaying}
                >
                  <option value="none">None</option>
                  <option value="lowpass">LPF</option>
                  <option value="highpass">HPF</option>
                </select>
                {track.filterType !== 'none' && (
                  <input
                    data-testid={`filter-cutoff-${track.id}`}
                    type="range"
                    min={20}
                    max={20000}
                    step={1}
                    value={track.filterCutoff}
                    onChange={(e) => setTrackFilterCutoff(track.id, Number(e.target.value))}
                    disabled={isPlaying}
                  />
                )}
                            </div>
              </label>
              </div>
              </details>
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
              <button
                data-testid={`lock-${track.id}`}
                onClick={() => toggleTrackLock(track.id)}
                disabled={isPlaying}
                aria-pressed={track.locked}
              >
                {track.locked ? 'Unlock' : 'Lock'}
              </button>
              <button
                data-testid={`add-clip-${track.id}`}
                onClick={() => addClip(track.id)}
                disabled={isPlaying || track.locked}
              >
                + Clip
              </button>
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
                  className={`clip ${clip.wave} ${track.locked ? 'locked' : ''} ${clip.muted ? 'muted' : ''} ${selectedClipRef?.clipId === clip.id && selectedClipRef.trackId === track.id ? 'selected' : ''}`}
                  style={{
                    left: `${(clip.startBeat / TIMELINE_BEATS) * 100}%`,
                    width: `${(clip.lengthBeats / TIMELINE_BEATS) * 100}%`,
                  }}
                  title={`${clip.wave} ${clip.noteHz.toFixed(2)}Hz @ beat ${clip.startBeat}${track.locked ? '（轨道已锁定）' : '（双击切换波形，Alt+双击删除）'}`}
                  onMouseDown={(e) => {
                    setSelectedTrackId(track.id)
                    setSelectedClipRef({ trackId: track.id, clipId: clip.id })
                    startClipDrag(e, track.id, clip.id, clip.startBeat, clip.lengthBeats)
                  }}
                  onClick={() => {
                    setSelectedTrackId(track.id)
                    setSelectedClipRef({ trackId: track.id, clipId: clip.id })
                  }}
                  onDoubleClick={(e) => {
                    if (isPlaying || track.locked) return
                    if (e.altKey) {
                      removeClip(track.id, clip.id)
                      return
                    }
                    if (e.metaKey || e.ctrlKey) {
                      splitClip(track.id, clip.id)
                      return
                    }
                    if (e.shiftKey) {
                      duplicateClip(track.id, clip.id)
                      return
                    }
                    cycleClipWave(track.id, clip.id)
                  }}
                >
                  <span className="clip-label">
                    {clip.name ? clip.name : `${clip.wave} ${Math.round(clip.noteHz)}Hz · ${clip.lengthBeats} beat${clip.lengthBeats > 1 ? 's' : ''}`}
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
        <div className="add-track-row">
          <button
            data-testid="add-track-btn"
            onClick={addTrack}
            disabled={isPlaying}
            className="add-track-btn"
          >
            + Add Track
          </button>
        </div>
      </section>

      <p className="hint">双击 clip 切换波形；Shift+双击或 Inspector 内 Duplicate Clip 可复制；⌘/Ctrl+双击或 Inspector 内 Split Clip 可对半切分；Alt+双击删除；⌘/Ctrl+C 复制选中 clip，⌘/Ctrl+V 粘贴到选中轨道；Lock 可冻结轨道编辑。播放时禁用新增 clip 与 BPM 修改。快捷键：Space 播放/暂停，S 停止，⌘/Ctrl+Z 撤销，⌘/Ctrl+Shift+Z 重做。</p>
    </div>
  )
}

export default App
