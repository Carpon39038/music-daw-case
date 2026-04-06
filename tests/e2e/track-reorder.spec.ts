import { expect, test } from '@playwright/test'

test.describe('Track Reordering', () => {
  test('should move track up and down', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // Get track names initially
    const initialNames = await page.locator('.track-name').allInnerTexts()
    expect(initialNames.length).toBeGreaterThanOrEqual(4)
    expect(initialNames[0]).toBe('Track 1')
    expect(initialNames[1]).toBe('Track 2')

    // Select the second track (Track 2)
    const trackHeaders = page.locator('.track-header')
    await trackHeaders.nth(1).click()
    
    // Move Track 2 up
    await page.getByTestId('move-up-btn').click()

    // Verify Track 2 is now first
    const trackNamesAfterUp = await page.locator('.track-name').allInnerTexts()
    expect(trackNamesAfterUp[0]).toBe('Track 2')
    expect(trackNamesAfterUp[1]).toBe('Track 1')

    // Select Track 2 (now at index 0)
    await trackHeaders.nth(0).click()

    // Move Track 2 down
    await page.getByTestId('move-down-btn').click()

    // Verify Track 2 is now second again
    const trackNamesAfterDown = await page.locator('.track-name').allInnerTexts()
    expect(trackNamesAfterDown[0]).toBe('Track 1')
    expect(trackNamesAfterDown[1]).toBe('Track 2')

    // Select Track 1 (at index 0)
    await trackHeaders.nth(0).click()
    await expect(page.getByTestId('move-up-btn')).toBeDisabled()

    // Select last track
    await trackHeaders.nth(trackNamesAfterDown.length - 1).click()
    await expect(page.getByTestId('move-down-btn')).toBeDisabled()
  })
})
