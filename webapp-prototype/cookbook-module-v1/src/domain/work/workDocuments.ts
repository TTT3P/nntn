import type {
  IngredientLine,
  RecipeIdentity,
  RecipeVersion,
  WorkDocument,
  WorkStage,
} from "../cookbook/types";

const WORK_STAGES = ["prep", "cook", "service"] as const;

export interface ProjectedWorkDocument extends WorkDocument {
  recipeId: RecipeIdentity;
  recipeVersionId: string;
  recipeName: string;
  ingredients: IngredientLine[];
  multiplier: number;
  blockers: string[];
}

export class InvalidWorkMultiplierError extends Error {
  readonly multiplier: number;

  constructor(multiplier: number) {
    super(`Work multiplier must be finite and positive: ${String(multiplier)}`);
    this.name = "InvalidWorkMultiplierError";
    this.multiplier = multiplier;
  }
}

export class InvalidWorkStageError extends Error {
  readonly stage: unknown;

  constructor(stage: unknown) {
    super(`Invalid work stage: ${String(stage)}`);
    this.name = "InvalidWorkStageError";
    this.stage = stage;
  }
}

export class WorkDocumentStageIntegrityError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly recipeVersionId: string;
  readonly recipeName: string;
  readonly keyStage: WorkStage;
  readonly documentStage: unknown;
  readonly offendingStepId: string | null;
  readonly offendingStepStage: unknown;

  constructor(
    recipe: RecipeVersion,
    keyStage: WorkStage,
    documentStage: unknown,
    offendingStep?: { stepId: string; stage: unknown },
  ) {
    const stepContext = offendingStep
      ? `; step ${offendingStep.stepId} has stage ${String(offendingStep.stage)}`
      : "";
    super(
      `Work document stage integrity failure in recipe ${recipe.name} (${String(recipe.recipeId)}, ${recipe.recipeVersionId}): key ${keyStage}, document ${String(documentStage)}${stepContext}`,
    );
    this.name = "WorkDocumentStageIntegrityError";
    this.recipeId = recipe.recipeId;
    this.recipeVersionId = recipe.recipeVersionId;
    this.recipeName = recipe.name;
    this.keyStage = keyStage;
    this.documentStage = documentStage;
    this.offendingStepId = offendingStep?.stepId ?? null;
    this.offendingStepStage = offendingStep?.stage ?? null;
  }
}

export class InvalidIngredientSourceValueError extends Error {
  readonly lineKey: string;
  readonly itemName: string;
  readonly stage: WorkStage;
  readonly value: unknown;

  constructor(line: IngredientLine, stage: WorkStage, value: unknown) {
    super(
      `Invalid source value for ${line.itemName} (${line.lineKey}) in ${stage}: ${String(value)}`,
    );
    this.name = "InvalidIngredientSourceValueError";
    this.lineKey = line.lineKey;
    this.itemName = line.itemName;
    this.stage = stage;
    this.value = value;
  }
}

export class InvalidProjectedWorkDocumentFieldError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly field: string;
  readonly value: unknown;

  constructor(recipeId: RecipeIdentity, field: string, value: unknown) {
    super(`Invalid projected work document field ${field} for recipe ${String(recipeId)}: ${String(value)}`);
    this.name = "InvalidProjectedWorkDocumentFieldError";
    this.recipeId = recipeId;
    this.field = field;
    this.value = value;
  }
}

type DuplicateProjectedRecipeField = "recipe_identity" | "recipe_version_id";

export class DuplicateProjectedRecipeError extends Error {
  readonly duplicateField: DuplicateProjectedRecipeField;
  readonly firstRecipeId: RecipeIdentity;
  readonly firstRecipeVersionId: string;
  readonly firstRecipeName: string;
  readonly duplicateRecipeId: RecipeIdentity;
  readonly duplicateRecipeVersionId: string;
  readonly duplicateRecipeName: string;

