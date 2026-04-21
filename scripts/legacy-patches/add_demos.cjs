const fs = require('fs');
const path = '/Users/cc/.openclaw/workspace/music-daw-case/src/templates/demos.ts';
let code = fs.readFileSync(path, 'utf8');

const newDemos = `
  {
    id: 'demo-lofi',
    name: '☕ Lo-Fi Vibe',
    state: {
      bpm: 85,
      tracks: [
        createDrumTrack('kick', 'Kick', 'sine', 0, [
          { start: 0, note: defaultNotes.kick, len: 0.5 },
          { start: 2.5, note: defaultNotes.kick, len: 0.5 },
          { start: 4, note: defaultNotes.kick, len: 0.5 },
          { start: 6.5, note: defaultNotes.kick, len: 0.5 },
        ]),
        createDrumTrack('snare', 'Snare', 'square', 0, [
          { start: 2, note: defaultNotes.snare, len: 0.5 },
          { start: 6, note: defaultNotes.snare, len: 0.5 },
        ]),
        createDrumTrack('hihat', 'Hi-Hat', 'triangle', 0, [
          { start: 0, note: defaultNotes.hihat, len: 0.25 },
          { start: 1, note: defaultNotes.hihat, len: 0.25 },
          { start: 2, note: defaultNotes.hihat, len: 0.25 },
          { start: 3, note: defaultNotes.hihat, len: 0.25 },
          { start: 4, note: defaultNotes.hihat, len: 0.25 },
          { start: 5, note: defaultNotes.hihat, len: 0.25 },
          { start: 6, note: defaultNotes.hihat, len: 0.25 },
          { start: 7, note: defaultNotes.hihat, len: 0.25 },
        ]),
        {
          id: 'chords',
          name: 'Chords',
          volume: 0.5,
          pan: 0,
          muted: false,
          solo: false,
          color: '#10b981',
          locked: false,
          transposeSemitones: 0,
          filterType: 'lowpass',
          filterCutoff: 800,
          reverbEnabled: true,
          reverbMix: 0.5,
          reverbDecay: 4,
          clips: [
            { id: 'c1', startBeat: 0, lengthBeats: 2, noteHz: 261.63, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.1 }, // C4
            { id: 'c2', startBeat: 0, lengthBeats: 2, noteHz: 329.63, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.1 }, // E4
            { id: 'c3', startBeat: 0, lengthBeats: 2, noteHz: 392.00, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.1 }, // G4
            
            { id: 'a1', startBeat: 2, lengthBeats: 2, noteHz: 220.00, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.1 }, // A3
            { id: 'a2', startBeat: 2, lengthBeats: 2, noteHz: 261.63, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.1 }, // C4
            { id: 'a3', startBeat: 2, lengthBeats: 2, noteHz: 329.63, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.1 }, // E4
            
            { id: 'f1', startBeat: 4, lengthBeats: 4, noteHz: 174.61, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.5 }, // F3
            { id: 'f2', startBeat: 4, lengthBeats: 4, noteHz: 220.00, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.5 }, // A3
            { id: 'f3', startBeat: 4, lengthBeats: 4, noteHz: 261.63, wave: 'triangle', fadeIn: 0.1, fadeOut: 0.5 }, // C4
          ]
        }
      ]
    }
  },
  {
    id: 'demo-edm',
    name: '🚀 电子舞曲 (EDM)',
    state: {
      bpm: 128,
      tracks: [
        createDrumTrack('kick', 'Kick', 'sine', 0, [
          { start: 0, note: defaultNotes.kick, len: 0.5 },
          { start: 1, note: defaultNotes.kick, len: 0.5 },
          { start: 2, note: defaultNotes.kick, len: 0.5 },
          { start: 3, note: defaultNotes.kick, len: 0.5 },
          { start: 4, note: defaultNotes.kick, len: 0.5 },
          { start: 5, note: defaultNotes.kick, len: 0.5 },
          { start: 6, note: defaultNotes.kick, len: 0.5 },
          { start: 7, note: defaultNotes.kick, len: 0.5 },
        ]),
        {
          id: 'bass',
          name: 'Bass',
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          color: '#f59e0b',
          locked: false,
          transposeSemitones: 0,
          filterType: 'none',
          filterCutoff: 20000,
          distortionEnabled: true,
          reverbEnabled: false,
          clips: [
            { id: 'b1', startBeat: 0.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' }, // C2
            { id: 'b2', startBeat: 1.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' }, // C2
            { id: 'b3', startBeat: 2.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' }, // C2
            { id: 'b4', startBeat: 3.5, lengthBeats: 0.5, noteHz: 77.78, wave: 'sawtooth' }, // Eb2
            { id: 'b5', startBeat: 4.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' }, // C2
            { id: 'b6', startBeat: 5.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' }, // C2
            { id: 'b7', startBeat: 6.5, lengthBeats: 0.5, noteHz: 65.41, wave: 'sawtooth' }, // C2
            { id: 'b8', startBeat: 7.5, lengthBeats: 0.5, noteHz: 58.27, wave: 'sawtooth' }, // Bb1
          ]
        }
      ]
    }
  }
];
`;

code = code.replace(/\]\s*$/, newDemos + '\n]');
fs.writeFileSync(path, code);
