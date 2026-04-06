import { test, expect } from '@playwright/test';

test.describe('Track Chorus Effect', () => {
  test('should toggle track chorus effect', async ({ page }) => {
    await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    await page.click('button:has-text("Add Track")');
    await page.click('text=Track 2');

    // Expand effects
    const effectsHeader = page.locator('.inspector-section h3:has-text("Effects")');
    if (await effectsHeader.count() > 0) {
      await effectsHeader.click();
    }

    const chorusCheckbox = page.getByTestId('chorus-enabled-track-2');
    await expect(chorusCheckbox).not.toBeChecked();
    await chorusCheckbox.check();
    await expect(chorusCheckbox).toBeChecked();
    await chorusCheckbox.uncheck();
    await expect(chorusCheckbox).not.toBeChecked();
  });
});
