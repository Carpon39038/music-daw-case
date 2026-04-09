import type { DAWActions } from '../hooks/useDAWActions'
import { TIMELINE_BEATS } from '../hooks/useDAWActions'
import { useDAWStore } from '../store/useDAWStore'
import type { Track } from '../types'

interface TimelineProps extends Pick<DAWActions, 'selectedClipRef' | 'selectedClipRefs' | 'isPlaying' | 'timelineRef' | 'setSelectedTrackId' | 'setSelectedClipRef' | 'setSelectedClipRefs' | 'addSelectedClipRef' | 'previewClip' | 'startClipDrag' | 'startClipResize' | 'removeClip' | 'cycleClipWave' | 'duplicateClip' | 'splitClip' | 'loopEnabled' | 'loopLengthBeats' | 'addClipAtBeat' | 'addAudioFileClip'> {
  track: Track
}

function WaveformSVG({ wave, color }: { wave: string; color: string }) {
  let path = ''
  if (wave === 'sine') path = 'M0,50 Q17,15 33,50 T67,50 T100,50'
  else if (wave === 'square') path = 'M0,25 L33,25 L33,75 L67,75 L67,25 L100,25'
  else if (wave === 'sawtooth') path = 'M0,75 L33,25 L67,75 L100,25'
  else path = 'M0,75 L33,25 L67,75 L100,25'
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="clip-waveform absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
    </svg>
  )
}


function getWaveSVG(wave: string) {
  switch (wave) {
    case 'sine': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 Q25,0 50,50 T100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'square': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 L0,20 L50,20 L50,80 L100,80 L100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'sawtooth': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,80 L100,20 L100,80" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'triangle': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 L25,20 L75,80 L100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'organ': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 Q10,20 25,50 T50,50 Q60,80 75,50 T100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'brass': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 L20,30 L40,70 L60,20 L80,80 L100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    default: return '';
  }
}

