import { expect, test } from '@playwright/test'

test.describe('Track Filter e2e', () => {
  test('should display filter select and change filter type', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
    await page.locator('.track-header').first().click();
// Default should be none
    const filterSelect = page.locator('[data-testid="filter-type-track-1"]')
    await expect(filterSelect).toHaveValue('none')
    
    // Select should not show range input initially
    const cutoffInput = page.locator('[data-testid="filter-cutoff-track-1"]')
    await expect(cutoffInput).not.toBeVisible()
    
    // Change to lowpass
    await filterSelect.selectOption('lowpass')
    await expect(filterSelect).toHaveValue('lowpass')
    
    // Now cutoff should be visible
    await expect(cutoffInput).toBeVisible()
    await expect(cutoffInput).toHaveValue('20000')
    
    // Change cutoff
    await cutoffInput.fill('1000')
    // Trigger change event depending on how React handles fill on range
    await cutoffInput.dispatchEvent('change')
    
    await expect(cutoffInput).toHaveValue('1000')
  })

  test('audio runtime should register filter in debug state', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));;
    await page.locator('.track-header').first().click();
// Change track 1 to lowpass
    const filterSelect = page.locator('[data-testid="filter-type-track-1"]')
    await filterSelect.selectOption('lowpass')
    
    // Start playback
    await page.click('[data-testid="play-btn"]')
    
    // Wait for debug state
    await page.waitForFunction(() => {
      const dbg = window.__DAW_DEBUG__
      return dbg?.filteredTrackCount === 1 && dbg?.isPlaying === true
    })
    
    await page.click('[data-testid="stop-btn"]')
    
    // Change track 1 to none
    await filterSelect.selectOption('none')
    
    await page.waitForFunction(() => {
      return window.__DAW_DEBUG__?.filteredTrackCount === 0
    })
  })
})