  constructor(
    duplicateField: DuplicateProjectedRecipeField,
    firstRecipe: RecipeVersion,
    duplicateRecipe: RecipeVersion,
  ) {
    super(
      `Duplicate projected recipe ${duplicateField}: ${firstRecipe.name} (${String(firstRecipe.recipeId)}, ${firstRecipe.recipeVersionId}) and ${duplicateRecipe.name} (${String(duplicateRecipe.recipeId)}, ${duplicateRecipe.recipeVersionId})`,
    );
    this.name = "DuplicateProjectedRecipeError";
    this.duplicateField = duplicateField;
    this.firstRecipeId = firstRecipe.recipeId;
    this.firstRecipeVersionId = firstRecipe.recipeVersionId;
    this.firstRecipeName = firstRecipe.name;
    this.duplicateRecipeId = duplicateRecipe.recipeId;
    this.duplicateRecipeVersionId = duplicateRecipe.recipeVersionId;
    this.duplicateRecipeName = duplicateRecipe.name;
  }
}

abstract class WorkIngredientLineKeyError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly recipeVersionId: string;
  readonly stage: WorkStage;
  readonly lineKey: string;

  protected constructor(
    message: string,
    recipe: RecipeVersion,
    stage: WorkStage,
    lineKey: string,
  ) {
    super(message);
    this.recipeId = recipe.recipeId;
    this.recipeVersionId = recipe.recipeVersionId;
    this.stage = stage;
    this.lineKey = lineKey;
  }
}

export class MissingWorkIngredientLineKeyError extends WorkIngredientLineKeyError {
  constructor(recipe: RecipeVersion, stage: WorkStage, lineKey: string) {
    super(
      `Missing ingredient line for ${stage} document in recipe ${recipe.name} (${String(recipe.recipeId)}, ${recipe.recipeVersionId}): ${lineKey}`,
      recipe,
      stage,
      lineKey,
    );
    this.name = "MissingWorkIngredientLineKeyError";
  }
}

export class DuplicateWorkIngredientLineKeyError extends WorkIngredientLineKeyError {
  constructor(recipe: RecipeVersion, stage: WorkStage, lineKey: string) {
    super(
      `Duplicate ingredient line key for ${stage} document in recipe ${recipe.name} (${String(recipe.recipeId)}, ${recipe.recipeVersionId}): ${lineKey}`,
      recipe,
      stage,
      lineKey,
    );
    this.name = "DuplicateWorkIngredientLineKeyError";
  }
}

function validateMultiplier(multiplier: number): void {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new InvalidWorkMultiplierError(multiplier);
  }
}

function isWorkStage(stage: unknown): stage is WorkStage {
  return stage === "prep" || stage === "cook" || stage === "service";
}

function validateWorkStage(stage: unknown): asserts stage is WorkStage {
  if (!isWorkStage(stage)) {
    throw new InvalidWorkStageError(stage);
  }
}

function validateRequestedStage(
  stage: unknown,
): asserts stage is WorkStage | "all" {
  if (!isWorkStage(stage) && stage !== "all") {
    throw new InvalidWorkStageError(stage);
  }
}

function recipeIdentityKey(recipeId: RecipeIdentity): string {
  return typeof recipeId === "number"
    ? `number:${String(recipeId)}`
    : `string:${JSON.stringify(recipeId)}`;
}

function validateUniqueRecipes(recipes: RecipeVersion[]): void {
  const recipesByIdentity = new Map<string, RecipeVersion>();
  const recipesByVersionId = new Map<string, RecipeVersion>();

  for (const recipe of recipes) {
    const identityKey = recipeIdentityKey(recipe.recipeId);
    const identityMatch = recipesByIdentity.get(identityKey);
    if (identityMatch) {
      throw new DuplicateProjectedRecipeError(
        "recipe_identity",
        identityMatch,
        recipe,
      );
    }
    recipesByIdentity.set(identityKey, recipe);

    const versionMatch = recipesByVersionId.get(recipe.recipeVersionId);
    if (versionMatch) {
      throw new DuplicateProjectedRecipeError(
        "recipe_version_id",
        versionMatch,
        recipe,
      );
    }
    recipesByVersionId.set(recipe.recipeVersionId, recipe);
  }
}

