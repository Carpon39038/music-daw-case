const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /lfo\.start\(startTime\);\n\s*activeOscillators\.push\(lfo\);/,
  `lfo.start(clipStart);\n          lfo.stop(clipEnd);`
);

fs.writeFileSync('src/App.tsx', code);
console.log("Chorus LFO fixed");
