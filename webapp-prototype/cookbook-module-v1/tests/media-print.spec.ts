import { expect, test } from "./browser-guards";
import type { Locator, Page } from "@playwright/test";
import type {
  CookbookV6Document,
  CookbookV6IngredientLine,
  CookbookV6Recipe,
} from "../src/domain/cookbookV6/types";

const cssPixelsPerMillimeter = 96 / 25.4;
const pdfPointsPerMillimeter = 72 / 25.4;

function expectMillimeters(actualPixels: number, expectedMillimeters: number): void {
  expect(Math.abs(actualPixels - expectedMillimeters * cssPixelsPerMillimeter)).toBeLessThanOrEqual(1);
}

function expectPdfPages(
  pdf: Buffer,
  expectedPageCount: number,
  expectedWidthMillimeters: number,
  expectedHeightMillimeters: number,
): void {
  const mediaBoxes = [...pdf.toString("latin1").matchAll(
    /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g,
  )].map((match) => ({ width: Number(match[1]), height: Number(match[2]) }));
  expect(mediaBoxes).toHaveLength(expectedPageCount);
  for (const mediaBox of mediaBoxes) {
    expect(Math.abs(mediaBox.width - expectedWidthMillimeters * pdfPointsPerMillimeter)).toBeLessThanOrEqual(1);
    expect(Math.abs(mediaBox.height - expectedHeightMillimeters * pdfPointsPerMillimeter)).toBeLessThanOrEqual(1);
  }
}

const removedDependencyName = "ซอสเลิกใช้จากสูตร";
const forbiddenCostBasis = "ต้นทุนลับ 999 บาท";

function componentLine(
  lineId: string,
  name: string,
  componentRecipeId: string,
  active = true,
): CookbookV6IngredientLine {
  return {
    lineId,
    name,
    kind: "prepared_recipe",
    amountText: "180",
    unitText: "กรัม",
    sourceDisplayText: "180 กรัม",
    ingredientId: null,
    componentRecipeId,
    servingNote: "",
    costBasisText: forbiddenCostBasis,
    decisionStatus: "confirmed_by_owner",
    selectedSource: null,
    active,
  };
}

function printFixtureRecipe({
  recipeId,
  name,
  kind,
  category,
  ingredients = [],
  active = true,
}: {
  recipeId: string;
  name: string;
  kind: CookbookV6Recipe["kind"];
  category: string;
  ingredients?: CookbookV6IngredientLine[];
  active?: boolean;
}): CookbookV6Recipe {
  const lineIds = ingredients.filter((line) => line.active).map((line) => line.lineId);
  return {
    recipeId,
    code: recipeId,
    name,
    kind,
    category,
    active,
    reviewState: "confirmed_by_owner",
    sourceLocators: ["task-6-deterministic-fixture"],
    yieldText: "1 ชุด",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients,
    methodSteps: [{
      stepId: `${recipeId}:service:1`,
      stage: "service",
      instruction: `จัด ${name}`,
      order: 1,
    }],
    blockers: [],
    workDocuments: {
      service: {
        stage: "service",
        scalable: false,
        ingredientLineIds: lineIds,
        stepIds: [`${recipeId}:service:1`],
      },
    },
    parentRecipeIds: [],
    lineage: { source: "catalog", sourceRecipeId: null },
  };
}

