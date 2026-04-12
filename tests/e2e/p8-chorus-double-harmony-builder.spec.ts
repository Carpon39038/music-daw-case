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
    const initialTrackCount = await page.locator('[data-testid^="track-header-"]').count()

    await page.getByTestId('add-track-btn').click()

    const sourceTrack = page.locator('[data-testid^="track-header-"]').nth(initialTrackCount)
    await sourceTrack.click()

    const sourceTrackId = ((await sourceTrack.getAttribute('data-testid')) || '').replace('track-header-', '')
    expect(sourceTrackId.length).toBeGreaterThan(0)

    await page.getByTestId(`add-clip-${sourceTrackId}`).click()

    const inspector = page.getByTestId('inspector-chorus-double-harmony-builder')
    await expect(inspector).toBeVisible()

    await expect(page.getByTestId('chorus-double-harmony-source-track')).toContainText('Track')

    await page.getByTestId('chorus-double-harmony-toggle-high-octave').check()
    await page.getByTestId('chorus-double-harmony-apply-btn').click()

    await expect(page.locator('[data-testid^="track-header-"]')).toHaveCount(initialTrackCount + 3)

    const newTrackNames = await page.locator('[data-testid^="track-header-"] .track-name').allTextContents()
    const hasDouble = newTrackNames.some((name) => /double/i.test(name))
    const hasHarmony = newTrackNames.some((name) => /harmony/i.test(name))
    expect(hasDouble).toBeTruthy()
    expect(hasHarmony).toBeTruthy()
  })
})
