const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '../goal-dashboard.html');

test('goal-dashboard: structure loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(FILE);

  // Header
  await expect(page.locator('h1')).toContainText('Goal Dashboard');
  const dateVal = await page.locator('#today-date').textContent();
  expect(dateVal).not.toBe('—');

  // v2 live-data structure — widget containers exist
  await expect(page.locator('#focus-list')).toBeAttached();
  await expect(page.locator('#proj-tbody')).toBeAttached();
  await expect(page.locator('#commit-tbody')).toBeAttached();

  // Rooms grid still hardcoded (keep)
  expect(await page.locator('.room-card').count()).toBeGreaterThan(0);

  // auth.js + network errors expected on file:// (no server, no Supabase reach)
  const realErrors = errors.filter(e =>
    !e.includes('auth.js') &&
    !e.includes('net::ERR') &&
    !e.includes('Failed to fetch') &&
    !e.includes('goal-dashboard')  // our own loadData catch-log on file://
  );
  expect(realErrors).toHaveLength(0);
});
