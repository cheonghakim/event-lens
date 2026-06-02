/**
 * TraceScope — axe-core accessibility audit
 *
 * Run:
 *   npm run a11y:install   (first time only — downloads Chromium)
 *   npm run build:demo     (if docs/ is stale)
 *   npm run a11y
 *
 * This test file is discovered by Playwright via playwright.config.js.
 * It builds and previews the demo page, then runs axe-core against:
 *   - The initial page load (grid with 5,000 events, dark theme)
 *   - After density is switched to compact
 *   - After an event row is selected (detail panel opens)
 *   - After the Raw Log tab is activated in the detail panel
 *
 * WCAG target: 2.1 AA
 * Baseline: zero critical/serious violations on the above states.
 */

import { test, expect }     from '@playwright/test'
import { checkA11y, injectAxe, getViolations } from 'axe-playwright'

const BASE = '/trace-scope/'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run axe on the current page state, fail if critical or serious violations exist.
 * Returns the full violation list for informational logging.
 */
async function auditPage(page, label) {
  const violations = await getViolations(page, null, {
    axeOptions: {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    },
  })

  // Log all violations (informational)
  if (violations.length) {
    console.log(`\n[${label}] ${violations.length} violation(s):`)
    for (const v of violations) {
      const nodes = v.nodes.map(n => n.target.join(', ')).join(' | ')
      console.log(`  [${v.impact}] ${v.id}: ${v.description}`)
      console.log(`    Affected: ${nodes}`)
      console.log(`    Help: ${v.helpUrl}`)
    }
  }

  // Fail only on critical or serious violations
  const blocking = violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
  expect(blocking, `[${label}] Found ${blocking.length} critical/serious a11y violation(s)`).toHaveLength(0)

  return violations
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('TraceScope — WCAG 2.1 AA audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
    // Wait for the grid to render at least one row
    await page.waitForSelector('.ts-row', { timeout: 10000 })
    await injectAxe(page)
  })

  test('initial page load — dark theme, 5,000 events', async ({ page }) => {
    await page.waitForTimeout(500)  // allow virtual scroll to settle
    await auditPage(page, 'Initial load')
  })

  test('compact density — row height 24px', async ({ page }) => {
    await page.click('#btn-density')
    await page.waitForTimeout(300)
    await auditPage(page, 'Compact density')
  })

  test('event row selected — detail panel open, parsedFields tab', async ({ page }) => {
    // Click first visible row
    const firstRow = page.locator('.ts-row').first()
    await firstRow.click()
    await page.waitForSelector('.ts-detail-panel--open', { timeout: 5000 })
    await page.waitForTimeout(300)
    await auditPage(page, 'Detail panel — parsedFields')
  })

  test('detail panel — raw log tab', async ({ page }) => {
    const firstRow = page.locator('.ts-row').first()
    await firstRow.click()
    await page.waitForSelector('.ts-detail-panel--open', { timeout: 5000 })

    // Click the raw log tab
    const rawLogTab = page.locator('.ts-tab-btn', { hasText: '원문' })
    await rawLogTab.click()
    await page.waitForTimeout(200)
    await auditPage(page, 'Detail panel — rawLog tab')
  })

  test('detail panel — timeline tab', async ({ page }) => {
    const firstRow = page.locator('.ts-row').first()
    await firstRow.click()
    await page.waitForSelector('.ts-detail-panel--open', { timeout: 5000 })

    const timelineTab = page.locator('.ts-tab-btn', { hasText: '이력' })
    await timelineTab.click()
    await page.waitForTimeout(200)
    await auditPage(page, 'Detail panel — timeline tab')
  })

  test('keyboard navigation — arrow keys, Enter, Escape', async ({ page }) => {
    // Focus the grid body
    await page.locator('.ts-grid-body').click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.ts-detail-panel--open', { timeout: 5000 })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await auditPage(page, 'Keyboard navigation')
  })

  test('light theme', async ({ page }) => {
    await page.click('#btn-theme')
    await page.waitForTimeout(300)
    await auditPage(page, 'Light theme')
  })
})
