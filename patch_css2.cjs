const fs = require('fs');
let css = fs.readFileSync('src/App.css', 'utf-8');

// 1. Highlight selected track header
css = css.replace(
  /\.track-header\.selected \{([^}]*)\}/,
  `.track-header.selected {
  border: 2px solid #63b3ed;
  box-shadow: 0 0 10px rgba(99, 179, 237, 0.4);
  background: rgba(45, 55, 72, 0.95);
  border-left: 4px solid #63b3ed;
}`
);

// 2. Highlight selected clip
if (css.includes('.clip.selected')) {
  css = css.replace(
    /\.clip\.selected \{([^}]*)\}/,
    `.clip.selected {
  border: 2px solid #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8), inset 0 0 4px rgba(255, 255, 255, 0.4);
  z-index: 10;
  filter: brightness(1.2);
}`
  );
} else {
  css += `\n.clip.selected {
  border: 2px solid #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8), inset 0 0 4px rgba(255, 255, 255, 0.4);
  z-index: 10;
  filter: brightness(1.2);
}\n`;
}

// 3. Make the timeline cleaner
css += `
.timeline::-webkit-scrollbar {
  height: 8px;
}
.timeline::-webkit-scrollbar-thumb {
  background: #2d3748;
  border-radius: 4px;
}
.track-header-main {
  padding: 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}
.track-header button {
  transition: all 0.2s ease;
}
.track-header button:hover {
  filter: brightness(1.2);
}
`;

fs.writeFileSync('src/App.css', css);
console.log("CSS patched");
