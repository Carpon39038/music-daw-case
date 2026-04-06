import { test, expect } from '@playwright/test'

test.describe('Track Delay e2e', () => {
  test('should toggle delay and adjust parameters', async ({ page }) => {
    await page.goto('/')

    // Wait for the.track-header header to load
    await page.waitForSelector('.track-header');
    await page.locator('.track-header').first().click();
    
    // Check if the delay toggle exists
    const delayToggle = page.locator('[data-testid^="delay-enable-"]').first()
    await expect(delayToggle).not.toBeChecked()

    // Enable delay
    await delayToggle.check()
    await expect(delayToggle).toBeChecked()

    // Adjust delay time
    const delayTimeSlider = page.locator('[data-testid^="delay-time-"]').first()
    await expect(delayTimeSlider).toBeVisible()
    await delayTimeSlider.fill('0.5')
    await delayTimeSlider.dispatchEvent('change')
    await expect(delayTimeSlider).toHaveValue('0.5')

    // Adjust delay feedback
    const delayFbSlider = page.locator('[data-testid^="delay-fb-"]').first()
    await expect(delayFbSlider).toBeVisible()
    await delayFbSlider.fill('0.8')
    await delayFbSlider.dispatchEvent('change')
    await expect(delayFbSlider).toHaveValue('0.8')

    // Verify it persists on reload
    await page.reload()
    await page.waitForSelector('.track-header');
    await page.locator('.track-header').first().click();

    const newDelayToggle = page.locator('[data-testid^="delay-enable-"]').first()
    await expect(newDelayToggle).toBeChecked()

    const newDelayTimeSlider = page.locator('[data-testid^="delay-time-"]').first()
    await expect(newDelayTimeSlider).toHaveValue('0.5')

    const newDelayFbSlider = page.locator('[data-testid^="delay-fb-"]').first()
    await expect(newDelayFbSlider).toHaveValue('0.8')
  })
})
