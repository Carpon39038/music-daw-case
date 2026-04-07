import { test, expect } from '@playwright/test'

test.describe('Master EQ features', () => {
  test('should adjust master EQ Low, Mid, High and persist state', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => document.querySelectorAll('details').forEach((d: HTMLDetailsElement) => d.open = true));

    // Wait for the app to be ready
    await page.waitForSelector(".daw-root")

    // Find the Master EQ sliders
    const lowEq = page.getByTestId('master-eq-low')
    const midEq = page.getByTestId('master-eq-mid')
    const highEq = page.getByTestId('master-eq-high')

    // Set some EQ values
    await lowEq.fill('5')
    await midEq.fill('-3')
    await highEq.fill('8')

    // Verify values using window.__DAW_DEBUG__
    const eqState = await page.evaluate(() => {
      // @ts-expect-error inject window debug
      return window.__DAW_DEBUG__.masterEQ
    })

    expect(eqState.low).toBe(5)
    expect(eqState.mid).toBe(-3)
    expect(eqState.high).toBe(8)

    // Reload to verify persistence
    await page.reload()
    await page.waitForSelector(".daw-root")

    // The EQ values should have persisted
    const lowEqValue = await page.getByTestId('master-eq-low').inputValue()
    const midEqValue = await page.getByTestId('master-eq-mid').inputValue()
    const highEqValue = await page.getByTestId('master-eq-high').inputValue()

    expect(lowEqValue).toBe('5')
    expect(midEqValue).toBe('-3')
    expect(highEqValue).toBe('8')
  })
})
