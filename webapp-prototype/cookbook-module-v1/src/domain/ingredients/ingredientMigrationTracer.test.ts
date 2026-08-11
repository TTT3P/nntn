import { describe, expect, test } from "vitest";
import legacyV1 from "../../../../outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json";
import firstSetFixture from "../../data/fixtures/first-set.json";
import { InMemoryIngredientMasterStore } from "../../data/ingredients/InMemoryIngredientMasterStore";
import { makeSourceManifest } from "../../test/ingredientBuilders";
import { parseKitchenSotDocument } from "../sot/kitchenSotDocument";
import {
  buildLegacyIngredientInventoryReport,
  stageCookbookV6FirstSet,
  stageLegacyIngredientSnapshot,
} from "./legacyIngredientSnapshot";
import {
  buildIngredientMigrationReport,
  serializeIngredientMaster,
} from "./ingredientMigrationReport";
import { parseIngredientMaster } from "./parseIngredientMaster";
import { publishReconciliationBatch } from "./publishIngredientMaster";
import {
  buildReconciliationQueue,
  recordReconciliationDecision,
} from "./reconciliation";
import { relinkRecipeIngredients } from "./relinkRecipeIngredients";
import type {
  CostObservation,
  IngredientMasterSnapshot,
  ReconciliationAction,
  ReconciliationDecision,
  UsableYieldEvidence,
} from "./types";

const SOURCE_SHA = "8".repeat(64);
const MANIFEST_ID = "v1";
const GENERATED_AT = "2026-08-11T12:00:00.000Z";

const cases = [
  {
    itemId: 1,
    lineId: "line-generic-oyster",
    name: "ซอสหอยนางรม",
    action: {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: null,
    },
  },
  {
    itemId: 2,
    lineId: "line-mae-krua",
    name: "ซอสหอยนางรม แม่ครัว",
    action: {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: "spec-mae-krua",
    },
  },
  {
    itemId: 3,
    lineId: "line-unrefined-sugar",
    name: "น้ำตาลทรายไม่ขัดสี",
    action: {
      type: "link_ingredient",
      ingredientId: "ing-sugar",
      requiredSpecificationId: "spec-sugar-unrefined",
    },
  },
  {
    itemId: 4,
    lineId: "line-white-sugar",
    name: "น้ำตาลทรายขาว",
    action: {
      type: "link_ingredient",
      ingredientId: "ing-sugar",
      requiredSpecificationId: "spec-sugar-white",
    },
  },
  {
    itemId: 5,
    lineId: "line-inactive-label",
    name: "ซีอิ๊ว ฉลากเก่า",
    action: {
      type: "link_ingredient",
      ingredientId: "ing-soy-sauce",
      requiredSpecificationId: "spec-soy-old",
    },
  },
  {
    itemId: 6,
    lineId: "line-missing-price",
    name: "เนื้อสดหมักนุ่ม",
    action: {
      type: "link_ingredient",
      ingredientId: "ing-unpriced-meat",
      requiredSpecificationId: "spec-unpriced-meat",
    },
  },
  {
    itemId: 7,
    lineId: "line-unmapped",
    name: "ไม่พบชื่อวัตถุดิบ",
    action: { type: "mark_unmapped", reason: "Legacy ingredient ID 999 is absent" },
  },
  {
    itemId: 8,
    lineId: "line-cooked-rice",
    name: "ข้าวหุงสุก",
    action: { type: "link_component_recipe", componentRecipeId: "recipe-cooked-rice" },
  },
] as const satisfies readonly {
  itemId: number;
  lineId: string;
  name: string;
  action: ReconciliationAction;
}[];

function approvedYield(specificationId: string): UsableYieldEvidence {
  return {
    yieldEvidenceId: `yield:${specificationId}`,
    specificationId,
    mode: "no_adjustment",
    factor: 1,
    sourceReference: "owner-reviewed-fixture",
    approvalState: "approved",
  };
}

