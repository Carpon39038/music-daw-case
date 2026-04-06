const fs = require('fs');

let content = fs.readFileSync('src/App.css', 'utf8');

const additionalCss = `

/* Detail panel styling for Track Effects */
.track-effects-details {
  border: 1px solid #4a5568;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.2s ease;
}

.track-effects-details summary {
  padding: 6px 8px;
  background: #2d3748;
  user-select: none;
  outline: none;
}

.track-effects-details summary:hover {
  background: #4a5568;
}

.track-effects-details > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.track-header.selected {
  border: 2px solid #63b3ed;
  box-shadow: 0 0 10px rgba(99, 179, 237, 0.3);
  background: rgba(45, 55, 72, 0.8);
}
`;

if (!content.includes('.track-effects-details {')) {
  fs.writeFileSync('src/App.css', content + additionalCss);
  console.log('App.css patched');
}
