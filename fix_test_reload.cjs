const fs = require('fs');

const file1 = 'tests/e2e/track-delay.spec.ts';
let content1 = fs.readFileSync(file1, 'utf8');
content1 = content1.replace(
  "await page.locator('.track-header').first().click();\n\n    const newDelayToggle",
  "await page.locator('.track-header').first().click();\n    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));\n\n    const newDelayToggle"
);
fs.writeFileSync(file1, content1);

const file2 = 'tests/e2e/track-reverb.spec.ts';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace(
  "await page.locator('.track-header').first().click();\n\n    const newToggle",
  "await page.locator('.track-header').first().click();\n    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));\n\n    const newToggle"
);
fs.writeFileSync(file2, content2);
