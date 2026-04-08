import { test, expect } from '@playwright/test'

test.describe('Clip Gain', () => {
  test('should allow setting and persisting clip gain via inspector', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // Wait for the app to load
    await expect(page.locator(".daw-root")).toBeVisible()

    const firstClip = page.locator('.clip').first()
    await firstClip.click(); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true))

    // Inspector should show the clip gain input
    const gainInput = page.getByTestId('selected-clip-gain-input')
    await expect(gainInput).toBeVisible()
    
    // Default gain should be 100
    await expect(gainInput).toHaveValue('100')

    // Change gain to 50
    await gainInput.fill('50')
    await gainInput.press('Enter')

    // Read internal debug state to verify
    const clipGain = await page.evaluate(() => window.__DAW_DEBUG__?.firstTrackFirstClipGain)
    expect(clipGain).toBe(0.5)

    // Verify persistence after reload
    await page.reload()
    await page.locator('.clip').first().click(); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true))
    const gainInputReloaded = page.getByTestId('selected-clip-gain-input')
    await expect(gainInputReloaded).toHaveValue('50')
  })
})
