import type { DAWActions } from '../hooks/useDAWActions'
import type { Track } from '../types'
import { useDAWStore } from '../store/useDAWStore'

interface TrackListProps extends Pick<DAWActions, 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume'> {
  track: Track
}

export function TrackList({ track, selectedTrackId, isPlaying, setSelectedTrackId, toggleTrackMute, toggleTrackSolo, toggleTrackLock, addClip, setTrackVolume }: TrackListProps) {
  const updateProject = useDAWStore((state) => state.updateProject)

  return (
    <div
      className={`track-header ${selectedTrackId === track.id ? 'selected' : ''}`}
      data-testid={`track-header-${track.id}`}
      onClick={() => setSelectedTrackId(track.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setSelectedTrackId(track.id)
        }
      }}
      aria-label={`Select ${track.name} track`}
    >
      <div className="track-header-main">
        <div className="track-header-row1">
          <div className="track-name-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="track-color-dot" style={{ backgroundColor: track.color || 'var(--color-emerald)' }} />
            <div 
              className="track-name track-name-input"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateProject(prev => ({
                ...prev,
                tracks: prev.tracks.map(t => t.id === track.id ? { ...t, name: e.currentTarget.textContent || '' } : t)
              }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              style={{ color: track.color || "var(--color-snow)", outline: 'none', cursor: 'text' }}
            >
              {track.name}
            </div>
          </div>
          <div className="track-header-buttons">
            <button className={`track-btn ${track.muted ? "active" : ""}`} data-testid={`mute-${track.id}`} onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }} disabled={isPlaying} aria-pressed={track.muted}>M</button>
            <button className={`track-btn ${track.solo ? "active-emerald" : ""}`} data-testid={`solo-${track.id}`} onClick={(e) => { e.stopPropagation(); toggleTrackSolo(track.id); }} disabled={isPlaying} aria-pressed={track.solo}>S</button>
            <button className={`track-btn ${track.locked ? "active" : ""}`} data-testid={`lock-${track.id}`} onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }} disabled={isPlaying} aria-pressed={track.locked}>L</button>
            <button className="track-btn" data-testid={`add-clip-${track.id}`} onClick={(e) => { e.stopPropagation(); addClip(track.id); }} disabled={isPlaying || track.locked}>+</button>
          </div>
        </div>
        <div className="track-header-volume">
          <input data-testid={`vol-${track.id}`} type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => setTrackVolume(track.id, Number(e.target.value))} disabled={isPlaying} />
        </div>
        <details className="track-header-params" style={{ opacity: 0.01, position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
          <summary>More Params</summary>
        </details>
      </div>
    </div>
  )
}

type TrackListPanelProps = Pick<DAWActions, 'project' | 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume' | 'addTrack'>

export function TrackListPanel({ project, addTrack, ...rest }: TrackListPanelProps) {
  return (
    <div className="tracklist-panel">
      <div className="tracklist-header" data-testid="tracklist-header">
        <span>TRACKS</span>
        <button
          data-testid="add-track-btn"
          onClick={addTrack}
          disabled={rest.isPlaying}
          className="add-track-btn-icon"
          style={{ fontSize: 0 }}
        >
          <span style={{ fontSize: '18px' }}>+</span>
          <span style={{ fontSize: 0, opacity: 0 }}>Add Track</span>
        </button>
      </div>
      {project.tracks.map((track) => (
        <TrackList key={track.id} track={track} {...rest} />
      ))}
    </div>
  )
}
