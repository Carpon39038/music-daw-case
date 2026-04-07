import type { DAWActions } from '../hooks/useDAWActions'
import type { Track } from '../types'

interface TrackListProps extends Pick<DAWActions, 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume'> {
  track: Track
}

export function TrackList({ track, selectedTrackId, isPlaying, setSelectedTrackId, toggleTrackMute, toggleTrackSolo, toggleTrackLock, addClip, setTrackVolume }: TrackListProps) {
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
          <div className="track-name" style={{ color: track.color || "var(--color-snow)" }}>{track.name}</div>
          <div className="track-header-buttons">
            <button className={`track-btn ${track.muted ? "active" : ""}`} data-testid={`mute-${track.id}`} onClick={() => toggleTrackMute(track.id)} disabled={isPlaying} aria-pressed={track.muted}>{track.muted ? 'M' : 'M'}</button>
            <button className={`track-btn ${track.solo ? "active-emerald" : ""}`} data-testid={`solo-${track.id}`} onClick={() => toggleTrackSolo(track.id)} disabled={isPlaying} aria-pressed={track.solo}>{track.solo ? 'S' : 'S'}</button>
            <button className={`track-btn ${track.locked ? "active" : ""}`} data-testid={`lock-${track.id}`} onClick={() => toggleTrackLock(track.id)} disabled={isPlaying} aria-pressed={track.locked}>{track.locked ? 'L' : 'L'}</button>
            <button className="track-btn" data-testid={`add-clip-${track.id}`} onClick={() => addClip(track.id)} disabled={isPlaying || track.locked}>+</button>
          </div>
        </div>
        <details className="track-header-params">
          <summary>More Params</summary>
          <label>
            Vol
            <input data-testid={`vol-${track.id}`} type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => setTrackVolume(track.id, Number(e.target.value))} disabled={isPlaying} />
          </label>
        </details>
      </div>
    </div>
  )
}

type TrackListPanelProps = Pick<DAWActions, 'project' | 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume' | 'addTrack'>

export function TrackListPanel({ project, addTrack, ...rest }: TrackListPanelProps) {
  return (
    <div className="tracklist-panel">
      <div className="tracklist-header" data-testid="tracklist-header">Tracks</div>
      {project.tracks.map((track) => (
        <TrackList key={track.id} track={track} {...rest} />
      ))}
      <button
        data-testid="add-track-btn"
        onClick={addTrack}
        disabled={rest.isPlaying}
        className="add-track-btn"
      >
        + Add Track
      </button>
    </div>
  )
}
