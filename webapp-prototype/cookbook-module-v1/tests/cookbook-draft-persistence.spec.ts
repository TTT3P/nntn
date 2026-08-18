import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = resolve(moduleRoot, "node_modules/.cache");
const vaultRoot = resolve(cacheRoot, "cookbook-v5-e2e-vault");
const v4RelativePath =
  "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const checksumRelativePath = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";
const v5RelativePath =
  "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json";
const isolatedYield = "ค่าทดสอบใน isolated vault";
const isolatedSecondYield = "การแก้ไข V5 ครั้งที่สอง";
const approvedV4Sha = "09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d";
const approvedManifestBytes = Buffer.from(
  `${approvedV4Sha}  source/kitchen-sot-first-set-v2.json\n`,
  "utf8",
);

type JsonObject = Record<string, unknown>;

interface DraftReadResponse {
  document: JsonObject;
  sourcePath: string;
  sourceSha256: string;
  base_sha256: string;
  origin: "v4" | "v5-draft";
}

interface DraftSaveResponse {
  document: JsonObject;
  sha256: string;
  base_sha256: string;
  generatedAt: string;
  path: string;
}

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

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function v5DraftFromV4(document: JsonObject, generatedAt: string, sourceSha256: string): JsonObject {
  const draft = structuredClone(document);
  draft.schema_version = "2.1.0-prototype-draft";
  draft.generated_at = generatedAt;
  draft.derived_from = { path: v4RelativePath, sha256: sourceSha256 };
  return draft;
}

function setYield(document: JsonObject, recipeId: number | string, value: string): JsonObject {
  const edited = structuredClone(document);
  recipeById(edited, recipeId).yield_candidate_text = value;
  return edited;
}

async function parseJsonObject(response: APIResponse, label: string): Promise<JsonObject> {
  return requireObject(await response.json(), label);
}

async function loadDraft(request: APIRequestContext): Promise<DraftReadResponse> {
  const v5 = await request.get("/__cookbook/v5-draft", {
    headers: { Accept: "application/json" },
  });
  if (v5.ok()) return await v5.json() as DraftReadResponse;

  expect(v5.status()).toBe(404);
  expect(await parseJsonObject(v5, "missing V5 response")).toEqual({ code: "DRAFT_NOT_FOUND" });
  const v4 = await request.get("/__cookbook/v4", {
    headers: { Accept: "application/json" },
  });
  expect(v4.status()).toBe(200);
  return await v4.json() as DraftReadResponse;
}

async function putDraft(
  request: APIRequestContext,
  baseSha256: string,
  document: JsonObject,
): Promise<APIResponse> {
  return await request.put("/__cookbook/v5-draft", {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "If-Match": `"${baseSha256}"`,
    },
    data: { base_sha256: baseSha256, document },
  });
}

