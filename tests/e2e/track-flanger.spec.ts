import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    __DAW_DEBUG__?: { [key: string]: unknown };
  }
}

test.describe('Track Flanger', () => {
  test('should allow enabling flanger and setting parameters', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.track-row');

    // Click track header to select it and show in inspector
    await page.locator('.track-header').first().click();

    // Flanger controls should exist in inspector
    const enableCb = page.locator('[data-testid^="flanger-enable-"]').first();
    await expect(enableCb).toBeVisible();

    // Enable flanger
    await enableCb.check();

    // Now speed and depth should be visible
    const speedRange = page.locator('[data-testid^="flanger-speed-"]').first();
    const depthRange = page.locator('[data-testid^="flanger-depth-"]').first();

    await expect(speedRange).toBeVisible();
    await expect(depthRange).toBeVisible();

    // Modify a parameter
    await speedRange.fill('2.5');
    await speedRange.dispatchEvent('change');

    // Just check that the state updated in the UI by evaluating the value
    const speedVal = await speedRange.inputValue();
    expect(speedVal).toBe('2.5');
  });
});