function categoryPrintFixture(): CookbookV6Document {
  const riceId = "RCP-T6-RICE";
  const removedId = "RCP-T6-REMOVED";
  const sharedLines = (menu: string): CookbookV6IngredientLine[] => [
    componentLine(`${menu}:rice`, "ข้าวหุงสุกร่วม", riceId),
    componentLine(`${menu}:removed`, removedDependencyName, removedId, false),
  ];
  return {
    schemaVersion: "6.0.0",
    generatedAt: "2026-08-11T00:00:00.000Z",
    derivedFrom: {
      v5Path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
      v5Sha256: "a".repeat(64),
      catalogSha256: "b".repeat(64),
    },
    recipes: [
      printFixtureRecipe({ recipeId: "RCP-T6-MENU-A", name: "เมนูทดสอบหนึ่ง", kind: "sellable_menu", category: "เมนูอาหาร", ingredients: sharedLines("menu-a") }),
      printFixtureRecipe({ recipeId: "RCP-T6-MENU-B", name: "เมนูทดสอบสอง", kind: "sellable_menu", category: "เมนูอาหาร", ingredients: sharedLines("menu-b") }),
      printFixtureRecipe({ recipeId: riceId, name: "ข้าวหุงสุกร่วม", kind: "prepared_recipe", category: "ข้าวและเครื่องเคียง" }),
      printFixtureRecipe({ recipeId: "RCP-T6-SAUCE-A", name: "ซอสทดสอบหนึ่ง", kind: "prepared_recipe", category: "ซอสและน้ำจิ้ม" }),
      printFixtureRecipe({ recipeId: "RCP-T6-SAUCE-B", name: "ซอสทดสอบสอง", kind: "prepared_recipe", category: "ซอสและน้ำจิ้ม" }),
      printFixtureRecipe({ recipeId: removedId, name: removedDependencyName, kind: "prepared_recipe", category: "ซอสและน้ำจิ้ม", active: false }),
    ],
  };
}

async function expectSheetsFit(sheets: Locator): Promise<number> {
  const geometry = await sheets.evaluateAll((elements) => elements.map((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  })));
  expect(geometry.length).toBeGreaterThan(0);
  for (const sheet of geometry) {
    expect(sheet.scrollWidth).toBe(sheet.clientWidth);
    expect(sheet.scrollHeight).toBe(sheet.clientHeight);
  }
  return geometry.length;
}

async function setRecipeChecked(page: Page, name: string, checked: boolean): Promise<void> {
  const search = page.getByRole("searchbox", { name: "ค้นหาสูตร" });
  await search.fill(name);
  const checkbox = page.getByRole("checkbox", { name });
  if (checked) await checkbox.check();
  else await checkbox.uncheck();
  await search.fill("");
}

test("prints named collections and deduplicates the daily packet", async ({ page }) => {
  test.setTimeout(60_000);
  const document = categoryPrintFixture();
  await page.route("**/__cookbook/v6-draft", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        document,
        base_sha256: "c".repeat(64),
        origin: "v6-draft",
        path: "node_modules/.cache/cookbook-v6-e2e-vault/Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json",
      }),
    });
  });
  await page.goto("./#/print");

  await page.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" }).click();
  await expect(page.getByRole("checkbox", { name: "ซอสทดสอบหนึ่ง · RCP-T6-SAUCE-A" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "ซอสทดสอบสอง · RCP-T6-SAUCE-B" })).toBeChecked();

  await page.getByRole("button", { name: "พิมพ์ทั้งหมวด เมนูอาหาร 2 สูตร" }).click();
  await page.getByRole("button", { name: /^A5 ใบงาน/u }).click();
  await page.locator("details.print-advanced > summary").click();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");

  await expect(page.getByRole("article", { name: /^เมนูทดสอบหนึ่ง ·/u })).toHaveCount(1);
  await expect(page.getByRole("article", { name: /^เมนูทดสอบสอง ·/u })).toHaveCount(1);
  await expect(page.getByRole("article", { name: /^ซอสทดสอบหนึ่ง ·/u })).toHaveCount(0);
  await expect(page.getByRole("article", { name: /^ซอสทดสอบสอง ·/u })).toHaveCount(0);
  await expect(page.getByRole("article", { name: /^ข้าวหุงสุกร่วม ·/u })).toHaveCount(0);
  await expect(page.getByText("ข้าวหุงสุกร่วม · RCP-T6-RICE", { exact: true })).toHaveCount(2);
  const proofHeader = page.locator(".print-proof__header");
  await expect(proofHeader.getByText("2 สูตร", { exact: true })).toBeVisible();
  await expect(proofHeader.getByText("2 แผ่น", { exact: true })).toBeVisible();
  await expect(proofHeader.getByText("อ้างอิงสูตรนอกหมวด 1 สูตร", { exact: true })).toBeVisible();
  await expect(page.getByText(removedDependencyName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(forbiddenCostBasis, { exact: true })).toHaveCount(0);

  const a5Sheets = page.locator(".workstation-sheet");
  const a5SheetCount = await expectSheetsFit(a5Sheets);
  expect(a5SheetCount).toBe(2);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".product-sidebar")).toBeHidden();
  await expect(page.locator(".product-mobile-header")).toBeHidden();
  await expect(page.locator(".print-sidebar")).toBeHidden();
  await expect(page.locator(".print-proof__header")).toBeHidden();
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    a5SheetCount,
    210,
    148,
  );

  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "ชุดงานวันนี้" }).click();
  await page.locator("details.print-collection", { hasText: "เมนูอาหาร" }).locator("summary").click();
  await page.getByRole("checkbox", { name: "เมนูทดสอบหนึ่ง · RCP-T6-MENU-A" }).check();
  await page.getByRole("checkbox", { name: "เมนูทดสอบสอง · RCP-T6-MENU-B" }).check();
  await expect(page.getByRole("article", { name: /^เมนูทดสอบหนึ่ง ·/u })).toHaveCount(1);
  await expect(page.getByRole("article", { name: /^เมนูทดสอบสอง ·/u })).toHaveCount(1);
  await expect(page.getByRole("article", { name: /^ข้าวหุงสุกร่วม ·/u })).toHaveCount(1);
  await expect(page.getByRole("article", { name: /^ซอสทดสอบหนึ่ง ·/u })).toHaveCount(0);
  await expect(page.getByRole("article", { name: /^ซอสทดสอบสอง ·/u })).toHaveCount(0);
  await expect(page.locator(".print-proof__canvas article.workstation-card")).toHaveCount(3);
  await expect(page.getByText(removedDependencyName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(forbiddenCostBasis, { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /^A4 สูตรเต็ม/u }).click();
  const a4Sheets = page.locator(".two-up-sheet");
  const a4SheetCount = await expectSheetsFit(a4Sheets);
  expect(a4SheetCount).toBe(2);
  expect(await a4Sheets.evaluateAll((sheets) => sheets.map((sheet) =>
    sheet.querySelectorAll(".two-up-slot").length,
  ))).toEqual([2, 1]);
  await page.emulateMedia({ media: "print" });
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    a4SheetCount,
    210,
    297,
  );
});

