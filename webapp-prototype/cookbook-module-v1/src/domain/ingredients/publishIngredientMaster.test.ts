import { describe, expect, test } from "vitest";
import { makeIngredientMasterSnapshot } from "../../test/ingredientBuilders";
import type { LegacyStagingBatch } from "./legacyIngredientSnapshot";
import type {
  CostObservation,
  IngredientAlias,
  IngredientMapping,
  IngredientMasterSnapshot,
  ReconciliationDecision,
  UsableYieldEvidence,
} from "./types";
import { parseIngredientMaster } from "./parseIngredientMaster";
import { publishReconciliationBatch } from "./publishIngredientMaster";

const SHA = "a".repeat(64);

interface PublishPayload {
  rename?: {
    ingredientId: string;
    primaryName: string;
    alias: IngredientAlias;
  };
  redirectId?: string;
  mappings?: IngredientMapping[];
  costObservations?: CostObservation[];
  usableYields?: UsableYieldEvidence[];
}

function sourceRecord(sourceRecordId: string, raw: unknown) {
  return {
    stagingId: `${SHA}:ingredient:${sourceRecordId}`,
    manifestId: "manifest-v1",
    sourceSha256: SHA,
    recordType: "ingredient" as const,
    sourceRecordId,
    raw,
  };
}

function staging(...records: ReturnType<typeof sourceRecord>[]): LegacyStagingBatch {
  return {
    records,
    ingredients: records,
    recipes: [],
    lines: [],
    directLines: [],
    componentLines: [],
  };
}

function approvedDecision(
  decisionId: string,
  sourceRecordId: string,
  action: ReconciliationDecision["action"],
  publish?: PublishPayload,
): ReconciliationDecision {
  return {
    decisionId,
    proposalId: `proposal-${decisionId}`,
    manifestId: "manifest-v1",
    sourceSha256: SHA,
    sourceRecordId,
    decidedBy: "owner-001",
    decidedAt: "2026-08-11T12:00:00.000Z",
    note: "Owner reviewed source evidence",
    approvalState: "approved",
    action: publish === undefined ? action : { ...action, publish },
  } as ReconciliationDecision;
}

function emptyCurrent(): IngredientMasterSnapshot {
  const snapshot = makeIngredientMasterSnapshot();
  snapshot.legacySourceRecords = [];
  snapshot.reconciliationDecisions = [];
  return snapshot;
}

function pendingObservation(
  observationId: string,
  price: number,
): CostObservation {
  return {
    observationId,
    specificationId: "spec-oyster-sauce-standard",
    stockItemId: null,
    price,
    currency: "THB",
    purchaseQuantity: 1,
    purchaseUnit: "legacy-unit",
    effectiveAt: "2026-08-11T00:00:00.000Z",
    recordedAt: "2026-08-11T12:00:00.000Z",
    sourceReference: "legacy:ingredient:priced",
    approvalState: "pending",
  };
}

function pendingYield(yieldEvidenceId: string): UsableYieldEvidence {
  return {
    yieldEvidenceId,
    specificationId: "spec-oyster-sauce-standard",
    mode: "no_adjustment",
    factor: 1,
    sourceReference: "legacy:ingredient:priced",
    approvalState: "pending",
  };
}

