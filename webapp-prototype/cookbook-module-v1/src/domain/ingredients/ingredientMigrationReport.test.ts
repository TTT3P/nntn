import { describe, expect, test } from "vitest";
import { makeIngredientMasterSnapshot } from "../../test/ingredientBuilders";
import { parseIngredientMaster } from "./parseIngredientMaster";
import type {
  IngredientMasterSnapshot,
  LegacySourceRecord,
  RecipeLineLink,
  ReconciliationDecision,
} from "./types";
import {
  buildIngredientMigrationReport,
  serializeIngredientMaster,
} from "./ingredientMigrationReport";

const SHA_V1 = "a".repeat(64);
const SHA_V2 = "b".repeat(64);

function addSourceRecord(
  snapshot: IngredientMasterSnapshot,
  sourceRecordId: string,
  raw: unknown,
  overrides: Partial<LegacySourceRecord> = {},
): void {
  snapshot.legacySourceRecords.push({
    stagingId: `staging-${sourceRecordId}`,
    manifestId: "manifest-v1",
    sourceSha256: SHA_V1,
    recordType: "recipe_line",
    sourceRecordId,
    raw,
    ...overrides,
  });
}

function addDecision(
  snapshot: IngredientMasterSnapshot,
  decisionId: string,
  sourceRecordId: string,
  action: ReconciliationDecision["action"],
  overrides: Partial<ReconciliationDecision> = {},
): ReconciliationDecision {
  const decision: ReconciliationDecision = {
    decisionId,
    proposalId: `proposal-${decisionId}`,
    manifestId: "manifest-v1",
    sourceSha256: SHA_V1,
    sourceRecordId,
    decidedBy: "operator-opaque-001",
    decidedAt: "2026-08-11T00:00:00.000Z",
    note: "Owner-reviewed report fixture",
    approvalState: "approved",
    action,
    ...overrides,
  };
  snapshot.reconciliationDecisions.push(decision);
  return decision;
}

function linkEvidence(
  decision: ReconciliationDecision,
  recipeId: string,
  lineId: string,
): RecipeLineLink["decisionEvidence"] {
  return { ...structuredClone(decision), recipeId, lineId };
}

function makeReportSnapshot(): IngredientMasterSnapshot {
  const snapshot = structuredClone(makeIngredientMasterSnapshot());
  snapshot.unitConversions = [];
  snapshot.usableYields = [];
  snapshot.sourceManifests[0]!.expectedCounts = {
    ingredient: 1,
    recipe: 1,
    direct_line: 3,
    component_line: 0,
    recipe_line: 3,
  };

  snapshot.ingredients.push({
    ingredientId: "ing-missing-price",
    primaryName: "Missing price ingredient",
    category: "test",
    status: "active",
    costingState: "requires_specification",
  }, {
    ingredientId: "ing-duplicate-candidate",
    primaryName: "Duplicate candidate",
    category: "test",
    status: "inactive",
    costingState: "not_costed",
  });
  snapshot.specifications.push({
    specificationId: "spec-missing-price",
    ingredientId: "ing-missing-price",
    label: "Missing price specification",
    attributes: {},
    status: "active",
    approvalState: "approved",
  });
  snapshot.usableYields.push({
    yieldEvidenceId: "yield-missing-price-no-adjustment",
    specificationId: "spec-missing-price",
    mode: "no_adjustment",
    factor: 1,
    sourceReference: "owner-confirmed",
    approvalState: "approved",
  });

  addSourceRecord(snapshot, "legacy-missing-price", { label: "No price" });
  const priceDecision = addDecision(snapshot, "decision-missing-price", "legacy-missing-price", {
    type: "link_ingredient",
    ingredientId: "ing-missing-price",
    requiredSpecificationId: "spec-missing-price",
  });
  snapshot.recipeLineLinks.push({
    state: "ingredient",
    recipeId: "recipe-opaque-002",
    lineId: "line-missing-price",
    ingredientId: "ing-missing-price",
    requiredSpecificationId: "spec-missing-price",
    historicalLabel: "Missing price ingredient 1 kg",
    amountText: "1",
    unitText: "kg",
    sourceDisplayText: "1 kg",
    servingNote: "preserved note",
    decisionEvidence: linkEvidence(priceDecision, "recipe-opaque-002", "line-missing-price"),
  });

  addSourceRecord(snapshot, "legacy-unmapped", { label: "Unknown legacy ingredient" });
  const unmappedDecision = addDecision(snapshot, "decision-unmapped", "legacy-unmapped", {
    type: "mark_unmapped",
    reason: "No owner-approved identity",
  });
  snapshot.recipeLineLinks.push({
    state: "unmapped",
    recipeId: "recipe-opaque-003",
    lineId: "line-unmapped",
    sourceRecordId: "legacy-unmapped",
    reason: "No owner-approved identity",
    historicalLabel: "Unknown legacy ingredient",
    amountText: "2",
    unitText: "ช้อนโต๊ะ",
    sourceDisplayText: "2 ช้อนโต๊ะ",
    servingNote: "keep raw",
    decisionEvidence: linkEvidence(unmappedDecision, "recipe-opaque-003", "line-unmapped"),
  });

  addSourceRecord(snapshot, "legacy-duplicate", { name: "Oyster sauce" });
  const duplicateDecision = addDecision(snapshot, "decision-duplicate", "legacy-duplicate", {
    type: "merge_redirect",
    fromIngredientId: "ing-duplicate-candidate",
    toIngredientId: "ing-oyster-sauce",
  }, {
    proposalId: `${SHA_V1}:recipe_line:legacy-duplicate:merge_redirect`,
  });
  snapshot.redirects.push({
    redirectId: "redirect-duplicate",
    fromIngredientId: "ing-duplicate-candidate",
    toIngredientId: "ing-oyster-sauce",
    decisionId: duplicateDecision.decisionId,
  });

  return parseIngredientMaster(snapshot);
}

