import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { env } from "node:process";
import { expect, test } from "@playwright/test";

test("Recipe Studio follows the approved desktop and mobile structure", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("./#/source-review");
  await expect(page.getByRole("heading", { name: "กรอกสูตรจากทีมครัว" })).toBeVisible();

  const appHeader = page.locator(".app-header");
  await expect(appHeader).toHaveCSS("background-color", "rgb(23, 61, 32)");

  const queue = page.getByRole("navigation", { name: "คิวสูตร Kitchen SOT" });
  const detail = page.getByRole("article", { name: /รายละเอียดสูตร/u });
  const folioHeader = detail.locator(":scope > header");
  await expect(detail.getByText("แฟ้มสูตรครัว · เมนูขาย")).toBeVisible();
  await expect(folioHeader).toHaveCSS("background-color", "rgb(23, 61, 32)");
  await expect(folioHeader).toHaveCSS("border-top-color", "rgb(216, 185, 104)");
  const queueBox = await queue.boundingBox();
  const detailBox = await detail.boundingBox();
  expect(queueBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(queueBox!.x + queueBox!.width).toBeLessThanOrEqual(detailBox!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  if (env.RECIPE_STUDIO_EVIDENCE_DIR !== undefined) {
    await mkdir(env.RECIPE_STUDIO_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({
      path: resolve(env.RECIPE_STUDIO_EVIDENCE_DIR, "recipe-studio-desktop.png"),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileQueueBox = await queue.boundingBox();
  const mobileDetailBox = await detail.boundingBox();
  expect(mobileQueueBox).not.toBeNull();
  expect(mobileDetailBox).not.toBeNull();
  expect(mobileDetailBox!.y).toBeGreaterThanOrEqual(mobileQueueBox!.y + mobileQueueBox!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (env.RECIPE_STUDIO_EVIDENCE_DIR !== undefined) {
    await page.screenshot({
      path: resolve(env.RECIPE_STUDIO_EVIDENCE_DIR, "recipe-studio-mobile.png"),
      fullPage: true,
    });
  }
});
