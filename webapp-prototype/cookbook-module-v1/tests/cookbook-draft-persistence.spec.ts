import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = resolve(moduleRoot, "node_modules/.cache");
const vaultRoot = resolve(cacheRoot, "cookbook-v5-e2e-vault");
const v4RelativePath =
  "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const checksumRelativePath = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";
const v5RelativePath =
  "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json";
const derivedFromPath = v4RelativePath;
const isolatedYield = "ค่าทดสอบใน isolated vault";
const approvedV4Sha = "09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d";
const approvedManifestBytes = Buffer.from(
  `${approvedV4Sha}  source/kitchen-sot-first-set-v2.json\n`,
  "utf8",
);

type JsonObject = Record<string, unknown>;

function requireObject(value: unknown, label: string): JsonObject {
  expect(value, label).not.toBeNull();
  expect(Array.isArray(value), label).toBe(false);
  expect(typeof value, label).toBe("object");
  return value as JsonObject;
}

function requireArray(value: unknown, label: string): unknown[] {
  expect(Array.isArray(value), label).toBe(true);
  return value as unknown[];
}

function recipes(document: JsonObject): JsonObject[] {
  return requireArray(document.recipes, "recipes").map((value, index) =>
    requireObject(value, `recipes[${String(index)}]`),
  );
}

function recipeById(document: JsonObject, recipeId: number | string): JsonObject {
  const recipe = recipes(document).find(({ recipe_id }) => recipe_id === recipeId);
  expect(recipe, `recipe ${String(recipeId)}`).toBeDefined();
  return recipe!;
}

function differencePaths(left: unknown, right: unknown, path = ""): string[] {
  if (Object.is(left, right)) return [];
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return [path];
    return left.flatMap((value, index) =>
      differencePaths(value, right[index], `${path}[${String(index)}]`),
    );
  }
  if (
    typeof left === "object" && left !== null && !Array.isArray(left) &&
    typeof right === "object" && right !== null && !Array.isArray(right)
  ) {
    const leftObject = left as JsonObject;
    const rightObject = right as JsonObject;
    const keys = [...new Set([...Object.keys(leftObject), ...Object.keys(rightObject)])];
    return keys.flatMap((key) =>
      differencePaths(
        leftObject[key],
        rightObject[key],
        path === "" ? key : `${path}.${key}`,
      ),
    );
  }
  return [path];
}

function identityWithJsonType(value: unknown): { type: string; value: unknown } {
  return { type: typeof value, value };
}

function expectCommonObjectKeyOrder(left: unknown, right: unknown, path = "document"): void {
  if (Array.isArray(left) && Array.isArray(right)) {
    expect(right, `${path} array length`).toHaveLength(left.length);
    for (let index = 0; index < left.length; index += 1) {
      expectCommonObjectKeyOrder(left[index], right[index], `${path}[${String(index)}]`);
    }
    return;
  }
  if (
    typeof left !== "object" || left === null || Array.isArray(left) ||
    typeof right !== "object" || right === null || Array.isArray(right)
  ) return;

  const leftObject = left as JsonObject;
  const rightObject = right as JsonObject;
  const leftKeys = Object.keys(leftObject);
  const rightCommonKeys = Object.keys(rightObject).filter((key) => key in leftObject);
  expect(rightCommonKeys, `${path} key order`).toEqual(leftKeys);
  for (const key of leftKeys) {
    expectCommonObjectKeyOrder(leftObject[key], rightObject[key], `${path}.${key}`);
  }
}

async function openRecipe(page: Page, recipeName: RegExp): Promise<void> {
  await page.goto("./#/source-review");
  await expect(page.getByRole("heading", { name: "Recipe Studio: ร่าง Kitchen SOT V5" }))
    .toBeVisible();
  await page.getByRole("button", { name: recipeName }).click();
}

