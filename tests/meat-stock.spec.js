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
    // ควรมีอย่างน้อย: สามชั้น, สันนอก, ลิ้นวัว
    expect(options.some(o => o.includes('สามชั้น'))).toBe(true);
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

  test('แปรรูป output — 12 SKUs curated (portion/packed)', async ({ page }) => {
    await page.click('button:has-text("แปรรูป")');
    // Switch to mix mode to reveal legacy single-SKU dropdown
    await page.selectOption('#proc-type', 'mix');
    const dropdown = page.locator('#proc-sku-out');
    await expect(dropdown).toBeVisible();

    const options = await dropdown.locator('option').allTextContents();
    // 1 placeholder + 12 SKUs = 13 (MT-031 เนื้อคุ้น hard-deleted 20/04)
    expect(options.length).toBe(13);

    // ควรมี MT-020, MT-014 (พิคานย่า)
    expect(options.some(o => o.includes('MT-020'))).toBe(true);
    expect(options.some(o => o.includes('MT-014'))).toBe(true);
    // ไม่ควรมีตุ๋นทั้งชิ้น (MT-028 สามชั้นตุ๋น อยู่ใน category meat_cooked ไม่ใช่ portion)
    expect(options.some(o => o.includes('MT-028'))).toBe(false);
    // ไม่ควรมี เศษเนื้อ
    expect(options.some(o => o.includes('เศษเนื้อ'))).toBe(false);
  });
});
