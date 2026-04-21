const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

const startTag = '<details className="inspector-group" data-testid="inspector-track-effects">';
const startIdx = app.indexOf(startTag);

let currentIdx = startIdx + startTag.length;
let detailsCount = 1;
while(detailsCount > 0 && currentIdx < app.length) {
    let nextStart = app.indexOf('<details', currentIdx);
    let nextEnd = app.indexOf('</details>', currentIdx);
    if (nextStart !== -1 && nextStart < nextEnd) {
        detailsCount++;
        currentIdx = nextStart + 8;
    } else {
        detailsCount--;
        currentIdx = nextEnd + 10;
    }
}
const endIdx = currentIdx;

let block = app.substring(startIdx, endIdx);

// Fix the <label> Filter bug and introduce layers.
// Since it's huge, let's just do a string replacement on the problematic part.
// But better: we restructure it nicely. Let's find exactly the controls.

// First, we know Pan and Pitch are before the Filter label
// Let's replace the outer structure.
const fixedBlock = block
    .replace('<label>\n                Filter', '')
    .replace('</label>\n              </div>\n              \n                );', '</div>\n                );')
    .replace('<div className="track-effects-details" >', '')

// We will just let them all be inside the main details, but we will add CSS to group them or add nested details.
// Let's try inserting `<details className="fx-group"><summary>Modulation</summary>` 
// Actually, it's safer to just inject standard details:
const replacedBlock = block
    .replace('<label>\n                Filter\n                <div className="track-chorus-controls"', '<div className="track-chorus-controls"')
    .replace('</label>\n              </div>\n              \n                );', '</div>\n                );')

// Let's check how many <div className="track-chorus-controls"> there are
console.log("Replaced:", block !== replacedBlock);

fs.writeFileSync('src/App.tsx', replacedBlock ? app.replace(block, replacedBlock) : app);
