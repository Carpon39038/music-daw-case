const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/App.tsx');
let code = fs.readFileSync(p, 'utf-8');

code = code.replace(
  /lastNode\.connect\(distortion\)\n          lastNode = distortion/g,
  `trackOutput.connect(distortion)\n          distortion.connect(master)`
);

fs.writeFileSync(p, code);
console.log('Fixed');
