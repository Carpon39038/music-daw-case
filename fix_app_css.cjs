const fs = require('fs');
let css = fs.readFileSync('src/App.css', 'utf8');

css = css.replace(/height: 48px;/g, 'min-height: 48px;');

fs.writeFileSync('src/App.css', css);
