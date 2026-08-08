import type {
  CookbookSnapshot,
  IngredientLine,
  RecipeIdentity,
  RecipeVersion,
  WorkDocument,
  WorkStage,
} from "../cookbook/types";
import {
  isKitchenSotRecipeDraft,
  type JsonValue,
  type KitchenSotDocument,
  type KitchenSotItem,
  type KitchenSotRecipe,
} from "./kitchenSotDocument";

export interface KitchenSotPrintProjection {
  snapshot: CookbookSnapshot;
  recipeDraftById: ReadonlyMap<RecipeIdentity, boolean>;
}

export class InvalidKitchenSotPrintFieldError extends Error {
  constructor(field: string, value: unknown) {
    super(`Invalid Kitchen SOT print field ${field}: ${String(value)}`);
    this.name = "InvalidKitchenSotPrintFieldError";
  }
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(
  field: string,
  value: JsonValue | undefined,
): Record<string, JsonValue> {
  if (!isRecord(value)) throw new InvalidKitchenSotPrintFieldError(field, value);
  return value;
}

function requiredString(field: string, value: JsonValue | undefined): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidKitchenSotPrintFieldError(field, value);
  }
  return value;
}

function requiredBoolean(field: string, value: JsonValue | undefined): boolean {
  if (typeof value !== "boolean") {
    throw new InvalidKitchenSotPrintFieldError(field, value);
  }
  return value;
}

function requiredStringArray(field: string, value: JsonValue | undefined): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new InvalidKitchenSotPrintFieldError(field, value);
  }
  return [...value] as string[];
}

function requiredIdentityArray(
  field: string,
  value: JsonValue | undefined,
): RecipeIdentity[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) =>
      (typeof entry !== "string" || entry.length === 0) &&
      (typeof entry !== "number" || !Number.isFinite(entry)))
  ) {
    throw new InvalidKitchenSotPrintFieldError(field, value);
  }
  return [...value] as RecipeIdentity[];
}

function mapItem(recipeIndex: number, itemIndex: number, item: KitchenSotItem): IngredientLine {
  const field = `recipes[${String(recipeIndex)}].items[${String(itemIndex)}]`;
  const itemKind = item.item_kind;
  if (itemKind !== "direct_ingredient" && itemKind !== "prepared_recipe") {
    throw new InvalidKitchenSotPrintFieldError(`${field}.item_kind`, itemKind);
  }
  const ingredientId = item.ingredient_id;
  if (
    ingredientId !== undefined &&
    ingredientId !== null &&
    (typeof ingredientId !== "number" || !Number.isFinite(ingredientId))
  ) {
    throw new InvalidKitchenSotPrintFieldError(`${field}.ingredient_id`, ingredientId);
  }
  return {
    lineKey: item.line_key,
    itemName: item.item_name,
    itemKind,
    ingredientId: typeof ingredientId === "number" ? ingredientId : null,
    componentRecipeId: item.component_recipe_id,
    sourceText: item.candidate_text,
    sourceValue: null,
    sourceUnit: null,
    decisionStatus: item.decision_status,
    selectedSource: item.selected_source,
  };
}

function mapWorkDocuments(
  recipeIndex: number,
  recipeVersionId: string,
  rawDocuments: JsonValue | undefined,
): RecipeVersion["workDocuments"] {
  const documents = requiredRecord(
    `recipes[${String(recipeIndex)}].work_documents`,
    rawDocuments,
  );
  const mapped: RecipeVersion["workDocuments"] = {};
  for (const stage of ["prep", "cook", "service"] as const) {
    const rawDocument = documents[stage];
    if (rawDocument === undefined) continue;
    const field = `recipes[${String(recipeIndex)}].work_documents.${stage}`;
    const document = requiredRecord(field, rawDocument);
    if (document.stage !== stage) {
      throw new InvalidKitchenSotPrintFieldError(`${field}.stage`, document.stage);
    }
    const ingredientLineKeys = requiredStringArray(
      `${field}.ingredient_line_keys`,
      document.ingredient_line_keys,
    );
    const instructions = requiredStringArray(`${field}.steps`, document.steps);
    const workDocument: WorkDocument = {
      stage: stage as WorkStage,
      scalable: requiredBoolean(`${field}.scalable`, document.scalable),
      ingredientLineKeys,
      steps: instructions.map((instruction, index) => ({
        stepId: `${recipeVersionId}:${stage}:${String(index + 1)}`,
        stage,
        instruction,
        order: index + 1,
      })),
    };
    mapped[stage] = workDocument;
  }
  return mapped;
}

function mapRecipe(recipe: KitchenSotRecipe, recipeIndex: number): RecipeVersion {
  const recipeVersionId = requiredString(
    `recipes[${String(recipeIndex)}].recipe_version_id`,
    recipe.recipe_version_id,
  );
  const draft = isKitchenSotRecipeDraft(recipe);
  return {
    recipeId: recipe.recipe_id,
    recipeVersionId,
    name: recipe.recipe_name,
    kind: recipe.recipe_type,
    parentRecipeIds: requiredIdentityArray(
      `recipes[${String(recipeIndex)}].parent_recipe_ids`,
      recipe.parent_recipe_ids,
    ),
    reviewState: draft ? "blocked" : "candidate",
    sourceLocators: requiredStringArray(
      `recipes[${String(recipeIndex)}].source_locators`,
      recipe.source_locators,
    ),
    lines: recipe.items.map((item, itemIndex) => mapItem(recipeIndex, itemIndex, item)),
    methodText: recipe.method_candidate_text,
    blockers: recipe.blockers
      .filter(({ resolved }) => resolved !== true)
      .map(({ message }) => message),
    operationalNotes: requiredStringArray(
      `recipes[${String(recipeIndex)}].operational_notes`,
      recipe.operational_notes,
    ),
    workDocuments: mapWorkDocuments(
      recipeIndex,
      recipeVersionId,
      recipe.work_documents,
    ),
  };
}

export function projectKitchenSotPrintSnapshot(
  document: KitchenSotDocument,
  mediaSnapshot: CookbookSnapshot,
): KitchenSotPrintProjection {
  const recipes = document.recipes.map(mapRecipe);
  return {
    snapshot: {
      recipes,
      media: structuredClone(mediaSnapshot.media),
      stepMedia: structuredClone(mediaSnapshot.stepMedia),
    },
    recipeDraftById: new Map(
      document.recipes.map((recipe) => [
        recipe.recipe_id,
        isKitchenSotRecipeDraft(recipe),
      ]),
    ),
  };
}
