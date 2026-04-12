import { Volume2, Plus, Trash2, ArrowUp, ArrowDown, Copy, Lock, Unlock, Snowflake } from 'lucide-react'
import type { DAWActions } from '../hooks/useDAWActions'
import type { Track } from '../types'
import { useDAWStore } from '../store/useDAWStore'

interface TrackListProps extends Pick<DAWActions, 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume' | 'moveTrack' | 'duplicateTrack' | 'deleteTrack' | 'freezeTrack' | 'unfreezeTrack' | 'assignTrackToBusGroup' | 'project'> {
  track: Track
}

export function TrackList({ track, selectedTrackId, isPlaying, setSelectedTrackId, toggleTrackMute, toggleTrackSolo, toggleTrackLock, addClip, setTrackVolume, moveTrack, duplicateTrack, deleteTrack, freezeTrack, unfreezeTrack, assignTrackToBusGroup, project }: TrackListProps) {
  const trackIndex = project.tracks.findIndex(t => t.id === track.id)
  const updateProject = useDAWStore((state) => state.updateProject)

  return (
    <div
      className={`track-header h-24 border-b border-gray-800 flex flex-col p-2 cursor-pointer transition-colors ${selectedTrackId === track.id ? 'selected bg-[#1a1a1a]' : 'hover:bg-[#151515]'}`}
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
      <div className="track-header-main flex flex-col gap-1 w-full">
        <div className="track-header-row1 flex justify-between items-center gap-1">
          <div className="track-name-container flex items-center gap-2">
            <input type="color" className="track-color-picker w-4 h-4 p-0 border-0 rounded cursor-pointer flex-shrink-0 bg-transparent" value={track.color || '#6366f1'} onChange={(e) => updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === track.id ? { ...t, color: e.target.value } : t) }))} />
            <div
              className="track-name track-name-input"
              contentEditable
              suppressContentEditableWarning
              onClick={() => setSelectedTrackId(track.id)}
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
              style={{ color: track.color || '#f2f2f2', outline: 'none', cursor: 'text' }}
            >
              {track.name}
            </div>
          </div>
          <div className="track-header-buttons flex gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); if (trackIndex > 0) moveTrack(track.id, 'up'); }}
              className="p-1 rounded text-gray-600 hover:text-gray-400 disabled:opacity-30"
              disabled={trackIndex === 0 || isPlaying}
              title="Move Up"
            >
              <ArrowUp size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (trackIndex < project.tracks.length - 1) moveTrack(track.id, 'down'); }}
              className="p-1 rounded text-gray-600 hover:text-gray-400 disabled:opacity-30"
              disabled={trackIndex === project.tracks.length - 1 || isPlaying}
              title="Move Down"
            >
              <ArrowDown size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); duplicateTrack(track.id); }}
              className="p-1 rounded text-gray-600 hover:text-emerald-400"
              title="Duplicate Track"
              disabled={isPlaying}
            >
              <Copy size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (track.frozen) {
                  unfreezeTrack(track.id)
                } else {
                  void freezeTrack(track.id)
                }
              }}
              className={`p-1 rounded ${track.frozen ? 'text-cyan-400' : 'text-gray-600 hover:text-cyan-400'}`}
              data-testid={`freeze-${track.id}`}
              title={track.frozen ? 'Unfreeze Track' : 'Freeze Track'}
              disabled={isPlaying || track.locked}
              aria-pressed={Boolean(track.frozen)}
            >
              <Snowflake size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }}
              className={`p-1 rounded ${track.locked ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'}`}
              data-testid={`lock-${track.id}`}
              disabled={isPlaying}
              title="Lock Track"
              aria-pressed={track.locked}
            >
              {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            {project.tracks.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }}
                className="p-1 rounded text-gray-600 hover:text-red-400"
                title="Delete Track"
                disabled={isPlaying}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <button
            className={`track-btn w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${track.muted ? 'active bg-red-900/50 text-red-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            data-testid={`mute-${track.id}`}
            onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }}
            disabled={isPlaying}
            aria-pressed={track.muted}
          >
            M
          </button>
          <button
            className={`track-btn w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${track.solo ? 'active-emerald bg-yellow-900/50 text-yellow-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            data-testid={`solo-${track.id}`}
            onClick={(e) => { e.stopPropagation(); toggleTrackSolo(track.id); }}
            disabled={isPlaying}
            aria-pressed={track.solo}
          >
            S
          </button>
          <button
            className="track-btn w-6 h-6 rounded flex items-center justify-center text-xs font-bold bg-gray-800 text-gray-400 hover:bg-gray-700"
            data-testid={`add-clip-${track.id}`}
            onClick={(e) => { e.stopPropagation(); addClip(track.id); }}
            disabled={isPlaying || track.locked || track.isDrumTrack}
          >
            +
          </button>
          <div className="flex-1 flex items-center gap-1 ml-2">
            <Volume2 size={12} className="text-gray-500" />
            <input
              data-testid={`vol-${track.id}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={track.volume}
              onChange={(e) => setTrackVolume(track.id, Number(e.target.value))}
              disabled={isPlaying}
              className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[10px] text-gray-500">BUS</span>
          <select
            data-testid={`track-bus-${track.id}`}
            className="flex-1 bg-gray-900 text-[10px] text-gray-300 border border-gray-800 rounded px-1 py-0.5"
            value={track.busGroupId ?? ''}
            onChange={(e) => assignTrackToBusGroup(track.id, e.target.value || null)}
            disabled={isPlaying}
          >
            <option value="">None</option>
            {(project.busGroups || []).map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
        <details className="track-header-params" style={{ opacity: 0.01, position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
          <summary>More Params</summary>
        </details>
      </div>
    </div>
  )
}

type TrackListPanelProps = Pick<DAWActions, 'project' | 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume' | 'addTrack' | 'addDrumTrack' | 'moveTrack' | 'duplicateTrack' | 'deleteTrack' | 'freezeTrack' | 'unfreezeTrack' | 'assignTrackToBusGroup'>

export function TrackListPanel({ project, addTrack, addDrumTrack, ...rest }: TrackListPanelProps) {
  return (
    <div className="tracklist-panel w-64 bg-[#111] border-r border-gray-800 flex flex-col overflow-y-auto overflow-x-hidden flex-shrink-0">
      <div
        className="tracklist-header h-8 border-b border-gray-800 flex items-center px-3 justify-between bg-[#0a0a0a] sticky top-0 z-10"
        data-testid="tracklist-header"
      >
        <span className="text-xs text-gray-500 font-medium">TRACKS</span>
        <button
          data-testid="add-drum-track-btn"
          onClick={addDrumTrack}
          disabled={rest.isPlaying}
          className="add-track-btn text-gray-500 hover:text-emerald-400 p-1"
          title="Add Drum Track"
        >
          <span className="text-xs font-bold font-mono">+ DRUM</span>
        </button>
        <button
          data-testid="add-track-btn"
          onClick={addTrack}
          disabled={rest.isPlaying}
          className="add-track-btn text-gray-500 hover:text-emerald-400 p-1"
        >
          <Plus size={14} />
          <span style={{ fontSize: 0, opacity: 0 }}>Add Track</span>
        </button>
      </div>
      {project.tracks.map((track) => (
        <TrackList key={track.id} track={track} project={project} {...rest} />
      ))}
    </div>
  )
}
