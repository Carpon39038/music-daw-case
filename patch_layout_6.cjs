const fs = require('fs');

const appPath = 'src/App.tsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// Replace inspector opening
appCode = appCode.replace('<section className="inspector"', '<div className="workspace" style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginTop: "16px", width: "100%" }}>\n      <section className="inspector"');

// Replace timeline opening
appCode = appCode.replace('<section className="timeline">', '<section className="timeline" style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>');

// Close the workspace after timeline
appCode = appCode.replace('</section>\n\n      <p className="hint">', '</section>\n      </div>\n\n      <p className="hint">');

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
  width: 100%;
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
  flex: 0 0 340px;
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}`);

fs.writeFileSync(cssPath, cssCode);
console.log("Layout patched!");
