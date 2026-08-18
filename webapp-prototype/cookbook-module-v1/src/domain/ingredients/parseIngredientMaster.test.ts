import { describe, expect, test } from "vitest";
import {
  makeIngredientMasterSnapshot,
  makeInvalidIngredientMasterSnapshot,
  type InvalidIngredientMasterScenario,
} from "../../test/ingredientBuilders";
import { parseIngredientMaster } from "./parseIngredientMaster";

const invalidScenarios: InvalidIngredientMasterScenario[] = [
  "duplicate ingredientId",
  "specification references missing ingredient",
  "alias references missing ingredient",
  "stock item maps to two specifications",
  "mapping references missing specification",
  "cost observation references missing specification",
  "costable ingredient has no approved specification",
];

function authorizeRecipeLineEvidence(
  snapshot: ReturnType<typeof makeIngredientMasterSnapshot>,
): void {
  snapshot.reconciliationDecisions = snapshot.recipeLineLinks.map(({ decisionEvidence }) => {
    return {
      decisionId: decisionEvidence.decisionId,
      proposalId: decisionEvidence.proposalId,
      manifestId: decisionEvidence.manifestId,
      sourceSha256: decisionEvidence.sourceSha256,
      sourceRecordId: decisionEvidence.sourceRecordId,
      decidedBy: decisionEvidence.decidedBy,
      decidedAt: decisionEvidence.decidedAt,
      note: decisionEvidence.note,
      approvalState: decisionEvidence.approvalState,
      action: decisionEvidence.action,
    };
  });
}

