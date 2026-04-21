const fs = require('fs');
const content = fs.readFileSync('src/components/Timeline.tsx', 'utf-8');

let newContent = content.replace(
  '{/* Clips */}',
  `{/* Ghost Clip for Dragging Feedback */}
        {clipDrag?.isDragging && clipDrag.targetTrackId === track.id && (
          <div
            className={\`ghost-clip absolute border border-dashed rounded z-20 pointer-events-none \${clipDrag.targetConflicts ? 'bg-red-500/20 border-red-500' : 'bg-white/20 border-white/50'}\`}
            style={{
              top: 4,
              height: 'calc(100% - 8px)',
              left: \`\${(clipDrag.targetStartBeat / TIMELINE_BEATS) * 100}%\`,
              width: \`\${(clipDrag.lengthBeats / TIMELINE_BEATS) * 100}%\`
            }}
          >
             {/* Snap line indicating start beat */}
             <div className="absolute top-0 bottom-0 left-0 w-px bg-white/70" />
          </div>
        )}

        {/* Clips */}`
);

newContent = newContent.replace(
  'className={`track-grid relative grid grid-cols-16 h-full gap-0 bg-[#151515] overflow-hidden`',
  'className={`track-grid relative grid grid-cols-16 h-full gap-0 ${clipDrag?.isDragging && clipDrag.targetTrackId === track.id ? "bg-white/[0.03]" : "bg-[#151515]"} overflow-hidden`'
);

fs.writeFileSync('src/components/Timeline.tsx', newContent);
console.log("Updated Timeline.tsx");
