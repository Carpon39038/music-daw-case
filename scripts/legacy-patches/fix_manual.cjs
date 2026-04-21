const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// We will just do targeted replaces.
app = app.replace(
  '<label>\n                Filter',
  '</details>\n<details className="inspector-subgroup" style={{ marginBottom: "8px" }}><summary style={{ cursor: "pointer", color: "#9cb4d8", fontSize: "11px" }}>Modulation & Time</summary><div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 0" }}>'
);

app = app.replace(
  '<div style={{ display: \'flex\', gap: \'16px\', alignItems: \'center\', flexWrap: \'wrap\' }}>\n                  <label>\n                Pan',
  '<details open className="inspector-subgroup" style={{ marginBottom: "8px" }}><summary style={{ cursor: "pointer", color: "#9cb4d8", fontSize: "11px" }}>Basic FX</summary><div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", padding: "8px 0" }}>\n                  <label>\n                Pan'
);

app = app.replace(
  '<div className="track-effects-details" >',
  '</div></details>\n<details className="inspector-subgroup" style={{ marginBottom: "8px" }}><summary style={{ cursor: "pointer", color: "#9cb4d8", fontSize: "11px" }}>Dynamics & EQ</summary>\n<div className="track-effects-details" style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 0" }}>'
);

app = app.replace(
  '                )}\n                            </div>\n              </label>\n              </div>\n              \n                );\n              })()}',
  '                )}\n                            </div>\n              </details>\n              </div>\n              \n                );\n              })()}'
);

fs.writeFileSync('src/App.tsx', app);