describe("parseIngredientMaster", () => {
  test("accepts a valid minimal transport snapshot", () => {
    const parsed = parseIngredientMaster(makeIngredientMasterSnapshot());

    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.ingredients[0]!.ingredientId).toBe("ing-oyster-sauce");
    expect(parsed.specifications[0]!.ingredientId).toBe("ing-oyster-sauce");
  });

  test.each(invalidScenarios)("rejects %s", (scenario) => {
    const invalidSnapshot = makeInvalidIngredientMasterSnapshot(scenario);

    expect(() => parseIngredientMaster(invalidSnapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("emits a stable field-ordered round trip", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const first = JSON.stringify(parseIngredientMaster(snapshot), null, 2) + "\n";
    const second = JSON.stringify(parseIngredientMaster(JSON.parse(first)), null, 2) + "\n";

    expect(second).toBe(first);
  });

  test("round-trips authoritative recipe relink evidence byte-exact", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const link = snapshot.recipeLineLinks[0]! as typeof snapshot.recipeLineLinks[number] &
      Record<string, unknown>;
    link.amountText = " 15.0 ";
    link.unitText = "กรัม ";
    link.sourceDisplayText = " 15.0 กรัม ";
    link.servingNote = " ห้ามตัดช่องว่าง ";
    link.decisionEvidence = {
      ...structuredClone(snapshot.reconciliationDecisions[0]!),
      recipeId: link.recipeId,
      lineId: link.lineId,
    };
    const parsed = parseIngredientMaster(snapshot);
    const expected = JSON.stringify(parsed.recipeLineLinks);
    const roundTrip = parseIngredientMaster(JSON.parse(JSON.stringify(parsed)));

    expect(parsed.recipeLineLinks[0]).toMatchObject({
      amountText: " 15.0 ",
      unitText: "กรัม ",
      sourceDisplayText: " 15.0 กรัม ",
      servingNote: " ห้ามตัดช่องว่าง ",
      historicalLabel: "Oyster sauce 10 g",
      decisionEvidence: link.decisionEvidence,
    });
    expect(JSON.stringify(roundTrip.recipeLineLinks)).toBe(expected);
  });

  test("rejects recipe-link evidence with an unknown canonical decision ID", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.recipeLineLinks[0]!.decisionEvidence.decisionId = "decision-unknown";

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects rejected recipe-link evidence even when the canonical decision matches", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.recipeLineLinks[0]!.decisionEvidence.approvalState = "rejected";
    authorizeRecipeLineEvidence(snapshot);

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects recipe-link evidence that conflicts with the canonical decision bytes", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.recipeLineLinks[0]!.decisionEvidence.note = "conflicting note";

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("preserves opaque string identities without normalization", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.ingredients[0]!.ingredientId = "  opaque ingredient id  ";
    snapshot.specifications[0]!.ingredientId = "  opaque ingredient id  ";
    snapshot.aliases[0]!.ingredientId = "  opaque ingredient id  ";
    const action = snapshot.reconciliationDecisions[0]!.action;
    const link = snapshot.recipeLineLinks[0]!;
    if (action.type !== "link_ingredient" || link.state !== "ingredient") {
      throw new Error("invalid test fixture");
    }
    action.ingredientId = "  opaque ingredient id  ";
    link.ingredientId = "  opaque ingredient id  ";
    if (link.decisionEvidence.action.type !== "link_ingredient") {
      throw new Error("invalid test fixture");
    }
    link.decisionEvidence.action.ingredientId = "  opaque ingredient id  ";

    expect(parseIngredientMaster(snapshot).ingredients[0]!.ingredientId)
      .toBe("  opaque ingredient id  ");
  });

  test.each([
    ["negative manifest byte length", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      snapshot.sourceManifests[0]!.byteLength = -1;
    }],
    ["non-finite unit conversion factor", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      snapshot.unitConversions[0]!.factor = Number.POSITIVE_INFINITY;
    }],
    ["negative usable yield factor", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      snapshot.usableYields[0]!.factor = -0.1;
    }],
    ["negative observed price", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      snapshot.costObservations[0]!.price = -1;
    }],
    ["negative purchase quantity", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      snapshot.costObservations[0]!.purchaseQuantity = -1;
    }],
  ] as const)("rejects %s", (_scenario, mutate) => {
    const snapshot = makeIngredientMasterSnapshot();
    mutate(snapshot);

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects malformed values instead of coercing them", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const malformed = snapshot as unknown as { sourceManifests: Array<{ byteLength: unknown }> };
    malformed.sourceManifests[0]!.byteLength = "1024";

    expect(() => parseIngredientMaster(malformed))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects a legacy source record with no own raw field", () => {
    const snapshot = makeIngredientMasterSnapshot();
    delete (snapshot.legacySourceRecords[0] as Partial<typeof snapshot.legacySourceRecords[number]>).raw;

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test.each([
    ["undefined", undefined],
    ["function", () => "not JSON"],
    ["symbol", Symbol("not JSON")],
    ["bigint", 1n],
    ["non-finite nested number", { nested: Number.NaN }],
  ])("rejects %s raw evidence", (_scenario, raw) => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.legacySourceRecords[0]!.raw = raw;

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects cyclic raw evidence", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const raw: { self?: unknown } = {};
    raw.self = raw;
    snapshot.legacySourceRecords[0]!.raw = raw;

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("copies raw evidence instead of aliasing the parser input", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const raw = { nested: { label: "original" }, ordered: ["first", "second"] };
    snapshot.legacySourceRecords[0]!.raw = raw;

    const parsed = parseIngredientMaster(snapshot);
    raw.nested.label = "mutated";
    raw.ordered.push("third");

    expect(parsed.legacySourceRecords[0]!.raw).toEqual({
      nested: { label: "original" },
      ordered: ["first", "second"],
    });
  });

  test("rejects a legacy source hash that differs from its manifest", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.legacySourceRecords[0]!.sourceSha256 = "b".repeat(64);

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects a reconciliation decision source hash that differs from its manifest", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.reconciliationDecisions[0]!.sourceSha256 = "b".repeat(64);

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects a reconciliation decision with no matching composite source record", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.reconciliationDecisions[0]!.sourceRecordId = "missing-source-record";

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects a redirect whose decision is missing", () => {
    const snapshot = makeIngredientMasterSnapshot();
    snapshot.ingredients.push({
      ingredientId: "ing-oyster-sauce-legacy",
      primaryName: "Legacy oyster sauce",
      category: "seasoning",
      status: "inactive",
      costingState: "not_costed",
    });
    snapshot.redirects.push({
      redirectId: "redirect-oyster-sauce-legacy",
      fromIngredientId: "ing-oyster-sauce-legacy",
      toIngredientId: "ing-oyster-sauce",
      decisionId: "missing-decision",
    });

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("accepts distinct recipe-line identity pairs containing NUL", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const base = snapshot.recipeLineLinks[0]!;
    snapshot.recipeLineLinks = [{
      state: "component",
      recipeId: "recipe\u0000part",
      lineId: "line",
      componentRecipeId: "component-recipe-1",
      historicalLabel: "first",
      amountText: base.amountText,
      unitText: base.unitText,
      sourceDisplayText: base.sourceDisplayText,
      servingNote: base.servingNote,
      decisionEvidence: {
        ...structuredClone(base.decisionEvidence),
        recipeId: "recipe\u0000part",
        lineId: "line",
        action: { type: "link_component_recipe", componentRecipeId: "component-recipe-1" },
      },
    }, {
      state: "component",
      recipeId: "recipe",
      lineId: "part\u0000line",
      componentRecipeId: "component-recipe-2",
      historicalLabel: "second",
      amountText: base.amountText,
      unitText: base.unitText,
      sourceDisplayText: base.sourceDisplayText,
      servingNote: base.servingNote,
      decisionEvidence: {
        ...structuredClone(base.decisionEvidence),
        decisionId: "decision-component-2",
        recipeId: "recipe",
        lineId: "part\u0000line",
        action: { type: "link_component_recipe", componentRecipeId: "component-recipe-2" },
      },
    }];
    authorizeRecipeLineEvidence(snapshot);

    expect(parseIngredientMaster(snapshot).recipeLineLinks).toHaveLength(2);
  });

  test.each([
    ["generic ingredient link", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      const link = snapshot.recipeLineLinks[0]!;
      if (link.state !== "ingredient") throw new Error("invalid test fixture");
      link.requiredSpecificationId = null;
      if (link.decisionEvidence.action.type !== "link_ingredient") {
        throw new Error("invalid test fixture");
      }
      link.decisionEvidence.action.requiredSpecificationId = null;
    }],
    ["inactive historical specification", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      snapshot.specifications[0]!.status = "inactive";
    }],
    ["unapproved historical specification", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      snapshot.specifications.push({
        ...structuredClone(snapshot.specifications[0]!),
        specificationId: "spec-oyster-sauce-approved-alternative",
      });
      snapshot.specifications[0]!.approvalState = "pending";
    }],
    ["component link", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      const base = snapshot.recipeLineLinks[0]!;
      snapshot.recipeLineLinks = [{
        state: "component",
        recipeId: "recipe-opaque-001",
        lineId: "line-opaque-001",
        componentRecipeId: "component-recipe-opaque-001",
        historicalLabel: "Prepared oyster sauce",
        amountText: base.amountText,
        unitText: base.unitText,
        sourceDisplayText: base.sourceDisplayText,
        servingNote: base.servingNote,
        decisionEvidence: {
          ...structuredClone(base.decisionEvidence),
          action: {
            type: "link_component_recipe",
            componentRecipeId: "component-recipe-opaque-001",
          },
        },
      }];
    }],
    ["unmapped historical link", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      const base = snapshot.recipeLineLinks[0]!;
      snapshot.recipeLineLinks = [{
        state: "unmapped",
        recipeId: "recipe-opaque-001",
        lineId: "line-opaque-001",
        sourceRecordId: "legacy-oyster-sauce",
        reason: "No approved identity",
        historicalLabel: "Unknown sauce",
        amountText: base.amountText,
        unitText: base.unitText,
        sourceDisplayText: base.sourceDisplayText,
        servingNote: base.servingNote,
        decisionEvidence: {
          ...structuredClone(base.decisionEvidence),
          sourceRecordId: "legacy-oyster-sauce",
          action: { type: "mark_unmapped", reason: "No approved identity" },
        },
      }];
    }],
  ] as const)("delegates recipe-line policy: accepts %s", (_scenario, mutate) => {
    const snapshot = makeIngredientMasterSnapshot();
    mutate(snapshot);
    authorizeRecipeLineEvidence(snapshot);

    expect(() => parseIngredientMaster(snapshot)).not.toThrow();
  });

  test.each([
    ["unknown ingredient", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      const link = snapshot.recipeLineLinks[0]!;
      if (link.state !== "ingredient") throw new Error("invalid test fixture");
      link.ingredientId = "missing-ingredient";
      link.requiredSpecificationId = null;
    }],
    ["unknown specification", (snapshot: ReturnType<typeof makeIngredientMasterSnapshot>) => {
      const link = snapshot.recipeLineLinks[0]!;
      if (link.state !== "ingredient") throw new Error("invalid test fixture");
      link.requiredSpecificationId = "missing-specification";
    }],
    ["specification belonging to another ingredient", (
      snapshot: ReturnType<typeof makeIngredientMasterSnapshot>,
    ) => {
      snapshot.ingredients.push({
        ingredientId: "ing-other",
        primaryName: "Other ingredient",
        category: "other",
        status: "active",
        costingState: "not_costed",
      });
      snapshot.specifications.push({
        specificationId: "spec-other",
        ingredientId: "ing-other",
        label: "Other specification",
        attributes: {},
        status: "active",
        approvalState: "approved",
      });
      const link = snapshot.recipeLineLinks[0]!;
      if (link.state !== "ingredient") throw new Error("invalid test fixture");
      link.requiredSpecificationId = "spec-other";
    }],
  ] as const)("delegates recipe-line policy: rejects %s", (_scenario, mutate) => {
    const snapshot = makeIngredientMasterSnapshot();
    mutate(snapshot);

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects raw arrays with enumerable extra properties", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const raw = ["kept"];
    Object.assign(raw, { extra: "discarded" });
    snapshot.legacySourceRecords[0]!.raw = raw;

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects raw arrays with non-enumerable extra properties", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const raw = ["kept"];
    Object.defineProperty(raw, "extra", { value: "discarded", enumerable: false });
    snapshot.legacySourceRecords[0]!.raw = raw;

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects raw arrays with symbol properties", () => {
    const snapshot = makeIngredientMasterSnapshot();
    const raw = ["kept"];
    Object.defineProperty(raw, Symbol("extra"), { value: "discarded", enumerable: true });
    snapshot.legacySourceRecords[0]!.raw = raw;

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });

  test("rejects 20,000-level raw evidence with the domain error instead of RangeError", () => {
    const snapshot = makeIngredientMasterSnapshot();
    let raw: unknown = "leaf";
    for (let depth = 0; depth < 20_000; depth += 1) raw = [raw];
    snapshot.legacySourceRecords[0]!.raw = raw;

    expect(() => parseIngredientMaster(snapshot))
      .toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  });
});
