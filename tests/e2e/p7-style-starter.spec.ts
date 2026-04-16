import { test, expect } from '@playwright/test'

test.describe('P7 Style Starter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTitle('Transport Settings').click()
    await page.getByTestId('track-header-track-1').click()
  })

  test('Lo-Fi style starter generates playable 8-bar draft', async ({ page }) => {
    await page.getByTestId('style-starter-lofi-btn').click()

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.bpm).toBe(82)

    const scaleKey = await page.getByTestId('scale-key-select').inputValue()
    const scaleType = await page.getByTestId('scale-type-select').inputValue()
    expect(scaleKey).toBe('C')
    expect(scaleType).toBe('minor')

    const clipCount = await page.locator('.clip').count()
    expect(clipCount).toBeGreaterThanOrEqual(16)

    const drumStepCount = await page.locator('[data-testid^="drum-step-"]').count()
    expect(drumStepCount).toBeGreaterThan(0)
  })
})
