import { test, expect } from '@playwright/test'

test.describe('P6 Reference A/B', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('imports reference track and toggles monitor source by button and R shortcut', async ({ page }) => {
    const panel = page.locator('[data-testid="reference-ab-panel"]')
    await expect(panel).toBeVisible()

    const toggle = page.locator('[data-testid="reference-ab-toggle"]')
    await expect(toggle).toBeDisabled()

    const input = page.locator('[data-testid="reference-import-input"]')
    await input.setInputFiles('tests/fixtures/p6-reference-1khz.wav')

    await expect(toggle).toBeEnabled()
    await expect(page.locator('[data-testid="reference-match-status"]')).toContainText('p6-reference-1khz.wav')
    await expect(page.locator('[data-testid="reference-current-label"]')).toContainText('Project')

    await toggle.scrollIntoViewIfNeeded()
    await toggle.evaluate((el: HTMLButtonElement) => el.click())
    await expect(page.locator('[data-testid="reference-current-label"]')).toContainText('Reference')

    await page.keyboard.press('r')
    await expect(page.locator('[data-testid="reference-current-label"]')).toContainText('Project')
  })
})
