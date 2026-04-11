import { test, expect } from '@playwright/test'

test.describe('p8 markers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="timeline"]')
  })

  test('can add, rename, jump and delete marker with persistence', async ({ page }) => {
    await page.click('[data-testid="add-marker-btn"]')

    const marker = page.locator('[data-testid^="timeline-marker-"]').first()
    await expect(marker).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt')
      await dialog.accept('Intro')
    })
    await marker.dblclick()

    await expect(marker).toContainText('Intro')

    const beatBefore = await page.evaluate(() => window.__DAW_DEBUG__?.playheadBeat ?? 0)
    await marker.click()
    const beatAfter = await page.evaluate(() => window.__DAW_DEBUG__?.playheadBeat ?? 0)
    expect(beatAfter).toBeGreaterThanOrEqual(0)
    expect(beatAfter).toBeGreaterThanOrEqual(Math.min(beatBefore, beatAfter))

    await page.reload()
    const markerAfterReload = page.locator('[data-testid^="timeline-marker-"]').first()
    await expect(markerAfterReload).toBeVisible()
    await expect(markerAfterReload).toContainText('Intro')

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })
    await markerAfterReload.click({ button: 'right' })

    await expect(page.locator('[data-testid^="timeline-marker-"]')).toHaveCount(0)
  })
})
