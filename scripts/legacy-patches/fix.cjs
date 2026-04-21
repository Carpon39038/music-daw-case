const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(`document.querySelector('[data-testid="midi-import-input"]')?.click()`, `document.querySelector<HTMLInputElement>('[data-testid="midi-import-input"]')?.click()`);
code = code.replaceAll(`setMasterEQ((prev) =>`, `setMasterEQ((prev: { low: number; mid: number; high: number }) =>`);

fs.writeFileSync('src/App.tsx', code);
