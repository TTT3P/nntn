// @ts-check
/**
 * QA spec — SOP Self-Service System (wireframes v2 · 2026-04-23)
 * Tests: admin-sop.html · sop-review.html · print-recipe.html
 *
 * Runs via file:// — no Supabase auth in CI.
 * Tests verify structure, brand, key elements, print media, no JS errors.
 *
 * Groups:
 *   A. admin-sop.html — structure + brand + form elements (1-5)
 *   B. admin-sop.html — interactive elements + status states (6-8)
 *   C. sop-review.html — structure + filter bar + cards (9-13)
 *   D. sop-review.html — drawer + action buttons (14-15)
 *   E. print-recipe.html — structure + print controls (16-19)
 *   F. print-recipe.html — print media query + A4 doc (20-22)
 *   G. Cross-page — nav links present on all pages (23-25)
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const ADMIN_SOP   = 'file://' + path.resolve(__dirname, '../wireframes/admin-sop.html');
const SOP_REVIEW  = 'file://' + path.resolve(__dirname, '../wireframes/sop-review.html');
const PRINT_RCP   = 'file://' + path.resolve(__dirname, '../wireframes/print-recipe.html');

async function load(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

// ══════════════════════════════════════
// A. admin-sop.html — structure + brand
// ══════════════════════════════════════

test.describe('A · admin-sop · structure + brand', () => {

  test('A1 · page loads without critical JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await load(page, ADMIN_SOP);
    const critical = errors.filter(e =>
      !e.includes('net::ERR_') &&
      !e.includes('Failed to fetch') &&
      !e.includes('ERR_FILE_NOT_FOUND')
    );
    expect(critical, `JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('A2 · header background is exact brand green #005036', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const bg = await page.locator('header').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(0, 80, 54)');
  });

  test('A3 · header shows SOP title', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const text = await page.locator('header h1').textContent();
    expect(text).toContain('SOP');
  });

  test('A4 · user badge element present', async ({ page }) => {
    await load(page, ADMIN_SOP);
    await expect(page.locator('#userBadge')).toBeVisible();
  });

  test('A5 · status badge present with class "draft"', async ({ page }) => {
    await load(page, ADMIN_SOP);
    await expect(page.locator('#currentStatusBadge')).toBeVisible();
    const cls = await page.locator('#currentStatusBadge').getAttribute('class');
    expect(cls).toContain('draft');
  });

});

// ══════════════════════════════════════
// B. admin-sop.html — form elements
// ══════════════════════════════════════

test.describe('B · admin-sop · form elements', () => {

  test('B6 · recipe search input present and focusable', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const input = page.locator('#recipeSearch');
    await expect(input).toBeVisible();
    await input.click();
    await expect(input).toBeFocused();
  });

  test('B7 · steps textarea present with min rows', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const ta = page.locator('#stepsTextarea');
    await expect(ta).toBeVisible();
    const rows = await ta.getAttribute('rows');
    expect(parseInt(rows || '0')).toBeGreaterThanOrEqual(15);
  });

  test('B8 · status select has 7 options (all states)', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const options = await page.locator('#statusSelect option').count();
    expect(options).toBe(7);
  });

  test('B9 · save draft button present', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const btns = page.locator('.action-bar .btn');
    await expect(btns.first()).toBeVisible();
  });

  test('B10 · submit button disabled by default (no recipe selected)', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeDisabled();
  });

});

// ══════════════════════════════════════
// C. sop-review.html — structure + filter
// ══════════════════════════════════════

test.describe('C · sop-review · structure + filter', () => {

  test('C11 · page loads without critical JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await load(page, SOP_REVIEW);
    const critical = errors.filter(e =>
      !e.includes('net::ERR_') &&
      !e.includes('Failed to fetch') &&
      !e.includes('ERR_FILE_NOT_FOUND')
    );
    expect(critical, `JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('C12 · header background is exact brand green #005036', async ({ page }) => {
    await load(page, SOP_REVIEW);
    const bg = await page.locator('header').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(0, 80, 54)');
  });

  test('C13 · stats bar shows 4 stat items', async ({ page }) => {
    await load(page, SOP_REVIEW);
    const count = await page.locator('.stat-item').count();
    expect(count).toBe(4);
  });

  test('C14 · filter pills present — at least 5', async ({ page }) => {
    await load(page, SOP_REVIEW);
    const pills = await page.locator('.filter-pill').count();
    expect(pills).toBeGreaterThanOrEqual(5);
  });

  test('C15 · queue cards rendered from mock data', async ({ page }) => {
    await load(page, SOP_REVIEW);
    // Wait for JS to render mock cards
    await page.waitForFunction(() => document.querySelectorAll('.queue-card').length > 0);
    const cards = await page.locator('.queue-card').count();
    expect(cards).toBeGreaterThan(0);
  });

});

// ══════════════════════════════════════
// D. sop-review.html — drawer
// ══════════════════════════════════════

test.describe('D · sop-review · drawer', () => {

  test('D16 · clicking a card opens the drawer', async ({ page }) => {
    await load(page, SOP_REVIEW);
    await page.waitForFunction(() => document.querySelectorAll('.queue-card').length > 0);
    await page.locator('.queue-card').first().click();
    await expect(page.locator('.drawer-overlay')).toHaveClass(/open/);
  });

  test('D17 · drawer has 4 action buttons', async ({ page }) => {
    await load(page, SOP_REVIEW);
    await page.waitForFunction(() => document.querySelectorAll('.queue-card').length > 0);
    await page.locator('.queue-card').first().click();
    const btns = await page.locator('.action-btn').count();
    expect(btns).toBe(4);
  });

});

// ══════════════════════════════════════
// E. print-recipe.html — structure
// ══════════════════════════════════════

test.describe('E · print-recipe · structure', () => {

  test('E18 · page loads without critical JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await load(page, PRINT_RCP);
    const critical = errors.filter(e =>
      !e.includes('net::ERR_') &&
      !e.includes('Failed to fetch') &&
      !e.includes('ERR_FILE_NOT_FOUND')
    );
    expect(critical, `JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('E19 · header background is exact brand green #005036', async ({ page }) => {
    await load(page, PRINT_RCP);
    const bg = await page.locator('header').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(0, 80, 54)');
  });

  test('E20 · recipe selector dropdown present', async ({ page }) => {
    await load(page, PRINT_RCP);
    await expect(page.locator('#recipeSelector')).toBeVisible();
  });

  test('E21 · print button present and initially disabled', async ({ page }) => {
    await load(page, PRINT_RCP);
    await expect(page.locator('#printBtn')).toBeVisible();
    await expect(page.locator('#printBtn')).toBeDisabled();
  });

});

// ══════════════════════════════════════
// F. print-recipe.html — print media + A4
// ══════════════════════════════════════

test.describe('F · print-recipe · print media + A4', () => {

  test('F22 · A4 doc element exists in DOM', async ({ page }) => {
    await load(page, PRINT_RCP);
    await expect(page.locator('.a4-doc')).toBeAttached();
  });

  test('F23 · @media print hides header (emulate print)', async ({ page }) => {
    await load(page, PRINT_RCP);
    await page.emulateMedia({ media: 'print' });
    // header should be display:none in print
    const headerVisible = await page.locator('header').evaluate(
      el => window.getComputedStyle(el).display
    );
    expect(headerVisible).toBe('none');
  });

  test('F24 · ingredient table skeleton present', async ({ page }) => {
    await load(page, PRINT_RCP);
    await expect(page.locator('.ing-table')).toBeAttached();
    await expect(page.locator('#ingTableBody')).toBeAttached();
  });

});

// ══════════════════════════════════════
// G. Cross-page — nav links
// ══════════════════════════════════════

test.describe('G · cross-page · nav links', () => {

  test('G25 · admin-sop has nav link to sop-review.html', async ({ page }) => {
    await load(page, ADMIN_SOP);
    const links = await page.locator('nav a').allTextContents();
    const hrefs = await page.locator('nav a').evaluateAll(els => els.map(e => e.getAttribute('href')));
    expect(hrefs.some(h => h && h.includes('sop-review'))).toBeTruthy();
  });

  test('G26 · sop-review has nav link to admin-sop.html', async ({ page }) => {
    await load(page, SOP_REVIEW);
    const hrefs = await page.locator('nav a').evaluateAll(els => els.map(e => e.getAttribute('href')));
    expect(hrefs.some(h => h && h.includes('admin-sop'))).toBeTruthy();
  });

  test('G27 · print-recipe has nav link to sop-review.html', async ({ page }) => {
    await load(page, PRINT_RCP);
    const hrefs = await page.locator('nav a').evaluateAll(els => els.map(e => e.getAttribute('href')));
    expect(hrefs.some(h => h && h.includes('sop-review'))).toBeTruthy();
  });

});
