import './App.css'
import { useDAWActions } from './hooks/useDAWActions'
import { Transport } from './components/Transport'
import { Mixer } from './components/Mixer'
import { Inspector } from './components/Inspector'
import { TimelineSection } from './components/Timeline'
import { TrackListPanel } from './components/TrackList'
import { Onboarding } from './components/Onboarding'
import { ShortcutPanel } from './components/ShortcutPanel'
import { IdleHint } from './components/IdleHint'
import { useEffect } from 'react'
import { useDAWStore } from './store/useDAWStore'
import { decodeSharePayload } from './utils/shareLink'


function App() {
  const daw = useDAWActions()

  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#share=')) {
      const base64Str = hash.slice(7)
      const payload = decodeSharePayload(base64Str)
      if (payload) {
        useDAWStore.setState({
          project: payload.project,
          masterVolume: payload.masterVolume,
          masterEQ: payload.masterEQ,
          masterPreset: payload.masterPreset ?? 'none',
          masterPresetBaseline: null,
          loopEnabled: payload.loopEnabled,
          loopLengthBeats: payload.loopLengthBeats
        })
      }
      // Remove hash to keep URL clean and allow refreshing
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])


  return (
    <div
      className="daw-root flex flex-col h-screen w-full min-w-0 overflow-hidden bg-[#0a0a0a] text-gray-200 font-sans select-none"
      data-testid="daw-root"
    >
      <h1 className="daw-title sr-only">Music DAW Case</h1>
      <Onboarding />
      <ShortcutPanel />
      <IdleHint />

      {/* Top: Transport */}
      <Transport {...daw} />

      {/* Main area: TrackList | Timeline | Inspector */}
      <div className="daw-main flex flex-1 min-w-0 overflow-hidden">
        <div className="daw-center flex min-w-0 flex-col flex-1 border-r border-gray-800">
          <div className="daw-tracks flex min-w-0 flex-1 overflow-hidden">
            <TrackListPanel {...daw} />
            <TimelineSection {...daw} />
          </div>
          {/* Bottom: Mixer */}
          <Mixer {...daw} />
        </div>
        {/* Right: Inspector */}
        <Inspector {...daw} />
      </div>
    </div>
  )
}

export default App
