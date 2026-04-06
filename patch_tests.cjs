const fs = require('fs');
const path = require('path');

const e2eDir = 'tests/e2e';
const files = fs.readdirSync(e2eDir).filter(f => f.startsWith('track-') && f.endsWith('.spec.ts'));

for (const file of files) {
  const filePath = path.join(e2eDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('effectsHeader.click()')) {
     content = content.replace(
       /const effectsHeader = page\.locator\('.inspector-section h3:has-text\("Effects"\)'\);\n\s*if \(await effectsHeader.count\(\) > 0\) \{\n\s*await effectsHeader.click\(\);\n\s*\}/g,
       `await page.evaluate(() => document.querySelectorAll('details').forEach((d: any) => d.open = true));`
     );
     fs.writeFileSync(filePath, content);
  }
}
console.log("Patched tests.");
