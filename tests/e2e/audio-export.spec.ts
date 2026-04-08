import { test, expect } from '@playwright/test';

test.describe('Audio Export', () => {
  test('should render audio export button', async ({ page }) => {
    await page.goto('/');
    const exportBtn = page.getByTestId('audio-export-btn');
    await expect(exportBtn).toBeVisible();
  });
});
