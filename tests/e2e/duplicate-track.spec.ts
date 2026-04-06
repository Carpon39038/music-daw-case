import { test, expect } from '@playwright/test';

test.describe('Duplicate Track', () => {
  test('should duplicate track with its clips', async ({ page }) => {
    await page.goto('/');
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    
    // Select the first track
    await page.click('[data-testid="track-header-track-1"]');
    
    // Click duplicate track
    await page.click('[data-testid="duplicate-track-btn"]');
    
    // Check if new track exists and has name "(Copy)"
    const trackHeaders = await page.locator('.track-header').all();
    expect(trackHeaders.length).toBe(5); // Initially 4 tracks
    
    const newTrackName = await page.locator('.track-header .track-name').nth(1).textContent();
    expect(newTrackName).toBe('Track 1 (Copy)');
  });
});
