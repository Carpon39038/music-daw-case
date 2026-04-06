import { test, expect } from '@playwright/test';

test.describe('Track Compressor', () => {
  test('should allow enabling and configuring track compressor via inspector', async ({ page }) => {
    await page.goto('/');

    // 1. Ensure track is selected
    const trackHeader = page.locator('.track-header').first();
    await trackHeader.click();

    // 2. Enable compressor
    const compressorCheckbox = page.getByTestId(/compressor-enabled-.+/).first();
    await expect(compressorCheckbox).not.toBeChecked();
    await compressorCheckbox.check();
    await expect(compressorCheckbox).toBeChecked();

    // 3. Configure Threshold
    const thresholdSlider = page.getByTestId(/compressor-threshold-.+/).first();
    await thresholdSlider.fill('-10'); // trigger change
    const thresholdValue = await thresholdSlider.inputValue();
    expect(thresholdValue).toBe('-10');

    // 4. Configure Ratio
    const ratioSlider = page.getByTestId(/compressor-ratio-.+/).first();
    await ratioSlider.fill('8');
    const ratioValue = await ratioSlider.inputValue();
    expect(ratioValue).toBe('8');

    // Reload page to ensure state persistence (if localstorage or similar handles it, though here we just test UI state update works)
    // Actually DAW might not persist on reload yet, but the UI responding is good.
  });
});
