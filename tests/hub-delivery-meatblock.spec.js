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
  // ─── duplicate bags across blocks (2026-11-09 FS20261109-3: 27 lines for 25 bags) ───
  // CI runs this spec against the deployed site (baseURL = GitHub Pages main), so on the PR
  // that introduces these guards the page under test does not have them yet. Skip — not
  // fail — until the deployed page carries the feature; after merge the push-to-main run
  // (and every later PR) executes them for real. Feature probe = the pure helper they need.
  async function skipIfNotDeployed(page) {
    const has = await page.evaluate(() => typeof findDuplicateBags === 'function');
    test.skip(!has, 'page under test predates the duplicate-bag guards (PR #81) — runs after deploy');
  }


  test('onMeatItemChange: a second block of the same SKU is refused with a message naming the first block', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');
    await skipIfNotDeployed(page);

    let msg = '';
    page.on('dialog', async d => { msg = d.message(); await d.accept(); });

    const result = await page.evaluate(() => {
      const mk = (n) => {
        const sel = document.getElementById(`mb-sku-${n}`);
        const o = document.createElement('option');
        o.value = 'FAKE-DUP'; o.dataset.name = 'เนื้อทดสอบ'; o.textContent = 'FAKE | เนื้อทดสอบ';
        sel.appendChild(o);
        return sel;
      };
      addMeatBlock(); const a = meatBlockCount;
      const selA = mk(a); selA.value = 'FAKE-DUP'; onMeatItemChange(a);
      addMeatBlock(); const b = meatBlockCount;
      const selB = mk(b); selB.value = 'FAKE-DUP'; onMeatItemChange(b);
      return { aItem: meatSel[a].itemId, bItem: meatSel[b].itemId, bValue: selB.value };
    });

    expect(result.aItem).toBe('FAKE-DUP');
    expect(result.bItem).toBeNull();          // second block did not take the SKU
    expect(result.bValue).toBe('');           // dropdown reverted
    expect(msg).toContain('เนื้อทดสอบ');
    expect(msg).toContain('อยู่ในรายการที่');
  });

  test('openBagModal: a bag already picked in another block is shown as taken and is not pickable', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');
    await skipIfNotDeployed(page);

    const result = await page.evaluate(async () => {
      window.refreshInStockBags = async () => [
        { id: 9001, item_id: 'FAKE-DUP', weight_g: 500, lot_date: '2026-11-03' },
        { id: 9002, item_id: 'FAKE-DUP', weight_g: 500, lot_date: '2026-11-03' },
      ];
      addMeatBlock(); const a = meatBlockCount;
      meatSel[a].itemId = 'FAKE-DUP'; meatSel[a].selectedBags = new Set(['9001']);
      addMeatBlock(); const b = meatBlockCount;
      meatSel[b].itemId = 'FAKE-DUP';
      await openBagModal(b);
      const taken = document.getElementById('bagchip-9001');
      const free = document.getElementById('bagchip-9002');
      return {
        takenText: taken?.textContent || '', takenClick: taken?.getAttribute('onclick'),
        freeClick: free?.getAttribute('onclick') || '',
      };
    });

    expect(result.takenText).toContain('อยู่ในรายการที่');
    expect(result.takenClick).toBeNull();
    expect(result.freeClick).toContain('toggleBag');
  });

  test('submitDelivery: same bag in two blocks stops with the bag and both blocks named (no RPC)', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');
    await skipIfNotDeployed(page);

    let rpcCalled = false;
    await page.route('**/rest/v1/rpc/**', r => { rpcCalled = true; r.abort(); });
    let msg = '';
    page.on('dialog', async d => { msg = d.message(); await d.accept(); });

    await page.evaluate(async () => {
      document.getElementById('dl-bill').value = 'TEST-DUP-1';
      document.getElementById('dl-date').value = '2026-11-09';
      bagCache['9001'] = { id: 9001, item_id: 'FAKE-DUP', weight_g: 587, lot_date: '2026-11-03' };
      addMeatBlock(); const a = meatBlockCount;
      meatSel[a].itemId = 'FAKE-DUP'; meatSel[a].selectedBags = new Set(['9001']);
      addMeatBlock(); const b = meatBlockCount;
      meatSel[b].itemId = 'FAKE-DUP'; meatSel[b].selectedBags = new Set(['9001']);
      window._pendingDraftId = null;
      await submitDelivery();
    });

    expect(msg).toContain('เลือกถุงซ้ำ');
    expect(msg).toContain('#9001');
    expect(msg).toMatch(/รายการที่ \d+ และ รายการที่ \d+/);
    expect(msg).toContain('0.587');
    expect(rpcCalled).toBe(false);
  });

  test('submitDelivery (draft): a draft listing the same bag twice names it and offers to keep one line each', async ({ page }) => {
    await seedAuth(page);
    await page.goto('hub-delivery.html');
    await page.waitForLoadState('networkidle');
    await skipIfNotDeployed(page);

    await page.route('**/rest/v1/delivery_drafts**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ meat_lines: [
        { bag_id: '9001', item_id: 'FAKE-DUP', name: 'เนื้อทดสอบ', weight_g: 587 },
        { bag_id: '9002', item_id: 'FAKE-DUP', name: 'เนื้อทดสอบ', weight_g: 526 },
        { bag_id: '9001', item_id: 'FAKE-DUP', name: 'เนื้อทดสอบ', weight_g: 587 },
      ], nm_lines: [] }]),
    }));
    let rpcCalled = false;
    await page.route('**/rest/v1/rpc/**', r => { rpcCalled = true; r.abort(); });
    const msgs = [];
    page.on('dialog', async d => { msgs.push(d.message()); await d.dismiss(); });

    await page.evaluate(async () => {
      document.getElementById('dl-bill').value = 'TEST-DUP-2';
      document.getElementById('dl-date').value = '2026-11-09';
      bagCache['9001'] = { id: 9001, item_id: 'FAKE-DUP', weight_g: 587, lot_date: '2026-11-03' };
      window._pendingDraftId = 'FAKE-DRAFT';
      await submitDelivery();
    });

    expect(msgs.length).toBe(1);
    expect(msgs[0]).toContain('Draft นี้มีถุงซ้ำ 1 ถุง');
    expect(msgs[0]).toContain('#9001');
    expect(msgs[0]).toContain('3 บรรทัด แต่เป็นถุงจริง 2 ถุง');
    expect(rpcCalled).toBe(false);
  });
});