test("prints a reading-order A5 cookbook without Print Center chrome", async ({ page }) => {
  await page.goto("./#/print");
  await page.getByRole("searchbox", { name: "ค้นหาสูตร" }).fill("RCP-026");
  await page.getByRole("checkbox", { name: "ไข่ข้น · RCP-026" }).check();
  await page.getByRole("button", { name: /พิมพ์เป็นเล่ม/u }).click();

  const pages = page.locator(".cookbook-page");
  await expect(pages).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "คู่มือสูตรครัว NNTN" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "สารบัญ", exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "ไข่ข้น" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "เปิดเมนู" }).click();
  await expect(page.locator(".product-sidebar-backdrop")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".product-sidebar")).toBeHidden();
  await expect(page.locator(".product-mobile-header")).toBeHidden();
  await expect(page.locator(".product-sidebar-backdrop")).toBeHidden();
  await expect(page.locator(".print-sidebar")).toBeHidden();
  await expect(page.locator(".print-proof__header")).toBeHidden();
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    3,
    148,
    210,
  );
});

test("prints one A5 SOP without app-shell or blank trailing pages", async ({ page }) => {
  await page.goto("./#/print");
  await setRecipeChecked(page, "ข้าวขยำเนื้อแดดเดียว · RCP-021", true);
  await page.locator("details.print-advanced > summary").click();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");
  await expect(page.locator(".workstation-sheet")).toHaveCount(1);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".product-sidebar")).toBeHidden();
  await expect(page.locator(".product-mobile-header")).toBeHidden();
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    1,
    210,
    148,
  );
});

