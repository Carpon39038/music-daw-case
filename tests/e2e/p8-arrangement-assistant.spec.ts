import { test, expect } from '@playwright/test'

test.describe('p8 arrangement assistant', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="inspector-panel"]')
    await page.click('[data-testid^="track-header-track-"]')
  })

  test('generates 8-bar arrangement with section markers and supports undo + persistence', async ({ page }) => {
    await page.click('[data-testid="arrangement-8-bars-btn"]')

    const markerLabels = page.locator('[data-testid^="timeline-marker-"] span')
    await expect(markerLabels).toHaveCount(4)
    await expect(markerLabels.nth(0)).toContainText('Intro')
    await expect(markerLabels.nth(1)).toContainText('Verse')
    await expect(markerLabels.nth(2)).toContainText('Chorus')
    await expect(markerLabels.nth(3)).toContainText('Drop')

    const clipCountAfterArrange = await page.locator('[data-testid^="clip-track-"]').count()
    expect(clipCountAfterArrange).toBeGreaterThanOrEqual(4)

    await page.click('[data-testid="undo-btn"]')
    await expect(page.locator('[data-testid^="timeline-marker-"]')).toHaveCount(0)

    await page.click('[data-testid="arrangement-8-bars-btn"]')
    await page.reload()

    await expect(page.locator('[data-testid^="timeline-marker-"]')).toHaveCount(4)
    await expect(page.locator('[data-testid^="timeline-marker-"] span').nth(0)).toContainText('Intro')
  })
})
