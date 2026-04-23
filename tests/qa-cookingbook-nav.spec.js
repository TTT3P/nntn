const { test, expect } = require('@playwright/test');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '../cookingbook/index.html');

test('cookingbook index renders with SOP nav', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  await page.goto(url);
  await expect(page.locator('text=กรอก SOP')).toBeVisible();
  await expect(page.locator('text=Review SOP')).toBeVisible();
  await expect(page.locator('text=Print Recipe (A4)')).toBeVisible();
  await expect(page.locator('a[href="../admin-sop.html"]')).toHaveCount(1);
  await expect(page.locator('a[href="../sop-review.html"]')).toHaveCount(1);
  await expect(page.locator('a[href="../print-recipe.html"]')).toHaveCount(1);
  // Filter out known local-file 404s from auth.js + fonts which are expected in file:// context
  const realErrors = errors.filter(e =>
    !/favicon|auth\.js|fonts\.googleapis|net::ERR_FILE_NOT_FOUND/i.test(e)
  );
  expect(realErrors).toEqual([]);
});
