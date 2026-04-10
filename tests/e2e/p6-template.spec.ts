import { test, expect } from '@playwright/test'

test.describe('P6 Project Template', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('can save and load project template', async ({ page }) => {
    await page.getByTestId('project-name-input').fill('Template Source Project')

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt')
      await dialog.accept('My Beat Template')
    })

    await page.getByTestId('save-template-btn').click()

    const loadSelect = page.getByTestId('load-template-select')
    await expect(loadSelect).toBeEnabled()
    await expect(loadSelect.locator('option')).toContainText(['My Beat Template'])

    await page.getByTestId('project-name-input').fill('Modified Name')

    await loadSelect.selectOption({ label: 'My Beat Template' })

    await expect(page.getByTestId('project-name-input')).toHaveValue('Template Source Project')
  })

  test('can save and browse local project gallery', async ({ page }) => {
    await page.getByTestId('project-name-input').fill('Gallery Demo Project')
    await page.getByTestId('gallery-toggle-btn').click()
    await page.getByTestId('gallery-save-current-btn').click()

    await expect(page.getByTestId('gallery-project-list')).toContainText('Gallery Demo Project')

    await page.getByTestId('project-name-input').fill('Mutated Name')
    const item = page.locator('[data-testid^="gallery-item-"]').first()
    await item.locator('[data-testid^="gallery-load-"]').click()

    await expect(page.getByTestId('project-name-input')).toHaveValue('Gallery Demo Project')
  })
})
