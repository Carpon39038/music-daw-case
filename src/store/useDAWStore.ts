import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ClipboardState, MasterEQ, ProjectState, SelectedClipRef, WaveType } from '../types'

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
const STORE_STORAGE_KEY = 'music-daw-case.store.v1'
const LEGACY_PROJECT_STORAGE_KEY = 'music-daw-case.project.v1'
const LEGACY_MASTER_VOLUME_KEY = 'music-daw-case.masterVolume.v1'
const LEGACY_MASTER_EQ_KEY = 'music-daw-case.masterEQ.v1'

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

interface PersistedDAWState {
  project: ProjectState
  masterVolume: number
  masterEQ: MasterEQ
  loopEnabled: boolean
  loopLengthBeats: number
  metronomeEnabled: boolean
  checkpoints: Checkpoint[]
  performanceMode: 'auto' | 'on' | 'off'
  projectTemplates: ProjectTemplate[]
  galleryProjects: GalleryProject[]
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
  setPlayheadDrag: (value: PlayheadDragState | null) => void
  pushHistory: (snapshot?: ProjectState) => void
  clearHistory: () => void
  undo: () => void
  redo: () => void
  resetProject: () => void
  saveCheckpoint: (name: string) => void
  restoreCheckpoint: (id: string) => void
  saveProjectTemplate: (name: string) => void
  loadProjectTemplate: (id: string) => void
  saveProjectToGallery: () => void
  deleteGalleryProject: (id: string) => void
  loadGalleryProject: (id: string) => void
}

function createInitialProject(): ProjectState {
  const defaultNotes = [261.63, 329.63, 392.0, 523.25]
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    lastSavedAt: Date.now(),
    bpm: 120,
    tempoCurveType: 'constant',
    tempoCurveTargetBpm: 120,
    scaleKey: 'C',
    scaleType: 'chromatic',
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
  if (p.name !== undefined && typeof p.name !== 'string') return false
  if (p.lastSavedAt !== undefined && typeof p.lastSavedAt !== 'number') return false
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
    id: project.id ?? crypto.randomUUID(),
    name: project.name ?? 'Untitled Project',
    lastSavedAt: project.lastSavedAt ?? Date.now(),
    tempoCurveType: project.tempoCurveType ?? 'constant',
    tempoCurveTargetBpm: project.tempoCurveTargetBpm ?? project.bpm,
    scaleKey: project.scaleKey ?? 'C',
    scaleType: project.scaleType ?? 'chromatic',
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
    checkpoints: [],
    performanceMode: 'auto',
    projectTemplates: [],
    galleryProjects: [],
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
          const nextProject = normalizeProject({ ...project, lastSavedAt: Date.now() })
          if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state
          const saveHistory = options?.saveHistory ?? false
          let checkpoints = state.checkpoints || [];
          if (saveHistory) {
             const lastCp = checkpoints[0];
             if (!lastCp || Date.now() - lastCp.timestamp > 60 * 1000) {
                const newCheckpoint: Checkpoint = {
                  id: crypto.randomUUID(),
                  timestamp: Date.now(),
                  name: "Auto-save",
                  project: cloneProject(nextProject)
                };
                checkpoints = [newCheckpoint, ...checkpoints].slice(0, 20);
             }
          }
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
            checkpoints
          }
        }),
      updateProject: (updater, options) =>
        set((state) => {
          const nextProject = normalizeProject({ ...updater(state.project), lastSavedAt: Date.now() })
          if (nextProject === state.project) return state
          const saveHistory = options?.saveHistory ?? false
          let checkpoints = state.checkpoints || [];
          if (saveHistory) {
             const lastCp = checkpoints.find(c => c.name === "Auto-save");
             if (!lastCp || Date.now() - lastCp.timestamp > 60 * 1000) {
                const newCheckpoint: Checkpoint = {
                  id: crypto.randomUUID(),
                  timestamp: Date.now(),
                  name: "Auto-save",
                  project: cloneProject(nextProject)
                };
                checkpoints = [newCheckpoint, ...checkpoints].slice(0, 20);
             }
          }
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
            checkpoints
          }
        }),
      setIsPlaying: (value) => set({ isPlaying: value }),
      setMetronomeEnabled: (value) => set({ metronomeEnabled: value }),
      setPerformanceMode: (value) => set({ performanceMode: value }),
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
      resetProject: () =>
        set((state) => ({
          ...getDefaultPersistedState(),
          projectTemplates: state.projectTemplates,
          galleryProjects: state.galleryProjects,
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
        loopEnabled: state.loopEnabled,
        loopLengthBeats: state.loopLengthBeats,
        metronomeEnabled: state.metronomeEnabled,
        checkpoints: state.checkpoints || [],
        performanceMode: state.performanceMode,
        projectTemplates: state.projectTemplates || [],
        galleryProjects: state.galleryProjects || [],
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
