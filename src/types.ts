export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'organ' | 'brass'

export interface ClipEnvelopePoint {
  beat: number
  gain: number
}

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
  audioAlignMode?: 'preservePitch' | 'preserveDuration'
  audioStretchRatio?: number
  vocalTimingMode?: 'grid' | 'barStretch'
  vocalTimingEnabled?: boolean
  vocalTimingOriginalStartBeat?: number
  vocalTimingOriginalLengthBeats?: number
  envelope?: ClipEnvelopePoint[]
}

export interface FrozenTrackSnapshot {
  clips: Clip[]
  volume: number
  pan: number
  transposeSemitones: number
  filterType: 'none' | 'lowpass' | 'highpass'
  filterCutoff: number
  isDrumTrack?: boolean
  drumSequence?: {
    kick: boolean[]
    snare: boolean[]
    hihat: boolean[]
  }
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
  vocalCleanEnabled?: boolean
  vocalDenoiseAmount?: number
  vocalDeEssAmount?: number
  vocalCompAmount?: number
  vocalMakeupGainDb?: number
  vocalInputWarning?: 'low' | 'clipping' | null
  vocalInputAdvice?: string
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
  isDrumTrack?: boolean
  drumSequence?: {
    kick: boolean[]
    snare: boolean[]
    hihat: boolean[]
  }
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
  vocalCleanEnabled?: boolean
  vocalDenoiseAmount?: number
  vocalDeEssAmount?: number
  vocalCompAmount?: number
  vocalMakeupGainDb?: number
  vocalInputWarning?: 'low' | 'clipping' | null
  vocalInputAdvice?: string
  transposeSemitones: number
  filterType: 'none' | 'lowpass' | 'highpass'
  filterCutoff: number
  clips: Clip[]
  frozen?: boolean
  freezeAudioData?: string
  freezeSource?: FrozenTrackSnapshot
}

export interface Marker {
  id: string
  name: string
  beat: number
}

export interface ExportVersionEntry {
  id: string
  name: string
  createdAt: number
  format: 'wav' | 'mp3'
  durationSec: number
  peakDb: number
  rmsDb: number
  audioDataUrl?: string
}

export interface ReleaseMetadata {
  title: string
  author: string
  cover: string
  tags: string[]
  updatedAt: number
}

export interface ProjectState {
  id?: string
  name?: string
  lastSavedAt?: number
  bpm: number
  tempoCurveType?: 'constant' | 'accelerando' | 'ritardando'
  tempoCurveTargetBpm?: number
  scaleKey?: string
  scaleType?: string
  tracks: Track[]
  markers?: Marker[]
  exportVersions?: ExportVersionEntry[]
  releaseMetadata?: ReleaseMetadata
}

export interface MasterEQ {
  low: number
  mid: number
  high: number
}

export type MasterPreset = 'none' | 'clean' | 'loud' | 'warm' | 'bright'

export interface MasterSnapshot {
  masterVolume: number
  masterEQ: MasterEQ
  masterPreset: MasterPreset
}

export interface SelectedClipRef {
  trackId: string
  clipId: string
}

export interface ClipboardState {
  clip: Clip
  sourceTrackId: string
}

export interface FavoriteClip {
  id: string
  name: string
  durationBeats: number
  noteLabel: string
  scaleKey: string
  scaleType: string
  savedAt: number
  clip: Clip
}
