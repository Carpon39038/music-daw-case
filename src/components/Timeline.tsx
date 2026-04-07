import type { DAWActions } from '../hooks/useDAWActions'
import { TIMELINE_BEATS } from '../hooks/useDAWActions'
import type { Track } from '../types'

interface TimelineProps extends Pick<DAWActions, 'selectedClipRef' | 'selectedClipRefs' | 'isPlaying' | 'playheadBeat' | 'effectiveTimelineBeats' | 'timelineRef' | 'setSelectedTrackId' | 'setSelectedClipRef' | 'setSelectedClipRefs' | 'addSelectedClipRef' | 'previewClip' | 'startClipDrag' | 'startClipResize' | 'removeClip' | 'cycleClipWave' | 'duplicateClip' | 'splitClip' | 'loopEnabled' | 'loopLengthBeats' | 'addClipAtBeat'> {
  track: Track
}

function WaveformSVG({ wave, color }: { wave: string; color: string }) {
  let path = ''
  if (wave === 'sine') path = 'M0,50 Q25,0 50,50 T100,50'
  else if (wave === 'square') path = 'M0,25 L50,25 L50,75 L100,75'
  else if (wave === 'sawtooth') path = 'M0,75 L100,25 L100,75'
  else path = 'M0,75 L50,25 L100,75'
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="clip-waveform absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" opacity="0.3" />
    </svg>
  )
}

export function Timeline({
  track,
  selectedClipRef,
  selectedClipRefs,
  isPlaying,
  playheadBeat,
  effectiveTimelineBeats,
  timelineRef,
  setSelectedTrackId,
  setSelectedClipRef,
  setSelectedClipRefs,
  addSelectedClipRef,
  previewClip,
  startClipDrag,
  startClipResize,
  removeClip,
  cycleClipWave,
  duplicateClip,
  splitClip,
  loopEnabled,
  loopLengthBeats,
  addClipAtBeat,
}: TimelineProps) {
  const isSelected = (clipId: string) =>
    (selectedClipRef?.clipId === clipId && selectedClipRef?.trackId === track.id) ||
    selectedClipRefs.some(r => r.clipId === clipId && r.trackId === track.id)

  return (
    <div className="track-timeline-row h-24">
      <div className="track-grid relative grid grid-cols-16 h-full gap-0 bg-[#151515] overflow-hidden" ref={timelineRef}>
        {/* Beat grid lines */}
        {Array.from({ length: TIMELINE_BEATS }).map((_, beat) => (
          <div
            key={beat}
            className={`beat-cell border-r ${beat % 4 === 0 ? 'beat-cell-bar border-gray-700 bg-white/[0.01]' : 'border-gray-800/50'}`}
            onDoubleClick={() => {
              if (isPlaying || track.locked) return
              const clip = track.clips.find(c => beat >= c.startBeat && beat < c.startBeat + c.lengthBeats)
              if (!clip) {
                addClipAtBeat(track.id, beat)
              }
            }}
          />
        ))}

        {/* Loop region overlay */}
        {loopEnabled && (
          <div
            className="loop-region absolute top-0 bottom-0 left-0 bg-emerald-500/10 border-r border-emerald-500/30 pointer-events-none z-5"
            style={{ width: `${(loopLengthBeats / TIMELINE_BEATS) * 100}%` }}
            data-testid="loop-region"
          />
        )}

        {/* Clips */}
        {track.clips.map((clip) => {
          const colorValue = clip.color || track.color || '#6366f1'
          return (
            <button
              key={clip.id}
              data-testid={`clip-${track.id}-${clip.id}`}
              className={`clip ${clip.wave} ${track.locked ? 'locked' : ''} ${clip.muted ? 'muted' : ''} ${isSelected(clip.id) ? 'selected' : ''} absolute rounded border overflow-hidden ${isSelected(clip.id) ? 'border-white ring-1 ring-white/50 z-10' : 'border-black/50'}`}
              style={{
                top: 4,
                height: 'calc(100% - 8px)',
                left: `${(clip.startBeat / TIMELINE_BEATS) * 100}%`,
                width: `${(clip.lengthBeats / TIMELINE_BEATS) * 100}%`,
                backgroundColor: `color-mix(in srgb, ${colorValue} 30%, transparent)`,
                borderLeftColor: colorValue,
                borderLeftWidth: 3,
                opacity: clip.muted ? 0.5 : track.locked ? 0.6 : 1,
              }}
              title={`${clip.wave} ${clip.noteHz.toFixed(2)}Hz @ beat ${clip.startBeat}`}
              onMouseDown={(e) => {
                setSelectedTrackId(track.id)
                if (e.shiftKey) {
                  e.stopPropagation()
                  addSelectedClipRef({ trackId: track.id, clipId: clip.id })
                  return
                }
                setSelectedClipRef({ trackId: track.id, clipId: clip.id })
                setSelectedClipRefs([])
                startClipDrag(e, track.id, clip.id, clip.startBeat, clip.lengthBeats)
              }}
              onClick={(e) => {
                if (e.shiftKey) return
                setSelectedTrackId(track.id)
                setSelectedClipRef({ trackId: track.id, clipId: clip.id })
                setSelectedClipRefs([])
                previewClip(clip, track)
              }}
              onDoubleClick={(e) => {
                if (isPlaying || track.locked) return
                if (e.altKey) { removeClip(track.id, clip.id); return }
                if (e.metaKey || e.ctrlKey) { splitClip(track.id, clip.id); return }
                if (e.shiftKey) { duplicateClip(track.id, clip.id); return }
                cycleClipWave(track.id, clip.id)
              }}
            >
              {/* Clip header with name */}
              <div className="h-5 bg-black/20 px-1 flex items-center text-[10px] text-white/90 truncate relative z-1">
                <span>{clip.name || `${clip.wave} ${Math.round(clip.noteHz)}Hz`}</span>
                {clip.muted && <span className="ml-1 text-red-400">(M)</span>}
              </div>

              {/* Waveform preview */}
              <WaveformSVG wave={clip.wave} color={colorValue} />

              {/* Label (used by tests for clip name) */}
              <span className="clip-label relative min-w-0 overflow-hidden text-ellipsis whitespace-nowrap z-1 text-[10px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)', position: 'absolute', bottom: 2, left: 4 }}>
                {clip.name || `${clip.wave} ${Math.round(clip.noteHz)}Hz`}
              </span>

              {/* Resize handle */}
              {!track.locked && (
                <span
                  className="clip-resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-1"
                  data-testid={`clip-resize-${track.id}-${clip.id}`}
                  onMouseDown={(e) =>
                    startClipResize(e, track.id, clip.id, clip.startBeat, clip.lengthBeats)
                  }
                  role="slider"
                  aria-label={`Resize ${track.name} clip`}
                  aria-valuemin={1}
                  aria-valuemax={TIMELINE_BEATS - clip.startBeat}
                  aria-valuenow={clip.lengthBeats}
                />
              )}
            </button>
          )
        })}

        {/* Playhead */}
        <div
          className="playhead-container absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
          style={{ left: `${(Math.min(playheadBeat, effectiveTimelineBeats) / effectiveTimelineBeats) * 100}%`, transform: 'translateX(-1px)' }}
        >
          <div className="playhead-triangle w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-emerald-500 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 3px #00d992)' }} />
          <div className="playhead-line w-0.5 flex-1 bg-emerald-500" style={{ boxShadow: '0 0 4px #00d992' }} />
        </div>
      </div>
    </div>
  )
}


