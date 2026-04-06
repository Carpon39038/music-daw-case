import { expect, test } from '@playwright/test'

test.describe('Track Distortion e2e', () => {
  test('should toggle distortion and expose via debug state', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
    await page.locator('.track-header').first().click();
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
const initial = await page.evaluate(() => window.__DAW_DEBUG__?.distortionEnabledTrackCount ?? 0)
    
    // Toggle on the first track
    // Wait for at least one track to appear
    await page.waitForSelector('.track-row')
    
    // Actually we can just use the toggle testid
    // It's like data-testid="track-distortion-toggle-track-1"
    const toggle = page.locator('[data-testid^="track-distortion-toggle-"]').first();
    await toggle.check();

    const afterCheck = await page.evaluate(() => window.__DAW_DEBUG__?.distortionEnabledTrackCount ?? 0)
    expect(afterCheck).toBe(initial + 1)
    
    await toggle.uncheck();
    const afterUncheck = await page.evaluate(() => window.__DAW_DEBUG__?.distortionEnabledTrackCount ?? 0)
    expect(afterUncheck).toBe(initial)
  })
})
