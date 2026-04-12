import { test, expect } from '@playwright/test'

test.describe('p8-i arrangement variations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="inspector-panel"]')
    await page.click('[data-testid^="track-header-track-"]')
    await page.click('[data-testid="arrangement-8-bars-btn"]')
  })

  test('generates 3 variations, supports A/B switching, undo and persistence', async ({ page }) => {
    await page.click('[data-testid="arrangement-variation-generate-8-btn"]')

    await expect(page.locator('[data-testid="arrangement-variation-list"] button')).toHaveCount(3)

    const conservativeBtn = page.locator('[data-testid="arrangement-variation-apply-conservative"]')
    const standardBtn = page.locator('[data-testid="arrangement-variation-apply-standard"]')
    const aggressiveBtn = page.locator('[data-testid="arrangement-variation-apply-aggressive"]')

    await expect(conservativeBtn).toContainText('保守')
    await expect(standardBtn).toContainText('标准')
    await expect(aggressiveBtn).toContainText('激进')

    const clipCountBeforeSwitch = await page.locator('[data-testid^="clip-track-"]').count()
    expect(clipCountBeforeSwitch).toBeGreaterThan(0)

    await aggressiveBtn.click()
    const aggressiveMarkers = page.locator('[data-testid^="timeline-marker-"] span')
    await expect(aggressiveMarkers.first()).toContainText('(aggressive)')

    const clipCountAggressive = await page.locator('[data-testid^="clip-track-"]').count()
    expect(clipCountAggressive).toBeGreaterThan(0)

    await standardBtn.click()
    await expect(page.locator('[data-testid^="timeline-marker-"] span').first()).toContainText('(standard)')

    await page.click('[data-testid="undo-btn"]')
    await expect(page.locator('[data-testid^="timeline-marker-"] span').first()).toContainText('(aggressive)')

    await page.reload()
    await page.click('[data-testid^="track-header-track-"]')
    await expect(page.locator('[data-testid="arrangement-variation-list"] button')).toHaveCount(3)
    await expect(page.locator('[data-testid^="timeline-marker-"] span').first()).toContainText('(aggressive)')

    await page.click('[data-testid="arrangement-variation-clear-btn"]')
    await expect(page.locator('[data-testid="arrangement-variation-empty"]')).toBeVisible()
  })
})
