import { describe, expect, test } from "vitest";
import fixture from "../../data/fixtures/first-set.json";
import {
  InvalidKitchenSotDocumentError,
  cloneKitchenSotDocument,
  deriveFillSummary,
  isKitchenSotRecipeDraft,
  isOwnerProvenanceIncomplete,
  parseKitchenSotDocument,
  type KitchenSotRecipe,
} from "./kitchenSotDocument";

describe("Kitchen SOT document", () => {
  test("derives the accepted V4 fill surface without additive double-counting", () => {
    const document = parseKitchenSotDocument(fixture);
    expect(deriveFillSummary(document)).toEqual({
      recipeCount: 18,
      sellableMenuCount: 4,
      preparedRecipeCount: 14,
      unresolvedItemCount: 15,
      itemFillTargetCount: 16,
      noSelectedSourceCount: 8,
      blockerCount: 13,
      missingMethodRecipeIds: [2, 160, 9, 161, 162],
      provenanceIncompleteCount: 1,
    });
  });

  test("derives recipe 159 as DRAFT from missing owner provenance without adding a blocker", () => {
    const document = parseKitchenSotDocument(fixture);
    const recipe = document.recipes.find(({ recipe_id }) => recipe_id === 159)!;
    expect(recipe.blockers).toHaveLength(0);
    expect(recipe.items.find(({ item_name }) => item_name === "น้ำจิ้มซีฟู้ด")).toMatchObject({
      selected_source: "matching_sources",
      decision_status: "confirmed_by_owner",
    });
    expect(isOwnerProvenanceIncomplete(
      recipe.items.find(({ item_name }) => item_name === "น้ำจิ้มซีฟู้ด")!,
    )).toBe(false);
    expect(isKitchenSotRecipeDraft(recipe)).toBe(true);
  });

  test("keeps recipe 28 DRAFT after its unrelated blocker is resolved", () => {
    const document = parseKitchenSotDocument(fixture);
    const recipe = document.recipes.find(({ recipe_id }) => recipe_id === 28)!;
    recipe.blockers[0]!.resolved = true;
    expect(recipe.items.filter(({ decision_status }) => decision_status === "needs_review"))
      .toHaveLength(7);
    expect(isKitchenSotRecipeDraft(recipe)).toBe(true);
  });

  test("clones without mutating values or existing key order", () => {
    const document = parseKitchenSotDocument(fixture);
    const clone = cloneKitchenSotDocument(document);
    expect(JSON.stringify(clone)).toBe(JSON.stringify(document));
    clone.recipes[0]!.recipe_name = "changed only in clone";
    expect(document.recipes[0]!.recipe_name).not.toBe("changed only in clone");
  });

  test("preserves mixed recipe and component identity JSON types", () => {
    const document = parseKitchenSotDocument(fixture);
    expect(document.recipes.filter(({ recipe_id }) => typeof recipe_id === "number")).toHaveLength(16);
    expect(document.recipes.filter(({ recipe_id }) => typeof recipe_id === "string")).toHaveLength(2);
    const components = document.recipes.flatMap(({ items }) =>
      items.map(({ component_recipe_id }) => component_recipe_id).filter((value) => value !== null));
    expect(components.filter((value) => typeof value === "number")).toHaveLength(15);
    expect(components.filter((value) => typeof value === "string")).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(document)).recipes.map((recipe: KitchenSotRecipe) => typeof recipe.recipe_id))
      .toEqual(document.recipes.map(({ recipe_id }) => typeof recipe_id));
  });

  test.each([
    [null, "document"],
    [{ schema_version: "v", generated_at: "now", recipes: null }, "recipes"],
    [{ schema_version: "v", generated_at: "now", recipes: [{ recipe_id: null }] }, "recipes[0].recipe_id"],
    [{ schema_version: "v", generated_at: "now", recipes: [{ recipe_id: 1, recipe_name: 1 }] }, "recipes[0].recipe_name"],
    [{ schema_version: "v", generated_at: "now", recipes: [{ recipe_id: 1, recipe_name: "name", recipe_type: "prepared_recipe", review_state: "draft", items: null }] }, "recipes[0].items"],
  ])("rejects malformed document boundaries with a named error (%s)", (value, field) => {
    expect(() => parseKitchenSotDocument(value)).toThrow(InvalidKitchenSotDocumentError);
    expect(() => parseKitchenSotDocument(value)).toThrow(expect.objectContaining({ field }));
  });

  test("rejects invalid nullable item strings and blocker arrays", () => {
    const invalidItem = structuredClone(fixture) as unknown as Record<string, unknown>;
    const recipes = invalidItem.recipes as Array<Record<string, unknown>>;
    const items = recipes[0]!.items as Array<Record<string, unknown>>;
    items[0]!.candidate_text = 42;
    expect(() => parseKitchenSotDocument(invalidItem)).toThrow(
      expect.objectContaining({ field: "recipes[0].items[0].candidate_text" }),
    );

    const invalidBlockers = structuredClone(fixture) as unknown as Record<string, unknown>;
    const blockerRecipes = invalidBlockers.recipes as Array<Record<string, unknown>>;
    blockerRecipes[0]!.blockers = null;
    expect(() => parseKitchenSotDocument(invalidBlockers)).toThrow(
      expect.objectContaining({ field: "recipes[0].blockers" }),
    );
  });
});