describe("publishReconciliationBatch", () => {
  test("rejects the whole batch without mutating inputs when the third decision is invalid", () => {
    const current = emptyCurrent();
    const batch = staging(
      sourceRecord("new-ingredient", { ingredient_name: "Opaque source name" }),
      sourceRecord("existing-ingredient", { ingredient_name: "Existing" }),
      sourceRecord("invalid-target", { ingredient_name: "Invalid" }),
    );
    const decisions = [
      approvedDecision("decision-create", "new-ingredient", {
        type: "create_ingredient",
        ingredient: {
          ingredientId: "ing-owner-chosen-7f3",
          primaryName: "Owner name",
          category: "seasoning",
          status: "active",
          costingState: "requires_specification",
        },
        firstSpecification: {
          specificationId: "spec-owner-chosen-2a1",
          ingredientId: "ing-owner-chosen-7f3",
          label: "Owner specification",
          attributes: {},
          status: "active",
          approvalState: "approved",
        },
      }),
      approvedDecision("decision-link", "existing-ingredient", {
        type: "link_ingredient",
        ingredientId: "ing-oyster-sauce",
        requiredSpecificationId: "spec-oyster-sauce-standard",
      }),
      approvedDecision("decision-invalid", "invalid-target", {
        type: "link_ingredient",
        ingredientId: "missing-ingredient",
        requiredSpecificationId: null,
      }),
    ];
    const beforeCurrent = JSON.stringify(current);
    const beforeBatch = JSON.stringify(batch);
    const beforeDecisions = JSON.stringify(decisions);

    expect(() => publishReconciliationBatch(current, batch, decisions))
      .toThrow("INVALID_RECONCILIATION_PUBLISH");
    expect(JSON.stringify(current)).toBe(beforeCurrent);
    expect(JSON.stringify(batch)).toBe(beforeBatch);
    expect(JSON.stringify(decisions)).toBe(beforeDecisions);
  });

  test("creates canonical identities only from the approved payload and records every source and decision", () => {
    const current = emptyCurrent();
    const record = sourceRecord("legacy-code-44", {
      ingredient_id: 44,
      ingredient_code: "AUTO-looking-code",
      ingredient_name: "Name must not become identity",
    });
    const decision = approvedDecision("decision-create", record.sourceRecordId, {
      type: "create_ingredient",
      ingredient: {
        ingredientId: "ing-owner-opaque-44",
        primaryName: "Approved culinary name",
        category: "seasoning",
        status: "active",
        costingState: "requires_specification",
      },
      firstSpecification: {
        specificationId: "spec-owner-opaque-44",
        ingredientId: "ing-owner-opaque-44",
        label: "Approved form",
        attributes: {},
        status: "active",
        approvalState: "approved",
      },
    });

    const result = publishReconciliationBatch(current, staging(record), [decision]);

    expect(result.snapshot.ingredients.map(({ ingredientId }) => ingredientId))
      .toContain("ing-owner-opaque-44");
    expect(result.snapshot.ingredients.map(({ ingredientId }) => ingredientId))
      .not.toContain("AUTO-looking-code");
    expect(result.snapshot.legacySourceRecords).toEqual([record]);
    expect(result.snapshot.reconciliationDecisions).toEqual([decision]);
  });

  test("renames by preserving identity and adding the approved former-name alias", () => {
    const current = emptyCurrent();
    const record = sourceRecord("rename-oyster", { ingredient_name: "Oyster sauce premium" });
    const decision = approvedDecision("decision-rename", record.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: null,
    }, {
      rename: {
        ingredientId: "ing-oyster-sauce",
        primaryName: "Oyster sauce family",
        alias: {
          aliasId: "alias-oyster-former-name",
          ingredientId: "ing-oyster-sauce",
          text: "Oyster sauce",
          sourceRecordId: record.sourceRecordId,
        },
      },
    });

    const result = publishReconciliationBatch(current, staging(record), [decision]);

    expect(result.snapshot.ingredients.find(({ ingredientId }) =>
      ingredientId === "ing-oyster-sauce")?.primaryName).toBe("Oyster sauce family");
    expect(result.snapshot.aliases).toContainEqual({
      aliasId: "alias-oyster-former-name",
      ingredientId: "ing-oyster-sauce",
      text: "Oyster sauce",
      sourceRecordId: record.sourceRecordId,
    });
  });

  test("creates an approved merge redirect without deleting either raw source row", () => {
    const current = emptyCurrent();
    current.ingredients.push({
      ingredientId: "ing-duplicate",
      primaryName: "Duplicate oyster sauce",
      category: "seasoning",
      status: "inactive",
      costingState: "not_costed",
    });
    const first = sourceRecord("duplicate-row", { name: "Duplicate oyster sauce" });
    const second = sourceRecord("target-row", { name: "Oyster sauce" });
    const decision = approvedDecision("decision-merge", first.sourceRecordId, {
      type: "merge_redirect",
      fromIngredientId: "ing-duplicate",
      toIngredientId: "ing-oyster-sauce",
    }, { redirectId: "redirect-owner-approved-001" });

    const result = publishReconciliationBatch(current, staging(first, second), [decision]);

    expect(result.snapshot.redirects).toContainEqual({
      redirectId: "redirect-owner-approved-001",
      fromIngredientId: "ing-duplicate",
      toIngredientId: "ing-oyster-sauce",
      decisionId: "decision-merge",
    });
    expect(result.snapshot.legacySourceRecords).toEqual([first, second]);
  });

  test("keeps inactive records and historical links parseable but rejects a new inactive-specification target", () => {
    const historical = makeIngredientMasterSnapshot();
    historical.specifications[0]!.status = "inactive";
    expect(parseIngredientMaster(historical).recipeLineLinks[0]?.historicalLabel)
      .toBe("Oyster sauce 10 g");

    const current = emptyCurrent();
    current.specifications[0]!.status = "inactive";
    const record = sourceRecord("new-selection", { name: "Oyster sauce" });
    const decision = approvedDecision("decision-inactive", record.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    });

    expect(() => publishReconciliationBatch(current, staging(record), [decision]))
      .toThrow("INACTIVE_SPECIFICATION");
  });

  test("allows multiple Stock IDs per specification but rejects one Stock ID mapped to two specifications", () => {
    const current = emptyCurrent();
    current.ingredients.push({
      ingredientId: "ing-sugar",
      primaryName: "Sugar",
      category: "seasoning",
      status: "active",
      costingState: "requires_specification",
    });
    current.specifications.push({
      specificationId: "spec-sugar-white",
      ingredientId: "ing-sugar",
      label: "White",
      attributes: {},
      status: "active",
      approvalState: "approved",
    });
    const first = sourceRecord("stock-map-one", { stock_item_id: "stock-a" });
    const second = sourceRecord("stock-map-two", { stock_item_id: "stock-b" });
    const mappings: IngredientMapping[] = [{
      mappingId: "mapping-stock-a",
      specificationId: "spec-oyster-sauce-standard",
      stockItemId: "stock-a",
      approvalState: "approved",
    }, {
      mappingId: "mapping-stock-b",
      specificationId: "spec-oyster-sauce-standard",
      stockItemId: "stock-b",
      approvalState: "approved",
    }];
    const result = publishReconciliationBatch(current, staging(first, second), [
      approvedDecision("decision-map-one", first.sourceRecordId, {
        type: "link_ingredient",
        ingredientId: "ing-oyster-sauce",
        requiredSpecificationId: "spec-oyster-sauce-standard",
      }, { mappings }),
    ]);
    expect(result.snapshot.mappings.filter(({ specificationId }) =>
      specificationId === "spec-oyster-sauce-standard")).toHaveLength(3);

    const conflicting = approvedDecision("decision-map-conflict", second.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-sugar",
      requiredSpecificationId: "spec-sugar-white",
    }, { mappings: [{
      mappingId: "mapping-stock-a-conflict",
      specificationId: "spec-sugar-white",
      stockItemId: "stock-a",
      approvalState: "approved",
    }] });
    expect(() => publishReconciliationBatch(current, staging(first, second), [
      approvedDecision("decision-map-one", first.sourceRecordId, {
        type: "link_ingredient",
        ingredientId: "ing-oyster-sauce",
        requiredSpecificationId: "spec-oyster-sauce-standard",
      }, { mappings }),
      conflicting,
    ])).toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("imports legacy price and 100-percent yield only as pending evidence", () => {
    const current = emptyCurrent();
    const priced = sourceRecord("priced", { cost_per_unit_v1: 72, yield_pct_v1: 1 });
    const observation = pendingObservation("observation-imported-72", 72);
    const usableYield = pendingYield("yield-imported-100");
    const decision = approvedDecision("decision-import-evidence", priced.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, { costObservations: [observation], usableYields: [usableYield] });

    const result = publishReconciliationBatch(current, staging(priced), [decision]);

    expect(result.snapshot.costObservations).toContainEqual(observation);
    expect(result.snapshot.usableYields).toContainEqual(usableYield);
    expect(result.snapshot.costObservations.find(({ observationId }) =>
      observationId === observation.observationId)?.approvalState).toBe("pending");
    expect(result.snapshot.usableYields.find(({ yieldEvidenceId }) =>
      yieldEvidenceId === usableYield.yieldEvidenceId)?.approvalState).toBe("pending");
  });

  test.each([
    ["missing", {}],
    ["null", { cost_per_unit_v1: null }],
  ])("creates no zero observation when legacy price is %s", (_label, raw) => {
    const current = emptyCurrent();
    const record = sourceRecord(`unpriced-${_label}`, raw);
    const decision = approvedDecision(`decision-unpriced-${_label}`, record.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: null,
    });

    const result = publishReconciliationBatch(current, staging(record), [decision]);
    expect(result.snapshot.costObservations).toEqual(current.costObservations);
    expect(result.snapshot.costObservations.some(({ price }) => price === 0)).toBe(false);
  });

  test("keeps observations append-only and rejects an existing ID with different bytes", () => {
    const current = emptyCurrent();
    const oldObservation = structuredClone(current.costObservations[0]!);
    const changed = sourceRecord("changed-observation", { cost_per_unit_v1: 99 });
    const collision = approvedDecision("decision-observation-collision", changed.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, { costObservations: [{ ...oldObservation, price: 99, approvalState: "pending" }] });

    expect(() => publishReconciliationBatch(current, staging(changed), [collision]))
      .toThrow("APPEND_ONLY_CONFLICT");
    expect(current.costObservations[0]).toEqual(oldObservation);

    const newer = sourceRecord("new-observation", { cost_per_unit_v1: 81 });
    const newObservation = pendingObservation("observation-imported-81", 81);
    const result = publishReconciliationBatch(current, staging(newer), [
      approvedDecision("decision-new-observation", newer.sourceRecordId, {
        type: "link_ingredient",
        ingredientId: "ing-oyster-sauce",
        requiredSpecificationId: "spec-oyster-sauce-standard",
      }, { costObservations: [newObservation] }),
    ]);
    expect(result.snapshot.costObservations[0]).toEqual(oldObservation);
    expect(result.snapshot.costObservations).toContainEqual(newObservation);
  });

  test("applies decisions deterministically regardless of input order", () => {
    const current = emptyCurrent();
    const first = sourceRecord("b-source", { name: "B" });
    const second = sourceRecord("a-source", { name: "A" });
    const firstDecision = approvedDecision("decision-b", first.sourceRecordId, {
      type: "mark_unmapped",
      reason: "Awaiting owner identity",
    });
    const secondDecision = approvedDecision("decision-a", second.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: null,
    });

    const forward = publishReconciliationBatch(current, staging(first, second), [firstDecision, secondDecision]);
    const reverse = publishReconciliationBatch(current, staging(second, first), [secondDecision, firstDecision]);
    expect(reverse.snapshot).toEqual(forward.snapshot);
  });

  test("reapplying byte-identical decisions is idempotent and reports their IDs", () => {
    const current = emptyCurrent();
    const record = sourceRecord("idempotent", { name: "Oyster sauce" });
    const decision = approvedDecision("decision-idempotent", record.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: null,
    });
    const first = publishReconciliationBatch(current, staging(record), [decision]);
    const second = publishReconciliationBatch(first.snapshot, staging(record), [decision]);

    expect(second.alreadyAppliedDecisionIds).toEqual(["decision-idempotent"]);
    expect(second.snapshot).toEqual(first.snapshot);
  });

  test("reapplies a byte-identical merge decision after its redirect exists", () => {
    const current = emptyCurrent();
    current.ingredients.push({
      ingredientId: "ing-duplicate-replay",
      primaryName: "Duplicate",
      category: "seasoning",
      status: "inactive",
      costingState: "not_costed",
    });
    const record = sourceRecord("merge-replay", { name: "Duplicate" });
    const decision = approvedDecision("decision-merge-replay", record.sourceRecordId, {
      type: "merge_redirect",
      fromIngredientId: "ing-duplicate-replay",
      toIngredientId: "ing-oyster-sauce",
    }, { redirectId: "redirect-replay" });
    const first = publishReconciliationBatch(current, staging(record), [decision]);

    const second = publishReconciliationBatch(first.snapshot, staging(record), [decision]);

    expect(second.alreadyAppliedDecisionIds).toEqual(["decision-merge-replay"]);
    expect(second.snapshot).toEqual(first.snapshot);
  });

  test("publishes a later decision while preserving an earlier redirect decision", () => {
    const current = emptyCurrent();
    current.ingredients.push({
      ingredientId: "ing-duplicate-earlier",
      primaryName: "Duplicate",
      category: "seasoning",
      status: "inactive",
      costingState: "not_costed",
    });
    const mergeRecord = sourceRecord("merge-earlier", { name: "Duplicate" });
    const laterRecord = sourceRecord("later-source", { name: "Oyster sauce" });
    const merge = approvedDecision("decision-merge-earlier", mergeRecord.sourceRecordId, {
      type: "merge_redirect",
      fromIngredientId: "ing-duplicate-earlier",
      toIngredientId: "ing-oyster-sauce",
    }, { redirectId: "redirect-earlier" });
    const first = publishReconciliationBatch(current, staging(mergeRecord), [merge]);
    const later = approvedDecision("decision-later", laterRecord.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: null,
    });

    const second = publishReconciliationBatch(first.snapshot, staging(laterRecord), [later]);

    expect(second.snapshot.redirects).toEqual(first.snapshot.redirects);
    expect(second.snapshot.reconciliationDecisions.map(({ decisionId }) => decisionId))
      .toEqual(["decision-later", "decision-merge-earlier"]);
  });

  test("rejects a reused decision ID carrying different bytes", () => {
    const current = emptyCurrent();
    const record = sourceRecord("reused", { name: "Oyster sauce" });
    const decision = approvedDecision("decision-reused", record.sourceRecordId, {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: null,
    });
    const first = publishReconciliationBatch(current, staging(record), [decision]);
    const changed = { ...decision, note: "Different reviewed bytes" };

    expect(() => publishReconciliationBatch(first.snapshot, staging(record), [changed]))
      .toThrow("DECISION_ID_CONFLICT");
  });

  test("records rejected decisions and staged rows without publishing their action", () => {
    const current = emptyCurrent();
    const record = sourceRecord("rejected-create", { name: "Rejected" });
    const rejected = {
      ...approvedDecision("decision-rejected", record.sourceRecordId, {
        type: "create_ingredient",
        ingredient: {
          ingredientId: "ing-must-not-publish",
          primaryName: "Must not publish",
          category: "unknown",
          status: "active",
          costingState: "requires_specification",
        },
        firstSpecification: {
          specificationId: "spec-must-not-publish",
          ingredientId: "ing-must-not-publish",
          label: "Rejected specification",
          attributes: {},
          status: "active",
          approvalState: "approved",
        },
      }),
      approvalState: "rejected" as const,
    };

    const result = publishReconciliationBatch(current, staging(record), [rejected]);
    expect(result.snapshot.ingredients.some(({ ingredientId }) =>
      ingredientId === "ing-must-not-publish")).toBe(false);
    expect(result.snapshot.reconciliationDecisions).toContainEqual(rejected);
    expect(result.snapshot.legacySourceRecords).toContainEqual(record);
  });

  test("validates rejected action payloads even though it does not publish them", () => {
    const current = emptyCurrent();
    const record = sourceRecord("rejected-invalid-link", { name: "Unknown" });
    const rejected = {
      ...approvedDecision("decision-rejected-invalid", record.sourceRecordId, {
        type: "link_ingredient",
        ingredientId: "missing-ingredient",
        requiredSpecificationId: null,
      }),
      approvalState: "rejected" as const,
    };

    expect(() => publishReconciliationBatch(current, staging(record), [rejected]))
      .toThrow("INVALID_RECONCILIATION_PUBLISH");
  });
});
