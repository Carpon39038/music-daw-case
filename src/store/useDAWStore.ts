import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { BusGroup, ClipboardState, FavoriteClip, MasterEQ, MasterPreset, MasterSnapshot, ProjectState, SelectedClipRef, WaveType } from '../types'

export interface PlayheadDragState {
  isDragging: boolean
  originClientX: number
  originBeat: number
  beatWidthPx: number
}

export interface Checkpoint {
  id: string;
  timestamp: number;
  name: string;
  project: ProjectState;
}

export interface RecoverySnapshot {
  id: string
  timestamp: number
  name: string
  source: 'autosave' | 'pre-export'
  project: ProjectState
}

export interface ClipDragState {
  isDragging: boolean
  trackId: string
  clipId: string
  originStartBeat: number
  lengthBeats: number
  targetTrackId: string
  targetStartBeat: number
  targetConflicts: boolean
  isCopy: boolean
}

const TRACK_COUNT = 4
const DEFAULT_BUS_GROUPS: BusGroup[] = [
  {
    id: 'bus-drum',
    name: 'Drum',
    volume: 1,
    muted: false,
    solo: false,
    eqEnabled: false,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressorEnabled: false,
    compressorThreshold: -24,
    compressorRatio: 3,
  },
  {
    id: 'bus-bass',
    name: 'Bass',
    volume: 1,
    muted: false,
    solo: false,
    eqEnabled: false,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressorEnabled: false,
    compressorThreshold: -24,
    compressorRatio: 3,
  },
  {
    id: 'bus-music',
    name: 'Music',
    volume: 1,
    muted: false,
    solo: false,
    eqEnabled: false,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressorEnabled: false,
    compressorThreshold: -24,
    compressorRatio: 3,
  },
  {
    id: 'bus-fx',
    name: 'FX',
    volume: 1,
    muted: false,
    solo: false,
    eqEnabled: false,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressorEnabled: false,
    compressorThreshold: -24,
    compressorRatio: 3,
  },
]

const STORE_STORAGE_KEY = 'music-daw-case.store.v1'
const LEGACY_PROJECT_STORAGE_KEY = 'music-daw-case.project.v1'
const LEGACY_MASTER_VOLUME_KEY = 'music-daw-case.masterVolume.v1'
const LEGACY_MASTER_EQ_KEY = 'music-daw-case.masterEQ.v1'

export const MASTER_PRESET_SETTINGS = {
  none: { volume: 0.8, eq: { low: 0, mid: 0, high: 0 } },
  clean: { volume: 0.78, eq: { low: -0.5, mid: 0.8, high: 1.2 } },
  loud: { volume: 0.86, eq: { low: 1.5, mid: 0.8, high: 1.4 } },
  warm: { volume: 0.8, eq: { low: 2.6, mid: -0.8, high: -1.8 } },
  bright: { volume: 0.8, eq: { low: -1.2, mid: 0.6, high: 2.8 } },
} as const satisfies Record<MasterPreset, { volume: number; eq: MasterEQ }>

export interface ProjectTemplate {
  id: string
  name: string
  createdAt: number
  project: ProjectState
}

export interface GalleryProject {
  id: string
  name: string
  savedAt: number
  project: ProjectState
}

export type AchievementKey = 'firstExport' | 'firstChord' | 'first16Bars'

export interface AchievementProgress {
  unlocked: boolean
  unlockedAt?: number
}

export interface AchievementsState {
  firstExport: AchievementProgress
  firstChord: AchievementProgress
  first16Bars: AchievementProgress
}

interface PersistedDAWState {
  project: ProjectState
  masterVolume: number
  masterEQ: MasterEQ
  loopEnabled: boolean
  loopLengthBeats: number
  metronomeEnabled: boolean
  checkpoints: Checkpoint[]
  recoverySnapshots: RecoverySnapshot[]
  performanceMode: 'auto' | 'on' | 'off'
  projectTemplates: ProjectTemplate[]
  galleryProjects: GalleryProject[]
  favoriteClips: FavoriteClip[]
  achievements: AchievementsState
  masterPreset: MasterPreset
  masterPresetBaseline: MasterSnapshot | null
}

