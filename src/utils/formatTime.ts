import { beatToSeconds, type TempoCurveSettings } from './tempoCurve'

export function formatTime(beat: number, bpm: number, tempo?: Pick<TempoCurveSettings, 'curveType' | 'targetBpm'>): string {
  const totalSeconds = beatToSeconds(beat, {
    bpm,
    curveType: tempo?.curveType,
    targetBpm: tempo?.targetBpm,
  })
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = seconds.toFixed(2).padStart(5, '0')
  return `${mm}:${ss} (B${Math.floor(beat)})`
}
