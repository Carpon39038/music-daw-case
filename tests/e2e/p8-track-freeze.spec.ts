import { test, expect } from '@playwright/test'

test.describe('P8 Track Freeze', () => {
  test('freezes and unfreezes track while preserving source clips', async ({ page }) => {
    await page.goto('/')

    const firstTrackHeader = page.locator('[data-testid="track-header-track-1"]')
    await expect(firstTrackHeader).toBeVisible()

    await firstTrackHeader.click()
    await page.locator('[data-testid="add-clip-track-1"]').click()

    const freezeBtn = page.locator('[data-testid="freeze-track-1"]')
    await expect(freezeBtn).toBeVisible()

    await freezeBtn.click()

    await expect(freezeBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 })
    await expect(page.locator('.clip-label', { hasText: '(Frozen)' }).first()).toBeVisible()

    await freezeBtn.click()

    await expect(freezeBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.clip-label', { hasText: '(Frozen)' })).toHaveCount(0)
  })
})
