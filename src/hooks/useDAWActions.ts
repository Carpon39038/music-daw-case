import React, { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { Clip, FavoriteClip, FrozenTrackSnapshot, MasterEQ, MasterPreset, ProjectState, Track, WaveType } from '../types'
import { useDAWStore } from '../store/useDAWStore'
import { audioEngine } from '../audio/AudioEngine'
import { audioBufferToMp3 } from '../utils/audioBufferToMp3'
import { getTimelineDurationSec, secondsToBeat } from '../utils/tempoCurve'
import { buildSocialExportBaseName, createSocialCardBlob, createSocialPackageZipBlob, triggerDownload } from '../utils/socialPublish'
import { analyzeChordSuggestions } from '../utils/chordSuggestion'
import { hzToClosestNoteLabel } from '../utils/notes'

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

type ChordPreset = 'I-V-vi-IV' | 'vi-IV-I-V' | 'I-vi-IV-V'

const CHORD_PRESETS: Record<ChordPreset, string[]> = {
  'I-V-vi-IV': ['I', 'V', 'vi', 'IV'],
  'vi-IV-I-V': ['vi', 'IV', 'I', 'V'],
  'I-vi-IV-V': ['I', 'vi', 'IV', 'V'],
}

const CHORD_PRESET_OPTIONS: ChordPreset[] = ['I-V-vi-IV', 'vi-IV-I-V', 'I-vi-IV-V']
const NOTE_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

function midiNoteToFrequency(noteNumber: number): number {
  return 440 * Math.pow(2, (noteNumber - 69) / 12)
}

function parseRomanDegree(token: string): number {
  const normalized = token.replace(/[^IViv]/g, '').toUpperCase()
  switch (normalized) {
    case 'I': return 1
    case 'II': return 2
    case 'III': return 3
    case 'IV': return 4
    case 'V': return 5
    case 'VI': return 6
    case 'VII': return 7
    default: return 1
  }
}

function chordIntervalsFromRoman(token: string): [number, number, number] {
  if (token.includes('°')) return [0, 3, 6]
  const isMinor = token === token.toLowerCase()
  return isMinor ? [0, 3, 7] : [0, 4, 7]
}

function resolveScaleSemitoneRoot(scaleKey?: string): number {
  const key = scaleKey ?? 'C'
  const index = NOTE_CLASSES.indexOf(key as (typeof NOTE_CLASSES)[number])
  return index === -1 ? 0 : index
}

function resolveScaleType(scaleType?: string): 'major' | 'minor' | 'chromatic' {
  if (scaleType === 'minor' || scaleType === 'chromatic') return scaleType
  return 'major'
}

function buildChordFrequencies(
  preset: ChordPreset,
  scaleKey: string,
  scaleType: 'major' | 'minor' | 'chromatic',
): number[][] {
  const rootSemitone = resolveScaleSemitoneRoot(scaleKey)
  const scaleDegrees = scaleType === 'minor'
    ? [0, 2, 3, 5, 7, 8, 10]
    : scaleType === 'chromatic'
      ? [0, 1, 2, 3, 4, 5, 6]
      : [0, 2, 4, 5, 7, 9, 11]

  const rootMidi = (4 + 1) * 12 + rootSemitone
  return CHORD_PRESETS[preset].map((token) => {
    const degree = parseRomanDegree(token)
    const degreeOffset = scaleDegrees[Math.max(0, Math.min(scaleDegrees.length - 1, degree - 1))] ?? 0
    const chordRootMidi = rootMidi + degreeOffset
    const intervals = chordIntervalsFromRoman(token)
    return intervals.map((itv) => midiNoteToFrequency(chordRootMidi + itv))
  })
}

function makeChordClipId(trackId: string) {
  return `${trackId}-chord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clampChordLength(startBeat: number, length: number) {
  return Math.max(0.25, Math.min(length, TIMELINE_BEATS - startBeat))
}

function randomChordWave(): WaveType {
  const waves: WaveType[] = ['triangle', 'organ', 'sine', 'square']
  return waves[Math.floor(Math.random() * waves.length)]
}

function randomMelodyWave(): WaveType {
  const waves: WaveType[] = ['sine', 'triangle', 'organ', 'brass', 'square']
  return waves[Math.floor(Math.random() * waves.length)]
}

function buildScaleNoteFrequencies(scaleKey: string, scaleType: 'major' | 'minor' | 'chromatic'): number[] {
  const rootSemitone = resolveScaleSemitoneRoot(scaleKey)
  const scaleDegrees = scaleType === 'minor'
    ? [0, 2, 3, 5, 7, 8, 10]
    : scaleType === 'chromatic'
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : [0, 2, 4, 5, 7, 9, 11]

  const rootMidi = (4 + 1) * 12 + rootSemitone
  return scaleDegrees.map((degree) => midiNoteToFrequency(rootMidi + degree))
}

function makeMelodyClipId(trackId: string) {
  return `${trackId}-melody-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clampTimelineBeat(beat: number) {
  return Math.max(0, Math.min(TIMELINE_BEATS - 0.25, beat))
}

function prevMarkerDefaultBeat(project: ProjectState): number {
  const markers = project.markers ?? []
  if (markers.length === 0) return 0
  const maxBeat = markers.reduce((acc, marker) => Math.max(acc, marker.beat), 0)
  return Math.min(TIMELINE_BEATS, maxBeat + 4)
}

function normalizeMelodyStep(step: number) {
  if (step <= 0.25) return 0.25
  if (step <= 0.5) return 0.5
  if (step <= 1) return 1
  return 2
}

function clampMelodyLength(startBeat: number, length: number) {
  return Math.max(0.25, Math.min(length, TIMELINE_BEATS - startBeat))
}

function randomMelodyDuration() {
  const durations = [0.5, 0.5, 1, 1, 2]
  return durations[Math.floor(Math.random() * durations.length)]
}

function pickScaleFrequency(scaleFrequencies: number[], previous?: number) {
  if (scaleFrequencies.length === 0) return 440
  if (!previous) return scaleFrequencies[Math.floor(Math.random() * scaleFrequencies.length)]

  const nearby = scaleFrequencies.filter((hz) => Math.abs(hz - previous) <= 400)
  const pool = nearby.length > 0 ? nearby : scaleFrequencies
  return pool[Math.floor(Math.random() * pool.length)]
}

type StyleStarterGenre = 'lofi' | 'edm' | 'hiphop'
type MoodPreset = 'happy' | 'healing' | 'tense' | 'cyber'

const STYLE_STARTER_PRESETS: Record<StyleStarterGenre, {
  bpm: number
  scaleKey: string
  scaleType: 'major' | 'minor'
  chordPreset: ChordPreset
  chordWave: WaveType
  bassWave: WaveType
  bassPattern: number[]
  drum: {
    kick: number[]
    snare: number[]
    hihat: number[]
  }
}> = {
  lofi: {
    bpm: 82,
    scaleKey: 'C',
    scaleType: 'minor',
    chordPreset: 'I-vi-IV-V',
    chordWave: 'organ',
    bassWave: 'triangle',
    bassPattern: [0, 2, 4, 6, 8, 10, 12, 14],
    drum: {
      kick: [0, 6, 8, 14],
      snare: [4, 12],
      hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    },
  },
  edm: {
    bpm: 126,
    scaleKey: 'F',
    scaleType: 'minor',
    chordPreset: 'I-V-vi-IV',
    chordWave: 'sawtooth',
    bassWave: 'square',
    bassPattern: [0, 2, 4, 6, 8, 10, 12, 14],
    drum: {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    },
  },
  hiphop: {
    bpm: 92,
    scaleKey: 'D#',
    scaleType: 'minor',
    chordPreset: 'vi-IV-I-V',
    chordWave: 'brass',
    bassWave: 'sine',
    bassPattern: [0, 3, 4, 7, 8, 11, 12, 15],
    drum: {
      kick: [0, 3, 8, 11],
      snare: [4, 12],
      hihat: [0, 2, 3, 6, 8, 10, 11, 14],
    },
  },
}

const MOOD_PRESETS: Record<MoodPreset, {
  bpm: number
  scaleKey: string
  scaleType: 'major' | 'minor'
  chordPreset: ChordPreset
  styleGenre: StyleStarterGenre
}> = {
  happy: {
    bpm: 118,
    scaleKey: 'G',
    scaleType: 'major',
    chordPreset: 'I-V-vi-IV',
    styleGenre: 'edm',
  },
  healing: {
    bpm: 78,
    scaleKey: 'C',
    scaleType: 'major',
    chordPreset: 'I-vi-IV-V',
    styleGenre: 'lofi',
  },
  tense: {
    bpm: 132,
    scaleKey: 'D',
    scaleType: 'minor',
    chordPreset: 'vi-IV-I-V',
    styleGenre: 'hiphop',
  },
  cyber: {
    bpm: 128,
    scaleKey: 'F#',
    scaleType: 'minor',
    chordPreset: 'I-V-vi-IV',
    styleGenre: 'edm',
  },
}

// MIDI utilities

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

interface ExportLoudnessReport {
  peakLinear: number
  peakDb: number
  rmsLinear: number
  rmsDb: number
  verdict: 'ready' | 'adjust' | 'clipping-risk'
  checkedAt: number
}

interface ReferenceTrackState {
  fileName: string
  objectUrl: string
  rawRmsDb: number | null
  matchedGainDb: number
  matchedDeltaDb: number
}

type MonitorSource = 'project' | 'reference'

type AutoMixCategory = 'drum' | 'bass' | 'harmony'

type VocalInputWarning = {
  level: 'low' | 'clipping'
  advice: string
}
type AutoMixSuggestionKind = 'volume' | 'pan' | 'lowcut'

interface AutoMixSuggestion {
  id: string
  trackId: string
  trackName: string
  category: AutoMixCategory
  kind: AutoMixSuggestionKind
  from: number
  to: number
  label: string
}

interface AutoMixSuggestionItem extends AutoMixSuggestion {
  applied: boolean
}

function averageClipNoteHz(track: Track) {
  if (!track.clips.length) return 440
  const total = track.clips.reduce((sum, clip) => sum + clip.noteHz, 0)
  return total / track.clips.length
}

function chooseCategoryTracks(project: ProjectState) {
  const tracks = project.tracks
  const nonDrumTracks = tracks.filter((track) => !track.isDrumTrack)

  const drumTrack = tracks.find((track) => track.isDrumTrack)
    ?? tracks.find((track) => /drum|perc|kick|snare|hihat/i.test(track.name))
    ?? tracks[0]

  const bassCandidates = nonDrumTracks.length > 0 ? nonDrumTracks : tracks
  const bassTrack = [...bassCandidates].sort((a, b) => {
    const aNameScore = /bass|808|sub/i.test(a.name) ? -1000 : 0
    const bNameScore = /bass|808|sub/i.test(b.name) ? -1000 : 0
    return (averageClipNoteHz(a) + aNameScore) - (averageClipNoteHz(b) + bNameScore)
  })[0] ?? tracks[0]

  const harmonyCandidates = nonDrumTracks.filter((track) => track.id !== bassTrack?.id)
  const harmonyTrack = harmonyCandidates.find((track) => track.clips.length > 0)
    ?? harmonyCandidates[0]
    ?? nonDrumTracks[0]
    ?? tracks.find((track) => track.id !== bassTrack?.id)
    ?? tracks[0]

  return {
    drumTrack,
    bassTrack,
    harmonyTrack,
  }
}

function buildAutoMixSuggestions(project: ProjectState): AutoMixSuggestion[] {
  if (project.tracks.length === 0) return []

  const { drumTrack, bassTrack, harmonyTrack } = chooseCategoryTracks(project)
  const suggestions: AutoMixSuggestion[] = []

  if (drumTrack) {
    suggestions.push({
      id: `auto-mix-${drumTrack.id}-volume`,
      trackId: drumTrack.id,
      trackName: drumTrack.name,
      category: 'drum',
      kind: 'volume',
      from: drumTrack.volume,
      to: 0.72,
      label: `鼓组音量归一到 72%（当前 ${Math.round(drumTrack.volume * 100)}%）`,
    })
  }

  if (bassTrack) {
    suggestions.push({
      id: `auto-mix-${bassTrack.id}-pan`,
      trackId: bassTrack.id,
      trackName: bassTrack.name,
      category: 'bass',
      kind: 'pan',
      from: bassTrack.pan,
      to: 0,
      label: `贝斯居中，稳定低频重心（当前 ${bassTrack.pan.toFixed(2)}）`,
    })
    suggestions.push({
      id: `auto-mix-${bassTrack.id}-volume`,
      trackId: bassTrack.id,
      trackName: bassTrack.name,
      category: 'bass',
      kind: 'volume',
      from: bassTrack.volume,
      to: 0.68,
      label: `贝斯音量对齐到 68%（当前 ${Math.round(bassTrack.volume * 100)}%）`,
    })
  }

  if (harmonyTrack) {
    const targetPan = harmonyTrack.id === bassTrack?.id ? -0.2 : (harmonyTrack.pan >= 0 ? 0.2 : -0.2)
    suggestions.push({
      id: `auto-mix-${harmonyTrack.id}-lowcut`,
      trackId: harmonyTrack.id,
      trackName: harmonyTrack.name,
      category: 'harmony',
      kind: 'lowcut',
      from: harmonyTrack.filterType === 'highpass' ? harmonyTrack.filterCutoff : 0,
      to: 140,
      label: `和声高通到 140Hz，规避与低频冲突`,
    })
    suggestions.push({
      id: `auto-mix-${harmonyTrack.id}-pan`,
      trackId: harmonyTrack.id,
      trackName: harmonyTrack.name,
      category: 'harmony',
      kind: 'pan',
      from: harmonyTrack.pan,
      to: targetPan,
      label: `和声音像轻微偏移到 ${targetPan > 0 ? `R${Math.round(targetPan * 100)}` : `L${Math.round(Math.abs(targetPan) * 100)}`}`,
    })
  }

  return suggestions
}

function applyAutoMixSuggestions(baseProject: ProjectState, suggestions: AutoMixSuggestion[], appliedIds: string[]): ProjectState {
  const nextProject = structuredClone(baseProject)
  const activeSuggestionIds = new Set(appliedIds)

  suggestions.forEach((suggestion) => {
    if (!activeSuggestionIds.has(suggestion.id)) return
    const track = nextProject.tracks.find((item) => item.id === suggestion.trackId)
    if (!track) return

    if (suggestion.kind === 'volume') {
      track.volume = suggestion.to
      return
    }
    if (suggestion.kind === 'pan') {
      track.pan = suggestion.to
      return
    }
    if (suggestion.kind === 'lowcut') {
      track.filterType = 'highpass'
      track.filterCutoff = suggestion.to
    }
  })

  return nextProject
}

function toAutoMixSuggestionItems(suggestions: AutoMixSuggestion[], appliedIds: string[]): AutoMixSuggestionItem[] {
  const activeSuggestionIds = new Set(appliedIds)
  return suggestions.map((item) => ({
    ...item,
    applied: activeSuggestionIds.has(item.id),
  }))
}

function collectAutoMixCategories(items: AutoMixSuggestionItem[]) {
  const set = new Set<AutoMixCategory>()
  items.forEach((item) => set.add(item.category))
  return [...set]
}

function hasAllAutoMixCategories(items: AutoMixSuggestionItem[]) {
  const categories = collectAutoMixCategories(items)
  return categories.includes('drum') && categories.includes('bass') && categories.includes('harmony')
}

function analyzeVocalInputWarning(track: Track): VocalInputWarning | null {
  const candidateClips = track.clips
  if (candidateClips.length === 0) return null

  const gains = candidateClips.map((clip) => clip.gain ?? 1)
  const maxGain = Math.max(...gains)
  const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / gains.length

  if (maxGain >= 1.7) {
    return {
      level: 'clipping',
      advice: '检测到输入可能削波：请将录音输入增益下调约 6dB，或先降低该轨道/片段增益后再导出。',
    }
  }

  if (avgGain <= 0.35) {
    return {
      level: 'low',
      advice: '检测到输入电平偏低：建议靠近麦克风并提升录音输入增益（目标峰值约 -12dBFS）。',
    }
  }

  return null
}

function ensureAutoMixCoverage(project: ProjectState, suggestions: AutoMixSuggestion[]) {
  const items = toAutoMixSuggestionItems(suggestions, suggestions.map((item) => item.id))
  if (hasAllAutoMixCategories(items)) return suggestions

  const fallbackTrack = project.tracks[0]
  if (!fallbackTrack) return suggestions

  const categories = collectAutoMixCategories(items)
  const extra: AutoMixSuggestion[] = []

  if (!categories.includes('drum')) {
    extra.push({
      id: `auto-mix-${fallbackTrack.id}-fallback-drum`,
      trackId: fallbackTrack.id,
      trackName: fallbackTrack.name,
      category: 'drum',
      kind: 'volume',
      from: fallbackTrack.volume,
      to: 0.72,
      label: '鼓组兜底：补齐节奏轨道基础音量目标',
    })
  }

  if (!categories.includes('bass')) {
    extra.push({
      id: `auto-mix-${fallbackTrack.id}-fallback-bass`,
      trackId: fallbackTrack.id,
      trackName: fallbackTrack.name,
      category: 'bass',
      kind: 'pan',
      from: fallbackTrack.pan,
      to: 0,
      label: '贝斯兜底：补齐低频居中建议',
    })
  }

  if (!categories.includes('harmony')) {
    extra.push({
      id: `auto-mix-${fallbackTrack.id}-fallback-harmony`,
      trackId: fallbackTrack.id,
      trackName: fallbackTrack.name,
      category: 'harmony',
      kind: 'lowcut',
      from: fallbackTrack.filterType === 'highpass' ? fallbackTrack.filterCutoff : 0,
      to: 140,
      label: '和声兜底：补齐高通避让低频建议',
    })
  }

  return [...suggestions, ...extra]
}

function formatDbLabel(value: number) {
  if (!Number.isFinite(value)) return '-∞ dB'
  return `${value.toFixed(1)} dB`
}

function analyzeBufferLoudness(buffer: AudioBuffer): ExportLoudnessReport {
  const channelCount = Math.max(1, buffer.numberOfChannels)
  const sampleLength = buffer.length
  let peak = 0
  let sumSquares = 0

  for (let ch = 0; ch < channelCount; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < sampleLength; i++) {
      const sample = data[i]
      const abs = Math.abs(sample)
      if (abs > peak) peak = abs
      sumSquares += sample * sample
    }
  }

  const totalSamples = Math.max(1, sampleLength * channelCount)
  const rms = Math.sqrt(sumSquares / totalSamples)
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity

  let verdict: ExportLoudnessReport['verdict'] = 'ready'
  if (peak >= 0.995 || peakDb > -0.1) {
    verdict = 'clipping-risk'
  } else if (peakDb > -1 || rmsDb < -24 || rmsDb > -10) {
    verdict = 'adjust'
  }

  return {
    peakLinear: peak,
    peakDb,
    rmsLinear: rms,
    rmsDb,
    verdict,
    checkedAt: Date.now(),
  }
}

function dbToLinear(db: number) {
  return 10 ** (db / 20)
}

async function estimateAudioFileRmsDb(file: File): Promise<number | null> {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null

    const ctx = new AudioContextCtor()
    try {
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))

      let sumSq = 0
      let sampleCount = 0
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const data = decoded.getChannelData(ch)
        sampleCount += data.length
        for (let i = 0; i < data.length; i++) {
          const value = data[i]
          sumSq += value * value
        }
      }

      if (sampleCount === 0) return null
      const rms = Math.sqrt(sumSq / sampleCount)
      if (!Number.isFinite(rms) || rms <= 0) return null
      return 20 * Math.log10(rms)
    } finally {
      await ctx.close()
    }
  } catch {
    return null
  }
}

