import { describe, expect, test } from "vitest";
import {
  makeIngredientMasterSnapshot,
  makeLegacyStagingBatch,
} from "../../test/ingredientBuilders";
import type {
  IngredientMasterSnapshot,
  LegacySourceRecord,
  ReconciliationAction,
} from "./types";
import {
  buildReconciliationQueue,
  recordReconciliationDecision,
} from "./reconciliation";

const SHA = "a".repeat(64);

function sourceRecord(
  sourceRecordId: string,
  recordType: LegacySourceRecord["recordType"],
  raw: unknown,
  overrides: Partial<LegacySourceRecord> = {},
): LegacySourceRecord {
  return {
    stagingId: `${SHA}:${recordType}:${sourceRecordId}`,
    manifestId: "manifest-v1",
    sourceSha256: SHA,
    recordType,
    sourceRecordId,
    raw,
    ...overrides,
  };
}

function snapshotWithRecords(records: readonly LegacySourceRecord[]): IngredientMasterSnapshot {
  const snapshot = makeIngredientMasterSnapshot();
  snapshot.legacySourceRecords = [...records];
  return snapshot;
}

function proposalFor(
  actionType: ReconciliationAction["type"],
  record = sourceRecord("legacy-oyster-sauce", "ingredient", {
    ingredient_id: "legacy-oyster-sauce",
    ingredient_code: "OYSTER",
    ingredient_name: "Oyster sauce",
  }),
) {
  const snapshot = snapshotWithRecords([record]);
  const proposal = buildReconciliationQueue(makeLegacyStagingBatch([record]), snapshot)
    .find((candidate) => candidate.actionType === actionType);
  expect(proposal).toBeDefined();
  return { proposal: proposal!, snapshot };
}

function validDecisionInput(
  action: ReconciliationAction,
  snapshot: IngredientMasterSnapshot,
  overrides: Record<string, unknown> = {},
) {
  return {
    decisionId: "decision-001",
    proposalId: "unused-until-overridden",
    manifestId: "manifest-v1",
    sourceSha256: SHA,
    sourceRecordId: "legacy-oyster-sauce",
    decidedBy: "operator-001",
    decidedAt: "2026-08-11T08:00:00.000Z",
    note: "Owner reviewed the raw source evidence.",
    approvalState: "approved" as const,
    action,
    snapshot,
    availableComponentRecipeIds: ["recipe-component-001"],
    ...overrides,
  };
}

