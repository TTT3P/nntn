// @ts-check
const { test, expect } = require('@playwright/test');

test('hub-delivery loads without console errors + history tab renders', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('hub-delivery.html');
  await page.waitForLoadState('networkidle');

  await page.click('#tab-btn-history');

  // Wait until history pane resolves to either bill list or empty-state.
  // Avoids brittle hardcoded-bill assertion + race on slow data fetch.
  await page.waitForSelector('.hist-group, .hist-empty', { timeout: 15_000 });

  const firstHeader = page.locator('.hist-header').first();
  if (await firstHeader.count() > 0) {
    await firstHeader.click();
    await page.waitForTimeout(300);
  }

  await page.click('#tab-btn-drafts');
  await page.waitForTimeout(1000);

  // Filter out static-asset 404 noise · only fail on real JS/page errors.
  const realErrors = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('Failed to load resource')
  );
  expect(realErrors).toEqual([]);
});
