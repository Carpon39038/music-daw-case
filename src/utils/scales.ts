export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
}

export type ScaleType = keyof typeof SCALES

export function isNoteInScale(noteIndex: number, scaleKeyIndex: number, scaleType: ScaleType): boolean {
  if (scaleType === 'chromatic') return true
  const relativeIndex = (noteIndex - scaleKeyIndex + 12) % 12
  return SCALES[scaleType].includes(relativeIndex)
}
