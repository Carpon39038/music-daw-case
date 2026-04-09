const fs = require('fs');
let code = fs.readFileSync('src/components/Timeline.tsx', 'utf-8');

// 1. Add toggleDrumStep to interfaces
code = code.replace(
  "interface TimelineProps extends Pick<DAWActions, 'selectedClipRef'",
  "interface TimelineProps extends Pick<DAWActions, 'selectedClipRef' | 'toggleDrumStep'"
);
code = code.replace(
  "type TimelineSectionProps = Pick<DAWActions, 'project'",
  "type TimelineSectionProps = Pick<DAWActions, 'project' | 'toggleDrumStep'"
);

// 2. Destructure toggleDrumStep in Timeline
code = code.replace(
  "  addClipAtBeat,\n  addAudioFileClip,\n}: TimelineProps) {",
  "  addClipAtBeat,\n  addAudioFileClip,\n  toggleDrumStep,\n}: TimelineProps) {"
);

// 3. Add StepSequencer rendering inside Timeline
const stepSeqRender = `
  if (track.isDrumTrack && track.drumSequence) {
    const seq = track.drumSequence;
    const instruments = ['kick', 'snare', 'hihat'] as const;
    return (
      <div className="track-timeline-row h-24 bg-[#111] border-b border-gray-800 flex flex-col justify-between p-1">
        {instruments.map(inst => (
          <div key={inst} className="flex h-[30%] items-center gap-1">
            <div className="w-12 text-[10px] text-gray-500 font-mono uppercase text-right pr-2 select-none">{inst}</div>
            <div className="flex-1 grid grid-cols-16 gap-1 h-full pr-1">
              {Array.from({ length: 16 }).map((_, i) => (
                <button
                  key={i}
                  data-testid={\`drum-step-\${track.id}-\${inst}-\${i}\`}
                  className={\`rounded-sm transition-colors border \${seq[inst][i] ? 'bg-emerald-500 border-emerald-400' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}\`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDrumStep(track.id, inst, i);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
`;
code = code.replace('  return (\n    <div className="track-timeline-row h-24">', stepSeqRender + '    <div className="track-timeline-row h-24">');

fs.writeFileSync('src/components/Timeline.tsx', code);
console.log('patched timeline');
