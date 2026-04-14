import { test, expect } from '@playwright/test'

test.describe('p8-i project cleanup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="inspector-panel"]')
    await page.click('[data-testid^="track-header-track-"]')
  })

  test('scan, apply cleanup and undo restore in one operation', async ({ page }) => {
    await page.locator('.track-row').first().locator('.beat-cell').nth(4).dblclick()

    const allClips = page.locator('[data-testid^="clip-track-"]')
    const initialClipCount = await allClips.count()
    const clipLocator = allClips.first()
    await expect(clipLocator).toBeVisible()

    await clipLocator.click()
    await page.click('[data-testid="selected-clip-mute-btn"]')

    await expect(page.locator('[data-testid="project-cleanup-panel"]')).toBeVisible()

    await page.click('[data-testid="project-cleanup-scan-btn"]')
    await expect(page.locator('[data-testid="project-cleanup-count"]')).not.toContainText('可清理项 0')

    await page.click('[data-testid="project-cleanup-apply-btn"]')
    await expect(page.locator('[data-testid="project-cleanup-count"]')).toContainText('可清理项 0')
    await expect(allClips).toHaveCount(Math.max(0, initialClipCount - 1))

    await page.click('[data-testid="project-cleanup-undo-btn"]')
    await expect(allClips).toHaveCount(initialClipCount)
  })
})
