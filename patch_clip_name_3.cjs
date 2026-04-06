const fs = require('fs');
const path = './src/App.tsx';

let code = fs.readFileSync(path, 'utf8');

if (!code.includes("interface Clip {\n  name?: string")) {
  code = code.replace(/interface Clip \{\n/, "interface Clip {\n  name?: string\n");
}

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

  const setClipGain`;
if (!code.includes("const setClipName = ")) {
  code = code.replace(/  const setClipGain/, setClipNameSnippet);
}

const oldClipLabel = `<span className="clip-label">
                    {clip.wave} {Math.round(clip.noteHz)}Hz · {clip.lengthBeats} beat
                    {clip.lengthBeats > 1 ? 's' : ''}
                  </span>`;
const newClipLabel = `<span className="clip-label">
                    {clip.name ? clip.name : \`\${clip.wave} \${Math.round(clip.noteHz)}Hz · \${clip.lengthBeats} beat\${clip.lengthBeats > 1 ? 's' : ''}\`}
                  </span>`;
if (code.includes(oldClipLabel)) {
  code = code.replace(oldClipLabel, newClipLabel);
}

fs.writeFileSync(path, code);