interface DAWState extends PersistedDAWState {
  isPlaying: boolean
  playheadBeat: number
  selectedTrackId: string | null
  selectedClipRef: SelectedClipRef | null
  selectedClipRefs: SelectedClipRef[]
  clipboard: ClipboardState | null
  favoriteClipSearchQuery: string
  past: ProjectState[]
  future: ProjectState[]
  playheadDrag: PlayheadDragState | null
  clipDrag: ClipDragState | null
  setClipDrag: (value: ClipDragState | null) => void
  setProject: (project: ProjectState, options?: { saveHistory?: boolean }) => void
  updateProject: (updater: (prev: ProjectState) => ProjectState, options?: { saveHistory?: boolean }) => void
  setIsPlaying: (value: boolean) => void
  setMetronomeEnabled: (value: boolean) => void
  setPerformanceMode: (value: 'auto' | 'on' | 'off') => void
  setPlayheadBeat: (value: number) => void
  setMasterVolume: (value: number) => void
  setMasterEQ: (value: MasterEQ) => void
  setLoopEnabled: (value: boolean) => void
  setLoopLengthBeats: (value: number) => void
  setSelectedTrackId: (value: string | null) => void
  setSelectedClipRef: (value: SelectedClipRef | null) => void
  setSelectedClipRefs: (value: SelectedClipRef[]) => void
  addSelectedClipRef: (value: SelectedClipRef) => void
  removeSelectedClipRef: (value: SelectedClipRef) => void
  setClipboard: (value: ClipboardState | null) => void
  setFavoriteClipSearchQuery: (value: string) => void
  saveFavoriteClip: (clip: FavoriteClip) => void
  deleteFavoriteClip: (id: string) => void
  setPlayheadDrag: (value: PlayheadDragState | null) => void
  pushHistory: (snapshot?: ProjectState) => void
  clearHistory: () => void
  undo: () => void
  redo: () => void
  resetProject: () => void
  saveCheckpoint: (name: string) => void
  restoreCheckpoint: (id: string) => void
  saveRecoverySnapshot: (snapshot: Omit<RecoverySnapshot, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void
  deleteRecoverySnapshot: (id: string) => void
  saveProjectTemplate: (name: string) => void
  loadProjectTemplate: (id: string) => void
  saveProjectToGallery: () => void
  unlockAchievement: (key: AchievementKey) => void
  deleteGalleryProject: (id: string) => void
  loadGalleryProject: (id: string) => void
  setMasterPreset: (value: MasterPreset) => void
  applyMasterPreset: (preset: MasterPreset) => void
  resetMasterPresetToBaseline: () => void
}

function createInitialProject(): ProjectState {
  const defaultNotes = [261.63, 329.63, 392.0, 523.25]
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    lastSavedAt: Date.now(),
    exportTargetPreset: {
      key: 'general',
      sampleRate: 44100,
      bitrateKbps: 192,
      targetLoudnessDb: -14,
      peakLimitDb: -1,
    },
    exportNamingTemplate: '{project}_{bpm}_{date}_{version}',
    bpm: 120,
    tempoCurveType: 'constant',
    tempoCurveTargetBpm: 120,
    scaleKey: 'C',
    scaleType: 'chromatic',
    markers: [],
    exportVersions: [],
    busGroups: structuredClone(DEFAULT_BUS_GROUPS),
    tracks: Array.from({ length: TRACK_COUNT }).map((_, i) => ({
      id: `track-${i + 1}`,
      name: `Track ${i + 1}`,
      volume: 0.7,
      pan: 0,
      muted: false,
      solo: false,
      color: '#6366f1',
      locked: false,
      transposeSemitones: 0,
      filterType: 'none',
      filterCutoff: 20000,
      reverbEnabled: false,
      distortionEnabled: false,
      reverbMix: 0.3,
      reverbDecay: 2,
      vocalFinalizerEnabled: false,
      vocalFinalizerPreset: 'clear',
      vocalFinalizerMix: 0.7,
      busGroupId: i === 0 ? 'bus-drum' : i === 1 ? 'bus-bass' : 'bus-music',
      clips: [
        {
          id: `clip-${i + 1}-1`,
          startBeat: i * 2,
          lengthBeats: 2,
          noteHz: defaultNotes[i],
          wave: (i % 2 === 0 ? 'sine' : 'square') as WaveType,
        },
      ],
    })),
  }
}