function contributesWorkDocument(
  recipe: RecipeVersion,
  requestedStage: WorkStage | "all",
): boolean {
  if (requestedStage !== "all") {
    return Boolean(recipe.workDocuments[requestedStage]);
  }

  return WORK_STAGES.some((stage) => Boolean(recipe.workDocuments[stage]));
}

function validateDocumentStage(
  recipe: RecipeVersion,
  keyStage: WorkStage,
  document: WorkDocument,
): void {
  if (document.stage !== keyStage) {
    throw new WorkDocumentStageIntegrityError(
      recipe,
      keyStage,
      document.stage,
    );
  }

  for (const step of document.steps) {
    if (step.stage !== keyStage) {
      throw new WorkDocumentStageIntegrityError(
        recipe,
        keyStage,
        document.stage,
        { stepId: step.stepId, stage: step.stage },
      );
    }
  }
}

function requireString(recipeId: RecipeIdentity, field: string, value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new InvalidProjectedWorkDocumentFieldError(recipeId, field, value);
  }
}

function requireArray(recipeId: RecipeIdentity, field: string, value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new InvalidProjectedWorkDocumentFieldError(recipeId, field, value);
  }
}

function validateProjectionInputs(recipe: RecipeVersion, document: WorkDocument): void {
  requireString(recipe.recipeId, "recipeVersionId", recipe.recipeVersionId);
  requireString(recipe.recipeId, "recipeName", recipe.name);
  requireArray(recipe.recipeId, "blockers", recipe.blockers);
  for (const blocker of recipe.blockers) {
    requireString(recipe.recipeId, "blockers[]", blocker);
  }
  requireArray(recipe.recipeId, "lines", recipe.lines);
  requireArray(recipe.recipeId, "ingredientLineKeys", document.ingredientLineKeys);
  for (const lineKey of document.ingredientLineKeys) {
    requireString(recipe.recipeId, "ingredientLineKeys[]", lineKey);
  }
  requireArray(recipe.recipeId, "steps", document.steps);
  for (const step of document.steps) {
    requireString(recipe.recipeId, "steps[].stepId", step.stepId);
    requireString(recipe.recipeId, `steps[${step.stepId}].instruction`, step.instruction);
    if (!Number.isFinite(step.order) || !Number.isInteger(step.order)) {
      throw new InvalidProjectedWorkDocumentFieldError(
        recipe.recipeId,
        `steps[${step.stepId}].order`,
        step.order,
      );
    }
  }
}

function validateProjectedDocument(document: ProjectedWorkDocument): void {
  requireString(document.recipeId, "recipeVersionId", document.recipeVersionId);
  requireString(document.recipeId, "recipeName", document.recipeName);
  for (const blocker of document.blockers) {
    requireString(document.recipeId, "blockers[]", blocker);
  }
  for (const ingredient of document.ingredients) {
    requireString(document.recipeId, `ingredients[${ingredient.lineKey}].itemName`, ingredient.itemName);
    if (ingredient.sourceText !== null) {
      requireString(document.recipeId, `ingredients[${ingredient.lineKey}].sourceText`, ingredient.sourceText);
    }
    if (ingredient.sourceUnit !== null) {
      requireString(document.recipeId, `ingredients[${ingredient.lineKey}].sourceUnit`, ingredient.sourceUnit);
    }
  }
  for (const step of document.steps) {
    requireString(document.recipeId, "steps[].stepId", step.stepId);
    requireString(document.recipeId, `steps[${step.stepId}].instruction`, step.instruction);
    if (!Number.isFinite(step.order) || !Number.isInteger(step.order)) {
      throw new InvalidProjectedWorkDocumentFieldError(
        document.recipeId,
        `steps[${step.stepId}].order`,
        step.order,
      );
    }
  }
}

