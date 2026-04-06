const fs = require('fs');
const path = './src/App.css';
let css = fs.readFileSync(path, 'utf8');

css = css.replace('.transport button,\n.track-header button {\n  background: #24364f;', '.transport button,\n.track-header button {\n  background: #24364f;\n  transition: all 0.2s;');

css += `
.transport button:hover:not(:disabled),
.track-header button:hover:not(:disabled) {
  background: #314a6c;
  border-color: #4b6a97;
}

button[aria-pressed="true"] {
  background: #2a5a3b !important;
  border-color: #3e8a57 !important;
  color: #c4f0d3 !important;
}

.track-header {
  border-left: 4px solid transparent;
}
.track-header.selected {
  border-left-color: #4d78a8;
  background: linear-gradient(90deg, rgba(77, 120, 168, 0.2) 0%, rgba(77, 120, 168, 0.05) 100%);
}

.clip.selected {
  box-shadow: 0 0 0 2px #fff, 0 0 8px rgba(255, 255, 255, 0.6);
  z-index: 10;
}

.inspector {
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  border-color: #3b5578;
}
.inspector-title {
  font-size: 1.1rem;
  color: #fff;
  border-bottom: 1px solid #253850;
  padding-bottom: 6px;
  margin-bottom: 4px;
}
`;

fs.writeFileSync(path, css);
console.log("CSS patched");
