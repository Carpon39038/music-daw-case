export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'organ' | 'brass'

export interface Clip {
  name?: string
  id: string
  startBeat: number
  lengthBeats: number
  noteHz: number
  wave: WaveType
  muted?: boolean
  gain?: number
  transposeSemitones?: number
  color?: string
  fadeIn?: number
  fadeOut?: number
  audioData?: string
}

export interface Track {
  id: string
  name: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  color?: string
  locked: boolean
  delayEnabled?: boolean
  delayTime?: number
  delayFeedback?: number
  flangerEnabled?: boolean
  flangerSpeed?: number
  flangerDepth?: number
  flangerFeedback?: number
  eqEnabled?: boolean
  eqLow?: number
  eqMid?: number
  eqHigh?: number
  distortionEnabled?: boolean
  compressorEnabled?: boolean
  compressorThreshold?: number
  compressorRatio?: number
  chorusEnabled?: boolean
  chorusDepth?: number
  chorusRate?: number
  tremoloEnabled?: boolean
  tremoloDepth?: number
  tremoloRate?: number
  reverbEnabled?: boolean
  reverbMix?: number
  reverbDecay?: number
  transposeSemitones: number
  filterType: 'none' | 'lowpass' | 'highpass'
  filterCutoff: number
  clips: Clip[]
}

export interface ProjectState {
  id?: string
  name?: string
  lastSavedAt?: number
  bpm: number
  tracks: Track[]
}

export interface MasterEQ {
  low: number
  mid: number
  high: number
}

export interface SelectedClipRef {
  trackId: string
  clipId: string
}

export interface ClipboardState {
  clip: Clip
  sourceTrackId: string
}
