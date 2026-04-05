import { test, expect } from '@playwright/test'

test('metronome toggle works', async ({ page }) => {
  await page.goto('/')
  
  const metronomeBtn = page.getByTestId('metronome-btn')
  await expect(metronomeBtn).toHaveText('Metronome: OFF')
  await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'false')
  
  await metronomeBtn.click()
  await expect(metronomeBtn).toHaveText('Metronome: ON')
  await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true')
  
  // ensure it plays without crashing
  await page.getByTestId('play-btn').click()
  await page.waitForTimeout(500)
  await page.getByTestId('stop-btn').click()
})
