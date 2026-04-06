import { test, expect } from '@playwright/test';

test('track eq3 effect can be enabled and configured', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
    await page.locator('.track-header').first().click();
;
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));

  // Create a new track
  await page.click('data-testid=add-track-btn');
  
  // Find the eq3 checkbox
  const eqEnable = page.locator('data-testid=eq-enable-track-1');
  await expect(eqEnable).not.toBeChecked();

  // Enable eq
  await eqEnable.check();
  await expect(eqEnable).toBeChecked();

  // Change low, mid, high
  const lowSlider = page.locator('data-testid=eq-low-track-1');
  await lowSlider.fill('5');
  await expect(lowSlider).toHaveValue('5');

  const midSlider = page.locator('data-testid=eq-mid-track-1');
  await midSlider.fill('-5');
  await expect(midSlider).toHaveValue('-5');

  const highSlider = page.locator('data-testid=eq-high-track-1');
  await highSlider.fill('10');
  await expect(highSlider).toHaveValue('10');
});
