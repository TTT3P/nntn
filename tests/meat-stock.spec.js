// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * meat-stock/index.html — ระบบจัดการเนื้อ (ครัวกลาง)
 * ตรวจ dropdowns ทุก tab หลัง curation session 13/04/2026
 */

test.describe('meat-stock page', () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(e.message));
    page['__errors'] = errors;

    await page.goto('meat-stock/index.html');
    await page.waitForLoadState('networkidle');
    // รอ header-cw อัปเดต (เป็น proxy ว่า items + cwStock โหลดแล้ว)
    await expect(page.locator('#header-cw')).toContainText('ถุง', { timeout: 15_000 });
  });

  test('โหลดหน้าได้ + ไม่มี console error + CW count ถูกโหลด', async ({ page }) => {
    await expect(page).toHaveTitle(/NNTN Meat Stock/i);
    // CW count ต้องเป็นตัวเลข ไม่ใช่ 0
    const headerText = await page.locator('#header-cw').textContent();
    expect(headerText).toMatch(/\d+\s*ถุง/);
    expect(page['__errors']).toEqual([]);
  });

  test('รับเนื้อสด — dropdown มีเนื้อดิบ', async ({ page }) => {
    // tab แรกคือ รับเนื้อสด อยู่แล้ว — dropdown ถูก auto-add ตอน init
    const dropdown = page.locator('#recv-items select').first();
    await expect(dropdown).toBeVisible();

    const options = await dropdown.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(5);  // ควรมี SP items + meat items หลายตัว
    // ตรวจ: dropdown ไม่ควรมี "โหลดไม่ได้"
    const hasFailedOption = options.some(o => o.includes('โหลดไม่ได้'));
    expect(hasFailedOption).toBe(false);
  });

  test('หม้อตุ๋น input — ตัด pre-packed [...] ออก', async ({ page }) => {
    // NOTE (fixed 2026-07-14): this was flaky — it asserted "สามชั้น" is present
    // in the dropdown, but the dropdown is populated straight from LIVE
    // production stock (warehouse A raw meat in `catch_weight`/`items`).
    // Whether "สามชั้น" happens to be in stock at CI run time is unrelated to
    // whether the app's filtering LOGIC (drop pre-packed [...] items, keep raw
    // meat) is correct. Fix: mock the two REST calls the page makes on load so
    // the dropdown content is deterministic, then reload so init() re-runs
    // against the mocked data. This keeps the original intent (verify the
    // "เปิดหม้อตุ๋น" dropdown surfaces raw meat and excludes pre-packed items)
    // without depending on live stock.
    const MOCK_ITEMS = [
      // synthetic test fixture — not real catalog SKUs, just enough shape to
      // exercise loadNewPotItemDropdown()'s filters in meat-stock/index.html
      { id: 9001, name: 'สามชั้น (ดิบ)', sku: 'TEST-SAMCHAN', category: 'meat_raw', item_category: null, byproduct_item_id: null, byproduct_required: false, yield_expected_min: null, yield_expected_max: null },
      { id: 9002, name: 'สันนอก (ดิบ)', sku: 'TEST-SANNOK', category: 'meat_raw', item_category: null, byproduct_item_id: null, byproduct_required: false, yield_expected_min: null, yield_expected_max: null },
      { id: 9003, name: 'เสือร้องไห้ออส [500g]', sku: 'TEST-PACKED', category: 'meat_raw', item_category: null, byproduct_item_id: null, byproduct_required: false, yield_expected_min: null, yield_expected_max: null },
    ];
    const MOCK_CW = MOCK_ITEMS.map((it, i) => ({
      id: 90100 + i,
      item_id: it.id,
      weight_g: 1000,
      lot_date: '2026-07-01',
      warehouse: 'A',
      status: '✅ In Stock',
      legacy_cw_row: false,
      items: { name: it.name, sku: it.sku, category: it.category },
    }));
    await page.route('**/rest/v1/items*', route => route.fulfill({ json: MOCK_ITEMS }));
    await page.route('**/rest/v1/catch_weight*', route => route.fulfill({ json: MOCK_CW }));
    await page.reload();
    await expect(page.locator('#header-cw')).toContainText('ถุง', { timeout: 15_000 });

    // Switch to หม้อตุ๋น tab
    await page.click('button:has-text("หม้อตุ๋น")');
    // Click "เปิดเนื้อใหม่"
    await page.click('button:has-text("เปิดเนื้อใหม่")');
    // Wait for modal
    const dropdown = page.locator('#np-item');
    await expect(dropdown).toBeVisible();

    const options = await dropdown.locator('option').allTextContents();
    // ไม่ควรมี [500g], [75G], [200g], [100G]
    const hasPrePackaged = options.some(o => /\[(500g|75G|200g|100G)\]/i.test(o));
    expect(hasPrePackaged).toBe(false);
    // ควรมี: สามชั้น, สันนอก (raw meat, seeded via mock above)
    expect(options.some(o => o.includes('สามชั้น'))).toBe(true);
    expect(options.some(o => o.includes('สันนอก'))).toBe(true);
  });

  test('แปรรูป input — มี optgroup "หลัก" และ "เศษเนื้อ"', async ({ page }) => {
    await page.click('button:has-text("แปรรูป")');
    await page.click('button:has-text("เพิ่มถุงต้นทาง")');

    const dropdown = page.locator('[id^="proc-item-sel-"]').first();
    await expect(dropdown).toBeVisible();

    // Count optgroups
    const groupLabels = await dropdown.locator('optgroup').evaluateAll(
      els => els.map(el => el.getAttribute('label'))
    );
    expect(groupLabels).toContain('หลัก');
    expect(groupLabels).toContain('เศษเนื้อ');

    // ไม่ควรมี pre-packed ในกลุ่มหลัก (ควรเป็น whole/cooked เท่านั้น)
    const mainItems = await dropdown
      .locator('optgroup[label="หลัก"] option')
      .allTextContents();
    const hasPackedInMain = mainItems.some(o => /\[(75G|200g)\]/i.test(o));
    expect(hasPackedInMain).toBe(false);
  });

  test('แปรรูป output — 13 SKUs curated (portion/packed)', async ({ page }) => {
    await page.click('button:has-text("แปรรูป")');
    // Switch to mix mode to reveal legacy single-SKU dropdown
    await page.selectOption('#proc-type', 'mix');
    const dropdown = page.locator('#proc-sku-out');
    await expect(dropdown).toBeVisible();

    const options = await dropdown.locator('option').allTextContents();
    // Bind the count to the live source array (PROC_OUTPUT_SKUS, exposed as
    // window._PROC_OUTPUT_SKUS in meat-stock/index.html) instead of a hardcoded
    // number — the curated list grows as SKUs are added (20 as of MT-057/058
    // 13/08), so a literal count goes stale. Dropdown = 1 placeholder + N SKUs.
    const skuCount = await page.evaluate(() => (window._PROC_OUTPUT_SKUS || []).length);
    expect(skuCount).toBeGreaterThan(0); // sanity: source array loaded
    expect(options.length).toBe(skuCount + 1);

    // ควรมี MT-020, MT-014 (พิคานย่า)
    expect(options.some(o => o.includes('MT-020'))).toBe(true);
    expect(options.some(o => o.includes('MT-014'))).toBe(true);
    // ไม่ควรมีตุ๋นทั้งชิ้น (MT-028 สามชั้นตุ๋น อยู่ใน category meat_cooked ไม่ใช่ portion)
    expect(options.some(o => o.includes('MT-028'))).toBe(false);
    // ไม่ควรมี เศษเนื้อ
    expect(options.some(o => o.includes('เศษเนื้อ'))).toBe(false);
  });
});
