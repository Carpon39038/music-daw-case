const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, 'src/App.tsx');
let appTsx = fs.readFileSync(appTsxPath, 'utf8');

// 1. Add fadeIn and fadeOut to Clip interface
appTsx = appTsx.replace(
  /transposeSemitones\?: number\n\s+color\?: string/,
  "transposeSemitones?: number\n  color?: string\n  fadeIn?: number\n  fadeOut?: number"
);

// 2. Add updateClipFades
const updateClipFadesCode = `  const updateClipFades = (trackId: string, clipId: string, fadeIn: number, fadeOut: number) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, fadeIn, fadeOut } : c
          ),
        }
      }),
    }))
  }

  const updateClipTranspose`;

appTsx = appTsx.replace(/const updateClipTranspose/g, updateClipFadesCode);

// 3. Update scheduling logic
appTsx = appTsx.replace(
  /gain\.gain\.setValueAtTime\(0\.0001, clipStart\)\s+const isTrackAudible = !track\.muted && \(!soloActive \|\| track\.solo\)\s+const clipGain = clip\.gain \?\? 1\.0\s+const effectiveTrackVolume = isTrackAudible \? \(track\.volume \* clipGain\) : 0\s+gain\.gain\.linearRampToValueAtTime\(effectiveTrackVolume \* 0\.15, clipStart \+ 0\.01\)\s+gain\.gain\.setValueAtTime\(effectiveTrackVolume \* 0\.15, Math\.max\(clipStart \+ 0\.01, clipEnd - 0\.02\)\)\s+gain\.gain\.linearRampToValueAtTime\(0\.0001, clipEnd\)/g,
  `gain.gain.setValueAtTime(0.0001, clipStart)
        const isTrackAudible = !track.muted && (!soloActive || track.solo)
        const clipGain = clip.gain ?? 1.0
        const effectiveTrackVolume = isTrackAudible ? (track.volume * clipGain) : 0
        
        const fadeInSec = (clip.fadeIn || 0) * beatDuration
        const fadeOutSec = (clip.fadeOut || 0) * beatDuration
        const actualFadeIn = fadeInSec > 0 ? fadeInSec : 0.01;
        const actualFadeOut = fadeOutSec > 0 ? fadeOutSec : 0.02;

        gain.gain.linearRampToValueAtTime(effectiveTrackVolume * 0.15, Math.min(clipStart + actualFadeIn, clipEnd))
        gain.gain.setValueAtTime(effectiveTrackVolume * 0.15, Math.max(clipStart + actualFadeIn, clipEnd - actualFadeOut))
        gain.gain.linearRampToValueAtTime(0.0001, clipEnd)`
);

// 4. Update the inspector UI
const anchor = '<label htmlFor="selected-clip-note">Note (Hz)</label>';
const toInsert = `<div className="inspector-row">
              <label htmlFor="selected-clip-fade-in">Fade In</label>
              <input
                id="selected-clip-fade-in"
                data-testid="selected-clip-fade-in-input"
                type="number"
                min={0}
                max={selectedClipData.clip.lengthBeats / 2}
                step={0.1}
                value={selectedClipData.clip.fadeIn ?? 0}
                onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value), selectedClipData.clip.fadeOut ?? 0)}
                disabled={isPlaying || selectedClipData.track.locked}
              />
            </div>
            <div className="inspector-row">
              <label htmlFor="selected-clip-fade-out">Fade Out</label>
              <input
                id="selected-clip-fade-out"
                data-testid="selected-clip-fade-out-input"
                type="number"
                min={0}
                max={selectedClipData.clip.lengthBeats / 2}
                step={0.1}
                value={selectedClipData.clip.fadeOut ?? 0}
                onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, selectedClipData.clip.fadeIn ?? 0, Number(e.target.value))}
                disabled={isPlaying || selectedClipData.track.locked}
              />
            </div>
            `;

if (!appTsx.includes('data-testid="selected-clip-fade-in-input"')) {
  appTsx = appTsx.replace(anchor, toInsert + anchor);
}

fs.writeFileSync(appTsxPath, appTsx);
console.log('App patched.');
