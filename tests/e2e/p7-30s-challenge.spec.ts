import { test, expect } from '@playwright/test'

test.describe('P7 30s challenge mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTitle('Transport Settings').click()
    await page.getByTitle('Export 面板').click()
  })

  test('supports 3-step flow: select style -> edit -> export', async ({ page }) => {
    await page.addInitScript(() => {
      window.alert = () => {}
      window.confirm = () => true
    })
    await page.reload()
    await page.getByTitle('Transport Settings').click()
    await page.getByTitle('Export 面板').click()

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
    await expect(page.getByTestId('export-loudness-status')).toContainText('导出响度检查：')
  })
})
