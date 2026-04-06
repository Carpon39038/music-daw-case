import { test, expect } from '@playwright/test';

test.describe('Clip Fades', () => {
  test('should allow setting and persisting clip fadeIn and fadeOut via inspector', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));

    // Select the first track and its first clip
    const trackHeader = page.getByTestId(/track-header-/).first();
    await trackHeader.click();
    
    // Select clip
    const firstClip = page.locator('.clip').first();
    await firstClip.click();

    // Check fade in / out inputs
    const fadeInInput = page.getByTestId('selected-clip-fade-in-input');
    const fadeOutInput = page.getByTestId('selected-clip-fade-out-input');

    await expect(fadeInInput).toBeVisible();
    await expect(fadeOutInput).toBeVisible();

    await expect(fadeInInput).toHaveValue('0');
    await expect(fadeOutInput).toHaveValue('0');

    // Change fade in and out
    await fadeInInput.fill('0.5');
    await fadeOutInput.fill('0.4');
    
    await fadeInInput.blur();

    // Playback should not crash and should work with fades
    await page.getByTestId('play-btn').click();
    await page.waitForTimeout(500);
    await page.getByTestId('stop-btn').click();

    // Check persistence
    const addTrackBtn = page.getByTestId('add-track-btn');
    await addTrackBtn.click();
    
    // Select newly added track
    const tracks = page.locator('.track-header');
    await tracks.last().click();

    // Re-select first track and clip
    await trackHeader.click();
    await firstClip.click();

    await expect(fadeInInput).toHaveValue('0.5');
    await expect(fadeOutInput).toHaveValue('0.4');
  });
});
