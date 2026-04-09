const fs = require('fs');
let code = fs.readFileSync('src/components/TrackList.tsx', 'utf-8');

code = code.replace(
  "disabled={isPlaying || track.locked}",
  "disabled={isPlaying || track.locked || track.isDrumTrack}"
);

fs.writeFileSync('src/components/TrackList.tsx', code);
console.log('patched');
