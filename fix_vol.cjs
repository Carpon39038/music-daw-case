const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<label>\s*Vol\s*<input\s*data-testid="master-volume"[\s\S]*?<\/label>/, 
`<label>
  Vol
  <input data-testid="master-volume" type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => setMasterVolume(Number(e.target.value))} style={{ width: '80px' }} />
  <span className="master-volume-value">{(masterVolume * 100).toFixed(0)}%</span>
</label>`);

fs.writeFileSync('src/App.tsx', code);