function approvedObservation(specificationId: string): CostObservation {
  return {
    observationId: `observation:${specificationId}`,
    specificationId,
    stockItemId: null,
    price: 10,
    currency: "THB",
    purchaseQuantity: 1,
    purchaseUnit: "g",
    effectiveAt: "2026-08-10T00:00:00.000Z",
    recordedAt: GENERATED_AT,
    sourceReference: "owner-reviewed-fixture",
    approvalState: "approved",
  };
}

function sourceFixture() {
  return {
    ingredients: [],
    recipes: [{ recipe_id: 101 }],
    recipe_items: cases.map(({ itemId, name }) => ({
      item_id: itemId,
      recipe_id: 101,
      item_kind: "direct_ingredient",
      ingredient_id: itemId === 7 ? 999 : itemId,
      item_name: name,
    })),
  };
}

function manifest() {
  return makeSourceManifest(
    { ingredient: 0, recipe: 1, recipe_line: 8, direct_line: 8, component_line: 0 },
    {
      manifestId: MANIFEST_ID,
      sourcePath: "fixtures/ingredient-tracer-v1.json",
      sha256: SOURCE_SHA,
      byteLength: 2048,
    },
  );
}

function emptySnapshot(): IngredientMasterSnapshot {
  const specifications: IngredientMasterSnapshot["specifications"] = [
    {
      specificationId: "spec-mae-krua",
      ingredientId: "ing-oyster",
      label: "แม่ครัว",
      attributes: { brand: "Mae Krua" },
      status: "active",
      approvalState: "approved",
    },
    {
      specificationId: "spec-sugar-unrefined",
      ingredientId: "ing-sugar",
      label: "ทรายไม่ขัดสี",
      attributes: { form: "unrefined" },
      status: "active",
      approvalState: "approved",
    },
    {
      specificationId: "spec-sugar-white",
      ingredientId: "ing-sugar",
      label: "ทรายขาว",
      attributes: { form: "white" },
      status: "active",
      approvalState: "approved",
    },
    {
      specificationId: "spec-soy-old",
      ingredientId: "ing-soy-sauce",
      label: "ฉลากใหม่หลังเลิกใช้",
      attributes: {},
      status: "active",
      approvalState: "approved",
    },
    {
      specificationId: "spec-unpriced-meat",
      ingredientId: "ing-unpriced-meat",
      label: "เนื้อสดหมักนุ่ม",
      attributes: {},
      status: "active",
      approvalState: "approved",
    },
  ];
  const pricedSpecificationIds = specifications
    .map(({ specificationId }) => specificationId)
    .filter((specificationId) => specificationId !== "spec-unpriced-meat");

  return {
    schemaVersion: "1.0.0",
    generatedAt: "2026-08-11T00:00:00.000Z",
    sourceManifests: [manifest()],
    legacySourceRecords: [],
    ingredients: [
      { ingredientId: "ing-oyster", primaryName: "ซอสหอยนางรม", category: "seasoning", status: "active", costingState: "requires_specification" },
      { ingredientId: "ing-sugar", primaryName: "น้ำตาล", category: "seasoning", status: "active", costingState: "requires_specification" },
      { ingredientId: "ing-soy-sauce", primaryName: "ซีอิ๊ว", category: "seasoning", status: "active", costingState: "requires_specification" },
      { ingredientId: "ing-unpriced-meat", primaryName: "เนื้อสดหมักนุ่ม", category: "meat", status: "active", costingState: "requires_specification" },
    ],
    specifications,
    aliases: [],
    redirects: [],
    mappings: [
      { mappingId: "mapping-mae-krua-700ml", specificationId: "spec-mae-krua", stockItemId: "stock-mae-krua-700ml", approvalState: "approved" },
      { mappingId: "mapping-mae-krua-4-5l", specificationId: "spec-mae-krua", stockItemId: "stock-mae-krua-4-5l", approvalState: "approved" },
    ],
    unitConversions: [],
    usableYields: specifications.map(({ specificationId }) => approvedYield(specificationId)),
    costObservations: pricedSpecificationIds.map(approvedObservation),
    reconciliationDecisions: [],
    recipeLineLinks: [],
  };
}

