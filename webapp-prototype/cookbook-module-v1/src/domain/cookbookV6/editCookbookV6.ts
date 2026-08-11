import { parseCookbookV6 } from "./parseCookbookV6";
import type {
  CookbookV6Document,
  CookbookV6IngredientLine,
  CookbookV6MethodStep,
  CookbookV6Recipe,
  CookbookV6Stage,
} from "./types";

export type RecipeEditablePatch = Partial<Pick<
  CookbookV6Recipe,
  "code" | "name" | "kind" | "category" | "active" | "yieldText" | "operationalNotes" | "methodDecisionNote"
>>;

export type IngredientEditablePatch = Partial<Pick<
  CookbookV6IngredientLine,
  "name" | "kind" | "amountText" | "unitText" | "ingredientId" | "componentRecipeId" | "servingNote" | "active"
>>;

export type MethodEditablePatch = Partial<Pick<CookbookV6MethodStep, "stage" | "instruction">>;

export type CookbookV6Edit =
  | { type: "recipe-update"; recipeId: string; patch: RecipeEditablePatch }
  | { type: "ingredient-add"; recipeId: string; afterLineId: string | null; line: CookbookV6IngredientLine; workStages?: CookbookV6Stage[] }
  | { type: "ingredient-update"; recipeId: string; lineId: string; patch: IngredientEditablePatch }
  | { type: "ingredient-rename"; recipeId: string; lineId: string; name: string }
  | { type: "ingredient-move"; recipeId: string; lineId: string; toIndex: number }
  | { type: "ingredient-remove"; recipeId: string; lineId: string }
  | { type: "method-add"; recipeId: string; step: CookbookV6MethodStep }
  | { type: "method-update"; recipeId: string; stepId: string; patch: MethodEditablePatch }
  | { type: "method-move"; recipeId: string; stepId: string; toIndex: number }
  | { type: "method-remove"; recipeId: string; stepId: string };

function fail(code: string): never {
  throw new Error(code);
}

function recipeFor(document: CookbookV6Document, recipeId: string): CookbookV6Recipe {
  return document.recipes.find((recipe) => recipe.recipeId === recipeId) ?? fail("UNKNOWN_RECIPE");
}

function lineFor(recipe: CookbookV6Recipe, lineId: string): CookbookV6IngredientLine {
  return recipe.ingredients.find((line) => line.lineId === lineId) ?? fail("UNKNOWN_INGREDIENT_LINE");
}

function stepFor(recipe: CookbookV6Recipe, stepId: string): CookbookV6MethodStep {
  return recipe.methodSteps.find((step) => step.stepId === stepId) ?? fail("UNKNOWN_METHOD_STEP");
}

function move<T>(values: T[], fromIndex: number, toIndex: number): void {
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= values.length) fail("INVALID_MOVE_INDEX");
  const [value] = values.splice(fromIndex, 1);
  if (value === undefined) fail("UNKNOWN_EDIT_TARGET");
  values.splice(toIndex, 0, value);
}

function quantityText(line: Pick<CookbookV6IngredientLine, "amountText" | "unitText">): string {
  return line.unitText === "" ? line.amountText : `${line.amountText} ${line.unitText}`;
}

function syncIngredientOrder(recipe: CookbookV6Recipe): void {
  const order = new Map(recipe.ingredients.map((line, index) => [line.lineId, index]));
  for (const workDocument of Object.values(recipe.workDocuments)) {
    workDocument.ingredientLineIds.sort((left, right) => order.get(left)! - order.get(right)!);
  }
}

function syncMethodOrder(recipe: CookbookV6Recipe): void {
  recipe.methodSteps.forEach((step, index) => { step.order = index + 1; });
  const order = new Map(recipe.methodSteps.map((step, index) => [step.stepId, index]));
  for (const workDocument of Object.values(recipe.workDocuments)) {
    workDocument.stepIds.sort((left, right) => order.get(left)! - order.get(right)!);
  }
}

function stagesForNewLine(recipe: CookbookV6Recipe, requested: CookbookV6Stage[] | undefined): CookbookV6Stage[] {
  if (requested !== undefined) return [...new Set(requested)];
  const current = Object.keys(recipe.workDocuments) as CookbookV6Stage[];
  return current.length === 1 ? current : [];
}

