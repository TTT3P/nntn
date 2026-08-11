import type { RecipeVersion } from "../../domain/cookbook/types";

export type PrintCollectionKey =
  | "menu"
  | "meat-prep"
  | "sauce"
  | "rice-sides"
  | "stock-prep"
  | "plating"
  | "unassigned";

export interface PrintCollectionDefinition {
  key: PrintCollectionKey;
  label: string;
  category: string | null;
}

export interface PrintCollection {
  key: PrintCollectionKey;
  label: string;
  recipes: RecipeVersion[];
}

export const STANDARD_PRINT_COLLECTIONS: readonly PrintCollectionDefinition[] = [
  { key: "menu", label: "เมนูอาหาร", category: "เมนูอาหาร" },
  { key: "meat-prep", label: "เตรียมเนื้อ", category: "เตรียมเนื้อ" },
  { key: "sauce", label: "ซอสและน้ำจิ้ม", category: "ซอสและน้ำจิ้ม" },
  { key: "rice-sides", label: "ข้าวและเครื่องเคียง", category: "ข้าวและเครื่องเคียง" },
  { key: "stock-prep", label: "น้ำซุปและของเตรียม", category: "น้ำซุปและของเตรียม" },
  { key: "plating", label: "จัดจาน", category: "จัดจาน" },
  { key: "unassigned", label: "ยังไม่จัดหมวด", category: null },
];

function stableRecipeIdentity(recipeId: RecipeVersion["recipeId"]): string {
  return `${typeof recipeId}:${String(recipeId)}`;
}

function compareRecipes(left: RecipeVersion, right: RecipeVersion): number {
  const byName = left.name.localeCompare(right.name, "th");
  if (byName !== 0) return byName;
  const leftIdentity = stableRecipeIdentity(left.recipeId);
  const rightIdentity = stableRecipeIdentity(right.recipeId);
  if (leftIdentity < rightIdentity) return -1;
  if (leftIdentity > rightIdentity) return 1;
  return 0;
}

export function recipePrintCollectionKey(recipe: RecipeVersion): PrintCollectionKey {
  const category = typeof recipe.category === "string" ? recipe.category.trim() : "";
  return STANDARD_PRINT_COLLECTIONS.find((definition) => (
    definition.category !== null && definition.category === category
  ))?.key ?? "unassigned";
}

export function buildPrintCollections(recipes: RecipeVersion[]): PrintCollection[] {
  const recipesByCollection = new Map<PrintCollectionKey, RecipeVersion[]>();
  for (const recipe of recipes) {
    const key = recipePrintCollectionKey(recipe);
    const collectionRecipes = recipesByCollection.get(key) ?? [];
    collectionRecipes.push(recipe);
    recipesByCollection.set(key, collectionRecipes);
  }

  return STANDARD_PRINT_COLLECTIONS.map(({ key, label }) => ({
    key,
    label,
    recipes: [...(recipesByCollection.get(key) ?? [])].sort(compareRecipes),
  }));
}
