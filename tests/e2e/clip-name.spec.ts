import { test, expect } from '@playwright/test'

test.describe('Clip Name Feature', () => {
  test('should allow setting and displaying a custom clip name', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // 1. Add a clip on Track 1
    await page.getByTestId('add-clip-track-1').click()

    // 2. Click the newly created clip to select it
    // Wait for at least one clip on track 1
    const clipLocator = page.locator('[data-testid^="clip-track-1-"]').last()
    await expect(clipLocator).toBeVisible()
    await clipLocator.click()

    // 3. Find the Name input in the inspector
    const nameInput = page.locator('[data-testid="selected-clip-name-input"]')
    await expect(nameInput).toBeVisible()

    // 4. Set a custom name
    const customName = 'My Awesome Bass'
    await nameInput.fill(customName)

    // 5. Verify the clip label updates
    const clipLabel = clipLocator.locator('.clip-label')
    await expect(clipLabel).toHaveText(customName)

    // 6. Clear the name and verify it falls back to wave/hz
    await nameInput.fill('')
    await expect(clipLabel).toContainText('Hz')
    await expect(clipLabel).not.toHaveText(customName)
  })
})
