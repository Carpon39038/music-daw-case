const fs = require('fs');

const appPath = 'src/App.tsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// Wrap inspector and timeline in <div className="workspace">
appCode = appCode.replace('<section className="inspector"', '<div className="workspace" style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginTop: "16px" }}>\n      <section className="inspector"');
appCode = appCode.replace('</section>\n\n      <section className="timeline">', '</section>\n\n      <section className="timeline" style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>');
// Find the end of timeline to close the workspace div
const timelineEndRegex = /<\/section>\n    <\/div>\n  \);\n}/;
appCode = appCode.replace(timelineEndRegex, '</section>\n      </div>\n    </div>\n  );\n}');

fs.writeFileSync(appPath, appCode);

const cssPath = 'src/App.css';
let cssCode = fs.readFileSync(cssPath, 'utf8');

if (!cssCode.includes('.workspace')) {
    cssCode += `

.workspace {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-top: 16px;
}
`;
}

cssCode = cssCode.replace(/\.inspector \{[\s\S]*?\}/, `.inspector {
  border: 1px solid #2a3f5b;
  border-radius: 10px;
  background: #0f1724;
  padding: 10px 12px;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 0 0 320px;
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}`);

fs.writeFileSync(cssPath, cssCode);
console.log("Layout patched!");
