import { test, expect } from '@playwright/test';

test.describe('Inspector Panel Collapsibility', () => {
  test('should use native details element for track and clip settings', async ({ page }) => {
    await page.goto('/');

    // First select a track
    const trackHeader = page.locator('.track-header').first();
    await trackHeader.click();

    // Verify track inspector uses details
    const trackDetails = page.locator('details[data-testid="inspector-track"]');
    await expect(trackDetails).toBeVisible();
    await expect(trackDetails).toHaveAttribute('open', '');

    // Now add a clip to select it
    await page.getByTestId('add-clip-track-1').click();
    const clip = page.locator('.clip').first();
    await clip.waitFor({ state: 'visible' });
    await clip.click();

    // Verify clip inspector uses details
    const clipDetails = page.locator('details[data-testid="inspector-clip"]');
    await expect(clipDetails).toBeVisible();
    await expect(clipDetails).toHaveAttribute('open', '');

    // Check we can toggle them
    const clipSummary = clipDetails.locator('summary');
    await clipSummary.click();
    // It shouldn't have open attribute anymore
    // Playwright evaluates attribute correctly
    const isOpen = await clipDetails.evaluate((node: HTMLDetailsElement) => node.open);
    expect(isOpen).toBe(false);
  });
});
