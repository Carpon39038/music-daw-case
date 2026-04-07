import { test, expect } from '@playwright/test';

test.describe('UI/UX Details Panel', () => {
  test('should display key buttons on track header and advanced effects in inspector', async ({ page }) => {
    await page.goto('/');
    
    const trackHeader = page.locator('.track-header').first();
    await expect(trackHeader).toBeVisible();
    
    // Key buttons should be visible immediately
    await expect(trackHeader.locator('[data-testid^="mute-"]').first()).toBeVisible();
    await expect(trackHeader.locator('[data-testid^="solo-"]').first()).toBeVisible();
    // open details first
    await trackHeader.locator('summary').first().click();
    await expect(trackHeader.locator('[data-testid^="vol-"]').first()).toBeVisible();

    // Check selected state
    await trackHeader.click();
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
    await expect(trackHeader).toHaveClass(/selected/);

    // Advanced effects should NOT be in track header anymore
    const detailsInHeader = trackHeader.locator('details.track-effects-details');
    await expect(detailsInHeader).toHaveCount(0);
    
    // Instead, they should be in the Inspector
    const inspectorEffects = page.locator('[data-testid="inspector-track-effects"]');
    await expect(inspectorEffects).toBeVisible();
    
    const summary = inspectorEffects.locator('summary').first();
    await expect(summary).toBeVisible();
  });
});
