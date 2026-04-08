export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function hzToClosestNoteLabel(hz: number): string {
  if (!hz || hz <= 0) return 'C4';
  const a4 = 440;
  const a4Index = 69;
  const index = Math.round(12 * Math.log2(hz / a4) + a4Index);
  if (index < 0) return 'C-1';
  const octave = Math.floor(index / 12) - 1;
  const note = NOTE_NAMES[index % 12];
  return `${note}${octave}`;
}

export function noteLabelToHz(label: string): number {
  const match = label.match(/^([A-G]#?)(-?\d)$/);
  if (!match) return 440;
  const name = match[1];
  const octave = parseInt(match[2], 10);
  const noteIndex = NOTE_NAMES.indexOf(name);
  if (noteIndex === -1) return 440;
  
  const index = (octave + 1) * 12 + noteIndex;
  const a4Index = 69;
  return 440 * Math.pow(2, (index - a4Index) / 12);
}

export const SELECTABLE_NOTES = Array.from({ length: 49 }, (_, i) => {
  // From C2 (36) to C6 (84)
  const index = i + 36; 
  const octave = Math.floor(index / 12) - 1;
  const name = NOTE_NAMES[index % 12];
  const label = `${name}${octave}`;
  const hz = 440 * Math.pow(2, (index - 69) / 12);
  return { label, hz };
}).reverse(); // High to low
