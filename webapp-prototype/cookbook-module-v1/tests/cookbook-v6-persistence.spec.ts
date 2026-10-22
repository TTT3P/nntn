import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const v6Path = resolve(
  "node_modules/.cache/cookbook-v6-e2e-vault",
  "Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json",
);

test("persists the first editor save and rejects a stale second page without losing its form", async ({ browser }) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  await Promise.all([
    pageA.goto("./#/recipes/RCP-011/edit"),
    pageB.goto("./#/recipes/RCP-011/edit"),
  ]);
  await Promise.all([
    expect(pageA.getByRole("heading", { name: "แก้ไขสูตร" })).toBeVisible(),
    expect(pageB.getByRole("heading", { name: "แก้ไขสูตร" })).toBeVisible(),
  ]);

  await pageA.getByRole("button", { name: "เพิ่มวัตถุดิบ" }).click();
  await pageA.getByLabel("ชื่อวัตถุดิบ รายการ 1").fill("น้ำมันรำข้าว");
  await pageA.getByLabel("ปริมาณ รายการ 1").fill("2");
  await pageA.getByLabel("หน่วย รายการ 1").selectOption("ช้อนโต๊ะ");
  await pageA.getByRole("button", { name: "บันทึกสูตร" }).click();
  await expect(pageA.getByRole("status")).toHaveText("บันทึกสูตรแล้ว");

  await pageA.reload();
  await expect(pageA.getByLabel("ชื่อวัตถุดิบ รายการ 1")).toHaveValue("น้ำมันรำข้าว");
  await expect(pageA.getByLabel("ปริมาณ รายการ 1")).toHaveValue("2");
  await expect(pageA.getByLabel("หน่วย รายการ 1")).toHaveValue("ช้อนโต๊ะ");

  await pageB.getByRole("button", { name: "เพิ่มวัตถุดิบ" }).click();
  await pageB.getByLabel("ชื่อวัตถุดิบ รายการ 1").fill("น้ำปลาสำหรับหน้าครัว");
  await pageB.getByRole("button", { name: "บันทึกสูตร" }).click();
  await expect(pageB.getByRole("alert")).toContainText("มีการบันทึกจากหน้าต่างอื่น");
  await expect(pageB.getByLabel("ชื่อวัตถุดิบ รายการ 1")).toHaveValue("น้ำปลาสำหรับหน้าครัว");

  const bytes = await readFile(v6Path, "utf8");
  expect(bytes).toContain("น้ำมันรำข้าว");
  expect(bytes).not.toContain("น้ำปลาสำหรับหน้าครัว");
  await context.close();
});

test("uses one saved workstage projection in the editor, Work, and Print Center", async ({ page }) => {
  const ingredientName = "เนื้อแดดเดียว";
  const movedStep = "ก่อนแพ็ค ตัดเนื้อให้เป็นชิ้นพอดีคำ ความยาวประมาณ 1.5 นิ้ว";

  await page.goto("./#/recipes/RCP-021/edit");
  await expect(page.getByRole("heading", { name: "แก้ไขสูตร" })).toBeVisible();

  const ingredientStages = page.getByRole("group", {
    name: "พิมพ์วัตถุดิบนี้ในใบงาน รายการ 1",
  });
  await expect(ingredientStages.getByRole("checkbox", { name: "ปรุง" })).toBeChecked();
  await expect(ingredientStages.getByRole("checkbox", { name: "จัดเสิร์ฟ" })).toBeChecked();
  await ingredientStages.getByRole("checkbox", { name: "เตรียม" }).check();
  await ingredientStages.getByRole("checkbox", { name: "ปรุง" }).uncheck();
  await page.getByLabel("จุดงานของขั้นตอน ขั้นตอน 1").selectOption("service");

  await page.getByRole("button", { name: "บันทึกสูตร" }).click();
  await expect(page.getByRole("status")).toHaveText("บันทึกสูตรแล้ว");

  await page.reload();
  await expect(ingredientStages.getByRole("checkbox", { name: "เตรียม" })).toBeChecked();
  await expect(ingredientStages.getByRole("checkbox", { name: "ปรุง" })).not.toBeChecked();
  await expect(ingredientStages.getByRole("checkbox", { name: "จัดเสิร์ฟ" })).toBeChecked();
  await expect(page.getByLabel("จุดงานของขั้นตอน ขั้นตอน 1")).toHaveValue("service");

  await page.goto("./#/work/RCP-021?stage=prep");
  const prepWork = page.getByRole("article", { name: "ข้าวขยำเนื้อแดดเดียว", exact: true });
  await expect(prepWork.getByText(ingredientName, { exact: true })).toBeVisible();
  await expect(prepWork.getByText(movedStep, { exact: true })).toHaveCount(0);

  await page.goto("./#/work/RCP-021?stage=cook");
  const cookWork = page.getByRole("article", { name: "ข้าวขยำเนื้อแดดเดียว", exact: true });
  await expect(cookWork.getByText(ingredientName, { exact: true })).toHaveCount(0);
  await expect(cookWork.getByText(movedStep, { exact: true })).toHaveCount(0);

  await page.goto("./#/work/RCP-021?stage=service");
  const serviceWork = page.getByRole("article", { name: "ข้าวขยำเนื้อแดดเดียว", exact: true });
  await expect(serviceWork.getByText(ingredientName, { exact: true })).toBeVisible();
  await expect(serviceWork.getByText(movedStep, { exact: true })).toBeVisible();

  await page.goto("./#/print");
  await page.getByRole("searchbox", { name: "ค้นหาสูตร" }).fill("RCP-021");
  await page.getByRole("checkbox", { name: "ข้าวขยำเนื้อแดดเดียว · RCP-021" }).check();
  await page.locator("details.print-advanced > summary").click();
  const printStage = page.getByRole("combobox", { name: "จุดงานที่จะพิมพ์" });

  await printStage.selectOption("prep");
  const prepPrint = page.getByRole("article", { name: /ข้าวขยำเนื้อแดดเดียว · ผลิตซอสและของเตรียม/u });
  await expect(prepPrint.getByRole("rowheader", { name: new RegExp(`^${ingredientName}`, "u") })).toBeVisible();
  await expect(prepPrint.getByText(movedStep, { exact: true })).toHaveCount(0);

  await printStage.selectOption("cook");
  const cookPrint = page.getByRole("article", { name: /ข้าวขยำเนื้อแดดเดียว · ครัวปรุง/u });
  await expect(cookPrint.getByRole("rowheader", { name: new RegExp(`^${ingredientName}`, "u") })).toHaveCount(0);
  await expect(cookPrint.getByText(movedStep, { exact: true })).toHaveCount(0);

  await printStage.selectOption("service");
  const servicePrint = page.getByRole("article", { name: /ข้าวขยำเนื้อแดดเดียว · จัดเสิร์ฟหน้าร้าน/u });
  await expect(servicePrint.getByRole("rowheader", { name: new RegExp(`^${ingredientName}`, "u") })).toBeVisible();
  await expect(servicePrint.getByText(movedStep, { exact: true })).toBeVisible();
});
