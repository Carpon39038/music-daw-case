import { test, expect } from '@playwright/test'

test.describe('Track Reverb e2e', () => {
  test('should toggle reverb and adjust mix and decay parameters', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    await page.waitForSelector('.track-header');
    await page.locator('.track-header').first().click();
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // Reverb toggle should be unchecked by default
    const reverbToggle = page.locator('[data-testid^="reverb-enable-"]').first()
    await expect(reverbToggle).not.toBeChecked()

    // Enable reverb
    await reverbToggle.check()
    await expect(reverbToggle).toBeChecked()

    // Adjust reverb mix
    const mixSlider = page.locator('[data-testid^="reverb-mix-"]').first()
    await expect(mixSlider).toBeVisible()
    await mixSlider.fill('0.6')
    await mixSlider.dispatchEvent('change')
    await expect(mixSlider).toHaveValue('0.6')

    // Adjust reverb decay
    const decaySlider = page.locator('[data-testid^="reverb-decay-"]').first()
    await expect(decaySlider).toBeVisible()
    await decaySlider.fill('3.5')
    await decaySlider.dispatchEvent('change')
    await expect(decaySlider).toHaveValue('3.5')

    // Verify persistence on reload
    await page.reload()
    await page.waitForSelector('.track-header');
    await page.locator('.track-header').first().click();
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    const newToggle = page.locator('[data-testid^="reverb-enable-"]').first()
    await expect(newToggle).toBeChecked()

    const newMix = page.locator('[data-testid^="reverb-mix-"]').first()
    await expect(newMix).toHaveValue('0.6')

    const newDecay = page.locator('[data-testid^="reverb-decay-"]').first()
    await expect(newDecay).toHaveValue('3.5')
  })

  test('should expose reverb state via debug interface', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    await page.waitForSelector('.track-header');
    await page.locator('.track-header').first().click();
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // Initially no tracks have reverb enabled
    const initialCount = await page.evaluate(() => window.__DAW_DEBUG__?.reverbEnabledTrackCount)
    expect(initialCount).toBe(0)

    // Enable reverb on first track
    const reverbToggle = page.locator('[data-testid^="reverb-enable-"]').first()
    await reverbToggle.check()

    const afterCount = await page.evaluate(() => window.__DAW_DEBUG__?.reverbEnabledTrackCount)
    expect(afterCount).toBe(1)

    // Verify default mix and decay values are exposed
    const mix = await page.evaluate(() => window.__DAW_DEBUG__?.firstTrackReverbMix)
    const decay = await page.evaluate(() => window.__DAW_DEBUG__?.firstTrackReverbDecay)
    expect(mix).toBe(0.3)
    expect(decay).toBe(2)
  })
})
