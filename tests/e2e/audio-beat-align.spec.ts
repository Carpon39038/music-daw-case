import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Audio Beat Align', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const nextBtn = page.locator('button', { hasText: '下一步' })
    if (await nextBtn.isVisible()) {
      while (await nextBtn.isVisible()) {
        await nextBtn.click()
      }
      await page.locator('button', { hasText: '开始创作' }).click()
    }
  })

  test('supports align modes and shows stretch badge on timeline', async ({ page }) => {
    const tmpAudioPath = path.join(__dirname, 'test-audio-align.wav')
    const wavData = Buffer.from('RIFF$   WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00', 'binary')
    fs.writeFileSync(tmpAudioPath, wavData)

    const trackLocator = page.locator('.track-grid').first()
    await trackLocator.waitFor()

    const fileContent = fs.readFileSync(tmpAudioPath).toString('base64')

    await trackLocator.evaluate((node, fileData) => {
      const byteCharacters = atob(fileData.content)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'audio/wav' })
      const file = new File([blob], fileData.name, { type: 'audio/wav' })

      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: node.getBoundingClientRect().left + 100,
        clientY: node.getBoundingClientRect().top + 10,
      })
      node.dispatchEvent(dropEvent)
    }, { content: fileContent, name: 'test-audio-align.wav' })

    const newClip = page.locator('[data-testid^="clip-"]').filter({ hasText: 'test-audio-align' }).first()
    await expect(newClip).toBeVisible()
    await newClip.click()

    const alignPanel = page.getByTestId('audio-beat-align-panel')
    await expect(alignPanel).toBeVisible()

    await page.getByTestId('audio-align-preserve-duration-btn').click()
    await expect(page.getByTestId('audio-beat-align-ratio')).toContainText('x')

    await expect(newClip).toContainText('Stretch x')

    await page.getByTestId('audio-align-preserve-pitch-btn').click()
    await expect(page.getByTestId('audio-align-preserve-pitch-btn')).toBeVisible()

    fs.unlinkSync(tmpAudioPath)
  })
})
