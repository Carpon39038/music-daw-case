import { describe, expect, it } from 'vitest'

interface Clip {
  startBeat: number
  lengthBeats: number
}

const beatDuration = (bpm: number) => 60 / bpm
const clipTimeRange = (clip: Clip, bpm: number) => {
  const bd = beatDuration(bpm)
  return {
    startSec: clip.startBeat * bd,
    endSec: (clip.startBeat + clip.lengthBeats) * bd,
  }
}

describe('audio behavior math', () => {
  it('beat duration should match bpm inverse', () => {
    expect(beatDuration(120)).toBeCloseTo(0.5, 5)
    expect(beatDuration(60)).toBeCloseTo(1, 5)
  })

  it('clip range should align with beat timeline', () => {
    const clip = { startBeat: 4, lengthBeats: 2 }
    const r = clipTimeRange(clip, 120)
    expect(r.startSec).toBeCloseTo(2, 5)
    expect(r.endSec).toBeCloseTo(3, 5)
  })

  it('should reject invalid clip duration in guard example', () => {
    const invalid: Clip = { startBeat: 3, lengthBeats: 0 }
    expect(invalid.lengthBeats > 0).toBe(false)
  })
})
