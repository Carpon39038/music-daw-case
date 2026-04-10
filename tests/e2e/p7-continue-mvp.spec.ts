import { test, expect } from '@playwright/test'

test.describe('P7 Continue MVP', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('track-header-track-1').click()
  })

  test('shows 3 continue candidates and appends notes for each profile', async ({ page }) => {
    await expect(page.getByTestId('continue-mvp-panel')).toBeVisible()

    const getClipCount = async () => page.locator('.clip').count()

    const initialCount = await getClipCount()

    await page.getByTestId('continue-conservative-btn').click()
    const afterConservative = await getClipCount()
    expect(afterConservative).toBeGreaterThan(initialCount)

    await page.getByTestId('continue-balanced-btn').click()
    const afterBalanced = await getClipCount()
    expect(afterBalanced).toBeGreaterThan(afterConservative)

    await page.getByTestId('continue-bold-btn').click()
    const afterBold = await getClipCount()
    expect(afterBold).toBeGreaterThan(afterBalanced)
  })

  test('supports reroll and lock rhythm / lock pitch options', async ({ page }) => {
    await expect(page.getByTestId('continue-mvp-panel')).toBeVisible()

    await expect(page.getByTestId('continue-reroll-btn')).toBeVisible()
    await page.getByTestId('continue-reroll-btn').click()

    await page.getByTestId('continue-lock-rhythm').check()
    await expect(page.getByTestId('continue-lock-rhythm')).toBeChecked()

    await page.getByTestId('continue-lock-pitch').check()
    await expect(page.getByTestId('continue-lock-pitch')).toBeChecked()

    const countBeforeLockedRun = await page.locator('.clip').count()
    await page.getByTestId('continue-balanced-btn').click()
    const countAfterLockedRun = await page.locator('.clip').count()
    expect(countAfterLockedRun).toBeGreaterThan(countBeforeLockedRun)
  })
})
