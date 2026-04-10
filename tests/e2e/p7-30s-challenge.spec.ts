import { test, expect } from '@playwright/test'

test.describe('P7 30s challenge mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('supports 3-step flow: select style -> edit -> export', async ({ page }) => {
    await page.getByTestId('challenge-mode-toggle').click()
    await expect(page.getByTestId('challenge-mode-panel')).toBeVisible()

    await expect(page.getByTestId('challenge-step-1')).toContainText('👉')
    await page.getByTestId('challenge-style-lofi').click()

    await expect(page.getByTestId('challenge-step-1')).toContainText('✅')
    await expect(page.getByTestId('challenge-step-2')).toContainText('👉')

    await page.getByTestId('bpm-input').fill('96')

    await expect(page.getByTestId('challenge-step-2')).toContainText('✅')
    await expect(page.getByTestId('challenge-step-3')).toContainText('👉')

    await page.getByTestId('challenge-export-btn').click()
    await expect(page.getByTestId('challenge-status-label')).toContainText('挑战完成')
  })
})
