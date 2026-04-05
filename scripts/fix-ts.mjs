import fs from 'fs'

const file = '/Users/cc/.openclaw/workspace/music-daw-case/src/App.tsx'
let code = fs.readFileSync(file, 'utf8')

code = code.replace(
  'activeNodesRef.current.push(clickOsc, clickGain)',
  'scheduledNodesRef.current.push({ osc: clickOsc, gain: clickGain })'
)

// Add metronomeEnabled to Telemetry
if (!code.includes('metronomeEnabled: boolean')) {
  code = code.replace(
    /loopRestartCount: number/,
    "loopRestartCount: number\n      metronomeEnabled: boolean"
  )
}

fs.writeFileSync(file, code)