function estimateProjectRmsDbForReference(project: ProjectState) {
  const clips = project.tracks.flatMap((track) => track.clips)
  if (clips.length === 0) return -18

  const energy = clips.reduce((sum, clip) => {
    const gain = clip.gain ?? 1
    return sum + gain * gain
  }, 0)

  const rms = Math.sqrt(energy / clips.length)
  if (!Number.isFinite(rms) || rms <= 0) return -18
  return 20 * Math.log10(rms)
}

function resolveReferenceMatchedGainDb(referenceRmsDb: number | null, projectRmsDb: number | null) {
  if (referenceRmsDb == null || projectRmsDb == null || !Number.isFinite(referenceRmsDb) || !Number.isFinite(projectRmsDb)) {
    return 0
  }

  const delta = projectRmsDb - referenceRmsDb
  return Math.max(-12, Math.min(12, delta))
}

function toReferencePlaybackSeconds(playheadBeat: number, bpm: number) {
  if (!Number.isFinite(playheadBeat) || playheadBeat <= 0 || bpm <= 0) return 0
  return (playheadBeat * 60) / bpm
}

function toPlayheadBeatFromSeconds(seconds: number, bpm: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || bpm <= 0) return 0
  return seconds / (60 / bpm)
}

function isReferenceShortcutKey(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  return event.key.toLowerCase() === 'r'
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
      lastExportPeakDb: number | null
      lastExportRmsDb: number | null
      lastExportLoudnessVerdict: 'ready' | 'adjust' | 'clipping-risk' | null
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
  masterVolume: number
  masterEQ: MasterEQ
  masterPreset: MasterPreset
  loopEnabled: boolean
  loopLengthBeats: number
  selectedTrackId: string | null
  selectedClipRef: { trackId: string; clipId: string } | null
  selectedClipRefs: { trackId: string; clipId: string }[]
  clipboard: { clip: Clip; sourceTrackId: string } | null
  favoriteClips: FavoriteClip[]
  favoriteClipSearchQuery: string
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
  chordSuggestions: { name: string; confidence: number; notesHz: number[] }[]
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
  applyMasterPreset: (preset: MasterPreset) => void
  resetMasterPresetToBaseline: () => void
  setLoopEnabled: (value: boolean) => void
  setLoopLengthBeats: (value: number) => void
  setSelectedTrackId: (value: string | null) => void
  setSelectedClipRef: (value: { trackId: string; clipId: string } | null) => void
  setSelectedClipRefs: (value: { trackId: string; clipId: string }[]) => void
  addSelectedClipRef: (value: { trackId: string; clipId: string }) => void
  removeSelectedClipRef: (value: { trackId: string; clipId: string }) => void
  setClipboard: (value: { clip: Clip; sourceTrackId: string } | null) => void
  setFavoriteClipSearchQuery: (value: string) => void
  saveFavoriteClipFromSelection: () => void
  pasteFavoriteClipToTrack: (favoriteClipId: string, trackId: string) => void
  deleteFavoriteClip: (favoriteClipId: string) => void
  // Actions
  applyProjectUpdate: (updater: (prev: ProjectState) => ProjectState) => void
  addMarker: (beat?: number, name?: string) => void
  renameMarker: (markerId: string, name: string) => void
  removeMarker: (markerId: string) => void
  jumpToMarker: (markerId: string) => void
  addClip: (trackId: string) => void
  addClipAtBeat: (trackId: string, beat: number) => void
  addAudioFileClip: (trackId: string, beat: number, file: File) => void
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
  addDrumTrack: () => void
  toggleDrumStep: (trackId: string, type: 'kick'|'snare'|'hihat', stepIndex: number) => void
  deleteTrack: (trackId: string) => void
  moveTrack: (trackId: string, direction: 'up' | 'down') => void
  duplicateTrack: (trackId: string) => void
  freezeTrack: (trackId: string) => Promise<void>
  unfreezeTrack: (trackId: string) => void
  setSelectedClipWave: (trackId: string, clipId: string, wave: WaveType) => void
  setSelectedClipNote: (trackId: string, clipId: string, noteHz: number) => void
  updateClipStartBeat: (trackId: string, clipId: string, startBeat: number) => void
  setClipColor: (trackId: string, clipId: string, color: string) => void
  setClipName: (trackId: string, clipId: string, name: string) => void
  updateClipGain: (trackId: string, clipId: string, gain: number) => void
  updateClipEnvelopePoint: (trackId: string, clipId: string, pointIndex: number, value: { beat?: number; gain?: number }) => void
  resetClipEnvelope: (trackId: string, clipId: string) => void
  updateClipFades: (trackId: string, clipId: string, fadeIn: number, fadeOut: number) => void
  updateClipTranspose: (trackId: string, clipId: string, transposeSemitones: number) => void
  updateClipLengthBeats: (trackId: string, clipId: string, lengthBeats: number) => void
  quantizeClip: (trackId: string, clipId: string, gridBeats: number) => void
  insertChordPreset: (trackId: string, preset?: 'I-V-vi-IV' | 'vi-IV-I-V' | 'I-vi-IV-V', startBeat?: number, chordLengthBeats?: number) => void
  generateMelody: (trackId: string, options?: { startBeat?: number; noteCount?: number; stepBeats?: number }) => void
  normalizeClipGains: () => void
  applyMagicPolish: () => void
  applyMoodPreset: (mood: MoodPreset) => void
  generateStyleStarter: (genre: 'lofi' | 'edm' | 'hiphop') => void
  continueTrackIdea: (
    trackId: string,
    profile: 'conservative' | 'balanced' | 'bold',
    options?: { lockRhythm?: boolean; lockPitch?: boolean }
  ) => void
  handleMIDIImport: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleMIDIExport: () => void
  handleAudioExport: () => Promise<void>
  handleMp3Export: () => Promise<void>
  importReferenceTrack: (file: File) => Promise<void>
  clearReferenceTrack: () => void
  toggleReferenceAB: () => void
  monitorSource: MonitorSource
  referenceTrack: ReferenceTrackState | null
  lastExportLoudnessReport: ExportLoudnessReport | null
  autoMixSuggestionItems: AutoMixSuggestionItem[]
  autoMixAvailable: boolean
  autoMixPreviewMode: 'before' | 'after' | null
  autoMixCoverageReady: boolean
  runAutoMixAssistant: () => void
  toggleAutoMixSuggestion: (suggestionId: string) => void
  previewAutoMixVersion: (mode: 'before' | 'after') => void
  enableVocalCleanChain: (trackId: string) => void
  handleSocialPublish: () => Promise<void>
  handleExportProjectCard: () => Promise<void>
  handleTapTempo: () => void
  isRecording: boolean
  toggleRecording: () => Promise<void>
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
  const masterVolume = useDAWStore((state) => state.masterVolume)
  const masterEQ = useDAWStore((state) => state.masterEQ)
  const masterPreset = useDAWStore((state) => state.masterPreset)
  const loopEnabled = useDAWStore((state) => state.loopEnabled)
  const loopLengthBeats = useDAWStore((state) => state.loopLengthBeats)
  const selectedTrackId = useDAWStore((state) => state.selectedTrackId)
  const selectedClipRef = useDAWStore((state) => state.selectedClipRef)
  const selectedClipRefs = useDAWStore((state) => state.selectedClipRefs)
  const clipboard = useDAWStore((state) => state.clipboard)
  const favoriteClips = useDAWStore((state) => state.favoriteClips || [])
  const favoriteClipSearchQuery = useDAWStore((state) => state.favoriteClipSearchQuery || '')
  const past = useDAWStore((state) => state.past)
  const future = useDAWStore((state) => state.future)
  const storeSetProject = useDAWStore((state) => state.setProject)
  const updateProject = useDAWStore((state) => state.updateProject)
  const storeSetIsPlaying = useDAWStore((state) => state.setIsPlaying)
  const storeSetMetronomeEnabled = useDAWStore((state) => state.setMetronomeEnabled)
  const storeSetPlayheadBeat = useDAWStore((state) => state.setPlayheadBeat)
  const storeSetMasterVolume = useDAWStore((state) => state.setMasterVolume)
  const storeSetMasterEQ = useDAWStore((state) => state.setMasterEQ)
  const storeApplyMasterPreset = useDAWStore((state) => state.applyMasterPreset)
  const storeResetMasterPresetToBaseline = useDAWStore((state) => state.resetMasterPresetToBaseline)
  const storeSetLoopEnabled = useDAWStore((state) => state.setLoopEnabled)
  const storeSetLoopLengthBeats = useDAWStore((state) => state.setLoopLengthBeats)
  const storeSetSelectedTrackId = useDAWStore((state) => state.setSelectedTrackId)
  const storeSetSelectedClipRef = useDAWStore((state) => state.setSelectedClipRef)
  const storeSetSelectedClipRefs = useDAWStore((state) => state.setSelectedClipRefs)
  const storeAddSelectedClipRef = useDAWStore((state) => state.addSelectedClipRef)
  const storeRemoveSelectedClipRef = useDAWStore((state) => state.removeSelectedClipRef)
  const storeSetClipboard = useDAWStore((state) => state.setClipboard)
  const storeSetFavoriteClipSearchQuery = useDAWStore((state) => state.setFavoriteClipSearchQuery)
  const storeSaveFavoriteClip = useDAWStore((state) => state.saveFavoriteClip)
  const storeDeleteFavoriteClip = useDAWStore((state) => state.deleteFavoriteClip)
  const pushHistory = useDAWStore((state) => state.pushHistory)
  const clearHistory = useDAWStore((state) => state.clearHistory)
  const undo = useDAWStore((state) => state.undo)
  const redo = useDAWStore((state) => state.redo)
  const [isRecording, setIsRecording] = React.useState(false)
  const [lastExportLoudnessReport, setLastExportLoudnessReport] = React.useState<ExportLoudnessReport | null>(null)
  const [monitorSource, setMonitorSource] = React.useState<MonitorSource>('project')
  const [referenceTrack, setReferenceTrack] = React.useState<ReferenceTrackState | null>(null)
  const referenceAudioRef = React.useRef<HTMLAudioElement | null>(null)
  const [autoMixBaseProject, setAutoMixBaseProject] = React.useState<ProjectState | null>(null)
  const [autoMixSuggestions, setAutoMixSuggestions] = React.useState<AutoMixSuggestion[]>([])
  const [autoMixAppliedSuggestionIds, setAutoMixAppliedSuggestionIds] = React.useState<string[]>([])
  const [autoMixPreviewMode, setAutoMixPreviewMode] = React.useState<'before' | 'after' | null>(null)
  const resetProjectState = useDAWStore((state) => state.resetProject)
  const tapTempoRef = useRef<number[]>([])
  useEffect(() => {
    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.audioData) {
          audioEngine.loadClipAudio(clip.id, clip.audioData)
        }
      })
    })
  }, [project])

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

  const applyMasterPreset = (preset: MasterPreset) => {
    storeApplyMasterPreset(preset)
  }

  const resetMasterPresetToBaseline = () => {
    storeResetMasterPresetToBaseline()
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

  const setFavoriteClipSearchQuery = (value: string) => {
    storeSetFavoriteClipSearchQuery(value)
  }

  const saveFavoriteClipFromSelection = () => {
    if (!selectedClipRef) return
    const track = project.tracks.find((t) => t.id === selectedClipRef.trackId)
    const clip = track?.clips.find((c) => c.id === selectedClipRef.clipId)
    if (!track || !clip) return

    const favoriteClip: FavoriteClip = {
      id: crypto.randomUUID(),
      name: clip.name?.trim() || `${track.name} · ${clip.wave}`,
      durationBeats: clip.lengthBeats,
      noteLabel: hzToClosestNoteLabel(clip.noteHz),
      scaleKey: project.scaleKey ?? 'C',
      scaleType: project.scaleType ?? 'chromatic',
      savedAt: Date.now(),
      clip: { ...clip },
    }

    storeSaveFavoriteClip(favoriteClip)
  }

  const pasteFavoriteClipToTrack = (favoriteClipId: string, trackId: string) => {
    const favorite = favoriteClips.find((item) => item.id === favoriteClipId)
    if (!favorite) return

    const targetTrack = project.tracks.find((t) => t.id === trackId)
    if (!targetTrack || targetTrack.locked) return

    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked) return prev

      const sourceClip = favorite.clip
      const newClip: Clip = {
        ...sourceClip,
        id: `${trackId}-favorite-${Date.now()}`,
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

  const deleteFavoriteClip = (favoriteClipId: string) => {
    storeDeleteFavoriteClip(favoriteClipId)
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
    isCopyDrag: boolean
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
  const tempoCurveType = project.tempoCurveType ?? 'constant'
  const tempoCurveTargetBpm = project.tempoCurveTargetBpm ?? project.bpm
  const totalDurationSec = useMemo(() => getTimelineDurationSec(effectiveTimelineBeats, {
    bpm: project.bpm,
    curveType: tempoCurveType,
    targetBpm: tempoCurveTargetBpm,
  }), [effectiveTimelineBeats, project.bpm, tempoCurveType, tempoCurveTargetBpm])
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

  const chordSuggestions = useMemo(() => analyzeChordSuggestions(project), [project])

  const autoMixSuggestionItems = useMemo(
    () => toAutoMixSuggestionItems(autoMixSuggestions, autoMixAppliedSuggestionIds),
    [autoMixSuggestions, autoMixAppliedSuggestionIds],
  )

  const autoMixAvailable = autoMixSuggestions.length > 0
  const autoMixCoverageReady = useMemo(() => hasAllAutoMixCategories(autoMixSuggestionItems), [autoMixSuggestionItems])

  const runAutoMixAssistant = () => {
    if (isPlaying) return

    const baseProject = structuredClone(project)
    const generatedSuggestions = ensureAutoMixCoverage(baseProject, buildAutoMixSuggestions(baseProject))
    if (generatedSuggestions.length === 0) return

    const appliedIds = generatedSuggestions.map((item) => item.id)
    const mixedProject = applyAutoMixSuggestions(baseProject, generatedSuggestions, appliedIds)

    setAutoMixBaseProject(baseProject)
    setAutoMixSuggestions(generatedSuggestions)
    setAutoMixAppliedSuggestionIds(appliedIds)
    setAutoMixPreviewMode('after')
    setProject(mixedProject, { saveHistory: true })
  }

  const toggleAutoMixSuggestion = (suggestionId: string) => {
    if (!autoMixBaseProject || autoMixSuggestions.length === 0) return

    const nextAppliedIds = autoMixAppliedSuggestionIds.includes(suggestionId)
      ? autoMixAppliedSuggestionIds.filter((item) => item !== suggestionId)
      : [...autoMixAppliedSuggestionIds, suggestionId]

    const nextProject = applyAutoMixSuggestions(autoMixBaseProject, autoMixSuggestions, nextAppliedIds)
    setAutoMixAppliedSuggestionIds(nextAppliedIds)
    setAutoMixPreviewMode('after')
    setProject(nextProject, { saveHistory: true })
  }

  const previewAutoMixVersion = (mode: 'before' | 'after') => {
    if (!autoMixBaseProject || autoMixSuggestions.length === 0) return

    if (mode === 'before') {
      setAutoMixPreviewMode('before')
      setProject(structuredClone(autoMixBaseProject), { saveHistory: true })
      return
    }

    const nextProject = applyAutoMixSuggestions(autoMixBaseProject, autoMixSuggestions, autoMixAppliedSuggestionIds)
    setAutoMixPreviewMode('after')
    setProject(nextProject, { saveHistory: true })
  }

  const enableVocalCleanChain = React.useCallback((trackId: string) => {
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => {
        if (track.id !== trackId) return track

        const warning = analyzeVocalInputWarning(track)
        return {
          ...track,
          vocalCleanEnabled: true,
          vocalDenoiseAmount: track.vocalDenoiseAmount ?? 0.45,
          vocalDeEssAmount: track.vocalDeEssAmount ?? 0.5,
          vocalCompAmount: track.vocalCompAmount ?? 0.55,
          vocalMakeupGainDb: track.vocalMakeupGainDb ?? 2,
          vocalInputWarning: warning?.level ?? null,
          vocalInputAdvice: warning?.advice ?? '',
        }
      }),
    }), { saveHistory: true })
  }, [updateProject])

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume)
  }, [masterVolume])

  const clearReferenceTrack = React.useCallback(() => {
    stopReferencePlayback(true)
    if (referenceTrack?.objectUrl) {
      URL.revokeObjectURL(referenceTrack.objectUrl)
    }
    referenceAudioRef.current = null
    setReferenceTrack(null)
    setMonitorSource('project')
  }, [referenceTrack])

  const importReferenceTrack = React.useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    const rawRmsDb = await estimateAudioFileRmsDb(file)
    const projectRmsDb = lastExportLoudnessReport?.rmsDb ?? estimateProjectRmsDbForReference(project)
    const matchedGainDb = resolveReferenceMatchedGainDb(rawRmsDb, projectRmsDb)
    const matchedDeltaDb = rawRmsDb == null ? 0 : Math.abs(projectRmsDb - (rawRmsDb + matchedGainDb))

    if (referenceTrack?.objectUrl) {
      URL.revokeObjectURL(referenceTrack.objectUrl)
    }

    const audio = new Audio(objectUrl)
    audio.preload = 'auto'
    audio.loop = loopEnabled
    audio.volume = Math.max(0, Math.min(1, dbToLinear(matchedGainDb)))

    referenceAudioRef.current = audio
    setReferenceTrack({
      fileName: file.name,
      objectUrl,
      rawRmsDb,
      matchedGainDb,
      matchedDeltaDb,
    })
    setMonitorSource('project')
  }, [lastExportLoudnessReport?.rmsDb, loopEnabled, project, referenceTrack?.objectUrl])

  const toggleReferenceAB = React.useCallback(() => {
    if (!referenceTrack || !referenceAudioRef.current) return
    const nextSource: MonitorSource = monitorSource === 'project' ? 'reference' : 'project'

    if (nextSource === 'reference') {
      stopPlayback()
      setMonitorSource('reference')
      return
    }

    stopReferencePlayback(true)
    setMonitorSource('project')
  }, [monitorSource, referenceTrack])

  useEffect(() => {
    const audio = referenceAudioRef.current
    if (!audio) return
    audio.loop = loopEnabled
  }, [loopEnabled, referenceTrack])

  useEffect(() => {
    return () => {
      stopReferencePlayback(true)
      if (referenceTrack?.objectUrl) {
        URL.revokeObjectURL(referenceTrack.objectUrl)
      }
    }
  }, [referenceTrack])

  const handleAudioExport = async () => {
    try {
      const audioBuffer = await audioEngine.renderBuffer(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
      )
      const loudness = analyzeBufferLoudness(audioBuffer)
      setLastExportLoudnessReport(loudness)

      if (loudness.verdict === 'clipping-risk') {
        window.alert(`导出已阻止：检测到削波风险\n峰值：${formatDbLabel(loudness.peakDb)}\n整体响度（RMS）：${formatDbLabel(loudness.rmsDb)}\n\n建议先降低主音量、使用 Normalize 或 Magic Polish 后再导出。`)
        return
      }

      if (loudness.verdict === 'adjust') {
        const proceed = window.confirm(`导出前响度检查：\n峰值：${formatDbLabel(loudness.peakDb)}\n整体响度（RMS）：${formatDbLabel(loudness.rmsDb)}\n结论：建议调整后再发布。\n\n是否仍继续导出 WAV？`)
        if (!proceed) return
      }

      const wavData = await audioEngine.exportWav(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
      )
      const blob = new Blob([wavData], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `project-${Date.now()}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export audio:', error)
    }
  }

  const handleMp3Export = async () => {
    try {
      const audioBuffer = await audioEngine.renderBuffer(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
      )
      const loudness = analyzeBufferLoudness(audioBuffer)
      setLastExportLoudnessReport(loudness)

      if (loudness.verdict === 'clipping-risk') {
        window.alert(`导出已阻止：检测到削波风险\n峰值：${formatDbLabel(loudness.peakDb)}\n整体响度（RMS）：${formatDbLabel(loudness.rmsDb)}\n\n建议先降低主音量、使用 Normalize 或 Magic Polish 后再导出。`)
        return
      }

      if (loudness.verdict === 'adjust') {
        const proceed = window.confirm(`导出前响度检查：\n峰值：${formatDbLabel(loudness.peakDb)}\n整体响度（RMS）：${formatDbLabel(loudness.rmsDb)}\n结论：建议调整后再发布。\n\n是否仍继续导出 MP3？`)
        if (!proceed) return
      }

      const mp3Data = audioBufferToMp3(audioBuffer)
      const blob = new Blob([mp3Data], { type: 'audio/mp3' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `project-${Date.now()}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export MP3:', error)
    }
  }

  const handleSocialPublish = async () => {
    try {
      const audioBuffer = await audioEngine.renderBuffer(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
      )
      const mp3Data = audioBufferToMp3(audioBuffer)
      const mp3Blob = new Blob([mp3Data], { type: 'audio/mp3' })
      const cardBlob = await createSocialCardBlob(project, totalDurationSec)
      const baseName = buildSocialExportBaseName(project.name)
      const zipBlob = await createSocialPackageZipBlob(baseName, mp3Blob, cardBlob)

      triggerDownload(zipBlob, `${baseName}-social-package.zip`)
    } catch (error) {
      console.error('Failed to publish social package:', error)
    }
  }

  const handleExportProjectCard = async () => {
    try {
      const cardBlob = await createSocialCardBlob(project, totalDurationSec)
      const baseName = buildSocialExportBaseName(project.name)
      triggerDownload(cardBlob, `${baseName}-project-card.png`)
    } catch (error) {
      console.error('Failed to export project card:', error)
    }
  }

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
        setProject((prev) => ({
          ...prev,
          bpm,
          tempoCurveTargetBpm: (prev.tempoCurveType ?? 'constant') === 'constant'
            ? bpm
            : prev.tempoCurveTargetBpm,
        }))
      }
    }
  }

  const toggleRecording = async () => {
    if (isRecording) {
      const blob = await audioEngine.stopRecordingMic()
      setIsRecording(false)
      if (blob && selectedTrackId) {
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64data = reader.result as string
          const clipId = `rec-${Date.now()}`
          
          await audioEngine.loadClipAudio(clipId, base64data)
          
          updateProject((prev) => {
            const track = prev.tracks.find(t => t.id === selectedTrackId)
            if (!track) return prev
            const startBeat = Math.round(useDAWStore.getState().playheadBeat * 2) / 2
            
            // Calculate duration in beats if possible, fallback to 4
            let lengthBeats = 4
            if (audioEngine.audioBufferCache.has(clipId)) {
              const buf = audioEngine.audioBufferCache.get(clipId)!
              const durationSec = buf.duration
              const beatDurationSec = 60 / prev.bpm
              lengthBeats = Math.ceil((durationSec / beatDurationSec) * 2) / 2 || 4
            }
            
            const newClip: Clip = {
              id: clipId,
              name: `Recording ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
              startBeat,
              lengthBeats,
              noteHz: 440,
              wave: 'sine',
              audioData: base64data,
            }
            return {
              ...prev,
              tracks: prev.tracks.map(t => 
                t.id === selectedTrackId 
                  ? { ...t, clips: [...t.clips, newClip] }
                  : t
              )
            }
          }, { saveHistory: true })
        }
        reader.readAsDataURL(blob)
      }
    } else {
      await audioEngine.startRecordingMic()
      setIsRecording(true)
    }
  }

  const clearScheduledNodes = () => {
    audioEngine.clearScheduledNodes()
  }

  const stopReferencePlayback = (resetTime = true) => {
    const audio = referenceAudioRef.current
    if (!audio) return
    audio.pause()
    if (resetTime) {
      try {
        audio.currentTime = 0
      } catch {
        // noop
      }
    }
  }

  const stopPlayback = () => {
    setIsPlaying(false)
    setPlayheadBeat(0)
    loopRestartCountRef.current = 0
    clearScheduledNodes()
    stopReferencePlayback(true)

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  const pausePlayback = () => {
    setIsPlaying(false)
    clearScheduledNodes()
    stopReferencePlayback(false)

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
      tempoCurveType,
      tempoCurveTargetBpm,
      undefined,
      undefined,
      masterEQ,
    )
  }

  const previewClip = async (clip: Clip, track: Track) => {
    if (isPlaying) return;
    await audioEngine.ensureAudio(masterVolume);
    audioEngine.previewClip(clip, track, project.bpm, tempoCurveType, tempoCurveTargetBpm);
  }

  const startPlayback = async () => {
    if (monitorSource === 'reference') {
      const audio = referenceAudioRef.current
      if (!audio) return
      stopPlayback()
      const targetSec = toReferencePlaybackSeconds(useDAWStore.getState().playheadBeat, project.bpm)
      try {
        audio.currentTime = Math.max(0, Math.min(targetSec, Number.isFinite(audio.duration) ? audio.duration : targetSec))
      } catch {
        // noop
      }
      await audio.play().catch(() => undefined)
      setIsPlaying(true)
      return
    }

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
      if (monitorSource === 'reference') {
        const audio = referenceAudioRef.current
        if (!audio) {
          stopPlayback()
          return
        }

        const currentBeat = toPlayheadBeatFromSeconds(audio.currentTime || 0, project.bpm)
        setPlayheadBeat(loopEnabled ? currentBeat % effectiveTimelineBeats : currentBeat)

        if (audio.ended) {
          if (loopEnabled) {
            try {
              audio.currentTime = 0
            } catch {
              // noop
            }
            void audio.play().catch(() => undefined)
            animationRef.current = requestAnimationFrame(update)
            return
          }
          stopPlayback()
          return
        }

        animationRef.current = requestAnimationFrame(update)
        return
      }

      const elapsed = audioEngine.getElapsed()
      const beat = secondsToBeat(elapsed, {
        bpm: project.bpm,
        curveType: tempoCurveType,
        targetBpm: tempoCurveTargetBpm,
      }, effectiveTimelineBeats)
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
  }, [isPlaying, totalDurationSec, project.bpm, tempoCurveType, tempoCurveTargetBpm, effectiveTimelineBeats, loopEnabled, monitorSource])

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
      get playheadBeat() { return useDAWStore.getState().playheadBeat },
      undoDepth,
      redoDepth,
      clipboardClipId: clipboard?.clip.id ?? null,
      clipboardSourceTrackId: clipboard?.sourceTrackId ?? null,
      masterLevel: masterLevelRef.current,
      masterVolume,
      masterEQ,
      lastExportPeakDb: lastExportLoudnessReport?.peakDb ?? null,
      lastExportRmsDb: lastExportLoudnessReport?.rmsDb ?? null,
      lastExportLoudnessVerdict: lastExportLoudnessReport?.verdict ?? null,
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
    lastExportLoudnessReport,
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

  const addMarker = (beat?: number, name?: string) => {
    applyProjectUpdate((prev) => {
      const markerBeat = Math.max(0, Math.min(TIMELINE_BEATS, Number.isFinite(beat as number) ? Number(beat) : prevMarkerDefaultBeat(prev)))
      const nextMarkers = [...(prev.markers ?? [])]
      const markerName = (name?.trim() || `Marker ${nextMarkers.length + 1}`).slice(0, 40)
      nextMarkers.push({ id: crypto.randomUUID(), name: markerName, beat: markerBeat })
      nextMarkers.sort((a, b) => a.beat - b.beat)
      return { ...prev, markers: nextMarkers }
    })
  }

  const renameMarker = (markerId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    applyProjectUpdate((prev) => {
      const markers = prev.markers ?? []
      const exists = markers.some((m) => m.id === markerId)
      if (!exists) return prev
      return {
        ...prev,
        markers: markers.map((m) => (m.id === markerId ? { ...m, name: trimmed.slice(0, 40) } : m)),
      }
    })
  }

  const removeMarker = (markerId: string) => {
    applyProjectUpdate((prev) => {
      const markers = prev.markers ?? []
      const nextMarkers = markers.filter((m) => m.id !== markerId)
      if (nextMarkers.length === markers.length) return prev
      return { ...prev, markers: nextMarkers }
    })
  }

  const jumpToMarker = (markerId: string) => {
    const marker = (project.markers ?? []).find((m) => m.id === markerId)
    if (!marker) return
    setPlayheadBeat(Math.max(0, Math.min(TIMELINE_BEATS, marker.beat)))
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
            const waves: WaveType[] = ['sine', 'square', 'sawtooth', 'triangle', 'organ', 'brass'];
            const nextIdx = (waves.indexOf(c.wave) + 1) % waves.length;
            return {
              ...c,
              wave: waves[nextIdx],
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

  const addDrumTrack = () => {
    applyProjectUpdate((prev) => {
      const newTrackId = `drum-${Date.now()}`
      return {
        ...prev,
        tracks: [
          ...prev.tracks,
          {
            id: newTrackId,
            name: `Drum Machine`,
            volume: 0.8,
            pan: 0,
            muted: false,
            solo: false,
            locked: false,
            isDrumTrack: true,
            drumSequence: {
              kick: new Array(16).fill(false),
              snare: new Array(16).fill(false),
              hihat: new Array(16).fill(false)
            },
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

  const toggleDrumStep = (trackId: string, type: 'kick'|'snare'|'hihat', stepIndex: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id === trackId && t.isDrumTrack && t.drumSequence) {
          const newSeq = { ...t.drumSequence }
          newSeq[type] = [...newSeq[type]]
          newSeq[type][stepIndex] = !newSeq[type][stepIndex]
          return { ...t, drumSequence: newSeq }
        }
        return t
      }),
    }))
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

  const encodeArrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  }

  const buildFreezeSnapshot = (track: Track): FrozenTrackSnapshot => ({
    clips: track.clips.map((c) => ({ ...c })),
    volume: track.volume,
    pan: track.pan,
    transposeSemitones: track.transposeSemitones,
    filterType: track.filterType,
    filterCutoff: track.filterCutoff,
    isDrumTrack: track.isDrumTrack,
    drumSequence: track.drumSequence
      ? {
          kick: [...track.drumSequence.kick],
          snare: [...track.drumSequence.snare],
          hihat: [...track.drumSequence.hihat],
        }
      : undefined,
    delayEnabled: track.delayEnabled,
    delayTime: track.delayTime,
    delayFeedback: track.delayFeedback,
    flangerEnabled: track.flangerEnabled,
    flangerSpeed: track.flangerSpeed,
    flangerDepth: track.flangerDepth,
    flangerFeedback: track.flangerFeedback,
    eqEnabled: track.eqEnabled,
    eqLow: track.eqLow,
    eqMid: track.eqMid,
    eqHigh: track.eqHigh,
    distortionEnabled: track.distortionEnabled,
    compressorEnabled: track.compressorEnabled,
    compressorThreshold: track.compressorThreshold,
    compressorRatio: track.compressorRatio,
    chorusEnabled: track.chorusEnabled,
    chorusDepth: track.chorusDepth,
    chorusRate: track.chorusRate,
    tremoloEnabled: track.tremoloEnabled,
    tremoloDepth: track.tremoloDepth,
    tremoloRate: track.tremoloRate,
    reverbEnabled: track.reverbEnabled,
    reverbMix: track.reverbMix,
    reverbDecay: track.reverbDecay,
  })

  const freezeTrack = async (trackId: string) => {
    if (isPlaying) return
    const currentProject = useDAWStore.getState().project
    const track = currentProject.tracks.find((t) => t.id === trackId)
    if (!track || track.locked || track.frozen) return

    const snapshot = buildFreezeSnapshot(track)
    const maxBeat = track.clips.reduce((m, c) => Math.max(m, c.startBeat + c.lengthBeats), 0)
    const renderBeats = Math.max(1, Math.ceil(maxBeat * 4) / 4)
    if (renderBeats <= 0) return

    const renderTrack: Track = {
      ...track,
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
    }

    try {
      const wavData = await audioEngine.exportWav(
        [renderTrack],
        currentProject.bpm,
        renderBeats,
        currentProject.tempoCurveType ?? 'constant',
        currentProject.tempoCurveTargetBpm,
        { low: 0, mid: 0, high: 0 },
      )
      const freezeAudioData = `data:audio/wav;base64,${encodeArrayBufferToBase64(wavData)}`
      const frozenClip: Clip = {
        id: `frozen-${track.id}-${Date.now()}`,
        startBeat: 0,
        lengthBeats: renderBeats,
        noteHz: 440,
        wave: 'sine',
        name: `${track.name} (Frozen)`,
        audioData: freezeAudioData,
        gain: 1,
      }

      applyProjectUpdate((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                frozen: true,
                freezeAudioData,
                freezeSource: snapshot,
                clips: [frozenClip],
                transposeSemitones: 0,
                filterType: 'none',
                filterCutoff: 20000,
                isDrumTrack: false,
                drumSequence: undefined,
                delayEnabled: false,
                flangerEnabled: false,
                eqEnabled: false,
                distortionEnabled: false,
                compressorEnabled: false,
                chorusEnabled: false,
                tremoloEnabled: false,
                reverbEnabled: false,
              }
            : t,
        ),
      }))
    } catch (error) {
      console.error('Failed to freeze track:', error)
    }
  }

  const unfreezeTrack = (trackId: string) => {
    if (isPlaying) return
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => {
        if (track.id !== trackId || !track.frozen || !track.freezeSource) return track
        const source = track.freezeSource
        return {
          ...track,
          clips: source.clips.map((c) => ({ ...c })),
          volume: source.volume,
          pan: source.pan,
          transposeSemitones: source.transposeSemitones,
          filterType: source.filterType,
          filterCutoff: source.filterCutoff,
          isDrumTrack: source.isDrumTrack,
          drumSequence: source.drumSequence
            ? {
                kick: [...source.drumSequence.kick],
                snare: [...source.drumSequence.snare],
                hihat: [...source.drumSequence.hihat],
              }
            : undefined,
          delayEnabled: source.delayEnabled,
          delayTime: source.delayTime,
          delayFeedback: source.delayFeedback,
          flangerEnabled: source.flangerEnabled,
          flangerSpeed: source.flangerSpeed,
          flangerDepth: source.flangerDepth,
          flangerFeedback: source.flangerFeedback,
          eqEnabled: source.eqEnabled,
          eqLow: source.eqLow,
          eqMid: source.eqMid,
          eqHigh: source.eqHigh,
          distortionEnabled: source.distortionEnabled,
          compressorEnabled: source.compressorEnabled,
          compressorThreshold: source.compressorThreshold,
          compressorRatio: source.compressorRatio,
          chorusEnabled: source.chorusEnabled,
          chorusDepth: source.chorusDepth,
          chorusRate: source.chorusRate,
          tremoloEnabled: source.tremoloEnabled,
          tremoloDepth: source.tremoloDepth,
          tremoloRate: source.tremoloRate,
          reverbEnabled: source.reverbEnabled,
          reverbMix: source.reverbMix,
          reverbDecay: source.reverbDecay,
          frozen: false,
          freezeAudioData: undefined,
          freezeSource: undefined,
        }
      }),
    }))
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

  const resetClipEnvelope = (trackId: string, clipId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId) return c
            const length = Math.max(1, c.lengthBeats)
            return {
              ...c,
              envelope: [
                { beat: 0, gain: 1 },
                { beat: length / 2, gain: 1 },
                { beat: length, gain: 1 },
              ],
            }
          }),
        }
      }),
    }))
  }

  const updateClipEnvelopePoint = (trackId: string, clipId: string, pointIndex: number, value: { beat?: number; gain?: number }) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId) return c
            const length = Math.max(1, c.lengthBeats)
            const base = (c.envelope && c.envelope.length >= 3
              ? c.envelope
              : [
                { beat: 0, gain: 1 },
                { beat: length / 2, gain: 1 },
                { beat: length, gain: 1 },
              ]).map((p) => ({ ...p }))
            if (pointIndex < 0 || pointIndex >= base.length) return c

            const prevBeat = pointIndex > 0 ? base[pointIndex - 1].beat : 0
            const nextBeat = pointIndex < base.length - 1 ? base[pointIndex + 1].beat : length
            const target = base[pointIndex]
            const epsilon = 0.01
            const nextBeatValue = value.beat == null
              ? target.beat
              : Math.max(
                  pointIndex === 0 ? 0 : prevBeat + epsilon,
                  Math.min(pointIndex === base.length - 1 ? length : nextBeat - epsilon, value.beat),
                )
            const nextGainValue = value.gain == null ? target.gain : Math.max(0, Math.min(2, value.gain))
            base[pointIndex] = { beat: nextBeatValue, gain: nextGainValue }
            return { ...c, envelope: base }
          }),
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

  const quantizeClip = (trackId: string, clipId: string, gridBeats: number) => {
    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked) return prev

      const sourceClip = track.clips.find((c) => c.id === clipId)
      if (!sourceClip) return prev

      let snappedStart = Math.round(sourceClip.startBeat / gridBeats) * gridBeats
      // Snap length as well? Requirements say: "一键量化到 1/4、1/8、1/16 网格"
      const snappedLength = Math.max(gridBeats, Math.round(sourceClip.lengthBeats / gridBeats) * gridBeats)

      snappedStart = Math.min(Math.max(0, snappedStart), TIMELINE_BEATS - snappedLength)
      const resolvedStart = resolveNonOverlappingStart(track.clips, snappedLength, snappedStart, clipId)

      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                clips: t.clips.map((c) => (c.id === clipId ? { ...c, startBeat: resolvedStart, lengthBeats: snappedLength } : c)),
              }
            : t,
        ),
      }
    })
  }

  const insertChordPreset = (
    trackId: string,
    preset: ChordPreset = 'I-V-vi-IV',
    startBeat?: number,
    chordLengthBeats = 2,
  ) => {
    if (isPlaying) return

    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked || track.isDrumTrack) return prev

      const safePreset = CHORD_PRESET_OPTIONS.includes(preset) ? preset : 'I-V-vi-IV'
      const safeLength = Number.isFinite(chordLengthBeats) ? Math.max(0.25, chordLengthBeats) : 2
      const start = Number.isFinite(startBeat)
        ? Math.max(0, Math.min(TIMELINE_BEATS - 0.25, Number(startBeat)))
        : Math.round(useDAWStore.getState().playheadBeat * 2) / 2

      const chordProgression = buildChordFrequencies(
        safePreset,
        prev.scaleKey ?? 'C',
        resolveScaleType(prev.scaleType),
      )

      const generatedClips: Clip[] = []
      chordProgression.forEach((notes, chordIndex) => {
        const chordStart = Math.max(0, Math.min(TIMELINE_BEATS - 0.25, start + chordIndex * safeLength))
        if (chordStart >= TIMELINE_BEATS) return
        const lengthBeats = clampChordLength(chordStart, safeLength)

        notes.forEach((noteHz) => {
          generatedClips.push({
            id: makeChordClipId(trackId),
            startBeat: chordStart,
            lengthBeats,
            noteHz,
            wave: randomChordWave(),
            name: `Chord ${safePreset} ${chordIndex + 1}`,
          })
        })
      })

      if (generatedClips.length === 0) return prev

      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: [...t.clips, ...generatedClips] }
            : t,
        ),
      }
    })
  }

  const generateMelody = (
    trackId: string,
    options?: { startBeat?: number; noteCount?: number; stepBeats?: number },
  ) => {
    if (isPlaying) return

    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked || track.isDrumTrack) return prev

      const safeScaleType = resolveScaleType(prev.scaleType)
      const scaleFrequencies = buildScaleNoteFrequencies(prev.scaleKey ?? 'C', safeScaleType)
      if (scaleFrequencies.length === 0) return prev

      const noteCount = Number.isFinite(options?.noteCount)
        ? Math.max(4, Math.min(16, Math.round(Number(options?.noteCount))))
        : 8
      const stepBeats = Number.isFinite(options?.stepBeats)
        ? normalizeMelodyStep(Number(options?.stepBeats))
        : 0.5
      const start = Number.isFinite(options?.startBeat)
        ? clampTimelineBeat(Number(options?.startBeat))
        : clampTimelineBeat(Math.round(useDAWStore.getState().playheadBeat * 2) / 2)

      const generatedClips: Clip[] = []
      let prevNote: number | undefined

      for (let i = 0; i < noteCount; i++) {
        const clipStart = clampTimelineBeat(start + i * stepBeats)
        if (clipStart >= TIMELINE_BEATS) break

        const lengthBeats = clampMelodyLength(clipStart, randomMelodyDuration())
        const noteHz = pickScaleFrequency(scaleFrequencies, prevNote)
        prevNote = noteHz

        generatedClips.push({
          id: makeMelodyClipId(trackId),
          startBeat: clipStart,
          lengthBeats,
          noteHz,
          wave: randomMelodyWave(),
          name: `Melody ${i + 1}`,
        })
      }

      if (generatedClips.length === 0) return prev

      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: [...t.clips, ...generatedClips] }
            : t,
        ),
      }
    })
  }

  const normalizeClipGains = () => {
    if (isPlaying) return

    applyProjectUpdate((prev) => {
      const hasAnyUnlockedClip = prev.tracks.some((track) => !track.locked && track.clips.length > 0)
      if (!hasAnyUnlockedClip) return prev

      return {
        ...prev,
        tracks: prev.tracks.map((track) => {
          if (track.locked || track.clips.length === 0) return track
          return {
            ...track,
            clips: track.clips.map((clip) => ({
              ...clip,
              gain: 1.0,
            })),
          }
        }),
      }
    })
  }

  const applyMagicPolish = () => {
    if (isPlaying) return

    applyProjectUpdate((prev) => {
      const hasAnyUnlockedTrack = prev.tracks.some((track) => !track.locked)
      if (!hasAnyUnlockedTrack) return prev

      const polishedTracks = prev.tracks.map((track) => {
        if (track.locked) return track

        const clips = track.clips.map((clip) => ({
          ...clip,
          gain: 0.9,
        }))

        return {
          ...track,
          clips,
          compressorEnabled: true,
          compressorThreshold: -20,
          compressorRatio: 4,
          reverbEnabled: true,
          reverbMix: 0.2,
          reverbDecay: 1.8,
        }
      })

      return {
        ...prev,
        tracks: polishedTracks,
      }
    })

    setMasterVolume(0.85)
  }


  const applyMoodPreset = (mood: MoodPreset) => {
    if (isPlaying) return

    const preset = MOOD_PRESETS[mood]
    if (!preset) return

    generateStyleStarter(preset.styleGenre)

    applyProjectUpdate((prev) => ({
      ...prev,
      bpm: preset.bpm,
      tempoCurveType: 'constant',
      tempoCurveTargetBpm: preset.bpm,
      scaleKey: preset.scaleKey,
      scaleType: preset.scaleType,
    }))

    const firstUnlockedTrackId = useDAWStore.getState().project.tracks.find((t) => !t.locked && !t.isDrumTrack)?.id
    if (!firstUnlockedTrackId) return

    const progression = buildChordFrequencies(preset.chordPreset, preset.scaleKey, preset.scaleType)
    const chordLength = 2

    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => {
        if (track.id !== firstUnlockedTrackId || track.locked || track.isDrumTrack) return track

        const clipsOutsideDraft = track.clips.filter((clip) => clip.startBeat >= 16)
        const moodChordClips: Clip[] = []

        progression.forEach((notes, chordIndex) => {
          const chordStart = chordIndex * chordLength
          if (chordStart >= 8) return
          notes.forEach((noteHz) => {
            moodChordClips.push({
              id: makeChordClipId(track.id),
              startBeat: chordStart,
              lengthBeats: chordLength,
              noteHz,
              wave: track.clips[0]?.wave ?? 'organ',
              gain: 0.9,
              name: `${mood.toUpperCase()} Chord ${chordIndex + 1}`,
            })
          })
        })

        return {
          ...track,
          clips: [...moodChordClips, ...clipsOutsideDraft],
        }
      }),
    }))
  }

  const generateStyleStarter = (genre: StyleStarterGenre) => {
    if (isPlaying) return

    applyProjectUpdate((prev) => {
      const preset = STYLE_STARTER_PRESETS[genre] ?? STYLE_STARTER_PRESETS.lofi
      const unlockedTracks = prev.tracks.filter((t) => !t.locked)
      if (unlockedTracks.length === 0) return prev

      const totalBars = 8
      const totalBeats = Math.min(TIMELINE_BEATS, totalBars * 2)
      const chordTrackId = unlockedTracks[0]?.id
      const bassTrackId = unlockedTracks[1]?.id ?? unlockedTracks[0]?.id
      const drumTrackId = unlockedTracks[2]?.id ?? unlockedTracks[0]?.id
      if (!chordTrackId || !bassTrackId || !drumTrackId) return prev

      const chordTrack = prev.tracks.find((t) => t.id === chordTrackId)
      const bassTrack = prev.tracks.find((t) => t.id === bassTrackId)
      const drumTrack = prev.tracks.find((t) => t.id === drumTrackId)
      if (!chordTrack || !bassTrack || !drumTrack) return prev
      if (chordTrack.isDrumTrack || bassTrack.isDrumTrack) return prev

      const progression = buildChordFrequencies(preset.chordPreset, preset.scaleKey, preset.scaleType)
      const chordLength = 2
      const chordClips: Clip[] = []
      progression.forEach((notes, chordIndex) => {
        const chordStart = chordIndex * chordLength
        if (chordStart >= totalBeats) return
        notes.forEach((noteHz) => {
          chordClips.push({
            id: makeChordClipId(chordTrackId),
            startBeat: chordStart,
            lengthBeats: chordLength,
            noteHz,
            wave: preset.chordWave,
            gain: 0.9,
            name: `${genre.toUpperCase()} Chord ${chordIndex + 1}`,
          })
        })
      })

      const scaleFreq = buildScaleNoteFrequencies(preset.scaleKey, preset.scaleType)
      const bassRoot = scaleFreq[0] ?? 110
      const bassClips: Clip[] = preset.bassPattern
        .filter((step) => step < totalBeats)
        .map((step, idx) => ({
          id: makeMelodyClipId(bassTrackId),
          startBeat: step,
          lengthBeats: 1,
          noteHz: bassRoot / 2,
          wave: preset.bassWave,
          gain: 0.85,
          name: `${genre.toUpperCase()} Bass ${idx + 1}`,
        }))

      const drumSeq = {
        kick: Array.from({ length: TIMELINE_BEATS }, (_, i) => preset.drum.kick.includes(i) && i < totalBeats),
        snare: Array.from({ length: TIMELINE_BEATS }, (_, i) => preset.drum.snare.includes(i) && i < totalBeats),
        hihat: Array.from({ length: TIMELINE_BEATS }, (_, i) => preset.drum.hihat.includes(i) && i < totalBeats),
      }

      return {
        ...prev,
        bpm: preset.bpm,
        tempoCurveType: 'constant',
        tempoCurveTargetBpm: preset.bpm,
        scaleKey: preset.scaleKey,
        scaleType: preset.scaleType,
        tracks: prev.tracks.map((track) => {
          if (track.id === chordTrackId) {
            return {
              ...track,
              clips: [...track.clips.filter((clip) => clip.startBeat >= totalBeats), ...chordClips],
            }
          }

          if (track.id === bassTrackId) {
            return {
              ...track,
              clips: [...track.clips.filter((clip) => clip.startBeat >= totalBeats), ...bassClips],
            }
          }

          if (track.id === drumTrackId) {
            return {
              ...track,
              isDrumTrack: true,
              drumSequence: drumSeq,
            }
          }

          return track
        }),
      }
    })
  }

  const continueTrackIdea = (
    trackId: string,
    profile: 'conservative' | 'balanced' | 'bold',
    options?: { lockRhythm?: boolean; lockPitch?: boolean },
  ) => {
    if (isPlaying) return

    const lockRhythm = Boolean(options?.lockRhythm)
    const lockPitch = Boolean(options?.lockPitch)

    applyProjectUpdate((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId)
      if (!track || track.locked || track.isDrumTrack) return prev

      const safeScaleType = resolveScaleType(prev.scaleType)
      const scaleFrequencies = buildScaleNoteFrequencies(prev.scaleKey ?? 'C', safeScaleType)
      if (scaleFrequencies.length === 0) return prev

      const sorted = [...track.clips].sort((a, b) => a.startBeat - b.startBeat)
      const recent = sorted.slice(-8)
      const lastClip = recent[recent.length - 1]
      const baseStart = lastClip ? clampTimelineBeat(lastClip.startBeat + lastClip.lengthBeats) : 0

      const variants: Record<'conservative' | 'balanced' | 'bold', { noteCount: number; step: number; jumpRange: number; minLen: number; maxLen: number; wavePool: WaveType[] }> = {
        conservative: { noteCount: 4, step: 0.5, jumpRange: 2, minLen: 0.5, maxLen: 1, wavePool: ['sine', 'triangle', 'organ'] },
        balanced: { noteCount: 5, step: 0.5, jumpRange: 4, minLen: 0.5, maxLen: 1.5, wavePool: ['sine', 'triangle', 'organ', 'brass'] },
        bold: { noteCount: 6, step: 0.25, jumpRange: 7, minLen: 0.25, maxLen: 1.5, wavePool: ['square', 'sawtooth', 'brass', 'organ'] },
      }
      const cfg = variants[profile]

      const avgGain = recent.length > 0
        ? recent.reduce((sum, clip) => sum + (clip.gain ?? 1), 0) / recent.length
        : 0.9
      const baseWave = recent.length > 0 ? (recent[recent.length - 1]?.wave ?? 'sine') : 'sine'

      const lastHz = lastClip?.noteHz
      const nearestIndex = typeof lastHz === 'number'
        ? scaleFrequencies.reduce((best, hz, idx) => Math.abs(hz - lastHz) < Math.abs(scaleFrequencies[best] - lastHz) ? idx : best, 0)
        : Math.floor(scaleFrequencies.length / 2)

      const pitchPattern = recent.slice(-cfg.noteCount).map((clip) => clip.noteHz)
      const rhythmPattern = recent.slice(-cfg.noteCount).map((clip) => ({
        startOffset: clip.startBeat - baseStart,
        lengthBeats: clip.lengthBeats,
      }))

      const generated: Clip[] = []
      for (let i = 0; i < cfg.noteCount; i++) {
        const startBeat = lockRhythm && rhythmPattern[i]
          ? clampTimelineBeat(baseStart + Math.max(0, rhythmPattern[i].startOffset))
          : clampTimelineBeat(baseStart + i * cfg.step)
        if (startBeat >= TIMELINE_BEATS) break

        const noteHz = lockPitch && typeof pitchPattern[i] === 'number'
          ? pitchPattern[i]
          : (() => {
            const jitter = Math.floor((Math.random() * (cfg.jumpRange * 2 + 1)) - cfg.jumpRange)
            const idx = Math.max(0, Math.min(scaleFrequencies.length - 1, nearestIndex + jitter))
            return scaleFrequencies[idx]
          })()

        const lengthBeats = lockRhythm && rhythmPattern[i]
          ? clampMelodyLength(startBeat, normalizeMelodyStep(rhythmPattern[i].lengthBeats))
          : (() => {
            const lengthBase = cfg.minLen + Math.random() * (cfg.maxLen - cfg.minLen)
            return clampMelodyLength(startBeat, normalizeMelodyStep(lengthBase))
          })()

        const preferBaseWave = Math.random() < 0.6
        const wave = preferBaseWave
          ? baseWave
          : cfg.wavePool[Math.floor(Math.random() * cfg.wavePool.length)]

        generated.push({
          id: makeMelodyClipId(trackId),
          startBeat,
          lengthBeats,
          noteHz,
          wave,
          gain: Math.max(0, Math.min(1.25, avgGain + (Math.random() - 0.5) * 0.12)),
          name: `Continue ${profile} ${i + 1}`,
        })
      }

      if (generated.length === 0) return prev

      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? { ...t, clips: [...t.clips, ...generated] }
            : t,
        ),
      }
    })
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

  const addAudioFileClip = (trackId: string, beat: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64data = e.target?.result as string
      if (!base64data) return
      
      applyProjectUpdate((prev) => {
        const next = structuredClone(prev)
        const track = next.tracks.find((t) => t.id === trackId)
        if (!track || track.locked) return prev
        const lengthBeats = 4 // Default length for imported audio
        const startBeat = resolveNonOverlappingStart(track.clips, lengthBeats, Math.min(beat, TIMELINE_BEATS - lengthBeats))
        const newClip: Clip = {
          id: `${trackId}-clip-${Date.now()}`,
          name: file.name.substring(0, 20),
          startBeat,
          lengthBeats,
          noteHz: 440,
          wave: 'sine',
          audioData: base64data
        }
        track.clips.push(newClip)
        return next
      })
      // The audio engine will load it when it plays, but we can preemptively cache it
      // Wait, we don't have the new clip ID easily outside unless we generate it here
      // But it's fine, AudioEngine will fetch/decode it on first play or preview.
    }
    reader.readAsDataURL(file)
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
      isCopyDrag: e.altKey,
    }
    
    useDAWStore.getState().setClipDrag({
      isDragging: true,
      trackId,
      clipId,
      originStartBeat,
      lengthBeats,
      targetTrackId: trackId,
      targetStartBeat: originStartBeat,
      targetConflicts: false,
      isCopy: e.altKey,
    })

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
      let targetTrackId = state.trackId
      if (timelineEl) {
        const rows = timelineEl.querySelectorAll('[data-testid^="track-row-"]')
        for (const row of rows) {
          const rect = (row as HTMLElement).getBoundingClientRect()
          if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
            targetTrackId = (row as HTMLElement).getAttribute('data-testid')!.replace('track-row-', '')
            break
          }
        }
      }

      const targetTrack = project.tracks.find(t => t.id === targetTrackId)
      let conflicts = false
      let resolvedStart = nextStart
      const isCopyDrag = moveEvent.altKey
      state.isCopyDrag = isCopyDrag
      
      if (targetTrack && !targetTrack.locked) {
        const srcTrack = state.originProject.tracks.find(t => t.id === state.trackId)
        const srcClip = srcTrack?.clips.find(c => c.id === state.clipId)
        if (srcClip) {
          // If moving across tracks, try resolving non-overlapping. But we only visually show it.
          // Wait, if it's the same track, we should exclude itself from conflict check.
          const otherClips = targetTrack.clips.filter(c => !(targetTrackId === state.trackId && c.id === state.clipId))
          resolvedStart = resolveNonOverlappingStart(otherClips, srcClip.lengthBeats, nextStart)
          conflicts = otherClips.some(c => rangesOverlap(resolvedStart, srcClip.lengthBeats, c.startBeat, c.lengthBeats))
        }
      }

      useDAWStore.getState().setClipDrag({
        isDragging: true,
        trackId: state.trackId,
        clipId: state.clipId,
        originStartBeat: state.originStartBeat,
        lengthBeats: state.lengthBeats,
        targetTrackId,
        targetStartBeat: resolvedStart,
        targetConflicts: conflicts,
        isCopy: isCopyDrag,
      })
    }

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const state = dragStateRef.current
      if (!state) return
      if (keyEvent.key === 'Escape') {
        cancelled = true
        cleanup()
      }
    }

    const cleanup = () => {
      const state = dragStateRef.current
      
      const currentDrag = useDAWStore.getState().clipDrag
      
      if (state && currentDrag && state.hasMoved && !cancelled) {
        if (!currentDrag.targetConflicts) {
          // Apply changes to project
          const srcTrackId = currentDrag.trackId
          const tgtTrackId = currentDrag.targetTrackId
          const clipId = currentDrag.clipId
          const nextStart = currentDrag.targetStartBeat
          
          if (currentDrag.isCopy) {
            const sourceTrack = state.originProject.tracks.find(t => t.id === srcTrackId)
            const sourceClip = sourceTrack?.clips.find(c => c.id === clipId)
            const targetTrack = project.tracks.find(t => t.id === tgtTrackId)
            if (sourceClip && targetTrack && !targetTrack.locked) {
              const copyClipId = `${tgtTrackId}-copy-${Date.now()}`
              setProject(prev => ({
                ...prev,
                tracks: prev.tracks.map(t => {
                  if (t.id !== tgtTrackId) return t
                  return {
                    ...t,
                    clips: [...t.clips, { ...sourceClip, id: copyClipId, startBeat: nextStart }],
                  }
                }),
              }))
              pushHistory(state.originProject)
              setSelectedTrackId(tgtTrackId)
              setSelectedClipRef({ trackId: tgtTrackId, clipId: copyClipId })
            }
          } else if (srcTrackId === tgtTrackId) {
            updateClipStartBeat(srcTrackId, clipId, nextStart)
            pushHistory(state.originProject)
          } else {
            const targetTrack = project.tracks.find(t => t.id === tgtTrackId)
            if (targetTrack && !targetTrack.locked) {
              const srcTrack = state.originProject.tracks.find(t => t.id === srcTrackId)
              const srcClip = srcTrack?.clips.find(c => c.id === clipId)
              if (srcClip) {
                setProject(prev => ({
                  ...prev,
                  tracks: prev.tracks.map(t => {
                    if (t.id === srcTrackId) {
                      return { ...t, clips: t.clips.filter(c => c.id !== clipId) }
                    }
                    if (t.id === tgtTrackId) {
                      return { ...t, clips: [...t.clips, { ...srcClip, startBeat: nextStart }] }
                    }
                    return t
                  })
                }))
                pushHistory(state.originProject)
              }
            }
          }
        }
      }
      
      useDAWStore.getState().setClipDrag(null)

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

      const isMetaRedoY = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y'
      if (isMetaRedoY) {
        event.preventDefault()
        redo()
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

      if (isReferenceShortcutKey(event)) {
        if (!referenceTrack) return
        event.preventDefault()
        toggleReferenceAB()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cutClip, isPlaying, project, copyClip, deleteClip, pasteClip, pausePlayback, redo, referenceTrack, selectedClipRef, selectedTrackId, startPlayback, stopPlayback, toggleReferenceAB, undo])

  return {
    project,
    isPlaying,
    metronomeEnabled,
    masterVolume,
    masterEQ,
    masterPreset,
    loopEnabled,
    loopLengthBeats,
    selectedTrackId,
    selectedClipRef,
    selectedClipRefs,
    clipboard,
    favoriteClips,
    favoriteClipSearchQuery,
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
    chordSuggestions,
    meterCanvasRef,
    timelineRef,
    setProject,
    setIsPlaying,
    setMetronomeEnabled,
    setPlayheadBeat,
    setMasterVolume,
    setMasterEQ,
    applyMasterPreset,
    resetMasterPresetToBaseline,
    setLoopEnabled,
    setLoopLengthBeats,
    setSelectedTrackId,
    setSelectedClipRef,
    setSelectedClipRefs,
    addSelectedClipRef,
    removeSelectedClipRef,
    setClipboard,
    setFavoriteClipSearchQuery,
    saveFavoriteClipFromSelection,
    pasteFavoriteClipToTrack,
    deleteFavoriteClip,
    applyProjectUpdate,
    addMarker,
    renameMarker,
    removeMarker,
    jumpToMarker,
    addClip,
    addClipAtBeat,
    addAudioFileClip,
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
    addDrumTrack,
    toggleDrumStep,
    deleteTrack,
    moveTrack,
    duplicateTrack,
    freezeTrack,
    unfreezeTrack,
    setSelectedClipWave,
    setSelectedClipNote,
    updateClipStartBeat,
    setClipColor,
    setClipName,
    updateClipGain,
    updateClipEnvelopePoint,
    resetClipEnvelope,
    updateClipFades,
    updateClipTranspose,
    updateClipLengthBeats,
    quantizeClip,
    insertChordPreset,
    generateMelody,
    normalizeClipGains,
    applyMagicPolish,
    applyMoodPreset,
    generateStyleStarter,
    continueTrackIdea,
    handleMIDIImport,
    handleMIDIExport,
    handleAudioExport,
    handleMp3Export,
    importReferenceTrack,
    clearReferenceTrack,
    toggleReferenceAB,
    monitorSource,
    referenceTrack,
    lastExportLoudnessReport,
    autoMixSuggestionItems,
    autoMixAvailable,
    autoMixPreviewMode,
    autoMixCoverageReady,
    runAutoMixAssistant,
    toggleAutoMixSuggestion,
    previewAutoMixVersion,
    enableVocalCleanChain,
    handleSocialPublish,
    handleExportProjectCard,
    handleTapTempo,
    isRecording,
    toggleRecording,
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
