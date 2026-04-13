import { test, expect } from '@playwright/test'

test.describe('P9 export naming template', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.clear()
    })
    await page.reload()
  })

  test('supports custom template preview and persists as default', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })
    const input = page.getByTestId('export-naming-template-input')
    const preview = page.getByTestId('export-naming-template-preview-wav')

    await expect(input).toHaveValue('{project}_{bpm}_{date}_{version}')

    await input.fill('{project}-{version}-{date}-{bpm}')
    await expect(preview).toContainText('WAV: Untitled_Project-v1-')

    await expect.poll(async () => {
      const debug = await page.evaluate(() => window.__DAW_DEBUG__)
      return debug?.exportNamingTemplate ?? null
    }).toBe('{project}-{version}-{date}-{bpm}')

    await page.waitForTimeout(120)
    await page.reload()

    await expect(page.getByTestId('export-naming-template-input')).toHaveValue('{project}-{version}-{date}-{bpm}')
  })

  test('builds sanitized unique preview names across export formats', async ({ page }) => {
    await page.getByTestId('project-name-input').fill('My:/ Demo? Project')
    await page.getByTestId('export-naming-template-input').fill('{project}_{date}_{version}')

    const preview = await page.evaluate(() => window.__DAW_DEBUG__?.exportNamingPreview)
    expect(preview).toBeTruthy()

    const names = [preview!.wav, preview!.mp3, preview!.stemsZip, preview!.socialZip, preview!.projectCard]
    for (const name of names) {
      expect(name).toMatch(/^[^\\/:*?"<>|]+\.(wav|mp3|zip|png)$/)
      expect(name.toLowerCase()).toMatch(/my.*demo.*project/)
    }

    expect(preview!.wav).not.toBe(preview!.mp3)
    expect(preview!.stemsZip).toBe(preview!.socialZip)
  })
})
