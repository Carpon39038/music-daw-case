import { test, expect } from '@playwright/test'

test.describe('P8 release metadata wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('/')
    await page.getByTitle('Export 面板').click()
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

  test('requires publish wizard 2.0 fields and persists template for next export', async ({ page }) => {
    const dialogs: string[] = []
    const prompts = [
      'Song A',
      'Alice',
      'cover-a.png',
      'lofi, chill',
      'Song A, Song A Live, Song A Remix',
      'A dreamy neon cover line',
      '短视频：30秒带你听完 Song A\n播客：这一期聊聊 Song A 的创作\n音乐平台：Song A 已上线，欢迎收藏',
      'Song B',
      'Alice 2',
      'cover-b.png',
      'edm, upbeat',
    ]

    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      if (dialog.type() === 'prompt') {
        const next = prompts.shift() ?? ''
        await dialog.accept(next)
        return
      }
      await dialog.accept()
    })

    await page.getByTestId('project-card-export-btn').click()

    await expect.poll(() => dialogs.filter((msg) => msg.includes('发布向导 2.0')).length).toBe(3)

    dialogs.length = 0
    await page.getByTestId('project-card-export-btn').click()

    const publishWizardPrompts = dialogs.filter((msg) => msg.includes('发布向导 2.0'))
    expect(publishWizardPrompts.length).toBe(0)
    expect(dialogs.filter((msg) => msg.includes('发布元信息（必填')).length).toBe(0)

    const state = await page.evaluate(() => {
      const raw = window.localStorage.getItem('music-daw-case.store.v1')
      return raw ? JSON.parse(raw) : null
    })

    const project = state?.state?.project

    expect(project?.publishWizardTemplate?.titleCandidates?.length).toBeGreaterThanOrEqual(3)
    expect(project?.publishWizardTemplate?.coverCopy).toContain('dreamy neon')
    expect(project?.publishWizardTemplate?.platformDescriptions?.shortVideo).toContain('30秒')
  })
})
