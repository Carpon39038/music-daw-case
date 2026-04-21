const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Inject evaluate after clicking clip
      content = content.replace(
        /await firstClip\.click\(\)/g,
        "await firstClip.click(); await page.evaluate(() => document.querySelectorAll('details').forEach((d: any) => d.open = true))"
      );
      
      // Inject evaluate after clicking track
      content = content.replace(
        /await track1\.click\(\)/g,
        "await track1.click(); await page.evaluate(() => document.querySelectorAll('details').forEach((d: any) => d.open = true))"
      );
      
      // Also specifically for reloaded
      content = content.replace(
        /await page\.locator\('\.clip'\)\.first\(\)\.click\(\)/g,
        "await page.locator('.clip').first().click(); await page.evaluate(() => document.querySelectorAll('details').forEach((d: any) => d.open = true))"
      );

      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir('tests/e2e');
