// @ts-check
const { test, expect } = require('@playwright/test');

// Case 2 smoke: verify 401 auto-refresh works on expired JWT
test('auth: 401 on REST triggers refresh + retry', async ({ page }) => {
  await page.goto('hub-delivery.html');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  // Inspect auth.js was applied: wrapped fetch + refresh flow reachable
  const instrumented = await page.evaluate(() => {
    return {
      patched: !!(window.fetch && window.fetch.__nntnPatched),
      hasToken: !!localStorage.getItem('nntn_sb_token'),
      hasRefresh: !!localStorage.getItem('nntn_sb_refresh'),
      currentTok: !!window.__nntnCurrentToken,
    };
  });
  expect(instrumented.patched, 'fetch must be patched').toBe(true);
  expect(instrumented.hasToken, 'token must exist after auth.setup').toBe(true);

  // Simulate expired token: corrupt current token → REST call should get 401 → refresh + retry succeeds
  const result = await page.evaluate(async () => {
    const SB = window.NNTN_SB_URL;
    // Corrupt the current token to force 401
    const original = localStorage.getItem('nntn_sb_token');
    window.__nntnCurrentToken = 'INVALID.TOKEN.HERE';
    localStorage.setItem('nntn_sb_token', 'INVALID.TOKEN.HERE');

    // Hit a REST endpoint · should 401 → wrapped fetch auto-refreshes → retry with fresh token → 200
    let outcome = { ok: false, status: null, retried: false, after: null };
    try {
      const res = await fetch(`${SB}/rest/v1/items?select=id&limit=1`, {
        headers: { 'apikey': window.NNTN_SB_ANON }
      });
      outcome.status = res.status;
      outcome.ok = res.ok;
      outcome.retried = true; // if we got here without throw, retry path was taken
    } catch (e) {
      outcome.err = String(e);
    }
    outcome.after = (window.__nntnCurrentToken || '').slice(0, 10);
    return outcome;
  });

  // After 401 refresh+retry, should succeed with 200
  expect(result.status, `final status should be 200 after auto-refresh: ${JSON.stringify(result)}`).toBe(200);
});

// Case 1 smoke: page loads, no console errors on hub-delivery
test('hub-delivery: page loads clean (no JWT errors)', async ({ page }) => {
  const jwtErrors = [];
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.toLowerCase().includes('jwt') || t.includes('PGRST303')) jwtErrors.push(t);
    }
  });

  await page.goto('hub-delivery.html');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await expect(page.locator('#dl-bill')).toBeVisible();
  expect(jwtErrors, `JWT errors: ${jwtErrors.join(' | ')}`).toHaveLength(0);
});
