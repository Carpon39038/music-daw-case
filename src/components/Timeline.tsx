import type { DAWActions } from '../hooks/useDAWActions'
import { TIMELINE_BEATS } from '../hooks/useDAWActions'
import type { Track } from '../types'

interface TimelineProps extends Pick<DAWActions, 'selectedClipRef' | 'selectedClipRefs' | 'isPlaying' | 'playheadBeat' | 'effectiveTimelineBeats' | 'timelineRef' | 'setSelectedTrackId' | 'setSelectedClipRef' | 'setSelectedClipRefs' | 'addSelectedClipRef' | 'previewClip' | 'startClipDrag' | 'startClipResize' | 'removeClip' | 'cycleClipWave' | 'duplicateClip' | 'splitClip' | 'loopEnabled' | 'loopLengthBeats' | 'addClipAtBeat'> {
  track: Track
}

function WaveformSVG({ wave, color }: { wave: string; color: string }) {
  let path = ''
  if (wave === 'sine') path = 'M0,20 Q10,0 20,20 Q30,40 40,20 Q50,0 60,20 Q70,40 80,20 Q90,0 100,20'
  else if (wave === 'square') path = 'M0,5 L0,35 L25,35 L25,5 L50,5 L50,35 L75,35 L75,5 L100,5'
  else if (wave === 'sawtooth') path = 'M0,35 L25,5 L25,35 L50,5 L50,35 L75,5 L75,35 L100,5'
  else path = 'M0,20 L25,5 L50,35 L75,5 L100,20'
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="clip-waveform" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
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
    <div className="track-timeline-row">
      <div className="track-grid" ref={timelineRef}>
        {/* Beat grid lines */}
        {Array.from({ length: TIMELINE_BEATS }).map((_, beat) => (
          <div
            key={beat}
            className={`beat-cell ${beat % 4 === 0 ? 'beat-cell-bar' : ''}`}
            onDoubleClick={() => {
              if (isPlaying || track.locked) return
              // Double-click on empty area to create clip
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
            className="loop-region"
            style={{ width: `${(loopLengthBeats / TIMELINE_BEATS) * 100}%` }}
            data-testid="loop-region"
          />
        )}

        {/* Clips */}
        {track.clips.map((clip) => {
          const colorValue = clip.color || track.color || 'var(--color-emerald)'
          return (
          <button
            key={clip.id}
            data-testid={`clip-${track.id}-${clip.id}`}
            className={`clip ${clip.wave} ${track.locked ? 'locked' : ''} ${clip.muted ? 'muted' : ''} ${isSelected(clip.id) ? 'selected' : ''}`}
            style={{
              left: `${(clip.startBeat / TIMELINE_BEATS) * 100}%`,
              width: `${(clip.lengthBeats / TIMELINE_BEATS) * 100}%`,
              '--track-color': colorValue,
              backgroundColor: `color-mix(in srgb, ${colorValue} 30%, transparent)`
            } as any}
            title={`${clip.wave} ${clip.noteHz.toFixed(2)}Hz @ beat ${clip.startBeat}${track.locked ? '（轨道已锁定）' : '（双击切换波形，Alt+双击删除）'}`}
            onMouseDown={(e) => {
              setSelectedTrackId(track.id)
              if (e.shiftKey) {
                // Shift+click multi-select
                e.stopPropagation()
                addSelectedClipRef({ trackId: track.id, clipId: clip.id })
                return
              }
              setSelectedClipRef({ trackId: track.id, clipId: clip.id })
              setSelectedClipRefs([])
              startClipDrag(e, track.id, clip.id, clip.startBeat, clip.lengthBeats)
            }}
            onClick={(e) => {
              if (e.shiftKey) return // handled in onMouseDown
              setSelectedTrackId(track.id)
              setSelectedClipRef({ trackId: track.id, clipId: clip.id })
              setSelectedClipRefs([])
              previewClip(clip, track)
            }}
            onDoubleClick={(e) => {
              if (isPlaying || track.locked) return
              if (e.altKey) {
                removeClip(track.id, clip.id)
                return
              }
              if (e.metaKey || e.ctrlKey) {
                splitClip(track.id, clip.id)
                return
              }
              if (e.shiftKey) {
                duplicateClip(track.id, clip.id)
                return
              }
              cycleClipWave(track.id, clip.id)
            }}
          >
            <WaveformSVG wave={clip.wave} color={colorValue} />
            <span className="clip-label">
              {clip.name ? clip.name : `${clip.wave} ${Math.round(clip.noteHz)}Hz · ${clip.lengthBeats} beat${clip.lengthBeats > 1 ? 's' : ''}`}
            </span>
            <span
              className="clip-resize-handle"
              data-testid={`clip-resize-${track.id}-${clip.id}`}
              onMouseDown={(e) =>
                startClipResize(e, track.id, clip.id, clip.startBeat, clip.lengthBeats)
              }
              role="slider"
              aria-label={`Resize ${track.name} clip`}
              aria-valuemin={1}
              aria-valuemax={TIMELINE_BEATS - clip.startBeat}
              aria-valueminAsNumber={1}
              aria-valuemaxAsNumber={TIMELINE_BEATS - clip.startBeat}
              aria-valuenow={clip.lengthBeats}
            />
          </button>
        )})}

        {/* Playhead */}
        <div
          className="playhead-container"
          style={{ left: `${(Math.min(playheadBeat, effectiveTimelineBeats) / effectiveTimelineBeats) * 100}%` }}
        >
          <div className="playhead-triangle" />
          <div className="playhead-line" />
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
    <div className="timeline-header" data-testid="timeline-header" onMouseDown={(e) => {
      if (e.button === 0) {
        startPlayheadDrag(e)
      }
    }}>
      {Array.from({ length: TIMELINE_BEATS }).map((_, beat) => (
        <div
          key={beat}
          className={`timeline-header-beat ${beat % 4 === 0 ? 'timeline-header-bar' : ''}`}
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
    <section className="timeline" data-testid="timeline">
      <TimelineHeader startPlayheadDrag={props.startPlayheadDrag} />
      {project.tracks.map((track) => (
        <div className="track-row" key={track.id} data-testid={`track-row-${track.id}`}>
          <Timeline track={track} {...rest} />
        </div>
      ))}
    </section>
  )
}

// formatTime moved to utils/formatTime.ts
