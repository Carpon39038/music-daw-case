import { expect, test } from '@playwright/test'

test.describe('DAW MVP e2e', () => {
  test('transport + clip add/remove + playback debug state', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Music DAW Case/i })).toBeVisible()

    const initialClipCount = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(initialClipCount).toBeGreaterThanOrEqual(4)

    await page.getByTestId('add-clip-track-1').click()
    const afterAdd = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterAdd).toBe(initialClipCount + 1)

    await page.getByTestId('play-btn').click()
    await expect(page.getByTestId('play-btn')).toBeDisabled()
    await expect(page.getByTestId('pause-btn')).toBeEnabled()

    const playing = await page.evaluate(() => window.__DAW_DEBUG__?.isPlaying)
    expect(playing).toBe(true)

    const scheduled = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledNodeCount ?? 0)
    expect(scheduled).toBeGreaterThan(0)

    await page.getByTestId('pause-btn').click()
    const paused = await page.evaluate(() => window.__DAW_DEBUG__?.isPlaying)
    expect(paused).toBe(false)

    const firstClip = page.locator('[data-testid^="clip-track-1-"]').first()
    await firstClip.dblclick()
    const afterRemove = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterRemove).toBe(afterAdd - 1)
  })

  test('bpm and volume controls are editable when stopped', async ({ page }) => {
    await page.goto('/')

    const bpmInput = page.getByTestId('bpm-input')
    await bpmInput.fill('140')
    const bpm = await page.evaluate(() => window.__DAW_DEBUG__?.bpm)
    expect(bpm).toBe(140)

    const vol = page.getByTestId('vol-track-1')
    await vol.fill('0.33')
    await expect(vol).toHaveValue('0.33')
  })
})
