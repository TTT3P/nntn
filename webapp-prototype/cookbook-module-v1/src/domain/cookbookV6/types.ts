import type { RecipeIdentity } from "../sot/kitchenSotDocument";

export type CookbookV6RecipeKind = "sellable_menu" | "prepared_recipe" | "sub_recipe";
export type CookbookV6Stage = "prep" | "cook" | "service";

export interface CookbookV6IngredientLine {
  lineId: string;
  name: string;
  kind: "ingredient" | "prepared_recipe";
  amountText: string;
  unitText: string;
  sourceDisplayText: string;
  ingredientId: RecipeIdentity | null;
  componentRecipeId: string | null;
  servingNote: string;
  costBasisText: string;
  decisionStatus: string;
  selectedSource: string | null;
  active: boolean;
}

export interface CookbookV6MethodStep {
  stepId: string;
  stage: CookbookV6Stage;
  instruction: string;
  order: number;
}

export interface CookbookV6WorkDocument {
  stage: CookbookV6Stage;
  scalable: boolean;
  ingredientLineIds: string[];
  stepIds: string[];
}

export interface CookbookV6BlockerEvidence {
  code: string;
  message: string;
  resolved: boolean;
  resolvedNote: string;
  resolvedAt: string;
}

export interface CookbookV6Recipe {
  recipeId: string;
  code: string | null;
  name: string;
  kind: CookbookV6RecipeKind;
  category: string;
  active: boolean;
  reviewState: string;
  sourceLocators: string[];
  yieldText: string;
  operationalNotes: string[];
  methodDecisionNote: string;
  ingredients: CookbookV6IngredientLine[];
  methodSteps: CookbookV6MethodStep[];
  blockers: CookbookV6BlockerEvidence[];
  workDocuments: Partial<Record<CookbookV6Stage, CookbookV6WorkDocument>>;
  parentRecipeIds: string[];
  lineage: { source: "v5" | "catalog"; sourceRecipeId: RecipeIdentity | null };
}

export interface CookbookV6Document {
  schemaVersion: "6.0.0";
  generatedAt: string;
  derivedFrom: {
    v5Path: string;
    v5Sha256: string;
    catalogSha256: string;
  };
  recipes: CookbookV6Recipe[];
}

export interface V5RecipeCrosswalkEntry {
  sourceRecipeId: RecipeIdentity;
  targetRecipeId: string;
  catalogCode: string | null;
}