describe("buildReconciliationQueue", () => {
  test("exposes all six approved review action families with raw evidence and consequences", () => {
    const ingredient = sourceRecord("ingredient:new", "ingredient", {
      ingredient_id: "new",
      ingredient_name: "New sauce",
    });
    const existing = sourceRecord("ingredient:existing", "ingredient", {
      ingredient_id: "legacy-oyster-sauce",
      ingredient_name: "Oyster sauce",
    });
    const line = sourceRecord("recipe_line:component", "recipe_line", {
      item_name: "Prepared broth",
      component_recipe_id: "recipe-component-001",
    });
    const records = [line, ingredient, existing];
    const snapshot = snapshotWithRecords(records);

    const proposals = buildReconciliationQueue(makeLegacyStagingBatch(records), snapshot);

    expect(new Set(proposals.map(({ actionType }) => actionType))).toEqual(new Set([
      "create_ingredient",
      "create_specification",
      "link_ingredient",
      "merge_redirect",
      "link_component_recipe",
      "mark_unmapped",
    ]));
    for (const proposal of proposals) {
      expect(proposal.evidence).toEqual(expect.arrayContaining([
        { label: "raw_source", value: expect.any(String) },
      ]));
      expect(proposal.consequences.length).toBeGreaterThan(0);
      expect(proposal.sourceRecordId.length).toBeGreaterThan(0);
      expect(proposal).not.toHaveProperty("approvalState");
    }
  });

  test("accepts the authoritative records projection without fake staging partitions", () => {
    const record = sourceRecord("ingredient:records-only", "ingredient", {
      ingredient_name: "Oyster sauce",
    });
    const snapshot = snapshotWithRecords([record]);

    const proposals = buildReconciliationQueue({ records: [record] }, snapshot);

    expect(proposals.some(({ actionType, suggestedTargetId }) =>
      actionType === "merge_redirect" && suggestedTargetId === "ing-oyster-sauce"))
      .toBe(true);
  });

  test.each([
    ["exact primary name", { ingredient_name: "Oyster sauce" }],
    ["exact alias", { ingredient_name: "ซอสหอยนางรม" }],
    ["legacy code", { ingredient_code: "OYSTER" }],
    ["legacy ID", { ingredient_id: "legacy-oyster-sauce" }],
  ])("ranks an existing target from %s without constructing approval", (_label, raw) => {
    const record = sourceRecord("legacy-oyster-sauce", "ingredient", raw);
    const snapshot = snapshotWithRecords([record]);
    snapshot.aliases.push({
      aliasId: "alias-oyster-sauce-code",
      ingredientId: "ing-oyster-sauce",
      text: "Oyster sauce legacy code",
      sourceRecordId: "OYSTER",
    });

    const proposals = buildReconciliationQueue(makeLegacyStagingBatch([record]), snapshot);
    const linked = proposals.find(({ actionType }) => actionType === "link_ingredient");

    expect(linked?.suggestedTargetId).toBe("ing-oyster-sauce");
    expect(linked?.evidence.some(({ label }) => label.endsWith("_match"))).toBe(true);
    expect(snapshot.reconciliationDecisions).toHaveLength(1);
    expect(proposals.every((proposal) => !("approvalState" in proposal))).toBe(true);
  });

  test("sorts deterministically by SHA, record type, source record, and proposal ID without mutation", () => {
    const records = [
      sourceRecord("z-line", "recipe_line", { item_name: "Z" }, { sourceSha256: "b".repeat(64) }),
      sourceRecord("b-ingredient", "ingredient", { ingredient_name: "B" }),
      sourceRecord("a-ingredient", "ingredient", { ingredient_name: "A" }),
    ];
    const batch = makeLegacyStagingBatch(records);
    const snapshot = snapshotWithRecords(records);
    snapshot.sourceManifests.push({
      ...snapshot.sourceManifests[0]!,
      manifestId: "manifest-v2",
      sha256: "b".repeat(64),
    });
    records[0]!.manifestId = "manifest-v2";
    const beforeBatch = structuredClone(batch);
    const beforeSnapshot = structuredClone(snapshot);

    const first = buildReconciliationQueue(batch, snapshot);
    const second = buildReconciliationQueue(batch, snapshot);

    expect(second).toEqual(first);
    expect(first.map(({ proposalId }) => proposalId)).toEqual([...first]
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId))
      .map(({ proposalId }) => proposalId));
    expect(batch).toEqual(beforeBatch);
    expect(snapshot).toEqual(beforeSnapshot);
  });
});

