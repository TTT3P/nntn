// @ts-check
// Regression tests for the 2026-08-10 short-ship bug (15 bags packed, only 10
// delivered — 5 silently dropped by a stray re-fire of onMeatItemChange's SKU
// select, with no error anywhere in the chain).
//
// These tests exercise the page's in-browser JS state (meatSel, onMeatItemChange,
// checkMeatBagInvariant) directly via page.evaluate — they do NOT touch the real
// submit_delivery RPC or any live stock data, since this repo's stock writes are
// production-real (V1 sacred, additive-only). Scope is limited to the client-side
// selection/guard logic that caused the bug.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Seed the cached test-session token into localStorage BEFORE any page script
// runs, so auth.js's synchronous redirect-to-login gate doesn't fire. Value is
// read from the git-ignored local auth cache and never logged/printed — these
// tests only need auth.js to fall through past its gate; they don't touch any
// authenticated data (mtItems/cwBags are stubbed with fake ids in-test).
async function seedAuth(page) {
  const authPath = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');
  if (!fs.existsSync(authPath)) return;
  const data = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const origin = (data.origins || [])[0];
  if (!origin) return;
  const kv = {};
  for (const e of origin.localStorage) kv[e.name] = e.value;
  // Force expires far in the future so auth.js's near-expiry refresh branch
  // (which requires a live network round-trip) never triggers.
  kv.nntn_sb_expires = String(Math.floor(Date.now() / 1000) + 3600);
  await page.addInitScript((entries) => {
    for (const [k, v] of entries) localStorage.setItem(k, v);
  }, Object.entries(kv));
}

test.describe('hub-delivery meat-block selection guards', () => {

  test('onMeatItemChange: same-value re-fire does NOT wipe selectedBags', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => {
      addMeatBlock();
      const n = meatBlockCount;

      // Simulate a real prior selection: SKU chosen, 3 bags picked.
      meatSel[n].itemId = 'FAKE-ITEM-1';
      meatSel[n].selectedBags = new Set(['101', '102', '103']);

      const sel = document.getElementById(`mb-sku-${n}`);
      // Add a matching option so sel.value can actually be set to it.
      const opt = document.createElement('option');
      opt.value = 'FAKE-ITEM-1';
      opt.textContent = 'FAKE | Test Item';
      sel.appendChild(opt);
      sel.value = 'FAKE-ITEM-1'; // dropdown re-fires with the SAME value already selected

      onMeatItemChange(n);

      return { size: meatSel[n].selectedBags.size, itemId: meatSel[n].itemId };
    });

    expect(result.size).toBe(3);
    expect(result.itemId).toBe('FAKE-ITEM-1');
  });

  test('onMeatItemChange: real SKU change with bags selected prompts confirm; cancel preserves selection', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');

    let dialogSeen = false;
    page.on('dialog', async dialog => {
      dialogSeen = true;
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('ล้างถุงที่เลือกไว้');
      await dialog.dismiss(); // simulate cancel
    });

    const result = await page.evaluate(() => {
      addMeatBlock();
      const n = meatBlockCount;

      meatSel[n].itemId = 'FAKE-ITEM-1';
      meatSel[n].selectedBags = new Set(['201', '202']);

      const sel = document.getElementById(`mb-sku-${n}`);
      const optOld = document.createElement('option');
      optOld.value = 'FAKE-ITEM-1';
      optOld.textContent = 'FAKE | Old Item';
      sel.appendChild(optOld);
      const optNew = document.createElement('option');
      optNew.value = 'FAKE-ITEM-2';
      optNew.textContent = 'FAKE | New Item';
      sel.appendChild(optNew);
      sel.value = 'FAKE-ITEM-2'; // genuine SKU change

      onMeatItemChange(n);

      return { size: meatSel[n].selectedBags.size, itemId: meatSel[n].itemId, selValue: sel.value };
    });

    expect(dialogSeen).toBe(true);
    // Cancelled → selection + itemId must be untouched, dropdown reverted.
    expect(result.size).toBe(2);
    expect(result.itemId).toBe('FAKE-ITEM-1');
    expect(result.selValue).toBe('FAKE-ITEM-1');
  });

  test('onMeatItemChange: real SKU change confirmed wipes selectedBags', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');

    page.on('dialog', async dialog => { await dialog.accept(); });

    const result = await page.evaluate(() => {
      addMeatBlock();
      const n = meatBlockCount;

      meatSel[n].itemId = 'FAKE-ITEM-1';
      meatSel[n].selectedBags = new Set(['301']);

      const sel = document.getElementById(`mb-sku-${n}`);
      const optOld = document.createElement('option');
      optOld.value = 'FAKE-ITEM-1';
      optOld.textContent = 'FAKE | Old Item';
      sel.appendChild(optOld);
      const optNew = document.createElement('option');
      optNew.value = 'FAKE-ITEM-2';
      optNew.textContent = 'FAKE | New Item';
      sel.appendChild(optNew);
      sel.value = 'FAKE-ITEM-2';

      onMeatItemChange(n);

      return { size: meatSel[n].selectedBags.size, itemId: meatSel[n].itemId };
    });

    expect(result.size).toBe(0);
    expect(result.itemId).toBe('FAKE-ITEM-2');
  });

  test('checkMeatBagInvariant: flags mismatch between rendered chips and bag-id array', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => {
      // In-sync case: 2 rendered chips under #meat-blocks, 2 bag ids.
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="lot-chip selected"></div>
        <div class="lot-chip selected"></div>`;
      document.getElementById('meat-blocks').appendChild(wrap);

      const inSync = checkMeatBagInvariant([1001, 1002]);

      // Desync case: still 2 chips rendered, but allBagIds claims only 1 —
      // this is exactly the shape of the 2026-08-10 bug if it recurred.
      const desynced = checkMeatBagInvariant([1001]);

      return { inSync, desynced };
    });

    expect(result.inSync).toBe(true);
    expect(result.desynced).toBe(false);
  });

  test('checkMeatBagInvariant: modal bag-picker chips (outside #meat-blocks) do not pollute the count', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => {
      // #meat-blocks has 1 selected chip.
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="lot-chip selected"></div>`;
      document.getElementById('meat-blocks').appendChild(wrap);

      // The bag-picker modal (#bag-modal-body) also uses .lot-chip.selected for its
      // own toggle state — must NOT be counted, since it lives outside #meat-blocks.
      const modalBody = document.getElementById('bag-modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="lot-chip selected"></div>
          <div class="lot-chip selected"></div>
          <div class="lot-chip selected"></div>`;
      }

      return checkMeatBagInvariant([555]); // 1 real selected bag, matches #meat-blocks only
    });

    expect(result).toBe(true);
  });
});
