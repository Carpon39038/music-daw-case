const fs = require('fs');
const file1 = 'tests/e2e/track-filter.spec.ts';
let content1 = fs.readFileSync(file1, 'utf8');
content1 = content1.replace(
  "await page.locator('.track-header').first().click();\n// Change track 1 to lowpass",
  "await page.locator('.track-header').first().click();\n    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));\n// Change track 1 to lowpass"
);
fs.writeFileSync(file1, content1);

const file2 = 'tests/e2e/track-reverb.spec.ts';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace(
  "await page.locator('.track-header').first().click();\n\n    // Initially no tracks have reverb enabled",
  "await page.locator('.track-header').first().click();\n    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));\n\n    // Initially no tracks have reverb enabled"
);
fs.writeFileSync(file2, content2);

console.log('Fixed');
