import { test, expect } from '@playwright/test'

test.describe('P7 Magic Polish', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true))
    await page.getByTestId('track-header-track-1').click()
  })

  test('applies beginner mix macro to clip gains, track FX and master volume', async ({ page }) => {
    const clips = page.locator('.clip')

    await clips.nth(0).click()
    await page.getByTestId('selected-clip-gain-input').fill('50')

    await clips.nth(1).click()
    await page.getByTestId('selected-clip-gain-input').fill('150')

    await page.getByTestId('track-header-track-1').click()
    await page.getByTestId('magic-polish-btn').click()

    await clips.nth(0).click()
    await expect(page.getByTestId('selected-clip-gain-input')).toHaveValue('90')

    await clips.nth(1).click()
    await expect(page.getByTestId('selected-clip-gain-input')).toHaveValue('90')

    const compressorToggle = page.getByTestId(/compressor-enabled-.+/).first()
    const reverbToggle = page.getByTestId(/reverb-enable-.+/).first()
    await expect(compressorToggle).toBeChecked()
    await expect(reverbToggle).toBeChecked()

    const threshold = await page.getByTestId(/compressor-threshold-.+/).first().inputValue()
    const ratio = await page.getByTestId(/compressor-ratio-.+/).first().inputValue()
    const reverbMix = await page.getByTestId(/reverb-mix-.+/).first().inputValue()
    const reverbDecay = await page.getByTestId(/reverb-decay-.+/).first().inputValue()
    const masterVolume = await page.getByTestId('master-volume').inputValue()

    expect(Number(threshold)).toBe(-20)
    expect(Number(ratio)).toBe(4)
    expect(Number(reverbMix)).toBe(0.2)
    expect(Number(reverbDecay)).toBe(1.8)
    expect(Number(masterVolume)).toBe(0.85)
  })
})
