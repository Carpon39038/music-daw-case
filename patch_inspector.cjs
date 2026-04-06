const fs = require('fs');

const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
  /<div className="inspector-group" data-testid="inspector-track">/g,
  `<details className="inspector-group" data-testid="inspector-track" open>`
);
code = code.replace(
  /<div className="inspector-subtitle">Track<\/div>/g,
  `<summary className="inspector-subtitle" style={{cursor: 'pointer'}}>Track Settings</summary>`
);

code = code.replace(
  /<div className="inspector-empty" data-testid="inspector-track-empty">/g,
  `</details>\n          <div className="inspector-empty" data-testid="inspector-track-empty">`
);

code = code.replace(
  /<div className="inspector-group" data-testid="inspector-clip">/g,
  `<details className="inspector-group" data-testid="inspector-clip" open>`
);
code = code.replace(
  /<div className="inspector-subtitle">Clip<\/div>/g,
  `<summary className="inspector-subtitle" style={{cursor: 'pointer'}}>Clip Settings</summary>`
);

// We need to find where the clip inspector ends. It ends right before `) : (` for the clip inspector empty state
code = code.replace(
  /<\/div>\n\s*\) : \(\n\s*<div className="inspector-empty" data-testid="inspector-clip-empty">/g,
  `</details>\n          ) : (\n          <div className="inspector-empty" data-testid="inspector-clip-empty">`
);

fs.writeFileSync(file, code);

// Update CSS for details
let css = fs.readFileSync('src/App.css', 'utf-8');
const detailsCss = `
details.inspector-group summary {
  list-style: none;
  outline: none;
  user-select: none;
}
details.inspector-group summary::-webkit-details-marker {
  display: none;
}
details.inspector-group summary::before {
  content: '▶';
  display: inline-block;
  margin-right: 8px;
  font-size: 0.8em;
  transition: transform 0.2s;
}
details.inspector-group[open] summary::before {
  transform: rotate(90deg);
}
`;
if (!css.includes('details.inspector-group')) {
  fs.writeFileSync('src/App.css', css + detailsCss);
}
console.log('Inspector patched');