describe("buildIngredientMigrationReport", () => {
  test("reports every visible migration category distinctly without a zero price sentinel", () => {
    const report = buildIngredientMigrationReport(makeReportSnapshot(), {
      "manifest-v1": { direct: 3, component: 0, total: 3 },
    });

    expect(report.mapped.map(({ lineId }) => lineId)).toEqual([
      "line-opaque-001",
      "line-missing-price",
    ]);
    expect(report.unmapped.map(({ lineId }) => lineId)).toEqual(["line-unmapped"]);
    expect(report.duplicateCandidates).toMatchObject([{
      sourceRecordId: "legacy-oyster-sauce",
      actionType: "merge_redirect",
      suggestedTargetId: "ing-oyster-sauce",
    }]);
    expect(report.resolvedDuplicates.map(({ redirectId }) => redirectId))
      .toEqual(["redirect-duplicate"]);
    expect(report.inactive).toContainEqual({
      recordType: "ingredient",
      recordId: "ing-duplicate-candidate",
    });
    expect(report.missingPrices).toEqual([{
      recipeId: "recipe-opaque-002",
      lineId: "line-missing-price",
      specificationId: "spec-missing-price",
      reason: "MISSING_PRICE_EVIDENCE",
    }]);
    expect(report.missingConversions).toEqual([{
      recipeId: "recipe-opaque-001",
      lineId: "line-opaque-001",
      specificationId: "spec-oyster-sauce-standard",
      fromUnit: "g",
      toUnit: "bottle",
      reason: "MISSING_CONVERSION_EVIDENCE",
    }]);
    expect(report.missingYields).toEqual([{
      recipeId: "recipe-opaque-001",
      lineId: "line-opaque-001",
      specificationId: "spec-oyster-sauce-standard",
      reason: "MISSING_YIELD_EVIDENCE",
    }]);
    expect(report.sourceCounts["manifest-v1"]).toMatchObject({
      direct: 3,
      component: 0,
      total: 3,
      mapped: 2,
      unmapped: 1,
    });
    expect(report.missingPrices.every((entry) => !("price" in entry))).toBe(true);
  });

  test.each([
    ["unknown expected source", {
      "manifest-v1": { direct: 3, component: 0, total: 3 },
      ghost: { direct: 0, component: 0, total: 0 },
    }],
    ["missing expected source", {}],
    ["negative count", { "manifest-v1": { direct: -1, component: 0, total: -1 } }],
    ["fractional count", { "manifest-v1": { direct: 2.5, component: 0.5, total: 3 } }],
    ["inconsistent total", { "manifest-v1": { direct: 3, component: 1, total: 3 } }],
    ["count mismatch with manifest", {
      "manifest-v1": { direct: 2, component: 0, total: 2 },
    }],
  ])("rejects %s instead of copying unverified accounting", (_label, expectedBySource) => {
    expect(() => buildIngredientMigrationReport(makeReportSnapshot(), expectedBySource))
      .toThrow("INGREDIENT_MIGRATION_SOURCE_CLOSURE_FAILED");
  });

  test("rejects recipe links whose decision evidence names an unknown manifest", () => {
    const snapshot = makeReportSnapshot();
    snapshot.recipeLineLinks[0]!.decisionEvidence.manifestId = "manifest-ghost";

    expect(() => buildIngredientMigrationReport(snapshot, {
      "manifest-v1": { direct: 3, component: 0, total: 3 },
    })).toThrow("INGREDIENT_MIGRATION_SOURCE_CLOSURE_FAILED");
  });

  test.each([2, 4])("rejects observed direct-line closure against authoritative count %s", (direct) => {
    const snapshot = makeReportSnapshot();
    snapshot.sourceManifests[0]!.expectedCounts.direct_line = direct;
    snapshot.sourceManifests[0]!.expectedCounts.recipe_line = direct;

    expect(() => buildIngredientMigrationReport(snapshot, {
      "manifest-v1": { direct, component: 0, total: direct },
    })).toThrow("INGREDIENT_MIGRATION_SOURCE_CLOSURE_FAILED");
  });

  test.each([
    ["caller direct", "direct"],
    ["caller component", "component"],
    ["caller total", "total"],
  ] as const)("rejects unsafe %s count before reading recipe links", (_label, field) => {
    const snapshot = makeReportSnapshot();
    Object.defineProperty(snapshot, "recipeLineLinks", {
      get: () => {
        throw new Error("RECIPE_LINKS_ACCESSED_BEFORE_COUNT_VALIDATION");
      },
    });
    const counts = { direct: 3, component: 0, total: 3 };
    counts[field] = Number.MAX_SAFE_INTEGER + 1;

    expect(() => buildIngredientMigrationReport(snapshot, { "manifest-v1": counts }))
      .toThrow("INGREDIENT_MIGRATION_SOURCE_CLOSURE_FAILED");
  });

  test.each([
    ["manifest direct", "direct_line"],
    ["manifest component", "component_line"],
    ["manifest total", "recipe_line"],
  ] as const)("rejects unsafe %s count before reading recipe links", (_label, field) => {
    const snapshot = makeReportSnapshot();
    snapshot.sourceManifests[0]!.expectedCounts[field] = Number.MAX_SAFE_INTEGER + 1;
    Object.defineProperty(snapshot, "recipeLineLinks", {
      get: () => {
        throw new Error("RECIPE_LINKS_ACCESSED_BEFORE_COUNT_VALIDATION");
      },
    });

    expect(() => buildIngredientMigrationReport(snapshot, {
      "manifest-v1": { direct: 3, component: 0, total: 3 },
    })).toThrow("INGREDIENT_MIGRATION_SOURCE_CLOSURE_FAILED");
  });

  test("accepts the MAX_SAFE_INTEGER boundary when the count sum remains safe", () => {
    const snapshot = makeReportSnapshot();
    snapshot.recipeLineLinks = [];
    snapshot.sourceManifests[0]!.expectedCounts.direct_line = 0;
    snapshot.sourceManifests[0]!.expectedCounts.component_line = Number.MAX_SAFE_INTEGER;
    snapshot.sourceManifests[0]!.expectedCounts.recipe_line = Number.MAX_SAFE_INTEGER;

    const report = buildIngredientMigrationReport(snapshot, {
      "manifest-v1": {
        direct: 0,
        component: Number.MAX_SAFE_INTEGER,
        total: Number.MAX_SAFE_INTEGER,
      },
    });

    expect(report.sourceCounts["manifest-v1"]).toEqual({
      direct: 0,
      component: Number.MAX_SAFE_INTEGER,
      total: Number.MAX_SAFE_INTEGER,
      mapped: 0,
      unmapped: 0,
    });
  });

  test("verifies a valid multi-source report independently by manifest", () => {
    const snapshot = makeReportSnapshot();
    snapshot.sourceManifests.push({
      ...structuredClone(snapshot.sourceManifests[0]!),
      manifestId: "manifest-v2",
      sha256: SHA_V2,
      sourcePath: "fixtures/second-source.json",
      expectedCounts: {
        ingredient: 0,
        recipe: 1,
        direct_line: 1,
        component_line: 0,
        recipe_line: 1,
      },
    });
    addSourceRecord(snapshot, "legacy-v2-unmapped", { name: "Unknown V2" }, {
      stagingId: "staging-v2-unmapped",
      manifestId: "manifest-v2",
      sourceSha256: SHA_V2,
    });
    const decision = addDecision(snapshot, "decision-v2-unmapped", "legacy-v2-unmapped", {
      type: "mark_unmapped",
      reason: "No approved identity in source two",
    }, {
      manifestId: "manifest-v2",
      sourceSha256: SHA_V2,
    });
    snapshot.recipeLineLinks.push({
      state: "unmapped",
      recipeId: "recipe-v2",
      lineId: "line-v2-unmapped",
      sourceRecordId: "legacy-v2-unmapped",
      reason: "No approved identity in source two",
      historicalLabel: "Unknown V2",
      amountText: "1",
      unitText: "piece",
      sourceDisplayText: "1 piece",
      servingNote: "",
      decisionEvidence: linkEvidence(decision, "recipe-v2", "line-v2-unmapped"),
    });

    const report = buildIngredientMigrationReport(snapshot, {
      "manifest-v1": { direct: 3, component: 0, total: 3 },
      "manifest-v2": { direct: 1, component: 0, total: 1 },
    });

    expect(report.sourceCounts).toEqual({
      "manifest-v1": { direct: 3, component: 0, total: 3, mapped: 2, unmapped: 1 },
      "manifest-v2": { direct: 1, component: 0, total: 1, mapped: 0, unmapped: 1 },
    });
  });
});

