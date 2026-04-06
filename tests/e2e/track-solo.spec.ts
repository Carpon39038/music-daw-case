import { test, expect } from '@playwright/test';

test.describe('Track Solo Feature', () => {
  test('should solo a track', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    
    // Check initial state
    const soloBtn = page.getByTestId('solo-track-1');
    await expect(soloBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(soloBtn).toHaveText('Solo');
    
    // Click solo on track 1
    await soloBtn.click();
    
    // The button should indicate solo
    await expect(soloBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(soloBtn).toHaveText('Unsolo');
    
    // Unsolo
    await soloBtn.click();
    await expect(soloBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
