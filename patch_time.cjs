const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const timeDisplayCode = `{Math.floor((playheadBeat * 60 / bpm) / 60).toString().padStart(2, '0')}:{((playheadBeat * 60 / bpm) % 60).toFixed(2).padStart(5, '0')} | {playheadBeat.toFixed(2)}`;

content = content.replace('{playheadBeat.toFixed(2)}</div>', timeDisplayCode + '</div>');

fs.writeFileSync('src/App.tsx', content);
console.log('Time display patched.');
