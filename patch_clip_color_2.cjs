const fs = require('fs');
const path = require('path');
const p = path.join('/Users/cc/.openclaw/workspace/music-daw-case/src/App.tsx');
let code = fs.readFileSync(p, 'utf-8');

// 1. Add color to Clip interface
code = code.replace(
  'transposeSemitones?: number',
  'transposeSemitones?: number\n  color?: string'
);

// 2. Add color to clip inline style
code = code.replace(
  '<div\n                  key={clip.id}\n                  className={`clip ${clip.wave} ${track.locked ? \'locked\' : \'\'} ${clip.muted ? \'muted\' : \'\'} ${selectedClipRef?.clipId === clip.id && selectedClipRef.trackId === track.id ? \'selected\' : \'\'}`}\n                  style={{\n                    left: `${(clip.startBeat / effectiveTimelineBeats) * 100}%`,\n                    width: `${(clip.lengthBeats / effectiveTimelineBeats) * 100}%`,\n                  }}',
  `<div\n                  key={clip.id}\n                  className={\`clip \${clip.wave} \${track.locked ? 'locked' : ''} \${clip.muted ? 'muted' : ''} \${selectedClipRef?.clipId === clip.id && selectedClipRef.trackId === track.id ? 'selected' : ''}\`}\n                  style={{\n                    left: \`\${(clip.startBeat / effectiveTimelineBeats) * 100}%\`,\n                    width: \`\${(clip.lengthBeats / effectiveTimelineBeats) * 100}%\`,\n                    backgroundColor: clip.color,\n                  }}`
);

// 3. Add color picker to Clip Inspector
const clipInspectorSearch = '<label htmlFor="selected-clip-name">Name</label>';
const clipInspectorReplace = `<label htmlFor="selected-clip-color">Color</label>\n              <input\n                id="selected-clip-color"\n                data-testid="selected-clip-color-picker"\n                type="color"\n                value={selectedClipData.clip.color || '#4299e1'}\n                onChange={(e) => setClipColor(selectedClipData.track.id, selectedClipData.clip.id, e.target.value)}\n              />\n            </div>\n            <div className="inspector-row">\n              <label htmlFor="selected-clip-name">Name</label>`;

code = code.replace(clipInspectorSearch, clipInspectorReplace);

// 4. Add setClipColor function
const setClipNameSearch = 'const setClipName = (trackId: string, clipId: string, name: string) => {';
const setClipColorFunc = `const setClipColor = (trackId: string, clipId: string, color: string) => {\n    if (isPlaying) return\n    setProject((prev) => {\n      undoStackRef.current.push(structuredClone(prev))\n      if (undoStackRef.current.length > 100) undoStackRef.current.shift()\n      redoStackRef.current = []\n      return {\n        ...prev,\n        tracks: prev.tracks.map((t) =>\n          t.id === trackId\n            ? {\n                ...t,\n                clips: t.clips.map((c) => (c.id === clipId ? { ...c, color } : c)),\n              }\n            : t,\n        ),\n      }\n    })\n  }\n\n  `;

code = code.replace(setClipNameSearch, setClipColorFunc + setClipNameSearch);

// 5. Expose in data-testid="daw-state"
code = code.replace(
  'selectedClipNoteHz: project.tracks.find((t) => t.id === selectedClipRef?.trackId)?.clips.find((c) => c.id === selectedClipRef?.clipId)?.noteHz ?? null,',
  `selectedClipNoteHz: project.tracks.find((t) => t.id === selectedClipRef?.trackId)?.clips.find((c) => c.id === selectedClipRef?.clipId)?.noteHz ?? null,\n      selectedClipColor: project.tracks.find((t) => t.id === selectedClipRef?.trackId)?.clips.find((c) => c.id === selectedClipRef?.clipId)?.color ?? null,`
);

fs.writeFileSync(p, code);
