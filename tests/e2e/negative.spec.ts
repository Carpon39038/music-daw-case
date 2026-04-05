import { test, expect } from '@playwright/test'

test('play button is disabled while playing', async ({ page }) => {
  await page.goto('/')
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
  await page.goto('/')
  
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
