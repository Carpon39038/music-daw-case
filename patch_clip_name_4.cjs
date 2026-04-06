const fs = require('fs');
const path = './src/App.tsx';

let code = fs.readFileSync(path, 'utf8');

const setClipNameSnippet = `  const setClipName = (trackId: string, clipId: string, name: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, name } : c)),
            }
          : t,
      ),
    }))
  }

  const updateClipGain`;
if (!code.includes("const setClipName = ")) {
  code = code.replace(/  const updateClipGain/, setClipNameSnippet);
}

fs.writeFileSync(path, code);
