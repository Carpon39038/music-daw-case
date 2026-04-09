const fs = require('fs');
let content = fs.readFileSync('src/components/Timeline.tsx', 'utf-8');

content = content.replace(
  'className="track-grid relative grid grid-cols-16 h-full gap-0 bg-[#151515] overflow-hidden"',
  'className={`track-grid relative grid grid-cols-16 h-full gap-0 ${clipDrag?.isDragging && clipDrag.targetTrackId === track.id ? "bg-white/[0.04]" : "bg-[#151515]"} overflow-hidden`}'
);

fs.writeFileSync('src/components/Timeline.tsx', content);
console.log("Updated track-grid class");
