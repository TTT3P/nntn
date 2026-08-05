import { Buffer } from "node:buffer";
import { expect, test } from "./browser-guards";

test("keeps every router surface and representative interaction read-only on loopback", async ({
  page,
  strictBrowserBoundary,
}) => {
  await page.goto("./#/recipes");
  await expect(page.getByRole("heading", { name: "คลังสูตรอาหาร" })).toBeVisible();
  await page.getByRole("searchbox", { name: "ค้นหาสูตรอาหาร" }).fill("ข้าวหน้าเนื้อตุ๋น");
  await page.getByRole("link", { name: "ข้าวหน้าเนื้อตุ๋น", exact: true }).click();
  await expect(page).toHaveURL(/#\/recipes\/165$/u);
  await page.getByRole("button", { name: "แสดงสูตรที่เกี่ยวข้อง" }).click();
  await expect(page.getByRole("navigation", { name: "โครงสร้างสูตรที่เกี่ยวข้อง" })).toBeVisible();
  await strictBrowserBoundary.drain();

  await page.goto("./#/recipes/165");
  await expect(page.getByRole("heading", { name: "ข้าวหน้าเนื้อตุ๋น" })).toBeVisible();
  await strictBrowserBoundary.drain();

  await page.goto("./#/source-review");
  await expect(page.getByRole("heading", { name: /ตรวจสอบแหล่งข้อมูล/u })).toBeVisible();
  await strictBrowserBoundary.drain();

  for (const stage of ["prep", "cook", "service", "all"] as const) {
    await page.goto(`./#/work/165?stage=${stage}`);
    await expect(page.getByRole("heading", { name: "ข้าวหน้าเนื้อตุ๋น", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "จุดงานไม่ถูกต้อง" })).toHaveCount(0);
    if (stage === "service") {
      const mediaSearch = page.getByRole("searchbox", { name: /^เลือกจากคลังรูป/u }).first();
      await mediaSearch.fill("DEMO");
      await mediaSearch.clear();
      await page.getByRole("combobox", { name: /^ชนิดรูป/u }).first().selectOption("final");
      await page.getByRole("combobox", { name: /^ภาชนะ/u }).first().selectOption("delivery_box");
    }
    await strictBrowserBoundary.drain();
  }

  await page.goto("./#/print");
  await expect(page.getByRole("heading", { name: "ศูนย์การพิมพ์" })).toBeVisible();
  for (const name of [
    "ข้าวหน้าเนื้อตุ๋น · รหัส 165",
    "ข้าวหน้าเนื้อยากินิกุ · รหัส 159",
    "ข้าวขยำเนื้อแดดเดียว · รหัส 37",
  ]) {
    await page.getByRole("checkbox", { name }).check();
  }
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");
  await page.getByRole("combobox", { name: /^แม่แบบ/u }).selectOption("two-up");
  await expect(page.locator(".two-up-sheet")).toHaveCount(2);
  await strictBrowserBoundary.drain();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export prototype snapshot" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
  await strictBrowserBoundary.drain();
});
