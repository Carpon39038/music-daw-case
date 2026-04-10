import { test, expect } from '@playwright/test'

test.describe('P7 achievement feedback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('unlocks first chord achievement and shows toast', async ({ page }) => {
    await expect(page.getByTestId('achievement-badge-firstChord')).toContainText('⬜')

    await page.getByTestId('track-header-track-1').click()
    await page.getByTestId('insert-chord-I-V-vi-IV').click()

    await expect(page.getByTestId('achievement-badge-firstChord')).toContainText('🏅')
    await expect(page.getByTestId('achievement-toast')).toContainText('首次用和弦')
  })

  test('unlocks first export achievement after MP3 export', async ({ page }) => {
    await expect(page.getByTestId('achievement-badge-firstExport')).toContainText('⬜')

    await page.getByTestId('mp3-export-btn').click()

    await expect(page.getByTestId('achievement-badge-firstExport')).toContainText('🏅')
  })
})
