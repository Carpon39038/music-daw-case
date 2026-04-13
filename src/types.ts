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
  vocalPitchEnabled?: boolean
  vocalPitchStyle?: 'natural' | 'pop'
  vocalPitchDryWet?: number
  vocalPitchOriginalTransposeSemitones?: number
  vocalPitchCorrectedTransposeSemitones?: number
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
  vocalFinalizerEnabled?: boolean
  vocalFinalizerPreset?: 'clear' | 'warm' | 'intimate'
  vocalFinalizerMix?: number
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
  busGroupId?: string | null
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
  vocalFinalizerEnabled?: boolean
  vocalFinalizerPreset?: 'clear' | 'warm' | 'intimate'
  vocalFinalizerMix?: number
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

export type ExportTargetPresetKey = 'short-video' | 'podcast' | 'music-platform' | 'general' | 'custom'

export interface ExportTargetPreset {
  key: ExportTargetPresetKey
  sampleRate: number
  bitrateKbps: number
  targetLoudnessDb: number
  peakLimitDb: number
}

export interface BandProfile {
  lowDb: number
  midDb: number
  highDb: number
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
  exportTargetPresetKey?: ExportTargetPresetKey
  sampleRate?: number
  bitrateKbps?: number
  targetLoudnessDb?: number
  peakLimitDb?: number
  bandProfile?: BandProfile
}

export interface ReleaseMetadata {
  title: string
  author: string
  cover: string
  tags: string[]
  updatedAt: number
}

export interface PublishWizardTemplate {
  titleCandidates: string[]
  coverCopy: string
  platformDescriptions: {
    shortVideo: string
    podcast: string
    musicPlatform: string
  }
  updatedAt: number
}

export interface MixReportTrackSummary {
  trackId: string
  trackName: string
  peakDb: number
  rmsDb: number
}

export interface MixReportEntry {
  id: string
  createdAt: number
  exportFormat: 'wav' | 'mp3'
  durationSec: number
  projectPeakDb: number
  projectRmsDb: number
  loudnessDistribution: {
    quiet: number
    balanced: number
    hot: number
  }
  trackSummaries: MixReportTrackSummary[]
  suggestions: string[]
}

export interface ReferenceMatchSuggestion {
  id: string
  type: 'master-eq' | 'master-dynamics'
  label: string
  detail: string
  from: number
  to: number
  applied: boolean
}

export interface ReferenceMatchReport {
  targetType: 'export-version' | 'reference-track'
  targetLabel: string
  checkedAt: number
  before: BandProfile
  after: BandProfile
  suggestions: ReferenceMatchSuggestion[]
}

export interface ArrangementVariation {
  id: string
  name: 'conservative' | 'standard' | 'aggressive'
  createdAt: number
  rangeStartBeat: number
  rangeLengthBeats: number
  tracks: Array<{
    trackId: string
    clips: Clip[]
  }>
  markers: Marker[]
}

export interface ArrangementVariationBundle {
  createdAt: number
  rangeStartBeat: number
  rangeLengthBeats: number
  variants: ArrangementVariation[]
  activeVariantId?: string | null
}

export interface BusGroup {
  id: string
  name: string
  volume: number
  muted: boolean
  solo: boolean
  eqEnabled?: boolean
  eqLow?: number
  eqMid?: number
  eqHigh?: number
  compressorEnabled?: boolean
  compressorThreshold?: number
  compressorRatio?: number
}

export interface ProjectState {
  id?: string
  name?: string
  lastSavedAt?: number
  exportTargetPreset?: ExportTargetPreset
  exportNamingTemplate?: string
  bpm: number
  tempoCurveType?: 'constant' | 'accelerando' | 'ritardando'
  tempoCurveTargetBpm?: number
  scaleKey?: string
  scaleType?: string
  tracks: Track[]
  markers?: Marker[]
  exportVersions?: ExportVersionEntry[]
  mixReports?: MixReportEntry[]
  releaseMetadata?: ReleaseMetadata
  publishWizardTemplate?: PublishWizardTemplate
  referenceMatchHistory?: ReferenceMatchReport[]
  arrangementVariationBundle?: ArrangementVariationBundle
  busGroups?: BusGroup[]
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
