import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { Clip, MasterEQ, ProjectState, Track, WaveType } from '../types'
import { useDAWStore } from '../store/useDAWStore'
import { audioEngine } from '../audio/AudioEngine'

export const TIMELINE_BEATS = 16

export function semitoneToRatio(semitones: number) {
  return 2 ** (semitones / 12)
}

function rangesOverlap(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen
  const bEnd = bStart + bLen
  return aStart < bEnd && bStart < aEnd
}

export function resolveNonOverlappingStart(
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

// MIDI utilities
function midiNoteToFrequency(noteNumber: number): number {
  return 440 * Math.pow(2, (noteNumber - 69) / 12)
}

function frequencyToMIDINote(frequency: number): number {
  return Math.round(12 * Math.log2(frequency / 440) + 69)
}

function buildMIDIHeader(bpm: number): ArrayBuffer {
  const midiHeader = new ArrayBuffer(14)
  const headerView = new DataView(midiHeader)
  headerView.setUint8(0, 0x4D)
  headerView.setUint8(1, 0x54)
  headerView.setUint8(2, 0x68)
  headerView.setUint8(3, 0x64)
  headerView.setUint32(4, 6, false)
  headerView.setUint16(8, 0, false)
  headerView.setUint16(10, 1, false)
  headerView.setUint16(12, Math.round((60 / bpm) * 500000), false)
  return midiHeader
}

function buildMIDITrack(clips: Clip[], bpm: number): ArrayBuffer {
  const ticksPerBeat = Math.round((60 / bpm) * 500000)
  const events: Uint8Array[] = []
  events.push(new Uint8Array([0x00, 0xC0, 0x00]))

  for (const clip of clips) {
    const startTick = Math.round(clip.startBeat * ticksPerBeat)
    const endTick = Math.round((clip.startBeat + clip.lengthBeats) * ticksPerBeat)
    const noteNumber = frequencyToMIDINote(clip.noteHz)

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

    events.push(new Uint8Array([...encodeVLQ(startTick), 0x90, noteNumber, 0x60]))
    events.push(new Uint8Array([...encodeVLQ(endTick - startTick), 0x80, noteNumber, 0x00]))
  }

  events.push(new Uint8Array([0x00, 0xFF, 0x2F, 0x00]))

  const trackDataLength = events.reduce((sum, e) => sum + e.length, 0)
  const trackHeader = new Uint8Array([
    0x4D, 0x54, 0x72, 0x6B,
    (trackDataLength >> 24) & 0xFF,
    (trackDataLength >> 16) & 0xFF,
    (trackDataLength >> 8) & 0xFF,
    trackDataLength & 0xFF,
  ])

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
  const allClips = tracks.flatMap((track, index) =>
    track.clips.map((clip) => ({
      ...clip,
      startBeat: clip.startBeat + index * TIMELINE_BEATS,
    })),
  )

  const header = buildMIDIHeader(bpm)
  const trackData = buildMIDITrack(allClips, bpm)

  const result = new Uint8Array(header.byteLength + trackData.byteLength)
  result.set(new Uint8Array(header), 0)
  result.set(new Uint8Array(trackData), header.byteLength)

  return result.buffer
}

// Window debug type
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

export interface DAWActions {
  // State
  project: ProjectState
  isPlaying: boolean
  metronomeEnabled: boolean
  playheadBeat: number
  masterVolume: number
  masterEQ: MasterEQ
  loopEnabled: boolean
  loopLengthBeats: number
  selectedTrackId: string | null
  selectedClipRef: { trackId: string; clipId: string } | null
  selectedClipRefs: { trackId: string; clipId: string }[]
  clipboard: { clip: Clip; sourceTrackId: string } | null
  undoDepth: number
  redoDepth: number
  beatDuration: number
  effectiveTimelineBeats: number
  totalDurationSec: number
  totalClipCount: number
  mutedClipCount: number
  mutedTrackCount: number
  soloTrackCount: number
  soloActive: boolean
  lockedTrackCount: number
  transposedTrackCount: number
  filteredTrackCount: number
  distortionEnabledTrackCount: number
  tremoloEnabledTrackCount: number
  reverbEnabledTrackCount: number
  pannedTrackCount: number
  selectedClipData: {
    track: Track
    clip: Clip
    scheduledFrequencyHz: number
    duplicateStartBeat: number
    canDuplicate: boolean
    canSplit: boolean
  } | null
  // Refs
  meterCanvasRef: React.RefObject<HTMLCanvasElement | null>
  timelineRef: React.RefObject<HTMLDivElement | null>
  // Setters
  setProject: (value: ProjectState | ((prev: ProjectState) => ProjectState), options?: { saveHistory?: boolean }) => void
  setIsPlaying: (value: boolean) => void
  setMetronomeEnabled: (value: boolean | ((prev: boolean) => boolean)) => void
  setPlayheadBeat: (value: number) => void
  setMasterVolume: (value: number) => void
  setMasterEQ: (value: MasterEQ | ((prev: MasterEQ) => MasterEQ)) => void
  setLoopEnabled: (value: boolean) => void
  setLoopLengthBeats: (value: number) => void
  setSelectedTrackId: (value: string | null) => void
  setSelectedClipRef: (value: { trackId: string; clipId: string } | null) => void
  setSelectedClipRefs: (value: { trackId: string; clipId: string }[]) => void
  addSelectedClipRef: (value: { trackId: string; clipId: string }) => void
  removeSelectedClipRef: (value: { trackId: string; clipId: string }) => void
  setClipboard: (value: { clip: Clip; sourceTrackId: string } | null) => void
  // Actions
  applyProjectUpdate: (updater: (prev: ProjectState) => ProjectState) => void
  addClip: (trackId: string) => void
  addClipAtBeat: (trackId: string, beat: number) => void
  removeClip: (trackId: string, clipId: string) => void
  duplicateClip: (trackId: string, clipId: string) => void
  splitClip: (trackId: string, clipId: string) => void
  deleteClip: (trackId: string, clipId: string) => void
  copyClip: (trackId: string, clipId: string) => void
  pasteClip: (trackId: string) => void
  cutClip: (trackId: string, clipId: string) => void
  cycleClipWave: (trackId: string, clipId: string) => void
  setTrackVolume: (trackId: string, volume: number) => void
  setTrackPan: (trackId: string, pan: number) => void
  toggleClipMute: (trackId: string, clipId: string) => void
  setTrackColor: (trackId: string, color: string) => void
  toggleTrackMute: (trackId: string) => void
  toggleTrackSolo: (trackId: string) => void
  toggleTrackLock: (trackId: string) => void
  setTrackTranspose: (trackId: string, transposeSemitones: number) => void
  setTrackFilterType: (trackId: string, filterType: 'none' | 'lowpass' | 'highpass') => void
  setTrackFilterCutoff: (trackId: string, filterCutoff: number) => void
  renameTrack: (trackId: string, name: string) => void
  addTrack: () => void
  deleteTrack: (trackId: string) => void
  moveTrack: (trackId: string, direction: 'up' | 'down') => void
  duplicateTrack: (trackId: string) => void
  setSelectedClipWave: (trackId: string, clipId: string, wave: WaveType) => void
  setSelectedClipNote: (trackId: string, clipId: string, noteHz: number) => void
  updateClipStartBeat: (trackId: string, clipId: string, startBeat: number) => void
  setClipColor: (trackId: string, clipId: string, color: string) => void
  setClipName: (trackId: string, clipId: string, name: string) => void
  updateClipGain: (trackId: string, clipId: string, gain: number) => void
  updateClipFades: (trackId: string, clipId: string, fadeIn: number, fadeOut: number) => void
  updateClipTranspose: (trackId: string, clipId: string, transposeSemitones: number) => void
  updateClipLengthBeats: (trackId: string, clipId: string, lengthBeats: number) => void
  handleMIDIImport: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleMIDIExport: () => void
  handleTapTempo: () => void
  startPlayback: () => void
  pausePlayback: () => void
  stopPlayback: () => void
  undo: () => void
  redo: () => void
  resetProjectState: () => void
  clearHistory: () => void
  previewClip: (clip: Clip, track: Track) => void
  startClipDrag: (
    e: ReactMouseEvent<HTMLButtonElement>,
    trackId: string,
    clipId: string,
    originStartBeat: number,
    lengthBeats: number,
  ) => void
  startClipResize: (
    e: ReactMouseEvent<HTMLSpanElement>,
    trackId: string,
    clipId: string,
    originStartBeat: number,
    originLengthBeats: number,
  ) => void
  startPlayheadDrag: (e: React.MouseEvent) => void
}

export function useDAWActions(): DAWActions {
  const project = useDAWStore((state) => state.project)
  const isPlaying = useDAWStore((state) => state.isPlaying)
  const metronomeEnabled = useDAWStore((state) => state.metronomeEnabled)
  const playheadBeat = useDAWStore((state) => state.playheadBeat)
  const masterVolume = useDAWStore((state) => state.masterVolume)
  const masterEQ = useDAWStore((state) => state.masterEQ)
  const loopEnabled = useDAWStore((state) => state.loopEnabled)
  const loopLengthBeats = useDAWStore((state) => state.loopLengthBeats)
  const selectedTrackId = useDAWStore((state) => state.selectedTrackId)
  const selectedClipRef = useDAWStore((state) => state.selectedClipRef)
  const selectedClipRefs = useDAWStore((state) => state.selectedClipRefs)
  const clipboard = useDAWStore((state) => state.clipboard)
  const past = useDAWStore((state) => state.past)
  const future = useDAWStore((state) => state.future)
  const storeSetProject = useDAWStore((state) => state.setProject)
  const updateProject = useDAWStore((state) => state.updateProject)
  const storeSetIsPlaying = useDAWStore((state) => state.setIsPlaying)
  const storeSetMetronomeEnabled = useDAWStore((state) => state.setMetronomeEnabled)
  const storeSetPlayheadBeat = useDAWStore((state) => state.setPlayheadBeat)
  const storeSetMasterVolume = useDAWStore((state) => state.setMasterVolume)
  const storeSetMasterEQ = useDAWStore((state) => state.setMasterEQ)
  const storeSetLoopEnabled = useDAWStore((state) => state.setLoopEnabled)
  const storeSetLoopLengthBeats = useDAWStore((state) => state.setLoopLengthBeats)
  const storeSetSelectedTrackId = useDAWStore((state) => state.setSelectedTrackId)
  const storeSetSelectedClipRef = useDAWStore((state) => state.setSelectedClipRef)
  const storeSetSelectedClipRefs = useDAWStore((state) => state.setSelectedClipRefs)
  const storeAddSelectedClipRef = useDAWStore((state) => state.addSelectedClipRef)
  const storeRemoveSelectedClipRef = useDAWStore((state) => state.removeSelectedClipRef)
  const storeSetClipboard = useDAWStore((state) => state.setClipboard)
  const pushHistory = useDAWStore((state) => state.pushHistory)
  const clearHistory = useDAWStore((state) => state.clearHistory)
  const undo = useDAWStore((state) => state.undo)
  const redo = useDAWStore((state) => state.redo)
  const resetProjectState = useDAWStore((state) => state.resetProject)
  const tapTempoRef = useRef<number[]>([])
  const undoDepth = past.length
  const redoDepth = future.length

  const setProject = (
    value: ProjectState | ((prev: ProjectState) => ProjectState),
    options?: { saveHistory?: boolean },
  ) => {
    if (typeof value === 'function') {
      updateProject(value, options)
      return
    }
    storeSetProject(value, options)
  }

  const setIsPlaying = (value: boolean) => {
    storeSetIsPlaying(value)
  }

  const setMetronomeEnabled = (value: boolean | ((prev: boolean) => boolean)) => {
    storeSetMetronomeEnabled(typeof value === 'function' ? value(metronomeEnabled) : value)
  }

  const setPlayheadBeat = (value: number) => {
    storeSetPlayheadBeat(value)
  }

  const setMasterVolume = (value: number) => {
    storeSetMasterVolume(value)
  }

  const setMasterEQ = (value: MasterEQ | ((prev: MasterEQ) => MasterEQ)) => {
    storeSetMasterEQ(typeof value === 'function' ? value(masterEQ) : value)
  }

  const setLoopEnabled = (value: boolean) => {
    storeSetLoopEnabled(value)
  }

  const setLoopLengthBeats = (value: number) => {
    storeSetLoopLengthBeats(value)
  }

  const setSelectedTrackId = (value: string | null) => {
    storeSetSelectedTrackId(value)
  }

  const setSelectedClipRef = (value: { trackId: string; clipId: string } | null) => {
    storeSetSelectedClipRef(value)
  }

  const setSelectedClipRefs = (value: { trackId: string; clipId: string }[]) => {
    storeSetSelectedClipRefs(value)
  }

  const addSelectedClipRef = (value: { trackId: string; clipId: string }) => {
    storeAddSelectedClipRef(value)
  }

  const removeSelectedClipRef = (value: { trackId: string; clipId: string }) => {
    storeRemoveSelectedClipRef(value)
  }

  const setClipboard = (value: { clip: Clip; sourceTrackId: string } | null) => {
    storeSetClipboard(value)
  }
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

  const meterRafRef = useRef<number | null>(null)
  const meterCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const masterLevelRef = useRef<number>(0)

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
    audioEngine.setMasterVolume(masterVolume)
  }, [masterVolume])

  const handleTapTempo = () => {
    const now = performance.now()
    const taps = tapTempoRef.current
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
    audioEngine.clearScheduledNodes()
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
    audioEngine.scheduleProject(
      project.tracks,
      project.bpm,
      loopEnabled,
      loopLengthBeats,
      metronomeEnabled,
      TIMELINE_BEATS,
    )
  }

  const previewClip = async (clip: Clip, track: Track) => {
    if (isPlaying) return;
    await audioEngine.ensureAudio(masterVolume);
    audioEngine.previewClip(clip, track, project.bpm);
  }

  const startPlayback = async () => {
    await audioEngine.ensureAudio(masterVolume)
    loopRestartCountRef.current = 0
    clearScheduledNodes()
    scheduleProject()
    setPlayheadBeat(0)
    setIsPlaying(true)
  }

  useEffect(() => {
    if (!isPlaying) return

    const update = () => {
      const elapsed = audioEngine.getElapsed()
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
      const analyser = audioEngine.analyser
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
      ctx2d.fillStyle = '#3d3a39'
      ctx2d.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = canvas.width * level
      ctx2d.fillStyle = level > 0.75 ? '#2fd6a1' : '#00d992'
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
      audioEngine.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.__DAW_DEBUG__ = {      isPlaying,
      scheduledNodeCount: audioEngine.scheduledNodes.length,
      bpm: project.bpm,
      trackCount: project.tracks.length,
      trackNames: project.tracks.map((t) => t.name),
      clipCount: totalClipCount,
      firstTrackFirstClipStartBeat: project.tracks[0]?.clips[0]?.startBeat ?? null,
      firstTrackFirstClipLengthBeats: project.tracks[0]?.clips[0]?.lengthBeats ?? null,
      firstTrackFirstClipWave: project.tracks[0]?.clips[0]?.wave ?? null,
      firstTrackFirstClipGain: project.tracks[0]?.clips[0]?.gain ?? 1.0,
      playheadBeat,
      undoDepth,
      redoDepth,
      clipboardClipId: clipboard?.clip.id ?? null,
      clipboardSourceTrackId: clipboard?.sourceTrackId ?? null,
      masterLevel: masterLevelRef.current,
      masterVolume,
    masterEQ,
      audioContextState: audioEngine.ctx?.state ?? 'uninitialized',
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
      scheduledFrequencyPreviewHz: [...audioEngine.scheduledFrequencyPreview],
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
    undoDepth,
    redoDepth,
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
    if (!selectedClipRef) return
    const track = project.tracks.find((t) => t.id === selectedClipRef.trackId)
    const clipExists = !!track?.clips.some((c) => c.id === selectedClipRef.clipId)
    if (!clipExists) {
      setSelectedClipRef(null)
    }
  }, [project.tracks, selectedClipRef, setSelectedClipRef])

  useEffect(() => {
    if (!selectedTrackId) return
    const trackExists = project.tracks.some((track) => track.id === selectedTrackId)
    if (!trackExists) {
      setSelectedTrackId(null)
    }
  }, [project.tracks, selectedTrackId, setSelectedTrackId])

  const applyProjectUpdate = (updater: (prev: ProjectState) => ProjectState) => {
    setProject(updater, { saveHistory: true })
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

  const cutClip = (trackId: string, clipId: string) => {
    if (isPlaying) return
    copyClip(trackId, clipId)
    deleteClip(trackId, clipId)
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
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, color } : c)),
            }
          : t,
      ),
    }), { saveHistory: true })
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

  const handleMIDIImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const midiData = e.target?.result as ArrayBuffer
        if (!midiData) return

        applyProjectUpdate((prev) => {
          const newTracks = prev.tracks.map((track, index) => {
            const midiBytes = new Uint8Array(midiData)
            const midiClips: { time: number; duration: number; noteNumber: number }[] = []

            let i = 22
            const dataLength = midiBytes.length
            while (i < dataLength - 2) {
              if (midiBytes[i] >= 0x90 && midiBytes[i] <= 0x9F && i + 2 < dataLength) {
                const noteNum = midiBytes[i + 1]
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

  const addClipAtBeat = (trackId: string, beat: number) => {
    applyProjectUpdate((prev) => {
      const next = structuredClone(prev)
      const track = next.tracks.find((t) => t.id === trackId)
      if (!track || track.locked) return prev
      const lengthBeats = 2
      const startBeat = resolveNonOverlappingStart(track.clips, lengthBeats, Math.min(beat, TIMELINE_BEATS - lengthBeats))
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

  const startPlayheadDrag = (e: React.MouseEvent) => {
    if (isPlaying) return
    const grid = timelineRef.current
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    const beatWidthPx = rect.width / TIMELINE_BEATS
    const beat = Math.max(0, Math.min(TIMELINE_BEATS, Math.round((e.clientX - rect.left) / beatWidthPx)))
    setPlayheadBeat(beat)

    const startClientX = e.clientX

    const onMove = (moveEvent: MouseEvent) => {
      const delta = Math.round((moveEvent.clientX - startClientX) / beatWidthPx)
      const newBeat = Math.max(0, Math.min(TIMELINE_BEATS, beat + delta))
      setPlayheadBeat(newBeat)
    }

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
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

      // Cross-track drag: check if mouse moved to a different track
      const timelineEl = document.querySelector('[data-testid="timeline"]')
      if (timelineEl) {
        const rows = timelineEl.querySelectorAll('[data-testid^="track-row-"]')
        let targetTrackId = state.trackId
        for (const row of rows) {
          const rect = (row as HTMLElement).getBoundingClientRect()
          if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
            targetTrackId = (row as HTMLElement).getAttribute('data-testid')!.replace('track-row-', '')
            break
          }
        }

        if (targetTrackId !== state.trackId) {
          const targetTrack = project.tracks.find(t => t.id === targetTrackId)
          if (targetTrack && !targetTrack.locked) {
            // Find the clip data from origin project
            const srcTrack = state.originProject.tracks.find(t => t.id === state.trackId)
            const srcClip = srcTrack?.clips.find(c => c.id === state.clipId)
            if (srcClip) {
              const resolvedStart = resolveNonOverlappingStart(targetTrack.clips, srcClip.lengthBeats, nextStart)
              const conflicts = targetTrack.clips.some(c => rangesOverlap(resolvedStart, srcClip.lengthBeats, c.startBeat, c.lengthBeats))
              if (!conflicts) {
                setProject(prev => ({
                  ...prev,
                  tracks: prev.tracks.map(t => {
                    if (t.id === state.trackId) {
                      return { ...t, clips: t.clips.filter(c => c.id !== state.clipId) }
                    }
                    if (t.id === targetTrackId) {
                      return { ...t, clips: [...t.clips, { ...srcClip, startBeat: resolvedStart }] }
                    }
                    return t
                  })
                }))
                state.trackId = targetTrackId
                state.hasMoved = true
                return
              }
            }
          }
        }
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
        pushHistory(state.originProject)
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
        pushHistory(state.originProject)
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

      if (event.key.toLowerCase() === 'x' && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        if (selectedClipRef) {
          event.preventDefault()
          cutClip(selectedClipRef.trackId, selectedClipRef.clipId)
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
  }, [cutClip, isPlaying, project, copyClip, deleteClip, pasteClip, pausePlayback, redo, selectedClipRef, selectedTrackId, startPlayback, stopPlayback, undo])

  return {
    project,
    isPlaying,
    metronomeEnabled,
    playheadBeat,
    masterVolume,
    masterEQ,
    loopEnabled,
    loopLengthBeats,
    selectedTrackId,
    selectedClipRef,
    selectedClipRefs,
    clipboard,
    undoDepth,
    redoDepth,
    beatDuration,
    effectiveTimelineBeats,
    totalDurationSec,
    totalClipCount,
    mutedClipCount,
    mutedTrackCount,
    soloTrackCount,
    soloActive,
    lockedTrackCount,
    transposedTrackCount,
    filteredTrackCount,
    distortionEnabledTrackCount,
    tremoloEnabledTrackCount,
    reverbEnabledTrackCount,
    pannedTrackCount,
    selectedClipData,
    meterCanvasRef,
    timelineRef,
    setProject,
    setIsPlaying,
    setMetronomeEnabled,
    setPlayheadBeat,
    setMasterVolume,
    setMasterEQ,
    setLoopEnabled,
    setLoopLengthBeats,
    setSelectedTrackId,
    setSelectedClipRef,
    setSelectedClipRefs,
    addSelectedClipRef,
    removeSelectedClipRef,
    setClipboard,
    applyProjectUpdate,
    addClip,
    addClipAtBeat,
    removeClip,
    duplicateClip,
    splitClip,
    deleteClip,
    copyClip,
    pasteClip,
    cutClip,
    cycleClipWave,
    setTrackVolume,
    setTrackPan,
    toggleClipMute,
    setTrackColor,
    toggleTrackMute,
    toggleTrackSolo,
    toggleTrackLock,
    setTrackTranspose,
    setTrackFilterType,
    setTrackFilterCutoff,
    renameTrack,
    addTrack,
    deleteTrack,
    moveTrack,
    duplicateTrack,
    setSelectedClipWave,
    setSelectedClipNote,
    updateClipStartBeat,
    setClipColor,
    setClipName,
    updateClipGain,
    updateClipFades,
    updateClipTranspose,
    updateClipLengthBeats,
    handleMIDIImport,
    handleMIDIExport,
    handleTapTempo,
    startPlayback,
    pausePlayback,
    stopPlayback,
    undo,
    redo,
    resetProjectState,
    clearHistory,
    previewClip,
    startClipDrag,
    startClipResize,
    startPlayheadDrag,
  }
}
