import type { ProjectState } from '../types'

export interface ChordSuggestion {
  name: string
  confidence: number
  notesHz: number[]
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const CHORD_PATTERNS = [
  { suffix: '', intervals: [0, 4, 7] },
  { suffix: 'm', intervals: [0, 3, 7] },
  { suffix: 'dim', intervals: [0, 3, 6] },
]

function midiToHz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function hzToPitchClass(hz: number) {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440))
  return ((midi % 12) + 12) % 12
}

function countPitchClasses(project: ProjectState) {
  const counts = new Array<number>(12).fill(0)

  project.tracks.forEach((track) => {
    if (track.muted) return
    track.clips.forEach((clip) => {
      if (clip.muted) return
      const pc = hzToPitchClass(clip.noteHz)
      const weight = Math.max(0.25, clip.lengthBeats)
      counts[pc] += weight
    })
  })

  return counts
}

export function analyzeChordSuggestions(project: ProjectState): ChordSuggestion[] {
  const counts = countPitchClasses(project)
  const total = counts.reduce((a, b) => a + b, 0)
  if (total <= 0) return []

  const candidates: ChordSuggestion[] = []

  for (let root = 0; root < 12; root++) {
    for (const pattern of CHORD_PATTERNS) {
      const chordPcs = pattern.intervals.map((i) => (root + i) % 12)
      const hit = chordPcs.reduce((sum, pc) => sum + counts[pc], 0)
      const extra = counts.reduce((sum, val, idx) => sum + (chordPcs.includes(idx) ? 0 : val), 0)
      const confidence = Math.max(0, hit / (hit + extra * 0.7))
      const rootMidi = 60 + root
      candidates.push({
        name: `${NOTE_NAMES[root]}${pattern.suffix}`,
        confidence,
        notesHz: pattern.intervals.map((itv) => midiToHz(rootMidi + itv)),
      })
    }
  }

  return candidates
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
}
