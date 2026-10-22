import type {
  IngredientLine,
  RecipeIdentity,
  RecipeVersion,
  ReviewState,
} from "../cookbook/types";

export interface MediaCoverage {
  linked: number;
  reviewNeeded: number;
}

export interface RecipeReadiness {
  printableAsApproved: boolean;
  draft: boolean;
  missingMethod: boolean;
  blockers: string[];
  mediaGap: boolean;
  mediaReviewNeeded: boolean;
}

export interface ReviewQueueRow {
  recipeId: RecipeIdentity;
  recipeVersionId: string;
  recipeName: string;
  status: ReviewState;
  blockers: string[];
}

export class InvalidMediaCoverageError extends Error {
  readonly field: keyof MediaCoverage | "coverage";
  readonly value: unknown;

  constructor(
    field: keyof MediaCoverage | "coverage",
    value: unknown,
    reason: string,
  ) {
    super(`Invalid media coverage ${field}: ${String(value)} (${reason})`);
    this.name = "InvalidMediaCoverageError";
    this.field = field;
    this.value = value;
  }
}

type RecipeIdentityField = "recipeId" | "componentRecipeId";

export class InvalidRecipeIdentityError extends Error {
  readonly field: RecipeIdentityField;
  readonly value: unknown;
  readonly recipeName: string;
  readonly lineKey: string | null;

  constructor(
    field: RecipeIdentityField,
    value: unknown,
    recipeName: string,
    lineKey: string | null = null,
  ) {
    const location = lineKey === null ? "recipe" : `line ${lineKey}`;
    super(
      `Invalid ${field} in ${recipeName} at ${location}: ${String(value)}`,
    );
    this.name = "InvalidRecipeIdentityError";
    this.field = field;
    this.value = value;
    this.recipeName = recipeName;
    this.lineKey = lineKey;
  }
}

export class InvalidRecipeReviewStateError extends Error {
  readonly recipeId: unknown;
  readonly value: unknown;

  constructor(recipe: RecipeVersion, value: unknown) {
    super(`Invalid reviewState for ${recipe.name}: ${String(value)}`);
    this.name = "InvalidRecipeReviewStateError";
    this.recipeId = recipe.recipeId;
    this.value = value;
  }
}

export class InvalidRecipeNameError extends Error {
  readonly recipeId: unknown;
  readonly value: unknown;

  constructor(recipe: RecipeVersion, value: unknown) {
    super(`Invalid recipe name for ${String(recipe.recipeId)}: ${String(value)}`);
    this.name = "InvalidRecipeNameError";
    this.recipeId = recipe.recipeId;
    this.value = value;
  }
}

export class InvalidRecipeVersionIdError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly value: unknown;

  constructor(recipe: RecipeVersion, value: unknown) {
    super(`Invalid recipeVersionId for ${recipe.name}: ${String(value)}`);
    this.name = "InvalidRecipeVersionIdError";
    this.recipeId = recipe.recipeId;
    this.value = value;
  }
}

export class InvalidRecipeLineKeyError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly value: unknown;

  constructor(recipe: RecipeVersion, value: unknown) {
    super(`Invalid lineKey in ${recipe.name}: ${String(value)}`);
    this.name = "InvalidRecipeLineKeyError";
    this.recipeId = recipe.recipeId;
    this.value = value;
  }
}

export class DuplicateRecipeLineKeyError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly lineKey: string;

  constructor(recipe: RecipeVersion, lineKey: string) {
    super(`Duplicate lineKey in ${recipe.name}: ${lineKey}`);
    this.name = "DuplicateRecipeLineKeyError";
    this.recipeId = recipe.recipeId;
    this.lineKey = lineKey;
  }
}

export class InvalidIngredientItemNameError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly lineKey: string;
  readonly value: unknown;

  constructor(recipe: RecipeVersion, line: IngredientLine, value: unknown) {
    super(`Invalid itemName in ${recipe.name} at line ${line.lineKey}`);
    this.name = "InvalidIngredientItemNameError";
    this.recipeId = recipe.recipeId;
    this.lineKey = line.lineKey;
    this.value = value;
  }
}

