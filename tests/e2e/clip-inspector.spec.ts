import { test, expect } from '@playwright/test'

test.describe('Clip Inspector', () => {
  test('can edit clip waveform and length from inspector', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // Wait for the app to load
    await expect(page.locator('.app')).toBeVisible()

    // Select the first clip
    const firstClip = page.locator('.clip').first()
    await firstClip.click()

    // Ensure inspector clip panel is visible
    const inspectorClip = page.locator('[data-testid="inspector-clip"]')
    await expect(inspectorClip).toBeVisible()

    // Change waveform to sawtooth
    const waveSelect = page.locator('[data-testid="selected-clip-wave-select"]')
    await waveSelect.selectOption('sawtooth')

    // Verify clip has 'sawtooth' class
    await expect(firstClip).toHaveClass(/sawtooth/)

    // Change length to 4 beats
    const lengthInput = page.locator('[data-testid="selected-clip-length-input"]')
    await lengthInput.fill('4')

    // The length input is controlled, wait for react render
    await expect(lengthInput).toHaveValue('4')

    // Verify clip width increased (was 2 beats)
    const clipStyle = await firstClip.getAttribute('style')
    expect(clipStyle).toContain('width: 25%') // 4 beats out of 32 total beats = 12.5%
  })
})