function decisionsFor(
  stagedSnapshot: IngredientMasterSnapshot,
): ReconciliationDecision[] {
  const proposals = buildReconciliationQueue(
    { records: stagedSnapshot.legacySourceRecords },
    stagedSnapshot,
  );

  return cases.map(({ itemId, action }) => {
    const sourceRecordId = `recipe_line:${itemId}`;
    const proposal = proposals.find((candidate) =>
      candidate.sourceRecordId === sourceRecordId && candidate.actionType === action.type);
    expect(proposal, `${sourceRecordId}:${action.type}`).toBeDefined();
    return recordReconciliationDecision(proposal!, {
      decisionId: `decision:${itemId}`,
      proposalId: proposal!.proposalId,
      manifestId: proposal!.manifestId,
      sourceSha256: proposal!.sourceSha256,
      sourceRecordId: proposal!.sourceRecordId,
      decidedBy: "owner-fixture",
      decidedAt: GENERATED_AT,
      note: "Owner-reviewed tracer fixture",
      approvalState: "approved",
      action,
      snapshot: stagedSnapshot,
      availableComponentRecipeIds: ["recipe-cooked-rice"],
    });
  });
}

function documentFor(decisions: readonly ReconciliationDecision[]) {
  return {
    schemaVersion: "6.0.0" as const,
    generatedAt: GENERATED_AT,
    derivedFrom: {
      v5Path: "fixtures/ingredient-tracer-v1.json",
      v5Sha256: SOURCE_SHA,
      catalogSha256: "9".repeat(64),
    },
    recipes: [{
      recipeId: "recipe-main",
      active: true,
      ingredients: cases.map(({ lineId, name }) => ({
        lineId,
        name,
        kind: "ingredient" as const,
        amountText: "10",
        unitText: "g",
        sourceDisplayText: `10 g ${name}`,
        ingredientId: null,
        componentRecipeId: null,
        servingNote: "",
        active: true,
      })),
    }, {
      recipeId: "recipe-cooked-rice",
      active: true,
      ingredients: [],
    }],
    decisions: decisions.map((decision, index) => ({
      ...decision,
      recipeId: "recipe-main",
      lineId: cases[index]!.lineId,
    })),
  };
}

function canonicalCounts(snapshot: IngredientMasterSnapshot): Record<string, number> {
  return {
    legacySourceRecords: snapshot.legacySourceRecords.length,
    ingredients: snapshot.ingredients.length,
    specifications: snapshot.specifications.length,
    mappings: snapshot.mappings.length,
    costObservations: snapshot.costObservations.length,
    reconciliationDecisions: snapshot.reconciliationDecisions.length,
    recipeLineLinks: snapshot.recipeLineLinks.length,
  };
}

function inactivateHistoricalSpecification(snapshot: IngredientMasterSnapshot): void {
  const specification = snapshot.specifications.find(({ specificationId }) =>
    specificationId === "spec-soy-old");
  expect(specification).toBeDefined();
  specification!.status = "inactive";
}

function noFoodCostKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(noFoodCostKeys);
  if (value === null || typeof value !== "object") return true;
  return Object.entries(value).every(([key, child]) =>
    !/food.?cost|cost.?total|gross.?margin/i.test(key) && noFoodCostKeys(child));
}

