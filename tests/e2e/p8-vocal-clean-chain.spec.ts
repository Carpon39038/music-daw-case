import { test, expect } from '@playwright/test'

test.describe('P8 Vocal Clean Chain', () => {
  test('enables vocal clean chain, shows warning, and keeps settings in export debug state', async ({ page }) => {
    await page.goto('/')

    await page.locator('[data-testid="track-header-track-1"]').click()
    await page.getByText('Vocal Clean Chain').first().click()
    await page.locator('[data-testid="vocal-clean-enabled-track-1"]').check()

    await expect(page.locator('[data-testid="vocal-clean-chain-track-1"]')).toBeVisible()

    await page.locator('[data-testid="clip-track-1-clip-1-1"]').click()
    await page.locator('[data-testid="selected-clip-gain-input"]').fill('20')

    await page.locator('[data-testid="vocal-clean-enabled-track-1"]').uncheck()
    await page.locator('[data-testid="vocal-clean-enabled-track-1"]').check()

    await expect(page.locator('[data-testid="vocal-input-warning-track-1"]')).toContainText('电平偏低')
    await expect(page.locator('[data-testid="vocal-input-warning-track-1"]')).toContainText('输入增益')

    await expect(page.locator('[data-testid="vocal-denoise-track-1"]')).toHaveValue('0.45')
    await expect(page.locator('[data-testid="vocal-deess-track-1"]')).toHaveValue('0.5')
    await expect(page.locator('[data-testid="vocal-comp-track-1"]')).toHaveValue('0.55')
    await expect(page.locator('[data-testid="vocal-makeup-track-1"]')).toHaveValue('2')
  })
})
