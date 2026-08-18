import type { LegacySourceRecord, SourceManifest } from "./types";

interface LegacyIngredient {
  readonly ingredient_id: number;
  readonly cost_per_unit_v1: number | null;
}

interface LegacyRecipe {
  readonly recipe_id: number;
}

interface LegacyRecipeItem {
  readonly item_id: number;
  readonly recipe_id: number;
  readonly item_kind: string;
  readonly ingredient_id: number | null;
}

export interface LegacyIngredientSource {
  readonly ingredients: readonly LegacyIngredient[];
  readonly recipes: readonly LegacyRecipe[];
  readonly recipe_items: readonly LegacyRecipeItem[];
}

export interface LegacyStagingBatch {
  readonly records: readonly LegacySourceRecord[];
  readonly ingredients: readonly LegacySourceRecord[];
  readonly recipes: readonly LegacySourceRecord[];
  readonly lines: readonly LegacySourceRecord[];
  readonly directLines: readonly LegacySourceRecord[];
  readonly componentLines: readonly LegacySourceRecord[];
}

export interface CookbookV6StagingLine {
  readonly lineId: string;
  readonly kind: string;
}

export interface CookbookV6StagingRecipe {
  readonly recipeId: string;
  readonly ingredients: readonly CookbookV6StagingLine[];
}

export interface CookbookV6StagingDocument {
  readonly recipes: readonly CookbookV6StagingRecipe[];
}

export interface LegacyIngredientInventoryReport {
  readonly sourceCounts: {
    readonly v1: {
      readonly direct: number;
      readonly component: number;
      readonly total: number;
    };
  };
  readonly missingPrices: readonly { readonly ingredientId: number }[];
  readonly unmappedLegacyReferences: {
    readonly lines: number;
    readonly recipes: number;
    readonly ingredientIds: number;
  };
}

function cloneAndFreezeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(cloneAndFreezeJson));
  }
  if (value !== null && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      clone[key] = cloneAndFreezeJson((value as Record<string, unknown>)[key]);
    }
    return Object.freeze(clone);
  }
  return value;
}

function stageRecord(
  raw: unknown,
  manifest: SourceManifest,
  recordType: LegacySourceRecord["recordType"],
  sourceRecordId: string,
): LegacySourceRecord {
  return Object.freeze({
    stagingId: legacyStagingId(manifest.sha256, recordType, sourceRecordId),
    manifestId: manifest.manifestId,
    sourceSha256: manifest.sha256,
    recordType,
    sourceRecordId,
    raw: cloneAndFreezeJson(raw),
  });
}

export function legacyStagingId(
  sourceSha256: string,
  recordType: LegacySourceRecord["recordType"],
  sourceRecordId: string,
): string {
  return `${sourceSha256}:${recordType}:${sourceRecordId}`;
}

function assertUnique(records: readonly LegacySourceRecord[]): void {
  const stagingIds = new Set<string>();
  for (const record of records) {
    if (stagingIds.has(record.stagingId)) throw new Error("DUPLICATE_SOURCE_IDENTITY");
    stagingIds.add(record.stagingId);
  }
}

function assertExpectedCounts(
  manifest: SourceManifest,
  actualCounts: Readonly<Record<string, number>>,
): void {
  for (const [recordType, expected] of Object.entries(manifest.expectedCounts)) {
    if (actualCounts[recordType] !== expected) throw new Error("SOURCE_COUNT_MISMATCH");
  }
}

function batchFrom({
  ingredients,
  recipes,
  lines,
  directLines,
  componentLines,
}: Omit<LegacyStagingBatch, "records">): LegacyStagingBatch {
  const frozenIngredients = Object.freeze([...ingredients]);
  const frozenRecipes = Object.freeze([...recipes]);
  const frozenLines = Object.freeze([...lines]);
  const frozenDirectLines = Object.freeze([...directLines]);
  const frozenComponentLines = Object.freeze([...componentLines]);
  const records = Object.freeze([
    ...frozenIngredients,
    ...frozenRecipes,
    ...frozenLines,
  ]);
  assertUnique(records);
  return Object.freeze({
    records,
    ingredients: frozenIngredients,
    recipes: frozenRecipes,
    lines: frozenLines,
    directLines: frozenDirectLines,
    componentLines: frozenComponentLines,
  });
}