describe("ingredient migration tracer", () => {
  test("traces stage through exact export and CAS without mutating raw input or calculating Food Cost", async () => {
    const source = sourceFixture();
    const rawBefore = JSON.stringify(source);
    const base = emptySnapshot();
    const staged = stageLegacyIngredientSnapshot(source, manifest());
    const stagedSnapshot = { ...base, legacySourceRecords: [...staged.records] };
    const decisions = decisionsFor(stagedSnapshot);

    const published = publishReconciliationBatch(base, staged, decisions);
    inactivateHistoricalSpecification(published.snapshot);
    const document = documentFor(decisions);
    const relinked = relinkRecipeIngredients(document, {
      sourceSha256: SOURCE_SHA,
      sourceManifest: { manifestId: MANIFEST_ID, sourceSha256: SOURCE_SHA, directLineCount: 8 },
      actualSourceManifest: { manifestId: MANIFEST_ID, sourceSha256: SOURCE_SHA, directLineCount: 8 },
      decisions: document.decisions,
      ingredients: published.snapshot.ingredients,
      specifications: published.snapshot.specifications,
    });
    const snapshot = parseIngredientMaster({
      ...published.snapshot,
      recipeLineLinks: relinked.links,
    });
    const report = buildIngredientMigrationReport(snapshot, {
      [MANIFEST_ID]: { direct: 8, component: 0, total: 8 },
    });
    const bytes = serializeIngredientMaster(snapshot);

    expect(report.sourceCounts.v1).toEqual({ direct: 8, component: 0, total: 8, mapped: 7, unmapped: 1 });
    expect(snapshot.recipeLineLinks.find(({ lineId }) => lineId === "line-generic-oyster"))
      .toMatchObject({ state: "ingredient", ingredientId: "ing-oyster", requiredSpecificationId: null });
    expect(snapshot.ingredients.find(({ ingredientId }) => ingredientId === "ing-oyster")?.costingState)
      .toBe("requires_specification");
    expect(snapshot.recipeLineLinks.find(({ lineId }) => lineId === "line-mae-krua"))
      .toMatchObject({ state: "ingredient", requiredSpecificationId: "spec-mae-krua" });
    expect(snapshot.recipeLineLinks.filter(({ lineId }) => lineId.includes("sugar")))
      .toMatchObject([
        { requiredSpecificationId: "spec-sugar-unrefined" },
        { requiredSpecificationId: "spec-sugar-white" },
      ]);
    expect(snapshot.mappings.filter(({ specificationId }) => specificationId === "spec-mae-krua"))
      .toHaveLength(2);
    expect(snapshot.recipeLineLinks.find(({ lineId }) => lineId === "line-inactive-label"))
      .toMatchObject({ historicalLabel: "ซีอิ๊ว ฉลากเก่า", requiredSpecificationId: "spec-soy-old" });
    expect(relinked.issues.map(({ code }) => code))
      .toEqual(["INACTIVE_SPECIFICATION_REPLACEMENT_REQUIRED"]);
    expect(report.missingPrices).toEqual([{
      recipeId: "recipe-main",
      lineId: "line-missing-price",
      specificationId: "spec-unpriced-meat",
      reason: "MISSING_PRICE_EVIDENCE",
    }]);
    expect(snapshot.recipeLineLinks.find(({ lineId }) => lineId === "line-unmapped"))
      .toMatchObject({ state: "unmapped", sourceRecordId: "recipe_line:7" });
    expect(snapshot.recipeLineLinks.find(({ lineId }) => lineId === "line-cooked-rice"))
      .toMatchObject({ state: "component", componentRecipeId: "recipe-cooked-rice" });
    expect(JSON.stringify(source)).toBe(rawBefore);
    expect(noFoodCostKeys({ snapshot, report })).toBe(true);
    expect(serializeIngredientMaster(parseIngredientMaster(JSON.parse(bytes)))).toBe(bytes);

    const store = new InMemoryIngredientMasterStore();
    const firstWrite = await store.compareAndSwap({ expectedRevision: null, nextBytes: bytes });
    expect(firstWrite).toEqual({ revision: "rev-1" });
    await expect(store.compareAndSwap({ expectedRevision: null, nextBytes: bytes }))
      .rejects.toThrow("STALE_INGREDIENT_MASTER");
    expect(await store.read()).toEqual({ bytes, revision: "rev-1" });
  });

  test("replays the same staged batch and decisions with zero new canonical records and stable output", () => {
    const source = sourceFixture();
    const base = emptySnapshot();
    const firstBatch = stageLegacyIngredientSnapshot(source, manifest());
    const firstDecisions = decisionsFor({ ...base, legacySourceRecords: [...firstBatch.records] });
    const firstPublish = publishReconciliationBatch(base, firstBatch, firstDecisions);
    inactivateHistoricalSpecification(firstPublish.snapshot);
    const document = documentFor(firstDecisions);
    const firstLinks = relinkRecipeIngredients(document, {
      sourceSha256: SOURCE_SHA,
      sourceManifest: { manifestId: MANIFEST_ID, sourceSha256: SOURCE_SHA, directLineCount: 8 },
      actualSourceManifest: { manifestId: MANIFEST_ID, sourceSha256: SOURCE_SHA, directLineCount: 8 },
      decisions: document.decisions,
      ingredients: firstPublish.snapshot.ingredients,
      specifications: firstPublish.snapshot.specifications,
    }).links;
    const firstSnapshot = parseIngredientMaster({ ...firstPublish.snapshot, recipeLineLinks: firstLinks });
    const firstReport = buildIngredientMigrationReport(firstSnapshot, {
      [MANIFEST_ID]: { direct: 8, component: 0, total: 8 },
    });
    const firstBytes = serializeIngredientMaster(firstSnapshot);

    const secondBatch = stageLegacyIngredientSnapshot(source, manifest());
    const secondPublish = publishReconciliationBatch(firstSnapshot, secondBatch, firstDecisions);
    const secondLinks = relinkRecipeIngredients(document, {
      sourceSha256: SOURCE_SHA,
      sourceManifest: { manifestId: MANIFEST_ID, sourceSha256: SOURCE_SHA, directLineCount: 8 },
      actualSourceManifest: { manifestId: MANIFEST_ID, sourceSha256: SOURCE_SHA, directLineCount: 8 },
      decisions: document.decisions,
      ingredients: secondPublish.snapshot.ingredients,
      specifications: secondPublish.snapshot.specifications,
    }).links;
    const secondSnapshot = parseIngredientMaster({ ...secondPublish.snapshot, recipeLineLinks: secondLinks });
    const secondReport = buildIngredientMigrationReport(secondSnapshot, {
      [MANIFEST_ID]: { direct: 8, component: 0, total: 8 },
    });

    expect(secondPublish.alreadyAppliedDecisionIds).toEqual(
      firstDecisions.map(({ decisionId }) => decisionId).sort(),
    );
    expect(canonicalCounts(secondSnapshot)).toEqual(canonicalCounts(firstSnapshot));
    expect(serializeIngredientMaster(secondSnapshot)).toBe(firstBytes);
    expect(secondReport).toEqual(firstReport);
  });
});

