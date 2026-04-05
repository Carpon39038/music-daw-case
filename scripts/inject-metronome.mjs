import fs from 'fs'

const file = 'src/App.tsx'
let code = fs.readFileSync(file, 'utf8')

// Add state
if (!code.includes('const [metronomeEnabled, setMetronomeEnabled] = useState(false)')) {
  code = code.replace(
    /const \[isPlaying, setIsPlaying\] = useState\(false\)/,
    "const [isPlaying, setIsPlaying] = useState(false)\n  const [metronomeEnabled, setMetronomeEnabled] = useState(false)"
  )
}

// Add scheduling
const scheduleCode = `
    if (metronomeEnabled) {
      for (let i = 0; i < loopBeats; i++) {
        const beatTime = startAt + i * beatDuration
        const clickOsc = ctx.createOscillator()
        const clickGain = ctx.createGain()

        clickOsc.type = 'square'
        clickOsc.frequency.value = i % 4 === 0 ? 880 : 440

        clickGain.gain.setValueAtTime(0, beatTime)
        clickGain.gain.linearRampToValueAtTime(0.3, beatTime + 0.005)
        clickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.05)

        clickOsc.connect(clickGain)
        clickGain.connect(master)

        clickOsc.start(beatTime)
        clickOsc.stop(beatTime + 0.05)

        activeNodesRef.current.push(clickOsc, clickGain)
      }
    }
`

if (!code.includes('if (metronomeEnabled) {')) {
  code = code.replace(
    /project\.tracks\.forEach\(\(track\) => \{/,
    scheduleCode + "\n    project.tracks.forEach((track) => {"
  )
}

// Add UI button
if (!code.includes('data-testid="metronome-btn"')) {
  code = code.replace(
    /<button data-testid="stop-btn".*?<\/button>/,
    `<button data-testid="stop-btn" onClick={stopPlayback}>Stop</button>\n        <button data-testid="metronome-btn" onClick={() => setMetronomeEnabled(v => !v)} aria-pressed={metronomeEnabled}>{metronomeEnabled ? 'Metronome: ON' : 'Metronome: OFF'}</button>`
  )
}

// Update telemetry metadata
if (!code.includes('metronomeEnabled,')) {
  code = code.replace(
    /loopRestartCount: loopRestartCountRef\.current,/,
    "loopRestartCount: loopRestartCountRef.current,\n      metronomeEnabled,"
  )
  code = code.replace(
    /loopRestartCountRef\.current\s+<\/li>/,
    "loopRestartCountRef.current} </li>\n          <li data-testid=\"meta-metronome\">Metronome: {metronomeEnabled ? 'ON' : 'OFF'}</li>"
  )
}

fs.writeFileSync(file, code)