export function stageLegacyIngredientSnapshot(
  source: LegacyIngredientSource,
  manifest: SourceManifest,
): LegacyStagingBatch {
  const ingredients = source.ingredients.map((ingredient) =>
    stageRecord(ingredient, manifest, "ingredient", `ingredient:${ingredient.ingredient_id}`));
  const recipes = source.recipes.map((recipe) =>
    stageRecord(recipe, manifest, "recipe", `recipe:${recipe.recipe_id}`));
  const lines = source.recipe_items.map((line) =>
    stageRecord(line, manifest, "recipe_line", `recipe_line:${line.item_id}`));
  const directLines = lines.filter((_, index) =>
    source.recipe_items[index]!.item_kind === "direct_ingredient");
  const componentLines = lines.filter((_, index) =>
    source.recipe_items[index]!.item_kind === "prepared_recipe");
  const batch = batchFrom({ ingredients, recipes, lines, directLines, componentLines });

  assertExpectedCounts(manifest, {
    ingredient: ingredients.length,
    recipe: recipes.length,
    recipe_line: lines.length,
    direct_line: directLines.length,
    component_line: componentLines.length,
  });
  return batch;
}

export function stageCookbookV6FirstSet(
  document: CookbookV6StagingDocument,
  manifest: SourceManifest,
): LegacyStagingBatch {
  const directLines = document.recipes.flatMap((recipe) =>
    recipe.ingredients
      .filter(({ kind }) => kind === "ingredient")
      .map((line) => stageRecord(
        line,
        manifest,
        "recipe_line",
        `recipe_line:${JSON.stringify([recipe.recipeId, line.lineId])}`,
      )));
  const batch = batchFrom({
    ingredients: [],
    recipes: [],
    lines: directLines,
    directLines,
    componentLines: [],
  });

  assertExpectedCounts(manifest, {
    ingredient: 0,
    recipe: 0,
    recipe_line: directLines.length,
    direct_line: directLines.length,
    component_line: 0,
  });
  return batch;
}

export function inspectLegacyIngredientSnapshot(source: LegacyIngredientSource) {
  const ingredientIds = new Set(source.ingredients.map(({ ingredient_id }) => ingredient_id));
  const directLines = source.recipe_items.filter(
    ({ item_kind }) => item_kind === "direct_ingredient",
  );
  const absentLines = directLines.filter(
    ({ ingredient_id }) => ingredient_id !== null && !ingredientIds.has(ingredient_id),
  );

  return {
    ingredients: source.ingredients.length,
    recipes: source.recipes.length,
    lines: source.recipe_items.length,
    directLines: directLines.length,
    componentLines: source.recipe_items.filter(
      ({ item_kind }) => item_kind === "prepared_recipe",
    ).length,
    missingPriceIngredients: source.ingredients.filter(
      ({ cost_per_unit_v1 }) => cost_per_unit_v1 === null,
    ).length,
    absentIngredientIds: new Set(absentLines.map(({ ingredient_id }) => ingredient_id)).size,
    affectedRecipes: new Set(absentLines.map(({ recipe_id }) => recipe_id)).size,
    affectedDirectLines: absentLines.length,
  };
}

export function buildLegacyIngredientInventoryReport(
  source: LegacyIngredientSource,
): LegacyIngredientInventoryReport {
  const ingredientIds = new Set(source.ingredients.map(({ ingredient_id }) => ingredient_id));
  const directLines = source.recipe_items.filter(
    ({ item_kind }) => item_kind === "direct_ingredient",
  );
  const componentLines = source.recipe_items.filter(
    ({ item_kind }) => item_kind === "prepared_recipe",
  );
  const absentLines = directLines.filter(
    ({ ingredient_id }) => ingredient_id !== null && !ingredientIds.has(ingredient_id),
  );

  return {
    sourceCounts: {
      v1: {
        direct: directLines.length,
        component: componentLines.length,
        total: source.recipe_items.length,
      },
    },
    missingPrices: source.ingredients
      .filter(({ cost_per_unit_v1 }) => cost_per_unit_v1 === null)
      .map(({ ingredient_id }) => ({ ingredientId: ingredient_id })),
    unmappedLegacyReferences: {
      lines: absentLines.length,
      recipes: new Set(absentLines.map(({ recipe_id }) => recipe_id)).size,
      ingredientIds: new Set(absentLines.map(({ ingredient_id }) => ingredient_id)).size,
    },
  };
}