export function scaleIngredientLine(
  line: IngredientLine,
  multiplier: number,
  stage: WorkStage,
): IngredientLine {
  validateMultiplier(multiplier);

  const runtimeStage: unknown = stage;
  validateWorkStage(runtimeStage);

  const sourceValue: unknown = line.sourceValue;
  if (
    sourceValue !== null &&
    (typeof sourceValue !== "number" || !Number.isFinite(sourceValue))
  ) {
    throw new InvalidIngredientSourceValueError(line, runtimeStage, sourceValue);
  }

  const scaledValue =
    runtimeStage !== "service" && sourceValue !== null
      ? sourceValue * multiplier
      : sourceValue;
  if (typeof scaledValue === "number" && !Number.isFinite(scaledValue)) {
    throw new InvalidIngredientSourceValueError(line, runtimeStage, scaledValue);
  }

  return {
    ...line,
    sourceValue: scaledValue,
  };
}

function resolveIngredients(
  recipe: RecipeVersion,
  document: WorkDocument,
  stage: WorkStage,
  multiplier: number,
): IngredientLine[] {
  const linesByKey = new Map<string, IngredientLine[]>();
  for (const line of recipe.lines) {
    const matches = linesByKey.get(line.lineKey);
    if (matches) matches.push(line);
    else linesByKey.set(line.lineKey, [line]);
  }

  const resolvedKeys = new Set<string>();
  return document.ingredientLineKeys.map((lineKey) => {
    if (resolvedKeys.has(lineKey)) {
      throw new DuplicateWorkIngredientLineKeyError(recipe, stage, lineKey);
    }
    resolvedKeys.add(lineKey);

    const matches = linesByKey.get(lineKey);
    if (!matches || matches.length === 0) {
      throw new MissingWorkIngredientLineKeyError(recipe, stage, lineKey);
    }
    if (matches.length > 1) {
      throw new DuplicateWorkIngredientLineKeyError(recipe, stage, lineKey);
    }

    return scaleIngredientLine(matches[0], multiplier, stage);
  });
}

function projectStage(
  recipes: RecipeVersion[],
  stage: WorkStage,
  requestedMultiplier: number,
): ProjectedWorkDocument[] {
  const projected: ProjectedWorkDocument[] = [];

  for (const recipe of recipes) {
    const document = recipe.workDocuments[stage];
    if (!document) continue;
    validateProjectionInputs(recipe, document);
    validateDocumentStage(recipe, stage, document);

    const multiplier =
      stage === "service" || !document.scalable ? 1 : requestedMultiplier;
    const projectedDocument: ProjectedWorkDocument = {
      stage,
      scalable: document.scalable,
      ingredientLineKeys: [...document.ingredientLineKeys],
      steps: document.steps.map((step) => ({ ...step })),
      recipeId: recipe.recipeId,
      recipeVersionId: recipe.recipeVersionId,
      recipeName: recipe.name,
      ingredients: resolveIngredients(recipe, document, stage, multiplier),
      multiplier,
      blockers: [...recipe.blockers],
    };
    validateProjectedDocument(projectedDocument);
    projected.push(projectedDocument);
  }

  return projected;
}

export function projectWorkDocuments(
  recipes: RecipeVersion[],
  settings: { stage: WorkStage | "all"; multiplier: number },
): ProjectedWorkDocument[] {
  const runtimeStage: unknown = settings.stage;
  validateRequestedStage(runtimeStage);
  validateMultiplier(settings.multiplier);
  const contributors = recipes.filter((recipe) =>
    contributesWorkDocument(recipe, runtimeStage),
  );
  validateUniqueRecipes(contributors);

  if (runtimeStage !== "all") {
    return projectStage(contributors, runtimeStage, settings.multiplier);
  }

  return WORK_STAGES.flatMap((stage) =>
    projectStage(contributors, stage, settings.multiplier),
  );
}
