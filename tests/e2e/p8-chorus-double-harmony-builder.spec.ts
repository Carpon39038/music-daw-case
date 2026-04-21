import { test, expect } from '@playwright/test'

test.describe('P8 Chorus Double & Harmony Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="inspector-panel"]')
    await page.click('[data-testid^="track-header-track-"]')
    await page.click('[data-testid="arrangement-16-bars-btn"]')
    await expect(page.locator('[data-testid^="timeline-marker-"]')).toHaveCount(4)
  })

  test('creates two derived tracks for selected chorus marker and selected source track', async ({ page }) => {
    await page.getByTestId('add-track-btn').click()

    const sourceTrack = page.locator('[data-testid="track-header-track-1"]')
    await sourceTrack.click()

    await page.getByTestId('add-clip-track-1').click()
    await page.getByTestId('add-clip-track-1').click()

    const firstClip = page.locator('[data-testid^="clip-track-1-"]').first()
    await firstClip.click()
    await page.getByTestId('selected-clip-length-input').fill('8')

    const trackCountBeforeApply = await page.locator('[data-testid^="track-header-"]').count()

    const inspector = page.getByTestId('inspector-chorus-double-harmony-builder')
    await expect(inspector).toBeVisible()

    await expect(page.getByTestId('chorus-double-harmony-source-track')).toContainText('Track')

    await page.getByTestId('chorus-double-harmony-toggle-high-octave').check()
    await page.getByTestId('chorus-double-harmony-apply-btn').click()

    await expect(page.getByTestId('chorus-double-harmony-apply-btn')).toBeEnabled()
    await expect.poll(async () => await page.locator('[data-testid^="track-header-"]').count()).toBe(trackCountBeforeApply + 2)

    const newTrackNames = await page.locator('[data-testid^="track-header-"] .track-name').allTextContents()
    const hasDouble = newTrackNames.some((name) => /double/i.test(name))
    const hasHarmony = newTrackNames.some((name) => /harmony/i.test(name))
    expect(hasDouble).toBeTruthy()
    expect(hasHarmony).toBeTruthy()
  })
})
