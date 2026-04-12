import { test, expect } from '@playwright/test'

test.describe('P8 Vocal Finalizer', () => {
  test('supports preset switching and intensity control on selected track', async ({ page }) => {
    await page.goto('/')

    await page.locator('[data-testid="track-header-track-1"]').click()
    const trackEffectsDetails = page.locator('[data-testid="inspector-track-effects"]')
    await expect(trackEffectsDetails).toHaveAttribute('open', '')

    await page.locator('[data-testid="vocal-finalizer-enabled-track-1"]').evaluate((el) => {
      (el as HTMLInputElement).click()
    })
    await expect(page.locator('[data-testid="vocal-finalizer-chain-track-1"]')).toBeVisible()

    await page.locator('[data-testid="vocal-finalizer-preset-warm-track-1"]').click()
    await expect(page.locator('[data-testid="vocal-finalizer-preset-warm-track-1"]')).toHaveClass(/border-emerald-500/)

    await page.locator('[data-testid="vocal-finalizer-preset-intimate-track-1"]').click()
    await expect(page.locator('[data-testid="vocal-finalizer-preset-intimate-track-1"]')).toHaveClass(/border-emerald-500/)

    const mixSlider = page.locator('[data-testid="vocal-finalizer-mix-track-1"]')
    await mixSlider.fill('0.32')
    await expect(mixSlider).toHaveValue('0.32')

    await page.locator('[data-testid="vocal-finalizer-enabled-track-1"]').evaluate((el) => {
      (el as HTMLInputElement).click()
    })
    await expect(page.locator('[data-testid="vocal-finalizer-chain-track-1"]')).toHaveCount(0)
  })
})
