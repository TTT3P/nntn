import { expect, test } from "./browser-guards";

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

test("prints one A5 SOP without app-shell or blank trailing pages", async ({ page }) => {
  await page.goto("./#/print");
  await page.getByRole("checkbox", { name: "ข้าวขยำเนื้อแดดเดียว · รหัส 37" }).check();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");
  await expect(page.locator(".workstation-sheet")).toHaveCount(1);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-header")).toBeHidden();
  await expect(page.getByRole("region", { name: "Prototype snapshot export" })).toBeHidden();
  expectPdfPages(
    await page.pdf({ preferCSSPageSize: true, printBackground: true }),
    1,
    210,
    148,
  );
});

test("loads base-aware DEMO media, preserves step attachment, and fits real A5 cards", async ({ page }) => {
  await page.goto("./#/print");
  await page.getByRole("checkbox", { name: "ข้าวหน้าเนื้อตุ๋น · รหัส 165" }).check();
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
  await expect(mediaList.getByText(/DEMO · ภาพตัวอย่าง ยังไม่ยืนยัน/u)).toBeVisible();
  const mediaPaths = await mediaList.locator("img").evaluateAll((images) =>
    images.map((image) => new URL(image.currentSrc).pathname),
  );
  expect(mediaPaths.every((path) => path.startsWith("/nntn-cookbook/sample-media/"))).toBe(true);

  const textOnlySteps = page.locator(".workstation-step--text-only");
  expect(await textOnlySteps.count()).toBeGreaterThan(0);
  expect(await textOnlySteps.locator(".workstation-media").count()).toBe(0);
});

test("keeps every production fixture media sequence in its exact accessible step", async ({ page }) => {
  await page.goto("./#/print");
  for (const name of [
    "เนื้อตุ๋น (ราดข้าว) · รหัส 164",
    "ข้าวขยำเนื้อแดดเดียว · รหัส 37",
    "ข้าวหน้าเนื้อตุ๋น · รหัส 165",
  ]) {
    await page.getByRole("checkbox", { name }).check();
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
    "ข้าวหน้าเนื้อตุ๋น · รหัส 165",
    "ข้าวหน้าเนื้อยากินิกุ · รหัส 159",
    "ข้าวขยำเนื้อแดดเดียว · รหัส 37",
  ]) {
    await page.getByRole("checkbox", { name }).check();
  }
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");
  await page.getByRole("combobox", { name: /^แม่แบบ/u }).selectOption("two-up");
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
  await expect(page.getByRole("region", { name: "Prototype snapshot export" })).toBeHidden();
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
    await page.getByRole("checkbox", { name: "ข้าวหน้าเนื้อตุ๋น · รหัส 165" }).check();
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
