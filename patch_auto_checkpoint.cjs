const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/store/useDAWStore.ts');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `          const saveHistory = options?.saveHistory ?? false
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
          }`,
  `          const saveHistory = options?.saveHistory ?? false
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
          }`
);

// Do it again for updateProject
code = code.replace(
  `          const saveHistory = options?.saveHistory ?? false
          return {
            project: nextProject,
            past: saveHistory ? [...state.past, cloneProject(state.project)].slice(-100) : state.past,
            future: saveHistory ? [] : state.future,
          }`,
  `          const saveHistory = options?.saveHistory ?? false
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
          }`
);

fs.writeFileSync(file, code);
