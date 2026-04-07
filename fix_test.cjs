const fs = require('fs');
const path = require('path');

const e2eDir = path.join(__dirname, 'tests/e2e');
const testFiles = fs.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts')).map(f => path.join(e2eDir, f));

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const replace = (target, replacement) => {
    if (content.includes(target) && !content.includes(replacement)) {
      content = content.replace(target, replacement);
      changed = true;
    }
  };

  replace(
    'const enableCb = page.locator(\'[data-testid^="flanger-enable-"]\').first();', 
    'const modTimeSummary = page.locator("summary", { hasText: "Modulation & Time" });\n    await modTimeSummary.click();\n    const enableCb = page.locator(\'[data-testid^="flanger-enable-"]\').first();'
  );
  replace(
    'const enableCb = page.locator(\'[data-testid^="tremolo-enable-"]\').first();', 
    'const modTimeSummary = page.locator("summary", { hasText: "Modulation & Time" });\n    await modTimeSummary.click();\n    const enableCb = page.locator(\'[data-testid^="tremolo-enable-"]\').first();'
  );
  replace(
    'const enableCb = page.locator(\'[data-testid^="compressor-enable-"]\').first();', 
    'const dynEqSummary = page.locator("summary", { hasText: "Dynamics & EQ" });\n    await dynEqSummary.click();\n    const enableCb = page.locator(\'[data-testid^="compressor-enable-"]\').first();'
  );
  replace(
    'const enableCb = page.locator(\'[data-testid^="filter-enable-"]\').first();', 
    'const dynEqSummary = page.locator("summary", { hasText: "Dynamics & EQ" });\n    await dynEqSummary.click();\n    const enableCb = page.locator(\'[data-testid^="filter-enable-"]\').first();'
  );
  replace(
    'const enableCb = page.locator(\'[data-testid^="eq3-enable-"]\').first();', 
    'const dynEqSummary = page.locator("summary", { hasText: "Dynamics & EQ" });\n    await dynEqSummary.click();\n    const enableCb = page.locator(\'[data-testid^="eq3-enable-"]\').first();'
  );
  replace(
    'const lengthInput = page.getByTestId(\'selected-clip-length-input\');',
    'const timingFadesSummary = page.locator("summary", { hasText: "Timing & Fades" });\n    await timingFadesSummary.click();\n    const lengthInput = page.getByTestId(\'selected-clip-length-input\');'
  );
  replace(
    'const fadeInInput = page.getByTestId(\'selected-clip-fadein-input\');',
    'const timingFadesSummary = page.locator("summary", { hasText: "Timing & Fades" });\n    await timingFadesSummary.click();\n    const fadeInInput = page.getByTestId(\'selected-clip-fadein-input\');'
  );

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