test.describe.serial("isolated Cookbook V5 draft middleware persistence", () => {
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
    expect(sha256(pristineV4Bytes)).toBe(approvedV4Sha);
  });

  test.afterAll(async () => {
    expect(await readFile(resolve(vaultRoot, v4RelativePath))).toEqual(pristineV4Bytes);
    expect(await readFile(resolve(vaultRoot, checksumRelativePath))).toEqual(pristineManifestBytes);
  });

  test("first save from frozen V4 creates a low-noise V5 and GET reopens the saved field", async ({ request }) => {
    const loaded = await loadDraft(request);
    expect(loaded.origin).toBe("v4");
    expect(loaded.sourcePath).toBe(v4RelativePath);
    expect(loaded.sourceSha256).toBe(approvedV4Sha);
    expect(loaded.base_sha256).toBe(approvedV4Sha);

    const v4 = requireObject(loaded.document, "V4 document");
    const draft = setYield(
      v5DraftFromV4(v4, "2026-08-11T10:00:00.000Z", loaded.sourceSha256),
      162,
      isolatedYield,
    );
    const saved = await putDraft(request, loaded.base_sha256, draft);
    expect(saved.status()).toBe(200);
    const receipt = await saved.json() as DraftSaveResponse;
    expect(receipt.base_sha256).toBe(receipt.sha256);
    expect(receipt.generatedAt).toBe("2026-08-11T10:00:00.000Z");
    expect(receipt.path).toBe(v5RelativePath);

    const reopened = await loadDraft(request);
    expect(reopened.origin).toBe("v5-draft");
    expect(reopened.base_sha256).toBe(receipt.sha256);
    expect(recipeById(reopened.document, 162).yield_candidate_text).toBe(isolatedYield);

    const v4Bytes = await readFile(resolve(vaultRoot, v4RelativePath));
    const checksumBytes = await readFile(resolve(vaultRoot, checksumRelativePath));
    expect(v4Bytes).toEqual(pristineV4Bytes);
    expect(checksumBytes).toEqual(pristineManifestBytes);
    expect(sha256(v4Bytes)).toBe(approvedV4Sha);

    const v5Bytes = await readFile(resolve(vaultRoot, v5RelativePath));
    const v5 = requireObject(JSON.parse(v5Bytes.toString("utf8")), "V5 document");
    expect(v5.schema_version).toBe("2.1.0-prototype-draft");
    expect(v5.generated_at).toBe("2026-08-11T10:00:00.000Z");
    expect(v5.derived_from).toEqual({ path: v4RelativePath, sha256: approvedV4Sha });
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
      expect(requireArray(v5Recipe.items, "V5 items").map((item) =>
        requireObject(item, "V5 item").line_key))
        .toEqual(requireArray(v4Recipe.items, "V4 items").map((item) =>
          requireObject(item, "V4 item").line_key));
      expect(requireArray(v5Recipe.items, "V5 items"))
        .toHaveLength(requireArray(v4Recipe.items, "V4 items").length);
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
        .map(identityWithJsonType));
    expect(componentIds(v5)).toEqual(componentIds(v4));
    expect(componentIds(v5).filter(({ type }) => type === "number")).toHaveLength(15);
    expect(componentIds(v5).filter(({ type }) => type === "string")).toHaveLength(3);
  });

  test("a second sequential valid save preserves the first edit and document shape", async ({ request }) => {
    const loaded = await loadDraft(request);
    expect(loaded.origin).toBe("v5-draft");
    expect(recipeById(loaded.document, 162).yield_candidate_text).toBe(isolatedYield);
    const before = structuredClone(loaded.document);
    const second = setYield(before, 164, isolatedSecondYield);
    second.generated_at = "2026-08-11T10:01:00.000Z";

    const saved = await putDraft(request, loaded.base_sha256, second);
    expect(saved.status()).toBe(200);
    const receipt = await saved.json() as DraftSaveResponse;
    expect(receipt.base_sha256).toBe(receipt.sha256);

    const reopened = await loadDraft(request);
    expect(reopened.base_sha256).toBe(receipt.sha256);
    expect(recipeById(reopened.document, 162).yield_candidate_text).toBe(isolatedYield);
    expect(recipeById(reopened.document, 164).yield_candidate_text).toBe(isolatedSecondYield);
    expectCommonObjectKeyOrder(before, reopened.document);
    expect(differencePaths(before, reopened.document).sort()).toEqual([
      "generated_at",
      `recipes[${String(recipes(before).findIndex(({ recipe_id }) => recipe_id === 164))}].yield_candidate_text`,
    ].sort());
    expect(Object.keys(reopened.document)).toEqual(Object.keys(before));
  });

  test("two stale writers from one base keep the first writer bytes authoritative", async ({ request }) => {
    const loaded = await loadDraft(request);
    const writerA = setYield(loaded.document, 162, "ผู้เขียน A");
    writerA.generated_at = "2026-08-11T10:02:00.000Z";
    const writerB = setYield(loaded.document, 162, "ผู้เขียน B");
    writerB.generated_at = "2026-08-11T10:03:00.000Z";

    const first = await putDraft(request, loaded.base_sha256, writerA);
    expect(first.status()).toBe(200);
    const firstReceipt = await first.json() as DraftSaveResponse;
    const authoritativeBytes = await readFile(resolve(vaultRoot, v5RelativePath));
    expect(firstReceipt.sha256).toBe(sha256(authoritativeBytes));

    const stale = await putDraft(request, loaded.base_sha256, writerB);
    expect(stale.status()).toBe(409);
    expect(await parseJsonObject(stale, "stale response")).toEqual({ code: "STALE_DRAFT" });
    expect(await readFile(resolve(vaultRoot, v5RelativePath))).toEqual(authoritativeBytes);

    const reopened = await loadDraft(request);
    expect(reopened.base_sha256).toBe(firstReceipt.sha256);
    expect(recipeById(reopened.document, 162).yield_candidate_text).toBe("ผู้เขียน A");
    expect(recipeById(reopened.document, 164).yield_candidate_text).toBe(isolatedSecondYield);
  });
});
