import { test, expect } from '@playwright/test'

test.describe('P9 pre-export auto fix', () => {
  test('auto-fix repairs fixable checklist items and supports per-item undo', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Transport Settings' }).click()
    await expect(page.getByTestId('loop-enabled')).toBeVisible()

    const exportToggle = page.getByRole('button', { name: 'Export 面板' })
    for (let i = 0; i < 3; i += 1) {
      await exportToggle.click()
      if (await page.getByTestId('pre-export-auto-fix-panel').isVisible()) break
    }

    await expect(page.getByTestId('mp3-export-btn')).toBeVisible()
    await page.getByTestId('loop-enabled').click()

    await expect(page.getByTestId('pre-export-checklist-status')).toContainText('未检查')
    await page.getByTestId('pre-export-auto-fix-btn').first().evaluate((el: HTMLButtonElement) => el.click())

    await expect(page.getByTestId('project-name-input')).not.toHaveValue('Untitled Project')
    await expect(page.getByTestId('loop-length')).toBeDisabled()

    const summary = page.getByTestId('pre-export-auto-fix-summary')
    await expect(summary).toContainText('可修复项通过率：100%')

    await page.getByTestId('pre-export-auto-fix-undo-loop-export-mismatch').first().evaluate((el: HTMLButtonElement) => el.click())
    await expect(summary).toContainText('可修复项通过率：50%')
  })
})
