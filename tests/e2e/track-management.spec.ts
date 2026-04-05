import { test, expect } from '@playwright/test'

test.describe('Track Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure fresh project
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.clear()
    })
    await page.goto('/')
    // Wait for initial render
    await expect(page.locator('.app')).toBeVisible()
  })

  test('can add a new track', async ({ page }) => {
    // Should have 4 default tracks initially
    const trackHeaders = page.locator('.track-header')
    await expect(trackHeaders).toHaveCount(4)

    // Click "Add Track"
    const addTrackBtn = page.getByTestId('add-track-btn')
    await addTrackBtn.click()

    // Should have 5 tracks now
    await expect(trackHeaders).toHaveCount(5)
    
    // The new track should be named "Track 5"
    const newTrackName = trackHeaders.nth(4).locator('.track-name')
    await expect(newTrackName).toHaveText('Track 5')
  })

  test('can delete a track', async ({ page }) => {
    // Should have 4 tracks initially
    const trackHeaders = page.locator('.track-header')
    await expect(trackHeaders).toHaveCount(4)

    // Select the second track
    await trackHeaders.nth(1).click()

    // Inspector should show the track name
    const nameInput = page.getByTestId('selected-track-name-input')
    await expect(nameInput).toHaveValue('Track 2')

    // Click Delete Track
    const deleteBtn = page.getByTestId('delete-track-btn')
    await expect(deleteBtn).toBeEnabled()
    await deleteBtn.click()

    // Should have 3 tracks left
    await expect(trackHeaders).toHaveCount(3)

    // The track named "Track 2" should not be there
    await expect(trackHeaders.locator('.track-name', { hasText: /^Track 2$/ })).toHaveCount(0)
    
    // Selected track is cleared, so inspector track area should show empty state
    await expect(page.getByTestId('inspector-track-empty')).toBeVisible()
  })

  test('cannot delete the last track', async ({ page }) => {
    // Select and delete tracks until 1 is left
    for (let i = 0; i < 3; i++) {
      await page.locator('.track-header').nth(0).click()
      await page.getByTestId('delete-track-btn').click()
    }

    const trackHeaders = page.locator('.track-header')
    await expect(trackHeaders).toHaveCount(1)

    // Select the remaining track
    await trackHeaders.nth(0).click()

    // Delete button should be disabled
    const deleteBtn = page.getByTestId('delete-track-btn')
    await expect(deleteBtn).toBeDisabled()
  })
})