function isValidProjectState(value: unknown): value is ProjectState {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<ProjectState>
  if (typeof p.bpm !== 'number' || !Array.isArray(p.tracks)) return false
  if (p.markers !== undefined && !Array.isArray(p.markers)) return false
  if (p.name !== undefined && typeof p.name !== 'string') return false
  if (p.lastSavedAt !== undefined && typeof p.lastSavedAt !== 'number') return false
  if (p.releaseMetadata !== undefined && p.releaseMetadata !== null) {
    if (typeof p.releaseMetadata !== 'object') return false
    const m = p.releaseMetadata as {
      title?: unknown
      author?: unknown
      cover?: unknown
      tags?: unknown
      updatedAt?: unknown
    }
    if (typeof m.title !== 'string') return false
    if (typeof m.author !== 'string') return false
    if (typeof m.cover !== 'string') return false
    if (!Array.isArray(m.tags) || !m.tags.every((tag) => typeof tag === 'string')) return false
    if (typeof m.updatedAt !== 'number') return false
  }
  if (p.publishWizardTemplate !== undefined && p.publishWizardTemplate !== null) {
    if (typeof p.publishWizardTemplate !== 'object') return false
    const t = p.publishWizardTemplate as {
      titleCandidates?: unknown
      coverCopy?: unknown
      platformDescriptions?: unknown
      updatedAt?: unknown
    }
    if (!Array.isArray(t.titleCandidates) || !t.titleCandidates.every((item) => typeof item === 'string')) return false
    if (typeof t.coverCopy !== 'string') return false
    if (!t.platformDescriptions || typeof t.platformDescriptions !== 'object') return false
    const pd = t.platformDescriptions as { shortVideo?: unknown; podcast?: unknown; musicPlatform?: unknown }
    if (typeof pd.shortVideo !== 'string' || typeof pd.podcast !== 'string' || typeof pd.musicPlatform !== 'string') return false
    if (typeof t.updatedAt !== 'number') return false
  }
  if (p.markers !== undefined) {
    const validMarkers = p.markers.every((m) => m && typeof m.id === 'string' && typeof m.name === 'string' && typeof m.beat === 'number')
    if (!validMarkers) return false
  }
  if (p.arrangementVariationBundle !== undefined && p.arrangementVariationBundle !== null) {
    const bundle = p.arrangementVariationBundle as {
      createdAt?: unknown
      rangeStartBeat?: unknown
      rangeLengthBeats?: unknown
      variants?: unknown
      activeVariantId?: unknown
    }
    if (
      typeof bundle.createdAt !== 'number' ||
      typeof bundle.rangeStartBeat !== 'number' ||
      typeof bundle.rangeLengthBeats !== 'number' ||
      !Array.isArray(bundle.variants) ||
      (bundle.activeVariantId !== undefined && bundle.activeVariantId !== null && typeof bundle.activeVariantId !== 'string')
    ) {
      return false
    }
  }
  if (p.busGroups !== undefined) {
    if (!Array.isArray(p.busGroups)) return false
    const validBusGroups = p.busGroups.every((group) =>
      group &&
      typeof group.id === 'string' &&
      typeof group.name === 'string' &&
      typeof group.volume === 'number' &&
      typeof group.muted === 'boolean' &&
      typeof group.solo === 'boolean' &&
      (group.eqEnabled === undefined || typeof group.eqEnabled === 'boolean') &&
      (group.eqLow === undefined || typeof group.eqLow === 'number') &&
      (group.eqMid === undefined || typeof group.eqMid === 'number') &&
      (group.eqHigh === undefined || typeof group.eqHigh === 'number') &&
      (group.compressorEnabled === undefined || typeof group.compressorEnabled === 'boolean') &&
      (group.compressorThreshold === undefined || typeof group.compressorThreshold === 'number') &&
      (group.compressorRatio === undefined || typeof group.compressorRatio === 'number')
    )
    if (!validBusGroups) return false
  }
  return p.tracks.every((t) => {
    if (!t || typeof t !== 'object') return false
    if (
      typeof t.id !== 'string' ||
      typeof t.name !== 'string' ||
      typeof t.volume !== 'number' ||
      (typeof t.pan !== 'number' && typeof t.pan !== 'undefined') ||
      typeof t.muted !== 'boolean' ||
      typeof t.solo !== 'boolean' ||
      (typeof t.locked !== 'boolean' && typeof t.locked !== 'undefined') ||
      typeof t.transposeSemitones !== 'number' ||
      (t.compressorEnabled !== undefined && typeof t.compressorEnabled !== 'boolean') ||
      (t.compressorThreshold !== undefined && typeof t.compressorThreshold !== 'number') ||
      (t.compressorRatio !== undefined && typeof t.compressorRatio !== 'number') ||
      (t.chorusEnabled !== undefined && typeof t.chorusEnabled !== 'boolean') ||
      (t.chorusDepth !== undefined && typeof t.chorusDepth !== 'number') ||
      (t.chorusRate !== undefined && typeof t.chorusRate !== 'number') ||
      (t.tremoloEnabled !== undefined && typeof t.tremoloEnabled !== 'boolean') ||
      (t.tremoloDepth !== undefined && typeof t.tremoloDepth !== 'number') ||
      (t.tremoloRate !== undefined && typeof t.tremoloRate !== 'number') ||
      (t.reverbEnabled !== undefined && typeof t.reverbEnabled !== 'boolean') ||
      (t.reverbMix !== undefined && typeof t.reverbMix !== 'number') ||
      (t.reverbDecay !== undefined && typeof t.reverbDecay !== 'number') ||
      (t.vocalCleanEnabled !== undefined && typeof t.vocalCleanEnabled !== 'boolean') ||
      (t.vocalDenoiseAmount !== undefined && typeof t.vocalDenoiseAmount !== 'number') ||
      (t.vocalDeEssAmount !== undefined && typeof t.vocalDeEssAmount !== 'number') ||
      (t.vocalCompAmount !== undefined && typeof t.vocalCompAmount !== 'number') ||
      (t.vocalMakeupGainDb !== undefined && typeof t.vocalMakeupGainDb !== 'number') ||
      (t.vocalInputWarning !== undefined && t.vocalInputWarning !== null && !['low', 'clipping'].includes(t.vocalInputWarning)) ||
      (t.vocalInputAdvice !== undefined && typeof t.vocalInputAdvice !== 'string') ||
      (t.vocalFinalizerEnabled !== undefined && typeof t.vocalFinalizerEnabled !== 'boolean') ||
      (t.vocalFinalizerPreset !== undefined && !['clear', 'warm', 'intimate'].includes(t.vocalFinalizerPreset)) ||
      (t.vocalFinalizerMix !== undefined && typeof t.vocalFinalizerMix !== 'number') ||
      (t.filterType && !['none', 'lowpass', 'highpass'].includes(t.filterType)) ||
      (t.filterCutoff !== undefined && typeof t.filterCutoff !== 'number') ||
      (t.frozen !== undefined && typeof t.frozen !== 'boolean') ||
      (t.freezeAudioData !== undefined && typeof t.freezeAudioData !== 'string') ||
      (t.freezeSource !== undefined && typeof t.freezeSource !== 'object')
    ) {
      return false
    }
    if (!Array.isArray(t.clips)) return false
    return t.clips.every((c) => {
      if (!c || typeof c !== 'object') return false
      return (
        typeof c.id === 'string' &&
        typeof c.startBeat === 'number' &&
        typeof c.lengthBeats === 'number' &&
        typeof c.noteHz === 'number' &&
        (c.wave === 'sine' || c.wave === 'square' || c.wave === 'sawtooth' || c.wave === 'triangle')
      )
    })
  })
}

