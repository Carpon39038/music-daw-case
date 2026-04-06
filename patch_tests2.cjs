const fs = require('fs');
const path = require('path');

const e2eDir = 'tests/e2e';
const files = fs.readdirSync(e2eDir).filter(f => f.startsWith('track-') && f.endsWith('.spec.ts'));

for (const file of files) {
  const filePath = path.join(e2eDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('effectsHeader.click()')) {
    // maybe it doesn't have it, let's just insert it before any locator or check
    if (content.includes('page.click(\'text=Track 2\')') && !content.includes('document.querySelectorAll(\'details\').forEach((d: any) => d.open = true)')) {
        content = content.replace(
           /await page\.click\('text=Track 2'\);/g,
           `await page.click('text=Track 2');\n    await page.evaluate(() => document.querySelectorAll('details').forEach((d: any) => d.open = true));`
        );
        fs.writeFileSync(filePath, content);
    }
  }
}
console.log("Patched other tests.");
