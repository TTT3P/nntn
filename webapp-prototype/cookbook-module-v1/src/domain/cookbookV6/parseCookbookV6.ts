import type {
  CookbookV6BlockerEvidence,
  CookbookV6Document,
  CookbookV6IngredientLine,
  CookbookV6MethodStep,
  CookbookV6Recipe,
  CookbookV6Stage,
  CookbookV6WorkDocument,
} from "./types.ts";

const STAGES: CookbookV6Stage[] = ["prep", "cook", "service"];

function invalid(): never {
  throw new Error("INVALID_COOKBOOK_DOCUMENT");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}

function meaningfulString(value: unknown): string {
  const text = stringValue(value);
  return text.trim().length > 0 ? text : invalid();
}

function nullableString(value: unknown): string | null {
  return value === null ? null : stringValue(value);
}

function booleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : invalid();
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : invalid();
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) invalid();
  return value.map(stringValue);
}

function identity(value: unknown): string | number | null {
  if (value === null) return null;
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return invalid();
}

function sha256(value: unknown): string {
  const text = stringValue(value);
  return /^[0-9a-f]{64}$/u.test(text) ? text : invalid();
}

function parseIngredient(value: unknown): CookbookV6IngredientLine {
  if (!isRecord(value)) invalid();
  const kind = value.kind;
  if (kind !== "ingredient" && kind !== "prepared_recipe") invalid();
  return {
    lineId: meaningfulString(value.lineId),
    name: meaningfulString(value.name),
    kind,
    amountText: stringValue(value.amountText),
    unitText: stringValue(value.unitText),
    sourceDisplayText: stringValue(value.sourceDisplayText),
    ingredientId: identity(value.ingredientId),
    componentRecipeId: nullableString(value.componentRecipeId),
    servingNote: stringValue(value.servingNote),
    costBasisText: stringValue(value.costBasisText ?? ""),
    decisionStatus: stringValue(value.decisionStatus ?? ""),
    selectedSource: nullableString(value.selectedSource ?? null),
    active: booleanValue(value.active),
  };
}

function parseMethodStep(value: unknown): CookbookV6MethodStep {
  if (!isRecord(value)) invalid();
  if (!STAGES.includes(value.stage as CookbookV6Stage)) invalid();
  return {
    stepId: meaningfulString(value.stepId),
    stage: value.stage as CookbookV6Stage,
    instruction: meaningfulString(value.instruction),
    order: finiteNumber(value.order),
  };
}

function parseBlocker(value: unknown): CookbookV6BlockerEvidence {
  if (!isRecord(value)) invalid();
  return {
    code: meaningfulString(value.code),
    message: meaningfulString(value.message),
    resolved: booleanValue(value.resolved),
    resolvedNote: stringValue(value.resolvedNote),
    resolvedAt: stringValue(value.resolvedAt),
  };
}

function parseWorkDocument(value: unknown, stage: CookbookV6Stage): CookbookV6WorkDocument {
  if (!isRecord(value) || value.stage !== stage) invalid();
  return {
    stage,
    scalable: booleanValue(value.scalable),
    ingredientLineIds: stringArray(value.ingredientLineIds),
    stepIds: stringArray(value.stepIds),
  };
}

function parseRecipe(value: unknown): CookbookV6Recipe {
  if (!isRecord(value)) invalid();
  const kind = value.kind;
  if (kind !== "sellable_menu" && kind !== "prepared_recipe" && kind !== "sub_recipe") invalid();
  if (!Array.isArray(value.ingredients) || !Array.isArray(value.methodSteps) || !Array.isArray(value.blockers)) invalid();
  if (!isRecord(value.workDocuments) || !isRecord(value.lineage)) invalid();

  const ingredients = value.ingredients.map(parseIngredient);
  const methodSteps = value.methodSteps.map(parseMethodStep);
  if (new Set(ingredients.map(({ lineId }) => lineId)).size !== ingredients.length) invalid();
  if (new Set(methodSteps.map(({ stepId }) => stepId)).size !== methodSteps.length) invalid();

  const workDocuments: CookbookV6Recipe["workDocuments"] = {};
  for (const stage of STAGES) {
    if (value.workDocuments[stage] !== undefined) {
      workDocuments[stage] = parseWorkDocument(value.workDocuments[stage], stage);
    }
  }
  const lineIds = new Set(ingredients.map(({ lineId }) => lineId));
  const stepIds = new Set(methodSteps.map(({ stepId }) => stepId));
  for (const document of Object.values(workDocuments)) {
    if (document.ingredientLineIds.some((lineId) => !lineIds.has(lineId))) invalid();
    if (document.stepIds.some((stepId) => !stepIds.has(stepId))) invalid();
  }

  const source = value.lineage.source;
  if (source !== "v5" && source !== "catalog") invalid();
  return {
    recipeId: meaningfulString(value.recipeId),
    code: nullableString(value.code),
    name: meaningfulString(value.name),
    kind,
    category: stringValue(value.category),
    active: booleanValue(value.active),
    reviewState: stringValue(value.reviewState),
    sourceLocators: stringArray(value.sourceLocators),
    yieldText: stringValue(value.yieldText),
    operationalNotes: stringArray(value.operationalNotes),
    methodDecisionNote: stringValue(value.methodDecisionNote),
    ingredients,
    methodSteps,
    blockers: value.blockers.map(parseBlocker),
    workDocuments,
    parentRecipeIds: stringArray(value.parentRecipeIds),
    lineage: { source, sourceRecipeId: identity(value.lineage.sourceRecipeId) },
  };
}

export function parseCookbookV6(value: unknown): CookbookV6Document {
  if (!isRecord(value) || value.schemaVersion !== "6.0.0" || !isRecord(value.derivedFrom) || !Array.isArray(value.recipes)) {
    invalid();
  }
  const recipes = value.recipes.map(parseRecipe);
  const recipeIds = new Set(recipes.map(({ recipeId }) => recipeId));
  if (recipeIds.size !== recipes.length) invalid();
  for (const recipe of recipes) {
    for (const line of recipe.ingredients) {
      if (line.componentRecipeId !== null && !recipeIds.has(line.componentRecipeId)) invalid();
    }
    if (recipe.parentRecipeIds.some((recipeId) => !recipeIds.has(recipeId))) invalid();
  }
  return {
    schemaVersion: "6.0.0",
    generatedAt: meaningfulString(value.generatedAt),
    derivedFrom: {
      v5Path: meaningfulString(value.derivedFrom.v5Path),
      v5Sha256: sha256(value.derivedFrom.v5Sha256),
      catalogSha256: sha256(value.derivedFrom.catalogSha256),
    },
    recipes,
  };
}
