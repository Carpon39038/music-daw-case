import { test, expect } from '@playwright/test'

test.describe('Clip Mute', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.clear()
    })
    await page.goto('/')
    await expect(page.locator('.app')).toBeVisible()
  })

  test('can mute and unmute a clip from the inspector', async ({ page }) => {
    // 1. Select the first clip
    const firstClip = page.locator('.clip').first()
    await firstClip.click()

    // 2. Assert clip inspector is visible
    const inspectorClip = page.getByTestId('inspector-clip')
    await expect(inspectorClip).toBeVisible()

    // 3. Find the Mute Clip button and click it
    const muteBtn = page.getByTestId('selected-clip-mute-btn')
    await expect(muteBtn).toBeVisible()
    await expect(muteBtn).toHaveText('Mute Clip')
    
    await muteBtn.click()

    // 4. Button text should change to Unmute Clip
    await expect(muteBtn).toHaveText('Unmute Clip')
    
    // 5. Clip should have 'muted' class
    await expect(firstClip).toHaveClass(/muted/)

    // 6. Check debug state to see mutedClipCount = 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mutedClipCount = await page.evaluate(() => (window as any).__DAW_DEBUG__?.mutedClipCount ?? 0)
    expect(mutedClipCount).toBe(1)

    // 7. Unmute the clip
    await muteBtn.click()
    await expect(muteBtn).toHaveText('Mute Clip')
    await expect(firstClip).not.toHaveClass(/muted/)
  })
})
