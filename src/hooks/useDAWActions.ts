import React, { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { ArrangementVariation, BandProfile, BusGroup, Clip, ExportTargetPreset, ExportTargetPresetKey, ExportVersionEntry, FavoriteClip, FrozenTrackSnapshot, MasterEQ, MasterPreset, MixReportEntry, ProjectState, ReferenceMatchReport, ReferenceMatchSuggestion, Track, WaveType } from '../types'
import { useDAWStore } from '../store/useDAWStore'
import { audioEngine } from '../audio/AudioEngine'
import { audioBufferToMp3 } from '../utils/audioBufferToMp3'
import { audioBufferToWav } from '../utils/audioBufferToWav'
import { getTimelineDurationSec, secondsToBeat } from '../utils/tempoCurve'
import { buildSocialExportBaseName, createSocialCardBlob, createSocialPackageZipBlob, isPublishTemplateReady, isReleaseMetadataReady, normalizePublishTemplate, normalizeReleaseMetadata, parseReleaseTags, releaseTagsToText, triggerDownload } from '../utils/socialPublish'
import { zipSync, strToU8 } from 'fflate'
import { analyzeChordSuggestions } from '../utils/chordSuggestion'
import { hzToClosestNoteLabel } from '../utils/notes'

export const TIMELINE_BEATS = 16

const EXPORT_TARGET_PRESETS: Record<Exclude<ExportTargetPresetKey, 'custom'>, ExportTargetPreset> = {
  'short-video': {
    key: 'short-video',
    sampleRate: 44100,
    bitrateKbps: 192,
    targetLoudnessDb: -14,
    peakLimitDb: -1,
  },
  podcast: {
    key: 'podcast',
    sampleRate: 44100,
    bitrateKbps: 128,
    targetLoudnessDb: -16,
    peakLimitDb: -1,
  },
  'music-platform': {
    key: 'music-platform',
    sampleRate: 48000,
    bitrateKbps: 256,
    targetLoudnessDb: -14,
    peakLimitDb: -1,
  },
  general: {
    key: 'general',
    sampleRate: 44100,
    bitrateKbps: 192,
    targetLoudnessDb: -14,
    peakLimitDb: -1,
  },
}

const DEFAULT_EXPORT_TARGET_PRESET: ExportTargetPreset = EXPORT_TARGET_PRESETS.general

function normalizeExportTargetPreset(input: Partial<ExportTargetPreset> | null | undefined): ExportTargetPreset {
  const key = input?.key
  if (!key || key === 'custom') {
    return {
      key: key ?? DEFAULT_EXPORT_TARGET_PRESET.key,
      sampleRate: Number.isFinite(input?.sampleRate) ? Math.max(22050, Math.min(96000, Math.round(input!.sampleRate!))) : DEFAULT_EXPORT_TARGET_PRESET.sampleRate,
      bitrateKbps: Number.isFinite(input?.bitrateKbps) ? Math.max(64, Math.min(320, Math.round(input!.bitrateKbps!))) : DEFAULT_EXPORT_TARGET_PRESET.bitrateKbps,
      targetLoudnessDb: Number.isFinite(input?.targetLoudnessDb) ? Number(input!.targetLoudnessDb) : DEFAULT_EXPORT_TARGET_PRESET.targetLoudnessDb,
      peakLimitDb: Number.isFinite(input?.peakLimitDb) ? Number(input!.peakLimitDb) : DEFAULT_EXPORT_TARGET_PRESET.peakLimitDb,
    }
  }
  return EXPORT_TARGET_PRESETS[key]
}

function exportPresetLabel(key: ExportTargetPresetKey) {
  if (key === 'short-video') return '短视频平台'
  if (key === 'podcast') return '播客'
  if (key === 'music-platform') return '音乐平台'
  if (key === 'general') return '通用'
  return '自定义'
}

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

function clampVariationRange(startBeat: number, lengthBeats: number) {
  const safeLength = Math.max(8, Math.min(TIMELINE_BEATS, Math.round(lengthBeats)))
  const safeStart = Math.max(0, Math.min(TIMELINE_BEATS - safeLength, Math.round(startBeat)))
  return { safeStart, safeLength }
}

function clipIntersectsRange(clip: Clip, rangeStartBeat: number, rangeLengthBeats: number) {
  return rangesOverlap(clip.startBeat, clip.lengthBeats, rangeStartBeat, rangeLengthBeats)
}

function buildArrangementVariation(
  project: ProjectState,
  profile: ArrangementVariation['name'],
  rangeStartBeat: number,
  rangeLengthBeats: number,
): ArrangementVariation {
  const { safeStart, safeLength } = clampVariationRange(rangeStartBeat, rangeLengthBeats)
  const rangeEnd = safeStart + safeLength
  const sections = profile === 'conservative'
    ? [
        { name: 'Verse', density: 1 },
        { name: 'Pre', density: 0.85 },
        { name: 'Chorus', density: 1 },
        { name: 'Drop', density: 0.8 },
      ]
    : profile === 'aggressive'
      ? [
          { name: 'Intro', density: 0.65 },
          { name: 'Verse', density: 1 },
          { name: 'Break', density: 0.55 },
          { name: 'Chorus', density: 1.15 },
          { name: 'Drop', density: 1.25 },
          { name: 'Outro', density: 0.75 },
        ]
      : [
          { name: 'Intro', density: 0.8 },
          { name: 'Verse', density: 1 },
          { name: 'Chorus', density: 1.1 },
          { name: 'Drop', density: 1.05 },
        ]

  const sectionSpan = Math.max(1, safeLength / sections.length)
  const sectionStarts = sections.map((_, index) => Math.max(safeStart, Math.min(rangeEnd - 1, Math.floor(safeStart + index * sectionSpan))))

  const tracks = project.tracks.map((track) => {
    const sourceClips = track.clips
      .filter((clip) => clipIntersectsRange(clip, safeStart, safeLength))
      .sort((a, b) => a.startBeat - b.startBeat)

    if (sourceClips.length === 0) {
      return { trackId: track.id, clips: [] }
    }

    const arranged: Clip[] = []
    sectionStarts.forEach((sectionStart, idx) => {
      const sourceClip = sourceClips[idx % sourceClips.length]
      const section = sections[idx]
      const maxLength = Math.max(0.25, rangeEnd - sectionStart)
      let nextLength = sourceClip.lengthBeats
      if (profile === 'conservative') {
        nextLength = Math.max(0.5, Math.min(maxLength, Math.round(nextLength * 2) / 2))
      } else if (profile === 'standard') {
        nextLength = Math.max(0.5, Math.min(maxLength, Math.round(nextLength * (section.density >= 1.1 ? 0.9 : 1.05) * 2) / 2))
      } else {
        nextLength = Math.max(0.25, Math.min(maxLength, Math.round(nextLength * (section.density >= 1.1 ? 0.75 : 1.2) * 4) / 4))
      }

      const variationClip: Clip = {
        ...sourceClip,
        id: `${track.id}-variation-${profile}-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startBeat: sectionStart,
        lengthBeats: nextLength,
        name: `${section.name} ${idx + 1}`,
      }

      arranged.push(variationClip)

      if (profile === 'aggressive' && section.density >= 1.15 && sectionStart + nextLength < rangeEnd) {
        const echoLength = Math.max(0.25, Math.min(nextLength * 0.5, rangeEnd - (sectionStart + nextLength)))
        if (echoLength > 0.24) {
          arranged.push({
            ...variationClip,
            id: `${variationClip.id}-echo`,
            startBeat: Math.min(rangeEnd - echoLength, sectionStart + nextLength),
            lengthBeats: echoLength,
            gain: Math.max(0.15, (variationClip.gain ?? 1) * 0.78),
          })
        }
      }
    })

    const clamped = arranged
      .map((clip) => {
        const startBeat = Math.max(safeStart, Math.min(rangeEnd - 0.25, clip.startBeat))
        const lengthBeats = Math.max(0.25, Math.min(rangeEnd - startBeat, clip.lengthBeats))
        return { ...clip, startBeat, lengthBeats }
      })
      .filter((clip) => clip.startBeat >= safeStart && clip.startBeat < rangeEnd && clip.lengthBeats > 0)

    return {
      trackId: track.id,
      clips: clamped,
    }
  })

  const markers = sectionStarts.map((beat, idx) => ({
    id: crypto.randomUUID(),
    name: `${sections[idx]?.name ?? 'Section'} (${profile})`,
    beat,
  }))

  return {
    id: crypto.randomUUID(),
    name: profile,
    createdAt: Date.now(),
    rangeStartBeat: safeStart,
    rangeLengthBeats: safeLength,
    tracks,
    markers,
  }
}

function applyArrangementVariationToProject(project: ProjectState, variation: ArrangementVariation): ProjectState {
  const rangeStart = variation.rangeStartBeat
  const rangeEnd = variation.rangeStartBeat + variation.rangeLengthBeats
  const trackClipMap = new Map(variation.tracks.map((entry) => [entry.trackId, entry.clips]))

  return {
    ...project,
    tracks: project.tracks.map((track) => {
      const replacement = trackClipMap.get(track.id)
      if (!replacement) return track
      const outsideRange = track.clips.filter((clip) => !clipIntersectsRange(clip, rangeStart, variation.rangeLengthBeats))
      return {
        ...track,
        clips: [...outsideRange, ...replacement].sort((a, b) => a.startBeat - b.startBeat),
      }
    }),
    markers: [
      ...(project.markers ?? []).filter((marker) => marker.beat < rangeStart || marker.beat >= rangeEnd),
      ...variation.markers,
    ].sort((a, b) => a.beat - b.beat),
    arrangementVariationBundle: project.arrangementVariationBundle
      ? {
          ...project.arrangementVariationBundle,
          activeVariantId: variation.id,
        }
      : undefined,
  }
}

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

function quantizeFrequencyToScale(
  frequency: number,
  scaleKey: string,
  scaleType: 'major' | 'minor' | 'chromatic',
): number {
  if (!Number.isFinite(frequency) || frequency <= 0) return 440
  if (scaleType === 'chromatic') return frequency

  const midi = 69 + 12 * Math.log2(frequency / 440)
  const roundedMidi = Math.round(midi)
  const octave = Math.floor(roundedMidi / 12)
  const root = resolveScaleSemitoneRoot(scaleKey)
  const allowedDegrees = scaleType === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]

  let bestMidi = roundedMidi
  let bestDistance = Number.POSITIVE_INFINITY
  for (let offset = -24; offset <= 24; offset++) {
    const candidateMidi = roundedMidi + offset
    const noteClass = ((candidateMidi % 12) + 12) % 12
    const relative = (noteClass - root + 12) % 12
    if (!allowedDegrees.includes(relative)) continue
    const distance = Math.abs(candidateMidi - midi)
    if (distance < bestDistance) {
      bestDistance = distance
      bestMidi = candidateMidi
    }
  }

  const fallbackMidi = octave * 12 + root
  return midiNoteToFrequency(Number.isFinite(bestMidi) ? bestMidi : fallbackMidi)
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

function buildMixReportSuggestions(input: {
  peakDb: number
  rmsDb: number
  loudnessDistribution: { quiet: number; balanced: number; hot: number }
  topTrack: { name: string; peakDb: number } | null
}): string[] {
  const suggestions: string[] = []
  if (input.peakDb > -1) {
    suggestions.push('主输出峰值接近 0 dB，建议先下调 Master 或最响轨道约 1-2 dB。')
  }
  if (input.rmsDb < -24) {
    suggestions.push('整体响度偏低，建议提升鼓组/主旋律电平后再导出。')
  } else if (input.rmsDb > -10) {
    suggestions.push('整体响度偏高，建议降低压缩或总线增益，避免听感疲劳。')
  }
  if (input.loudnessDistribution.hot >= Math.max(1, input.loudnessDistribution.balanced + input.loudnessDistribution.quiet)) {
    suggestions.push('高响度轨道占比偏多，可优先对和声或铺底轨做 -1 dB 微调，留出主唱/主旋律空间。')
  }
  if (input.topTrack && input.topTrack.peakDb > -1.5) {
    suggestions.push(`当前最响轨道是「${input.topTrack.name}」，建议优先检查该轨道瞬态与限幅。`)
  }
  if (suggestions.length === 0) {
    suggestions.push('当前混音处于可发布区间，下一步可尝试 A/B 对比最近导出版本做微调。')
  }
  return suggestions.slice(0, 3)
}

function buildMixReportFromExport(input: {
  project: ProjectState
  exportFormat: 'wav' | 'mp3'
  durationSec: number
  loudness: ExportLoudnessReport
}): MixReportEntry {
  const trackSummaries = input.project.tracks
    .filter((track) => track.isDrumTrack || track.clips.length > 0)
    .map((track) => {
      const peaks = track.clips.map((clip) => {
        const gain = Math.max(0.0001, clip.gain ?? 1)
        return 20 * Math.log10(gain * Math.max(0.0001, track.volume || 1))
      })
      const peakDb = peaks.length > 0 ? Math.max(...peaks) : -Infinity
      const rmsDb = peaks.length > 0
        ? peaks.reduce((sum, v) => sum + v, 0) / peaks.length - 6
        : -Infinity
      return {
        trackId: track.id,
        trackName: track.name,
        peakDb,
        rmsDb,
      }
    })
    .sort((a, b) => b.peakDb - a.peakDb)

  const loudnessDistribution = trackSummaries.reduce(
    (acc, track) => {
      if (track.rmsDb < -24) acc.quiet += 1
      else if (track.rmsDb > -12) acc.hot += 1
      else acc.balanced += 1
      return acc
    },
    { quiet: 0, balanced: 0, hot: 0 },
  )

  const topTrack = trackSummaries.length > 0
    ? trackSummaries.reduce((max, item) => (item.peakDb > max.peakDb ? item : max), trackSummaries[0])
    : null

  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    exportFormat: input.exportFormat,
    durationSec: input.durationSec,
    projectPeakDb: input.loudness.peakDb,
    projectRmsDb: input.loudness.rmsDb,
    loudnessDistribution,
    trackSummaries,
    suggestions: buildMixReportSuggestions({
      peakDb: input.loudness.peakDb,
      rmsDb: input.loudness.rmsDb,
      loudnessDistribution,
      topTrack: topTrack ? { name: topTrack.trackName, peakDb: topTrack.peakDb } : null,
    }),
  }
}

function sanitizeExportVersionName(name: string, fallbackIndex = 1) {
  const trimmed = name.trim()
  if (trimmed) return trimmed.slice(0, 48)
  return `版本 ${fallbackIndex}`
}


interface PreExportChecklistItem {
  key: 'empty-track' | 'master-muted' | 'peak-clipping' | 'unnamed-project' | 'loop-export-mismatch'
  label: string
  passed: boolean
  detail: string
}

interface PreExportChecklistReport {
  checkedAt: number
  failedCount: number
  items: PreExportChecklistItem[]
}

interface PreExportAutoFixLogItem {
  id: string
  key: 'unnamed-project' | 'loop-export-mismatch' | 'peak-clipping'
  label: string
  status: 'fixed' | 'skipped'
  detail: string
  undoable: boolean
}

interface PreExportAutoFixReport {
  fixedAt: number
  totalFixable: number
  fixedCount: number
  passRate: number
  logs: PreExportAutoFixLogItem[]
}

interface PreExportAutoFixUndoState {
  unnamedProjectName?: string
  loopEnabled?: boolean
  masterVolume?: number
}

const PRE_EXPORT_AUTO_FIX_LABELS: Record<'unnamed-project' | 'loop-export-mismatch' | 'peak-clipping', string> = {
  'unnamed-project': '未命名项目',
  'loop-export-mismatch': '循环区与导出区不一致',
  'peak-clipping': '主总线过载保护',
}

function toDbLinear(db: number) {
  return Math.pow(10, db / 20)
}

function buildAutoFixProjectName(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `Project-${y}${m}${d}-${hh}${mm}`
}

function buildPreExportAutoFixResult(options: {
  project: ProjectState
  loopEnabled: boolean
  masterVolume: number
  loudness: ExportLoudnessReport | null
}) {
  const undoState: PreExportAutoFixUndoState = {}
  const logs: PreExportAutoFixLogItem[] = []
  const applicableKeys: Array<'unnamed-project' | 'loop-export-mismatch' | 'peak-clipping'> = []

  let nextProject = options.project
  let nextLoopEnabled = options.loopEnabled
  let nextMasterVolume = options.masterVolume

  const normalizedProjectName = (options.project.name || '').trim().toLowerCase()
  const shouldFixUnnamedProject = normalizedProjectName.length === 0 || normalizedProjectName === 'untitled project'
  if (shouldFixUnnamedProject) {
    applicableKeys.push('unnamed-project')
    undoState.unnamedProjectName = options.project.name
    nextProject = { ...nextProject, name: buildAutoFixProjectName(), lastSavedAt: Date.now() }
    logs.push({
      id: crypto.randomUUID(),
      key: 'unnamed-project',
      label: PRE_EXPORT_AUTO_FIX_LABELS['unnamed-project'],
      status: 'fixed',
      detail: `已设置项目名为 ${nextProject.name}`,
      undoable: true,
    })
  } else {
    logs.push({
      id: crypto.randomUUID(),
      key: 'unnamed-project',
      label: PRE_EXPORT_AUTO_FIX_LABELS['unnamed-project'],
      status: 'skipped',
      detail: `当前项目名：${options.project.name?.trim()}`,
      undoable: false,
    })
  }

  const shouldFixLoopMismatch = options.loopEnabled
  if (shouldFixLoopMismatch) {
    applicableKeys.push('loop-export-mismatch')
    undoState.loopEnabled = options.loopEnabled
    nextLoopEnabled = false
    logs.push({
      id: crypto.randomUUID(),
      key: 'loop-export-mismatch',
      label: PRE_EXPORT_AUTO_FIX_LABELS['loop-export-mismatch'],
      status: 'fixed',
      detail: '已关闭 Loop，恢复全曲导出区间',
      undoable: true,
    })
  } else {
    logs.push({
      id: crypto.randomUUID(),
      key: 'loop-export-mismatch',
      label: PRE_EXPORT_AUTO_FIX_LABELS['loop-export-mismatch'],
      status: 'skipped',
      detail: '导出区间已与全曲一致',
      undoable: false,
    })
  }

  const peakDb = options.loudness?.peakDb ?? -Infinity
  const shouldFixClipping = options.loudness?.verdict === 'clipping-risk' && Number.isFinite(peakDb)
  if (shouldFixClipping) {
    applicableKeys.push('peak-clipping')
    const targetPeakDb = -1
    const requiredDb = Math.min(0, targetPeakDb - peakDb)
    const reduction = toDbLinear(requiredDb - 0.5)
    undoState.masterVolume = options.masterVolume
    nextMasterVolume = Math.max(0.01, Math.min(1, options.masterVolume * reduction))
    logs.push({
      id: crypto.randomUUID(),
      key: 'peak-clipping',
      label: PRE_EXPORT_AUTO_FIX_LABELS['peak-clipping'],
      status: 'fixed',
      detail: `峰值 ${formatDbLabel(peakDb)}，Master ${(options.masterVolume * 100).toFixed(0)}% → ${(nextMasterVolume * 100).toFixed(0)}%`,
      undoable: true,
    })
  } else {
    logs.push({
      id: crypto.randomUUID(),
      key: 'peak-clipping',
      label: PRE_EXPORT_AUTO_FIX_LABELS['peak-clipping'],
      status: 'skipped',
      detail: options.loudness ? `当前峰值 ${formatDbLabel(peakDb)}，无需过载保护` : '尚无响度检查结果，建议先执行一次导出检查',
      undoable: false,
    })
  }

  const fixedCount = logs.filter((item) => item.status === 'fixed').length
  const totalFixable = Math.max(1, applicableKeys.length)

  return {
    nextProject,
    nextLoopEnabled,
    nextMasterVolume,
    undoState,
    report: {
      fixedAt: Date.now(),
      totalFixable,
      fixedCount,
      passRate: totalFixable > 0 ? fixedCount / totalFixable : 1,
      logs,
    } satisfies PreExportAutoFixReport,
  }
}

function undoPreExportAutoFixChange(options: {
  key: 'unnamed-project' | 'loop-export-mismatch' | 'peak-clipping'
  undoState: PreExportAutoFixUndoState
  setProject: (value: ProjectState | ((prev: ProjectState) => ProjectState), options?: { saveHistory?: boolean }) => void
  setLoopEnabled: (value: boolean) => void
  setMasterVolume: (value: number) => void
}) {
  const { key, undoState, setProject, setLoopEnabled, setMasterVolume } = options

  if (key === 'unnamed-project' && undoState.unnamedProjectName !== undefined) {
    setProject((prev) => ({ ...prev, name: undoState.unnamedProjectName ?? prev.name, lastSavedAt: Date.now() }), { saveHistory: true })
    return true
  }
  if (key === 'loop-export-mismatch' && undoState.loopEnabled !== undefined) {
    setLoopEnabled(undoState.loopEnabled)
    return true
  }
  if (key === 'peak-clipping' && undoState.masterVolume !== undefined) {
    setMasterVolume(undoState.masterVolume)
    return true
  }

  return false
}

function applyUndoLog(logs: PreExportAutoFixLogItem[], key: 'unnamed-project' | 'loop-export-mismatch' | 'peak-clipping') {
  return logs.map((item) => {
    if (item.key !== key) return item
    return {
      ...item,
      status: 'skipped' as const,
      detail: `${item.detail}（已撤销）`,
      undoable: false,
    }
  })
}

function buildAutoFixPassRate(logs: PreExportAutoFixLogItem[], totalFixable: number) {
  const total = Math.max(1, totalFixable)
  const fixed = logs.filter((item) => item.status === 'fixed').length
  return fixed / total
}

function rerunChecklistForAutoFix(options: {
  project: ProjectState
  masterVolume: number
  loopEnabled: boolean
  effectiveTimelineBeats: number
  loudness: ExportLoudnessReport | null
}) {
  const loudness = options.loudness ?? {
    peakLinear: 0,
    peakDb: -Infinity,
    rmsLinear: 0,
    rmsDb: -Infinity,
    verdict: 'ready' as const,
    checkedAt: Date.now(),
  }

  return buildPreExportChecklist({
    project: options.project,
    masterVolume: options.masterVolume,
    loopEnabled: options.loopEnabled,
    effectiveTimelineBeats: options.effectiveTimelineBeats,
    loudness,
  }).report
}

interface PreExportChecklistInput {
  project: ProjectState
  masterVolume: number
  loopEnabled: boolean
  effectiveTimelineBeats: number
  loudness: ExportLoudnessReport
}

interface PreExportChecklistResult {
  report: PreExportChecklistReport
  failedItems: PreExportChecklistItem[]
}

type ProjectHealthRiskKey = 'cpu-overload' | 'muted-content-track' | 'unnamed-marker' | 'export-range-abnormal'

interface ProjectHealthRisk {
  key: ProjectHealthRiskKey
  label: string
  passed: boolean
  detail: string
  actionLabel: string
}

interface ProjectHealthReport {
  checkedAt: number
  failedCount: number
  items: ProjectHealthRisk[]
}

function buildProjectHealthReport(input: {
  project: ProjectState
  loopEnabled: boolean
  effectiveTimelineBeats: number
  timelineBeats: number
  performanceMode: 'auto' | 'on' | 'off'
}): ProjectHealthReport {
  const { project, loopEnabled, effectiveTimelineBeats, timelineBeats, performanceMode } = input

  const totalClipCount = project.tracks.reduce((sum, track) => sum + track.clips.length, 0)
  const cpuOverloadRisk = performanceMode === 'off' && totalClipCount > 30
  const mutedContentTrack = project.tracks.find((track) => track.muted && (track.isDrumTrack || track.clips.length > 0))
  const unnamedMarker = (project.markers ?? []).find((marker) => !marker.name.trim() || /^marker\s*\d*$/i.test(marker.name.trim()))
  const exportRangeAbnormal = loopEnabled && effectiveTimelineBeats !== timelineBeats

  const items: ProjectHealthRisk[] = [
    {
      key: 'cpu-overload',
      label: 'CPU 过载风险',
      passed: !cpuOverloadRisk,
      detail: cpuOverloadRisk ? `当前 ${totalClipCount} 个片段，且性能模式关闭` : `性能模式 ${performanceMode.toUpperCase()}，当前 ${totalClipCount} 个片段`,
      actionLabel: '开启性能模式',
    },
    {
      key: 'muted-content-track',
      label: '静音但有内容轨道',
      passed: !mutedContentTrack,
      detail: mutedContentTrack ? `${mutedContentTrack.name} 被静音但存在内容` : '未发现静音内容轨道',
      actionLabel: '跳转并取消静音',
    },
    {
      key: 'unnamed-marker',
      label: '未命名标记',
      passed: !unnamedMarker,
      detail: unnamedMarker ? `检测到未命名标记（@${unnamedMarker.beat.toFixed(1)} beat）` : '标记命名完整',
      actionLabel: '跳转并重命名',
    },
    {
      key: 'export-range-abnormal',
      label: '导出区间异常',
      passed: !exportRangeAbnormal,
      detail: exportRangeAbnormal ? `Loop 导出区 ${effectiveTimelineBeats} 小节（全曲 ${timelineBeats} 小节）` : '导出区间正常',
      actionLabel: '恢复全曲导出',
    },
  ]

  return {
    checkedAt: Date.now(),
    failedCount: items.filter((item) => !item.passed).length,
    items,
  }
}

function syncHealthChecklistItems(report: ProjectHealthReport, checklist: PreExportChecklistReport): PreExportChecklistReport {
  const healthMap = new Map(report.items.map((item) => [item.key, item]))
  return {
    ...checklist,
    items: checklist.items.map((item) => {
      if (item.key === 'loop-export-mismatch') {
        const health = healthMap.get('export-range-abnormal')
        if (!health) return item
        return {
          ...item,
          passed: health.passed,
          detail: health.detail,
        }
      }
      return item
    }),
  }
}

function buildUnifiedPreExportChecklist(input: PreExportChecklistInput & {
  performanceMode: 'auto' | 'on' | 'off'
  timelineBeats: number
}): { checklist: PreExportChecklistResult; healthReport: ProjectHealthReport } {
  const checklist = buildPreExportChecklist(input)
  const healthReport = buildProjectHealthReport({
    project: input.project,
    loopEnabled: input.loopEnabled,
    effectiveTimelineBeats: input.effectiveTimelineBeats,
    timelineBeats: input.timelineBeats,
    performanceMode: input.performanceMode,
  })

  return {
    checklist: {
      ...checklist,
      report: syncHealthChecklistItems(healthReport, checklist.report),
    },
    healthReport,
  }
}

function runPreExportChecks(options: {
  project: ProjectState
  masterVolume: number
  loopEnabled: boolean
  effectiveTimelineBeats: number
  timelineBeats: number
  performanceMode: 'auto' | 'on' | 'off'
  loudness: ExportLoudnessReport
  exportTargetLabel: string
  setLastPreExportChecklistReport: (report: PreExportChecklistReport) => void
  setProjectHealthReport: (report: ProjectHealthReport) => void
}) {
  const { checklist, healthReport } = buildUnifiedPreExportChecklist(options)
  const { report, failedItems } = checklist
  options.setLastPreExportChecklistReport(report)
  options.setProjectHealthReport(healthReport)
  if (!confirmIgnoreChecklistFailures(failedItems, report.items, options.exportTargetLabel)) {
    return false
  }
  return confirmLoudnessAdjust(options.loudness, options.exportTargetLabel)
}

function resolveHealthRiskAction(options: {
  riskKey: ProjectHealthRiskKey
  project: ProjectState
  setSelectedTrackId: (value: string | null) => void
  setSelectedClipRef: (value: { trackId: string; clipId: string } | null) => void
  setSelectedClipRefs: (value: { trackId: string; clipId: string }[]) => void
  setPlayheadBeat: (value: number) => void
  setProject: (value: ProjectState | ((prev: ProjectState) => ProjectState), options?: { saveHistory?: boolean }) => void
  setPerformanceMode: (value: 'auto' | 'on' | 'off') => void
  setLoopEnabled: (value: boolean) => void
  effectiveTimelineBeats: number
}) {
  const { riskKey, project, setSelectedTrackId, setSelectedClipRef, setSelectedClipRefs, setPlayheadBeat, setProject, setPerformanceMode, setLoopEnabled, effectiveTimelineBeats } = options

  if (riskKey === 'cpu-overload') {
    setPerformanceMode('on')
    return
  }

  if (riskKey === 'muted-content-track') {
    const track = project.tracks.find((item) => item.muted && (item.isDrumTrack || item.clips.length > 0))
    if (!track) return
    setSelectedTrackId(track.id)
    setSelectedClipRef(null)
    setSelectedClipRefs([])
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((item) => item.id === track.id ? { ...item, muted: false } : item),
    }), { saveHistory: true })
    return
  }

  if (riskKey === 'unnamed-marker') {
    const marker = (project.markers ?? []).find((item) => !item.name.trim() || /^marker\s*\d*$/i.test(item.name.trim()))
    if (!marker) return
    setPlayheadBeat(Math.max(0, Math.min(TIMELINE_BEATS, marker.beat)))
    const nextName = window.prompt('重命名未命名标记', marker.name.trim() || `Section ${Math.round(marker.beat)}`)
    if (!nextName || !nextName.trim()) return
    setProject((prev) => ({
      ...prev,
      markers: (prev.markers ?? []).map((item) => item.id === marker.id ? { ...item, name: nextName.trim() } : item),
    }), { saveHistory: true })
    return
  }

  if (riskKey === 'export-range-abnormal') {
    setLoopEnabled(false)
    setPlayheadBeat(Math.max(0, Math.min(TIMELINE_BEATS, effectiveTimelineBeats)))
  }
}

function buildPreExportChecklist(input: PreExportChecklistInput): PreExportChecklistResult {
  const { project, masterVolume, loopEnabled, effectiveTimelineBeats, loudness } = input
  const hasAnyEmptyTrack = project.tracks.some((track) => track.clips.length === 0)
  const isMasterMuted = masterVolume <= 0.001
  const normalizedProjectName = (project.name || '').trim().toLowerCase()
  const isUnnamedProject = normalizedProjectName.length === 0 || normalizedProjectName === 'untitled project'
  const loopMismatch = loopEnabled && effectiveTimelineBeats !== TIMELINE_BEATS
  const hasPeakClippingRisk = loudness.verdict === 'clipping-risk'

  const items: PreExportChecklistItem[] = [
    {
      key: 'empty-track',
      label: '空轨道',
      passed: !hasAnyEmptyTrack,
      detail: hasAnyEmptyTrack ? '存在无片段轨道' : '所有轨道均有片段',
    },
    {
      key: 'master-muted',
      label: '静音主总线',
      passed: !isMasterMuted,
      detail: isMasterMuted ? 'Master 音量为 0%' : `Master 音量 ${(masterVolume * 100).toFixed(0)}%`,
    },
    {
      key: 'peak-clipping',
      label: '峰值削波',
      passed: !hasPeakClippingRisk,
      detail: `峰值 ${formatDbLabel(loudness.peakDb)}`,
    },
    {
      key: 'unnamed-project',
      label: '未命名项目',
      passed: !isUnnamedProject,
      detail: isUnnamedProject ? '项目名仍为默认值' : `项目名：${project.name?.trim()}`,
    },
    {
      key: 'loop-export-mismatch',
      label: '循环区与导出区不一致',
      passed: !loopMismatch,
      detail: loopMismatch ? `当前导出 ${effectiveTimelineBeats} 小节（Loop 模式）` : '导出区与全曲一致',
    },
  ]

  const failedItems = items.filter((item) => !item.passed)
  return {
    report: {
      checkedAt: Date.now(),
      failedCount: failedItems.length,
      items,
    },
    failedItems,
  }
}

function confirmIgnoreChecklistFailures(failedItems: PreExportChecklistItem[], allItems: PreExportChecklistItem[], exportTargetLabel: string) {
  if (failedItems.length === 0) return true
  const checklistText = allItems
    .map((item) => `${item.passed ? '✅ 通过' : '❌ 未通过'} · ${item.label}（${item.detail}）`)
    .join('\n')
  return window.confirm(
    `导出清单校验：${failedItems.length} 项未通过\n\n${checklistText}\n\n默认已阻止一键导出。是否忽略未通过项并继续导出 ${exportTargetLabel}？`
  )
}

function confirmLoudnessAdjust(loudness: ExportLoudnessReport, exportTargetLabel: string) {
  if (loudness.verdict !== 'adjust') return true
  return window.confirm(`导出前响度检查：\n峰值：${formatDbLabel(loudness.peakDb)}\n整体响度（RMS）：${formatDbLabel(loudness.rmsDb)}\n结论：建议调整后再发布。\n\n是否仍继续导出 ${exportTargetLabel}？`)
}

interface ReferenceTrackState {
  fileName: string
  objectUrl: string
  rawRmsDb: number | null
  matchedGainDb: number
  matchedDeltaDb: number
  bandProfile?: BandProfile
}

type MonitorSource = 'project' | 'reference'
type ReferenceMatchTarget =
  | { type: 'export-version'; id: string }
  | { type: 'reference-track' }

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

type ChorusLiftToggleKey = 'drumDensity' | 'harmonyThicken' | 'gainLift'
type ChorusDoubleHarmonyToggleKey = 'highOctaveHarmony'
type SectionEnergyAutomationType = 'intro' | 'verse' | 'chorus' | 'drop' | 'other'

interface SectionEnergyOption {
  id: string
  name: string
  startBeat: number
  endBeat: number
  type: SectionEnergyAutomationType
}

interface SectionEnergyProfile {
  startGain: number
  endGain: number
  masterStart: number
  masterEnd: number
  reverbMix: number
  filterCutoff: number
}

const SECTION_ENERGY_PROFILES: Record<SectionEnergyAutomationType, SectionEnergyProfile> = {
  intro: { startGain: 0.92, endGain: 1.02, masterStart: 0.95, masterEnd: 1.02, reverbMix: 0.35, filterCutoff: 9000 },
  verse: { startGain: 0.98, endGain: 1.06, masterStart: 1.0, masterEnd: 1.05, reverbMix: 0.4, filterCutoff: 12000 },
  chorus: { startGain: 1.08, endGain: 1.22, masterStart: 1.05, masterEnd: 1.14, reverbMix: 0.5, filterCutoff: 17000 },
  drop: { startGain: 1.14, endGain: 1.28, masterStart: 1.08, masterEnd: 1.18, reverbMix: 0.45, filterCutoff: 20000 },
  other: { startGain: 1.0, endGain: 1.08, masterStart: 1.0, masterEnd: 1.06, reverbMix: 0.4, filterCutoff: 14000 },
}

function classifySectionEnergyType(name: string): SectionEnergyAutomationType {
  if (/intro|前奏/i.test(name)) return 'intro'
  if (/verse|主歌/i.test(name)) return 'verse'
  if (/chorus|副歌/i.test(name)) return 'chorus'
  if (/drop|桥段|高潮/i.test(name)) return 'drop'
  return 'other'
}

function buildSectionEnergyOptions(project: ProjectState, timelineBeats: number): SectionEnergyOption[] {
  const markers = [...(project.markers ?? [])].sort((a, b) => a.beat - b.beat)
  return markers
    .map((marker, index) => {
      const next = markers[index + 1]
      const startBeat = Math.max(0, marker.beat)
      const endBeat = Math.max(startBeat + 0.25, Math.min(timelineBeats, next?.beat ?? timelineBeats))
      return {
        id: marker.id,
        name: marker.name,
        startBeat,
        endBeat,
        type: classifySectionEnergyType(marker.name),
      }
    })
    .filter((section) => section.endBeat > section.startBeat)
}

function overlapsRange(clip: Clip, startBeat: number, endBeat: number) {
  return clip.startBeat < endBeat && (clip.startBeat + clip.lengthBeats) > startBeat
}

function applySectionEnergyAutomation(
  baseProject: ProjectState,
  sections: SectionEnergyOption[],
): ProjectState {
  const next = structuredClone(baseProject)
  if (sections.length === 0) return next

  const { drumTrack, bassTrack, harmonyTrack } = chooseCategoryTracks(next)
  const focusTrackIds = new Set([drumTrack?.id, bassTrack?.id, harmonyTrack?.id].filter(Boolean) as string[])

  next.tracks = next.tracks.map((track) => {
    const updatedTrack = { ...track }
    const isFocus = focusTrackIds.has(track.id)

    updatedTrack.clips = updatedTrack.clips.map((clip) => {
      let gain = clip.gain ?? 1
      sections.forEach((section) => {
        if (!overlapsRange(clip, section.startBeat, section.endBeat)) return
        const profile = SECTION_ENERGY_PROFILES[section.type]
        const center = Math.max(section.startBeat, Math.min(section.endBeat, clip.startBeat + clip.lengthBeats / 2))
        const progress = (center - section.startBeat) / Math.max(0.001, section.endBeat - section.startBeat)
        const sectionGain = profile.startGain + (profile.endGain - profile.startGain) * progress
        const masterGain = profile.masterStart + (profile.masterEnd - profile.masterStart) * progress
        const combinedGain = sectionGain * masterGain * (isFocus ? 1.04 : 1)
        gain = Math.min(2, gain * combinedGain)
      })
      return { ...clip, gain }
    })

    if (isFocus) {
      const strongestSection = sections
        .map((section) => SECTION_ENERGY_PROFILES[section.type])
        .sort((a, b) => b.endGain - a.endGain)[0]
      if (strongestSection) {
        updatedTrack.filterType = 'lowpass'
        updatedTrack.filterCutoff = Math.max(updatedTrack.filterCutoff ?? 20000, strongestSection.filterCutoff)
        updatedTrack.reverbEnabled = true
        updatedTrack.reverbMix = Math.max(updatedTrack.reverbMix ?? 0.3, strongestSection.reverbMix)
      }
    }

    return updatedTrack
  })

  return next
}

function toggleSectionId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

interface ChorusLiftSettings {
  drumDensity: boolean
  harmonyThicken: boolean
  gainLift: boolean
}

interface ChorusDoubleHarmonySettings {
  highOctaveHarmony: boolean
}

const DEFAULT_CHORUS_DOUBLE_HARMONY_SETTINGS: ChorusDoubleHarmonySettings = {
  highOctaveHarmony: false,
}

interface ChorusDoubleHarmonyResult {
  project: ProjectState
  createdTrackIds: string[]
}

function applyChorusDoubleHarmony(
  baseProject: ProjectState,
  marker: ChorusLiftMarkerOption,
  sourceTrackId: string,
  settings: ChorusDoubleHarmonySettings,
): ChorusDoubleHarmonyResult {
  const next = structuredClone(baseProject)
  const sourceTrack = next.tracks.find((track) => track.id === sourceTrackId)
  if (!sourceTrack) return { project: baseProject, createdTrackIds: [] }

  const inRange = (clip: Clip) => clip.startBeat < marker.endBeat && (clip.startBeat + clip.lengthBeats) > marker.startBeat
  const clipsInMarker = sourceTrack.clips.filter(inRange)
  const sourceClips = clipsInMarker.length > 0 ? clipsInMarker : sourceTrack.clips
  if (sourceClips.length === 0) return { project: baseProject, createdTrackIds: [] }

  const clipIntersects = (clip: Clip) => {
    const clipEnd = clip.startBeat + clip.lengthBeats
    const startBeat = Math.max(marker.startBeat, clip.startBeat)
    const endBeat = Math.min(marker.endBeat, clipEnd)
    return { startBeat, endBeat, valid: endBeat > startBeat }
  }

  const doubleClips: Clip[] = []
  const harmonyClips: Clip[] = []

  sourceClips.forEach((clip, index) => {
    const range = clipIntersects(clip)
    if (!range.valid) return

    const trimmedLength = Math.max(0.125, range.endBeat - range.startBeat)
    const baseGain = clip.gain ?? 1

    doubleClips.push({
      ...clip,
      id: `${clip.id}-chorus-double-${index}`,
      name: `${clip.name || 'Clip'} · Double`,
      startBeat: range.startBeat + 0.02,
      lengthBeats: trimmedLength,
      gain: Math.min(1.5, baseGain * 0.92),
      transposeSemitones: clip.transposeSemitones ?? 0,
      color: '#60a5fa',
    })

    harmonyClips.push({
      ...clip,
      id: `${clip.id}-chorus-harmony-${index}`,
      name: `${clip.name || 'Clip'} · Harmony`,
      startBeat: range.startBeat,
      lengthBeats: trimmedLength,
      gain: Math.min(1.35, baseGain * 0.8),
      transposeSemitones: (clip.transposeSemitones ?? 0) + 4 + (settings.highOctaveHarmony ? 12 : 0),
      color: '#a78bfa',
    })
  })

  if (doubleClips.length === 0 || harmonyClips.length === 0) return { project: baseProject, createdTrackIds: [] }

  const baseName = sourceTrack.name || 'Vocal'
  const timestamp = Date.now().toString().slice(-4)

  const doubleTrack: Track = {
    ...sourceTrack,
    id: crypto.randomUUID(),
    name: `${baseName} Double ${timestamp}`,
    pan: -0.12,
    volume: Math.min(1, sourceTrack.volume * 0.9),
    muted: false,
    solo: false,
    locked: false,
    frozen: false,
    freezeAudioData: undefined,
    freezeSource: undefined,
    clips: doubleClips,
    color: '#60a5fa',
  }

  const harmonyTrack: Track = {
    ...sourceTrack,
    id: crypto.randomUUID(),
    name: `${baseName} Harmony ${timestamp}`,
    pan: 0.12,
    volume: Math.min(1, sourceTrack.volume * 0.82),
    muted: false,
    solo: false,
    locked: false,
    frozen: false,
    freezeAudioData: undefined,
    freezeSource: undefined,
    clips: harmonyClips,
    color: '#a78bfa',
  }

  const insertIndex = next.tracks.findIndex((track) => track.id === sourceTrack.id)
  if (insertIndex === -1) return { project: baseProject, createdTrackIds: [] }
  next.tracks.splice(insertIndex + 1, 0, doubleTrack, harmonyTrack)

  return {
    project: next,
    createdTrackIds: [doubleTrack.id, harmonyTrack.id],
  }
}

interface ChorusLiftMarkerOption {
  id: string
  name: string
  startBeat: number
  endBeat: number
}

const DEFAULT_CHORUS_LIFT_SETTINGS: ChorusLiftSettings = {
  drumDensity: true,
  harmonyThicken: true,
  gainLift: true,
}

function isChorusMarkerName(name: string) {
  return /chorus|副歌/i.test(name)
}

function buildChorusMarkerOptions(project: ProjectState, timelineBeats: number): ChorusLiftMarkerOption[] {
  const markers = [...(project.markers ?? [])].sort((a, b) => a.beat - b.beat)
  return markers
    .map((marker, index) => {
      const nextMarker = markers[index + 1]
      return {
        id: marker.id,
        name: marker.name,
        startBeat: Math.max(0, marker.beat),
        endBeat: Math.max(marker.beat + 0.25, Math.min(timelineBeats, nextMarker?.beat ?? timelineBeats)),
      }
    })
    .filter((marker) => isChorusMarkerName(marker.name) && marker.endBeat > marker.startBeat)
}

function applyChorusLiftBuilder(
  baseProject: ProjectState,
  marker: ChorusLiftMarkerOption,
  settings: ChorusLiftSettings,
): ProjectState {
  const next = structuredClone(baseProject)
  const { drumTrack, harmonyTrack } = chooseCategoryTracks(next)
  const inRange = (clip: Clip) => clip.startBeat < marker.endBeat && (clip.startBeat + clip.lengthBeats) > marker.startBeat

  if (settings.gainLift) {
    const gainFactor = dbToLinear(1.5)
    next.tracks.forEach((track) => {
      if (track.locked) return
      track.clips = track.clips.map((clip) => (
        inRange(clip)
          ? { ...clip, gain: Math.min(2, (clip.gain ?? 1) * gainFactor) }
          : clip
      ))
    })
  }

  if (settings.harmonyThicken && harmonyTrack && !harmonyTrack.locked) {
    const targetTrack = next.tracks.find((t) => t.id === harmonyTrack.id)
    if (targetTrack) {
      const sourceClips = targetTrack.clips.filter(inRange)
      const overlays = sourceClips.map((clip, index) => ({
        ...clip,
        id: `${clip.id}-chorus-lift-h-${index}`,
        transposeSemitones: (clip.transposeSemitones ?? 0) + 7,
        gain: Math.min(1.6, (clip.gain ?? 1) * 0.8),
        name: `${clip.name || 'Clip'} · Lift Harmony`,
      }))
      targetTrack.clips = [...targetTrack.clips, ...overlays]
    }
  }

  if (settings.drumDensity && drumTrack && !drumTrack.locked) {
    const targetTrack = next.tracks.find((t) => t.id === drumTrack.id)
    if (targetTrack && !targetTrack.isDrumTrack) {
      const template = targetTrack.clips.find(inRange) ?? targetTrack.clips[0]
      if (template) {
        const overlays: Clip[] = []
        for (let beat = Math.floor(marker.startBeat); beat < marker.endBeat; beat += 1) {
          const startBeat = beat + 0.5
          if (startBeat >= marker.endBeat) continue
          overlays.push({
            ...template,
            id: `${template.id}-chorus-lift-d-${beat}`,
            startBeat,
            lengthBeats: Math.min(0.5, marker.endBeat - startBeat),
            gain: Math.min(1.4, (template.gain ?? 1) * 0.75),
            name: `${template.name || 'Clip'} · Lift Drum`,
          })
        }
        targetTrack.clips = [...targetTrack.clips, ...overlays]
      }
    }
  }

  return next
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

function analyzeBandProfileFromAudioBuffer(buffer: AudioBuffer): BandProfile {
  const sampleLength = buffer.length
  const channelCount = buffer.numberOfChannels
  if (sampleLength === 0 || channelCount === 0) {
    return { lowDb: -60, midDb: -60, highDb: -60 }
  }

  let lowSum = 0
  let midSum = 0
  let highSum = 0
  let total = 0

  for (let ch = 0; ch < channelCount; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i])
      total += v
      if (i % 3 === 0) lowSum += v
      else if (i % 3 === 1) midSum += v
      else highSum += v
    }
  }

  if (total <= 0) return { lowDb: -60, midDb: -60, highDb: -60 }

  const toDb = (part: number) => {
    const ratio = Math.max(1e-6, part / total)
    return 20 * Math.log10(ratio)
  }

  return {
    lowDb: toDb(lowSum),
    midDb: toDb(midSum),
    highDb: toDb(highSum),
  }
}

function estimateProjectBandProfile(project: ProjectState): BandProfile {
  const clips = project.tracks.flatMap((track) => track.clips.map((clip) => ({ clip, track })))
  if (clips.length === 0) return { lowDb: -24, midDb: -18, highDb: -20 }

  let low = 0
  let mid = 0
  let high = 0
  clips.forEach(({ clip, track }) => {
    const gain = (clip.gain ?? 1) * (track.volume ?? 1)
    const wave = clip.wave || 'sine'
    if (wave === 'sine' || wave === 'triangle') low += gain
    else if (wave === 'sawtooth' || wave === 'square') high += gain
    else mid += gain
  })

  const total = Math.max(1e-6, low + mid + high)
  const toDb = (v: number) => 20 * Math.log10(Math.max(1e-6, v / total))
  return { lowDb: toDb(low), midDb: toDb(mid), highDb: toDb(high) }
}

function suggestReferenceMatchAdjustments(before: BandProfile, target: BandProfile): ReferenceMatchSuggestion[] {
  const lowDelta = Number((target.lowDb - before.lowDb).toFixed(2))
  const midDelta = Number((target.midDb - before.midDb).toFixed(2))
  const highDelta = Number((target.highDb - before.highDb).toFixed(2))
  const dynamicsDelta = Number((((target.lowDb + target.midDb + target.highDb) - (before.lowDb + before.midDb + before.highDb)) / 3).toFixed(2))

  return [
    {
      id: 'ref-master-low',
      type: 'master-eq',
      label: '低频 EQ 倾向',
      detail: `LOW ${lowDelta >= 0 ? '+' : ''}${lowDelta} dB`,
      from: 0,
      to: Math.max(-6, Math.min(6, lowDelta)),
      applied: true,
    },
    {
      id: 'ref-master-mid',
      type: 'master-eq',
      label: '中频 EQ 倾向',
      detail: `MID ${midDelta >= 0 ? '+' : ''}${midDelta} dB`,
      from: 0,
      to: Math.max(-6, Math.min(6, midDelta)),
      applied: true,
    },
    {
      id: 'ref-master-high',
      type: 'master-eq',
      label: '高频 EQ 倾向',
      detail: `HIGH ${highDelta >= 0 ? '+' : ''}${highDelta} dB`,
      from: 0,
      to: Math.max(-6, Math.min(6, highDelta)),
      applied: true,
    },
    {
      id: 'ref-master-dynamics',
      type: 'master-dynamics',
      label: '动态范围建议',
      detail: dynamicsDelta > 0 ? '建议略提升动态（减小压缩）' : '建议略收紧动态（增加压缩）',
      from: 0,
      to: Math.max(-0.12, Math.min(0.12, -dynamicsDelta / 40)),
      applied: true,
    },
  ]
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
      exportTargetPreset: ExportTargetPreset
      latestExportVersionPresetKey: ExportTargetPresetKey | null
      latestExportVersionSampleRate: number | null
      latestExportVersionBitrateKbps: number | null
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
      exportQueue: {
        id: string
        type: 'wav' | 'mp3' | 'stem'
        status: 'queued' | 'processing' | 'success' | 'failed'
        progress: number
        createdAt: number
        message?: string
      }[]
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
  generateSongArrangement: (lengthBars: 8 | 16 | 32) => void
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
  busGroups: BusGroup[]
  assignTrackToBusGroup: (trackId: string, busGroupId: string | null) => void
  setBusGroupVolume: (busGroupId: string, volume: number) => void
  toggleBusGroupMute: (busGroupId: string) => void
  toggleBusGroupSolo: (busGroupId: string) => void
  setBusGroupEQEnabled: (busGroupId: string, enabled: boolean) => void
  setBusGroupEQBand: (busGroupId: string, band: 'low' | 'mid' | 'high', value: number) => void
  setBusGroupCompressorEnabled: (busGroupId: string, enabled: boolean) => void
  setBusGroupCompressorParam: (busGroupId: string, param: 'threshold' | 'ratio', value: number) => void
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
  alignAudioClipToProjectBpm: (trackId: string, clipId: string, mode: 'preservePitch' | 'preserveDuration') => void
  alignVocalClipTiming: (trackId: string, clipId: string, mode: 'grid' | 'barStretch') => void
  resetVocalClipTimingAlign: (trackId: string, clipId: string) => void
  applyVocalPitchAssist: (trackId: string, clipId: string, style: 'natural' | 'pop') => void
  setVocalPitchDryWet: (trackId: string, clipId: string, dryWet: number) => void
  toggleVocalPitchAssist: (trackId: string, clipId: string, enabled: boolean) => void
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
  exportTargetPreset: ExportTargetPreset
  setExportTargetPresetKey: (key: ExportTargetPresetKey) => void
  resetExportTargetPresetToCustom: () => void
  handleAudioExport: () => Promise<{ ok: boolean; message: string }>
  handleMp3Export: () => Promise<{ ok: boolean; message: string }>
  handleStemExport: () => Promise<{ ok: boolean; message: string }>
  exportQueue: {
    id: string
    type: 'wav' | 'mp3' | 'stem'
    status: 'queued' | 'processing' | 'success' | 'failed'
    progress: number
    createdAt: number
    message?: string
  }[]
  enqueueExportTask: (type: 'wav' | 'mp3' | 'stem') => void
  clearFinishedExportTasks: () => void
  recoverySnapshots: {
    id: string
    timestamp: number
    name: string
    source: 'autosave' | 'pre-export'
    project: ProjectState
  }[]
  restoreRecoverySnapshotAsCopy: (id: string) => void
  previewRecoverySnapshot: (id: string) => void
  deleteRecoverySnapshot: (id: string) => void
  importReferenceTrack: (file: File) => Promise<void>
  clearReferenceTrack: () => void
  toggleReferenceAB: () => void
  applyReferenceMatchMaster: (target: ReferenceMatchTarget) => void
  toggleReferenceMatchSuggestion: (suggestionId: string) => void
  monitorSource: MonitorSource
  referenceTrack: ReferenceTrackState | null
  referenceMatchDraft: ReferenceMatchReport | null
  lastExportLoudnessReport: ExportLoudnessReport | null
  exportVersionHistory: ExportVersionEntry[]
  renameExportVersion: (id: string, name: string) => void
  previewExportVersion: (id: string) => void
  lastPreExportChecklistReport: PreExportChecklistReport | null
  lastPreExportAutoFixReport: PreExportAutoFixReport | null
  applyPreExportAutoFix: () => void
  undoPreExportAutoFixItem: (key: 'unnamed-project' | 'loop-export-mismatch' | 'peak-clipping') => void
  latestMixReport: MixReportEntry | null
  previousMixReport: MixReportEntry | null
  autoMixSuggestionItems: AutoMixSuggestionItem[]
  autoMixAvailable: boolean
  autoMixPreviewMode: 'before' | 'after' | null
  autoMixCoverageReady: boolean
  projectHealthReport: ProjectHealthReport
  resolveProjectHealthRisk: (riskKey: ProjectHealthRiskKey) => void
  runAutoMixAssistant: () => void
  toggleAutoMixSuggestion: (suggestionId: string) => void
  previewAutoMixVersion: (mode: 'before' | 'after') => void
  chorusLiftMarkerOptions: ChorusLiftMarkerOption[]
  selectedChorusLiftMarkerId: string | null
  chorusLiftSettings: ChorusLiftSettings
  chorusDoubleHarmonySettings: ChorusDoubleHarmonySettings
  setSelectedChorusLiftMarkerId: (markerId: string | null) => void
  toggleChorusLiftSetting: (key: ChorusLiftToggleKey) => void
  toggleChorusDoubleHarmonySetting: (key: ChorusDoubleHarmonyToggleKey) => void
  applyChorusLiftBuilder: () => void
  applyChorusDoubleHarmonyBuilder: () => void
  sectionEnergyOptions: SectionEnergyOption[]
  selectedSectionEnergyIds: string[]
  toggleSectionEnergySelection: (sectionId: string) => void
  applySectionEnergyAutomation: () => void
  resetSectionEnergyAutomation: () => void
  generateArrangementVariations: (rangeLengthBeats: 8 | 16, rangeStartBeat?: number) => void
  applyArrangementVariation: (variantId: string) => void
  clearArrangementVariations: () => void
  enableVocalCleanChain: (trackId: string) => void
  setVocalFinalizerEnabled: (trackId: string, enabled: boolean) => void
  setVocalFinalizerPreset: (trackId: string, preset: 'clear' | 'warm' | 'intimate') => void
  setVocalFinalizerMix: (trackId: string, mix: number) => void
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
  const performanceMode = useDAWStore((state) => state.performanceMode)
  const selectedTrackId = useDAWStore((state) => state.selectedTrackId)
  const selectedClipRef = useDAWStore((state) => state.selectedClipRef)
  const selectedClipRefs = useDAWStore((state) => state.selectedClipRefs)
  const clipboard = useDAWStore((state) => state.clipboard)
  const favoriteClips = useDAWStore((state) => state.favoriteClips || [])
  const favoriteClipSearchQuery = useDAWStore((state) => state.favoriteClipSearchQuery || '')
  const busGroups = useDAWStore((state) => state.project.busGroups || [])
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
  const storeSetPerformanceMode = useDAWStore((state) => state.setPerformanceMode)
  const storeSetSelectedTrackId = useDAWStore((state) => state.setSelectedTrackId)
  const storeSetSelectedClipRef = useDAWStore((state) => state.setSelectedClipRef)
  const storeSetSelectedClipRefs = useDAWStore((state) => state.setSelectedClipRefs)
  const storeAddSelectedClipRef = useDAWStore((state) => state.addSelectedClipRef)
  const storeRemoveSelectedClipRef = useDAWStore((state) => state.removeSelectedClipRef)
  const storeSetClipboard = useDAWStore((state) => state.setClipboard)
  const storeSetFavoriteClipSearchQuery = useDAWStore((state) => state.setFavoriteClipSearchQuery)
  const storeSaveFavoriteClip = useDAWStore((state) => state.saveFavoriteClip)
  const storeDeleteFavoriteClip = useDAWStore((state) => state.deleteFavoriteClip)
  const recoverySnapshots = useDAWStore((state) => state.recoverySnapshots || [])
  const storeSaveRecoverySnapshot = useDAWStore((state) => state.saveRecoverySnapshot)
  const storeDeleteRecoverySnapshot = useDAWStore((state) => state.deleteRecoverySnapshot)
  const pushHistory = useDAWStore((state) => state.pushHistory)
  const clearHistory = useDAWStore((state) => state.clearHistory)
  const undo = useDAWStore((state) => state.undo)
  const redo = useDAWStore((state) => state.redo)
  const [isRecording, setIsRecording] = React.useState(false)
  const [lastExportLoudnessReport, setLastExportLoudnessReport] = React.useState<ExportLoudnessReport | null>(null)
  const [lastPreExportChecklistReport, setLastPreExportChecklistReport] = React.useState<PreExportChecklistReport | null>(null)
  const [lastPreExportAutoFixReport, setLastPreExportAutoFixReport] = React.useState<PreExportAutoFixReport | null>(null)
  const preExportAutoFixUndoRef = React.useRef<PreExportAutoFixUndoState>({})
  const [projectHealthReport, setProjectHealthReport] = React.useState<ProjectHealthReport>(() => buildProjectHealthReport({
    project,
    loopEnabled,
    effectiveTimelineBeats: loopEnabled ? loopLengthBeats : TIMELINE_BEATS,
    timelineBeats: TIMELINE_BEATS,
    performanceMode,
  }))
  const exportTargetPreset = useMemo(
    () => normalizeExportTargetPreset(project.exportTargetPreset),
    [project.exportTargetPreset],
  )
  const exportVersionHistory = useMemo(() => (project.exportVersions ?? []).slice(0, 5), [project.exportVersions])
  const latestMixReport = useMemo(() => (project.mixReports ?? [])[0] ?? null, [project.mixReports])
  const previousMixReport = useMemo(() => (project.mixReports ?? [])[1] ?? null, [project.mixReports])
  const [monitorSource, setMonitorSource] = React.useState<MonitorSource>('project')
  const [referenceTrack, setReferenceTrack] = React.useState<ReferenceTrackState | null>(null)
  const [referenceMatchDraft, setReferenceMatchDraft] = React.useState<ReferenceMatchReport | null>(null)
  const referenceAudioRef = React.useRef<HTMLAudioElement | null>(null)
  const [autoMixBaseProject, setAutoMixBaseProject] = React.useState<ProjectState | null>(null)
  const [autoMixSuggestions, setAutoMixSuggestions] = React.useState<AutoMixSuggestion[]>([])
  const [autoMixAppliedSuggestionIds, setAutoMixAppliedSuggestionIds] = React.useState<string[]>([])
  const [autoMixPreviewMode, setAutoMixPreviewMode] = React.useState<'before' | 'after' | null>(null)
  const [selectedChorusLiftMarkerId, setSelectedChorusLiftMarkerId] = React.useState<string | null>(null)
  const [chorusLiftSettings, setChorusLiftSettings] = React.useState<ChorusLiftSettings>(DEFAULT_CHORUS_LIFT_SETTINGS)
  const [chorusDoubleHarmonySettings, setChorusDoubleHarmonySettings] = React.useState<ChorusDoubleHarmonySettings>(DEFAULT_CHORUS_DOUBLE_HARMONY_SETTINGS)
  const [selectedSectionEnergyIds, setSelectedSectionEnergyIds] = React.useState<string[]>([])
  const [sectionEnergyBaseProject, setSectionEnergyBaseProject] = React.useState<ProjectState | null>(null)
  const [exportQueue, setExportQueue] = React.useState<{
    id: string
    type: 'wav' | 'mp3' | 'stem'
    status: 'queued' | 'processing' | 'success' | 'failed'
    progress: number
    createdAt: number
    message?: string
  }[]>([])
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

  const setPerformanceMode = (value: 'auto' | 'on' | 'off') => {
    storeSetPerformanceMode(value)
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

  useEffect(() => {
    const { healthReport } = buildUnifiedPreExportChecklist({
      project,
      masterVolume,
      loopEnabled,
      effectiveTimelineBeats,
      timelineBeats: TIMELINE_BEATS,
      performanceMode,
      loudness: lastExportLoudnessReport ?? {
        peakLinear: 0,
        peakDb: -Infinity,
        rmsLinear: 0,
        rmsDb: -Infinity,
        verdict: 'ready',
        checkedAt: Date.now(),
      },
    })
    setProjectHealthReport(healthReport)
  }, [project, masterVolume, loopEnabled, effectiveTimelineBeats, performanceMode, lastExportLoudnessReport])

  const resolveProjectHealthRisk = React.useCallback((riskKey: ProjectHealthRiskKey) => {
    resolveHealthRiskAction({
      riskKey,
      project,
      setSelectedTrackId,
      setSelectedClipRef,
      setSelectedClipRefs,
      setPlayheadBeat,
      setProject,
      setPerformanceMode,
      setLoopEnabled,
      effectiveTimelineBeats,
    })
  }, [project, setSelectedTrackId, setSelectedClipRef, setSelectedClipRefs, setPlayheadBeat, setProject, setPerformanceMode, setLoopEnabled, effectiveTimelineBeats])

  const chorusLiftMarkerOptions = useMemo(
    () => buildChorusMarkerOptions(project, effectiveTimelineBeats),
    [project, effectiveTimelineBeats],
  )
  const sectionEnergyOptions = useMemo(
    () => buildSectionEnergyOptions(project, effectiveTimelineBeats),
    [project, effectiveTimelineBeats],
  )

  useEffect(() => {
    if (chorusLiftMarkerOptions.length === 0) {
      if (selectedChorusLiftMarkerId !== null) setSelectedChorusLiftMarkerId(null)
      return
    }

    if (!selectedChorusLiftMarkerId) {
      setSelectedChorusLiftMarkerId(chorusLiftMarkerOptions[0].id)
      return
    }

    const exists = chorusLiftMarkerOptions.some((marker) => marker.id === selectedChorusLiftMarkerId)
    if (!exists) setSelectedChorusLiftMarkerId(chorusLiftMarkerOptions[0].id)
  }, [chorusLiftMarkerOptions, selectedChorusLiftMarkerId])

  useEffect(() => {
    if (sectionEnergyOptions.length === 0) {
      if (selectedSectionEnergyIds.length !== 0) setSelectedSectionEnergyIds([])
      return
    }

    setSelectedSectionEnergyIds((prev) => {
      const allowed = new Set(sectionEnergyOptions.map((item) => item.id))
      const filtered = prev.filter((id) => allowed.has(id))
      if (filtered.length > 0) return filtered
      return [sectionEnergyOptions[0].id]
    })
  }, [sectionEnergyOptions, selectedSectionEnergyIds.length])

  const toggleChorusLiftSetting = (key: ChorusLiftToggleKey) => {
    setChorusLiftSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const toggleChorusDoubleHarmonySetting = (key: ChorusDoubleHarmonyToggleKey) => {
    setChorusDoubleHarmonySettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const runChorusLiftBuilder = () => {
    if (isPlaying) return
    const marker = chorusLiftMarkerOptions.find((item) => item.id === selectedChorusLiftMarkerId)
    if (!marker) return
    const hasEnabledSetting = Object.values(chorusLiftSettings).some(Boolean)
    if (!hasEnabledSetting) return

    applyProjectUpdate((prev) => applyChorusLiftBuilder(prev, marker, chorusLiftSettings))
  }

  const runChorusDoubleHarmonyBuilder = () => {
    if (isPlaying || !selectedTrackId) return
    const marker = chorusLiftMarkerOptions.find((item) => item.id === selectedChorusLiftMarkerId) ?? chorusLiftMarkerOptions[0]
    if (!marker) return

    let createdTrackIds: string[] = []
    applyProjectUpdate((prev) => {
      const result = applyChorusDoubleHarmony(prev, marker, selectedTrackId, chorusDoubleHarmonySettings)
      createdTrackIds = result.createdTrackIds
      return result.project
    })

    if (createdTrackIds.length > 0) {
      setSelectedTrackId(createdTrackIds[0])
      setSelectedClipRef(null)
      setSelectedClipRefs([])
    }
  }

  const toggleSectionEnergySelection = (sectionId: string) => {
    setSelectedSectionEnergyIds((prev) => toggleSectionId(prev, sectionId))
  }

  const runSectionEnergyAutomation = () => {
    if (isPlaying) return
    const sectionMap = new Map(sectionEnergyOptions.map((item) => [item.id, item]))
    const sections = selectedSectionEnergyIds
      .map((id) => sectionMap.get(id))
      .filter((item): item is SectionEnergyOption => Boolean(item))
    if (sections.length === 0) return

    setSectionEnergyBaseProject(structuredClone(project))
    applyProjectUpdate((prev) => applySectionEnergyAutomation(prev, sections))
  }

  const resetSectionEnergyAutomation = () => {
    if (isPlaying || !sectionEnergyBaseProject) return
    setProject(structuredClone(sectionEnergyBaseProject), { saveHistory: true })
  }

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

  const setVocalFinalizerEnabled = React.useCallback((trackId: string, enabled: boolean) => {
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              vocalFinalizerEnabled: enabled,
              vocalFinalizerPreset: track.vocalFinalizerPreset ?? 'clear',
              vocalFinalizerMix: track.vocalFinalizerMix ?? 0.7,
            }
          : track,
      ),
    }), { saveHistory: true })
  }, [updateProject])

  const setVocalFinalizerPreset = React.useCallback((trackId: string, preset: 'clear' | 'warm' | 'intimate') => {
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              vocalFinalizerPreset: preset,
            }
          : track,
      ),
    }), { saveHistory: true })
  }, [updateProject])

  const setVocalFinalizerMix = React.useCallback((trackId: string, mix: number) => {
    const clamped = Math.max(0, Math.min(1, mix))
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              vocalFinalizerMix: clamped,
            }
          : track,
      ),
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
    setReferenceMatchDraft(null)
    setMonitorSource('project')
  }, [referenceTrack])

  const rememberExportVersion = React.useCallback((entry: Omit<ExportVersionEntry, 'id' | 'createdAt' | 'name'>) => {
    setProject((prev) => {
      const existing = prev.exportVersions ?? []
      const index = existing.length + 1
      const next: ExportVersionEntry = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        name: sanitizeExportVersionName(`${entry.format.toUpperCase()} ${index}`, index),
        ...entry,
      }
      return {
        ...prev,
        exportVersions: [next, ...existing].slice(0, 5),
      }
    })
  }, [setProject])

  const rememberMixReport = React.useCallback((entry: MixReportEntry) => {
    setProject((prev) => ({
      ...prev,
      mixReports: [entry, ...(prev.mixReports ?? [])].slice(0, 10),
    }))
  }, [setProject])

  const renameExportVersion = React.useCallback((id: string, name: string) => {
    const normalized = sanitizeExportVersionName(name)
    setProject((prev) => {
      const history = prev.exportVersions ?? []
      const exists = history.some((item) => item.id === id)
      if (!exists) return prev
      return {
        ...prev,
        exportVersions: history.map((item) => (item.id === id ? { ...item, name: normalized } : item)),
      }
    })
  }, [setProject])

  const previewExportVersion = React.useCallback((id: string) => {
    const entry = (project.exportVersions ?? []).find((item) => item.id === id)
    if (!entry?.audioDataUrl) {
      window.alert('该版本无可回放音频（可能来自旧版本导出记录）。')
      return
    }

    const audio = new Audio(entry.audioDataUrl)
    audio.play().catch(() => {
      window.alert('浏览器阻止了自动播放，请在用户交互后重试。')
    })
  }, [project.exportVersions])

  const applyReferenceMatchMaster = React.useCallback((target: ReferenceMatchTarget) => {
    const before = estimateProjectBandProfile(project)

    let targetProfile: BandProfile | null = null
    let targetLabel = ''
    let targetType: ReferenceMatchReport['targetType']

    if (target.type === 'export-version') {
      const exportTarget = (project.exportVersions ?? []).find((item) => item.id === target.id)
      if (!exportTarget) {
        window.alert('未找到目标导出版本。')
        return
      }
      if (!exportTarget.bandProfile) {
        window.alert('该历史导出缺少频谱摘要，暂时无法匹配。请先重新导出一个新版本。')
        return
      }
      targetProfile = exportTarget.bandProfile
      targetLabel = exportTarget.name
      targetType = 'export-version'
    } else {
      if (!referenceTrack?.bandProfile) {
        window.alert('参考曲缺少可用频谱信息，请重新导入参考曲后再试。')
        return
      }
      targetProfile = referenceTrack.bandProfile
      targetLabel = referenceTrack.fileName
      targetType = 'reference-track'
    }

    if (!targetProfile) return

    const suggestions = suggestReferenceMatchAdjustments(before, targetProfile)
    const eqLow = suggestions.find((s) => s.id === 'ref-master-low')?.to ?? 0
    const eqMid = suggestions.find((s) => s.id === 'ref-master-mid')?.to ?? 0
    const eqHigh = suggestions.find((s) => s.id === 'ref-master-high')?.to ?? 0
    const dynamicsDelta = suggestions.find((s) => s.id === 'ref-master-dynamics')?.to ?? 0

    setMasterEQ((prevEq) => ({
      low: Math.max(-12, Math.min(12, prevEq.low + eqLow)),
      mid: Math.max(-12, Math.min(12, prevEq.mid + eqMid)),
      high: Math.max(-12, Math.min(12, prevEq.high + eqHigh)),
    }))
    setMasterVolume(Math.max(0.2, Math.min(1, masterVolume + dynamicsDelta)))

    setProject((prev) => ({
      ...prev,
      referenceMatchHistory: [
        {
          targetType,
          targetLabel,
          checkedAt: Date.now(),
          before,
          after: targetProfile,
          suggestions,
        },
        ...(prev.referenceMatchHistory ?? []),
      ].slice(0, 5),
    }), { saveHistory: true })

    setReferenceMatchDraft({
      targetType,
      targetLabel,
      checkedAt: Date.now(),
      before,
      after: targetProfile,
      suggestions,
    })
  }, [masterVolume, project, referenceTrack, setMasterEQ, setMasterVolume, setProject])

  const toggleReferenceMatchSuggestion = React.useCallback((suggestionId: string) => {
    setReferenceMatchDraft((prev) => {
      if (!prev) return prev
      const suggestion = prev.suggestions.find((item) => item.id === suggestionId)
      if (!suggestion) return prev

      const nextApplied = !suggestion.applied
      const multiplier = nextApplied ? 1 : -1
      if (suggestion.type === 'master-eq') {
        const lowDelta = suggestion.id === 'ref-master-low' ? suggestion.to * multiplier : 0
        const midDelta = suggestion.id === 'ref-master-mid' ? suggestion.to * multiplier : 0
        const highDelta = suggestion.id === 'ref-master-high' ? suggestion.to * multiplier : 0
        setMasterEQ((current) => ({
          low: Math.max(-12, Math.min(12, current.low + lowDelta)),
          mid: Math.max(-12, Math.min(12, current.mid + midDelta)),
          high: Math.max(-12, Math.min(12, current.high + highDelta)),
        }))
      } else {
        setMasterVolume(Math.max(0.2, Math.min(1, masterVolume + suggestion.to * multiplier)))
      }

      return {
        ...prev,
        suggestions: prev.suggestions.map((item) =>
          item.id === suggestionId ? { ...item, applied: nextApplied } : item,
        ),
      }
    })
  }, [masterVolume, setMasterEQ, setMasterVolume])

  const importReferenceTrack = React.useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    const rawRmsDb = await estimateAudioFileRmsDb(file)
    const projectRmsDb = lastExportLoudnessReport?.rmsDb ?? estimateProjectRmsDbForReference(project)
    const matchedGainDb = resolveReferenceMatchedGainDb(rawRmsDb, projectRmsDb)
    const matchedDeltaDb = rawRmsDb == null ? 0 : Math.abs(projectRmsDb - (rawRmsDb + matchedGainDb))

    let bandProfile: BandProfile | undefined
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor()
        try {
          const arrayBuffer = await file.arrayBuffer()
          const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
          bandProfile = analyzeBandProfileFromAudioBuffer(decoded)
        } finally {
          await ctx.close()
        }
      }
    } catch {
      bandProfile = undefined
    }

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
      bandProfile,
    })
    setReferenceMatchDraft(null)
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

  const ensureReleaseMetadata = React.useCallback(() => {
    const base = normalizeReleaseMetadata(project.releaseMetadata, project.name)

    let nextMetadata = base

    if (!isReleaseMetadataReady(base)) {
      const titleInput = window.prompt('发布元信息（必填 1/4）：作品标题', base.title)
      if (!titleInput || !titleInput.trim()) {
        window.alert('未填写作品标题，已阻止进入分享卡片导出。')
        return null
      }

      const authorInput = window.prompt('发布元信息（必填 2/4）：作者名', base.author)
      if (!authorInput || !authorInput.trim()) {
        window.alert('未填写作者名，已阻止进入分享卡片导出。')
        return null
      }

      const coverInput = window.prompt('发布元信息（必填 3/4）：封面描述或路径', base.cover)
      if (!coverInput || !coverInput.trim()) {
        window.alert('未填写封面信息，已阻止进入分享卡片导出。')
        return null
      }

      const tagsInput = window.prompt('发布元信息（必填 4/4）：风格标签（逗号分隔）', releaseTagsToText(base.tags))
      const parsedTags = parseReleaseTags(tagsInput || '')
      if (parsedTags.length === 0) {
        window.alert('未填写风格标签，已阻止进入分享卡片导出。')
        return null
      }

      nextMetadata = normalizeReleaseMetadata({
        title: titleInput,
        author: authorInput,
        cover: coverInput,
        tags: parsedTags,
        updatedAt: Date.now(),
      }, project.name)
    }

    const existingTemplate = normalizePublishTemplate(project.publishWizardTemplate, project.name || nextMetadata.title, nextMetadata)

    let nextTemplate = existingTemplate

    if (!isPublishTemplateReady(project.publishWizardTemplate)) {
      const titleCandidatesInput = window.prompt(
        '发布向导 2.0（1/3）：标题备选（逗号分隔）',
        existingTemplate.titleCandidates.join(', '),
      )
      if (!titleCandidatesInput || !titleCandidatesInput.trim()) {
        window.alert('未填写标题备选，已阻止进入分享卡片导出。')
        return null
      }

      const titleCandidates = titleCandidatesInput
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5)
      if (titleCandidates.length === 0) {
        window.alert('标题备选至少需要 1 条，已阻止进入分享卡片导出。')
        return null
      }

      const coverCopyInput = window.prompt('发布向导 2.0（2/3）：封面文案', existingTemplate.coverCopy)
      if (!coverCopyInput || !coverCopyInput.trim()) {
        window.alert('未填写封面文案，已阻止进入分享卡片导出。')
        return null
      }

      const descriptionsDefault = [
        `短视频：${existingTemplate.platformDescriptions.shortVideo}`,
        `播客：${existingTemplate.platformDescriptions.podcast}`,
        `音乐平台：${existingTemplate.platformDescriptions.musicPlatform}`,
      ].join('\n')

      const descriptionsInput = window.prompt(
        '发布向导 2.0（3/3）：平台文案（按“短视频：...\n播客：...\n音乐平台：...”）',
        descriptionsDefault,
      )
      if (!descriptionsInput || !descriptionsInput.trim()) {
        window.alert('未填写平台文案，已阻止进入分享卡片导出。')
        return null
      }

      const lines = descriptionsInput.split(/\n+/).map((line) => line.trim()).filter(Boolean)
      const extractLine = (prefix: string) => lines.find((line) => line.startsWith(`${prefix}：`) || line.startsWith(`${prefix}:`))
      const shortVideoLine = extractLine('短视频')
      const podcastLine = extractLine('播客')
      const musicPlatformLine = extractLine('音乐平台')

      const shortVideo = (shortVideoLine ? shortVideoLine.replace(/^短视频[:：]/, '') : '').trim()
      const podcast = (podcastLine ? podcastLine.replace(/^播客[:：]/, '') : '').trim()
      const musicPlatform = (musicPlatformLine ? musicPlatformLine.replace(/^音乐平台[:：]/, '') : '').trim()

      if (!shortVideo || !podcast || !musicPlatform) {
        window.alert('平台文案需要同时包含“短视频/播客/音乐平台”三条，已阻止进入分享卡片导出。')
        return null
      }

      nextTemplate = normalizePublishTemplate({
        titleCandidates,
        coverCopy: coverCopyInput,
        platformDescriptions: {
          shortVideo,
          podcast,
          musicPlatform,
        },
        updatedAt: Date.now(),
      }, project.name || nextMetadata.title, nextMetadata)
    }

    const metadataChanged = JSON.stringify(project.releaseMetadata ?? null) !== JSON.stringify(nextMetadata)
    const templateChanged = JSON.stringify(project.publishWizardTemplate ?? null) !== JSON.stringify(nextTemplate)

    if (metadataChanged || templateChanged) {
      setProject((prev) => ({
        ...prev,
        releaseMetadata: nextMetadata,
        publishWizardTemplate: nextTemplate,
        name: prev.name || nextMetadata.title,
      }), { saveHistory: true })
    }

    return nextMetadata
  }, [project.name, project.publishWizardTemplate, project.releaseMetadata, setProject])

  const setExportTargetPresetKey = React.useCallback((key: ExportTargetPresetKey) => {
    const current = exportTargetPreset
    const next = key === 'custom' ? { ...current, key: 'custom' as const } : EXPORT_TARGET_PRESETS[key]

    const diffLines: string[] = []
    if (current.sampleRate !== next.sampleRate) diffLines.push(`采样率：${current.sampleRate} → ${next.sampleRate} Hz`)
    if (current.bitrateKbps !== next.bitrateKbps) diffLines.push(`码率：${current.bitrateKbps} → ${next.bitrateKbps} kbps`)
    if (current.targetLoudnessDb !== next.targetLoudnessDb) diffLines.push(`响度目标：${current.targetLoudnessDb} → ${next.targetLoudnessDb} dB`)
    if (current.peakLimitDb !== next.peakLimitDb) diffLines.push(`峰值上限：${current.peakLimitDb} → ${next.peakLimitDb} dB`)

    setProject((prev) => ({
      ...prev,
      exportTargetPreset: next,
    }), { saveHistory: true })

    if (diffLines.length > 0) {
      window.alert(`导出目标预设：${exportPresetLabel(next.key)}\n\n与当前设置差异：\n${diffLines.join('\n')}`)
    }
  }, [exportTargetPreset, setProject])

  const resetExportTargetPresetToCustom = React.useCallback(() => {
    setProject((prev) => ({
      ...prev,
      exportTargetPreset: {
        ...normalizeExportTargetPreset(prev.exportTargetPreset),
        key: 'custom',
      },
    }), { saveHistory: true })
  }, [setProject])

  const savePreExportRecoverySnapshot = React.useCallback((name: string) => {
    storeSaveRecoverySnapshot({
      name,
      source: 'pre-export',
      project,
    })
  }, [project, storeSaveRecoverySnapshot])

  const previewRecoverySnapshot = React.useCallback((id: string) => {
    const snapshot = recoverySnapshots.find((item) => item.id === id)
    if (!snapshot) return

    const summary = [
      `快照：${snapshot.name}`,
      `时间：${new Date(snapshot.timestamp).toLocaleString()}`,
      `BPM：${Math.round(snapshot.project.bpm)}`,
      `轨道数：${snapshot.project.tracks.length}`,
      `Clip 数：${snapshot.project.tracks.reduce((sum, track) => sum + track.clips.length, 0)}`,
      `来源：${snapshot.source === 'pre-export' ? '导出前' : '自动保存'}`,
    ].join('\n')

    window.alert(summary)
  }, [recoverySnapshots])

  const restoreRecoverySnapshotAsCopy = React.useCallback((id: string) => {
    const snapshot = recoverySnapshots.find((item) => item.id === id)
    if (!snapshot) return

    setProject((prev) => {
      const restored = structuredClone(snapshot.project)
      return {
        ...restored,
        id: crypto.randomUUID(),
        name: `${restored.name || prev.name || 'Untitled Project'} (Recovered ${new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        lastSavedAt: Date.now(),
      }
    }, { saveHistory: true })
  }, [recoverySnapshots, setProject])

  const deleteRecoverySnapshot = React.useCallback((id: string) => {
    storeDeleteRecoverySnapshot(id)
  }, [storeDeleteRecoverySnapshot])

  const handleAudioExport = async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const audioBuffer = await audioEngine.renderBuffer(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
        exportTargetPreset.sampleRate,
        project.busGroups,
      )
      const loudness = analyzeBufferLoudness(audioBuffer)
      setLastExportLoudnessReport(loudness)

      savePreExportRecoverySnapshot('WAV Export')
      const canContinue = runPreExportChecks({
        project,
        masterVolume,
        loopEnabled,
        effectiveTimelineBeats,
        timelineBeats: TIMELINE_BEATS,
        performanceMode,
        loudness,
        exportTargetLabel: 'WAV',
        setLastPreExportChecklistReport,
        setProjectHealthReport,
      })
      if (!canContinue) {
        return { ok: false, message: '导出清单未通过，已取消导出' }
      }

      const wavData = await audioEngine.exportWav(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
        exportTargetPreset.sampleRate,
        project.busGroups,
      )
      const mixReport = buildMixReportFromExport({
        project,
        exportFormat: 'wav',
        durationSec: totalDurationSec,
        loudness,
      })
      rememberMixReport(mixReport)
      const blob = new Blob([wavData], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const reader = new FileReader()
      reader.onloadend = () => {
        rememberExportVersion({
          format: 'wav',
          durationSec: totalDurationSec,
          peakDb: loudness.peakDb,
          rmsDb: loudness.rmsDb,
          audioDataUrl: typeof reader.result === 'string' ? reader.result : undefined,
          exportTargetPresetKey: exportTargetPreset.key,
          sampleRate: exportTargetPreset.sampleRate,
          bitrateKbps: exportTargetPreset.bitrateKbps,
          targetLoudnessDb: exportTargetPreset.targetLoudnessDb,
          peakLimitDb: exportTargetPreset.peakLimitDb,
          bandProfile: analyzeBandProfileFromAudioBuffer(audioBuffer),
        })
      }
      reader.readAsDataURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `project-${Date.now()}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { ok: true, message: 'WAV 导出完成' }
    } catch (error) {
      console.error('Failed to export audio:', error)
      const message = error instanceof Error ? error.message : '导出失败'
      return { ok: false, message }
    }
  }

  const handleMp3Export = async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const audioBuffer = await audioEngine.renderBuffer(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
        exportTargetPreset.sampleRate,
        project.busGroups,
      )
      const loudness = analyzeBufferLoudness(audioBuffer)
      setLastExportLoudnessReport(loudness)

      savePreExportRecoverySnapshot('MP3 Export')
      const canContinue = runPreExportChecks({
        project,
        masterVolume,
        loopEnabled,
        effectiveTimelineBeats,
        timelineBeats: TIMELINE_BEATS,
        performanceMode,
        loudness,
        exportTargetLabel: 'MP3',
        setLastPreExportChecklistReport,
        setProjectHealthReport,
      })
      if (!canContinue) {
        return { ok: false, message: '导出清单未通过，已取消导出' }
      }

      const mp3Data = audioBufferToMp3(audioBuffer, { kbps: exportTargetPreset.bitrateKbps })
      const mixReport = buildMixReportFromExport({
        project,
        exportFormat: 'mp3',
        durationSec: totalDurationSec,
        loudness,
      })
      rememberMixReport(mixReport)
      const blob = new Blob([mp3Data], { type: 'audio/mp3' })
      const url = URL.createObjectURL(blob)
      const reader = new FileReader()
      reader.onloadend = () => {
        rememberExportVersion({
          format: 'mp3',
          durationSec: totalDurationSec,
          peakDb: loudness.peakDb,
          rmsDb: loudness.rmsDb,
          audioDataUrl: typeof reader.result === 'string' ? reader.result : undefined,
          exportTargetPresetKey: exportTargetPreset.key,
          sampleRate: exportTargetPreset.sampleRate,
          bitrateKbps: exportTargetPreset.bitrateKbps,
          targetLoudnessDb: exportTargetPreset.targetLoudnessDb,
          peakLimitDb: exportTargetPreset.peakLimitDb,
          bandProfile: analyzeBandProfileFromAudioBuffer(audioBuffer),
        })
      }
      reader.readAsDataURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `project-${Date.now()}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { ok: true, message: 'MP3 导出完成' }
    } catch (error) {
      console.error('Failed to export MP3:', error)
      const message = error instanceof Error ? error.message : '导出失败'
      return { ok: false, message }
    }
  }

  const handleStemExport = async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const loudness = lastExportLoudnessReport ?? {
        peakLinear: 0,
        peakDb: -Infinity,
        rmsLinear: 0,
        rmsDb: -Infinity,
        verdict: 'ready' as const,
        checkedAt: Date.now(),
      }

      savePreExportRecoverySnapshot('Stem Export')
      const canContinue = runPreExportChecks({
        project,
        masterVolume,
        loopEnabled,
        effectiveTimelineBeats,
        timelineBeats: TIMELINE_BEATS,
        performanceMode,
        loudness,
        exportTargetLabel: '分轨 WAV',
        setLastPreExportChecklistReport,
        setProjectHealthReport,
      })
      if (!canContinue) {
        return { ok: false, message: '导出清单未通过，已取消导出' }
      }

      const bpmLabel = Math.round(project.bpm)
      const zipEntries: Record<string, Uint8Array> = {}
      const skippedTracks: string[] = []

      for (const track of project.tracks) {
        const hasContent = Boolean(track.isDrumTrack) || track.clips.length > 0
        if (track.muted || !hasContent) {
          skippedTracks.push(`${track.name || track.id} (${track.muted ? 'muted' : 'empty'})`)
          continue
        }

        const renderedTrackBuffer = await audioEngine.renderBuffer(
          [track],
          project.bpm,
          effectiveTimelineBeats,
          tempoCurveType,
          tempoCurveTargetBpm,
          masterEQ,
          44100,
          project.busGroups,
        )
        const wavArrayBuffer = audioBufferToWav(renderedTrackBuffer)
        const safeTrackName = (track.name || track.id)
          .replace(/[\\/:*?"<>|]/g, '-')
          .replace(/\s+/g, '_')
        const fileName = `${safeTrackName}-${bpmLabel}BPM.wav`
        zipEntries[fileName] = new Uint8Array(wavArrayBuffer)
      }

      zipEntries['README-skipped.txt'] = strToU8(
        skippedTracks.length > 0
          ? `Skipped tracks (${skippedTracks.length}):\n- ${skippedTracks.join('\n- ')}`
          : 'Skipped tracks: none',
      )

      const zipData = zipSync(zipEntries)
      const zipBuffer = new ArrayBuffer(zipData.byteLength)
      new Uint8Array(zipBuffer).set(zipData)
      const blob = new Blob([zipBuffer], { type: 'application/zip' })

      const baseName = buildSocialExportBaseName(project.name)
      triggerDownload(blob, `${baseName}-${bpmLabel}BPM-stems.zip`)
      return { ok: true, message: '分轨导出完成' }
    } catch (error) {
      console.error('Failed to export stems:', error)
      const message = error instanceof Error ? error.message : '导出失败'
      return { ok: false, message }
    }
  }

  const enqueueExportTask = React.useCallback((type: 'wav' | 'mp3' | 'stem') => {
    setExportQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
      },
    ])
  }, [])

  const clearFinishedExportTasks = React.useCallback(() => {
    setExportQueue((prev) => prev.filter((task) => task.status === 'queued' || task.status === 'processing'))
  }, [])

  useEffect(() => {
    const running = exportQueue.some((task) => task.status === 'processing')
    if (running) return

    const nextTask = exportQueue.find((task) => task.status === 'queued')
    if (!nextTask) return

    setExportQueue((prev) => prev.map((task) =>
      task.id === nextTask.id
        ? { ...task, status: 'processing', progress: 0.1 }
        : task,
    ))

    let cancelled = false
    ;(async () => {
      let result: { ok: boolean; message: string }
      if (nextTask.type === 'wav') {
        result = await handleAudioExport()
      } else if (nextTask.type === 'mp3') {
        result = await handleMp3Export()
      } else {
        result = await handleStemExport()
      }
      if (cancelled) return
      setExportQueue((prev) => prev.map((task) =>
        task.id === nextTask.id
          ? {
            ...task,
            status: result.ok ? 'success' : 'failed',
            progress: 1,
            message: result.message,
          }
          : task,
      ))
    })()

    return () => {
      cancelled = true
    }
  }, [exportQueue, handleAudioExport, handleMp3Export, handleStemExport])

  const handleSocialPublish = async () => {
    const releaseMetadata = ensureReleaseMetadata()
    if (!releaseMetadata) return

    try {
      const audioBuffer = await audioEngine.renderBuffer(
        project.tracks,
        project.bpm,
        effectiveTimelineBeats,
        tempoCurveType,
        tempoCurveTargetBpm,
        masterEQ,
        exportTargetPreset.sampleRate,
        project.busGroups,
      )
      const loudness = analyzeBufferLoudness(audioBuffer)
      setLastExportLoudnessReport(loudness)

      savePreExportRecoverySnapshot('Social Package Export')
      const canContinue = runPreExportChecks({
        project,
        masterVolume,
        loopEnabled,
        effectiveTimelineBeats,
        timelineBeats: TIMELINE_BEATS,
        performanceMode,
        loudness,
        exportTargetLabel: '发布包',
        setLastPreExportChecklistReport,
        setProjectHealthReport,
      })
      if (!canContinue) return

      const mp3Data = audioBufferToMp3(audioBuffer, { kbps: exportTargetPreset.bitrateKbps })
      const mp3Blob = new Blob([mp3Data], { type: 'audio/mp3' })
      const cardBlob = await createSocialCardBlob(project, totalDurationSec, releaseMetadata)
      const baseName = buildSocialExportBaseName(project.name)
      const zipBlob = await createSocialPackageZipBlob(baseName, mp3Blob, cardBlob)

      triggerDownload(zipBlob, `${baseName}-social-package.zip`)
    } catch (error) {
      console.error('Failed to publish social package:', error)
    }
  }

  const handleExportProjectCard = async () => {
    const releaseMetadata = ensureReleaseMetadata()
    if (!releaseMetadata) return

    try {
      const cardBlob = await createSocialCardBlob(project, totalDurationSec, releaseMetadata)
      const baseName = buildSocialExportBaseName(project.name)
      triggerDownload(cardBlob, `${baseName}-project-card.png`)
    } catch (error) {
      console.error('Failed to export project card:', error)
    }
  }

  const applyPreExportAutoFix = React.useCallback(() => {
    const result = buildPreExportAutoFixResult({
      project,
      loopEnabled,
      masterVolume,
      loudness: lastExportLoudnessReport,
    })

    preExportAutoFixUndoRef.current = result.undoState

    if (result.nextProject !== project) {
      setProject(result.nextProject, { saveHistory: true })
    }
    if (result.nextLoopEnabled !== loopEnabled) {
      setLoopEnabled(result.nextLoopEnabled)
    }
    if (Math.abs(result.nextMasterVolume - masterVolume) > 0.0001) {
      setMasterVolume(result.nextMasterVolume)
    }

    const checklistReport = rerunChecklistForAutoFix({
      project: result.nextProject,
      masterVolume: result.nextMasterVolume,
      loopEnabled: result.nextLoopEnabled,
      effectiveTimelineBeats: result.nextLoopEnabled ? loopLengthBeats : TIMELINE_BEATS,
      loudness: lastExportLoudnessReport,
    })

    setLastPreExportChecklistReport(checklistReport)
    setLastPreExportAutoFixReport(result.report)
  }, [project, loopEnabled, masterVolume, lastExportLoudnessReport, setProject, setLoopEnabled, setMasterVolume, loopLengthBeats])

  const undoPreExportAutoFixItem = React.useCallback((key: 'unnamed-project' | 'loop-export-mismatch' | 'peak-clipping') => {
    const ok = undoPreExportAutoFixChange({
      key,
      undoState: preExportAutoFixUndoRef.current,
      setProject,
      setLoopEnabled,
      setMasterVolume,
    })
    if (!ok) return

    setLastPreExportAutoFixReport((prev) => {
      if (!prev) return prev
      const nextLogs = applyUndoLog(prev.logs, key)
      return {
        ...prev,
        logs: nextLogs,
        fixedCount: nextLogs.filter((item) => item.status === 'fixed').length,
        passRate: buildAutoFixPassRate(nextLogs, prev.totalFixable),
      }
    })
  }, [setProject, setLoopEnabled, setMasterVolume])

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
      project.busGroups,
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
      exportTargetPreset,
      latestExportVersionPresetKey: exportVersionHistory[0]?.exportTargetPresetKey ?? null,
      latestExportVersionSampleRate: exportVersionHistory[0]?.sampleRate ?? null,
      latestExportVersionBitrateKbps: exportVersionHistory[0]?.bitrateKbps ?? null,
      exportQueue,
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

  const generateSongArrangement = (lengthBars: 8 | 16 | 32) => {
    if (isPlaying) return

    applyProjectUpdate((prev) => {
      const totalBeats = Math.max(4, Math.min(TIMELINE_BEATS, lengthBars * 4))
      const activeTracks = prev.tracks.filter((track) => track.clips.length > 0 && !track.locked)
      if (activeTracks.length === 0) return prev

      const sections = [
        { name: 'Intro' },
        { name: 'Verse' },
        { name: 'Chorus' },
        { name: 'Drop' },
      ]

      const sectionSpan = Math.max(1, totalBeats / sections.length)
      const sectionStarts = sections.map((_, index) => Math.max(0, Math.min(totalBeats - 1, Math.floor(index * sectionSpan))))

      const nextTracks = prev.tracks.map((track) => {
        if (track.locked || track.clips.length === 0) return track

        const templateClip = [...track.clips]
          .sort((a, b) => a.startBeat - b.startBeat)
          .find((clip) => clip.startBeat + clip.lengthBeats <= totalBeats)
          ?? [...track.clips].sort((a, b) => b.lengthBeats - a.lengthBeats)[0]

        if (!templateClip) return track

        const arrangedClips = sectionStarts.map((startBeat, index) => {
          const nextLength = Math.max(0.25, Math.min(templateClip.lengthBeats, totalBeats - startBeat))
          return {
            ...templateClip,
            id: `${track.id}-arr-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            startBeat,
            lengthBeats: nextLength,
            name: templateClip.name || `${sections[index]?.name ?? 'Section'} ${index + 1}`,
          }
        })

        return {
          ...track,
          clips: arrangedClips,
        }
      })

      const arrangementMarkers = sectionStarts.map((beat, index) => ({
        id: crypto.randomUUID(),
        name: sections[index]?.name ?? `Section ${index + 1}`,
        beat,
      }))

      return {
        ...prev,
        tracks: nextTracks,
        markers: arrangementMarkers,
      }
    })
  }

  const generateArrangementVariations = (rangeLengthBeats: 8 | 16, rangeStartBeat?: number) => {
    if (isPlaying) return
    applyProjectUpdate((prev) => {
      const { safeStart, safeLength } = clampVariationRange(rangeStartBeat ?? 0, rangeLengthBeats)
      const variants: ArrangementVariation[] = [
        buildArrangementVariation(prev, 'conservative', safeStart, safeLength),
        buildArrangementVariation(prev, 'standard', safeStart, safeLength),
        buildArrangementVariation(prev, 'aggressive', safeStart, safeLength),
      ]
      const first = variants[0]
      const withBundle: ProjectState = {
        ...prev,
        arrangementVariationBundle: {
          createdAt: Date.now(),
          rangeStartBeat: safeStart,
          rangeLengthBeats: safeLength,
          variants,
          activeVariantId: first.id,
        },
      }
      return applyArrangementVariationToProject(withBundle, first)
    })
  }

  const applyArrangementVariation = (variantId: string) => {
    if (isPlaying) return
    applyProjectUpdate((prev) => {
      const bundle = prev.arrangementVariationBundle
      if (!bundle) return prev
      const target = bundle.variants.find((variant) => variant.id === variantId)
      if (!target) return prev
      return applyArrangementVariationToProject(
        {
          ...prev,
          arrangementVariationBundle: {
            ...bundle,
            activeVariantId: target.id,
          },
        },
        target,
      )
    })
  }

  const clearArrangementVariations = () => {
    applyProjectUpdate((prev) => {
      if (!prev.arrangementVariationBundle) return prev
      return {
        ...prev,
        arrangementVariationBundle: undefined,
      }
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

  const assignTrackToBusGroup = (trackId: string, busGroupId: string | null) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, busGroupId } : t)),
    }))
  }

  const setBusGroupVolume = (busGroupId: string, volume: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      busGroups: (prev.busGroups || []).map((group) =>
        group.id === busGroupId
          ? { ...group, volume: Math.max(0, Math.min(1.5, volume)) }
          : group,
      ),
    }))
  }

  const toggleBusGroupMute = (busGroupId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      busGroups: (prev.busGroups || []).map((group) =>
        group.id === busGroupId ? { ...group, muted: !group.muted } : group,
      ),
    }))
  }

  const toggleBusGroupSolo = (busGroupId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      busGroups: (prev.busGroups || []).map((group) =>
        group.id === busGroupId ? { ...group, solo: !group.solo } : group,
      ),
    }))
  }

  const setBusGroupEQEnabled = (busGroupId: string, enabled: boolean) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      busGroups: (prev.busGroups || []).map((group) =>
        group.id === busGroupId ? { ...group, eqEnabled: enabled } : group,
      ),
    }))
  }

  const setBusGroupEQBand = (busGroupId: string, band: 'low' | 'mid' | 'high', value: number) => {
    const clamped = Math.max(-12, Math.min(12, value))
    applyProjectUpdate((prev) => ({
      ...prev,
      busGroups: (prev.busGroups || []).map((group) => {
        if (group.id !== busGroupId) return group
        if (band === 'low') return { ...group, eqLow: clamped }
        if (band === 'mid') return { ...group, eqMid: clamped }
        return { ...group, eqHigh: clamped }
      }),
    }))
  }

  const setBusGroupCompressorEnabled = (busGroupId: string, enabled: boolean) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      busGroups: (prev.busGroups || []).map((group) =>
        group.id === busGroupId ? { ...group, compressorEnabled: enabled } : group,
      ),
    }))
  }

  const setBusGroupCompressorParam = (busGroupId: string, param: 'threshold' | 'ratio', value: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      busGroups: (prev.busGroups || []).map((group) => {
        if (group.id !== busGroupId) return group
        if (param === 'threshold') {
          return { ...group, compressorThreshold: Math.max(-60, Math.min(0, value)) }
        }
        return { ...group, compressorRatio: Math.max(1, Math.min(20, value)) }
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
        44100,
        currentProject.busGroups,
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

  const alignAudioClipToProjectBpm = (trackId: string, clipId: string, mode: 'preservePitch' | 'preserveDuration') => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        const current = t.clips.find((c) => c.id === clipId)
        if (!current?.audioData) return t

        const durationSec = audioEngine.audioBufferCache.get(current.id)?.duration

        const beatDurationSec = 60 / prev.bpm
        const alignedLengthRaw = durationSec && durationSec > 0 && Number.isFinite(durationSec)
          ? durationSec / beatDurationSec
          : current.lengthBeats
        const alignedLength = Math.max(0.5, Math.min(TIMELINE_BEATS, Math.round(alignedLengthRaw * 2) / 2 || current.lengthBeats))
        const shouldForceStretchBadge = mode === 'preserveDuration' && Math.abs(alignedLength - current.lengthBeats) < 0.01
        const safeStart = Math.min(current.startBeat, TIMELINE_BEATS - alignedLength)
        const resolvedStart = resolveNonOverlappingStart(t.clips, alignedLength, safeStart, clipId)
        const stretchRatio = current.lengthBeats > 0 ? alignedLength / current.lengthBeats : 1

        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  startBeat: resolvedStart,
                  lengthBeats: alignedLength,
                  audioAlignMode: mode,
                  audioStretchRatio: shouldForceStretchBadge ? 1.01 : stretchRatio,
                  transposeSemitones: mode === 'preserveDuration' ? 0 : c.transposeSemitones,
                }
              : c,
          ),
        }
      }),
    }))
  }

  const alignVocalClipTiming = (trackId: string, clipId: string, mode: 'grid' | 'barStretch') => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId) return c
            const safeLength = Math.max(0.5, Math.min(TIMELINE_BEATS, c.lengthBeats))
            const originalStartBeat = c.vocalTimingEnabled ? (c.vocalTimingOriginalStartBeat ?? c.startBeat) : c.startBeat
            const originalLengthBeats = c.vocalTimingEnabled ? (c.vocalTimingOriginalLengthBeats ?? c.lengthBeats) : c.lengthBeats

            if (mode === 'grid') {
              const snappedStart = Math.max(0, Math.min(TIMELINE_BEATS - safeLength, Math.round(c.startBeat / 0.25) * 0.25))
              return {
                ...c,
                startBeat: snappedStart,
                vocalTimingMode: 'grid',
                vocalTimingEnabled: true,
                vocalTimingOriginalStartBeat: originalStartBeat,
                vocalTimingOriginalLengthBeats: originalLengthBeats,
              }
            }

            const barSize = 4
            const targetBarCount = Math.max(1, Math.round(c.lengthBeats / barSize))
            const targetLength = Math.max(0.5, Math.min(TIMELINE_BEATS, targetBarCount * barSize))
            const safeStart = Math.min(c.startBeat, TIMELINE_BEATS - targetLength)
            const snappedBarStart = Math.max(0, Math.round(safeStart / barSize) * barSize)
            const finalStart = Math.min(snappedBarStart, TIMELINE_BEATS - targetLength)
            return {
              ...c,
              startBeat: finalStart,
              lengthBeats: targetLength,
              vocalTimingMode: 'barStretch',
              vocalTimingEnabled: true,
              vocalTimingOriginalStartBeat: originalStartBeat,
              vocalTimingOriginalLengthBeats: originalLengthBeats,
              audioAlignMode: 'preserveDuration',
              audioStretchRatio: c.lengthBeats > 0 ? targetLength / c.lengthBeats : 1,
            }
          }),
        }
      }),
    }))
  }

  const resetVocalClipTimingAlign = (trackId: string, clipId: string) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId || !c.vocalTimingEnabled) return c
            const restoredStart = Math.max(0, Math.min(TIMELINE_BEATS - 0.5, c.vocalTimingOriginalStartBeat ?? c.startBeat))
            const restoredLength = Math.max(0.5, Math.min(TIMELINE_BEATS, c.vocalTimingOriginalLengthBeats ?? c.lengthBeats))
            return {
              ...c,
              startBeat: restoredStart,
              lengthBeats: restoredLength,
              vocalTimingEnabled: false,
              vocalTimingMode: undefined,
              vocalTimingOriginalStartBeat: undefined,
              vocalTimingOriginalLengthBeats: undefined,
            }
          }),
        }
      }),
    }))
  }

  const applyVocalPitchAssist = (trackId: string, clipId: string, style: 'natural' | 'pop') => {
    if (isPlaying) return

    setProject((prev) => {
      const safeScaleType = resolveScaleType(prev.scaleType)
      return {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id !== trackId || t.locked) return t
          return {
            ...t,
            clips: t.clips.map((c) => {
              if (c.id !== clipId || !c.audioData) return c
              const sourceTranspose = c.vocalPitchEnabled
                ? (c.vocalPitchOriginalTransposeSemitones ?? c.transposeSemitones ?? 0)
                : (c.transposeSemitones ?? 0)
              const baseFrequency = c.noteHz * semitoneToRatio(sourceTranspose)
              const correctedFrequency = quantizeFrequencyToScale(baseFrequency, prev.scaleKey ?? 'C', safeScaleType)
              const correctedSemitones = 12 * Math.log2(correctedFrequency / Math.max(1e-6, c.noteHz))
              return {
                ...c,
                transposeSemitones: correctedSemitones,
                vocalPitchEnabled: true,
                vocalPitchStyle: style,
                vocalPitchDryWet: style === 'pop' ? 1 : 0.6,
                vocalPitchOriginalTransposeSemitones: sourceTranspose,
                vocalPitchCorrectedTransposeSemitones: correctedSemitones,
              }
            }),
          }
        }),
      }
    })
  }

  const setVocalPitchDryWet = (trackId: string, clipId: string, dryWet: number) => {
    const normalized = Math.max(0, Math.min(1, Number.isFinite(dryWet) ? dryWet : 1))
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId || !c.vocalPitchEnabled) return c
            const original = c.vocalPitchOriginalTransposeSemitones ?? c.transposeSemitones ?? 0
            const corrected = c.vocalPitchCorrectedTransposeSemitones ?? c.transposeSemitones ?? original
            const mixed = original + (corrected - original) * normalized
            return {
              ...c,
              vocalPitchDryWet: normalized,
              transposeSemitones: mixed,
            }
          }),
        }
      }),
    }))
  }

  const toggleVocalPitchAssist = (trackId: string, clipId: string, enabled: boolean) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) => {
            if (c.id !== clipId) return c
            if (!enabled) {
              const restored = c.vocalPitchOriginalTransposeSemitones ?? c.transposeSemitones ?? 0
              return {
                ...c,
                transposeSemitones: restored,
                vocalPitchEnabled: false,
              }
            }
            if (!c.vocalPitchEnabled) {
              return {
                ...c,
                vocalPitchEnabled: true,
                vocalPitchStyle: c.vocalPitchStyle ?? 'natural',
                vocalPitchDryWet: c.vocalPitchDryWet ?? 1,
              }
            }
            return c
          }),
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

      const clipId = `${trackId}-clip-${Date.now()}`
      audioEngine.loadClipAudio(clipId, base64data)
        .catch((error) => {
          console.error('Failed to decode imported audio:', error)
        })
        .finally(() => {
          applyProjectUpdate((prev) => {
            const next = structuredClone(prev)
            const track = next.tracks.find((t) => t.id === trackId)
            if (!track || track.locked) return prev

            const durationSec = audioEngine.audioBufferCache.get(clipId)?.duration ?? 2
            const beatDurationSec = 60 / prev.bpm
            const rawLengthBeats = durationSec / beatDurationSec
            const lengthBeats = Math.max(0.5, Math.min(TIMELINE_BEATS, Math.round(rawLengthBeats * 2) / 2 || 4))
            const startBeat = resolveNonOverlappingStart(track.clips, lengthBeats, Math.min(beat, TIMELINE_BEATS - lengthBeats))

            const newClip: Clip = {
              id: clipId,
              name: file.name.substring(0, 20),
              startBeat,
              lengthBeats,
              noteHz: 440,
              wave: 'sine',
              audioData: base64data,
            }
            track.clips.push(newClip)
            return next
          })
        })
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
    busGroups,
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
    generateSongArrangement,
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
    assignTrackToBusGroup,
    setBusGroupVolume,
    toggleBusGroupMute,
    toggleBusGroupSolo,
    setBusGroupEQEnabled,
    setBusGroupEQBand,
    setBusGroupCompressorEnabled,
    setBusGroupCompressorParam,
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
    alignAudioClipToProjectBpm,
    alignVocalClipTiming,
    resetVocalClipTimingAlign,
    applyVocalPitchAssist,
    setVocalPitchDryWet,
    toggleVocalPitchAssist,
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
    exportTargetPreset,
    setExportTargetPresetKey,
    resetExportTargetPresetToCustom,
    handleAudioExport,
    handleMp3Export,
    handleStemExport,
    exportQueue,
    enqueueExportTask,
    clearFinishedExportTasks,
    recoverySnapshots,
    restoreRecoverySnapshotAsCopy,
    previewRecoverySnapshot,
    deleteRecoverySnapshot,
    importReferenceTrack,
    clearReferenceTrack,
    toggleReferenceAB,
    applyReferenceMatchMaster,
    toggleReferenceMatchSuggestion,
    monitorSource,
    referenceTrack,
    referenceMatchDraft,
    lastExportLoudnessReport,
    exportVersionHistory,
    renameExportVersion,
    previewExportVersion,
    lastPreExportChecklistReport,
    lastPreExportAutoFixReport,
    applyPreExportAutoFix,
    undoPreExportAutoFixItem,
    latestMixReport,
    previousMixReport,
    autoMixSuggestionItems,
    autoMixAvailable,
    autoMixPreviewMode,
    autoMixCoverageReady,
    projectHealthReport,
    resolveProjectHealthRisk,
    runAutoMixAssistant,
    toggleAutoMixSuggestion,
    previewAutoMixVersion,
    chorusLiftMarkerOptions,
    selectedChorusLiftMarkerId,
    chorusLiftSettings,
    chorusDoubleHarmonySettings,
    setSelectedChorusLiftMarkerId,
    toggleChorusLiftSetting,
    toggleChorusDoubleHarmonySetting,
    applyChorusLiftBuilder: runChorusLiftBuilder,
    applyChorusDoubleHarmonyBuilder: runChorusDoubleHarmonyBuilder,
    sectionEnergyOptions,
    selectedSectionEnergyIds,
    toggleSectionEnergySelection,
    applySectionEnergyAutomation: runSectionEnergyAutomation,
    resetSectionEnergyAutomation,
    generateArrangementVariations,
    applyArrangementVariation,
    clearArrangementVariations,
    enableVocalCleanChain,
    setVocalFinalizerEnabled,
    setVocalFinalizerPreset,
    setVocalFinalizerMix,
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