describe("read-only migration inventories", () => {
  test("reports the full V1 evidence without manufacturing owner decisions", () => {
    const rawBefore = JSON.stringify(legacyV1);
    const report = buildLegacyIngredientInventoryReport(legacyV1);

    expect(report.sourceCounts.v1).toEqual({ direct: 426, component: 93, total: 519 });
    expect(report.missingPrices).toHaveLength(2);
    expect(report.unmappedLegacyReferences).toEqual({ lines: 44, recipes: 39, ingredientIds: 16 });
    expect(report).not.toHaveProperty("reconciliationDecisions");
    expect(JSON.stringify(legacyV1)).toBe(rawBefore);
  });

  test("keeps the current first-set receipt at exactly 108 unresolved direct lines", () => {
    const firstSet = parseKitchenSotDocument(firstSetFixture);
    const document = {
      recipes: firstSet.recipes.map((recipe) => ({
        recipeId: String(recipe.recipe_id),
        ingredients: recipe.items.map((line) => ({
          lineId: line.line_key,
          name: line.item_name,
          kind: line.item_kind === "prepared_recipe" ? "prepared_recipe" as const : "ingredient" as const,
          ingredientId: null,
        })),
      })),
    };
    const firstSetManifest = makeSourceManifest(
      { recipe_line: 108, direct_line: 108 },
      { manifestId: "first-set", sha256: "e".repeat(64) },
    );

    const staged = stageCookbookV6FirstSet(document, firstSetManifest);

    expect(staged.directLines).toHaveLength(108);
    expect(staged.directLines.every(({ raw }) =>
      (raw as { ingredientId: unknown }).ingredientId === null)).toBe(true);
  });
});
