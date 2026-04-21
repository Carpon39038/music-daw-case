const fs = require('fs');
const path = require('path');

const e2eDir = path.join(__dirname, 'tests/e2e');
const testFiles = fs.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts')).map(f => path.join(e2eDir, f));

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const target = '.track-header\').first().click();';
  const replacement = '.track-header\').first().click();\n    await page.evaluate(() => document.querySelectorAll(\'details\').forEach((d: any) => d.open = true));';
  
  if (content.includes(target) && !content.includes('document.querySelectorAll(\'details\').forEach((d: any) => d.open = true)')) {
    content = content.replace(target, replacement);
    changed = true;
  }
  
  const target2 = '.track-header\').nth(1).click();';
  const replacement2 = '.track-header\').nth(1).click();\n    await page.evaluate(() => document.querySelectorAll(\'details\').forEach((d: any) => d.open = true));';
  if (content.includes(target2) && !content.includes(replacement2)) {
    content = content.replace(target2, replacement2);
    changed = true;
  }

  // Handle flanger which I modified manually
  if (content.includes('flanger')) {
    content = content.replace(/await page.evaluate\(\(\) => document.querySelectorAll\('details'\).forEach\(\(d: HTMLDetailsElement\) => d.open = true\)\);;\n  await page.evaluate\(\(\) => document.querySelectorAll\('details'\).forEach\(d => d.open = true\)\);\n/g, '');
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
