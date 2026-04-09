import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ClipboardState, MasterEQ, ProjectState, SelectedClipRef, WaveType } from '../types'

export interface PlayheadDragState {
  isDragging: boolean
  originClientX: number
  originBeat: number
  beatWidthPx: number
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
}

const TRACK_COUNT = 4
const STORE_STORAGE_KEY = 'music-daw-case.store.v1'
const LEGACY_PROJECT_STORAGE_KEY = 'music-daw-case.project.v1'
const LEGACY_MASTER_VOLUME_KEY = 'music-daw-case.masterVolume.v1'
const LEGACY_MASTER_EQ_KEY = 'music-daw-case.masterEQ.v1'

interface PersistedDAWState {
  project: ProjectState
  masterVolume: number
  masterEQ: MasterEQ
  loopEnabled: boolean
  loopLengthBeats: number
  metronomeEnabled: boolean
}

interface DAWState extends PersistedDAWState {
  isPlaying: boolean
  playheadBeat: number
  selectedTrackId: string | null
  selectedClipRef: SelectedClipRef | null
  selectedClipRefs: SelectedClipRef[]
  clipboard: ClipboardState | null
  past: ProjectState[]
  future: ProjectState[]
  playheadDrag: PlayheadDragState | null
  clipDrag: ClipDragState | null
  setClipDrag: (value: ClipDragState | null) => void
  setProject: (project: ProjectState, options?: { saveHistory?: boolean }) => void
  updateProject: (updater: (prev: ProjectState) => ProjectState, options?: { saveHistory?: boolean }) => void
  setIsPlaying: (value: boolean) => void
  setMetronomeEnabled: (value: boolean) => void
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
  setPlayheadDrag: (value: PlayheadDragState | null) => void
  pushHistory: (snapshot?: ProjectState) => void
  clearHistory: () => void
  undo: () => void
  redo: () => void
  resetProject: () => void
}

function createInitialProject(): ProjectState {
  const defaultNotes = [261.63, 329.63, 392.0, 523.25]
  return {
    bpm: 120,
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
      (t.filterType && !['none', 'lowpass', 'highpass'].includes(t.filterType)) ||
      (t.filterCutoff !== undefined && typeof t.filterCutoff !== 'number')
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
    tracks: project.tracks.map((track) => ({
      ...track,
      locked: track.locked ?? false,
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
      filterCutoff: track.filterCutoff ?? 20000,
    })),
  }
}

function cloneProject(project: ProjectState): ProjectState {
  return structuredClone(project)
}

function getDefaultPersistedState(): PersistedDAWState {
  return {
    project: createInitialProject(),
    masterVolume: 0.8,
    masterEQ: { low: 0, mid: 0, high: 0 },
    loopEnabled: false,
    loopLengthBeats: 8,
    metronomeEnabled: false,
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
      past: [],
      future: [],
      playheadDrag: null,
      clipDrag: null,
      setProject: (project, options) =>
        set((state) => {
          const nextProject = normalizeProject(project)
          if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state
          const saveHistory = options?.saveHistory ?? false
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
          }
        }),
      updateProject: (updater, options) =>
        set((state) => {
          const nextProject = normalizeProject(updater(state.project))
          if (nextProject === state.project) return state
          const saveHistory = options?.saveHistory ?? false
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
          }
        }),
      setIsPlaying: (value) => set({ isPlaying: value }),
      setMetronomeEnabled: (value) => set({ metronomeEnabled: value }),
      setPlayheadBeat: (value) => set({ playheadBeat: value }),
      setMasterVolume: (value) => set({ masterVolume: value }),
      setMasterEQ: (value) => set({ masterEQ: value }),
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
      resetProject: () =>
        set({
          ...getDefaultPersistedState(),
          isPlaying: false,
          playheadBeat: 0,
          selectedTrackId: null,
          selectedClipRef: null,
          clipboard: null,
          past: [],
          future: [],
        }),
    }),
    {
      name: STORE_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        project: state.project,
        masterVolume: state.masterVolume,
        masterEQ: state.masterEQ,
        loopEnabled: state.loopEnabled,
        loopLengthBeats: state.loopLengthBeats,
        metronomeEnabled: state.metronomeEnabled,
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