function normalizeProject(project: ProjectState): ProjectState {
  return {
    ...project,
    id: project.id ?? crypto.randomUUID(),
    name: project.name ?? 'Untitled Project',
    lastSavedAt: project.lastSavedAt ?? Date.now(),
    exportTargetPreset: {
      key: project.exportTargetPreset?.key ?? 'general',
      sampleRate: Math.max(22050, Math.min(96000, Math.round(project.exportTargetPreset?.sampleRate ?? 44100))),
      bitrateKbps: Math.max(64, Math.min(320, Math.round(project.exportTargetPreset?.bitrateKbps ?? 192))),
      targetLoudnessDb: Number.isFinite(project.exportTargetPreset?.targetLoudnessDb)
        ? Number(project.exportTargetPreset?.targetLoudnessDb)
        : -14,
      peakLimitDb: Number.isFinite(project.exportTargetPreset?.peakLimitDb)
        ? Number(project.exportTargetPreset?.peakLimitDb)
        : -1,
    },
    exportNamingTemplate: typeof project.exportNamingTemplate === 'string' ? project.exportNamingTemplate : '{project}_{bpm}_{date}_{version}',
    tempoCurveType: project.tempoCurveType ?? 'constant',
    tempoCurveTargetBpm: project.tempoCurveTargetBpm ?? project.bpm,
    scaleKey: project.scaleKey ?? 'C',
    scaleType: project.scaleType ?? 'chromatic',
    markers: (project.markers ?? []).map((marker) => ({
      id: marker.id,
      name: marker.name,
      beat: Math.max(0, Math.min(16, marker.beat)),
    })),
    exportVersions: (project.exportVersions ?? []).slice(0, 5),
    releaseMetadata: project.releaseMetadata
      ? {
          title: project.releaseMetadata.title,
          author: project.releaseMetadata.author,
          cover: project.releaseMetadata.cover,
          tags: Array.isArray(project.releaseMetadata.tags)
            ? project.releaseMetadata.tags.map((tag) => String(tag)).filter(Boolean).slice(0, 8)
            : [],
          updatedAt: project.releaseMetadata.updatedAt,
        }
      : undefined,
    publishWizardTemplate: project.publishWizardTemplate
      ? {
          titleCandidates: Array.isArray(project.publishWizardTemplate.titleCandidates)
            ? project.publishWizardTemplate.titleCandidates.map((item) => String(item)).filter(Boolean).slice(0, 5)
            : [],
          coverCopy: String(project.publishWizardTemplate.coverCopy ?? ''),
          platformDescriptions: {
            shortVideo: String(project.publishWizardTemplate.platformDescriptions?.shortVideo ?? ''),
            podcast: String(project.publishWizardTemplate.platformDescriptions?.podcast ?? ''),
            musicPlatform: String(project.publishWizardTemplate.platformDescriptions?.musicPlatform ?? ''),
          },
          updatedAt: Number.isFinite(project.publishWizardTemplate.updatedAt)
            ? Number(project.publishWizardTemplate.updatedAt)
            : Date.now(),
        }
      : undefined,
    arrangementVariationBundle: project.arrangementVariationBundle
      ? {
          createdAt: Number.isFinite(project.arrangementVariationBundle.createdAt)
            ? Number(project.arrangementVariationBundle.createdAt)
            : Date.now(),
          rangeStartBeat: Math.max(0, Math.min(16, Math.round(project.arrangementVariationBundle.rangeStartBeat ?? 0))),
          rangeLengthBeats: Math.max(8, Math.min(16, Math.round(project.arrangementVariationBundle.rangeLengthBeats ?? 8))),
          variants: Array.isArray(project.arrangementVariationBundle.variants)
            ? project.arrangementVariationBundle.variants.map((variant) => ({
                id: String(variant.id),
                name: variant.name === 'conservative' || variant.name === 'aggressive' ? variant.name : 'standard',
                createdAt: Number.isFinite(variant.createdAt) ? Number(variant.createdAt) : Date.now(),
                rangeStartBeat: Math.max(0, Math.min(16, Math.round(variant.rangeStartBeat ?? 0))),
                rangeLengthBeats: Math.max(8, Math.min(16, Math.round(variant.rangeLengthBeats ?? 8))),
                tracks: Array.isArray(variant.tracks)
                  ? variant.tracks.map((track) => ({
                      trackId: String(track.trackId),
                      clips: Array.isArray(track.clips) ? track.clips : [],
                    }))
                  : [],
                markers: Array.isArray(variant.markers)
                  ? variant.markers.map((marker) => ({
                      id: String(marker.id),
                      name: String(marker.name),
                      beat: Math.max(0, Math.min(16, Number(marker.beat) || 0)),
                    }))
                  : [],
              }))
            : [],
          activeVariantId:
            typeof project.arrangementVariationBundle.activeVariantId === 'string'
              ? project.arrangementVariationBundle.activeVariantId
              : null,
        }
      : undefined,
    busGroups: Array.isArray(project.busGroups) && project.busGroups.length > 0
      ? project.busGroups.map((group) => ({
          id: String(group.id),
          name: String(group.name ?? 'Bus'),
          volume: typeof group.volume === 'number' ? Math.max(0, Math.min(1.5, group.volume)) : 1,
          muted: Boolean(group.muted),
          solo: Boolean(group.solo),
          eqEnabled: Boolean(group.eqEnabled),
          eqLow: typeof group.eqLow === 'number' ? Math.max(-12, Math.min(12, group.eqLow)) : 0,
          eqMid: typeof group.eqMid === 'number' ? Math.max(-12, Math.min(12, group.eqMid)) : 0,
          eqHigh: typeof group.eqHigh === 'number' ? Math.max(-12, Math.min(12, group.eqHigh)) : 0,
          compressorEnabled: Boolean(group.compressorEnabled),
          compressorThreshold: typeof group.compressorThreshold === 'number' ? Math.max(-60, Math.min(0, group.compressorThreshold)) : -24,
          compressorRatio: typeof group.compressorRatio === 'number' ? Math.max(1, Math.min(20, group.compressorRatio)) : 3,
        }))
      : structuredClone(DEFAULT_BUS_GROUPS),
    tracks: project.tracks.map((track) => ({
      ...track,
      locked: track.locked ?? false,
      busGroupId: track.busGroupId ?? null,
      pan: track.pan ?? 0,
      filterType: track.filterType ?? 'none',
      compressorEnabled: track.compressorEnabled ?? false,
      compressorThreshold: track.compressorThreshold ?? -24,
      compressorRatio: track.compressorRatio ?? 12,
      chorusEnabled: track.chorusEnabled ?? false,
      chorusDepth: track.chorusDepth ?? 0.5,
      chorusRate: track.chorusRate ?? 1.5,
      tremoloEnabled: track.tremoloEnabled ?? false,
      tremoloDepth: track.tremoloDepth ?? 0.5,
      tremoloRate: track.tremoloRate ?? 5.0,
      reverbEnabled: track.reverbEnabled ?? false,
      distortionEnabled: track.distortionEnabled ?? false,
      reverbMix: track.reverbMix ?? 0.3,
      reverbDecay: track.reverbDecay ?? 2,
      vocalCleanEnabled: track.vocalCleanEnabled ?? false,
      vocalDenoiseAmount: track.vocalDenoiseAmount ?? 0.45,
      vocalDeEssAmount: track.vocalDeEssAmount ?? 0.5,
      vocalCompAmount: track.vocalCompAmount ?? 0.55,
      vocalMakeupGainDb: track.vocalMakeupGainDb ?? 2,
      vocalInputWarning: track.vocalInputWarning ?? null,
      vocalInputAdvice: track.vocalInputAdvice ?? '',
      filterCutoff: track.filterCutoff ?? 20000,
      frozen: track.frozen ?? false,
      freezeAudioData: track.freezeAudioData,
      freezeSource: track.freezeSource,
    })),
  }
}

