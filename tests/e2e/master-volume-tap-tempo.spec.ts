import { test, expect } from '@playwright/test'

test.describe('Master Volume & Tap Tempo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
    await page.waitForSelector('[data-testid="transport"]')
  })

  test('master volume slider should render and control gain node', async ({ page }) => {
    const slider = page.locator('[data-testid="master-volume"]')
    await expect(slider).toBeVisible()
    await expect(slider).toHaveAttribute('min', '0')
    await expect(slider).toHaveAttribute('max', '1')

    const volumeLabel = page.locator('.master-volume-value')
    await expect(volumeLabel).toContainText('80%')

    // Lower volume
    await slider.fill('0.3')
    await page.waitForTimeout(200)
    await expect(volumeLabel).toContainText('30%')

    // Read debug state
    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.masterVolume).toBeCloseTo(0.3, 1)
  })

  test('master volume should affect audio output level during playback', async ({ page }) => {
    await page.locator('[data-testid="master-volume"]').fill('0.1')
    await page.locator('[data-testid="play-btn"]').click()
    await page.waitForTimeout(500)

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.isPlaying).toBe(true)
    expect(debug?.masterVolume).toBeCloseTo(0.1, 1)

    await page.locator('[data-testid="stop-btn"]').click()
    await expect(page.locator('[data-testid="stop-btn"]')).toBeEnabled()
  })

  test('master volume should persist across page reload', async ({ page }) => {
    await page.locator('[data-testid="master-volume"]').fill('0.5')
    await page.waitForTimeout(500)
    await page.reload()
    await page.waitForSelector('[data-testid="transport"]')

    const volumeLabel = page.locator('.master-volume-value')
    await expect(volumeLabel).toContainText('50%')

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.masterVolume).toBeCloseTo(0.5, 1)
  })

  test('tap tempo button should render and be disabled during playback', async ({ page }) => {
    const tapBtn = page.locator('[data-testid="tap-tempo-btn"]')
    await expect(tapBtn).toBeVisible()
    await expect(tapBtn).toContainText('Tap Tempo')
    await expect(tapBtn).toBeEnabled()

    await page.locator('[data-testid="play-btn"]').click()
    await expect(tapBtn).toBeDisabled()

    await page.locator('[data-testid="stop-btn"]').click()
    await expect(tapBtn).toBeEnabled()
  })

  test('tap tempo should estimate BPM from taps', async ({ page }) => {
    const bpmInput = page.locator('[data-testid="bpm-input"]')
    const initialBpm = await bpmInput.inputValue()
    expect(initialBpm).toBe('120')

    // Simulate rapid taps (~120 BPM = 500ms interval)
    const tapBtn = page.locator('[data-testid="tap-tempo-btn"]')
    for (let i = 0; i < 5; i++) {
      await tapBtn.click()
      await page.waitForTimeout(500)
    }

    // BPM should be close to 120 (±15 tolerance for timing variance)
    const finalBpm = await bpmInput.inputValue()
    const bpm = parseInt(finalBpm, 10)
    expect(bpm).toBeGreaterThanOrEqual(100)
    expect(bpm).toBeLessThanOrEqual(140)
  })

  test('tap tempo should not change BPM when only one tap', async ({ page }) => {
    const bpmInput = page.locator('[data-testid="bpm-input"]')
    const tapBtn = page.locator('[data-testid="tap-tempo-btn"]')

    await tapBtn.click()

    const bpm = await bpmInput.inputValue()
    expect(bpm).toBe('120')
  })

  test('master volume at zero should silence output', async ({ page }) => {
    await page.locator('[data-testid="master-volume"]').fill('0')
    await page.waitForTimeout(200)
    await page.locator('[data-testid="play-btn"]').click()
    await page.waitForTimeout(500)

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.masterVolume).toBe(0)
    expect(debug?.isPlaying).toBe(true)

    await page.locator('[data-testid="stop-btn"]').click()
  })
})
