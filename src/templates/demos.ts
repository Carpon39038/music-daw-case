import type { ProjectState, Track, WaveType } from '../types'

const defaultNotes = {
  kick: 60, // Deep low frequency
  snare: 300, // Higher frequency
  hihat: 800, // Very high frequency
  bass: 82.41, // E2
  lead: 329.63, // E4
}

function createDrumTrack(id: string, name: string, wave: WaveType, pan: number, pattern: { start: number, note: number, len: number }[]): Track {
  return {
    id,
    name,
    volume: 0.8,
    pan,
    muted: false,
    solo: false,
    color: '#a855f7',
    locked: false,
    transposeSemitones: 0,
    filterType: 'none',
    filterCutoff: 20000,
    reverbEnabled: false,
    distortionEnabled: false,
    reverbMix: 0.3,
    reverbDecay: 2,
    clips: pattern.map((p, i) => ({
      id: `${id}-clip-${i}`,
      startBeat: p.start,
      lengthBeats: p.len,
      noteHz: p.note,
      wave,
      fadeOut: 0.1 // Short decay for drums
    }))
  }
}

export const DEMO_PROJECTS: { id: string, name: string, state: ProjectState }[] = [
  {
    id: 'demo-drum-beat',
    name: '🥁 鼓点节奏 (Drum Beat)',
    state: {
      bpm: 120,
      tracks: [
        createDrumTrack('kick', 'Kick', 'sine', 0, [
          { start: 0, note: defaultNotes.kick, len: 0.5 },
          { start: 2, note: defaultNotes.kick, len: 0.5 },
          { start: 4, note: defaultNotes.kick, len: 0.5 },
          { start: 6, note: defaultNotes.kick, len: 0.5 },
        ]),
        createDrumTrack('snare', 'Snare', 'square', 0, [
          { start: 1, note: defaultNotes.snare, len: 0.5 },
          { start: 3, note: defaultNotes.snare, len: 0.5 },
          { start: 5, note: defaultNotes.snare, len: 0.5 },
          { start: 7, note: defaultNotes.snare, len: 0.5 },
        ]),
        createDrumTrack('hihat', 'Hi-Hat', 'triangle', 0, [
          { start: 0, note: defaultNotes.hihat, len: 0.25 },
          { start: 0.5, note: defaultNotes.hihat, len: 0.25 },
          { start: 1, note: defaultNotes.hihat, len: 0.25 },
          { start: 1.5, note: defaultNotes.hihat, len: 0.25 },
          { start: 2, note: defaultNotes.hihat, len: 0.25 },
          { start: 2.5, note: defaultNotes.hihat, len: 0.25 },
          { start: 3, note: defaultNotes.hihat, len: 0.25 },
          { start: 3.5, note: defaultNotes.hihat, len: 0.25 },
          { start: 4, note: defaultNotes.hihat, len: 0.25 },
          { start: 4.5, note: defaultNotes.hihat, len: 0.25 },
          { start: 5, note: defaultNotes.hihat, len: 0.25 },
          { start: 5.5, note: defaultNotes.hihat, len: 0.25 },
          { start: 6, note: defaultNotes.hihat, len: 0.25 },
          { start: 6.5, note: defaultNotes.hihat, len: 0.25 },
          { start: 7, note: defaultNotes.hihat, len: 0.25 },
          { start: 7.5, note: defaultNotes.hihat, len: 0.25 },
        ]),
      ]
    }
  },
  {
    id: 'demo-simple-melody',
    name: '🎹 简单旋律 (Simple Melody)',
    state: {
      bpm: 100,
      tracks: [
        {
          id: 'lead',
          name: 'Lead',
          volume: 0.7,
          pan: 0,
          muted: false,
          solo: false,
          color: '#3b82f6',
          locked: false,
          transposeSemitones: 0,
          filterType: 'none',
          filterCutoff: 20000,
          reverbEnabled: true,
          distortionEnabled: false,
          reverbMix: 0.4,
          reverbDecay: 3,
          clips: [
            { id: 'lead-1', startBeat: 0, lengthBeats: 1, noteHz: 261.63, wave: 'square' }, // C4
            { id: 'lead-2', startBeat: 1, lengthBeats: 1, noteHz: 261.63, wave: 'square' }, // C4
            { id: 'lead-3', startBeat: 2, lengthBeats: 1, noteHz: 392.00, wave: 'square' }, // G4
            { id: 'lead-4', startBeat: 3, lengthBeats: 1, noteHz: 392.00, wave: 'square' }, // G4
            { id: 'lead-5', startBeat: 4, lengthBeats: 1, noteHz: 440.00, wave: 'square' }, // A4
            { id: 'lead-6', startBeat: 5, lengthBeats: 1, noteHz: 440.00, wave: 'square' }, // A4
            { id: 'lead-7', startBeat: 6, lengthBeats: 2, noteHz: 392.00, wave: 'square' }, // G4
          ]
        },
        {
          id: 'bass',
          name: 'Bass',
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          color: '#ef4444',
          locked: false,
          transposeSemitones: 0,
          filterType: 'none',
          filterCutoff: 1000,
          reverbEnabled: false,
          distortionEnabled: false,
          reverbMix: 0,
          reverbDecay: 1,
          clips: [
            { id: 'bass-1', startBeat: 0, lengthBeats: 4, noteHz: 130.81, wave: 'sawtooth' }, // C3
            { id: 'bass-2', startBeat: 4, lengthBeats: 2, noteHz: 174.61, wave: 'sawtooth' }, // F3
            { id: 'bass-3', startBeat: 6, lengthBeats: 2, noteHz: 130.81, wave: 'sawtooth' }, // C3
          ]
        }
      ]
    }
  }
]
