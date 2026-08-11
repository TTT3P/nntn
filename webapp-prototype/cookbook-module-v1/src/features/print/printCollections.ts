import type { RecipeVersion } from "../../domain/cookbook/types";

export interface PrintCollection {
  key: string;
  label: string;
  recipes: RecipeVersion[];
}

function meaningfulCategory(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const category = value.trim();
  return category === "" ? null : category;
}

function fallbackCollection(recipe: RecipeVersion): { key: string; label: string } {
  return recipe.kind === "sellable_menu"
    ? { key: "kind:sellable_menu", label: "เมนูและการประกอบ" }
    : { key: "kind:prepared", label: "สูตรเตรียมและส่วนประกอบ" };
}

function compareRecipes(left: RecipeVersion, right: RecipeVersion): number {
  const byName = left.name.localeCompare(right.name, "th");
  if (byName !== 0) return byName;
  return String(left.recipeId).localeCompare(String(right.recipeId), "th");
}

export function buildPrintCollections(recipes: RecipeVersion[]): PrintCollection[] {
  const collections = new Map<string, PrintCollection>();
  for (const recipe of recipes) {
    const category = meaningfulCategory(recipe.category);
    const identity = category === null
      ? fallbackCollection(recipe)
      : { key: `category:${category}`, label: category };
    const collection = collections.get(identity.key) ?? { ...identity, recipes: [] };
    collection.recipes.push(recipe);
    collections.set(identity.key, collection);
  }
  return [...collections.values()]
    .map((collection) => ({ ...collection, recipes: [...collection.recipes].sort(compareRecipes) }))
    .sort((left, right) => left.label.localeCompare(right.label, "th"));
}
