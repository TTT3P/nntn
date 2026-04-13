// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Smoke tests — public pages ที่ไม่ต้อง login
 * ตรวจว่า:
 *   1. โหลดได้ไม่ 404
 *   2. ไม่มี console error
 *   3. element สำคัญขึ้น
 */

test.describe('Public pages smoke', () => {
  test('login.html — โหลดได้ + ไม่มี console error', async ({ page }) => {
    const errors = [];
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(e.message));

    const res = await page.goto('login.html');
    expect(res?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');

    // element สำคัญ: password input
    await expect(page.locator('input[type="password"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('index.html (hub) — โหลดได้', async ({ page }) => {
    const errors = [];
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(e.message));

    const res = await page.goto('index.html');
    expect(res?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});
