const fs = require('fs')

const appPath = 'src/App.tsx'
let app = fs.readFileSync(appPath, 'utf8')

app = app.replace(
  'wave: WaveType',
  'wave: WaveType\n  muted?: boolean'
)

app = app.replace(
  'mutedTrackCount: number',
  'mutedTrackCount: number\n      mutedClipCount: number'
)

app = app.replace(
  'const mutedTrackCount = useMemo(() => project.tracks.filter((t) => t.muted).length, [project.tracks])',
  'const mutedClipCount = useMemo(() => project.tracks.reduce((sum, t) => sum + t.clips.filter((c) => c.muted).length, 0), [project.tracks])\n  const mutedTrackCount = useMemo(() => project.tracks.filter((t) => t.muted).length, [project.tracks])'
)

app = app.replace(
  'mutedTrackCount,',
  'mutedTrackCount,\n      mutedClipCount,'
)

app = app.replace(
  'mutedTrackCount,\n    soloTrackCount,',
  'mutedTrackCount,\n    mutedClipCount,\n    soloTrackCount,'
)

app = app.replace(
  'if (clip.startBeat >= loopBeats) return',
  'if (clip.startBeat >= loopBeats || clip.muted) return'
)

const toggleClipMuteSrc = `
  const toggleClipMute = (trackId: string, clipId: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, muted: !c.muted } : c)),
            }
          : t,
      ),
    }))
  }
`
app = app.replace(
  'const toggleTrackMute = (trackId: string) => {',
  toggleClipMuteSrc + '\n  const toggleTrackMute = (trackId: string) => {'
)

app = app.replace(
  'Duplicate target beat: {selectedClipData.duplicateStartBeat}\n            </div>',
  `Duplicate target beat: {selectedClipData.duplicateStartBeat}\n            </div>\n            <button\n              data-testid="selected-clip-mute-btn"\n              onClick={() => toggleClipMute(selectedClipData.track.id, selectedClipData.clip.id)}\n              disabled={isPlaying || selectedClipData.track.locked}\n              aria-pressed={selectedClipData.clip.muted}\n            >\n              {selectedClipData.clip.muted ? 'Unmute Clip' : 'Mute Clip'}\n            </button>`
)

app = app.replace(
  "className={`clip ${clip.wave} ${clip.id === selectedClipRef?.clipId ? 'selected' : ''} ${track.locked ? 'locked' : ''}`}",
  "className={`clip ${clip.wave} ${clip.id === selectedClipRef?.clipId ? 'selected' : ''} ${track.locked ? 'locked' : ''} ${clip.muted ? 'muted' : ''}`}"
)

fs.writeFileSync(appPath, app)
console.log('App.tsx patched')

const cssPath = 'src/App.css'
let css = fs.readFileSync(cssPath, 'utf8')
css += `
.clip.muted {
  opacity: 0.4;
  background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px);
}
`
fs.writeFileSync(cssPath, css)
console.log('App.css patched')
