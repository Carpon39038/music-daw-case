import { test, expect } from '@playwright/test'

test.describe('MIDI Import/Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
  })

  test('should render MIDI import and export buttons in transport', async ({ page }) => {
    await expect(page.locator('[data-testid="midi-import-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="midi-export-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="midi-import-input"]')).toBeAttached()
  })

  test('should export project as MIDI file', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="midi-export-btn"]').click(),
    ])
    const path = await download.path()
    expect(path).toBeTruthy()
  })

  test('should disable MIDI controls during playback', async ({ page }) => {
    await page.locator('[data-testid="play-btn"]').click()

    await expect(page.locator('[data-testid="midi-import-btn"]')).toBeDisabled()
    await expect(page.locator('[data-testid="midi-export-btn"]')).toBeDisabled()

    await page.locator('[data-testid="stop-btn"]').click()

    await expect(page.locator('[data-testid="midi-import-btn"]')).toBeEnabled()
    await expect(page.locator('[data-testid="midi-export-btn"]')).toBeEnabled()
  })

  test('should import MIDI file', async ({ page }) => {
    const midiBuffer = Buffer.from([
      0x4D, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
      0x4D, 0x54, 0x72, 0x6B,
      0x00, 0x00, 0x00, 0x0A,
      0x00, 0xC0, 0x00,
      0x00, 0x90, 0x3C, 0x60,
      0x00, 0x80, 0x3C, 0x00,
      0xFF, 0x2F, 0x00,
    ])

    const fileInput = await page.locator('[data-testid="midi-import-input"]')
    await fileInput.setInputFiles({
      name: 'test.mid',
      mimeType: 'audio/midi',
      buffer: midiBuffer,
    })

    // App should still be functional after import
    await expect(page.locator('.daw-root')).toBeVisible()
    const tracks = await page.locator('[data-testid^="track-header-"]').count()
    expect(tracks).toBe(4)
  })

  test('should maintain track structure after MIDI import', async ({ page }) => {
    const trackHeaders = page.locator('[data-testid^="track-header-"]')
    const trackCount = await trackHeaders.count()
    expect(trackCount).toBe(4)

    const midiBuffer = Buffer.from([
      0x4D, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
      0x4D, 0x54, 0x72, 0x6B,
      0x00, 0x00, 0x00, 0x0A,
      0x00, 0xC0, 0x00,
      0x00, 0x90, 0x3C, 0x60,
      0x00, 0x80, 0x3C, 0x00,
      0xFF, 0x2F, 0x00,
    ])

    const fileInput = await page.locator('[data-testid="midi-import-input"]')
    await fileInput.setInputFiles({
      name: 'test.mid',
      mimeType: 'audio/midi',
      buffer: midiBuffer,
    })

    const trackNames = []
    for (let i = 0; i < trackCount; i++) {
      const trackName = await trackHeaders.nth(i).locator('.track-name').textContent()
      trackNames.push(trackName)
    }
    expect(trackNames).toEqual(['Track 1', 'Track 2', 'Track 3', 'Track 4'])
  })
})
