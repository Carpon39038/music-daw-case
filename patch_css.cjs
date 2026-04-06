const fs = require('fs');

const file = 'src/App.css';
let code = fs.readFileSync(file, 'utf-8');

// Change .track-header from flex-row to flex-column
code = code.replace(
  /\.track-header {\s*display: flex;\s*align-items: center;\s*gap: 10px;\s*margin-bottom: 8px;\s*border: 1px solid transparent;\s*border-radius: 8px;\s*padding: 6px;\s*}/,
  `.track-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 6px;
}`
);

// add .track-header-main styling
if (!code.includes('.track-header-main')) {
  code += `\n.track-header-main { display: flex; align-items: center; gap: 10px; width: 100%; }\n`;
}

// ensure track-effects-details is 100% width and clean
if (!code.includes('.track-effects-details {')) {
  code += `\n.track-effects-details { width: 100%; }\n`;
}

fs.writeFileSync(file, code);
console.log('Patched App.css');
