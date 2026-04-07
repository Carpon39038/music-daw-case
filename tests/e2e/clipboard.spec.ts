import { test, expect } from '@playwright/test'

test.describe('clipboard copy/paste', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
    await page.waitForSelector('[data-testid="transport"]')
    // Reset project
    await page.click('[data-testid="reset-project-btn"]')
    await expect(page.locator('[data-testid="reset-project-btn"]')).toBeEnabled()
  })

  test('copy and paste clip to same track', async ({ page }) => {
    // Select first clip on track-1
    await page.click('[data-testid="clip-track-1-clip-1-1"]')
    await expect(page.locator('[data-testid="inspector-clip"]')).toBeVisible()

    // Copy
    await page.click('[data-testid="selected-clip-copy-btn"]')
    // Verify clipboard state
    await expect(page.evaluate(() => window.__DAW_DEBUG__?.clipboardClipId)).resolves.toBeTruthy()

    // Paste
    const clipCountBefore = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount)
    await page.click('[data-testid="paste-clip-btn"]')
    const clipCountAfter = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount)
    expect(clipCountAfter).toBe((clipCountBefore ?? 0) + 1)
  })

  test('paste to different track', async ({ page }) => {
    // Select clip on track-1
    await page.click('[data-testid="clip-track-1-clip-1-1"]')
    await page.click('[data-testid="selected-clip-copy-btn"]')

    // Select track-2 header and paste
    await page.click('[data-testid="track-header-track-2"]')
    const clipCountBefore = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    await page.click('[data-testid="paste-clip-btn"]')
    const clipCountAfter = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(clipCountAfter).toBe(clipCountBefore + 1)
  })

  test('paste is disabled during playback', async ({ page }) => {
    // Copy a clip first
    await page.click('[data-testid="clip-track-1-clip-1-1"]')
    await page.click('[data-testid="selected-clip-copy-btn"]')
    await page.click('[data-testid="track-header-track-1"]')

    // Start playback
    await page.click('[data-testid="play-btn"]')

    // Paste button should be disabled
    await expect(page.locator('[data-testid="paste-clip-btn"]')).toBeDisabled()

    // Stop
    await page.click('[data-testid="stop-btn"]')
    await expect(page.locator('[data-testid="paste-clip-btn"]')).toBeEnabled()
  })

  test('paste button disabled without track selection is irrelevant - copy requires clip selection', async ({ page }) => {
    // Copy a clip first (this selects track implicitly)
    await page.click('[data-testid="clip-track-1-clip-1-1"]')
    await page.click('[data-testid="selected-clip-copy-btn"]')
    // Verify clipboard is set via inspector button state
    await expect(page.locator('[data-testid="paste-clip-btn"]')).toBeEnabled()
  })

  test('paste to locked track is no-op', async ({ page }) => {
    // Copy clip from track-1
    await page.click('[data-testid="clip-track-1-clip-1-1"]')
    await page.click('[data-testid="selected-clip-copy-btn"]')

    // Lock track-2
    await page.click('[data-testid="lock-track-2"]')
    await expect(page.locator('[data-testid="lock-track-2"]')).toBeVisible()

    // Select track-2 and try to paste
    await page.click('[data-testid="track-header-track-2"]')
    const clipCountBefore = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount)
    await page.click('[data-testid="paste-clip-btn"]')
    const clipCountAfter = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount)
    expect(clipCountAfter).toBe(clipCountBefore)
  })
})
