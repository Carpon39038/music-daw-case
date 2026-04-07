const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

let newApp = app.replace(
    /<div style=\{\{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' \}\}>\s*<label>\s*Pan[\s\S]*?<span className="transpose-value">[\s\S]*?<\/label>\s*<\/div>/,
    match => `<details className="inspector-group" data-testid="inspector-track-basic" open><summary className="inspector-subtitle" style={{cursor: "pointer"}}>Basic & Pitch</summary><div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>` + match.replace(/<div style=\{\{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' \}\}>/, '') + `</div></details>`
);

newApp = newApp.replace(
    /<div className="track-chorus-controls"[\s\S]*?<div className="track-effects-details" >/g,
    match => `<details className="inspector-group" data-testid="inspector-track-modulation"><summary className="inspector-subtitle" style={{cursor: "pointer"}}>Modulation & Time FX</summary>` + match.replace('<div className="track-effects-details" >', '')
);

newApp = newApp.replace(
    /<div className="track-compressor-controls"[\s\S]*?<div className="track-flanger-controls"/g,
    match => `</details><details className="inspector-group" data-testid="inspector-track-dynamics"><summary className="inspector-subtitle" style={{cursor: "pointer"}}>Dynamics & EQ</summary>` + match.replace('<div className="track-flanger-controls"', '') + `<div className="track-flanger-controls"`
);

// We need to carefully move Flanger and Delay and Tremolo into the Modulation details? 
// No, let's just make it simple.

fs.writeFileSync('src/App.tsx', newApp);
console.log('Done');
