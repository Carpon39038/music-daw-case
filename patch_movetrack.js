import fs from 'fs';
const path = './src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

const insertPoint = code.indexOf('  const duplicateTrack = (trackId: string) => {');

const insertCode = `  const moveTrack = (trackId: string, direction: 'up' | 'down') => {
    applyProjectUpdate((prev) => {
      const idx = prev.tracks.findIndex(t => t.id === trackId)
      if (idx === -1) return prev
      if (direction === 'up' && idx === 0) return prev
      if (direction === 'down' && idx === prev.tracks.length - 1) return prev

      const newTracks = [...prev.tracks]
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      const temp = newTracks[idx]
      newTracks[idx] = newTracks[targetIdx]
      newTracks[targetIdx] = temp

      return { ...prev, tracks: newTracks }
    })
  }

`;

code = code.slice(0, insertPoint) + insertCode + code.slice(insertPoint);

const jsxInsertPoint = code.indexOf(`              <button
                data-testid="delete-track-btn"`);

const jsxInsertCode = `              <button
                data-testid="move-up-btn"
                onClick={() => moveTrack(selectedTrackId, 'up')}
                disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === 0}
              >
                Move Up
              </button>
              <button
                data-testid="move-down-btn"
                onClick={() => moveTrack(selectedTrackId, 'down')}
                disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === project.tracks.length - 1}
              >
                Move Down
              </button>
`;

code = code.slice(0, jsxInsertPoint) + jsxInsertCode + code.slice(jsxInsertPoint);

fs.writeFileSync(path, code);