export class DuplicateReviewQueueRecipeIdentityError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly firstRecipeVersionId: string;
  readonly duplicateRecipeVersionId: string;

  constructor(first: ReviewQueueRow, duplicate: ReviewQueueRow) {
    super(
      `Duplicate review queue recipe identity ${String(duplicate.recipeId)}: ${first.recipeVersionId} and ${duplicate.recipeVersionId}`,
    );
    this.name = "DuplicateReviewQueueRecipeIdentityError";
    this.recipeId = duplicate.recipeId;
    this.firstRecipeVersionId = first.recipeVersionId;
    this.duplicateRecipeVersionId = duplicate.recipeVersionId;
  }
}

export class DuplicateReviewQueueRecipeVersionIdError extends Error {
  readonly recipeVersionId: string;
  readonly firstRecipeId: RecipeIdentity;
  readonly duplicateRecipeId: RecipeIdentity;

  constructor(first: ReviewQueueRow, duplicate: ReviewQueueRow) {
    super(
      `Duplicate review queue recipeVersionId ${duplicate.recipeVersionId}: ${String(first.recipeId)} and ${String(duplicate.recipeId)}`,
    );
    this.name = "DuplicateReviewQueueRecipeVersionIdError";
    this.recipeVersionId = duplicate.recipeVersionId;
    this.firstRecipeId = first.recipeId;
    this.duplicateRecipeId = duplicate.recipeId;
  }
}

export class InvalidIngredientSourceValueError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly lineKey: string;
  readonly value: unknown;

  constructor(recipe: RecipeVersion, line: IngredientLine, value: unknown) {
    super(
      `Invalid sourceValue for ${line.itemName} in ${recipe.name}: ${String(value)}`,
    );
    this.name = "InvalidIngredientSourceValueError";
    this.recipeId = recipe.recipeId;
    this.lineKey = line.lineKey;
    this.value = value;
  }
}

export class InvalidIngredientSourceEvidenceError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly lineKey: string;
  readonly field: "sourceText" | "sourceUnit";
  readonly value: unknown;

  constructor(
    recipe: RecipeVersion,
    line: IngredientLine,
    field: "sourceText" | "sourceUnit",
    value: unknown,
  ) {
    super(
      `Invalid ${field} for ${line.itemName} in ${recipe.name}: ${String(value)}`,
    );
    this.name = "InvalidIngredientSourceEvidenceError";
    this.recipeId = recipe.recipeId;
    this.lineKey = line.lineKey;
    this.field = field;
    this.value = value;
  }
}

const INVISIBLE_CHARACTER = /[\p{White_Space}\p{Cc}\p{Cf}\p{Cs}\p{M}]/u;

function hasMeaningfulText(value: unknown): value is string {
  if (typeof value !== "string") return false;
  for (const character of value) {
    if (!INVISIBLE_CHARACTER.test(character)) return true;
  }
  return false;
}

function validateMediaCoverage(media: unknown): asserts media is MediaCoverage {
  if (media === null || typeof media !== "object" || Array.isArray(media)) {
    throw new InvalidMediaCoverageError(
      "coverage",
      media,
      "expected a non-null object",
    );
  }

  const coverage = media as Record<string, unknown>;
  for (const field of ["linked", "reviewNeeded"] as const) {
    const value = coverage[field];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new InvalidMediaCoverageError(
        field,
        value,
        "expected a finite non-negative integer",
      );
    }
  }

  const linked = coverage.linked as number;
  const reviewNeeded = coverage.reviewNeeded as number;
  if (reviewNeeded > linked) {
    throw new InvalidMediaCoverageError(
      "reviewNeeded",
      reviewNeeded,
      "cannot exceed linked",
    );
  }
}

function isRecipeIdentity(value: unknown): value is RecipeIdentity {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isInteger(value);
  }
  return hasMeaningfulText(value);
}

