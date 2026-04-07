import { test, expect } from '@playwright/test';

test.describe('Layout & UI Organization', () => {
  test('should render inspector and timeline side-by-side in DAW layout', async ({ page }) => {
    await page.goto('/');

    const dawMain = page.locator('.daw-main');
    await expect(dawMain).toBeVisible();

    const inspector = page.locator('.inspector');
    const timeline = page.locator('.timeline');

    await expect(inspector).toBeVisible();
    await expect(timeline).toBeVisible();

    // Verify side-by-side by checking bounding boxes
    const inspectorBox = await inspector.boundingBox();
    const timelineBox = await timeline.boundingBox();

    expect(inspectorBox).not.toBeNull();
    expect(timelineBox).not.toBeNull();

    // Inspector should be to the right of timeline (standard DAW layout)
    expect(inspectorBox!.x).toBeGreaterThan(timelineBox!.x);
  });

  test('should render transport at top and meter at bottom', async ({ page }) => {
    await page.goto('/');

    const transport = page.locator('.transport');
    const meter = page.locator('.meter');

    await expect(transport).toBeVisible();
    await expect(meter).toBeVisible();

    const transportBox = await transport.boundingBox();
    const meterBox = await meter.boundingBox();

    expect(transportBox).not.toBeNull();
    expect(meterBox).not.toBeNull();

    // Meter should be below transport (vertical stacking)
    expect(meterBox!.y).toBeGreaterThan(transportBox!.y);
  });
});
