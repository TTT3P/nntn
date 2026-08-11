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
});
