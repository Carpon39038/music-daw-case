import { test, expect } from '@playwright/test'

test.describe('interaction enhancements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true))
    await page.waitForSelector('[data-testid="transport"]')
  })

  test('double-click on empty beat cell creates a new clip', async ({ page }) => {
    const clipCountBefore = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)

    // Double-click on an empty beat cell on track-1
    // Beat cells are inside .beat-cell elements within the track grid
    const trackRow = page.locator('[data-testid="track-row-track-1"]')
    const beatCells = trackRow.locator('.beat-cell')
    const cellCount = await beatCells.count()
    expect(cellCount).toBeGreaterThan(0)

    // Double-click on the last beat cell (likely empty area)
    await beatCells.nth(cellCount - 1).dblclick()

    const clipCountAfter = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(clipCountAfter).toBe(clipCountBefore + 1)
  })

  test('double-click on occupied beat cell does not create clip (toggles waveform instead)', async ({ page }) => {
    const clipCountBefore = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)

    // Double-click on a clip (not empty area)
    const clip = page.locator('[data-testid="clip-track-1-clip-1-1"]')
    await clip.dblclick()

    const clipCountAfter = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(clipCountAfter).toBe(clipCountBefore) // no new clip created
  })

  test('time display format is MM:SS.ms (B{beat})', async ({ page }) => {
    const status = page.locator('.status')
    await expect(status).toBeVisible()
    const text = await status.textContent()
    // Should match format like 00:00.00 (B0) or 01:30.50 (B3)
    expect(text).toMatch(/\d{2}:\d{2}\.\d{2} \(B\d+\)/)
  })

  test('playhead can be dragged via timeline header click', async ({ page }) => {
    // Get initial playhead position
    const beatBefore = await page.evaluate(() => window.__DAW_DEBUG__?.playheadBeat ?? 0)

    const header = page.locator('[data-testid="timeline-header"]')
    const headerBox = await header.boundingBox()
    expect(headerBox).toBeTruthy()

    // Click on the middle of the header to set playhead
    const targetX = headerBox!.x + headerBox!.width * 0.75
    const targetY = headerBox!.y + headerBox!.height / 2

    await page.mouse.click(targetX, targetY)
    const beatAfter = await page.evaluate(() => window.__DAW_DEBUG__?.playheadBeat ?? 0)

    // Playhead should have moved to approximately beat 12 (75% of 16)
    expect(beatAfter).toBeGreaterThan(beatBefore)
    expect(beatAfter).toBeGreaterThanOrEqual(10)
  })

  test('shift+click adds clip to multi-selection', async ({ page }) => {
    // Select first clip
    await page.click('[data-testid="clip-track-1-clip-1-1"]')

    // Shift+click on clip from track-2
    const track2Clip = page.locator('[data-testid="clip-track-2-clip-2-1"]')
    await track2Clip.click({ modifiers: ['Shift'] })

    // Both clips should have selected class
    await expect(page.locator('[data-testid="clip-track-1-clip-1-1"]')).toHaveClass(/selected/)
    await expect(page.locator('[data-testid="clip-track-2-clip-2-1"]')).toHaveClass(/selected/)
  })

  test('keyboard shortcut: Space toggles play/pause', async ({ page }) => {
    const isPlayingBefore = await page.evaluate(() => window.__DAW_DEBUG__?.isPlaying)
    expect(isPlayingBefore).toBe(false)

    await page.keyboard.press('Space')
    const isPlayingAfter = await page.evaluate(() => window.__DAW_DEBUG__?.isPlaying)
    expect(isPlayingAfter).toBe(true)

    await page.keyboard.press('Space')
    const isPlayingAfterPause = await page.evaluate(() => window.__DAW_DEBUG__?.isPlaying)
    expect(isPlayingAfterPause).toBe(false)
  })

  test('keyboard shortcut: S stops playback', async ({ page }) => {
    // Start playing first
    await page.keyboard.press('Space')
    const isPlaying = await page.evaluate(() => window.__DAW_DEBUG__?.isPlaying)
    expect(isPlaying).toBe(true)

    await page.keyboard.press('s')
    const isPlayingAfter = await page.evaluate(() => window.__DAW_DEBUG__?.isPlaying)
    expect(isPlayingAfter).toBe(false)

    const playheadBeat = await page.evaluate(() => window.__DAW_DEBUG__?.playheadBeat ?? 999)
    expect(playheadBeat).toBe(0) // stop resets to 0
  })

  test('keyboard shortcut: Delete removes selected clip', async ({ page }) => {
    // Select a clip
    await page.click('[data-testid="clip-track-1-clip-1-1"]')
    const clipCountBefore = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)

    await page.keyboard.press('Delete')
    const clipCountAfter = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(clipCountAfter).toBe(clipCountBefore - 1)
  })
})
