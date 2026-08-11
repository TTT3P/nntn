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
