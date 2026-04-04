import { expect, test } from '@playwright/test'

test.describe('DAW MVP e2e', () => {
  test('transport + clip add + playback debug state', async ({ page }) => {
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
    const volSlider = page.getByTestId('vol-track-1')
    const muteBtn = page.getByTestId('mute-track-1')
    const soloBtn = page.getByTestId('solo-track-1')
    const addClipBtn = page.getByTestId('add-clip-track-1')
    const stopBtn = page.getByTestId('stop-btn')

    await expect(bpmInput).toBeEnabled()
    await expect(volSlider).toBeEnabled()
    await expect(muteBtn).toBeEnabled()
    await expect(soloBtn).toBeEnabled()
    await expect(addClipBtn).toBeEnabled()

    await page.getByTestId('play-btn').click()

    await expect(page.getByTestId('pause-btn')).toBeEnabled()
    await expect(bpmInput).toBeDisabled()
    await expect(volSlider).toBeDisabled()
    await expect(muteBtn).toBeDisabled()
    await expect(soloBtn).toBeDisabled()
    await expect(addClipBtn).toBeDisabled()

    await stopBtn.click()

    await expect(page.getByTestId('play-btn')).toBeEnabled()
    await expect(bpmInput).toBeEnabled()
    await expect(volSlider).toBeEnabled()
    await expect(muteBtn).toBeEnabled()
    await expect(soloBtn).toBeEnabled()
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

  test('clip resize should change beat length and remain playable', async ({ page }) => {
    await page.goto('/')

    const clip = page.locator('[data-testid^="clip-track-1-"]').first()
    const resizeHandle = page.locator('[data-testid^="clip-resize-track-1-"]').first()

    const before = await page.evaluate(() => ({
      length: window.__DAW_DEBUG__?.firstTrackFirstClipLengthBeats,
      left: window.__DAW_DEBUG__?.firstTrackFirstClipStartBeat,
    }))

    const handleBox = await resizeHandle.boundingBox()
    expect(handleBox).not.toBeNull()
    if (!handleBox) return

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox.x + 120, handleBox.y + handleBox.height / 2)
    await page.mouse.up()

    const afterGrow = await page.evaluate(() => ({
      length: window.__DAW_DEBUG__?.firstTrackFirstClipLengthBeats,
      left: window.__DAW_DEBUG__?.firstTrackFirstClipStartBeat,
    }))

    expect(afterGrow.length).toBeGreaterThan(before.length ?? 0)
    expect(afterGrow.left).toBe(before.left)

    const clipWidthPercent = await clip.evaluate((el) => Number.parseFloat((el as HTMLElement).style.width))
    expect(clipWidthPercent).toBeGreaterThan(((before.length ?? 1) / 16) * 100)

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

  test('undo/redo should restore clip add operation state', async ({ page }) => {
    await page.goto('/')

    const before = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)

    await page.getByTestId('add-clip-track-1').click()
    const afterAdd = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterAdd).toBe(before + 1)

    await page.getByTestId('undo-btn').click()
    const afterUndo = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterUndo).toBe(before)

    await page.getByTestId('redo-btn').click()
    const afterRedo = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterRedo).toBe(before + 1)
  })

  test('project should persist clip edits across reload', async ({ page }) => {
    await page.goto('/')

    const before = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    await page.getByTestId('add-clip-track-1').click()
    const afterAdd = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterAdd).toBe(before + 1)

    await page.reload()

    const afterReload = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterReload).toBe(before + 1)

    await page.getByTestId('reset-project-btn').click()
  })

  test('clip drag should avoid overlap by auto-resolving to nearest free slot', async ({ page }) => {
    await page.goto('/')

    const clipList = page.locator('[data-testid^="clip-track-1-"]')
    await expect(clipList).toHaveCount(1)

    await page.getByTestId('add-clip-track-1').click()
    await expect(clipList).toHaveCount(2)

    const first = clipList.nth(0)
    const second = clipList.nth(1)

    const firstBox = await first.boundingBox()
    const secondBox = await second.boundingBox()
    expect(firstBox).not.toBeNull()
    expect(secondBox).not.toBeNull()
    if (!firstBox || !secondBox) return

    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
    await page.mouse.up()

    const firstLeft = await first.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))
    const secondLeft = await second.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left))
    const firstWidth = await first.evaluate((el) => Number.parseFloat((el as HTMLElement).style.width))
    const secondWidth = await second.evaluate((el) => Number.parseFloat((el as HTMLElement).style.width))

    const overlapped = firstLeft < secondLeft + secondWidth && secondLeft < firstLeft + firstWidth
    expect(overlapped).toBe(false)
  })

  test('double click should toggle clip wave while Alt+double click deletes clip', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('add-clip-track-1').click()

    const clip = page.locator('[data-testid^="clip-track-1-"]').first()

    const before = await page.evaluate(() => ({
      wave: window.__DAW_DEBUG__?.firstTrackFirstClipWave,
      count: window.__DAW_DEBUG__?.clipCount ?? 0,
    }))

    await clip.dispatchEvent('dblclick')

    const afterWaveToggle = await page.evaluate(() => ({
      wave: window.__DAW_DEBUG__?.firstTrackFirstClipWave,
      count: window.__DAW_DEBUG__?.clipCount ?? 0,
    }))

    expect(afterWaveToggle.wave).not.toBe(before.wave)
    expect(afterWaveToggle.count).toBe(before.count)

    await clip.dispatchEvent('dblclick', { altKey: true })

    const afterAltDelete = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterAltDelete).toBe(afterWaveToggle.count - 1)
  })

  test('last clip of a track should be protected from accidental deletion', async ({ page }) => {
    await page.goto('/')

    const clipList = page.locator('[data-testid^="clip-track-1-"]')
    await expect(clipList).toHaveCount(1)

    const onlyClip = clipList.first()
    await onlyClip.dispatchEvent('dblclick', { altKey: true })

    await expect(clipList).toHaveCount(1)

    const debug = await page.evaluate(() => ({
      clipCount: window.__DAW_DEBUG__?.clipCount ?? 0,
      firstWave: window.__DAW_DEBUG__?.firstTrackFirstClipWave,
    }))

    expect(debug.clipCount).toBeGreaterThanOrEqual(4)
    expect(debug.firstWave === 'sine' || debug.firstWave === 'square').toBe(true)
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

  test('master output meter should rise during playback and decay after stop', async ({ page }) => {
    await page.goto('/')

    const levelBefore = await page.evaluate(() => window.__DAW_DEBUG__?.masterLevel ?? 0)
    expect(levelBefore).toBeGreaterThanOrEqual(0)

    await page.getByTestId('play-btn').click()

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.masterLevel ?? 0), {
        timeout: 3000,
        message: 'master level should rise while audio is playing',
      })
      .toBeGreaterThan(0.01)

    await page.getByTestId('stop-btn').click()

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.masterLevel ?? 1), {
        timeout: 3000,
        message: 'master level should decay close to silence after stop',
      })
      .toBeLessThan(0.05)
  })

  test('debug state should expose transport playhead and audio context lifecycle', async ({ page }) => {
    await page.goto('/')

    const before = await page.evaluate(() => ({
      playheadBeat: window.__DAW_DEBUG__?.playheadBeat,
      audioContextState: window.__DAW_DEBUG__?.audioContextState,
    }))

    expect(before.playheadBeat).toBe(0)
    expect(before.audioContextState === 'uninitialized' || before.audioContextState === 'running').toBe(true)

    await page.getByTestId('play-btn').click()

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.playheadBeat ?? 0), {
        timeout: 3000,
        message: 'playhead should move forward during playback',
      })
      .toBeGreaterThan(0)

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.audioContextState), {
        timeout: 3000,
        message: 'audio context should become running after playback starts',
      })
      .toBe('running')

    await page.getByTestId('stop-btn').click()

    const after = await page.evaluate(() => ({
      playheadBeat: window.__DAW_DEBUG__?.playheadBeat,
      audioContextState: window.__DAW_DEBUG__?.audioContextState,
      isPlaying: window.__DAW_DEBUG__?.isPlaying,
    }))

    expect(after.isPlaying).toBe(false)
    expect(after.playheadBeat).toBe(0)
    expect(after.audioContextState === 'running' || after.audioContextState === 'suspended').toBe(true)
  })

  test('debug timing invariants should align beat duration with timeline duration', async ({ page }) => {
    await page.goto('/')

    const timing = await page.evaluate(() => ({
      bpm: window.__DAW_DEBUG__?.bpm,
      beatDurationSec: window.__DAW_DEBUG__?.beatDurationSec,
      timelineDurationSec: window.__DAW_DEBUG__?.timelineDurationSec,
    }))

    expect(timing.bpm).toBeGreaterThan(0)
    expect(timing.beatDurationSec).toBeCloseTo(60 / (timing.bpm ?? 120), 6)
    expect(timing.timelineDurationSec).toBeCloseTo((timing.beatDurationSec ?? 0) * 16, 6)
  })

  test('loop playback should wrap playhead and increment loop restart counter', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('loop-enabled').check()
    await page.getByTestId('loop-length').selectOption('4')

    const debugBefore = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugBefore?.loopEnabled).toBe(true)
    expect(debugBefore?.loopLengthBeats).toBe(4)

    await page.getByTestId('play-btn').click()

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.loopRestartCount ?? 0), {
        timeout: 5000,
        message: 'loop restart count should increase after one loop cycle',
      })
      .toBeGreaterThanOrEqual(1)

    const debugAfter = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugAfter?.isPlaying).toBe(true)
    expect((debugAfter?.playheadBeat ?? 999)).toBeLessThan(4.2)

    await page.getByTestId('stop-btn').click()

    const debugStopped = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugStopped?.isPlaying).toBe(false)
    expect(debugStopped?.loopRestartCount).toBe(0)
  })

  test('track mute should silence meter contribution and persist across reload', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('reset-project-btn').click()

    const muteTrack2 = page.getByTestId('mute-track-2')
    const muteTrack3 = page.getByTestId('mute-track-3')
    const muteTrack4 = page.getByTestId('mute-track-4')

    await muteTrack2.click()
    await muteTrack3.click()
    await muteTrack4.click()

    const debugMuted = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugMuted?.mutedTrackCount).toBe(3)
    expect(debugMuted?.audibleTrackCount).toBe(1)

    await page.getByTestId('play-btn').click()

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.masterLevel ?? 0), {
        timeout: 3000,
        message: 'master level should still rise with one audible track',
      })
      .toBeGreaterThan(0.005)

    await page.getByTestId('stop-btn').click()

    const muteTrack1 = page.getByTestId('mute-track-1')
    await muteTrack1.click()

    const allMutedDebug = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(allMutedDebug?.mutedTrackCount).toBe(4)
    expect(allMutedDebug?.audibleTrackCount).toBe(0)

    await page.getByTestId('play-btn').click()

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.masterLevel ?? 1), {
        timeout: 3000,
        message: 'master level should stay near silence when all tracks are muted',
      })
      .toBeLessThan(0.02)

    await page.getByTestId('stop-btn').click()

    await page.reload()

    const debugAfterReload = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugAfterReload?.mutedTrackCount).toBe(4)

    await page.getByTestId('mute-track-1').click()
    await page.getByTestId('mute-track-2').click()
    await page.getByTestId('mute-track-3').click()
    await page.getByTestId('mute-track-4').click()
    await page.getByTestId('reset-project-btn').click()
  })

  test('track solo should isolate audible tracks and persist across reload', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('reset-project-btn').click()

    const soloTrack2 = page.getByTestId('solo-track-2')
    const soloTrack3 = page.getByTestId('solo-track-3')

    await soloTrack2.click()

    const debugSingleSolo = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugSingleSolo?.soloActive).toBe(true)
    expect(debugSingleSolo?.soloTrackCount).toBe(1)
    expect(debugSingleSolo?.audibleTrackCount).toBe(1)

    await page.getByTestId('play-btn').click()
    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.masterLevel ?? 0), {
        timeout: 3000,
        message: 'master level should rise when one solo track is active',
      })
      .toBeGreaterThan(0.005)
    await page.getByTestId('stop-btn').click()

    await soloTrack3.click()

    const debugDualSolo = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugDualSolo?.soloTrackCount).toBe(2)
    expect(debugDualSolo?.audibleTrackCount).toBe(2)

    await page.reload()

    const debugAfterReload = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugAfterReload?.soloActive).toBe(true)
    expect(debugAfterReload?.soloTrackCount).toBe(2)
    expect(debugAfterReload?.audibleTrackCount).toBe(2)

    await page.getByTestId('solo-track-2').click()
    await page.getByTestId('solo-track-3').click()
    await page.getByTestId('reset-project-btn').click()
  })

  test('keyboard shortcuts should drive transport and history actions', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('reset-project-btn').click()

    const before = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)

    await page.getByTestId('add-clip-track-1').click()
    await page.keyboard.press('Meta+z')

    const afterUndo = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterUndo).toBe(before)

    await page.keyboard.press('Meta+Shift+z')

    const afterRedo = await page.evaluate(() => window.__DAW_DEBUG__?.clipCount ?? 0)
    expect(afterRedo).toBe(before + 1)

    await page.keyboard.press('Space')

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.isPlaying), {
        timeout: 3000,
        message: 'space should start playback when stopped',
      })
      .toBe(true)

    await page.keyboard.press('Space')

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.isPlaying), {
        timeout: 3000,
        message: 'space should pause playback when playing',
      })
      .toBe(false)

    await page.keyboard.press('Space')

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.isPlaying), {
        timeout: 3000,
        message: 'space should resume playback after pause',
      })
      .toBe(true)

    await page.keyboard.press('s')

    const debugAfterStop = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugAfterStop?.isPlaying).toBe(false)
    expect(debugAfterStop?.playheadBeat).toBe(0)

    await page.getByTestId('reset-project-btn').click()
  })

  test('track transpose should retune scheduled frequencies and persist across reload', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('reset-project-btn').click()

    const transpose = page.getByTestId('transpose-track-1')
    await expect(transpose).toHaveValue('0')

    const base = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledFrequencyPreviewHz ?? [])
    expect(base.length).toBe(0)

    await transpose.fill('12')

    const debugAfterSet = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugAfterSet?.firstTrackTransposeSemitones).toBe(12)
    expect(debugAfterSet?.transposedTrackCount).toBe(1)

    await page.getByTestId('play-btn').click()

    await expect
      .poll(async () => page.evaluate(() => window.__DAW_DEBUG__?.scheduledFrequencyPreviewHz ?? []), {
        timeout: 3000,
        message: 'scheduled frequency preview should be populated during playback',
      })
      .not.toHaveLength(0)

    const previewWithTranspose = await page.evaluate(() => window.__DAW_DEBUG__?.scheduledFrequencyPreviewHz ?? [])
    const firstHz = previewWithTranspose[0] ?? 0
    expect(firstHz).toBeGreaterThan(500)

    await page.getByTestId('stop-btn').click()
    await page.reload()

    const debugAfterReload = await page.evaluate(() => window.__DAW_DEBUG__)
    expect(debugAfterReload?.firstTrackTransposeSemitones).toBe(12)
    expect(debugAfterReload?.transposedTrackCount).toBe(1)

    await page.getByTestId('transpose-track-1').fill('0')
    await page.getByTestId('reset-project-btn').click()
  })
})