function ensureWorkDocument(recipe: CookbookV6Recipe, stage: CookbookV6Stage) {
  const existing = recipe.workDocuments[stage];
  if (existing !== undefined) return existing;
  const created = { stage, scalable: false, ingredientLineIds: [] as string[], stepIds: [] as string[] };
  recipe.workDocuments[stage] = created;
  return created;
}

function applyEdit(document: CookbookV6Document, edit: CookbookV6Edit): void {
  const recipe = recipeFor(document, edit.recipeId);
  switch (edit.type) {
    case "recipe-update":
      Object.assign(recipe, edit.patch);
      return;
    case "ingredient-add": {
      if (recipe.ingredients.some((line) => line.lineId === edit.line.lineId)) fail("DUPLICATE_INGREDIENT_LINE");
      const insertAt = edit.afterLineId === null
        ? recipe.ingredients.length
        : recipe.ingredients.findIndex((line) => line.lineId === edit.afterLineId) + 1;
      if (insertAt === 0 && edit.afterLineId !== null) fail("UNKNOWN_INGREDIENT_LINE");
      recipe.ingredients.splice(insertAt, 0, structuredClone(edit.line));
      for (const stage of stagesForNewLine(recipe, edit.workStages)) {
        ensureWorkDocument(recipe, stage).ingredientLineIds.push(edit.line.lineId);
      }
      syncIngredientOrder(recipe);
      return;
    }
    case "ingredient-update": {
      const line = lineFor(recipe, edit.lineId);
      Object.assign(line, edit.patch);
      if (edit.patch.amountText !== undefined || edit.patch.unitText !== undefined) {
        line.sourceDisplayText = quantityText(line);
      }
      return;
    }
    case "ingredient-rename":
      lineFor(recipe, edit.lineId).name = edit.name;
      return;
    case "ingredient-move": {
      const fromIndex = recipe.ingredients.findIndex((line) => line.lineId === edit.lineId);
      if (fromIndex < 0) fail("UNKNOWN_INGREDIENT_LINE");
      move(recipe.ingredients, fromIndex, edit.toIndex);
      syncIngredientOrder(recipe);
      return;
    }
    case "ingredient-remove":
      lineFor(recipe, edit.lineId);
      recipe.ingredients = recipe.ingredients.filter((line) => line.lineId !== edit.lineId);
      for (const workDocument of Object.values(recipe.workDocuments)) {
        workDocument.ingredientLineIds = workDocument.ingredientLineIds.filter((lineId) => lineId !== edit.lineId);
      }
      return;
    case "method-add":
      if (recipe.methodSteps.some((step) => step.stepId === edit.step.stepId)) fail("DUPLICATE_METHOD_STEP");
      recipe.methodSteps.push(structuredClone(edit.step));
      ensureWorkDocument(recipe, edit.step.stage).stepIds.push(edit.step.stepId);
      syncMethodOrder(recipe);
      return;
    case "method-update": {
      const step = stepFor(recipe, edit.stepId);
      const previousStage = step.stage;
      Object.assign(step, edit.patch);
      if (step.stage !== previousStage) {
        const previousDocument = recipe.workDocuments[previousStage];
        if (previousDocument !== undefined) {
          previousDocument.stepIds = previousDocument.stepIds.filter((stepId) => stepId !== step.stepId);
        }
        ensureWorkDocument(recipe, step.stage).stepIds.push(step.stepId);
      }
      syncMethodOrder(recipe);
      return;
    }
    case "method-move": {
      const fromIndex = recipe.methodSteps.findIndex((step) => step.stepId === edit.stepId);
      if (fromIndex < 0) fail("UNKNOWN_METHOD_STEP");
      move(recipe.methodSteps, fromIndex, edit.toIndex);
      syncMethodOrder(recipe);
      return;
    }
    case "method-remove":
      stepFor(recipe, edit.stepId);
      recipe.methodSteps = recipe.methodSteps.filter((step) => step.stepId !== edit.stepId);
      for (const workDocument of Object.values(recipe.workDocuments)) {
        workDocument.stepIds = workDocument.stepIds.filter((stepId) => stepId !== edit.stepId);
      }
      syncMethodOrder(recipe);
  }
}

export function applyCookbookV6Edits(
  document: CookbookV6Document,
  edits: readonly CookbookV6Edit[],
): CookbookV6Document {
  const edited = structuredClone(document);
  for (const edit of edits) applyEdit(edited, edit);
  return parseCookbookV6(edited);
}
