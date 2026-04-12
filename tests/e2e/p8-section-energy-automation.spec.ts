import { test, expect } from '@playwright/test'

test.describe('p8 section energy automation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="inspector-panel"]')
    await page.click('[data-testid^="track-header-track-"]')
  })

  test('applies marker-driven section energy automation and supports reset', async ({ page }) => {
    await page.click('[data-testid="arrangement-8-bars-btn"]')

    await expect(page.locator('[data-testid="inspector-section-energy-automation"]')).toBeVisible()
    await expect(page.locator('[data-testid="section-energy-selection-list"] input[type="checkbox"]')).toHaveCount(4)

    const initialGain = await page.evaluate(() => window.__DAW_DEBUG__?.firstTrackFirstClipGain ?? 1)

    await page.click('[data-testid="section-energy-apply-btn"]')

    await expect.poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.firstTrackFirstClipGain ?? 1)).not.toBe(initialGain)

    await page.click('[data-testid="section-energy-reset-btn"]')

    await expect.poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.firstTrackFirstClipGain ?? 1)).toBe(initialGain)
  })
})
