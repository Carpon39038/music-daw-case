const fs = require('fs')

const appPath = 'src/App.tsx'
let app = fs.readFileSync(appPath, 'utf8')

app = app.replace(
  'solo: boolean',
  'solo: boolean\n  color?: string'
)

app = app.replace(
  "solo: false,",
  "solo: false,\n            color: '#4a5568',"
)

const setTrackColorSrc = `
  const setTrackColor = (trackId: string, color: string) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, color } : t)),
    }))
  }
`
app = app.replace(
  'const toggleTrackMute = (trackId: string) => {',
  setTrackColorSrc + '\n  const toggleTrackMute = (trackId: string) => {'
)

app = app.replace(
  '<div className="track-name">{track.name}</div>',
  '<div className="track-name" style={{ color: track.color || "#e2e8f0" }}>{track.name}</div>'
)

app = app.replace(
  '<label htmlFor="selected-track-name-input">Name</label>',
  `<label htmlFor="selected-track-name-input">Name</label>`
)

const newInspectorRow = `
            <div className="inspector-row">
              <label htmlFor="selected-track-color-input">Color</label>
              <input
                id="selected-track-color-input"
                data-testid="selected-track-color-input"
                type="color"
                value={project.tracks.find((t) => t.id === selectedTrackId)?.color || '#4a5568'}
                onChange={(e) => setTrackColor(selectedTrackId, e.target.value)}
                disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked}
              />
            </div>
`

app = app.replace(
  'disabled={isPlaying}\n              />\n            </div>',
  `disabled={isPlaying}\n              />\n            </div>\n${newInspectorRow}`
)

fs.writeFileSync(appPath, app)
console.log('App.tsx patched for color correctly')
