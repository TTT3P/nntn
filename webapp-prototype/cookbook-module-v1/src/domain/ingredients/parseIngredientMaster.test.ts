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
    snapshot.recipeLineLinks = [{
      state: "component",
      recipeId: "recipe\u0000part",
      lineId: "line",
      componentRecipeId: "component-recipe-1",
      historicalLabel: "first",
    }, {
      state: "component",
      recipeId: "recipe",
      lineId: "part\u0000line",
      componentRecipeId: "component-recipe-2",
      historicalLabel: "second",
    }];

    expect(parseIngredientMaster(snapshot).recipeLineLinks).toHaveLength(2);
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
