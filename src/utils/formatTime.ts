export function formatTime(beat: number, bpm: number): string {
  const totalSeconds = (beat * 60) / bpm
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = seconds.toFixed(2).padStart(5, '0')
  return `${mm}:${ss} (B${Math.floor(beat)})`
}
