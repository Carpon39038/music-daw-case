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
})
