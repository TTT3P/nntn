import { describe, expect, test } from "vitest";
import { makeIngredientMasterSnapshot } from "../../test/ingredientBuilders";
import type { CostObservation, RecipeLineLink, UsableYieldEvidence } from "./types";
import {
  exactMetricFactor,
  selectEffectiveObservation,
  validateRecipeLineLink,
  validateYieldEvidence,
} from "./ingredientPolicy";

function yieldEvidence(overrides: Partial<UsableYieldEvidence> = {}): UsableYieldEvidence {
  return {
    yieldEvidenceId: "yield-001",
    specificationId: "spec-001",
    mode: "usable_yield",
    factor: 0.8,
    sourceReference: "trim-test-2026-08",
    approvalState: "approved",
    ...overrides,
  };
}

function observation(overrides: Partial<CostObservation>): CostObservation {
  return {
    observationId: "obs-001",
    specificationId: "spec-001",
    stockItemId: null,
    price: 100,
    currency: "THB",
    purchaseQuantity: 1,
    purchaseUnit: "kg",
    effectiveAt: "2026-08-10T00:00:00.000Z",
    recordedAt: "2026-08-10T12:00:00.000Z",
    sourceReference: "invoice-001",
    approvalState: "approved",
    ...overrides,
  };
}

function ingredientLink(
  snapshot: ReturnType<typeof makeIngredientMasterSnapshot>,
  requiredSpecificationId: string | null,
): Extract<RecipeLineLink, { state: "ingredient" }> {
  const link = snapshot.recipeLineLinks[0];
  if (link?.state !== "ingredient") throw new Error("invalid test fixture");
  return { ...link, requiredSpecificationId };
}

describe("exactMetricFactor", () => {
  test.each([
    ["kg", "g", 1000],
    ["g", "kg", 0.001],
    ["L", "ml", 1000],
    ["ml", "L", 0.001],
  ] as const)("converts only exact %s to %s tuples", (fromUnit, toUnit, factor) => {
    expect(exactMetricFactor(fromUnit, toUnit)).toBe(factor);
  });

  test.each([
    ["ช้อนโต๊ะ", "g"],
    ["ฟอง", "g"],
    ["ดิบ", "สุก"],
    ["KG", "g"],
    ["kg", "kg"],
  ])("does not infer or normalize %s to %s", (fromUnit, toUnit) => {
    expect(exactMetricFactor(fromUnit, toUnit)).toBeNull();
  });
});

describe("validateYieldEvidence", () => {
  test("accepts explicitly approved no-adjustment evidence only at factor one", () => {
    expect(validateYieldEvidence(yieldEvidence({
      mode: "no_adjustment",
      factor: 1,
      approvalState: "approved",
    }))).toEqual([]);

    expect(validateYieldEvidence(yieldEvidence({
      mode: "no_adjustment",
      factor: 0.99,
      approvalState: "approved",
    })).map(({ code }) => code)).toContain("INVALID_YIELD_FACTOR");
  });

  test("does not treat a pending imported factor one as approved", () => {
    expect(validateYieldEvidence(yieldEvidence({
      mode: "no_adjustment",
      factor: 1,
      approvalState: "pending",
      sourceReference: "legacy-yield_pct_v1",
    })).map(({ code }) => code)).toEqual(["UNAPPROVED_YIELD_EVIDENCE"]);
  });

  test.each([0, -0.1, 1.01])("rejects usable-yield factor %s", (factor) => {
    expect(validateYieldEvidence(yieldEvidence({ factor })).map(({ code }) => code))
      .toContain("INVALID_YIELD_FACTOR");
  });

  test("requires a non-empty source reference for usable yield", () => {
    expect(validateYieldEvidence(yieldEvidence({ sourceReference: "  " })).map(({ code }) => code))
      .toContain("MISSING_YIELD_SOURCE");
  });

  test("reports missing evidence instead of assuming factor one", () => {
    expect(validateYieldEvidence(null).map(({ code }) => code))
      .toEqual(["MISSING_YIELD_EVIDENCE"]);
  });
});

describe("selectEffectiveObservation", () => {
  test("excludes future and unapproved rows and selects deterministically", () => {
    const observations = [
      observation({ observationId: "obs-001", effectiveAt: "2026-08-12T00:00:00.000Z" }),
      observation({ observationId: "obs-002", approvalState: "pending" }),
      observation({ observationId: "obs-003" }),
      observation({ observationId: "obs-004", recordedAt: "2026-08-12T00:00:00.000Z" }),
    ];

    expect(selectEffectiveObservation(observations, "2026-08-11T00:00:00.000Z")?.observationId)
      .toBe("obs-003");
  });

  test("sorts by effective time, then recorded time, then stable observation ID", () => {
    const observations = [
      observation({ observationId: "obs-001", effectiveAt: "2026-08-09T23:00:00.000Z" }),
      observation({ observationId: "obs-002", recordedAt: "2026-08-10T11:00:00.000Z" }),
      observation({ observationId: "obs-003" }),
      observation({ observationId: "obs-004" }),
    ];

    expect(selectEffectiveObservation(observations, "2026-08-11T00:00:00.000Z")?.observationId)
      .toBe("obs-004");
  });

  test("returns null when no approved as-of observation exists", () => {
    expect(selectEffectiveObservation([
      observation({ observationId: "obs-future", effectiveAt: "2026-08-12T00:00:00.000Z" }),
    ], "2026-08-11T00:00:00.000Z")).toBeNull();
  });
});

describe("validateRecipeLineLink", () => {
  test("reports that a generic ingredient line needs a later costing-specification selection", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const link = ingredientLink(snapshot, null);

    expect(validateRecipeLineLink(link, snapshot).map(({ code }) => code))
      .toEqual(["MISSING_COSTING_SPECIFICATION"]);
  });

  test("rejects an exact specification belonging to another ingredient", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.ingredients.push({
      ingredientId: "ing-other",
      primaryName: "Other",
      category: "other",
      status: "active",
      costingState: "requires_specification",
    });
    snapshot.specifications.push({
      specificationId: "spec-other",
      ingredientId: "ing-other",
      label: "Other specification",
      attributes: {},
      status: "active",
      approvalState: "approved",
    });
    const link = ingredientLink(snapshot, "spec-other");

    expect(validateRecipeLineLink(link, snapshot).map(({ code }) => code))
      .toContain("SPECIFICATION_INGREDIENT_MISMATCH");
  });

  test("keeps an inactive specification readable while blocking new selection", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.specifications[0]!.status = "inactive";

    expect(validateRecipeLineLink(snapshot.recipeLineLinks[0]!, snapshot).map(({ code }) => code))
      .toEqual(["INACTIVE_SPECIFICATION"]);
  });

  test("accepts component identity as a distinct discriminated state", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const link: RecipeLineLink = {
      state: "component",
      recipeId: "recipe-001",
      lineId: "line-001",
      componentRecipeId: "component-recipe-001",
      historicalLabel: "Prepared stock",
    };

    expect(validateRecipeLineLink(link, snapshot)).toEqual([]);
  });

  test("reports an evidenced unmapped state as not costable", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const link: RecipeLineLink = {
      state: "unmapped",
      recipeId: "recipe-001",
      lineId: "line-001",
      sourceRecordId: "legacy-line-001",
      reason: "No approved identity",
      historicalLabel: "Unknown sauce",
    };

    expect(validateRecipeLineLink(link, snapshot).map(({ code }) => code))
      .toEqual(["UNMAPPED_RECIPE_LINE"]);
  });
});