test("shows exact operational facts on Work and Print without Service cost basis", async ({ page }) => {
  await page.goto("./#/work/RCP-002?stage=all");
  const soup = page.getByRole("article", { name: "น้ำซุปก๋วยเตี๋ยว V3" });
  await expect(soup.getByText(
    "ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70",
    { exact: true },
  )).toBeVisible();
  await expect(soup.getByText(
    "ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ",
    { exact: true },
  )).toBeVisible();

  await page.goto("./#/work/RCP-069?stage=service");
  const service = page.getByRole("article", { name: "ข้าวหน้าเนื้อยากินิกุ" });
  await expect(service.getByText("ตักข้าวหุงสุก 180 กรัม", { exact: true })).toBeVisible();
  await expect(service.getByText("ข้าวสารญี่ปุ่นดิบ 72 กรัม", { exact: true })).toHaveCount(0);

  await page.goto("./#/print");
  await setRecipeChecked(page, "น้ำซุปก๋วยเตี๋ยว V3 · RCP-002", true);
  await expect(page.getByRole("article", {
    name: /น้ำซุปก๋วยเตี๋ยว V3 · ผลิตซอสและของเตรียม/u,
  })).toHaveCount(2);
  await expect(page.getByText(
    "ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70",
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(
    "DOCX V3 ระบุรายการส่วนผสมแต่ไม่มีลำดับวิธีปรุงน้ำซุป; ตัดวิธีเก่าที่มีขั้นตอนลงเนื้อออกตามขอบเขตที่เจ้าของยืนยัน",
    { exact: true },
  )).toBeVisible();

  const sheets = page.locator(".workstation-sheet");
  await expect(sheets).toHaveCount(5);
  const geometry = await sheets.evaluateAll((elements) => elements.map((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  })));
  for (const sheet of geometry) {
    expect(sheet.scrollWidth).toBe(sheet.clientWidth);
    expect(sheet.scrollHeight).toBe(sheet.clientHeight);
  }
});

test("excludes removed dependencies while retaining the same recipe where it is still used", async ({ page }) => {
  await page.goto("./#/work/SRCP-014?stage=all");
  await expect(page.getByRole("heading", { level: 4, name: "ซอสอเนกประสงค์" }))
    .toHaveCount(0);
  await expect(page.getByRole("article", { name: "ซอสยากินิกุ" }).locator("tbody tr"))
    .toHaveCount(11);
  await expect(page.locator("tbody tr")).toHaveCount(11);

  await page.goto("./#/work/SRCP-015?stage=all");
  await expect(page.getByRole("heading", { level: 4, name: "ซอสอเนกประสงค์" }))
    .toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(14);

  await page.goto("./#/print");
  await setRecipeChecked(page, "ซอสยากินิกุ · SRCP-014", true);
  await expect(page.getByRole("article", { name: /ซอสอเนกประสงค์/u })).toHaveCount(0);
  await expect(page.locator(".workstation-ingredients tbody tr")).toHaveCount(11);

  await setRecipeChecked(page, "ซอสยากินิกุ · SRCP-014", false);
  await setRecipeChecked(page, "ผัดผัก · SRCP-015", true);
  await expect(page.getByRole("article", { name: /ซอสอเนกประสงค์/u }).first())
    .toBeVisible();
  await expect(page.locator(".workstation-ingredients tbody tr")).toHaveCount(14);
});

test("loads base-aware DEMO media, preserves step attachment, and fits real A5 cards", async ({ page }) => {
  await page.goto("./#/print");
  await setRecipeChecked(page, "ข้าวหน้าเนื้อตุ๋น · RCP-071", true);
  await page.locator("details.print-advanced > summary").click();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");

  const sheets = page.locator(".workstation-sheet");
  await expect(sheets.first()).toBeVisible();
  const geometry = await sheets.evaluateAll((elements) => elements.map((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  })));
  for (const sheet of geometry) {
    expectMillimeters(sheet.width, 210);
    expectMillimeters(sheet.height, 148);
    expect(sheet.scrollWidth).toBe(sheet.clientWidth);
    expect(sheet.scrollHeight).toBe(sheet.clientHeight);
  }

  const mediaList = page.getByRole("list", { name: "รูปขั้นตอน 2" });
  await expect(mediaList.getByRole("img", { name: /DEMO.*กล่องเดลิเวอรี/u })).toBeVisible();
  await expect(mediaList.getByText(/ภาพตัวอย่าง · ยังไม่ยืนยัน/u)).toBeVisible();
  const mediaPaths = await mediaList.locator("img").evaluateAll((images) =>
    images.map((image) => new URL(image.currentSrc).pathname),
  );
  expect(mediaPaths.every((path) => path.startsWith("/nntn-cookbook/sample-media/"))).toBe(true);

  const textOnlySteps = page.locator(".workstation-step--text-only");
  expect(await textOnlySteps.count()).toBeGreaterThan(0);
  expect(await textOnlySteps.locator(".workstation-media").count()).toBe(0);
});

