import { test, expect } from '@playwright/test'

test('play button is disabled while playing', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
  const playBtn = page.getByTestId('play-btn')
  const pauseBtn = page.getByTestId('pause-btn')
  
  await expect(playBtn).toBeEnabled()
  await expect(pauseBtn).toBeDisabled()
  
  await playBtn.click()
  
  await expect(playBtn).toBeDisabled()
  await expect(pauseBtn).toBeEnabled()
  
  await page.getByTestId('stop-btn').click()
  await expect(playBtn).toBeEnabled()
})

test('cannot undo or redo while playing', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
  
  // Make a change to enable Undo
  const addTrackBtn = page.getByTestId('add-track-btn')
  if (await addTrackBtn.isVisible()) {
    await addTrackBtn.click()
  }
  
  const playBtn = page.getByTestId('play-btn')
  const undoBtn = page.getByTestId('undo-btn')
  
  await expect(undoBtn).toBeEnabled()
  
  await playBtn.click()
  await expect(undoBtn).toBeDisabled()
  
  await page.getByTestId('stop-btn').click()
  await expect(undoBtn).toBeEnabled()
})

  test('negative: should reject invalid master volume input by fallback', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
    
    // Evaluate to override master volume forcibly into negative
    await page.evaluate(() => {
      const dbg = window.__DAW_DEBUG__
      if (dbg) {
        // Just checking UI guard for negative range
      }
    })
    
    const volInput = page.locator('[data-testid="master-volume"]')
    await volInput.evaluate((el: HTMLInputElement) => { el.value = '-100'; el.dispatchEvent(new Event('change')) })
    
    await page.waitForTimeout(100)
    
    const v = await volInput.inputValue()
    // Depending on range input behavior, it should clamp to 0 or min
    expect(Number(v)).toBeGreaterThanOrEqual(0)
  })

  test('negative: should ignore duplicate clip action when track is locked', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));
    
    // Lock track 1
    const lockBtn = page.locator('[data-testid="lock-track-1"]')
    await lockBtn.click()
    
    // Select clip
    const clip = page.locator('[data-testid^="clip-track-1-"]').first()
    await clip.click()
    
    // Try to duplicate via inspector
    const dupBtn = page.locator('[data-testid="selected-clip-duplicate-btn"]')
    await expect(dupBtn).toBeDisabled()
  })
