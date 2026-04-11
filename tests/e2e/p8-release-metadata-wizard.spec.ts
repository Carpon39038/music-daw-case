import { test, expect } from '@playwright/test'

test.describe('P8 release metadata wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('/')
  })

  test('blocks card export when required metadata missing', async ({ page }) => {
    const dialogs: string[] = []

    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      if (dialog.type() === 'prompt') {
        await dialog.dismiss()
        return
      }
      await dialog.accept()
    })

    await page.getByTestId('project-card-export-btn').click()

    await expect.poll(() => dialogs.length).toBeGreaterThanOrEqual(2)
    expect(dialogs[0]).toContain('发布元信息（必填 1/4）')
    expect(dialogs[1]).toContain('未填写作品标题，已阻止进入分享卡片导出。')
  })
})
