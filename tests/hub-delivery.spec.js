// @ts-check
const { test, expect } = require('@playwright/test');

test('hub-delivery loads without console errors + history shows bills', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('hub-delivery.html');
  await page.waitForLoadState('networkidle');

  // Switch to history tab
  await page.click('#tab-btn-history');
  await page.waitForTimeout(1500);

  // Expect at least one history bill rendered
  const billCount = await page.locator('.hist-group').count();
  expect(billCount).toBeGreaterThan(0);

  // Expect specific recovered bill
  await expect(page.getByText('NT-20260418-01').first()).toBeVisible();

  // Click print button doesn't throw (opens new window — just verify click works)
  // Click expand ▼ on first bill
  await page.locator('.hist-header').first().click();
  await page.waitForTimeout(300);

  // Switch to drafts tab
  await page.click('#tab-btn-drafts');
  await page.waitForTimeout(1000);

  expect(errors.filter(e => !e.includes('favicon'))).toEqual([]);
});
