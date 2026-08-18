import type { LegacyStagingBatch } from "../domain/ingredients/legacyIngredientSnapshot";
import type {
  IngredientMasterSnapshot,
  LegacySourceRecord,
  SourceManifest,
} from "../domain/ingredients/types";

export type InvalidIngredientMasterScenario =
  | "duplicate ingredientId"
  | "specification references missing ingredient"
  | "alias references missing ingredient"
  | "stock item maps to two specifications"
  | "mapping references missing specification"
  | "cost observation references missing specification"
  | "costable ingredient has no approved specification";

export function makeSourceManifest(
  expectedCounts: Record<string, number>,
  overrides: Partial<SourceManifest> = {},
): SourceManifest {
  return {
    manifestId: "manifest-v1",
    sourcePath: "fixtures/ingredient-source.json",
    sha256: "a".repeat(64),
    byteLength: 1024,
    extractedAt: "2026-08-11T00:00:00.000Z",
    sourcePolicy: "immutable-input-receipt",
    expectedCounts,
    ...overrides,
  };
}

export function makeLegacyStagingBatch(
  records: readonly LegacySourceRecord[],
): LegacyStagingBatch {
  const ingredients = records.filter(({ recordType }) => recordType === "ingredient");
  const recipes = records.filter(({ recordType }) => recordType === "recipe");
  const lines = records.filter(({ recordType }) => recordType === "recipe_line");
  return {
    records,
    ingredients,
    recipes,
    lines,
    directLines: lines,
    componentLines: [],
  };
}

export function makeCookbookV6Document() {
  return {
    schemaVersion: "6.0.0",
    generatedAt: "2026-08-11T00:00:00.000Z",
    derivedFrom: {
      v5Path: "fixtures/first-set-v5.json",
      v5Sha256: "b".repeat(64),
      catalogSha256: "c".repeat(64),
    },
    recipes: [{
      recipeId: "recipe:แกงเนื้อ",
      code: null,
      name: "แกงเนื้อ",
      kind: "prepared_recipe",
      category: "แกง",
      active: true,
      reviewState: "confirmed",
      sourceLocators: [],
      yieldText: "",
      operationalNotes: [],
      methodDecisionNote: "",
      ingredients: [{
        lineId: "line:น้ำปลา",
        name: "น้ำปลา",
        kind: "ingredient",
        amountText: "1",
        unitText: "ช้อนโต๊ะ",
        sourceDisplayText: "1 ช้อนโต๊ะ",
        ingredientId: null,
        componentRecipeId: null,
        servingNote: "",
        costBasisText: "",
        decisionStatus: "pending",
        selectedSource: null,
        active: true,
      }, {
        lineId: "line:น้ำซุป",
        name: "น้ำซุป",
        kind: "prepared_recipe",
        amountText: "100",
        unitText: "ml",
        sourceDisplayText: "100 ml",
        ingredientId: null,
        componentRecipeId: "recipe:น้ำซุป",
        servingNote: "",
        costBasisText: "",
        decisionStatus: "pending",
        selectedSource: null,
        active: true,
      }],
      methodSteps: [],
      blockers: [],
      workDocuments: {},
      parentRecipeIds: [],
      lineage: { source: "v5", sourceRecipeId: 1 },
    }, {
      recipeId: "recipe:น้ำซุป",
      code: null,
      name: "น้ำซุป",
      kind: "prepared_recipe",
      category: "ซุป",
      active: true,
      reviewState: "confirmed",
      sourceLocators: [],
      yieldText: "",
      operationalNotes: [],
      methodDecisionNote: "",
      ingredients: [],
      methodSteps: [],
      blockers: [],
      workDocuments: {},
      parentRecipeIds: ["recipe:แกงเนื้อ"],
      lineage: { source: "v5", sourceRecipeId: 2 },
    }],
  };
}

