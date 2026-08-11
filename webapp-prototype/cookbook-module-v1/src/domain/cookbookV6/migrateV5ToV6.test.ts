import { describe, expect, test } from "vitest";
import catalogJson from "../../data/catalog/recipe-catalog-85.json";
import crosswalkJson from "../../data/catalog/v5-recipe-crosswalk.json";
import fixture from "../../data/fixtures/first-set.json";
import { withOwnerConfirmedEggRecipe } from "../../test/ownerConfirmedEggRecipe";
import { parseRecipeCatalog } from "../catalog/recipeCatalog";
import { parseKitchenSotDocument } from "../sot/kitchenSotDocument";
import { formatV6Quantity, migrateV5ToV6 } from "./migrateV5ToV6";

describe("V5 to V6 migration", () => {
  test("builds the 87-recipe identity union with 19 populated records", () => {
    const document = migrateV5ToV6({
      catalog: parseRecipeCatalog(catalogJson),
      v5: withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture)),
      crosswalk: crosswalkJson,
      v5Sha256: "9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7",
      catalogSha256: "9aa666169fc04774ba735894553d0a8f984f566f2004cbb2a315240cf0a00d66",
      generatedAt: "2026-08-10T00:00:00.000Z",
    });

    expect(document.recipes).toHaveLength(87);
    expect(document.recipes.filter((recipe) => recipe.kind === "sellable_menu")).toHaveLength(51);
    expect(document.recipes.filter((recipe) => recipe.kind === "prepared_recipe")).toHaveLength(35);
    expect(document.recipes.filter((recipe) => recipe.kind === "sub_recipe")).toHaveLength(1);
    expect(document.recipes.filter((recipe) => recipe.lineage.source === "v5")).toHaveLength(19);
    expect(document.recipes.filter((recipe) => recipe.ingredients.length === 0 && recipe.methodSteps.length === 0)).toHaveLength(68);

    expect(document.recipes.find(({ recipeId }) => recipeId === "candidate:prepared:ข้าวญี่ปุ่นหุงสุก"))
      .toMatchObject({ name: "ข้าวญี่ปุ่นหุงสุก", code: null, lineage: { source: "v5" } });
    expect(document.recipes.find(({ recipeId }) => recipeId === "candidate:prepared:ข้าวหอมมะลิหุงสุก"))
      .toMatchObject({ name: "ข้าวหอมมะลิหุงสุก", code: null, lineage: { source: "v5" } });
    expect(document.recipes.find(({ recipeId }) => recipeId === "RCP-068"))
      .toMatchObject({ name: "ข้าวหอมมะลิ M (200g สุก)", ingredients: [], lineage: { source: "catalog" } });
  });

  test("round-trips every populated quantity without conversion", () => {
    const document = migrateV5ToV6({
      catalog: parseRecipeCatalog(catalogJson),
      v5: withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture)),
      crosswalk: crosswalkJson,
      v5Sha256: "9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7",
      catalogSha256: "9aa666169fc04774ba735894553d0a8f984f566f2004cbb2a315240cf0a00d66",
      generatedAt: "2026-08-10T00:00:00.000Z",
    });

    for (const recipe of document.recipes) {
      for (const line of recipe.ingredients) {
        expect(formatV6Quantity(line)).toBe(line.sourceDisplayText);
      }
    }

    const removedLine = document.recipes
      .find(({ recipeId }) => recipeId === "SRCP-014")
      ?.ingredients.find(({ name }) => name === "ซอสอเนกประสงค์");
    expect(removedLine?.active).toBe(false);
  });
});
