import { test, expect } from '@playwright/test';

test.describe('Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="transport"]');
  });

  test('should show ghost clip and highlight target track during drag', async ({ page }) => {
    // Find the first clip
    const clip = page.locator('.clip').first();
    const clipBox = await clip.boundingBox();
    expect(clipBox).not.toBeNull();

    // Start drag
    await page.mouse.move(clipBox!.x + clipBox!.width / 2, clipBox!.y + clipBox!.height / 2);
    await page.mouse.down();
    
    // Move to another position
    await page.mouse.move(clipBox!.x + clipBox!.width * 1.5, clipBox!.y + clipBox!.height * 1.5);
    
    // Ghost clip should be visible
    const ghostClip = page.locator('.ghost-clip');
    await expect(ghostClip).toBeVisible();
    
    // Target track should be highlighted
    const highlightedTrack = page.locator('.track-grid.bg-white\\/\\[0\\.04\\]');
    await expect(highlightedTrack).toBeVisible();
    
    // Drop
    await page.mouse.up();
    
    // Ghost clip should disappear
    await expect(ghostClip).not.toBeVisible();
  });
});
