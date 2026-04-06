import { test, expect } from '@playwright/test'

test.describe('Clip Transpose', () => {
  test('should allow setting and persisting clip transpose via inspector', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // Select the first clip on track 1
    const clip1 = page.locator('[data-testid^="clip-track-1-"]').first()
    await expect(clip1).toBeVisible()
    await clip1.click()

    const transposeInput = page.locator('[data-testid="selected-clip-transpose-input"]')
    await expect(transposeInput).toBeVisible()
    await expect(transposeInput).toHaveValue('0')

    await transposeInput.fill('12')
    await transposeInput.dispatchEvent('change')
    await expect(transposeInput).toHaveValue('12')

    // Select another clip
    const clip2 = page.locator('[data-testid^="clip-track-2-"]').first()
    await clip2.click()
    
    // Transpose for clip 2 should be 0
    await expect(transposeInput).toHaveValue('0')

    // Re-select clip 1
    await clip1.click()
    await expect(transposeInput).toHaveValue('12')
  })
})
