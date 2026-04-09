import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
  const resolutions = [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 }
  ];

  for (const res of resolutions) {
    test(`layout should remain stable at ${res.width}x${res.height}`, async ({ page }) => {
      await page.setViewportSize(res);
      await page.goto('/');
      await page.waitForSelector('[data-testid="transport"]');

      const timeline = page.locator('.timeline');
      const trackList = page.locator('.tracklist-panel');
      const inspector = page.locator('.inspector');

      await expect(timeline).toBeVisible();
      await expect(trackList).toBeVisible();
      await expect(inspector).toBeVisible();

      const timelineBox = await timeline.boundingBox();
      const trackListBox = await trackList.boundingBox();
      const inspectorBox = await inspector.boundingBox();

      expect(timelineBox).not.toBeNull();
      expect(trackListBox).not.toBeNull();
      expect(inspectorBox).not.toBeNull();

      // Track list is to the left of timeline
      expect(trackListBox!.x + trackListBox!.width).toBeLessThanOrEqual(timelineBox!.x + 1);
      
      // Inspector should be visible and not completely pushed out
      expect(inspectorBox!.x).toBeGreaterThanOrEqual(0);
      expect(inspectorBox!.y).toBeGreaterThanOrEqual(0);
      expect(inspectorBox!.x + inspectorBox!.width).toBeLessThanOrEqual(res.width + 10);
    });
  }
});
