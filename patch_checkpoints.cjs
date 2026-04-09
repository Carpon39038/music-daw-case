const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/store/useDAWStore.ts');
let code = fs.readFileSync(file, 'utf8');

// 1. Add Checkpoint type
code = code.replace(
  "export interface ClipDragState {",
  `export interface Checkpoint {
  id: string;
  timestamp: number;
  name: string;
  project: ProjectState;
}

export interface ClipDragState {`
);

// 2. Add checkpoints to PersistedDAWState
code = code.replace(
  "  metronomeEnabled: boolean\n}",
  `  metronomeEnabled: boolean
  checkpoints: Checkpoint[]
}`
);

// 3. Add saveCheckpoint and restoreCheckpoint to DAWState
code = code.replace(
  "  resetProject: () => void\n}",
  `  resetProject: () => void
  saveCheckpoint: (name: string) => void
  restoreCheckpoint: (id: string) => void
}`
);

// 4. Update getDefaultPersistedState
code = code.replace(
  "    metronomeEnabled: false,\n  }",
  `    metronomeEnabled: false,
    checkpoints: [],
  }`
);

// 6. Add methods to store
code = code.replace(
  "      resetProject: () =>\n        set({",
  `      saveCheckpoint: (name) =>
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
      resetProject: () =>
        set({`
);

// 7. Update partialize
code = code.replace(
  "        metronomeEnabled: state.metronomeEnabled,\n      }),",
  `        metronomeEnabled: state.metronomeEnabled,
        checkpoints: state.checkpoints || [],
      }),`
);

fs.writeFileSync(file, code);
