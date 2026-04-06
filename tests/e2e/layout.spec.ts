import { test, expect } from '@playwright/test';

test.describe('Layout & UI Organization', () => {
  test('should render inspector and timeline side-by-side in workspace', async ({ page }) => {
    await page.goto('/');

    const workspace = page.locator('.workspace');
    await expect(workspace).toBeVisible();

    const inspector = page.locator('.inspector');
    const timeline = page.locator('.timeline');

    await expect(inspector).toBeVisible();
    await expect(timeline).toBeVisible();

    // Verify side-by-side by checking bounding boxes
    const inspectorBox = await inspector.boundingBox();
    const timelineBox = await timeline.boundingBox();

    expect(inspectorBox).not.toBeNull();
    expect(timelineBox).not.toBeNull();

    // Timeline should be to the right of inspector (with some gap)
    expect(timelineBox!.x).toBeGreaterThan(inspectorBox!.x + inspectorBox!.width);
  });

  test('should render top-bar with transport and meter', async ({ page }) => {
    await page.goto('/');

    const topBar = page.locator('.top-bar');
    await expect(topBar).toBeVisible();

    const transport = page.locator('.transport');
    const meter = page.locator('.meter');

    await expect(transport).toBeVisible();
    await expect(meter).toBeVisible();

    const transportBox = await transport.boundingBox();
    const meterBox = await meter.boundingBox();

    expect(transportBox).not.toBeNull();
    expect(meterBox).not.toBeNull();

    // They should be side-by-side or inside the flex container horizontally
    expect(meterBox!.x).toBeGreaterThan(transportBox!.x + transportBox!.width);
  });
});
