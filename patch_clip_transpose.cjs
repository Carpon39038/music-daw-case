const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, 'src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

// 1. Add transposeSemitones?: number to Clip interface
content = content.replace(
  "gain?: number\n}",
  "gain?: number\n  transposeSemitones?: number\n}"
);

// 2. Add updateClipTranspose function right before updateClipLengthBeats
const updateTransposeFn = `
  const updateClipTranspose = (trackId: string, clipId: string, transposeSemitones: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, transposeSemitones } : c
          ),
        }
      }),
    }))
  }

  const updateClipLengthBeats = (`;
content = content.replace("  const updateClipLengthBeats = (", updateTransposeFn.substring(1));

// 3. Update playback scheduledFrequencyHz
content = content.replace(
  "const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones)",
  "const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))"
);
content = content.replace(
  "const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones)", // just in case there's a second one
  "const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))"
);

// 4. Update Inspector by injecting new row after Gain
const gainInspector = `
            <div className="inspector-row">
              <label htmlFor="selected-clip-gain">Gain</label>
              <input
                id="selected-clip-gain"
                data-testid="selected-clip-gain-input"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={selectedClipData.clip.gain ?? 1.0}
                onChange={(e) => updateClipGain(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))}
                disabled={isPlaying || selectedClipData.track.locked}
              />
            </div>
`;
const transposeInspector = gainInspector + `
            <div className="inspector-row">
              <label htmlFor="selected-clip-transpose">Transpose (st)</label>
              <input
                id="selected-clip-transpose"
                data-testid="selected-clip-transpose-input"
                type="number"
                min={-24}
                max={24}
                step={1}
                value={selectedClipData.clip.transposeSemitones ?? 0}
                onChange={(e) => updateClipTranspose(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))}
                disabled={isPlaying || selectedClipData.track.locked}
              />
            </div>
`;
content = content.replace(gainInspector.trim(), transposeInspector.trim());

fs.writeFileSync(appPath, content);