export function makeIngredientMasterSnapshot(): IngredientMasterSnapshot {
  return {
    schemaVersion: "1.0.0",
    generatedAt: "2026-08-11T00:00:00.000Z",
    sourceManifests: [makeSourceManifest(
      { ingredient: 1, recipe: 1, recipe_line: 1 },
      { sourcePath: "fixtures/ingredient-master.json" },
    )],
    legacySourceRecords: [{
      stagingId: "staging-ingredient-1",
      manifestId: "manifest-v1",
      sourceSha256: "a".repeat(64),
      recordType: "ingredient",
      sourceRecordId: "legacy-oyster-sauce",
      raw: { name: "Oyster sauce" },
    }],
    ingredients: [{
      ingredientId: "ing-oyster-sauce",
      primaryName: "Oyster sauce",
      category: "seasoning",
      status: "active",
      costingState: "requires_specification",
    }],
    specifications: [{
      specificationId: "spec-oyster-sauce-standard",
      ingredientId: "ing-oyster-sauce",
      label: "Standard bottle",
      attributes: { brandPolicy: "any-approved" },
      status: "active",
      approvalState: "approved",
    }],
    aliases: [{
      aliasId: "alias-oyster-sauce-legacy",
      ingredientId: "ing-oyster-sauce",
      text: "ซอสหอยนางรม",
      sourceRecordId: "legacy-oyster-sauce",
    }],
    redirects: [],
    mappings: [{
      mappingId: "mapping-stock-oyster-sauce",
      specificationId: "spec-oyster-sauce-standard",
      stockItemId: "stock-item-opaque-001",
      approvalState: "approved",
    }],
    unitConversions: [{
      conversionId: "conversion-oyster-sauce-bottle-gram",
      specificationId: "spec-oyster-sauce-standard",
      fromUnit: "bottle",
      toUnit: "gram",
      factor: 700,
      sourceReference: "supplier-label-2026-08",
      approvalState: "approved",
    }],
    usableYields: [{
      yieldEvidenceId: "yield-oyster-sauce-no-adjustment",
      specificationId: "spec-oyster-sauce-standard",
      mode: "no_adjustment",
      factor: 1,
      sourceReference: "sealed-product",
      approvalState: "approved",
    }],
    costObservations: [{
      observationId: "cost-oyster-sauce-2026-08",
      specificationId: "spec-oyster-sauce-standard",
      stockItemId: "stock-item-opaque-001",
      price: 65,
      currency: "THB",
      purchaseQuantity: 1,
      purchaseUnit: "bottle",
      effectiveAt: "2026-08-01T00:00:00.000Z",
      recordedAt: "2026-08-11T00:00:00.000Z",
      sourceReference: "invoice-opaque-001",
      approvalState: "approved",
    }],
    reconciliationDecisions: [{
      decisionId: "decision-link-oyster-sauce",
      proposalId: "proposal-link-oyster-sauce",
      manifestId: "manifest-v1",
      sourceSha256: "a".repeat(64),
      sourceRecordId: "legacy-oyster-sauce",
      decidedBy: "operator-opaque-001",
      decidedAt: "2026-08-11T00:00:00.000Z",
      note: "Confirmed existing ingredient",
      approvalState: "approved",
      action: {
        type: "link_ingredient",
        ingredientId: "ing-oyster-sauce",
        requiredSpecificationId: "spec-oyster-sauce-standard",
      },
    }],
    recipeLineLinks: [{
      state: "ingredient",
      recipeId: "recipe-opaque-001",
      lineId: "line-opaque-001",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
      historicalLabel: "Oyster sauce 10 g",
      amountText: "10",
      unitText: "g",
      sourceDisplayText: "10 g",
      servingNote: "",
      decisionEvidence: {
        decisionId: "decision-link-oyster-sauce",
        proposalId: "proposal-link-oyster-sauce",
        manifestId: "manifest-v1",
        sourceSha256: "a".repeat(64),
        sourceRecordId: "legacy-oyster-sauce",
        recipeId: "recipe-opaque-001",
        lineId: "line-opaque-001",
        decidedBy: "operator-opaque-001",
        decidedAt: "2026-08-11T00:00:00.000Z",
        note: "Confirmed existing ingredient",
        approvalState: "approved",
        action: {
          type: "link_ingredient",
          ingredientId: "ing-oyster-sauce",
          requiredSpecificationId: "spec-oyster-sauce-standard",
        },
      },
    }],
  };
}

export function makeInvalidIngredientMasterSnapshot(
  scenario: InvalidIngredientMasterScenario,
): IngredientMasterSnapshot {
  const snapshot = structuredClone(makeIngredientMasterSnapshot());

  switch (scenario) {
    case "duplicate ingredientId":
      snapshot.ingredients.push(structuredClone(snapshot.ingredients[0]!));
      return snapshot;
    case "specification references missing ingredient":
      snapshot.specifications[0]!.ingredientId = "missing-ingredient";
      return snapshot;
    case "alias references missing ingredient":
      snapshot.aliases[0]!.ingredientId = "missing-ingredient";
      return snapshot;
    case "stock item maps to two specifications":
      snapshot.specifications.push({
        ...structuredClone(snapshot.specifications[0]!),
        specificationId: "spec-oyster-sauce-alternate",
      });
      snapshot.mappings.push({
        ...structuredClone(snapshot.mappings[0]!),
        mappingId: "mapping-stock-oyster-sauce-duplicate",
        specificationId: "spec-oyster-sauce-alternate",
      });
      return snapshot;
    case "mapping references missing specification":
      snapshot.mappings[0]!.specificationId = "missing-specification";
      return snapshot;
    case "cost observation references missing specification":
      snapshot.costObservations[0]!.specificationId = "missing-specification";
      return snapshot;
    case "costable ingredient has no approved specification":
      snapshot.specifications[0]!.approvalState = "pending";
      return snapshot;
  }
}
