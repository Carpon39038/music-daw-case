import { test, expect } from '@playwright/test'

test.describe('P9 offline export queue', () => {
  test('supports queuing at least 3 tasks, keeps sequential processing, and keeps editor interactive', async ({ page }) => {
    await page.goto('/')
    await page.getByTitle('Export 面板').click()

    await expect(page.getByTestId('offline-export-queue-panel')).toBeVisible()
    await expect(page.getByTestId('offline-export-queue-panel')).toContainText('暂无任务')

    await page.getByTestId('audio-export-btn').click()
    await page.getByTestId('mp3-export-btn').click()
    await page.getByTestId('stem-export-btn').click()

    const queueList = page.getByTestId('offline-export-queue-list')
    await expect(queueList).toContainText('#1 WAV')
    await expect(queueList).toContainText('#2 MP3')
    await expect(queueList).toContainText('#3 STEM')

    // 导出中可继续编辑工程
    await page.getByTestId('add-track-btn').click()
    await expect(page.locator('[data-testid^="track-header-"]')).toHaveCount(5)

    // 队列串行：同一时刻最多一个 processing
    await expect.poll(async () => {
      return page.evaluate(() => {
        const debug = (window as unknown as { __DAW_DEBUG__?: { exportQueue?: Array<{ status: string }> } }).__DAW_DEBUG__
        const queue = debug?.exportQueue ?? []
        const processingCount = queue.filter((item) => item.status === 'processing').length
        return processingCount
      })
    }, { timeout: 15000 }).toBeLessThanOrEqual(1)

    // 队列项有进度变化（至少第一项进入 processing 或完成）
    await expect.poll(async () => {
      return page.evaluate(() => {
        const debug = (window as unknown as { __DAW_DEBUG__?: { exportQueue?: Array<{ progress: number; status: string }> } }).__DAW_DEBUG__
        const first = debug?.exportQueue?.[0]
        if (!first) return 0
        return first.progress
      })
    }, { timeout: 15000 }).toBeGreaterThan(0)
  })
})