function validateRecipe(recipe: RecipeVersion): void {
  const recipeId: unknown = recipe.recipeId;
  if (!isRecipeIdentity(recipeId)) {
    throw new InvalidRecipeIdentityError(
      "recipeId",
      recipeId,
      String(recipe.name),
    );
  }

  if (!hasMeaningfulText(recipe.name)) {
    throw new InvalidRecipeNameError(recipe, recipe.name);
  }
  if (!hasMeaningfulText(recipe.recipeVersionId)) {
    throw new InvalidRecipeVersionIdError(recipe, recipe.recipeVersionId);
  }

  const reviewState: unknown = recipe.reviewState;
  if (
    reviewState !== "confirmed" &&
    reviewState !== "candidate" &&
    reviewState !== "conflict" &&
    reviewState !== "blocked"
  ) {
    throw new InvalidRecipeReviewStateError(recipe, reviewState);
  }

  const lineKeys = new Set<string>();
  for (const line of recipe.lines) {
    if (!hasMeaningfulText(line.lineKey)) {
      throw new InvalidRecipeLineKeyError(recipe, line.lineKey);
    }
    if (lineKeys.has(line.lineKey)) {
      throw new DuplicateRecipeLineKeyError(recipe, line.lineKey);
    }
    lineKeys.add(line.lineKey);

    if (!hasMeaningfulText(line.itemName)) {
      throw new InvalidIngredientItemNameError(recipe, line, line.itemName);
    }

    const componentRecipeId: unknown = line.componentRecipeId;
    if (
      componentRecipeId !== null &&
      !isRecipeIdentity(componentRecipeId)
    ) {
      throw new InvalidRecipeIdentityError(
        "componentRecipeId",
        componentRecipeId,
        recipe.name,
        line.lineKey,
      );
    }
  }
}

function validateSourceEvidence(
  recipe: RecipeVersion,
  line: IngredientLine,
): void {
  const sourceText: unknown = line.sourceText;
  if (sourceText !== null && typeof sourceText !== "string") {
    throw new InvalidIngredientSourceEvidenceError(
      recipe,
      line,
      "sourceText",
      sourceText,
    );
  }

  const sourceUnit: unknown = line.sourceUnit;
  if (sourceUnit !== null && typeof sourceUnit !== "string") {
    throw new InvalidIngredientSourceEvidenceError(
      recipe,
      line,
      "sourceUnit",
      sourceUnit,
    );
  }

  const sourceValue: unknown = line.sourceValue;
  if (
    sourceValue !== null &&
    (typeof sourceValue !== "number" || !Number.isFinite(sourceValue))
  ) {
    throw new InvalidIngredientSourceValueError(recipe, line, sourceValue);
  }
}

function hasQuantityEvidence(line: IngredientLine): boolean {
  if (hasMeaningfulText(line.sourceText)) return true;
  return (
    typeof line.sourceValue === "number" &&
    hasMeaningfulText(line.sourceUnit)
  );
}

interface BlockerFact {
  key: string;
  message: string;
}

