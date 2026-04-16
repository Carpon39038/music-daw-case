import { test, expect } from '@playwright/test'

test.describe('P8 pre-export checklist', () => {
  test('blocks one-click export when checklist has failures but allows ignore-and-continue path', async ({ page }) => {
    await page.goto('/')
    await page.getByTitle('Export 面板').click()

    await expect(page.getByTestId('pre-export-checklist-status')).toContainText('未检查')

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain('导出清单校验')
      await dialog.dismiss()
    })

    await page.getByTestId('mp3-export-btn').click()

    await expect(page.getByTestId('pre-export-checklist-status')).toContainText('项未通过')
  })
})
