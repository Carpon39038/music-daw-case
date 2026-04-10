import { test, expect } from '@playwright/test'

test.describe('P7 project card export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders local project card export button', async ({ page }) => {
    await expect(page.getByTestId('project-card-export-btn')).toBeVisible()
  })

  test('project card export button is disabled while playing', async ({ page }) => {
    await page.getByTestId('play-btn').click()
    await expect(page.getByTestId('project-card-export-btn')).toBeDisabled()
    await page.getByTestId('stop-btn').click()
    await expect(page.getByTestId('project-card-export-btn')).toBeEnabled()
  })

  test('project card export unlocks first export achievement', async ({ page }) => {
    await expect(page.getByTestId('achievement-badge-firstExport')).toContainText('⬜')

    await page.getByTestId('project-card-export-btn').click()

    await expect(page.getByTestId('achievement-badge-firstExport')).toContainText('🏅')
  })
})
