interface LegacyIngredient {
  readonly ingredient_id: number;
  readonly cost_per_unit_v1: number | null;
}

interface LegacyRecipeItem {
  readonly recipe_id: number;
  readonly item_kind: string;
  readonly ingredient_id: number | null;
}

interface LegacyIngredientSource {
  readonly ingredients: readonly LegacyIngredient[];
  readonly recipes: readonly unknown[];
  readonly recipe_items: readonly LegacyRecipeItem[];
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
