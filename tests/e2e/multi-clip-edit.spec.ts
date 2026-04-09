import { test, expect } from '@playwright/test';

test.describe('Multi-Clip Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should allow selecting multiple clips and editing volume', async ({ page }) => {
    await page.waitForSelector('.track-row');
    const clips = page.locator('.clip');
    
    // Select first clip
    await clips.nth(0).click();

    // Shift-click second clip
    await clips.nth(1).click({ modifiers: ['Shift'] });

    // Verify multi-clip inspector is open
    await expect(page.locator('[data-testid="inspector-clip-multi"]')).toBeVisible();

    // Check volume slider exists
    const volumeSlider = page.locator('[data-testid="multi-clip-gain-input"]');
    await expect(volumeSlider).toBeVisible();
    
    // Change volume
    await volumeSlider.fill('50');
    await volumeSlider.dispatchEvent('mouseup');

    // Deselect (click on a track's beat cell)
    await page.locator('.track-row').first().locator('.beat-cell').nth(15).click();
    await expect(page.locator('[data-testid="inspector-clip-multi"]')).not.toBeVisible();

    // Select first clip and verify its gain is changed
    await clips.nth(0).click();
    await expect(page.locator('[data-testid="selected-clip-gain-input"]')).toHaveValue('50');

    // Deselect
    await page.locator('.track-row').first().locator('.beat-cell').nth(15).click();

    // Select second clip and verify its gain is changed
    await clips.nth(1).click();
    await expect(page.locator('[data-testid="selected-clip-gain-input"]')).toHaveValue('50');
  });
});
