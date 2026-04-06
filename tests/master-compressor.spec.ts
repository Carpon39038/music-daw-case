import { test, expect } from '@playwright/test';

test.describe('Master Compressor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('can toggle compressor and adjust threshold', async ({ page }) => {
    const dawState = page.getByTestId('daw-state');
    
    // Initially disabled
    await expect(dawState).toHaveAttribute('data-state', /"masterCompressorEnabled":false/);
    
    // Enable compressor
    await page.getByTestId('master-compressor-toggle').check();
    await expect(dawState).toHaveAttribute('data-state', /"masterCompressorEnabled":true/);
    
    // Adjust threshold
    const slider = page.getByTestId('master-compressor-threshold');
    await slider.fill('-40');
    await expect(dawState).toHaveAttribute('data-state', /"masterCompressorThreshold":-40/);
  });
});