function collectRecipeBlockers(recipe: RecipeVersion): string[] {
  const facts: BlockerFact[] = [];
  const seen = new Set<string>();
  const add = (fact: BlockerFact): void => {
    if (!hasMeaningfulText(fact.message) || seen.has(fact.key)) return;
    seen.add(fact.key);
    facts.push(fact);
  };

  for (const blocker of recipe.blockers) {
    add({ key: `explicit:${JSON.stringify(blocker)}`, message: blocker });
  }

  if (!hasMeaningfulText(recipe.methodText)) {
    add({ key: "method", message: `Add a method for ${recipe.name}` });
  }

  if (recipe.reviewState === "conflict") {
    add({
      key: "review:conflict",
      message: `Resolve conflicting sources for ${recipe.name}`,
    });
  } else if (recipe.reviewState === "blocked") {
    add({
      key: "review:blocked",
      message: `Resolve blocked review for ${recipe.name}`,
    });
  }

  for (const line of recipe.lines) {
    validateSourceEvidence(recipe, line);
    if (
      line.itemKind === "prepared_recipe" &&
      line.componentRecipeId === null
    ) {
      add({
        key: `dependency:${JSON.stringify(line.lineKey)}`,
        message: `Link the prepared recipe for ${line.itemName} (line ${line.lineKey})`,
      });
    }
    if (!hasQuantityEvidence(line)) {
      add({
        key: `quantity:${JSON.stringify(line.lineKey)}`,
        message: `Confirm the source quantity for ${line.itemName} (line ${line.lineKey})`,
      });
    }
  }

  const messages: string[] = [];
  const renderedMessages = new Set<string>();
  for (const { message } of facts) {
    if (renderedMessages.has(message)) continue;
    renderedMessages.add(message);
    messages.push(message);
  }
  return messages;
}

export function evaluateReadiness(
  recipe: RecipeVersion,
  media: MediaCoverage,
): RecipeReadiness {
  validateMediaCoverage(media);
  validateRecipe(recipe);
  const missingMethod = !hasMeaningfulText(recipe.methodText);
  const blockers = collectRecipeBlockers(recipe);
  const draft = blockers.length > 0;

  return {
    printableAsApproved: !draft,
    draft,
    missingMethod,
    blockers: [...blockers],
    mediaGap: media.linked === 0,
    mediaReviewNeeded: media.reviewNeeded > 0,
  };
}

function queuePriority(row: ReviewQueueRow): number {
  if (row.status === "blocked") return 0;
  if (row.status === "conflict") return 1;
  if (row.blockers.length > 0) return 2;
  if (row.status === "candidate") return 3;
  return 4;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function identitySortKey(recipeId: RecipeIdentity): string {
  return typeof recipeId === "number"
    ? `number:${JSON.stringify(recipeId)}`
    : `string:${JSON.stringify(recipeId)}`;
}

function validateUniqueQueueRows(rows: ReviewQueueRow[]): void {
  const byIdentity = new Map<string, ReviewQueueRow>();
  const byVersionId = new Map<string, ReviewQueueRow>();

  for (const row of rows) {
    const identityKey = identitySortKey(row.recipeId);
    const matchingIdentity = byIdentity.get(identityKey);
    if (matchingIdentity) {
      throw new DuplicateReviewQueueRecipeIdentityError(
        matchingIdentity,
        row,
      );
    }
    byIdentity.set(identityKey, row);

    const matchingVersion = byVersionId.get(row.recipeVersionId);
    if (matchingVersion) {
      throw new DuplicateReviewQueueRecipeVersionIdError(
        matchingVersion,
        row,
      );
    }
    byVersionId.set(row.recipeVersionId, row);
  }
}

export function buildReviewQueue(recipes: RecipeVersion[]): ReviewQueueRow[] {
  const rows = recipes
    .map((recipe) => {
      const readiness = evaluateReadiness(recipe, {
        linked: 1,
        reviewNeeded: 0,
      });
      return {
        recipeId: recipe.recipeId,
        recipeVersionId: recipe.recipeVersionId,
        recipeName: recipe.name,
        status: recipe.reviewState,
        blockers: [...readiness.blockers],
      };
    })
    .filter((row) => row.status !== "confirmed" || row.blockers.length > 0);

  validateUniqueQueueRows(rows);

  return rows.sort((left, right) => {
    const priorityDifference = queuePriority(left) - queuePriority(right);
    if (priorityDifference !== 0) return priorityDifference;

    const nameDifference = compareText(left.recipeName, right.recipeName);
    if (nameDifference !== 0) return nameDifference;

    const versionDifference = compareText(
      left.recipeVersionId,
      right.recipeVersionId,
    );
    if (versionDifference !== 0) return versionDifference;

    return compareText(
      identitySortKey(left.recipeId),
      identitySortKey(right.recipeId),
    );
  });
}
