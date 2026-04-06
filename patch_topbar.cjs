const fs = require('fs');

const appPath = 'src/App.tsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// Wrap transport and meter in a div
appCode = appCode.replace('<section className="transport"', '<div className="top-bar" style={{ display: "flex", gap: "24px", alignItems: "flex-start", marginBottom: "16px", padding: "12px", background: "#0f1724", borderRadius: "10px", border: "1px solid #2a3f5b" }}>\n      <section className="transport"');

// meter closing
appCode = appCode.replace('</details>\n      </section>\n\n      <div className="workspace"', '</details>\n      </section>\n      </div>\n\n      <div className="workspace"');

fs.writeFileSync(appPath, appCode);
console.log("Top bar patched!");
