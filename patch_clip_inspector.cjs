const fs = require('fs')
const path = require('path')

const appPath = path.join(__dirname, 'src', 'App.tsx')
let code = fs.readFileSync(appPath, 'utf8')

// 1. Update WaveType
code = code.replace(/type WaveType = 'sine' \| 'square'/, "type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle'")

// 2. Add setSelectedClipWave
const setNoteStr = "const setSelectedClipNote = (trackId: string, clipId: string, noteHz: number) => {"
const setWaveStr = `
  const setSelectedClipWave = (trackId: string, clipId: string, wave: WaveType) => {
    applyProjectUpdate((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId || t.locked) return t
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, wave } : c
          ),
        }
      }),
    }))
  }

  const setSelectedClipNote = (trackId: string, clipId: string, noteHz: number) => {`

code = code.replace(setNoteStr, setWaveStr)

// 3. Add to Inspector UI
const inspectorNoteStr = `<label htmlFor="selected-clip-note">Note (Hz)</label>`
const inspectorWaveAndLengthStr = `
            <div className="inspector-row">
              <label htmlFor="selected-clip-wave">Waveform</label>
              <select
                id="selected-clip-wave"
                data-testid="selected-clip-wave-select"
                value={selectedClipData.clip.wave}
                onChange={(e) => setSelectedClipWave(selectedClipData.track.id, selectedClipData.clip.id, e.target.value as WaveType)}
                disabled={isPlaying || selectedClipData.track.locked}
              >
                <option value="sine">Sine</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="triangle">Triangle</option>
              </select>
            </div>
            <div className="inspector-row">
              <label htmlFor="selected-clip-length">Length (beats)</label>
              <input
                id="selected-clip-length"
                data-testid="selected-clip-length-input"
                type="number"
                min={1}
                max={32}
                step={1}
                value={selectedClipData.clip.lengthBeats}
                onChange={(e) => updateClipLengthBeats(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))}
                disabled={isPlaying || selectedClipData.track.locked}
              />
            </div>
            <label htmlFor="selected-clip-note">Note (Hz)</label>`

code = code.replace(inspectorNoteStr, inspectorWaveAndLengthStr)

fs.writeFileSync(appPath, code)
console.log('Patched App.tsx')