describe("serializeIngredientMaster", () => {
  test("exports complete canonical JSON while preserving authoritative raw key and array order", () => {
    const snapshot = makeReportSnapshot();
    snapshot.legacySourceRecords[0]!.raw = {
      zeta: "first",
      alpha: { beta: 2, alpha: 1 },
      rows: [{ z: 3, a: 1 }, { second: true, first: false }],
    };
    const bytes = serializeIngredientMaster(snapshot);
    const exported = JSON.parse(bytes) as Record<string, unknown>;

    expect(bytes.endsWith("\n")).toBe(true);
    expect(serializeIngredientMaster(parseIngredientMaster(exported))).toBe(bytes);
    expect(Object.keys(exported)).toEqual([...Object.keys(exported)].sort());
    expect((exported.legacySourceRecords as Array<{ raw: unknown }>)[0]!.raw)
      .toEqual(snapshot.legacySourceRecords[0]!.raw);
    expect(bytes.indexOf('"zeta"')).toBeLessThan(bytes.indexOf('"alpha"'));
    const rowsStart = bytes.indexOf('"rows"');
    const rowZ = bytes.indexOf('"z": 3', rowsStart);
    const rowA = bytes.indexOf('"a": 1', rowsStart);
    expect(rowsStart).toBeGreaterThan(-1);
    expect(rowZ).toBeGreaterThan(rowsStart);
    expect(rowZ).toBeLessThan(rowA);
    expect(exported).toMatchObject({
      sourceManifests: snapshot.sourceManifests,
      legacySourceRecords: snapshot.legacySourceRecords,
      ingredients: snapshot.ingredients,
      specifications: snapshot.specifications,
      aliases: snapshot.aliases,
      redirects: snapshot.redirects,
      mappings: snapshot.mappings,
      unitConversions: snapshot.unitConversions,
      usableYields: snapshot.usableYields,
      costObservations: snapshot.costObservations,
      reconciliationDecisions: snapshot.reconciliationDecisions,
      recipeLineLinks: snapshot.recipeLineLinks,
    });
    expect(bytes).not.toContain("reconciliationProposals");
    expect(bytes).not.toContain("foodCost");
    expect(bytes).not.toContain("derivedTotal");
  });
});
