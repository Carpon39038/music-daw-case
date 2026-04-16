import { test, expect } from '@playwright/test'

test.describe('P8 stem export', () => {
  test('renders stem export button and keeps checklist result visible after blocked confirm', async ({ page }) => {
    await page.goto('/')
    await page.getByTitle('Export 面板').click()

    await expect(page.getByTestId('stem-export-btn')).toBeVisible()
    await expect(page.getByTestId('pre-export-checklist-status')).toContainText('未检查')

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain('导出清单校验')
      await dialog.dismiss()
    })

    await page.getByTestId('stem-export-btn').click()

    await expect(page.getByTestId('pre-export-checklist-status')).toContainText('项未通过')
  })
})
