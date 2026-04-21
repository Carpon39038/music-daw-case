const fs = require('fs');
const content = fs.readFileSync('src/utils/demos.ts', 'utf8');

const newDemos = `
export const DEMO_HIPHOP: ProjectState = {
  bpm: 90,
  tracks: [
    {
      id: 'hiphop-drums',
      name: '808 & Drums',
      volume: 85,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      clips: [
        { id: 'hd1', startBeat: 0, lengthBeats: 0.5, noteHz: 45, wave: 'sine' },
        { id: 'hd2', startBeat: 1, lengthBeats: 0.5, noteHz: 200, wave: 'square' },
        { id: 'hd3', startBeat: 2.5, lengthBeats: 0.5, noteHz: 45, wave: 'sine' },
        { id: 'hd4', startBeat: 3, lengthBeats: 0.5, noteHz: 200, wave: 'square' },
        { id: 'hd5', startBeat: 4, lengthBeats: 0.5, noteHz: 45, wave: 'sine' },
        { id: 'hd6', startBeat: 5, lengthBeats: 0.5, noteHz: 200, wave: 'square' },
        { id: 'hd7', startBeat: 6.5, lengthBeats: 0.5, noteHz: 45, wave: 'sine' },
        { id: 'hd8', startBeat: 7, lengthBeats: 0.5, noteHz: 200, wave: 'square' }
      ]
    },
    {
      id: 'hiphop-keys',
      name: 'Dark Keys',
      volume: 70,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'lowpass',
      filterCutoff: 1500,
      clips: [
        { id: 'hk1', startBeat: 0, lengthBeats: 2, noteHz: 196.00, wave: 'triangle' },
        { id: 'hk2', startBeat: 2, lengthBeats: 2, noteHz: 164.81, wave: 'triangle' },
        { id: 'hk3', startBeat: 4, lengthBeats: 2, noteHz: 196.00, wave: 'triangle' },
        { id: 'hk4', startBeat: 6, lengthBeats: 2, noteHz: 146.83, wave: 'triangle' }
      ]
    }
  ]
}

export const DEMO_CLASSICAL: ProjectState = {
  bpm: 75,
  tracks: [
    {
      id: 'classical-strings',
      name: 'Strings',
      volume: 80,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      transposeSemitones: 0,
      filterType: 'lowpass',
      filterCutoff: 3000,
      clips: [
        { id: 'cs1', startBeat: 0, lengthBeats: 4, noteHz: 261.63, wave: 'sawtooth' },
        { id: 'cs2', startBeat: 0, lengthBeats: 4, noteHz: 329.63, wave: 'sawtooth' },
        { id: 'cs3', startBeat: 0, lengthBeats: 4, noteHz: 392.00, wave: 'sawtooth' },
        { id: 'cs4', startBeat: 4, lengthBeats: 4, noteHz: 349.23, wave: 'sawtooth' },
        { id: 'cs5', startBeat: 4, lengthBeats: 4, noteHz: 440.00, wave: 'sawtooth' },
        { id: 'cs6', startBeat: 4, lengthBeats: 4, noteHz: 523.25, wave: 'sawtooth' }
      ]
    }
  ]
}

export const DEMOS = [
  { name: '基础：鼓点节奏', project: DEMO_DRUM_BEAT },
  { name: '基础：简单旋律', project: DEMO_MELODY },
  { name: '风格：Lo-Fi 氛围', project: DEMO_LOFI },
  { name: '风格：Synthwave', project: DEMO_SYNTHWAVE },
  { name: '风格：Trap/Hip-Hop', project: DEMO_HIPHOP },
  { name: '风格：古典弦乐', project: DEMO_CLASSICAL }
]
`;

const updated = content.replace(/export const DEMOS = \[\s*\{ name: '基础：鼓点节奏'.*?\]/s, newDemos.trim());
fs.writeFileSync('src/utils/demos.ts', updated);
