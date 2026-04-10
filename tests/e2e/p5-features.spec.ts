import { test, expect } from '@playwright/test';

test.describe('P5 Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Quantize clip to 1/4 grid', async ({ page }) => {
    // Add clip using the plus button on track
    await page.getByTestId('add-clip-track-1').click();

    // Wait for clip to appear and click it
    const clip = page.locator('.clip').first();
    await clip.waitFor({ state: 'visible' });
    await clip.click();
    
    // Check initial values
    const fadeOutInput = page.locator('[data-testid="selected-clip-fade-out-input"]');
    await expect(fadeOutInput).toBeVisible();

    // Click quantize 1/4
    const quantizeBtn = page.locator('[data-testid="quantize-1-4-btn"]');
    await quantizeBtn.click();

    // Verify quantize 1/8 and 1/16 exist too
    await expect(page.locator('[data-testid="quantize-1-8-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="quantize-1-16-btn"]')).toBeVisible();
  });

  test('Step Sequencer drum steps', async ({ page }) => {
    // Add drum track
    await page.click('[data-testid="add-drum-track-btn"]');
    
    // Find drum steps
    const drumStep = page.locator('[data-testid^="drum-step-"]').first();
    
    // Click step to toggle
    await drumStep.click();
    await expect(drumStep).toBeVisible();
  });

  test('Scale Lock selection', async ({ page }) => {
    // Change scale key
    const scaleKeySelect = page.locator('[data-testid="scale-key-select"]');
    await scaleKeySelect.selectOption('D');
    await expect(scaleKeySelect).toHaveValue('D');

    // Change scale type
    const scaleTypeSelect = page.locator('[data-testid="scale-type-select"]');
    await scaleTypeSelect.selectOption('minor');
    await expect(scaleTypeSelect).toHaveValue('minor');
  });

  test('Loop Export configuration', async ({ page }) => {
    // Toggle Loop
    const loopBtn = page.locator('[data-testid="loop-enabled"]');
    await loopBtn.click();
    
    // Check loop region is visible
    const loopRegion = page.locator('[data-testid="loop-region"]').first();
    await expect(loopRegion).toBeVisible();

    // Change loop length
    const loopLengthSelect = page.locator('[data-testid="loop-length"]');
    await loopLengthSelect.selectOption('4');
    await expect(loopLengthSelect).toHaveValue('4');
  });

  test('Chord preset insertion adds progression clips', async ({ page }) => {
    await page.getByTestId('track-header-track-1').click();

    const beforeCount = await page.locator('.clip').count();

    await page.getByTestId('insert-chord-I-V-vi-IV').click();

    await expect(page.locator('.clip')).toHaveCount(beforeCount + 12);
  });
});