function cloneProject(project: ProjectState): ProjectState {
  return structuredClone(project)
}

function createInitialAchievements(): AchievementsState {
  return {
    firstExport: { unlocked: false },
    firstChord: { unlocked: false },
    first16Bars: { unlocked: false },
  }
}

function getDefaultPersistedState(): PersistedDAWState {
  return {
    project: createInitialProject(),
    masterVolume: MASTER_PRESET_SETTINGS.none.volume,
    masterEQ: { ...MASTER_PRESET_SETTINGS.none.eq },
    masterPreset: 'none',
    masterPresetBaseline: null,
    loopEnabled: false,
    loopLengthBeats: 8,
    metronomeEnabled: false,
    checkpoints: [],
    recoverySnapshots: [],
    performanceMode: 'auto',
    projectTemplates: [],
    galleryProjects: [],
    favoriteClips: [],
    achievements: createInitialAchievements(),
  }
}

function loadLegacyPersistedState(): PersistedDAWState {
  const defaults = getDefaultPersistedState()
  if (typeof window === 'undefined') return defaults

  let project = defaults.project
  try {
    const raw = window.localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isValidProjectState(parsed)) {
        project = normalizeProject(parsed)
      }
    }
  } catch {
    project = defaults.project
  }

  let masterVolume = defaults.masterVolume
  try {
    const raw = window.localStorage.getItem(LEGACY_MASTER_VOLUME_KEY)
    if (raw !== null) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) {
        masterVolume = parsed
      }
    }
  } catch {
    masterVolume = defaults.masterVolume
  }

  let masterEQ = defaults.masterEQ
  try {
    const raw = window.localStorage.getItem(LEGACY_MASTER_EQ_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        parsed &&
        typeof parsed.low === 'number' &&
        typeof parsed.mid === 'number' &&
        typeof parsed.high === 'number'
      ) {
        masterEQ = parsed
      }
    }
  } catch {
    masterEQ = defaults.masterEQ
  }

  return {
    ...defaults,
    project,
    masterVolume,
    masterEQ,
    masterPreset: 'none',
    masterPresetBaseline: null,
  }
}