async function editYield(page: Page, value: string): Promise<void> {
  const input = page.getByLabel("ผลผลิตจากหน้าครัว");
  await input.fill(value);
  await input.blur();
  await expect(page.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeEnabled();
}

test.describe.serial("isolated Cookbook V5 draft persistence", () => {
  let pristineV4Bytes: Buffer;
  let pristineManifestBytes: Buffer;

  test.beforeAll(async () => {
    expect(vaultRoot).toBe(resolve(moduleRoot, "node_modules/.cache/cookbook-v5-e2e-vault"));
    expect(relative(cacheRoot, vaultRoot)).toBe("cookbook-v5-e2e-vault");
    expect(await realpath(cacheRoot)).toBe(cacheRoot);
    expect(await realpath(vaultRoot)).toBe(vaultRoot);
    pristineV4Bytes = await readFile(resolve(vaultRoot, v4RelativePath));
    pristineManifestBytes = await readFile(resolve(vaultRoot, checksumRelativePath));
    expect(pristineManifestBytes).toEqual(approvedManifestBytes);
    expect(createHash("sha256").update(pristineV4Bytes).digest("hex")).toBe(approvedV4Sha);
  });

  test.afterAll(async () => {
    expect(await readFile(resolve(vaultRoot, v4RelativePath))).toEqual(pristineV4Bytes);
    expect(await readFile(resolve(vaultRoot, checksumRelativePath))).toEqual(pristineManifestBytes);
  });

  test("saves an unrelated field, reopens it, and preserves the frozen document shape", async ({ browser }) => {
    const page = await browser.newPage();
    await openRecipe(page, /ผงคั่วพริกเกลือ/u);
    await editYield(page, isolatedYield);
    await page.getByRole("button", { name: "บันทึกฉบับร่าง V5" }).click();
    await expect(page.getByRole("status", { name: "สถานะการบันทึก" })).toContainText("บันทึกแล้ว");

    await page.getByRole("button", { name: /ข้าวหน้าเนื้อยากินิกุ/u }).click();
    await expect(page.getByRole("status", { name: "สถานะสูตร" })).toHaveText("DRAFT");
    await expect(page.getByText("ข้อมูลยืนยันเจ้าของไม่ครบ", { exact: true })).toBeVisible();
    await page.close();

    const reopened = await browser.newPage();
    await openRecipe(reopened, /ข้าวหน้าเนื้อยากินิกุ/u);
    await expect(reopened.getByRole("status", { name: "สถานะสูตร" })).toHaveText("DRAFT");
    await expect(reopened.getByText("ข้อมูลยืนยันเจ้าของไม่ครบ", { exact: true })).toBeVisible();
    await reopened.getByRole("button", { name: /ผงคั่วพริกเกลือ/u }).click();
    await expect(reopened.getByLabel("ผลผลิตจากหน้าครัว")).toHaveValue(isolatedYield);
    await reopened.close();

    const v4Bytes = await readFile(resolve(vaultRoot, v4RelativePath));
    const checksumBytes = await readFile(resolve(vaultRoot, checksumRelativePath));
    expect(v4Bytes).toEqual(pristineV4Bytes);
    expect(checksumBytes).toEqual(pristineManifestBytes);
    const checksumText = checksumBytes.toString("utf8");
    const checksumMatch =
      /^([a-f0-9]{64}) {2}source\/kitchen-sot-first-set-v2\.json\n$/u.exec(checksumText);
    expect(checksumMatch).not.toBeNull();
    const expectedV4Sha = checksumMatch![1]!;
    expect(createHash("sha256").update(v4Bytes).digest("hex")).toBe(expectedV4Sha);

    const v5Bytes = await readFile(resolve(vaultRoot, v5RelativePath));
    const v4 = requireObject(JSON.parse(v4Bytes.toString("utf8")), "V4 document");
    const v5 = requireObject(JSON.parse(v5Bytes.toString("utf8")), "V5 document");
    expect(v5.schema_version).toBe("2.1.0-prototype-draft");
    expect(v5.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    expect(v5.derived_from).toEqual({ path: derivedFromPath, sha256: expectedV4Sha });
    expect(Object.keys(v5)).toEqual([...Object.keys(v4), "derived_from"]);
    expect(Object.keys(requireObject(v5.derived_from, "derived_from"))).toEqual(["path", "sha256"]);
    expect(v5Bytes).toEqual(Buffer.from(`${JSON.stringify(v5, null, 2)}\n`, "utf8"));
    expectCommonObjectKeyOrder(v4, v5);

    const targetIndex = recipes(v4).findIndex(({ recipe_id }) => recipe_id === 162);
    expect(targetIndex).toBeGreaterThanOrEqual(0);
    expect(differencePaths(v4, v5).sort()).toEqual([
      "derived_from",
      "generated_at",
      `recipes[${String(targetIndex)}].yield_candidate_text`,
      "schema_version",
    ].sort());

    expect(recipeById(v5, 159).items).toEqual(recipeById(v4, 159).items);
    expect(recipes(v5).map(({ recipe_id }) => recipe_id))
      .toEqual(recipes(v4).map(({ recipe_id }) => recipe_id));
    for (const v4Recipe of recipes(v4)) {
      const v5Recipe = recipeById(v5, v4Recipe.recipe_id as number | string);
      expect(requireArray(v5Recipe.items, "V5 items").map((item) => requireObject(item, "V5 item").line_key))
        .toEqual(requireArray(v4Recipe.items, "V4 items").map((item) => requireObject(item, "V4 item").line_key));
      const v4Items = requireArray(v4Recipe.items, "V4 items");
      const v5Items = requireArray(v5Recipe.items, "V5 items");
      expect(v5Items).toHaveLength(v4Items.length);
    }

    const v4RecipeIds = recipes(v4).map(({ recipe_id }) => identityWithJsonType(recipe_id));
    const v5RecipeIds = recipes(v5).map(({ recipe_id }) => identityWithJsonType(recipe_id));
    expect(v5RecipeIds).toEqual(v4RecipeIds);
    expect(v5RecipeIds.filter(({ type }) => type === "number")).toHaveLength(16);
    expect(v5RecipeIds.filter(({ type }) => type === "string")).toHaveLength(2);

    const componentIds = (document: JsonObject) => recipes(document).flatMap((recipe) =>
      requireArray(recipe.items, "items")
        .map((item) => requireObject(item, "item").component_recipe_id)
        .filter((value) => value !== null)
        .map(identityWithJsonType),
    );
    expect(componentIds(v5)).toEqual(componentIds(v4));
    expect(componentIds(v5).filter(({ type }) => type === "number")).toHaveLength(15);
    expect(componentIds(v5).filter(({ type }) => type === "string")).toHaveLength(3);
  });

  test("rejects a stale second page and keeps the first page bytes authoritative", async ({ browser }) => {
    const pageA = await browser.newPage();
    const pageB = await browser.newPage();
    await openRecipe(pageA, /ผงคั่วพริกเกลือ/u);
    await openRecipe(pageB, /ผงคั่วพริกเกลือ/u);

    await editYield(pageA, "ผู้เขียน A");
    await editYield(pageB, "ผู้เขียน B");
    await pageA.getByRole("button", { name: "บันทึกฉบับร่าง V5" }).click();
    await expect(pageA.getByRole("status", { name: "สถานะการบันทึก" })).toContainText("บันทึกแล้ว");
    const authoritativeBytes = await readFile(resolve(vaultRoot, v5RelativePath));

    await pageB.getByRole("button", { name: "บันทึกฉบับร่าง V5" }).click();
    await expect(pageB.getByRole("alert")).toContainText("ต้องโหลดหน้าใหม่");
    await expect(pageB.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeDisabled();
    expect(await readFile(resolve(vaultRoot, v5RelativePath))).toEqual(authoritativeBytes);
    expect(recipeById(
      requireObject(JSON.parse(authoritativeBytes.toString("utf8")), "authoritative V5"),
      162,
    ).yield_candidate_text).toBe("ผู้เขียน A");

    await pageA.close();
    await pageB.close();
  });
});