test("prints the confirmed flour quantities without clipping an A5 SOP", async ({ page }) => {
  await page.goto("./#/print");
  await setRecipeChecked(page, "เนื้อตุ๋น (ราดข้าว) · SRCP-019", true);
  await page.getByRole("button", { name: /^A5 ใบงาน/u }).click();
  await page.locator("details.print-advanced > summary").click();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("prep");

  const sheets = page.locator(".workstation-sheet");
  await expect(sheets).toHaveCount(7);
  expect(await page.getByText("1 ช้อนโต๊ะพูนๆ", { exact: true }).count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("120 ml", { exact: true }).first()).toBeVisible();
  const geometry = await sheets.evaluateAll((elements) => elements.map((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  })));
  for (const sheet of geometry) {
    expect(sheet.scrollWidth).toBe(sheet.clientWidth);
    expect(sheet.scrollHeight).toBe(sheet.clientHeight);
  }

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".product-sidebar")).toBeHidden();
  await expect(page.locator(".product-mobile-header")).toBeHidden();
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    7,
    210,
    148,
  );
});

test("prints a methodless recipe as one nonblank A5 DRAFT sheet", async ({ page }) => {
  await page.goto("./#/print");
  await setRecipeChecked(page, "ผงคั่วพริกเกลือ · SRCP-018", true);
  await page.getByRole("button", { name: /^A5 ใบงาน/u }).click();
  await page.locator("details.print-advanced > summary").click();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("prep");

  const sheet = page.locator(".workstation-sheet");
  await expect(sheet).toHaveCount(1);
  await expect(sheet.getByText("สถานะสูตร: ข้อมูลยังไม่ครบ", { exact: true })).toBeVisible();
  await expect(sheet.getByLabel("คำเตือนชุดพิมพ์").getByText(
    "มีสัดส่วนผสมครบ แต่ยังไม่มีขั้นตอนคลุก/เก็บ/ผลผลิต จึงพิมพ์ได้เฉพาะฉบับร่าง",
    { exact: true },
  )).toBeVisible();
  await expect(sheet.locator(".workstation-ingredients tbody tr")).toHaveCount(4);
  await expect(sheet.locator(".workstation-step")).toHaveCount(0);

  const geometry = await sheet.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
  expect(geometry.scrollHeight).toBe(geometry.clientHeight);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".product-sidebar")).toBeHidden();
  await expect(page.locator(".product-mobile-header")).toBeHidden();
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    1,
    210,
    148,
  );
});

test("keeps every production fixture media sequence in its exact accessible step", async ({ page }) => {
  await page.goto("./#/print");
  for (const name of [
    "เนื้อตุ๋น (ราดข้าว) · SRCP-019",
    "ข้าวขยำเนื้อแดดเดียว · RCP-021",
    "ข้าวหน้าเนื้อตุ๋น · RCP-071",
  ]) {
    await setRecipeChecked(page, name, true);
  }

  const sequences = [
    {
      stepId: "kitchen-v2-164-draft-001:prep:1",
      cardName: /เนื้อตุ๋น \(ราดข้าว\) · ผลิตซอสและของเตรียม/u,
      stepOrder: 1,
      alts: ["ภาพตัวอย่าง DEMO แสดงขนาดชิ้นเนื้อสำหรับขั้นตอนเตรียม"],
    },
    {
      stepId: "kitchen-v2-37-draft-001:cook:2",
      cardName: /ข้าวขยำเนื้อแดดเดียว · ครัวปรุง \/ BOM/u,
      stepOrder: 2,
      alts: ["ภาพตัวอย่าง DEMO แสดงสีและความสุกหลังทอด"],
    },
    {
      stepId: "kitchen-v2-165-draft-001:service:2",
      cardName: /ข้าวหน้าเนื้อตุ๋น · จัดเสิร์ฟหน้าร้าน/u,
      stepOrder: 2,
      alts: ["ภาพตัวอย่าง DEMO แสดงตำแหน่งอาหารในกล่องเดลิเวอรี"],
    },
  ];

  for (const sequence of sequences) {
    const card = page.getByRole("article", { name: sequence.cardName });
    const mediaList = card.getByRole("list", { name: `รูปขั้นตอน ${String(sequence.stepOrder)}` });
    await expect(mediaList, sequence.stepId).toBeVisible();
    expect(await mediaList.getByRole("img").evaluateAll((images) => images.map((image) => image.alt)), sequence.stepId)
      .toEqual(sequence.alts);
    await expect(mediaList.locator(".."), sequence.stepId).toHaveClass(/workstation-step/u);
  }
});

