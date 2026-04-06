import { test, expect } from '@playwright/test';

test.describe('Track Color', () => {
  test('should allow changing track color and apply to track header', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    
    // Add a track
    await page.click('button:has-text("Add Track")');
    
    // Select the first track header to reveal inspector track properties
    const trackHeader = page.locator('.track-header').first();
    await trackHeader.click();
    
    // Verify the color input exists in inspector
    const colorInput = page.getByTestId('selected-track-color-input');
    await expect(colorInput).toBeVisible();
    
    // The default color should be #4a5568 or similar
    // const initialColor = await colorInput.inputValue();
    
    // Change the color to #ff0000
    await colorInput.fill('#ff0000');
    
    // Verify the track name text now has this color
    const trackNameElement = trackHeader.locator('.track-name');
    await expect(trackNameElement).toHaveCSS('color', 'rgb(255, 0, 0)');
    
    // Add another track, check its default color
    await page.click('button:has-text("Add Track")');
    const track2Header = page.locator('.track-header').nth(1);
    const track2Name = track2Header.locator('.track-name');
    await expect(track2Name).not.toHaveCSS('color', 'rgb(255, 0, 0)');
  });
});
