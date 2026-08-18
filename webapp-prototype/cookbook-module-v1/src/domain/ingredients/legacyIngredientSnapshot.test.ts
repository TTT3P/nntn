import { describe, expect, test } from "vitest";
import source from "../../../../outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json";
import firstSetFixture from "../../data/fixtures/first-set.json";
import { makeCookbookV6Document, makeSourceManifest } from "../../test/ingredientBuilders";
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
      supplier_evidence: { labels: ["ฉลากเดิม", "Lot A"] },
    };
    const input = { ingredients: [unusualIngredient], recipes: [], recipe_items: [] };
    const manifest = makeSourceManifest({ ingredient: 1, recipe: 0, recipe_line: 0 });
    const before = JSON.stringify(unusualIngredient);

    const batch = stageLegacyIngredientSnapshot(input, manifest);

    expect(batch.records[0]!.raw).toEqual(input.ingredients[0]);
    expect(batch.records[0]!.raw).not.toBe(input.ingredients[0]);
    expect(batch.records[0]!.sourceSha256).toBe(manifest.sha256);
    expect(batch.records[0]!.sourceRecordId).toBe("ingredient:9");
    expect(JSON.stringify(batch.records[0]!.raw)).toBe(before);
    expect(JSON.stringify(unusualIngredient)).toBe(before);
  });

  test("isolates frozen staged raw evidence from caller mutation in both directions", () => {
    const ingredient = {
      ingredient_id: 9,
      ingredient_name: "น้ำปลา",
      cost_per_unit_v1: null,
      evidence: { labels: ["ฉลากเดิม"] },
    };
    const input = { ingredients: [ingredient], recipes: [], recipe_items: [] };
    const batch = stageLegacyIngredientSnapshot(
      input,
      makeSourceManifest({ ingredient: 1, recipe: 0, recipe_line: 0 }),
    );
    const stagedRaw = batch.records[0]!.raw as typeof ingredient;

    expect(() => {
      stagedRaw.evidence.labels[0] = "แก้ staging";
    }).toThrow(TypeError);
    expect(ingredient.evidence.labels[0]).toBe("ฉลากเดิม");

    ingredient.ingredient_name = "แก้ source";
    ingredient.evidence.labels[0] = "ฉลากใหม่";
    expect(stagedRaw.ingredient_name).toBe("น้ำปลา");
    expect(stagedRaw.evidence.labels[0]).toBe("ฉลากเดิม");
  });

  test("freezes every exposed staging container and keeps line views distinct", () => {
    const input = {
      ingredients: [],
      recipes: [{ recipe_id: 7 }],
      recipe_items: [{ item_id: 11, recipe_id: 7, item_kind: "direct_ingredient", ingredient_id: 9 }],
    };
    const batch = stageLegacyIngredientSnapshot(
      input,
      makeSourceManifest({ ingredient: 0, recipe: 1, recipe_line: 1 }),
    );

    expect(Object.isFrozen(batch)).toBe(true);
    expect([
      batch.records,
      batch.ingredients,
      batch.recipes,
      batch.lines,
      batch.directLines,
      batch.componentLines,
    ].every(Object.isFrozen)).toBe(true);
    expect(batch.records.every(Object.isFrozen)).toBe(true);
    expect(batch.lines).not.toBe(batch.directLines);
    expect(() => {
      (batch.directLines as unknown[]).push(batch.lines[0]);
    }).toThrow(TypeError);
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
    expect(batch.records[0]!.raw).toEqual(document.recipes[0]!.ingredients[0]);
    expect(batch.records[0]!.raw).not.toBe(document.recipes[0]!.ingredients[0]);
    expect(batch.records[0]!.sourceRecordId).toBe(
      'recipe_line:["recipe:แกงเนื้อ","line:น้ำปลา"]',
    );
    expect(batch.records.every((record) => record.sourceSha256 === manifest.sha256)).toBe(true);
    expect(batch.lines).not.toBe(batch.directLines);

    const stagedRaw = batch.records[0]!.raw as typeof document.recipes[0]["ingredients"][0];
    expect(() => {
      stagedRaw.name = "แก้ staging";
    }).toThrow(TypeError);
    expect(document.recipes[0]!.ingredients[0]!.name).toBe("น้ำปลา");

    document.recipes[0]!.ingredients[0]!.name = "แก้ source";
    expect(stagedRaw.name).toBe("น้ำปลา");
  });

  test("preserves the approved 108-line first-set inventory", () => {
    const firstSet = parseKitchenSotDocument(firstSetFixture);
    const document = {
      recipes: firstSet.recipes.map((recipe) => ({
        recipeId: String(recipe.recipe_id),
        ingredients: recipe.items.map((line) => ({
          lineId: line.line_key,
          name: line.item_name,
          kind: line.item_kind === "prepared_recipe" ? "prepared_recipe" as const : "ingredient" as const,
          sourceDisplayText: line.candidate_text,
        })),
      })),
    };
    const manifest = makeSourceManifest(
      { recipe_line: 108, direct_line: 108 },
      { manifestId: "first-set", sha256: "e".repeat(64) },
    );

    const firstSetBatch = stageCookbookV6FirstSet(document, manifest);

    expect(firstSetBatch.directLines).toHaveLength(108);
    expect(firstSetBatch.records.every((record) => record.sourceSha256 === manifest.sha256)).toBe(true);
  });
});