const initialPersistedState = loadLegacyPersistedState()

export const useDAWStore = create<DAWState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      isPlaying: false,
      playheadBeat: 0,
      selectedTrackId: null,
      selectedClipRef: null,
      selectedClipRefs: [],
      clipboard: null,
      favoriteClipSearchQuery: '',
      past: [],
      future: [],
      playheadDrag: null,
      clipDrag: null,
      setProject: (project, options) =>
        set((state) => {
          const nextProject = normalizeProject({ ...project, lastSavedAt: Date.now() })
          if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state
          const saveHistory = options?.saveHistory ?? false
          let checkpoints = state.checkpoints || [];
          let recoverySnapshots = state.recoverySnapshots || []
          if (saveHistory) {
             const lastCp = checkpoints[0];
             if (!lastCp || Date.now() - lastCp.timestamp > 60 * 1000) {
                const now = Date.now()
                const newCheckpoint: Checkpoint = {
                  id: crypto.randomUUID(),
                  timestamp: now,
                  name: "Auto-save",
                  project: cloneProject(nextProject)
                };
                checkpoints = [newCheckpoint, ...checkpoints].slice(0, 20);
                const newRecoverySnapshot: RecoverySnapshot = {
                  id: crypto.randomUUID(),
                  timestamp: now,
                  name: 'Auto-save',
                  source: 'autosave',
                  project: cloneProject(nextProject),
                }
                recoverySnapshots = [newRecoverySnapshot, ...recoverySnapshots].slice(0, 5)
             }
          }
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
            checkpoints,
            recoverySnapshots,
          }
        }),
      updateProject: (updater, options) =>
        set((state) => {
          const nextProject = normalizeProject({ ...updater(state.project), lastSavedAt: Date.now() })
          if (nextProject === state.project) return state
          const saveHistory = options?.saveHistory ?? false
          let checkpoints = state.checkpoints || [];
          let recoverySnapshots = state.recoverySnapshots || []
          if (saveHistory) {
             const lastCp = checkpoints.find(c => c.name === "Auto-save");
             if (!lastCp || Date.now() - lastCp.timestamp > 60 * 1000) {
                const now = Date.now()
                const newCheckpoint: Checkpoint = {
                  id: crypto.randomUUID(),
                  timestamp: now,
                  name: "Auto-save",
                  project: cloneProject(nextProject)
                };
                checkpoints = [newCheckpoint, ...checkpoints].slice(0, 20);
                const newRecoverySnapshot: RecoverySnapshot = {
                  id: crypto.randomUUID(),
                  timestamp: now,
                  name: 'Auto-save',
                  source: 'autosave',
                  project: cloneProject(nextProject),
                }
                recoverySnapshots = [newRecoverySnapshot, ...recoverySnapshots].slice(0, 5)
             }
          }
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
            checkpoints,
            recoverySnapshots,
          }
        }),
      setIsPlaying: (value) => set({ isPlaying: value }),
      setMetronomeEnabled: (value) => set({ metronomeEnabled: value }),
      setPerformanceMode: (value) => set({ performanceMode: value }),
      setPlayheadBeat: (value) => set({ playheadBeat: value }),
      setMasterVolume: (value) =>
        set((state) => ({
          masterVolume: value,
          ...(state.masterPreset === 'none' ? {} : { masterPreset: 'none', masterPresetBaseline: null }),
        })),
      setMasterEQ: (value) =>
        set((state) => ({
          masterEQ: value,
          ...(state.masterPreset === 'none' ? {} : { masterPreset: 'none', masterPresetBaseline: null }),
        })),
      setMasterPreset: (value) => set({ masterPreset: value }),
      applyMasterPreset: (preset) =>
        set((state) => {
          if (preset === 'none') {
            if (!state.masterPresetBaseline) {
              return { masterPreset: 'none' }
            }
            return {
              masterVolume: state.masterPresetBaseline.masterVolume,
              masterEQ: state.masterPresetBaseline.masterEQ,
              masterPreset: 'none',
              masterPresetBaseline: null,
            }
          }

          const baseline = state.masterPreset === 'none'
            ? {
                masterVolume: state.masterVolume,
                masterEQ: state.masterEQ,
                masterPreset: 'none' as MasterPreset,
              }
            : (state.masterPresetBaseline ?? {
                masterVolume: state.masterVolume,
                masterEQ: state.masterEQ,
                masterPreset: 'none' as MasterPreset,
              })
          const presetSettings = MASTER_PRESET_SETTINGS[preset]
          return {
            masterVolume: presetSettings.volume,
            masterEQ: presetSettings.eq,
            masterPreset: preset,
            masterPresetBaseline: baseline,
          }
        }),
      resetMasterPresetToBaseline: () =>
        set((state) => {
          if (!state.masterPresetBaseline) {
            return { masterPreset: 'none' }
          }
          return {
            masterVolume: state.masterPresetBaseline.masterVolume,
            masterEQ: state.masterPresetBaseline.masterEQ,
            masterPreset: 'none',
            masterPresetBaseline: null,
          }
        }),
      setLoopEnabled: (value) => set({ loopEnabled: value }),
      setLoopLengthBeats: (value) => set({ loopLengthBeats: value }),
      setSelectedTrackId: (value) => set({ selectedTrackId: value }),
      setSelectedClipRef: (value) => set({ selectedClipRef: value }),
      setSelectedClipRefs: (value) => set({ selectedClipRefs: value }),
      addSelectedClipRef: (value) => set((state) => {
        const exists = state.selectedClipRefs.some(r => r.trackId === value.trackId && r.clipId === value.clipId)
        if (exists) return state
        return { selectedClipRefs: [...state.selectedClipRefs, value] }
      }),
      removeSelectedClipRef: (value) => set((state) => ({
        selectedClipRefs: state.selectedClipRefs.filter(r => !(r.trackId === value.trackId && r.clipId === value.clipId))
      })),
      setClipboard: (value) => set({ clipboard: value }),
      setFavoriteClipSearchQuery: (value) => set({ favoriteClipSearchQuery: value }),
      saveFavoriteClip: (clip) =>
        set((state) => {
          const deduped = state.favoriteClips.filter((item) => item.id !== clip.id)
          return {
            favoriteClips: [clip, ...deduped].slice(0, 200),
          }
        }),
      deleteFavoriteClip: (id) =>
        set((state) => ({
          favoriteClips: state.favoriteClips.filter((item) => item.id !== id),
        })),
      setPlayheadDrag: (value) => set({ playheadDrag: value }),
      setClipDrag: (value) => set({ clipDrag: value }),
      pushHistory: (snapshot) =>
        set((state) => ({
          past: [...state.past, cloneProject(snapshot ?? state.project)].slice(-100),
          future: [],
        })),
      clearHistory: () => set({ past: [], future: [] }),
      undo: () =>
        set((state) => {
          if (state.past.length === 0) return state
          const previous = state.past[state.past.length - 1]
          return {
            project: cloneProject(previous),
            past: state.past.slice(0, -1),
            future: [cloneProject(state.project), ...state.future],
          }
        }),
      redo: () =>
        set((state) => {
          if (state.future.length === 0) return state
          const [next, ...future] = state.future
          return {
            project: cloneProject(next),
            past: [...state.past, cloneProject(state.project)].slice(-100),
            future,
          }
        }),
      saveCheckpoint: (name) =>
        set((state) => {
          const newCheckpoint: Checkpoint = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            name,
            project: cloneProject(state.project),
          };
          return { checkpoints: [newCheckpoint, ...state.checkpoints].slice(0, 20) }; // Keep last 20
        }),
      restoreCheckpoint: (id) =>
        set((state) => {
          const cp = state.checkpoints.find(c => c.id === id);
          if (!cp) return state;
          return {
            project: cloneProject(cp.project),
            past: [...state.past, cloneProject(state.project)].slice(-100),
            future: [],
          };
        }),
      saveRecoverySnapshot: (snapshot) =>
        set((state) => {
          const nextSnapshot: RecoverySnapshot = {
            id: snapshot.id ?? crypto.randomUUID(),
            timestamp: snapshot.timestamp ?? Date.now(),
            name: snapshot.name,
            source: snapshot.source,
            project: cloneProject(snapshot.project),
          }
          return {
            recoverySnapshots: [nextSnapshot, ...(state.recoverySnapshots || [])].slice(0, 5),
          }
        }),
      deleteRecoverySnapshot: (id) =>
        set((state) => ({
          recoverySnapshots: (state.recoverySnapshots || []).filter((item) => item.id !== id),
        })),
      saveProjectTemplate: (name) =>
        set((state) => {
          const trimmedName = name.trim()
          if (!trimmedName) return state
          const newTemplate: ProjectTemplate = {
            id: crypto.randomUUID(),
            name: trimmedName,
            createdAt: Date.now(),
            project: cloneProject(state.project),
          }
          return {
            projectTemplates: [newTemplate, ...state.projectTemplates].slice(0, 50),
          }
        }),
      loadProjectTemplate: (id) =>
        set((state) => {
          const template = state.projectTemplates.find((t) => t.id === id)
          if (!template) return state
          const nextProject = normalizeProject({ ...cloneProject(template.project), lastSavedAt: Date.now() })
          return {
            project: nextProject,
            past: [...state.past, cloneProject(state.project)].slice(-100),
            future: [],
          }
        }),
      saveProjectToGallery: () =>
        set((state) => {
          const galleryEntry: GalleryProject = {
            id: state.project.id ?? crypto.randomUUID(),
            name: state.project.name?.trim() || 'Untitled Project',
            savedAt: Date.now(),
            project: cloneProject(state.project),
          }
          const withoutCurrent = state.galleryProjects.filter((p) => p.id !== galleryEntry.id)
          return {
            galleryProjects: [galleryEntry, ...withoutCurrent].slice(0, 100),
          }
        }),
      deleteGalleryProject: (id) =>
        set((state) => ({
          galleryProjects: state.galleryProjects.filter((p) => p.id !== id),
        })),
      loadGalleryProject: (id) =>
        set((state) => {
          const galleryProject = state.galleryProjects.find((p) => p.id === id)
          if (!galleryProject) return state
          const nextProject = normalizeProject({ ...cloneProject(galleryProject.project), lastSavedAt: Date.now() })
          return {
            project: nextProject,
            past: [...state.past, cloneProject(state.project)].slice(-100),
            future: [],
          }
        }),
      unlockAchievement: (key) =>
        set((state) => {
          const current = state.achievements[key]
          if (current?.unlocked) return state
          return {
            achievements: {
              ...state.achievements,
              [key]: {
                unlocked: true,
                unlockedAt: Date.now(),
              },
            },
          }
        }),
      resetProject: () =>
        set((state) => ({
          ...getDefaultPersistedState(),
          projectTemplates: state.projectTemplates,
          galleryProjects: state.galleryProjects,
          favoriteClips: state.favoriteClips,
          achievements: state.achievements,
          isPlaying: false,
          playheadBeat: 0,
          selectedTrackId: null,
          selectedClipRef: null,
          clipboard: null,
          past: [],
          future: [],
        })),
    }),
    {
      name: STORE_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        project: state.project,
        masterVolume: state.masterVolume,
        masterEQ: state.masterEQ,
        masterPreset: state.masterPreset,
        masterPresetBaseline: state.masterPresetBaseline,
        loopEnabled: state.loopEnabled,
        loopLengthBeats: state.loopLengthBeats,
        metronomeEnabled: state.metronomeEnabled,
        checkpoints: state.checkpoints || [],
        recoverySnapshots: state.recoverySnapshots || [],
        performanceMode: state.performanceMode,
        projectTemplates: state.projectTemplates || [],
        galleryProjects: state.galleryProjects || [],
        favoriteClips: state.favoriteClips || [],
        achievements: state.achievements || createInitialAchievements(),
      }),
    },
  ),
)

export {
  LEGACY_MASTER_EQ_KEY,
  LEGACY_MASTER_VOLUME_KEY,
  LEGACY_PROJECT_STORAGE_KEY,
  STORE_STORAGE_KEY,
}
