import './App.css'
import { useDAWActions } from './hooks/useDAWActions'
import { Transport } from './components/Transport'
import { Mixer } from './components/Mixer'
import { Inspector } from './components/Inspector'
import { TimelineSection } from './components/Timeline'
import { TrackListPanel } from './components/TrackList'
import { Onboarding } from './components/Onboarding'


function App() {
  const daw = useDAWActions()

  return (
    <div
      className="daw-root flex flex-col h-screen bg-[#0a0a0a] text-gray-200 font-sans overflow-hidden select-none"
      data-testid="daw-root"
    >
      <h1 className="daw-title sr-only">Music DAW Case</h1>
      <Onboarding />

      {/* Top: Transport */}
      <Transport {...daw} />

      {/* Main area: TrackList | Timeline | Inspector */}
      <div className="daw-main flex flex-1 overflow-hidden">
        <div className="daw-center flex flex-col flex-1 border-r border-gray-800">
          <div className="daw-tracks flex flex-1 overflow-hidden">
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
