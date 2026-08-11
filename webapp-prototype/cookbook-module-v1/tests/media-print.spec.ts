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
  await page.getByRole("checkbox", { name: "ข้าวขยำเนื้อแดดเดียว · RCP-021" }).check();
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
  await page.getByRole("checkbox", { name: "น้ำซุปก๋วยเตี๋ยว V3 · RCP-002" }).check();
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
  const removedRoot = page.getByRole("checkbox", { name: "ซอสยากินิกุ · SRCP-014" });
  await removedRoot.check();
  await expect(page.getByRole("article", { name: /ซอสอเนกประสงค์/u })).toHaveCount(0);
  await expect(page.locator(".workstation-ingredients tbody tr")).toHaveCount(11);

  await removedRoot.uncheck();
  await page.getByRole("checkbox", { name: "ผัดผัก · SRCP-015" }).check();
  await expect(page.getByRole("article", { name: /ซอสอเนกประสงค์/u }).first())
    .toBeVisible();
  await expect(page.locator(".workstation-ingredients tbody tr")).toHaveCount(14);
});

test("loads base-aware DEMO media, preserves step attachment, and fits real A5 cards", async ({ page }) => {
  await page.goto("./#/print");
  await page.getByRole("checkbox", { name: "ข้าวหน้าเนื้อตุ๋น · RCP-071" }).check();
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
  await page.getByRole("checkbox", { name: "เนื้อตุ๋น (ราดข้าว) · SRCP-019" }).check();
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
  await page.getByRole("checkbox", { name: "ผงคั่วพริกเกลือ · SRCP-018" }).check();
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
    "ข้าวหน้าเนื้อตุ๋น · RCP-071",
    "ข้าวหน้าเนื้อยากินิกุ · RCP-069",
    "ข้าวขยำเนื้อแดดเดียว · RCP-021",
  ]) {
    await page.getByRole("checkbox", { name }).check();
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
    await page.getByRole("checkbox", { name: "ข้าวหน้าเนื้อตุ๋น · RCP-071" }).check();
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
