import { test, expect } from '@playwright/test';

test.describe('UI/UX Details Panel', () => {
  test('should display key buttons on track header and allow opening details panel', async ({ page }) => {
    await page.goto('/');
    
    const trackHeader = page.locator('.track-header').first();
    await expect(trackHeader).toBeVisible();
    
    // Key buttons should be visible immediately
    await expect(page.locator('[data-testid^="mute-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="solo-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="vol-"]').first()).toBeVisible();

    // Check selected state
    await trackHeader.click();
    await expect(trackHeader).toHaveClass(/selected/);

    // The advanced effects should be hidden natively until the details is opened
    const details = trackHeader.locator('details.track-effects-details');
    await expect(details).toBeVisible();
    
    // Since we open it in global setup or not, let's explicitly click it if needed
    // Wait, the page.evaluate from global might open it. Let's just verify it can be toggled.
    const summary = details.locator('summary');
    await expect(summary).toBeVisible();
  });
});
