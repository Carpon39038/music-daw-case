import { test, expect } from '@playwright/test'

test.describe('Shortcut Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should open shortcut panel by clicking the ? button', async ({ page }) => {
    const trigger = page.locator('[data-testid="shortcut-panel-trigger"]')
    await expect(trigger).toBeVisible()
    
    await trigger.click()
    
    // Panel should be visible
    const panelTitle = page.locator('text=键盘快捷键')
    await expect(panelTitle).toBeVisible()
    
    // Close panel
    const closeBtn = page.locator('button:has-text("✕")')
    await closeBtn.click()
    await expect(panelTitle).not.toBeVisible()
  })

  test('should toggle shortcut panel via ? key', async ({ page }) => {
    // Press '?'
    await page.locator('body').click(); await page.keyboard.type('?')
    
    // Panel should be visible
    const panelTitle = page.locator('text=键盘快捷键')
    await expect(panelTitle).toBeVisible()
    
    // Press 'Escape' to close
    await page.keyboard.press('Escape')
    await expect(panelTitle).not.toBeVisible()
  })
})
