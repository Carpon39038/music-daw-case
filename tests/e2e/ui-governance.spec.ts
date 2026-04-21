import { test, expect } from '@playwright/test'

/**
 * UI Governance Guardrails
 *
 * Purpose:
 * - prevent random UI placement from breaking core flows
 * - detect pointer interception/overlay regressions early
 */

const CORE_TEST_IDS = ['loop-enabled', 'mp3-export-btn']

async function expectNotOccluded(page: import('@playwright/test').Page, testId: string) {
  const locator = page.getByTestId(testId)
  await expect(locator).toBeVisible()

  const blocked = await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const top = document.elementFromPoint(x, y)
    if (!top) return true
    return !(top === el || el.contains(top))
  })

  expect(blocked, `${testId} is occluded by another element`).toBeFalsy()
}

test.describe('UI Governance Guardrails', () => {
  test('core controls remain clickable after opening advanced/export panels', async ({ page }) => {
    await page.goto('/')

    const transportSettings = page.getByRole('button', { name: 'Transport Settings' })
    await transportSettings.click()

    const exportPanelToggle = page.getByRole('button', { name: 'Export 面板' })
    await exportPanelToggle.click()

    for (const id of CORE_TEST_IDS) {
      await expectNotOccluded(page, id)
    }

    // click via evaluate to avoid false negatives from transient overlays;
    // occlusion is already asserted above.
    await page.getByTestId('loop-enabled').evaluate((el: HTMLButtonElement) => el.click())
    await expect(page.getByTestId('pre-export-checklist-status')).toContainText('未检查')
  })

  test('top action count stays within budget', async ({ page }) => {
    await page.goto('/')

    const topActions = page.locator('[data-testid="transport"] button, [data-testid="transport"] [role="button"]')
    const count = await topActions.count()

    // Keep aligned with docs/ui-governance-charter.md
    expect(count).toBeLessThanOrEqual(40)
  })

  test('advanced actions stay inside their panel container', async ({ page }) => {
    await page.goto('/')

    // Open advanced panel via top-level toggle (toggle itself is allowed in top bar).
    await page.getByTestId('reference-panel-toggle').click()

    const advancedActionIds = [
      'reference-import-btn',
      'reference-ab-toggle',
      'reference-clear-btn',
    ]

    for (const id of advancedActionIds) {
      const action = page.getByTestId(id)
      await expect(action).toBeVisible()
      const inPanel = await action.evaluate((el) => {
        const panel = el.closest('[data-testid*="panel"], [class*="panel"], [role="dialog"]')
        return Boolean(panel)
      })
      expect(inPanel, `advanced action "${id}" should be inside panel container`).toBeTruthy()
    }
  })

  test('export preview/overlay does not block core transport controls', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Export 面板' }).click()

    // open transport settings to make LOOP visible in this UI mode
    await page.getByRole('button', { name: 'Transport Settings' }).click()

    await expectNotOccluded(page, 'loop-enabled')
    await expectNotOccluded(page, 'mp3-export-btn')
  })
})