interface TimelineHeaderProps {
  startPlayheadDrag: (e: React.MouseEvent) => void
}

export function TimelineHeader({ startPlayheadDrag }: TimelineHeaderProps) {
  return (
    <div
      className="timeline-header h-8 bg-[#0a0a0a] border-b border-gray-800 sticky top-0 z-10 cursor-pointer flex"
      data-testid="timeline-header"
      onMouseDown={(e) => {
        if (e.button === 0) startPlayheadDrag(e)
      }}
    >
      {Array.from({ length: TIMELINE_BEATS }).map((_, beat) => (
        <div
          key={beat}
          className={`timeline-header-beat flex-1 flex items-center justify-center text-[10px] font-mono border-r ${beat % 4 === 0 ? 'timeline-header-bar border-gray-700 text-gray-500 font-semibold' : 'border-gray-800/50 text-gray-700'}`}
        >
          {beat % 4 === 0 ? `${beat / 4 + 1}` : ''}
        </div>
      ))}
    </div>
  )
}

type TimelineSectionProps = Pick<DAWActions, 'project' | 'selectedClipRef' | 'selectedClipRefs' | 'selectedTrackId' | 'isPlaying' | 'playheadBeat' | 'effectiveTimelineBeats' | 'timelineRef' | 'setSelectedTrackId' | 'setSelectedClipRef' | 'setSelectedClipRefs' | 'addSelectedClipRef' | 'previewClip' | 'startClipDrag' | 'startClipResize' | 'removeClip' | 'cycleClipWave' | 'duplicateClip' | 'splitClip' | 'loopEnabled' | 'loopLengthBeats' | 'setPlayheadBeat' | 'startPlayheadDrag' | 'addClipAtBeat'>

export function TimelineSection(props: TimelineSectionProps) {
  const { project, ...rest } = props
  return (
    <section className="timeline flex-1 flex flex-col overflow-auto min-w-0 bg-[#151515]" data-testid="timeline">
      <TimelineHeader startPlayheadDrag={props.startPlayheadDrag} />
      {project.tracks.map((track) => (
        <div className="track-row border-b border-gray-800/50" key={track.id} data-testid={`track-row-${track.id}`}>
          <Timeline track={track} {...rest} />
        </div>
      ))}
    </section>
  )
}
