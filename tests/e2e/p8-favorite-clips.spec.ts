import { test, expect } from '@playwright/test'

test.describe('P8 Favorite Clips', () => {
  test('can save clip to favorites, search, paste, and delete', async ({ page }) => {
    await page.goto('/')

    await page.locator('[data-testid="track-header-track-1"]').click()
    await page.locator('[data-testid="add-clip-track-1"]').click()

    await page.locator('[data-testid^="clip-track-1-"]').last().click()

    const saveBtn = page.locator('[data-testid="favorite-clip-save-btn"]')
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    const list = page.locator('[data-testid="favorite-clip-list"]')
    await expect(list.locator('[data-testid^="favorite-clip-item-"]')).toHaveCount(1)

    const search = page.locator('[data-testid="favorite-clip-search-input"]')
    await search.fill('no-match-keyword')
    await expect(list.locator('[data-testid^="favorite-clip-item-"]')).toHaveCount(0)

    await search.fill('')
    const item = list.locator('[data-testid^="favorite-clip-item-"]').first()
    await expect(item).toBeVisible()

    const track1Clips = page.locator('[data-testid^="clip-track-1-"]')
    const beforePasteCount = await track1Clips.count()
    await item.locator('[data-testid^="favorite-clip-paste-"]').click()
    await expect(track1Clips).toHaveCount(beforePasteCount + 1)

    await item.locator('[data-testid^="favorite-clip-delete-"]').click()
    await expect(list.locator('[data-testid^="favorite-clip-item-"]')).toHaveCount(0)
  })
})
