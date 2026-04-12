import { test, expect } from '@playwright/test'

test.describe('P8 chorus lift builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="inspector-panel"]')
    await page.click('[data-testid^="track-header-track-"]')
    await page.click('[data-testid="arrangement-16-bars-btn"]')
    await expect(page.locator('[data-testid^="timeline-marker-"]')).toHaveCount(4)
  })

  test('applies lift only inside selected chorus marker and supports per-item toggles', async ({ page }) => {
    await expect(page.getByTestId('chorus-lift-marker-select')).toBeVisible()

    const initialClipCount = await page.locator('[data-testid^="clip-track-"]').count()

    await page.getByTestId('chorus-lift-toggle-drumDensity').uncheck()
    await page.getByTestId('chorus-lift-toggle-harmonyThicken').uncheck()
    await page.getByTestId('chorus-lift-toggle-gainLift').check()

    await page.getByTestId('chorus-lift-apply-btn').click()

    const afterGainOnlyClipCount = await page.locator('[data-testid^="clip-track-"]').count()
    expect(afterGainOnlyClipCount).toBe(initialClipCount)

    await page.click('[data-testid="undo-btn"]')

    await page.getByTestId('chorus-lift-toggle-drumDensity').check()
    await page.getByTestId('chorus-lift-toggle-harmonyThicken').check()
    await page.getByTestId('chorus-lift-toggle-gainLift').check()
    await page.getByTestId('chorus-lift-apply-btn').click()

    const afterFullLiftClipCount = await page.locator('[data-testid^="clip-track-"]').count()
    expect(afterFullLiftClipCount).toBeGreaterThan(initialClipCount)

    await page.click('[data-testid="undo-btn"]')
    const afterUndoClipCount = await page.locator('[data-testid^="clip-track-"]').count()
    expect(afterUndoClipCount).toBe(initialClipCount)
  })
})
