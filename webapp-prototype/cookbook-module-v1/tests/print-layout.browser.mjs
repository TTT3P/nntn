import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const host = "127.0.0.1";
const port = 4175;
const origin = `http://${host}:${port}`;
const systemBrowsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter((candidate) => typeof candidate === "string" && existsSync(candidate));

async function connectOrLaunchBrowser() {
  const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
  if (typeof wsEndpoint === "string" && wsEndpoint.length > 0) {
    const userAgent = process.env.PLAYWRIGHT_WS_USER_AGENT;
    return chromium.connect(wsEndpoint, {
      ...(typeof userAgent === "string" && userAgent.length > 0
        ? { headers: { "User-Agent": userAgent } }
        : {}),
    });
  }
  return chromium.launch({
    headless: true,
    ...(systemBrowsers[0] ? { executablePath: systemBrowsers[0] } : {}),
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cssPixelsPerMillimeter = 96 / 25.4;
const pdfPointsPerMillimeter = 72 / 25.4;

function assertMillimeters(actualPixels, expectedMillimeters, message) {
  const expectedPixels = expectedMillimeters * cssPixelsPerMillimeter;
  assert(
    Math.abs(actualPixels - expectedPixels) <= 1,
    `${message}: expected ${expectedMillimeters}mm (${expectedPixels}px), got ${actualPixels}px`,
  );
}

function assertPdfPageBoxes(pdf, expectedPageCount, expectedWidthMillimeters, expectedHeightMillimeters, message) {
  const mediaBoxes = [...pdf.toString("latin1").matchAll(
    /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g,
  )].map((match) => ({ width: Number(match[1]), height: Number(match[2]) }));
  assert(mediaBoxes.length === expectedPageCount, `${message}: expected ${expectedPageCount} PDF pages, got ${mediaBoxes.length}`);
  for (const [index, mediaBox] of mediaBoxes.entries()) {
    const expectedWidth = expectedWidthMillimeters * pdfPointsPerMillimeter;
    const expectedHeight = expectedHeightMillimeters * pdfPointsPerMillimeter;
    assert(
      Math.abs(mediaBox.width - expectedWidth) <= 1 && Math.abs(mediaBox.height - expectedHeight) <= 1,
      `${message} page ${index + 1}: expected ${expectedWidthMillimeters}mm × ${expectedHeightMillimeters}mm, got ${JSON.stringify(mediaBox)}`,
    );
  }
}

const server = await createServer({
  logLevel: "error",
  server: { host, port, strictPort: true },
});
await server.listen();

let browser;
try {
  browser = await connectOrLaunchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserSession = await page.context().newCDPSession(page);
  await browserSession.send("Network.enable");
  await browserSession.send("Network.setCacheDisabled", { cacheDisabled: true });
  const externalRequests = [];
  const sampleMediaResponses = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) externalRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.includes("/sample-media/")) {
      sampleMediaResponses.push({ status: response.status(), url: response.url() });
    }
  });

  const acceptedStationScenarios = [
    "normal",
    "header-regional-max",
    "header-combining-max",
    "ingredient-15",
    "ingredient-item-max",
    "ingredient-source-max",
    "ingredient-row-max",
    "ingredient-region-max",
    "photo-3-long",
    "media-caption-max",
    "media-alt-max",
    "media-measurement-max",
    "media-region-max",
    "media-keycap-max",
    "media-keycap-vs15-max",
    "media-keycap-repeated-vs16-max",
    "media-keycap-mixed-selectors-max",
    "combined-maxima",
    "step-wide-max",
    "step-lines-max",
    "step-tabs-max",
    "combined-wide-max",
  ];
  for (const scenario of acceptedStationScenarios) {
    await page.goto(`${origin}/nntn-cookbook/tests/print-layout-harness.html?case=${scenario}`);
    await page.locator(".workstation-sheet").first().waitFor({ timeout: 2_000 });
    const geometry = await page.locator(".workstation-sheet").evaluateAll((sheets) => sheets.map((sheet) => ({
      boundingWidth: sheet.getBoundingClientRect().width,
      boundingHeight: sheet.getBoundingClientRect().height,
      clientWidth: sheet.clientWidth,
      scrollWidth: sheet.scrollWidth,
      clientHeight: sheet.clientHeight,
      scrollHeight: sheet.scrollHeight,
      cardHeight: sheet.querySelector(".workstation-card")?.getBoundingClientRect().height ?? 0,
    })));
    assert(geometry.length > 0, `${scenario}: expected station sheets`);
    for (const [index, sheet] of geometry.entries()) {
      assertMillimeters(sheet.boundingWidth, 210, `${scenario} sheet ${index + 1} width`);
      assertMillimeters(sheet.boundingHeight, 148, `${scenario} sheet ${index + 1} height`);
      assertMillimeters(sheet.cardHeight, 148, `${scenario} card ${index + 1} height`);
      assert(sheet.scrollWidth === sheet.clientWidth, `${scenario} sheet ${index + 1}: horizontal clipping ${JSON.stringify(sheet)}`);
      assert(sheet.scrollHeight === sheet.clientHeight, `${scenario} sheet ${index + 1}: vertical clipping ${JSON.stringify(sheet)}`);
    }
    const images = await page.locator(".workstation-card img").evaluateAll((elements) => elements.map((image) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      pathname: new URL(image.currentSrc).pathname,
    })));
    if (scenario === "normal" || scenario.startsWith("media-") || scenario === "photo-3-long" || scenario === "combined-maxima") {
      assert(images.length > 0, `${scenario}: expected sample media images`);
    }
    for (const [index, image] of images.entries()) {
      assert(image.complete && image.naturalWidth > 0, `${scenario} image ${index + 1}: failed to load ${JSON.stringify(image)}`);
      assert(image.pathname.startsWith("/nntn-cookbook/sample-media/"), `${scenario} image ${index + 1}: unsafe media path ${image.pathname}`);
    }
    if (scenario === "photo-3-long") {
      const orderedMedia = await page.getByRole("list", { name: "รูปขั้นตอน 1" }).evaluate((list) => {
        const step = list.parentElement;
        return {
          isExactStepChild:
            step?.classList.contains("workstation-step") === true &&
            step.querySelector(":scope > .workstation-media") === list,
          items: [...list.querySelectorAll(":scope > .workstation-media__item")].map((item) => ({
            alt: item.querySelector("img")?.getAttribute("alt") ?? "",
            metadata: [...item.querySelectorAll(".workstation-media__meta span")]
              .map((element) => element.textContent ?? ""),
          })),
        };
      });
      const expectedAlts = [1, 2, 3].map((order) => `ภาพจัดเสิร์ฟลำดับ ${order}`);
      const expectedCaptions = ["X".repeat(121), "X".repeat(121), "ภาพจัดเสิร์ฟตามมาตรฐาน"];
      assert(orderedMedia.isExactStepChild, "photo-3-long: ordered media list must stay inside its exact step");
      assert(
        JSON.stringify(orderedMedia.items.map((item) => item.alt)) === JSON.stringify(expectedAlts),
        `photo-3-long: expected ordered alts ${JSON.stringify(expectedAlts)}, got ${JSON.stringify(orderedMedia.items)}`,
      );
      for (const [index, item] of orderedMedia.items.entries()) {
        assert(
          item.metadata.includes(expectedCaptions[index]),
          `photo-3-long: media ${index + 1} missing ordered caption ${JSON.stringify(expectedCaptions[index])}`,
        );
      }
    }
  }


  await page.goto(`${origin}/nntn-cookbook/tests/print-layout-harness.html?case=normal`);
  await page.locator(".workstation-sheet").first().waitFor();
  const a5SheetCount = await page.locator(".workstation-sheet").count();
  assert(a5SheetCount === 10, `A5 print preview: expected 10 logical sheets, got ${a5SheetCount}`);
  await page.emulateMedia({ media: "print" });
  assert(await page.locator(".print-center-header").evaluate((element) => getComputedStyle(element).display) === "none", "A5 print media must hide the page header");
  assert(await page.locator(".print-sidebar").evaluate((element) => getComputedStyle(element).display) === "none", "A5 print media must hide the print sidebar");
  const a5Pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assertPdfPageBoxes(a5Pdf, a5SheetCount, 210, 148, "A5 print PDF");
  await page.emulateMedia({ media: "screen" });

  await page.goto(`${origin}/nntn-cookbook/tests/print-layout-harness.html?case=two-up`);
  await page.getByRole("button", { name: /^A4 สูตรเต็ม/ }).click();
  await page.locator(".two-up-sheet").first().waitFor();
  const twoUpGeometry = await page.locator(".two-up-sheet").evaluateAll((sheets) => sheets.map((sheet) => ({
    boundingWidth: sheet.getBoundingClientRect().width,
    boundingHeight: sheet.getBoundingClientRect().height,
    clientWidth: sheet.clientWidth,
    scrollWidth: sheet.scrollWidth,
    clientHeight: sheet.clientHeight,
    scrollHeight: sheet.scrollHeight,
    slotCount: sheet.querySelectorAll(".two-up-slot").length,
  })));
  assert(twoUpGeometry.length === 3, `two-up: expected 3 A4 sheets, got ${twoUpGeometry.length}`);
  assert(
    JSON.stringify(twoUpGeometry.map((sheet) => sheet.slotCount)) === JSON.stringify([2, 2, 1]),
    `two-up: expected odd-tail slots [2,2,1], got ${JSON.stringify(twoUpGeometry.map((sheet) => sheet.slotCount))}`,
  );
  for (const [index, sheet] of twoUpGeometry.entries()) {
    assertMillimeters(sheet.boundingWidth, 210, `two-up sheet ${index + 1} width`);
    assertMillimeters(sheet.boundingHeight, 297, `two-up sheet ${index + 1} height`);
    assert(sheet.scrollWidth === sheet.clientWidth, `two-up sheet ${index + 1}: horizontal clipping ${JSON.stringify(sheet)}`);
    assert(sheet.scrollHeight === sheet.clientHeight, `two-up sheet ${index + 1}: vertical clipping ${JSON.stringify(sheet)}`);
  }
  const twoUpSlots = await page.locator(".two-up-slot").evaluateAll((slots) => slots.map((slot) => ({
    slotHeight: slot.getBoundingClientRect().height,
    cardHeight: slot.querySelector(".workstation-card")?.getBoundingClientRect().height ?? 0,
    clientWidth: slot.clientWidth,
    scrollWidth: slot.scrollWidth,
    clientHeight: slot.clientHeight,
    scrollHeight: slot.scrollHeight,
  })));
  assert(twoUpSlots.length === 5, `two-up: expected 5 slots/cards, got ${twoUpSlots.length}`);
  for (const [index, slot] of twoUpSlots.entries()) {
    assertMillimeters(slot.slotHeight, 148, `two-up slot ${index + 1} height`);
    assertMillimeters(slot.cardHeight, 148, `two-up card ${index + 1} height`);
    assert(slot.scrollWidth === slot.clientWidth, `two-up slot ${index + 1}: horizontal clipping ${JSON.stringify(slot)}`);
    assert(slot.scrollHeight === slot.clientHeight, `two-up slot ${index + 1}: vertical clipping ${JSON.stringify(slot)}`);
  }
  await page.emulateMedia({ media: "print" });
  assert(await page.locator(".print-center-header").evaluate((element) => getComputedStyle(element).display) === "none", "A4 two-up print media must hide the page header");
  assert(await page.locator(".print-sidebar").evaluate((element) => getComputedStyle(element).display) === "none", "A4 two-up print media must hide the print sidebar");
  const twoUpPdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assertPdfPageBoxes(twoUpPdf, 3, 210, 297, "A4 two-up print PDF");
  await page.emulateMedia({ media: "screen" });

  const rejectedScenarios = [
    ["header-regional-plus-one", "หัวเอกสาร"],
    ["header-combining-plus-one", "หัวเอกสาร"],
    ["ingredient-16-rejected", "วัตถุดิบ"],
    ["ingredient-item-plus-one", "วัตถุดิบ"],
    ["ingredient-source-plus-one", "วัตถุดิบ"],
    ["ingredient-row-plus-one", "วัตถุดิบ"],
    ["ingredient-region-plus-one", "วัตถุดิบ"],
    ["ingredient-emoji-overflow-rejected", "วัตถุดิบ"],
    ["media-count-plus-one", "ขั้นตอน"],
    ["media-caption-plus-one", "รายละเอียดรูป"],
    ["media-alt-plus-one", "รายละเอียดรูป"],
    ["media-measurement-plus-one", "รายละเอียดรูป"],
    ["media-region-plus-one", "รายละเอียดรูป"],
    ["media-keycap-plus-one", "รายละเอียดรูป"],
    ["media-keycap-overflow-rejected", "รายละเอียดรูป"],
    ["media-keycap-vs15-plus-one", "รายละเอียดรูป"],
    ["media-keycap-vs15-overflow-rejected", "รายละเอียดรูป"],
    ["media-keycap-repeated-vs16-plus-one", "รายละเอียดรูป"],
    ["media-keycap-repeated-vs16-overflow-rejected", "รายละเอียดรูป"],
    ["media-keycap-mixed-selectors-plus-one", "รายละเอียดรูป"],
    ["media-keycap-mixed-selectors-overflow-rejected", "รายละเอียดรูป"],
    ["step-wide-plus-one", "ขั้นตอน"],
    ["step-lines-plus-one", "ขั้นตอน"],
    ["step-tabs-plus-one", "ขั้นตอน"],
    ["combined-wide-plus-one", "องค์ประกอบรวม"],
    ["combined-plus-one-rejected", "องค์ประกอบรวม"],
  ];
  for (const [scenario, expectedSection] of rejectedScenarios) {
    await page.goto(`${origin}/nntn-cookbook/tests/print-layout-harness.html?case=${scenario}`);
    await page.getByRole("alert").waitFor({ timeout: 2_000 });
    assert(await page.locator(".workstation-sheet, .two-up-sheet").count() === 0, `${scenario}: boundary + 1 must render zero sheets`);
    const alertText = await page.getByRole("alert").textContent();
    assert(alertText?.includes("เกินพื้นที่ A5"), `${scenario}: boundary + 1 must show Thai capacity error`);
    assert(alertText?.includes(expectedSection), `${scenario}: expected named ${expectedSection} error, got ${alertText}`);
  }
  for (const scenario of [
    "control-nul",
    "control-crlf",
    "control-lf",
    "control-tab",
    "control-c1",
    "control-line-separator",
    "control-paragraph-separator",
  ]) {
    await page.goto(`${origin}/nntn-cookbook/tests/print-layout-harness.html?case=${scenario}`);
    await page.getByRole("alert").waitFor({ timeout: 2_000 });
    assert(await page.locator(".workstation-sheet, .two-up-sheet").count() === 0, `${scenario}: invalid control must render zero sheets`);
    const alertText = await page.getByRole("alert").textContent();
    assert(alertText?.includes("ข้อมูลชุดพิมพ์ไม่ถูกต้อง"), `${scenario}: expected Thai invalid-input alert, got ${alertText}`);
    assert(alertText?.includes("<layout-control>"), `${scenario}: expected sanitized control diagnostic, got ${alertText}`);
  }
  assert(externalRequests.length === 0, `unexpected external requests: ${externalRequests.join(", ")}`);
  assert(sampleMediaResponses.length > 0, "expected sample media network responses");
  assert(
    sampleMediaResponses.every((response) => response.status === 200),
    `sample media response failures: ${JSON.stringify(sampleMediaResponses)}`,
  );
} finally {
  await browser?.close();
  await server.close();
}
