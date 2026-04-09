const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');
if (!code.includes('isDrumTrack')) {
  code = code.replace(
    'locked: boolean',
    'locked: boolean\n  isDrumTrack?: boolean\n  drumSequence?: {\n    kick: boolean[]\n    snare: boolean[]\n    hihat: boolean[]\n  }'
  );
  fs.writeFileSync('src/types.ts', code);
  console.log('types.ts patched');
}
