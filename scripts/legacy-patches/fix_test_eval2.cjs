const fs = require('fs');
const path = require('path');

const e2eDir = path.join(__dirname, 'tests/e2e');
const testFiles = fs.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts')).map(f => path.join(e2eDir, f));

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('await trackHeader.click();') && !content.includes('document.querySelectorAll(\'details\').forEach((d: any) => d.open = true)')) {
    content = content.replace('await trackHeader.click();', 'await trackHeader.click();\n    await page.evaluate(() => document.querySelectorAll(\'details\').forEach((d: any) => d.open = true));');
    changed = true;
  }
  
  if (content.includes('await page.locator(\'.track-header\').first().click()') && !content.includes('first().click();')) {
    content = content.replace(/await page.locator\('\.track-header'\)\.first\(\)\.click\(\)/g, 'await page.locator(\'.track-header\').first().click();\n    await page.evaluate(() => document.querySelectorAll(\'details\').forEach((d: any) => d.open = true));');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
