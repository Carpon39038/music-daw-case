import './App.css'
import { useDAWActions } from './hooks/useDAWActions'
import { Transport } from './components/Transport'
import { Mixer } from './components/Mixer'
import { Inspector } from './components/Inspector'
import { TimelineSection } from './components/Timeline'
import { TrackListPanel } from './components/TrackList'

function App() {
  const daw = useDAWActions()

  return (
    <div className="daw-root" data-testid="daw-root">
      <h1 className="daw-title">Music DAW Case</h1>
      {/* Top: Transport */}
      <Transport {...daw} />

      {/* Main area: TrackList | Timeline | Inspector */}
      <div className="daw-main">
        <div className="daw-center">
          <div className="daw-tracks">
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
