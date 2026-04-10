import { test, expect } from '@playwright/test'

test.describe('P7 Mood Presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('track-header-track-1').click()
  })

  test('applies Happy preset with expected bpm/scale and generates clips', async ({ page }) => {
    await page.getByTestId('mood-preset-happy-btn').click()

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.bpm).toBe(118)

    const scaleKey = await page.getByTestId('scale-key-select').inputValue()
    const scaleType = await page.getByTestId('scale-type-select').inputValue()
    expect(scaleKey).toBe('G')
    expect(scaleType).toBe('major')

    const clipCount = await page.locator('.clip').count()
    expect(clipCount).toBeGreaterThanOrEqual(12)
  })

  test('switches to Cyber preset and updates transport key params', async ({ page }) => {
    await page.getByTestId('mood-preset-cyber-btn').click()

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.bpm).toBe(128)

    const scaleKey = await page.getByTestId('scale-key-select').inputValue()
    const scaleType = await page.getByTestId('scale-type-select').inputValue()
    expect(scaleKey).toBe('F#')
    expect(scaleType).toBe('minor')
  })
})