export function Timeline({
  track,
  selectedClipRef,
  selectedClipRefs,
  isPlaying,
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
  addAudioFileClip,
}: TimelineProps) {
  const clipDrag = useDAWStore((s) => s.clipDrag)

  const isSelected = (clipId: string) =>
    (selectedClipRef?.clipId === clipId && selectedClipRef?.trackId === track.id) ||
    selectedClipRefs.some(r => r.clipId === clipId && r.trackId === track.id)

  return (
    <div className="track-timeline-row h-24">
      <div 
        className={`track-grid relative grid grid-cols-16 h-full gap-0 ${clipDrag?.isDragging && clipDrag.targetTrackId === track.id ? "bg-white/[0.04]" : "bg-[#151515]"} overflow-hidden`} 
        ref={timelineRef}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={(e) => {
          if (track.locked) return
          const files = Array.from(e.dataTransfer.files)
          const audioFile = files.find(f => f.type.startsWith('audio/'))
          if (audioFile) {
            e.preventDefault()
            const rect = e.currentTarget.getBoundingClientRect()
            const beatWidthPx = rect.width / TIMELINE_BEATS
            const dropBeat = Math.max(0, Math.min(TIMELINE_BEATS - 1, Math.round((e.clientX - rect.left) / beatWidthPx)))
            addAudioFileClip(track.id, dropBeat, audioFile)
          }
        }}
      >
        {/* Beat grid lines */}
        {Array.from({ length: TIMELINE_BEATS }).map((_, beat) => {
          return (
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
          )
        })}

        {/* Loop region overlay */}
        {loopEnabled && (
          <div
            className="loop-region absolute top-0 bottom-0 left-0 bg-emerald-500/10 border-r border-emerald-500/30 pointer-events-none z-5"
            style={{ width: `${(loopLengthBeats / TIMELINE_BEATS) * 100}%` }}
            data-testid="loop-region"
          />
        )}

        {/* Ghost Clip for Dragging Feedback */}
        {clipDrag?.isDragging && clipDrag.targetTrackId === track.id && (
          <div
            className={`ghost-clip absolute border border-dashed rounded z-20 pointer-events-none ${clipDrag.targetConflicts ? 'bg-red-500/20 border-red-500' : 'bg-white/20 border-white/50'}`}
            style={{
              top: 4,
              height: 'calc(100% - 8px)',
              left: `${(clipDrag.targetStartBeat / TIMELINE_BEATS) * 100}%`,
              width: `${(clipDrag.lengthBeats / TIMELINE_BEATS) * 100}%`
            }}
          >
             {/* Snap line indicating start beat */}
             <div className="absolute top-0 bottom-0 left-0 w-px bg-white/70" />
          </div>
        )}

        {/* Clips */}
        {track.clips.map((clip) => {
          const isDraggingThisClip = clipDrag?.isDragging && clipDrag.trackId === track.id && clipDrag.clipId === clip.id;

          const colorValue = clip.color || track.color || '#6366f1'
          return (
            <button
              key={clip.id}
              data-testid={`clip-${track.id}-${clip.id}`}
              className={`clip ${clip.wave} ${track.locked ? 'locked' : ''} ${clip.muted ? 'muted' : ''} ${isSelected(clip.id) ? 'selected' : ''} absolute rounded border overflow-hidden ${isSelected(clip.id) ? 'border-white ring-1 ring-white/50 z-10' : 'border-black/50'} ${isDraggingThisClip ? 'opacity-30 pointer-events-none' : ''}`}
              style={{
                top: 4,
                height: 'calc(100% - 8px)',
                left: `${(clip.startBeat / TIMELINE_BEATS) * 100}%`,
                width: `${(clip.lengthBeats / TIMELINE_BEATS) * 100}%`,
                backgroundColor: `${clip.color || track.color || '#6366f1'}30`,
                    backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(getWaveSVG(clip.wave))}")`,
                    backgroundSize: '20px 100%',
                    backgroundRepeat: 'repeat-x',
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
        startPlayheadDrag(e)
      }}
    >
      {Array.from({ length: TIMELINE_BEATS }).map((_, beat) => {
        return (
          <div
            key={beat}
            className={`timeline-header-beat flex-1 flex items-center justify-center text-[10px] font-mono border-r ${beat % 4 === 0 ? 'timeline-header-bar border-gray-700 text-gray-500 font-semibold' : 'border-gray-800/50 text-gray-700'}`}
          >
            {beat % 4 === 0 ? `${beat / 4 + 1}` : ''}
          </div>
        )
      })}
    </div>
  )
}

function GlobalPlayheadLine({ effectiveTimelineBeats }: { effectiveTimelineBeats: number }) {
  const playheadBeat = useDAWStore(s => s.playheadBeat)
  return (
    <div
      className="playhead-container absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
      style={{ left: `${(Math.min(playheadBeat, effectiveTimelineBeats) / effectiveTimelineBeats) * 100}%`, transform: 'translateX(-1px)' }}
    >
      <div className="playhead-triangle w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-emerald-500 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 3px #00d992)' }} />
      <div className="playhead-line w-0.5 flex-1 bg-emerald-500" style={{ boxShadow: '0 0 4px #00d992' }} />
    </div>
  )
}

type TimelineSectionProps = Pick<DAWActions, 'project' | 'selectedClipRef' | 'selectedClipRefs' | 'selectedTrackId' | 'isPlaying' | 'effectiveTimelineBeats' | 'timelineRef' | 'setSelectedTrackId' | 'setSelectedClipRef' | 'setSelectedClipRefs' | 'addSelectedClipRef' | 'previewClip' | 'startClipDrag' | 'startClipResize' | 'removeClip' | 'cycleClipWave' | 'duplicateClip' | 'splitClip' | 'loopEnabled' | 'loopLengthBeats' | 'setPlayheadBeat' | 'startPlayheadDrag' | 'addClipAtBeat' | 'addAudioFileClip'>

export function TimelineSection(props: TimelineSectionProps) {
  const { project, effectiveTimelineBeats, ...rest } = props
  return (
    <section className="timeline flex-1 flex flex-col overflow-auto min-w-0 bg-[#151515]" data-testid="timeline">
      <TimelineHeader startPlayheadDrag={props.startPlayheadDrag} />
      <div className="relative flex-1">
        {project.tracks.map((track) => (
          <div className="track-row border-b border-gray-800/50" key={track.id} data-testid={`track-row-${track.id}`}>
            <Timeline track={track} {...rest} />
          </div>
        ))}
        <GlobalPlayheadLine effectiveTimelineBeats={effectiveTimelineBeats} />
      </div>
    </section>
  )
}
