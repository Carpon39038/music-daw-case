import { test, expect } from '@playwright/test'

test.describe('P6 Social Publish', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders one-click social publish button', async ({ page }) => {
    await expect(page.getByTestId('social-publish-btn')).toBeVisible()
  })

  test('social publish button is disabled while playing', async ({ page }) => {
    await page.getByTestId('play-btn').click()
    await expect(page.getByTestId('social-publish-btn')).toBeDisabled()
    await page.getByTestId('stop-btn').click()
    await expect(page.getByTestId('social-publish-btn')).toBeEnabled()
  })
})
