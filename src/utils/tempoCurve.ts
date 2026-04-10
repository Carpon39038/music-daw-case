export type TempoCurveType = 'constant' | 'accelerando' | 'ritardando'

export interface TempoCurveSettings {
  bpm: number
  curveType?: TempoCurveType
  targetBpm?: number
}

function resolveCurveTarget(bpm: number, curveType: TempoCurveType, targetBpm?: number): number {
  if (curveType === 'constant') return bpm
  const fallback = curveType === 'accelerando'
    ? Math.min(200, bpm + 20)
    : Math.max(60, bpm - 20)
  const target = Number.isFinite(targetBpm) ? (targetBpm as number) : fallback
  return Math.max(60, Math.min(200, target))
}

export function getTempoAtBeat(beat: number, settings: TempoCurveSettings): number {
  const curveType = settings.curveType ?? 'constant'
  if (curveType === 'constant') return settings.bpm
  const clampedBeat = Math.max(0, Math.min(16, beat))
  const target = resolveCurveTarget(settings.bpm, curveType, settings.targetBpm)
  const ratio = clampedBeat / 16
  return settings.bpm + (target - settings.bpm) * ratio
}

export function beatToSeconds(beat: number, settings: TempoCurveSettings, totalBeats = 16): number {
  const b = Math.max(0, beat)
  const b0 = Math.max(1, settings.bpm)
  const curveType = settings.curveType ?? 'constant'
  const target = resolveCurveTarget(b0, curveType, settings.targetBpm)

  if (curveType === 'constant' || Math.abs(target - b0) < 1e-6 || totalBeats <= 0) {
    return (b * 60) / b0
  }

  const k = (target - b0) / totalBeats
  if (Math.abs(k) < 1e-9) return (b * 60) / b0
  const inside = Math.max(1e-6, (b0 + k * b) / b0)
  return (60 / k) * Math.log(inside)
}

export function secondsToBeat(seconds: number, settings: TempoCurveSettings, totalBeats = 16): number {
  const t = Math.max(0, seconds)
  const b0 = Math.max(1, settings.bpm)
  const curveType = settings.curveType ?? 'constant'
  const target = resolveCurveTarget(b0, curveType, settings.targetBpm)

  if (curveType === 'constant' || Math.abs(target - b0) < 1e-6 || totalBeats <= 0) {
    return (t * b0) / 60
  }

  const k = (target - b0) / totalBeats
  if (Math.abs(k) < 1e-9) return (t * b0) / 60
  const raw = (b0 * (Math.exp((k * t) / 60) - 1)) / k
  return Number.isFinite(raw) ? raw : 0
}

export function getTimelineDurationSec(totalBeats: number, settings: TempoCurveSettings): number {
  return beatToSeconds(totalBeats, settings, totalBeats)
}

export function getEffectiveTargetBpm(settings: TempoCurveSettings): number {
  return resolveCurveTarget(settings.bpm, settings.curveType ?? 'constant', settings.targetBpm)
}
