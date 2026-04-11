import { test, expect } from '@playwright/test'

test.describe('P8 Clip Envelope', () => {
  test('supports 3-point envelope editing and reset', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true))

    await page.locator('.clip').first().click()

    await expect(page.getByTestId('clip-envelope-editor')).toBeVisible()

    await page.getByTestId('clip-envelope-point-1-gain').fill('0.5')
    await expect(page.getByTestId('clip-envelope-point-1-gain')).toHaveValue('0.5')

    await page.getByTestId('clip-envelope-point-1-beat').fill('3')
    await expect(page.getByTestId('clip-envelope-point-1-beat')).toHaveValue('1.99')

    await page.getByTestId('clip-envelope-reset-btn').click()
    await expect(page.getByTestId('clip-envelope-point-1-gain')).toHaveValue('1')

    await page.reload()
    await page.click('[data-testid^="clip-"]')
    await expect(page.getByTestId('clip-envelope-point-1-gain')).toHaveValue('1')
  })
})
