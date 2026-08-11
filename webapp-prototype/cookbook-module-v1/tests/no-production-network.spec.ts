import { expect, test } from "./browser-guards";

test("keeps normal Cookbook browsing and printing on the isolated loopback service", async ({
  page,
  strictBrowserBoundary,
}) => {
  for (const route of [
    "./#/recipes",
    "./#/recipes?view=compact",
    "./#/recipes?mode=work",
    "./#/recipes?mode=manage",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("main")).toBeVisible();
    await strictBrowserBoundary.drain();
  }

  await page.goto("./#/recipes");
  await expect(page.getByRole("heading", { name: "สูตรอาหาร" })).toBeVisible();
  await page.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" }).fill("ข้าวหน้าเนื้อตุ๋น");
  const stewedBeefRiceLink = page.getByRole("link", { name: /^ข้าวหน้าเนื้อตุ๋น(?:\s|$)/u });
  await expect(stewedBeefRiceLink).toHaveAttribute("href", "#/recipes/RCP-071");
  await expect(stewedBeefRiceLink).toBeVisible();
  await stewedBeefRiceLink.click();
  await expect(page).toHaveURL(/#\/recipes\/RCP-071$/u);
  await expect(page.getByRole("navigation", { name: "สูตรที่ใช้ร่วมกัน" })).toBeVisible();
  await strictBrowserBoundary.drain();

  for (const stage of ["prep", "cook", "service", "all"] as const) {
    await page.goto(`./#/work/RCP-071?stage=${stage}`);
    await expect(page.getByRole("heading", { name: "ข้าวหน้าเนื้อตุ๋น", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "จุดงานไม่ถูกต้อง" })).toHaveCount(0);
    await strictBrowserBoundary.drain();
  }

  await page.goto("./#/print");
  await expect(page.getByRole("heading", { name: "ศูนย์การพิมพ์" })).toBeVisible();
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
  await expect(page.locator(".two-up-sheet")).toHaveCount(2);
  await strictBrowserBoundary.drain();
});
