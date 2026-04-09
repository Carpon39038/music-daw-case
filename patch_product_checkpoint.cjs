const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'PRODUCT.md');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "- [ ] **自动保存版本点（Checkpoint）** — 关键操作自动留最近 N 个版本点，支持快速回退",
  "- [x] **自动保存版本点（Checkpoint）** — 关键操作自动留最近 N 个版本点，支持快速回退"
);

fs.writeFileSync(file, code);
