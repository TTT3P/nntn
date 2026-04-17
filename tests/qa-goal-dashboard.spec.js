const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '../goal-dashboard.html');

test('goal-dashboard: loads all sections without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(FILE);

  await expect(page.locator('h1')).toContainText('Goal Dashboard');
  const dateVal = await page.locator('#today-date').textContent();
  expect(dateVal).not.toBe('—');

  await expect(page.locator('.commit-row')).toHaveCount(7);
  await expect(page.locator('.focus-item')).toHaveCount(3);
  await expect(page.locator('.room-card')).toHaveCount(8);

  // auth.js error expected on file:// (no server) — filter it out
  const realErrors = errors.filter(e => !e.includes('auth.js') && !e.includes('net::ERR'));
  expect(realErrors).toHaveLength(0);
});