describe("recordReconciliationDecision", () => {
  test("records an explicit approved decision with the exact proposal/source references", () => {
    const { proposal, snapshot } = proposalFor("link_ingredient");
    const action: ReconciliationAction = {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    };

    const decision = recordReconciliationDecision(proposal, validDecisionInput(action, snapshot, {
      proposalId: proposal.proposalId,
    }));

    expect(decision).toEqual(expect.objectContaining({
      proposalId: proposal.proposalId,
      sourceSha256: proposal.sourceSha256,
      sourceRecordId: proposal.sourceRecordId,
      approvalState: "approved",
      action,
    }));
  });

  test("preserves a rejected decision and leaves the proposal untouched", () => {
    const { proposal, snapshot } = proposalFor("mark_unmapped");
    const before = structuredClone(proposal);
    const action: ReconciliationAction = { type: "mark_unmapped", reason: "Needs source review" };

    const decision = recordReconciliationDecision(proposal, validDecisionInput(action, snapshot, {
      proposalId: proposal.proposalId,
      approvalState: "rejected",
    }));

    expect(decision.approvalState).toBe("rejected");
    expect(decision.action).toEqual(action);
    expect(proposal).toEqual(before);
  });

  test.each([
    ["proposal ID", { proposalId: "another-proposal" }],
    ["source SHA", { sourceSha256: "f".repeat(64) }],
    ["source record", { sourceRecordId: "another-record" }],
    ["manifest", { manifestId: "another-manifest" }],
    ["decider", { decidedBy: " " }],
    ["decision time", { decidedAt: " " }],
    ["note", { note: " " }],
  ])("rejects a decision with mismatched or empty %s", (_label, overrides) => {
    const { proposal, snapshot } = proposalFor("mark_unmapped");
    const action: ReconciliationAction = { type: "mark_unmapped", reason: "Needs source review" };

    expect(() => recordReconciliationDecision(proposal, validDecisionInput(action, snapshot, {
      proposalId: proposal.proposalId,
      ...overrides,
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects an action that does not match the proposal family", () => {
    const { proposal, snapshot } = proposalFor("mark_unmapped");
    const action: ReconciliationAction = {
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: null,
    };

    expect(() => recordReconciliationDecision(proposal, validDecisionInput(action, snapshot, {
      proposalId: proposal.proposalId,
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects a missing action payload with the domain error", () => {
    const { proposal, snapshot } = proposalFor("mark_unmapped");
    const input = validDecisionInput(
      { type: "mark_unmapped", reason: "Needs source review" },
      snapshot,
      { proposalId: proposal.proposalId, action: undefined },
    );

    expect(() => recordReconciliationDecision(proposal, input as never))
      .toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects create ingredient without an approved first specification", () => {
    const { proposal, snapshot } = proposalFor("create_ingredient");
    const action: ReconciliationAction = {
      type: "create_ingredient",
      ingredient: {
        ingredientId: "ing-new",
        primaryName: "New sauce",
        category: "seasoning",
        status: "active",
        costingState: "requires_specification",
      },
      firstSpecification: {
        specificationId: "spec-new",
        ingredientId: "ing-new",
        label: "Owner-confirmed form",
        attributes: {},
        status: "active",
        approvalState: "pending",
      },
    };

    expect(() => recordReconciliationDecision(proposal, validDecisionInput(action, snapshot, {
      proposalId: proposal.proposalId,
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("requires the first specification to be approved even for a not-costed ingredient", () => {
    const { proposal, snapshot } = proposalFor("create_ingredient");
    const action: ReconciliationAction = {
      type: "create_ingredient",
      ingredient: {
        ingredientId: "ing-new",
        primaryName: "New garnish",
        category: "garnish",
        status: "active",
        costingState: "not_costed",
      },
      firstSpecification: {
        specificationId: "spec-new",
        ingredientId: "ing-new",
        label: "Owner-confirmed form",
        attributes: {},
        status: "active",
        approvalState: "pending",
      },
    };

    expect(() => recordReconciliationDecision(proposal, validDecisionInput(action, snapshot, {
      proposalId: proposal.proposalId,
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects create specification and link actions that cross ingredient identities", () => {
    const { proposal, snapshot } = proposalFor("create_specification");
    const action: ReconciliationAction = {
      type: "create_specification",
      specification: {
        specificationId: "spec-crossed",
        ingredientId: "missing-ingredient",
        label: "Crossed",
        attributes: {},
        status: "active",
        approvalState: "approved",
      },
    };
    expect(() => recordReconciliationDecision(proposal, validDecisionInput(action, snapshot, {
      proposalId: proposal.proposalId,
    }))).toThrow("INVALID_RECONCILIATION_DECISION");

    const linked = proposalFor("link_ingredient");
    expect(() => recordReconciliationDecision(linked.proposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "missing-ingredient",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, linked.snapshot, { proposalId: linked.proposal.proposalId })))
      .toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects component reclassification to a missing component recipe", () => {
    const record = sourceRecord("legacy-oyster-sauce", "recipe_line", { item_name: "Prepared broth" });
    const { proposal, snapshot } = proposalFor("link_component_recipe", record);

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "link_component_recipe",
      componentRecipeId: "missing-recipe",
    }, snapshot, { proposalId: proposal.proposalId })))
      .toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test.each([
    ["self redirect", "ing-oyster-sauce", "ing-oyster-sauce", []],
    ["redirect cycle", "ing-oyster-sauce", "ing-second", [{
      redirectId: "redirect-existing",
      fromIngredientId: "ing-second",
      toIngredientId: "ing-oyster-sauce",
      decisionId: "decision-link-oyster-sauce",
    }]],
  ])("rejects %s", (_label, fromIngredientId, toIngredientId, redirects) => {
    const { proposal, snapshot } = proposalFor("merge_redirect");
    snapshot.ingredients.push({
      ...snapshot.ingredients[0]!,
      ingredientId: "ing-second",
      costingState: "not_costed",
    });
    snapshot.redirects = redirects;

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "merge_redirect",
      fromIngredientId,
      toIngredientId,
    }, snapshot, { proposalId: proposal.proposalId }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects a bulk decision unless declared fields are byte-identical", () => {
    const first = sourceRecord("legacy-oyster-sauce", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const second = sourceRecord("legacy-oyster-sauce-2", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Heinz",
    });
    const snapshot = snapshotWithRecords([first, second]);
    const proposal = buildReconciliationQueue(makeLegacyStagingBatch([first, second]), snapshot)
      .find(({ sourceRecordId, actionType }) =>
        sourceRecordId === first.sourceRecordId && actionType === "link_ingredient")!;

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: proposal.proposalId,
      bulk: {
        records: [first, second],
        comparisonFields: ["ingredient_name", "brand"],
      },
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("accepts byte-identical declared bulk fields and does not mutate inputs", () => {
    const first = sourceRecord("legacy-oyster-sauce", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const second = sourceRecord("legacy-oyster-sauce-2", "ingredient", {
      brand: "Mae Krua",
      ingredient_name: "Oyster sauce",
      ignored: "different",
    });
    const snapshot = snapshotWithRecords([first, second]);
    const proposal = buildReconciliationQueue(makeLegacyStagingBatch([first, second]), snapshot)
      .find(({ sourceRecordId, actionType }) =>
        sourceRecordId === first.sourceRecordId && actionType === "link_ingredient")!;
    const input = validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: proposal.proposalId,
      bulk: {
        records: [first, second],
        comparisonFields: ["ingredient_name", "brand"],
      },
    });
    const beforeProposal = structuredClone(proposal);
    const beforeInput = structuredClone(input);

    expect(recordReconciliationDecision(proposal, input).approvalState).toBe("approved");
    expect(proposal).toEqual(beforeProposal);
    expect(input).toEqual(beforeInput);
  });

  test("rejects forged caller raw even when canonical source keys are valid", () => {
    const first = sourceRecord("legacy-oyster-sauce", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const second = sourceRecord("legacy-oyster-sauce-2", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Heinz",
    });
    const forgedSecond = {
      ...second,
      raw: { ingredient_name: "Oyster sauce", brand: "Mae Krua" },
    };
    const snapshot = snapshotWithRecords([first, second]);
    const proposal = buildReconciliationQueue(makeLegacyStagingBatch([first, second]), snapshot)
      .find(({ sourceRecordId, actionType }) =>
        sourceRecordId === first.sourceRecordId && actionType === "link_ingredient")!;

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: proposal.proposalId,
      bulk: {
        records: [first, forgedSecond],
        comparisonFields: ["ingredient_name", "brand"],
      },
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects caller record-type substitution for a staged identity", () => {
    const first = sourceRecord("legacy-oyster-sauce", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const second = sourceRecord("legacy-oyster-sauce-2", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const substitutedSecond = { ...second, recordType: "recipe_line" as const };
    const snapshot = snapshotWithRecords([first, second]);
    const proposal = buildReconciliationQueue(makeLegacyStagingBatch([first, second]), snapshot)
      .find(({ sourceRecordId, actionType }) =>
        sourceRecordId === first.sourceRecordId && actionType === "link_ingredient")!;

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: proposal.proposalId,
      bulk: {
        records: [first, substitutedSecond],
        comparisonFields: ["ingredient_name", "brand"],
      },
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects bulk comparison when a declared field is absent", () => {
    const first = sourceRecord("legacy-oyster-sauce", "ingredient", {
      ingredient_name: "Oyster sauce",
    });
    const second = sourceRecord("legacy-oyster-sauce-2", "ingredient", {
      ingredient_name: "Oyster sauce",
    });
    const snapshot = snapshotWithRecords([first, second]);
    const proposal = buildReconciliationQueue(makeLegacyStagingBatch([first, second]), snapshot)
      .find(({ sourceRecordId, actionType }) =>
        sourceRecordId === first.sourceRecordId && actionType === "link_ingredient")!;

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: proposal.proposalId,
      bulk: {
        records: [first, second],
        comparisonFields: ["ingredient_name", "brand"],
      },
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects duplicate staged identities in one bulk decision", () => {
    const first = sourceRecord("legacy-oyster-sauce", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const snapshot = snapshotWithRecords([first]);
    const proposal = buildReconciliationQueue(makeLegacyStagingBatch([first]), snapshot)
      .find(({ actionType }) => actionType === "link_ingredient")!;

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: proposal.proposalId,
      bulk: {
        records: [first, first],
        comparisonFields: ["ingredient_name", "brand"],
      },
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects bulk membership that omits the proposal source", () => {
    const proposalSource = sourceRecord("legacy-oyster-sauce", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const second = sourceRecord("legacy-oyster-sauce-2", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const third = sourceRecord("legacy-oyster-sauce-3", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const snapshot = snapshotWithRecords([proposalSource, second, third]);
    const proposal = buildReconciliationQueue(
      makeLegacyStagingBatch([proposalSource, second, third]),
      snapshot,
    ).find(({ sourceRecordId, actionType }) =>
      sourceRecordId === proposalSource.sourceRecordId && actionType === "link_ingredient")!;

    expect(() => recordReconciliationDecision(proposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: proposal.proposalId,
      bulk: {
        records: [second, third],
        comparisonFields: ["ingredient_name", "brand"],
      },
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });

  test("rejects tampered proposal evidence that substitutes another canonical record type", () => {
    const proposalSource = sourceRecord("shared-source", "ingredient", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const substitutedType = sourceRecord("shared-source", "recipe_line", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const secondLine = sourceRecord("second-line", "recipe_line", {
      ingredient_name: "Oyster sauce",
      brand: "Mae Krua",
    });
    const records = [proposalSource, substitutedType, secondLine];
    const snapshot = snapshotWithRecords(records);
    const originalProposal = buildReconciliationQueue(
      makeLegacyStagingBatch(records),
      snapshot,
    ).find(({ sourceRecordId, actionType, proposalId }) =>
      sourceRecordId === proposalSource.sourceRecordId &&
      actionType === "link_ingredient" &&
      proposalId.includes(":ingredient:"))!;
    const tamperedProposal = structuredClone(originalProposal);
    tamperedProposal.evidence = tamperedProposal.evidence.map((entry) =>
      entry.label === "record_type" ? { ...entry, value: "recipe_line" } : entry);

    expect(() => recordReconciliationDecision(tamperedProposal, validDecisionInput({
      type: "link_ingredient",
      ingredientId: "ing-oyster-sauce",
      requiredSpecificationId: "spec-oyster-sauce-standard",
    }, snapshot, {
      proposalId: tamperedProposal.proposalId,
      sourceRecordId: tamperedProposal.sourceRecordId,
      bulk: {
        records: [substitutedType, secondLine],
        comparisonFields: ["ingredient_name", "brand"],
      },
    }))).toThrow("INVALID_RECONCILIATION_DECISION");
  });
});
