const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/setProject\(\(prev\) => \(\{\n\s*\.\.\.p,\n\s*tracks: p\.tracks\.map\(\(t\)/g, 'setProject((prev) => ({\n                          ...prev,\n                          tracks: prev.tracks.map((t)');

fs.writeFileSync('src/App.tsx', code);
