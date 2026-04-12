import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Vocal Timing Align', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="transport"]')
  })

  test('supports grid/bar-stretch align and per-clip rollback A/B', async ({ page }) => {
    const tmpAudioPath = path.join(__dirname, 'test-vocal-align.wav')
    const wavData = Buffer.from('RIFF$   WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00', 'binary')
    fs.writeFileSync(tmpAudioPath, wavData)

    const trackLocator = page.locator('.track-grid').first()
    await trackLocator.waitFor()

    const fileContent = fs.readFileSync(tmpAudioPath).toString('base64')

    await trackLocator.evaluate((node, fileData) => {
      const byteCharacters = atob(fileData.content)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'audio/wav' })
      const file = new File([blob], fileData.name, { type: 'audio/wav' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const rect = node.getBoundingClientRect()
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + 100,
        clientY: rect.top + 10,
      })
      node.dispatchEvent(dropEvent)
    }, { content: fileContent, name: 'test-vocal-align.wav' })

    const clip = page.locator('[data-testid^="clip-"]').filter({ hasText: 'test-vocal-align' }).first()
    await expect(clip).toBeVisible()
    await clip.click()

    await expect(page.getByTestId('vocal-timing-align-panel')).toBeVisible()

    await page.getByTestId('vocal-align-grid-btn').click()
    await expect(page.getByTestId('vocal-timing-align-mode')).toContainText('Grid Snap')

    await page.getByTestId('vocal-align-bar-stretch-btn').click()
    await expect(page.getByTestId('vocal-timing-align-mode')).toContainText('Bar Stretch')

    await page.getByTestId('vocal-align-reset-btn').click()
    await expect(page.getByTestId('vocal-timing-align-mode')).toContainText('Off')

    fs.unlinkSync(tmpAudioPath)
  })
})
