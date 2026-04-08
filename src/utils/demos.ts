import type { ProjectState } from '../types'

export const DEMO_DRUM_BEAT: ProjectState = {
  bpm: 120,
  tracks: [
    {
      id: 'kick-track',
      name: 'Kick',
      volume: 80,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      clips: [
        { id: 'k1', startBeat: 0, lengthBeats: 0.5, noteHz: 60, wave: 'sine' },
        { id: 'k2', startBeat: 2, lengthBeats: 0.5, noteHz: 60, wave: 'sine' },
        { id: 'k3', startBeat: 4, lengthBeats: 0.5, noteHz: 60, wave: 'sine' },
        { id: 'k4', startBeat: 6, lengthBeats: 0.5, noteHz: 60, wave: 'sine' }
      ]
    },
    {
      id: 'snare-track',
      name: 'Snare',
      volume: 70,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      clips: [
        { id: 's1', startBeat: 1, lengthBeats: 0.5, noteHz: 200, wave: 'square' },
        { id: 's2', startBeat: 3, lengthBeats: 0.5, noteHz: 200, wave: 'square' },
        { id: 's3', startBeat: 5, lengthBeats: 0.5, noteHz: 200, wave: 'square' },
        { id: 's4', startBeat: 7, lengthBeats: 0.5, noteHz: 200, wave: 'square' }
      ]
    },
    {
      id: 'hat-track',
      name: 'Hi-Hat',
      volume: 60,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'highpass',
      filterCutoff: 5000,
      clips: [
        { id: 'h1', startBeat: 0, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h2', startBeat: 0.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h3', startBeat: 1, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h4', startBeat: 1.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h5', startBeat: 2, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h6', startBeat: 2.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h7', startBeat: 3, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h8', startBeat: 3.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h9', startBeat: 4, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h10', startBeat: 4.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h11', startBeat: 5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h12', startBeat: 5.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h13', startBeat: 6, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h14', startBeat: 6.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h15', startBeat: 7, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' },
        { id: 'h16', startBeat: 7.5, lengthBeats: 0.25, noteHz: 8000, wave: 'sawtooth' }
      ]
    }
  ]
}

export const DEMO_MELODY: ProjectState = {
  bpm: 100,
  tracks: [
    {
      id: 'bass-track',
      name: 'Bass',
      volume: 85,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      clips: [
        { id: 'b1', startBeat: 0, lengthBeats: 1, noteHz: 130.81, wave: 'square' }, // C3
        { id: 'b2', startBeat: 1.5, lengthBeats: 0.5, noteHz: 130.81, wave: 'square' },
        { id: 'b3', startBeat: 2, lengthBeats: 1, noteHz: 146.83, wave: 'square' }, // D3
        { id: 'b4', startBeat: 3.5, lengthBeats: 0.5, noteHz: 146.83, wave: 'square' },
        { id: 'b5', startBeat: 4, lengthBeats: 1, noteHz: 164.81, wave: 'square' }, // E3
        { id: 'b6', startBeat: 5.5, lengthBeats: 0.5, noteHz: 164.81, wave: 'square' },
        { id: 'b7', startBeat: 6, lengthBeats: 1, noteHz: 130.81, wave: 'square' }, // C3
        { id: 'b8', startBeat: 7.5, lengthBeats: 0.5, noteHz: 130.81, wave: 'square' }
      ]
    },
    {
      id: 'lead-track',
      name: 'Lead',
      volume: 75,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      clips: [
        { id: 'l1', startBeat: 0, lengthBeats: 0.5, noteHz: 261.63, wave: 'triangle' }, // C4
        { id: 'l2', startBeat: 0.5, lengthBeats: 0.5, noteHz: 329.63, wave: 'triangle' }, // E4
        { id: 'l3', startBeat: 1, lengthBeats: 1, noteHz: 392.00, wave: 'triangle' }, // G4
        { id: 'l4', startBeat: 2, lengthBeats: 0.5, noteHz: 293.66, wave: 'triangle' }, // D4
        { id: 'l5', startBeat: 2.5, lengthBeats: 0.5, noteHz: 349.23, wave: 'triangle' }, // F4
        { id: 'l6', startBeat: 3, lengthBeats: 1, noteHz: 440.00, wave: 'triangle' }, // A4
        { id: 'l7', startBeat: 4, lengthBeats: 0.5, noteHz: 329.63, wave: 'triangle' }, // E4
        { id: 'l8', startBeat: 4.5, lengthBeats: 0.5, noteHz: 392.00, wave: 'triangle' }, // G4
        { id: 'l9', startBeat: 5, lengthBeats: 1, noteHz: 493.88, wave: 'triangle' }, // B4
        { id: 'l10', startBeat: 6, lengthBeats: 2, noteHz: 523.25, wave: 'triangle' } // C5
      ]
    }
  ]
}

export const DEMO_LOFI: ProjectState = {
  bpm: 85,
  tracks: [
    {
      id: 'lofi-drums',
      name: 'Lo-Fi Drums',
      volume: 75,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'lowpass',
      filterCutoff: 4000,
      clips: [
        { id: 'ld1', startBeat: 0, lengthBeats: 0.5, noteHz: 55, wave: 'sine' },
        { id: 'ld2', startBeat: 1, lengthBeats: 0.5, noteHz: 150, wave: 'square' },
        { id: 'ld3', startBeat: 2.5, lengthBeats: 0.5, noteHz: 55, wave: 'sine' },
        { id: 'ld4', startBeat: 3, lengthBeats: 0.5, noteHz: 150, wave: 'square' },
        { id: 'ld5', startBeat: 4, lengthBeats: 0.5, noteHz: 55, wave: 'sine' },
        { id: 'ld6', startBeat: 5, lengthBeats: 0.5, noteHz: 150, wave: 'square' },
        { id: 'ld7', startBeat: 6.5, lengthBeats: 0.5, noteHz: 55, wave: 'sine' },
        { id: 'ld8', startBeat: 7, lengthBeats: 0.5, noteHz: 150, wave: 'square' }
      ]
    },
    {
      id: 'lofi-chords',
      name: 'Warm Chords',
      volume: 65,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'lowpass',
      filterCutoff: 1200,
      reverbEnabled: true,
      reverbMix: 0.6,
      reverbDecay: 3,
      clips: [
        { id: 'lc1', startBeat: 0, lengthBeats: 4, noteHz: 261.63, wave: 'triangle' }, // C4
        { id: 'lc2', startBeat: 0, lengthBeats: 4, noteHz: 329.63, wave: 'triangle' }, // E4
        { id: 'lc3', startBeat: 0, lengthBeats: 4, noteHz: 392.00, wave: 'triangle' }, // G4
        { id: 'lc4', startBeat: 4, lengthBeats: 4, noteHz: 220.00, wave: 'triangle' }, // A3
        { id: 'lc5', startBeat: 4, lengthBeats: 4, noteHz: 261.63, wave: 'triangle' }, // C4
        { id: 'lc6', startBeat: 4, lengthBeats: 4, noteHz: 329.63, wave: 'triangle' }  // E4
      ]
    }
  ]
}

export const DEMO_SYNTHWAVE: ProjectState = {
  bpm: 110,
  tracks: [
    {
      id: 'synth-bass',
      name: 'Synth Bass',
      volume: 85,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'lowpass',
      filterCutoff: 1000,
      clips: [
        { id: 'sb1', startBeat: 0, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' }, // C2
        { id: 'sb2', startBeat: 0.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' },
        { id: 'sb3', startBeat: 1, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' },
        { id: 'sb4', startBeat: 1.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' },
        { id: 'sb5', startBeat: 2, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' },
        { id: 'sb6', startBeat: 2.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' },
        { id: 'sb7', startBeat: 3, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' },
        { id: 'sb8', startBeat: 3.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' },
        { id: 'sb9', startBeat: 4, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' }, // Eb2
        { id: 'sb10', startBeat: 4.5, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' },
        { id: 'sb11', startBeat: 5, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' },
        { id: 'sb12', startBeat: 5.5, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' },
        { id: 'sb13', startBeat: 6, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' },
        { id: 'sb14', startBeat: 6.5, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' },
        { id: 'sb15', startBeat: 7, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' },
        { id: 'sb16', startBeat: 7.5, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' }
      ]
    },
    {
      id: 'synth-arp',
      name: 'Arp',
      volume: 60,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      clips: [
        { id: 'sa1', startBeat: 0, lengthBeats: 0.25, noteHz: 261.63, wave: 'square' }, // C4
        { id: 'sa2', startBeat: 0.25, lengthBeats: 0.25, noteHz: 392.00, wave: 'square' }, // G4
        { id: 'sa3', startBeat: 0.5, lengthBeats: 0.25, noteHz: 523.25, wave: 'square' }, // C5
        { id: 'sa4', startBeat: 0.75, lengthBeats: 0.25, noteHz: 392.00, wave: 'square' }, // G4
        { id: 'sa5', startBeat: 1, lengthBeats: 0.25, noteHz: 261.63, wave: 'square' },
        { id: 'sa6', startBeat: 1.25, lengthBeats: 0.25, noteHz: 392.00, wave: 'square' },
        { id: 'sa7', startBeat: 1.5, lengthBeats: 0.25, noteHz: 523.25, wave: 'square' },
        { id: 'sa8', startBeat: 1.75, lengthBeats: 0.25, noteHz: 392.00, wave: 'square' }
      ]
    }
  ]
}

export const DEMOS = [
  { name: '基础：鼓点节奏', project: DEMO_DRUM_BEAT },
  { name: '基础：简单旋律', project: DEMO_MELODY },
  { name: '风格：Lo-Fi 氛围', project: DEMO_LOFI },
  { name: '风格：Synthwave', project: DEMO_SYNTHWAVE }
]
