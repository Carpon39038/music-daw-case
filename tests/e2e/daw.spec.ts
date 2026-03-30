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
    await firstClip.dispatchEvent('dblclick')
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

  test('editing guards should apply during playback and restore after stop', async ({ page }) => {
    await page.goto('/')

    const bpmInput = page.getByTestId('bpm-input')
    const addClipBtn = page.getByTestId('add-clip-track-1')
    const stopBtn = page.getByTestId('stop-btn')

    await expect(bpmInput).toBeEnabled()
    await expect(addClipBtn).toBeEnabled()

    await page.getByTestId('play-btn').click()

    await expect(page.getByTestId('pause-btn')).toBeEnabled()
    await expect(bpmInput).toBeDisabled()
    await expect(addClipBtn).toBeDisabled()

    await stopBtn.click()

    await expect(page.getByTestId('play-btn')).toBeEnabled()
    await expect(bpmInput).toBeEnabled()
    await expect(addClipBtn).toBeEnabled()
  })

  test('transport rapid toggles should end in a stable stopped state', async ({ page }) => {
    await page.goto('/')

    const playBtn = page.getByTestId('play-btn')
    const pauseBtn = page.getByTestId('pause-btn')
    const stopBtn = page.getByTestId('stop-btn')

    await playBtn.click()
    await pauseBtn.click()
    await playBtn.click()
    await stopBtn.click()

    await expect(playBtn).toBeEnabled()
    await expect(pauseBtn).toBeDisabled()

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.isPlaying).toBe(false)
    expect((debug?.scheduledNodeCount ?? 0) >= 0).toBe(true)
  })

  test('bpm invalid input should fallback to default guard value', async ({ page }) => {
    await page.goto('/')

    const bpmInput = page.getByTestId('bpm-input')
    await bpmInput.fill('')
    await bpmInput.blur()

    const bpm = await page.evaluate(() => window.__DAW_DEBUG__?.bpm)
    expect(bpm).toBe(120)
    await expect(bpmInput).toHaveValue('120')
  })

  test('clip drag should snap to beat and clamp within both timeline bounds', async ({ page }) => {
    await page.goto('/')

    const clip = page.locator('[data-testid^="clip-track-1-"]').first()
    const beforeLeft = await clip.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))

    const box = await clip.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2)
    await page.mouse.up()

    const afterLeft = await clip.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))
    expect(afterLeft).toBeGreaterThan(beforeLeft)

    const isBeatSnap = await clip.evaluate((el) => {
      const leftPercent = Number.parseFloat((el as HTMLElement).style.left)
      const beatPercent = 100 / 16
      const ratio = leftPercent / beatPercent
      return Math.abs(ratio - Math.round(ratio)) < 1e-6
    })
    expect(isBeatSnap).toBe(true)

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 500, box.y + box.height / 2)
    await page.mouse.up()

    const leftAfterClampMin = await clip.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))
    expect(leftAfterClampMin).toBeGreaterThanOrEqual(0)

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 3000, box.y + box.height / 2)
    await page.mouse.up()

    const leftAfterClampMax = await clip.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))
    expect(leftAfterClampMax).toBeLessThanOrEqual(100)
  })

  test('clip drag position should be reflected in playback schedule state', async ({ page }) => {
    await page.goto('/')

    const clip = page.locator('[data-testid^="clip-track-1-"]').first()
    const box = await clip.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    const beforeBeat = await page.evaluate(() => window.__DAW_DEBUG__?.firstTrackFirstClipStartBeat)

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2)
    await page.mouse.up()

    const afterBeat = await page.evaluate(() => window.__DAW_DEBUG__?.firstTrackFirstClipStartBeat)
    expect(afterBeat).toBeGreaterThan(beforeBeat ?? -1)

    await page.getByTestId('play-btn').click()
    const scheduled = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledNodeCount ?? 0)
    expect(scheduled).toBeGreaterThan(0)
    await page.getByTestId('stop-btn').click()
  })

  test('clip drag should revert on Escape (cancel consistency)', async ({ page }) => {
    await page.goto('/')

    const clip = page.locator('[data-testid^="clip-track-1-"]').first()
    const beforeLeft = await clip.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))

    const box = await clip.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2)
    await page.keyboard.press('Escape')

    const afterCancelLeft = await clip.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))
    expect(afterCancelLeft).toBe(beforeLeft)

    await page.mouse.up()
  })

  test('audio runtime should clear scheduled nodes on pause and stop', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('play-btn').click()
    await expect(page.getByTestId('pause-btn')).toBeEnabled()

    const scheduledWhenPlaying = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledNodeCount ?? 0)
    expect(scheduledWhenPlaying).toBeGreaterThan(0)

    await page.getByTestId('pause-btn').click()
    const scheduledAfterPause = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledNodeCount ?? -1)
    expect(scheduledAfterPause).toBe(0)

    await page.getByTestId('play-btn').click()
    const scheduledAfterReplay = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledNodeCount ?? 0)
    expect(scheduledAfterReplay).toBeGreaterThan(0)

    await page.getByTestId('stop-btn').click()
    const scheduledAfterStop = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledNodeCount ?? -1)
    expect(scheduledAfterStop).toBe(0)

    const debug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debug?.isPlaying).toBe(false)
  })
})
