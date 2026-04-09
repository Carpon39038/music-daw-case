import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Audio Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Skip onboarding if it exists
    const nextBtn = page.locator('button', { hasText: '下一步' })
    if (await nextBtn.isVisible()) {
      while (await nextBtn.isVisible()) {
        await nextBtn.click()
      }
      await page.locator('button', { hasText: '开始创作' }).click()
    }
  })

  test('can drop an audio file onto a track to import it', async ({ page }) => {
    // 准备一个临时的 WAV 文件
    const tmpAudioPath = path.join(__dirname, 'test-audio.wav')
    // A tiny valid WAV header + empty data
    const wavData = Buffer.from('RIFF$   WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00', 'binary')
    fs.writeFileSync(tmpAudioPath, wavData)

    // Wait for timeline tracks to be visible
    const trackLocator = page.locator('.track-grid').first()
    await trackLocator.waitFor()

    // Setup DataTransfer to drop the file
    const fileContent = fs.readFileSync(tmpAudioPath).toString('base64');

    await trackLocator.evaluate((node, fileData) => {
      // Decode base64 and create a Blob, then a File
      const byteCharacters = atob(fileData.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      const file = new File([blob], fileData.name, { type: 'audio/wav' });

      // Trigger dragenter, dragover, drop
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: node.getBoundingClientRect().left + 100,
        clientY: node.getBoundingClientRect().top + 10
      });
      node.dispatchEvent(dropEvent);
    }, { content: fileContent, name: 'test-audio.wav' });

    // Wait for the clip to appear
    const newClip = page.locator('[data-testid^="clip-"]').filter({ hasText: 'test-audio' }).first()
    await expect(newClip).toBeVisible()

    // Cleanup
    fs.unlinkSync(tmpAudioPath)
  })
})
