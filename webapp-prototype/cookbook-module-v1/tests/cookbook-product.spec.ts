import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./browser-guards";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const viewport = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
}

async function expectMinimumTargetSize(locator: Locator): Promise<void> {
  const sizes = await locator.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { height: box.height, width: box.width };
  }));
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
}

test("uses an ERP print workspace with grouped selection and a responsive proof panel", async ({ page }) => {
  await page.goto("./#/print");

  const sidebar = page.locator(".print-sidebar");
  const proof = page.locator(".print-proof");
  await expect(sidebar).toBeVisible();
  await expect(proof).toBeVisible();
  const desktopSidebar = await sidebar.boundingBox();
  const desktopProof = await proof.boundingBox();
  expect(desktopSidebar).not.toBeNull();
  expect(desktopProof).not.toBeNull();
  expect(desktopProof!.x).toBeGreaterThan(desktopSidebar!.x + desktopSidebar!.width);

  await page.getByRole("searchbox", { name: "ค้นหาสูตร" }).fill("RCP-026");
  await page.getByRole("checkbox", { name: "ไข่ข้น · RCP-026" }).check();
  await page.getByRole("button", { name: /พิมพ์เป็นเล่ม/u }).click();
  await expect(page.getByRole("heading", { name: "คู่มือสูตรครัว NNTN" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "สารบัญ", exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "ไข่ข้น" })).toBeVisible();

  await page.setViewportSize({ width: 430, height: 932 });
  const mobileSidebar = await sidebar.boundingBox();
  const mobileProof = await proof.boundingBox();
  expect(mobileSidebar).not.toBeNull();
  expect(mobileProof).not.toBeNull();
  expect(mobileProof!.y).toBeGreaterThan(mobileSidebar!.y + mobileSidebar!.height);
  const viewport = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
});

test("uses the complete Cookbook flow on desktop and iPhone 15 Pro Max width", async ({ page, strictBrowserBoundary }) => {
  await page.goto("./#/recipes");
  await expect(page.getByRole("heading", { name: "สูตรอาหาร" })).toBeVisible();
  await expect(page.getByText("87 สูตร", { exact: true })).toBeVisible();
  await expect(page.getByText("แสดง 87 จาก 87 สูตร")).toBeVisible();

  await page.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" }).fill("ไข่ข้น");
  const eggRecipeLink = page.getByRole("link", { name: /^ไข่ข้น(?:\s|$)/u });
  await expect(eggRecipeLink).toHaveAttribute("href", "#/recipes/RCP-026");
  await expect(eggRecipeLink).toBeVisible();
  await page.goto("./#/recipes/RCP-011");
  await expect(page.getByRole("heading", { name: "ข้าวเนื้อสับคั่วน้ำปลาไข่ข้น" })).toBeVisible();
  await expect(page.getByText("ยังไม่มีรายการวัตถุดิบ")).toBeVisible();
  await expect(page.getByText("ยังไม่มีวิธีทำ")).toBeVisible();

  await page.getByRole("link", { name: "แก้ไขสูตร" }).click();
  await expect(page.getByRole("heading", { name: "แก้ไขสูตร" })).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มวัตถุดิบ" }).click();
  await page.getByLabel("ชื่อวัตถุดิบ รายการ 1").fill("น้ำมันรำข้าว");
  await page.getByLabel("ปริมาณ รายการ 1").fill("2");
  await page.getByLabel("หน่วย รายการ 1").selectOption("ช้อนโต๊ะ");
  await page.getByRole("button", { name: "เพิ่มขั้นตอน" }).click();
  await page.getByRole("textbox", { name: "วิธีทำ ขั้นตอน 1", exact: true }).fill("ตั้งกระทะให้ร้อน");

  await page.setViewportSize({ width: 430, height: 932 });
  const viewport = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
  const visibleText = await page.getByRole("main").innerText();
  expect(visibleText).not.toMatch(/AI|Prototype|Mock|V[456]|schema|source review|blocker|provenance|candidate|Supabase|gateway|snapshot|local.session/iu);
  await strictBrowserBoundary.drain();
});

