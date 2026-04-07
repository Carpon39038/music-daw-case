import { test, expect } from '@playwright/test';

test.describe('UX Debloat & Information Hierarchy', () => {
  test('should ensure key actions are visible while advanced ones are collapsible', async ({ page }) => {
    await page.goto('/');

    // Main workspace layout check
    const workspace = page.locator('.workspace');
    await expect(workspace).toBeVisible();

    // Transport primary area
    const transportPrimary = page.locator('.transport-primary');
    await expect(transportPrimary).toBeVisible();
    await expect(page.getByTestId('play-btn')).toBeVisible();

    // Advanced transport should be closed by default
    const transportAdvanced = page.locator('details.transport-advanced');
    // It should be visible but not have 'open' attribute
    await expect(transportAdvanced).toBeVisible();
    
    // Check if Playwright evaluates the open attribute
    let isAdvancedOpen = await transportAdvanced.evaluate((node: HTMLDetailsElement) => node.open);
    expect(isAdvancedOpen).toBe(false);

    // Track header key buttons
    const trackHeader = page.locator('.track-header').first();
    await expect(trackHeader.locator('[data-testid^="mute-"]').first()).toBeVisible();
    await expect(trackHeader.locator('[data-testid^="add-clip-"]').first()).toBeVisible();

    // Track header advanced params should be hidden by default
    const trackParams = trackHeader.locator('details.track-header-params');
    let isParamsOpen = await trackParams.evaluate((node: HTMLDetailsElement) => node.open);
    expect(isParamsOpen).toBe(false);

    // Inspector selected states
    await trackHeader.click();
    await expect(trackHeader).toHaveClass(/selected/);

    const inspectorTrack = page.getByTestId('inspector-track');
    await expect(inspectorTrack).toBeVisible();
    
    // Check if basic FX is collapsed
    const trackEffects = page.getByTestId('inspector-track-effects');
    const firstSubgroup = trackEffects.locator('.inspector-subgroup').first();
    let isSubgroupOpen = await firstSubgroup.evaluate((node: HTMLDetailsElement) => node.open);
    expect(isSubgroupOpen).toBe(false);
  });
});
