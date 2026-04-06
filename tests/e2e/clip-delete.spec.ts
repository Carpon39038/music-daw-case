import { test, expect } from '@playwright/test'

test.describe('Clip Delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
    await page.waitForSelector('[data-testid="transport"]')
    // Reset project
    await page.click('[data-testid="reset-project-btn"]')
    await expect(page.locator('[data-testid="reset-project-btn"]')).toBeEnabled()
  })

  test('can delete a clip via button', async ({ page }) => {
    const initialClipCount = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)

    // Select the clip
    await page.click('[data-testid="clip-track-1-clip-1-1"]')

    // Verify button exists and click it
    const deleteBtn = page.locator('[data-testid="selected-clip-delete-btn"]')
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Verify clip count decreased
    const finalClipCount = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(finalClipCount).toBe(initialClipCount - 1)
  })

  test('cannot delete a clip on a locked track', async ({ page }) => {
    // Lock track 1
    await page.click('[data-testid="lock-track-1"]')

    // Select the clip (we might still be able to select it)
    await page.click('[data-testid="clip-track-1-clip-1-1"]')

    // Verify delete button is disabled
    const deleteBtn = page.locator('[data-testid="selected-clip-delete-btn"]')
    await expect(deleteBtn).toBeDisabled()
  })
})