test("keeps recipe workstage controls usable without overflow on desktop, notebook, and 430px width", async ({ page }) => {
  await page.goto("./#/recipes/RCP-021/edit");
  const stageHeading = page.getByRole("heading", { name: "จุดงานและการพิมพ์" });
  await expect(stageHeading).toBeVisible();
  await stageHeading.scrollIntoViewIfNeeded();

  const stageCheckboxTargets = page
    .getByRole("group", { name: "พิมพ์วัตถุดิบนี้ในใบงาน รายการ 1" })
    .locator("label");
  const methodStageSelects = page.getByLabel(/จุดงานของขั้นตอน ขั้นตอน/u);

  await expectNoHorizontalOverflow(page);
  await expectMinimumTargetSize(stageCheckboxTargets);
  await expectMinimumTargetSize(methodStageSelects);

  await page.setViewportSize({ width: 1280, height: 900 });
  await stageHeading.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  await expectMinimumTargetSize(stageCheckboxTargets);
  await expectMinimumTargetSize(methodStageSelects);

  await page.setViewportSize({ width: 430, height: 932 });
  await stageHeading.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  await expectMinimumTargetSize(stageCheckboxTargets);
  await expectMinimumTargetSize(methodStageSelects);
});

test("keeps the friendly view, search and filters through reload and browser history", async ({ page }) => {
  await page.goto("./#/recipes");
  await expect(page.getByRole("button", { name: "ดูง่าย" })).toHaveAttribute("aria-pressed", "true");

  const searchbox = page.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" });
  await searchbox.fill("เนื้อ");
  await page.getByRole("button", { name: "ตัวกรอง", exact: true }).click();
  await page.getByLabel("ประเภทสูตร").selectOption("sellable_menu");
  await page.getByRole("button", { name: "รายการย่อ" }).click();
  await expect(page).toHaveURL(/#\/recipes\?view=compact&q=.*&kind=sellable_menu$/u);

  await page.reload();
  await expect(page.getByRole("button", { name: "รายการย่อ" })).toHaveAttribute("aria-pressed", "true");
  await expect(searchbox).toHaveValue("เนื้อ");
  await page.getByRole("button", { name: "ตัวกรอง", exact: true }).click();
  await expect(page.getByLabel("ประเภทสูตร")).toHaveValue("sellable_menu");
  await page.getByRole("button", { name: "ตัวกรอง", exact: true }).click();

  await page.goBack();
  await expect(page).toHaveURL(/#\/recipes\?q=.*&kind=sellable_menu$/u);
  await expect(page.getByRole("button", { name: "ดูง่าย" })).toHaveAttribute("aria-pressed", "true");
  await expect(searchbox).toHaveValue("เนื้อ");
  await page.getByRole("button", { name: "ตัวกรอง", exact: true }).click();
  await expect(page.getByLabel("ประเภทสูตร")).toHaveValue("sellable_menu");
});

test("separates work actions from recipe editing", async ({ page }) => {
  await page.goto("./#/recipes?mode=work");

  await expect(page.getByRole("heading", { name: "ใบงานครัว" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^เปิดใบงาน /u }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^แก้ไข /u })).toHaveCount(0);
});

test("shows responsive manage results without horizontal overflow and restores all recipes", async ({ page }) => {
  await page.goto("./#/recipes?mode=manage");

  const desktopTable = page.getByRole("table", { name: "รายการจัดการสูตร" });
  const mobileCards = page.getByRole("list", { name: "รายการจัดการสูตรบนมือถือ", includeHidden: true });
  await expect(desktopTable).toBeVisible();
  await expect(mobileCards).toBeHidden();

  await page.setViewportSize({ width: 430, height: 932 });
  await expect(desktopTable).toBeHidden();
  await expect(mobileCards).toBeVisible();
  const viewport = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);

  await page.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" }).fill("เนื้อ");
  await page.getByRole("button", { name: "ตัวกรอง", exact: true }).click();
  await page.getByLabel("ประเภทสูตร").selectOption("sellable_menu");
  await expect(page.getByText(/แสดง \d+ จาก 87 สูตร/u)).toBeVisible();
  const visibleEditLinks = page.getByRole("link", { name: /^แก้ไข /u });
  const filteredRecipeCount = await visibleEditLinks.count();
  expect(filteredRecipeCount).toBeGreaterThan(0);
  expect(filteredRecipeCount).toBeLessThan(87);

  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await expect(page.getByText("แสดง 87 จาก 87 สูตร")).toBeVisible();
  await expect(visibleEditLinks).toHaveCount(87);
});
