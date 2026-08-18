import { describe, expect, test } from "vitest";
import { parseCookbookV6 } from "./parseCookbookV6";

const validDocument = {
  schemaVersion: "6.0.0",
  generatedAt: "2026-08-10T00:00:00.000Z",
  derivedFrom: {
    v5Path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
    v5Sha256: "9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7",
    catalogSha256: "9aa666169fc04774ba735894553d0a8f984f566f2004cbb2a315240cf0a00d66",
  },
  recipes: [{
    recipeId: "RCP-026",
    code: "RCP-026",
    name: "ไข่ข้น",
    kind: "prepared_recipe",
    category: "ไข่",
    active: true,
    reviewState: "confirmed",
    sourceLocators: [],
    yieldText: "",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [{
      lineId: "ไข่ข้น:ไข่ไก่",
      name: "ไข่ไก่",
      kind: "ingredient",
      amountText: "2",
      unitText: "ฟอง",
      sourceDisplayText: "2 ฟอง",
      ingredientId: null,
      componentRecipeId: null,
      servingNote: "",
      costBasisText: "",
      decisionStatus: "confirmed_by_owner",
      selectedSource: "owner_confirmation",
      active: true,
    }],
    methodSteps: [],
    blockers: [],
    workDocuments: {},
    parentRecipeIds: [],
    lineage: { source: "v5", sourceRecipeId: 18 },
  }],
};

describe("parseCookbookV6", () => {
  test("accepts a valid document while preserving mixed lineage identities", () => {
    expect(parseCookbookV6(validDocument)).toEqual(validDocument);
  });

  test("rejects duplicate recipe and ingredient identities", () => {
    const duplicateRecipe = structuredClone(validDocument);
    duplicateRecipe.recipes.push(structuredClone(duplicateRecipe.recipes[0]!));
    expect(() => parseCookbookV6(duplicateRecipe)).toThrow("INVALID_COOKBOOK_DOCUMENT");

    const duplicateLine = structuredClone(validDocument);
    duplicateLine.recipes[0]!.ingredients.push(structuredClone(duplicateLine.recipes[0]!.ingredients[0]!));
    expect(() => parseCookbookV6(duplicateLine)).toThrow("INVALID_COOKBOOK_DOCUMENT");
  });
});