test("renders A4 two-up sheets with an unclipped odd tail", async ({ page }) => {
  await page.goto("./#/print");
  for (const name of [
    "ข้าวหน้าเนื้อตุ๋น · RCP-071",
    "ข้าวหน้าเนื้อยากินิกุ · RCP-069",
    "ข้าวขยำเนื้อแดดเดียว · RCP-021",
  ]) {
    await setRecipeChecked(page, name, true);
  }
  await page.getByRole("button", { name: /^A4 สูตรเต็ม/u }).click();
  await page.locator("details.print-advanced > summary").click();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");
  const sheets = page.locator(".two-up-sheet");
  await expect(sheets).toHaveCount(2);

  const geometry = await sheets.evaluateAll((elements) => elements.map((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    slots: element.querySelectorAll(".two-up-slot").length,
  })));
  expect(geometry.map((sheet) => sheet.slots)).toEqual([2, 1]);
  for (const sheet of geometry) {
    expectMillimeters(sheet.width, 210);
    expectMillimeters(sheet.height, 297);
    expect(sheet.scrollWidth).toBe(sheet.clientWidth);
    expect(sheet.scrollHeight).toBe(sheet.clientHeight);
  }
  const slots = await page.locator(".two-up-slot").evaluateAll((elements) =>
    elements.map((slot) => {
      const card = slot.querySelector<HTMLElement>(".workstation-card");
      if (card === null) throw new Error("two-up slot is missing its workstation card");
      return {
        slotHeight: slot.getBoundingClientRect().height,
        slotClientWidth: slot.clientWidth,
        slotScrollWidth: slot.scrollWidth,
        slotClientHeight: slot.clientHeight,
        slotScrollHeight: slot.scrollHeight,
        cardClientWidth: card.clientWidth,
        cardScrollWidth: card.scrollWidth,
        cardClientHeight: card.clientHeight,
        cardScrollHeight: card.scrollHeight,
      };
    }),
  );
  expect(slots).toHaveLength(3);
  for (const slot of slots) {
    expectMillimeters(slot.slotHeight, 148);
    expect(slot.slotScrollWidth).toBe(slot.slotClientWidth);
    expect(slot.slotScrollHeight).toBe(slot.slotClientHeight);
    expect(slot.cardScrollWidth).toBe(slot.cardClientWidth);
    expect(slot.cardScrollHeight).toBe(slot.cardClientHeight);
  }

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".product-sidebar")).toBeHidden();
  await expect(page.locator(".product-mobile-header")).toBeHidden();
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    2,
    210,
    297,
  );
});

for (const viewport of [
  { label: "desktop", width: 1440, height: 1000 },
  { label: "mobile", width: 390, height: 844 },
]) {
  test(`has no unintended ${viewport.label} document overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("./#/recipes");
    const libraryOverflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(libraryOverflow.body).toBeLessThanOrEqual(1);
    expect(libraryOverflow.document).toBeLessThanOrEqual(1);

    await page.goto("./#/print");
    await setRecipeChecked(page, "ข้าวหน้าเนื้อตุ๋น · RCP-071", true);
    await page.locator("details.print-advanced > summary").click();
    await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");
    await expect(page.locator(".print-preview")).toBeVisible();
    const printOverflow = await page.evaluate(() => {
      const preview = document.querySelector<HTMLElement>(".print-preview");
      if (preview === null) throw new Error("print preview not found");
      return {
        body: document.body.scrollWidth - document.body.clientWidth,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        previewClientWidth: preview.clientWidth,
        previewScrollWidth: preview.scrollWidth,
        previewOverflowX: getComputedStyle(preview).overflowX,
      };
    });
    expect(printOverflow.body).toBeLessThanOrEqual(1);
    expect(printOverflow.document).toBeLessThanOrEqual(1);
    expect(printOverflow.previewOverflowX).toBe("auto");
    if (viewport.width === 390) {
      expect(printOverflow.previewScrollWidth).toBeGreaterThan(printOverflow.previewClientWidth);
    }
  });
}
