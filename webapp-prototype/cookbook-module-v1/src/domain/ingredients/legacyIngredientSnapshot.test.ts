import { describe, expect, test } from "vitest";
import source from "../../../../outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json";
import catalogJson from "../../data/catalog/recipe-catalog-85.json";
import crosswalkJson from "../../data/catalog/v5-recipe-crosswalk.json";
import firstSetFixture from "../../data/fixtures/first-set.json";
import { makeCookbookV6Document, makeSourceManifest } from "../../test/ingredientBuilders";
import { withOwnerConfirmedEggRecipe } from "../../test/ownerConfirmedEggRecipe";
import { parseRecipeCatalog } from "../catalog/recipeCatalog";
import { migrateV5ToV6 } from "../cookbookV6/migrateV5ToV6";
import { parseCookbookV6 } from "../cookbookV6/parseCookbookV6";
import { parseKitchenSotDocument } from "../sot/kitchenSotDocument";
import {
  inspectLegacyIngredientSnapshot,
  stageCookbookV6FirstSet,
  stageLegacyIngredientSnapshot,
} from "./legacyIngredientSnapshot";

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

describe("legacy ingredient staging", () => {
  test("preserves raw fields, key order, and Thai text", () => {
    const unusualIngredient = {
      ingredient_name: "น้ำปลา ตราปลาหมึก",
      source_status: "รอตรวจ",
      ingredient_id: 9,
      cost_per_unit_v1: 0.05,
    };
    const input = { ingredients: [unusualIngredient], recipes: [], recipe_items: [] };
    const manifest = makeSourceManifest({ ingredient: 1, recipe: 0, recipe_line: 0 });
    const before = JSON.stringify(unusualIngredient);

    const batch = stageLegacyIngredientSnapshot(input, manifest);

    expect(batch.records[0]!.raw).toEqual(input.ingredients[0]);
    expect(batch.records[0]!.raw).toBe(input.ingredients[0]);
    expect(batch.records[0]!.sourceSha256).toBe(manifest.sha256);
    expect(batch.records[0]!.sourceRecordId).toBe("ingredient:9");
    expect(JSON.stringify(batch.records[0]!.raw)).toBe(before);
    expect(JSON.stringify(unusualIngredient)).toBe(before);
  });

  test("is idempotent for the same manifest and source identities", () => {
    const input = {
      ingredients: [{ ingredient_id: 9, cost_per_unit_v1: null }],
      recipes: [{ recipe_id: 7 }],
      recipe_items: [{ item_id: 11, recipe_id: 7, item_kind: "direct_ingredient", ingredient_id: 9 }],
    };
    const manifest = makeSourceManifest({ ingredient: 1, recipe: 1, recipe_line: 1 });

    const first = stageLegacyIngredientSnapshot(input, manifest);
    const second = stageLegacyIngredientSnapshot(input, manifest);

    expect(second.records.map(({ stagingId }) => stagingId)).toEqual(
      first.records.map(({ stagingId }) => stagingId),
    );
    expect(new Set(second.records.map(({ stagingId }) => stagingId))).toHaveLength(3);
  });

  test("stages the same source identity under a different SHA as a distinct revision", () => {
    const input = { ingredients: [{ ingredient_id: 9, cost_per_unit_v1: null }], recipes: [], recipe_items: [] };
    const first = stageLegacyIngredientSnapshot(
      input,
      makeSourceManifest({ ingredient: 1, recipe: 0, recipe_line: 0 }),
    );
    const second = stageLegacyIngredientSnapshot(
      input,
      makeSourceManifest(
        { ingredient: 1, recipe: 0, recipe_line: 0 },
        { manifestId: "manifest-v1-revision-2", sha256: "d".repeat(64) },
      ),
    );

    expect(second.records[0]!.sourceRecordId).toBe(first.records[0]!.sourceRecordId);
    expect(second.records[0]!.stagingId).not.toBe(first.records[0]!.stagingId);
  });

  test("rejects duplicate identities before returning a batch", () => {
    const input = {
      ingredients: [
        { ingredient_id: 9, cost_per_unit_v1: null },
        { ingredient_id: 9, cost_per_unit_v1: 1 },
      ],
      recipes: [],
      recipe_items: [],
    };

    expect(() => stageLegacyIngredientSnapshot(
      input,
      makeSourceManifest({ ingredient: 2, recipe: 0, recipe_line: 0 }),
    )).toThrow("DUPLICATE_SOURCE_IDENTITY");
  });

  test("rejects manifest count mismatches before returning a batch", () => {
    const input = { ingredients: [{ ingredient_id: 9, cost_per_unit_v1: null }], recipes: [], recipe_items: [] };

    expect(() => stageLegacyIngredientSnapshot(
      input,
      makeSourceManifest({ ingredient: 2, recipe: 0, recipe_line: 0 }),
    )).toThrow("SOURCE_COUNT_MISMATCH");
  });

  test("preserves the approved V1 direct and component inventories", () => {
    const v1Batch = stageLegacyIngredientSnapshot(source, makeSourceManifest({
      ingredient: 138,
      recipe: 101,
      recipe_line: 519,
      direct_line: 426,
      component_line: 93,
    }));

    expect(v1Batch.directLines).toHaveLength(426);
    expect(v1Batch.componentLines).toHaveLength(93);
    expect(v1Batch.records).toHaveLength(138 + 101 + 519);
  });
});

describe("Cookbook V6 first-set staging", () => {
  test("stages only direct lines while preserving each supplied V6 line as raw evidence", () => {
    const document = makeCookbookV6Document();
    const manifest = makeSourceManifest(
      { recipe_line: 1, direct_line: 1 },
      { manifestId: "first-set", sha256: "e".repeat(64) },
    );

    const batch = stageCookbookV6FirstSet(document, manifest);

    expect(batch.records).toHaveLength(1);
    expect(batch.directLines).toHaveLength(1);
    expect(batch.componentLines).toHaveLength(0);
    expect(batch.records[0]!.raw).toBe(document.recipes[0]!.ingredients[0]);
    expect(batch.records[0]!.sourceRecordId).toBe(
      'recipe_line:["recipe:แกงเนื้อ","line:น้ำปลา"]',
    );
    expect(batch.records.every((record) => record.sourceSha256 === manifest.sha256)).toBe(true);
  });

  test("preserves the approved 108-line first-set inventory", () => {
    const documentWithLaterOwnerAddition = migrateV5ToV6({
      catalog: parseRecipeCatalog(catalogJson),
      v5: withOwnerConfirmedEggRecipe(parseKitchenSotDocument(firstSetFixture)),
      crosswalk: crosswalkJson,
      v5Sha256: "9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7",
      catalogSha256: "9aa666169fc04774ba735894553d0a8f984f566f2004cbb2a315240cf0a00d66",
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    const document = parseCookbookV6({
      ...documentWithLaterOwnerAddition,
      recipes: documentWithLaterOwnerAddition.recipes.map((recipe) =>
        recipe.lineage.sourceRecipeId === 18
          ? { ...recipe, ingredients: [], methodSteps: [], workDocuments: {} }
          : recipe),
    });
    const manifest = makeSourceManifest(
      { recipe_line: 108, direct_line: 108 },
      { manifestId: "first-set", sha256: "e".repeat(64) },
    );

    const firstSetBatch = stageCookbookV6FirstSet(document, manifest);

    expect(firstSetBatch.directLines).toHaveLength(108);
    expect(firstSetBatch.records.every((record) => record.sourceSha256 === manifest.sha256)).toBe(true);
  });
});
