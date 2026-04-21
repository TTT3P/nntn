// @ts-check
// End-to-end smoke for today's 4 untested fixes
const { test, expect } = require('@playwright/test');

test.describe('E2E smoke · session 21/04 fixes', () => {

  // ── Fix #1: Multi-SKU output groups in kitchen mode ───────────────
  test('แปรรูป kitchen mode · multi-SKU output groups', async ({ page }) => {
    await page.goto('meat-stock/index.html');
    await page.click('button:has-text("แปรรูป")');
    await page.waitForTimeout(1500); // let switchTab + loadStock finish

    // Default type=kitchen · expect kitchen-groups visible
    await expect(page.locator('#proc-kitchen-groups')).toBeVisible();

    // Initial: 1 group should auto-render
    const initialGroups = await page.locator('#pog-list .pog').count();
    expect(initialGroups, 'initial group should be 1').toBe(1);

    // Click "+ เพิ่มกลุ่ม SKU ผลผลิต"
    await page.click('button:has-text("+ เพิ่มกลุ่ม SKU ผลผลิต")');
    const after = await page.locator('#pog-list .pog').count();
    expect(after, 'should have 2 groups after click').toBe(2);

    // Each group has uniform-weight input
    const uniformInputs = await page.locator('input[id^="pog-uniform-"]').count();
    expect(uniformInputs).toBe(2);

    // Each group has "เติมเท่ากันทั้งหมด" button
    const fillBtns = await page.locator('button:has-text("เติมเท่ากันทั้งหมด")').count();
    expect(fillBtns).toBe(2);
  });

  // ── Fix #2: Uniform-weight fill button ────────────────────────────
  test('kitchen output · เติมเท่ากันทั้งหมด fills all rows', async ({ page }) => {
    await page.goto('meat-stock/index.html');
    await page.click('button:has-text("แปรรูป")');
    await page.waitForTimeout(1500);

    // Set bag count = 3 in first group
    await page.fill('#pog-bags-1', '3');
    await page.waitForTimeout(200);

    // Verify 3 bag rows rendered
    const rows = await page.locator('#pog-bag-rows-1 input[type=number]').count();
    expect(rows).toBe(3);

    // Fill uniform weight = 75 + click button
    await page.fill('#pog-uniform-1', '75');
    await page.click('#pog-1 button:has-text("เติมเท่ากันทั้งหมด")');

    // Verify all 3 rows filled with 75
    const values = await page.locator('#pog-bag-rows-1 input[type=number]').evaluateAll(
      els => els.map(e => /** @type {HTMLInputElement} */(e).value)
    );
    expect(values).toEqual(['75', '75', '75']);

    // Verify group sum = 0.225 kg (3 × 0.075)
    const sumText = await page.locator('#pog-sum-1').textContent();
    expect(sumText).toBe('0.225');
  });

  // ── Fix #3: Stock guard blocks insufficient dispense ──────────────
  test('non-meat stock guard · blocks dispense on qty=0', async ({ page }) => {
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Pick an item known to be 0 (PKG-005 was negative / 0) via SQL call
    const guardFired = await page.evaluate(async () => {
      const sb = window.NNTN_SB_URL;
      const tok = localStorage.getItem('nntn_sb_token');
      // Find PKG-005 item_id
      const itemsRes = await fetch(`${sb}/rest/v1/items?sku=eq.PKG-005&select=id`, {
        headers: { Authorization: 'Bearer ' + tok, apikey: window.NNTN_SB_ANON }
      });
      const items = await itemsRes.json();
      if (!items?.[0]?.id) return { skipped: true };
      // Attempt insert dispense of 99 (should fail guard)
      const insertRes = await fetch(`${sb}/rest/v1/stock_counts`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + tok, apikey: window.NNTN_SB_ANON,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          item_id: items[0].id,
          qty: 0,
          dispense_qty: 99,
          event_type: 'dispense',
          counted_by: 'playwright-guard-test',
          note: 'should fail'
        })
      });
      const errText = await insertRes.text();
      return { status: insertRes.status, err: errText };
    });

    // Should be 4xx with INSUFFICIENT_STOCK in error
    if (!guardFired.skipped) {
      expect(guardFired.status).toBeGreaterThanOrEqual(400);
      expect(guardFired.err || '').toContain('INSUFFICIENT_STOCK');
    }
  });

  // ── Fix #4: JWT auto-refresh on 401 ───────────────────────────────
  test('auth.js · 401 triggers refresh + retry (fetch wrapper)', async ({ page }) => {
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const patched = await page.evaluate(() => !!(window.fetch && window.fetch.__nntnPatched));
    expect(patched, 'fetch must be patched').toBe(true);

    const result = await page.evaluate(async () => {
      const sb = window.NNTN_SB_URL;
      // Corrupt only the current in-memory token · retry logic should refresh
      window.__nntnCurrentToken = 'INVALID.TOKEN.HERE';
      localStorage.setItem('nntn_sb_token', 'INVALID.TOKEN.HERE');
      const res = await fetch(`${sb}/rest/v1/items?select=id&limit=1`, {
        headers: { apikey: window.NNTN_SB_ANON }
      });
      return { status: res.status };
    });

    expect(result.status, 'should be 200 after auto-refresh').toBe(200);
  });

  // ── Fix #5: Draft mismatch detection (hub-delivery) ───────────────
  test('hub-delivery · draft mismatch detection (form stale vs DB fresh)', async ({ page }) => {
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const handled = [];
    page.on('dialog', async d => {
      handled.push({ type: d.type(), msg: d.message().substring(0, 200) });
      await d.dismiss(); // cancel to avoid real submit
    });

    // Simulate: set up a fake draft reference in window._pendingDraftId
    // and mismatch state. Then call submitDelivery.
    await page.evaluate(async () => {
      const sb = window.NNTN_SB_URL;
      const tok = localStorage.getItem('nntn_sb_token');
      // Create a test draft via API with meat_lines=[{bag_id:'99991'}]
      const createRes = await fetch(`${sb}/rest/v1/delivery_drafts`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + tok, apikey: window.NNTN_SB_ANON,
          'Content-Profile': 'stock', 'Accept-Profile': 'stock',
          'Content-Type': 'application/json', 'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          bill_no: 'TEST-MISMATCH-' + Date.now(),
          branch: 'FS', date: new Date().toISOString().split('T')[0],
          meat_lines: [{ bag_id: '99991', item_id: '00000000-0000-0000-0000-000000000000', weight_g: 500 }],
          nm_lines: []
        })
      });
      if (!createRes.ok) return { skipped: true, reason: await createRes.text() };
      const [draft] = await createRes.json();

      // Set form state to DIFFERENT bag_id (simulating stale form)
      window._pendingDraftId = draft.id;
      window.meatSel = window.meatSel || {}
      window.meatSel[99] = { itemId: null, selectedBags: new Set(['99992']) }; // DIFFERENT

      // Fill required form fields
      document.getElementById('dl-bill').value = draft.bill_no;
      document.getElementById('dl-date').value = draft.date;
      document.getElementById('dl-dest').value = 'FS';

      // Trigger submit
      if (typeof submitDelivery === 'function') {
        await submitDelivery();
      }

      // Cleanup test draft
      await fetch(`${sb}/rest/v1/delivery_drafts?id=eq.${draft.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + tok, apikey: window.NNTN_SB_ANON,
                   'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
      });
      return { ok: true };
    });

    await page.waitForTimeout(1000);
    // Expect at least 1 dialog showing mismatch message
    const mismatchDialog = handled.find(d => d.msg.includes('Draft ไม่ตรง') || d.msg.includes('mismatch') || d.msg.includes('ไม่อยู่ใน'));
    expect(mismatchDialog, `expected mismatch dialog · got: ${JSON.stringify(handled)}`).toBeTruthy();
  });
});
