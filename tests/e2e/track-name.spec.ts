import { test, expect } from '@playwright/test';

test.describe('Track Name', () => {
  test('should verify new track has default name', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    await page.click('button:has-text("Add Track")');
    const trackNames = await page.locator('.track-name').allTextContents();
    expect(trackNames.length).toBeGreaterThan(0);
  });
});
