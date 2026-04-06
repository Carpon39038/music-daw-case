import { test, expect } from '@playwright/test';

test('UI/UX interaction improvements', async ({ page }) => {
  await page.goto('/');

  // Metronome button should have visual toggle state
  const metronomeBtn = page.getByTestId('metronome-btn');
  await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'false');
  await metronomeBtn.click();
  await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true');

  // Track selection should update CSS class
  const track1 = page.getByTestId('track-header-track-1');
  await track1.click();
  await expect(track1).toHaveClass(/selected/);

  // Inspector should be visible when clip selected
  await page.getByTestId('add-clip-track-1').click();
  // We need to find the clip that was just created.
  // Wait for the clip to appear
  const clip = page.locator('.clip').first();
  await clip.waitFor({ state: 'visible' });
  await clip.click();
  const inspector = page.getByTestId('inspector-panel');
  await expect(inspector).toBeVisible();
});
