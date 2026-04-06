import { expect, test } from '@playwright/test'

test.describe('Track Tremolo e2e', () => {
  test('should toggle tremolo and expose via debug state', async ({ page }) => {
    await page.goto('/')

    const initial = await page.evaluate(() => window.__DAW_DEBUG__?.tremoloEnabledTrackCount ?? 0)
    
    // Wait for at least one track to appear
    await page.waitForSelector('.track-row')
    
    // Use the toggle testid
    const toggle = page.locator('[data-testid^="tremolo-enabled-"]').first()
    await toggle.check()

    const afterCheck = await page.evaluate(() => window.__DAW_DEBUG__?.tremoloEnabledTrackCount ?? 0)
    expect(afterCheck).toBe(initial + 1)
    
    await toggle.uncheck()
    const afterUncheck = await page.evaluate(() => window.__DAW_DEBUG__?.tremoloEnabledTrackCount ?? 0)
    expect(afterUncheck).toBe(initial)
  })

  test('should adjust tremolo rate and depth', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.track-row')

    const toggle = page.locator('[data-testid^="tremolo-enabled-"]').first()
    await toggle.check()

    const rateSlider = page.locator('[data-testid^="tremolo-rate-"]').first()
    await rateSlider.fill('10')

    const depthSlider = page.locator('[data-testid^="tremolo-depth-"]').first()
    await depthSlider.fill('0.8')

    const rateVal = await rateSlider.inputValue()
    const depthVal = await depthSlider.inputValue()
    expect(rateVal).toBe('10')
    expect(depthVal).toBe('0.8')
  })
})
