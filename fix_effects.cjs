const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const blockStartStr = '<details className="inspector-group" data-testid="inspector-track-effects">';
const blockEndStr = '            </details>\n            <div className="inspector-row" style={{ marginTop: \'12px\'';
const startIndex = app.indexOf(blockStartStr);
const endIndex = app.indexOf(blockEndStr);

let block = app.substring(startIndex, endIndex + 22);

let newBlock = block.replace(
    /<div style=\{\{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' \}\}>([\s\S]*?)<\/div>\s*<label>\s*Filter/,
    `<details open className="inspector-subgroup" style={{ marginBottom: '8px' }}><summary style={{ cursor: 'pointer', color: '#9cb4d8', fontSize: '11px' }}>Basic FX</summary><div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 0' }}>$1</div></details>
    <details className="inspector-subgroup" style={{ marginBottom: '8px' }}><summary style={{ cursor: 'pointer', color: '#9cb4d8', fontSize: '11px' }}>Modulation & Time</summary>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0' }}>`
);

newBlock = newBlock.replace(
    /<div className="track-effects-details" >\s*<div className="track-compressor-controls"/,
    `</div></details>
    <details className="inspector-subgroup" style={{ marginBottom: '8px' }}><summary style={{ cursor: 'pointer', color: '#9cb4d8', fontSize: '11px' }}>Dynamics & EQ</summary>
    <div className="track-effects-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0' }}>
    <div className="track-compressor-controls"`
);

newBlock = newBlock.replace(
    /<\/label>\s*<\/div>\s*\);/g,
    `</div></details>\n              </div>\n              \n                );`
);

fs.writeFileSync('src/App.tsx', app.replace(block, newBlock));
