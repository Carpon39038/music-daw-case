import { test, expect } from '@playwright/test'

test.describe('P8 export target presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('/')
  })

  test('switches preset and applies sample rate/bitrate to export path', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    await expect(page.getByTestId('export-target-preset-select')).toHaveValue('general')
    await page.getByTestId('export-target-preset-select').selectOption('music-platform')

    await expect(page.getByTestId('export-target-preset-select')).toHaveValue('music-platform')
    await expect(page.getByTestId('export-target-preset-summary')).toContainText('48000Hz / 256kbps')

    await page.getByTestId('mp3-export-btn').click()

    await expect.poll(async () => {
      const debug = await page.evaluate(() => window.__DAW_DEBUG__)
      return debug?.exportTargetPreset?.key ?? null
    }, { timeout: 20000 }).toBe('music-platform')

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.exportTargetPreset?.key).toBe('music-platform')
    expect(debug?.exportTargetPreset?.sampleRate).toBe(48000)
    expect(debug?.exportTargetPreset?.bitrateKbps).toBe(256)
  })
})
