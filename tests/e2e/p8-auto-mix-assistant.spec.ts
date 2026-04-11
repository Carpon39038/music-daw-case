import { test, expect } from '@playwright/test'

test.describe('P8 Auto Mix Assistant', () => {
  test('generates A/B preview and per-suggestion undo for drum/bass/harmony coverage', async ({ page }) => {
    await page.goto('/')

    await page.locator('[data-testid="track-header-track-1"]').click()
    await page.locator('[data-testid="run-auto-mix-btn"]').click()

    await expect(page.locator('[data-testid="auto-mix-coverage-status"]')).toContainText('覆盖鼓/贝斯/和声')

    const suggestionList = page.locator('[data-testid="auto-mix-suggestion-list"]')
    const suggestions = suggestionList.locator('[data-testid^="auto-mix-suggestion-"]')
    await expect(suggestions).toHaveCount(5)

    const summary = page.locator('[data-testid="auto-mix-summary"]')
    await expect(summary).toContainText('5/5 条建议已应用')

    await page.locator('[data-testid="auto-mix-preview-before-btn"]').click()
    await expect(page.locator('[data-testid="auto-mix-preview-before-btn"]')).toHaveClass(/amber/)
    await expect(page.locator('[data-testid="auto-mix-preview-after-btn"]')).not.toHaveClass(/emerald/)

    await page.locator('[data-testid="auto-mix-preview-after-btn"]').click()
    await expect(page.locator('[data-testid="auto-mix-preview-after-btn"]')).toHaveClass(/emerald/)
    await expect(page.locator('[data-testid="auto-mix-preview-before-btn"]')).not.toHaveClass(/amber/)

    const firstToggle = page.locator('[data-testid^="auto-mix-toggle-"]').first()
    await firstToggle.click()

    await expect(summary).not.toContainText('5/5 条建议已应用')
    await expect(summary).toContainText(/\/[0-9]+ 条建议已应用/)
  })
})
