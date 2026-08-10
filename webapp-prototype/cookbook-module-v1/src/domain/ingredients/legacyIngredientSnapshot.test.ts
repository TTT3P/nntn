import { expect, test } from "vitest";
import source from "../../../../outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json";
import { inspectLegacyIngredientSnapshot } from "./legacyIngredientSnapshot";

test("reproduces the approved V1 inventory without mutation", () => {
  expect(inspectLegacyIngredientSnapshot(source)).toEqual({
    ingredients: 138,
    recipes: 101,
    lines: 519,
    directLines: 426,
    componentLines: 93,
    missingPriceIngredients: 2,
    absentIngredientIds: 16,
    affectedRecipes: 39,
    affectedDirectLines: 44,
  });
});
