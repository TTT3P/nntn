import type {
  CookbookSnapshot,
  FocalPoint,
  IngredientLine,
  MediaAsset,
  MediaCrop,
  RecipeIdentity,
  RecipeVersion,
  StepMediaLink,
  WorkDocument,
  WorkStage,
  WorkStep,
} from "../domain/cookbook/types";

export interface PrototypeExport {
  schemaVersion: "cookbook-prototype-v1";
  exportedAt: string;
  recipes: RecipeVersion[];
  media: Array<MediaAsset & { exportWarning?: "binary-not-included" }>;
  stepMedia: StepMediaLink[];
}

export class InvalidPrototypeExportTimestampError extends Error {
  readonly value: unknown;

  constructor(value: unknown) {
    super("Prototype export timestamp must be a canonical UTC ISO timestamp with milliseconds");
    this.name = "InvalidPrototypeExportTimestampError";
    this.value = value;
  }
}

export class InvalidPrototypeExportFieldError extends Error {
  readonly path: string;
  readonly value: string;

  constructor(path: string, value: unknown, cause?: unknown) {
    super(`Invalid prototype export field: ${path}`, cause === undefined ? undefined : { cause });
    this.name = "InvalidPrototypeExportFieldError";
    this.path = path;
    this.value = value === null ? "<null>" : `<${typeof value}>`;
  }
}

export class DuplicatePrototypeExportIdentityError extends Error {
  readonly path: string;
  readonly identity: string;

  constructor(path: string, identity: string) {
    super(`Duplicate prototype export identity at ${path}: ${identity}`);
    this.name = "DuplicatePrototypeExportIdentityError";
    this.path = path;
    this.identity = identity;
  }
}

export class DanglingPrototypeExportLinkError extends Error {
  readonly path: string;
  readonly target: string;

  constructor(path: string, target: string) {
    super(`Dangling prototype export link at ${path}: ${target}`);
    this.name = "DanglingPrototypeExportLinkError";
    this.path = path;
    this.target = target;
  }
}

const INVISIBLE_OR_WHITESPACE = /[\s\p{Cf}]/gu;
const WORK_STAGES: WorkStage[] = ["prep", "cook", "service"];

function isArray(value: unknown, path: string): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch (error) {
    throw new InvalidPrototypeExportFieldError(path, undefined, error);
  }
}

function isRecord(value: unknown, path: string): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  return !isArray(value, path);
}

function invalid(path: string, value: unknown): never {
  throw new InvalidPrototypeExportFieldError(path, value);
}

function readField(record: Record<string, unknown>, field: string, path: string): unknown {
  try {
    return record[field];
  } catch (error) {
    throw new InvalidPrototypeExportFieldError(path, undefined, error);
  }
}

function readIndex(values: unknown[], index: number, path: string): unknown {
  try {
    return values[index];
  } catch (error) {
    throw new InvalidPrototypeExportFieldError(path, undefined, error);
  }
}

function meaningfulString(value: unknown, path: string): string {
  if (
    typeof value !== "string" ||
    value.replace(INVISIBLE_OR_WHITESPACE, "").length === 0
  ) {
    return invalid(path, value);
  }
  return value;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string") return invalid(path, value);
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  if (value !== null && typeof value !== "string") return invalid(path, value);
  return value;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") return invalid(path, value);
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return invalid(path, value);
  return value;
}

function safeInteger(value: unknown, path: string, minimum?: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    (minimum !== undefined && value < minimum)
  ) {
    return invalid(path, value);
  }
  return value;
}

function nullableFiniteNumber(value: unknown, path: string): number | null {
  if (value === null) return null;
  return finiteNumber(value, path);
}

function recipeIdentity(value: unknown, path: string): RecipeIdentity {
  if (typeof value === "number") return safeInteger(value, path);
  return meaningfulString(value, path);
}

function nullableRecipeIdentity(value: unknown, path: string): RecipeIdentity | null {
  if (value === null) return null;
  return recipeIdentity(value, path);
}

function enumValue<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return invalid(path, value);
  }
  return value as T;
}

function captureArray<T>(
  value: unknown,
  path: string,
  capture: (entry: unknown, entryPath: string) => T,
): T[] {
  if (!isArray(value, path)) return invalid(path, value);
  let length: number;
  try {
    length = value.length;
  } catch (error) {
    throw new InvalidPrototypeExportFieldError(`${path}.length`, undefined, error);
  }
  if (!Number.isSafeInteger(length) || length < 0) {
    return invalid(`${path}.length`, length);
  }
  const captured: T[] = [];
  for (let index = 0; index < length; index += 1) {
    const entryPath = `${path}[${index}]`;
    captured.push(capture(readIndex(value, index, entryPath), entryPath));
  }
  return captured;
}

function captureStringArray(value: unknown, path: string): string[] {
  return captureArray(value, path, stringValue);
}

function identityKey(value: RecipeIdentity): string {
  return typeof value === "number"
    ? `number:${String(value)}`
    : `string:${JSON.stringify(value)}`;
}

function assertUnique(values: string[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new DuplicatePrototypeExportIdentityError(path, value);
    seen.add(value);
  }
}

function captureIngredientLine(value: unknown, path: string): IngredientLine {
  if (!isRecord(value, path)) return invalid(path, value);
  const lineKey = meaningfulString(readField(value, "lineKey", `${path}.lineKey`), `${path}.lineKey`);
  const itemName = stringValue(readField(value, "itemName", `${path}.itemName`), `${path}.itemName`);
  const itemKind = enumValue(
    readField(value, "itemKind", `${path}.itemKind`),
    `${path}.itemKind`,
    ["direct_ingredient", "prepared_recipe"] as const,
  );
  const ingredientId = nullableFiniteNumber(
    readField(value, "ingredientId", `${path}.ingredientId`),
    `${path}.ingredientId`,
  );
  const componentRecipeId = nullableRecipeIdentity(
    readField(value, "componentRecipeId", `${path}.componentRecipeId`),
    `${path}.componentRecipeId`,
  );
  const sourceText = nullableString(readField(value, "sourceText", `${path}.sourceText`), `${path}.sourceText`);
  const sourceValue = nullableFiniteNumber(readField(value, "sourceValue", `${path}.sourceValue`), `${path}.sourceValue`);
  const sourceUnit = nullableString(readField(value, "sourceUnit", `${path}.sourceUnit`), `${path}.sourceUnit`);
  const decisionStatus = stringValue(readField(value, "decisionStatus", `${path}.decisionStatus`), `${path}.decisionStatus`);
  const selectedSource = nullableString(readField(value, "selectedSource", `${path}.selectedSource`), `${path}.selectedSource`);
  return {
    lineKey,
    itemName,
    itemKind,
    ingredientId,
    componentRecipeId,
    sourceText,
    sourceValue,
    sourceUnit,
    decisionStatus,
    selectedSource,
  };
}

function captureWorkStep(value: unknown, path: string): WorkStep {
  if (!isRecord(value, path)) return invalid(path, value);
  return {
    stepId: meaningfulString(readField(value, "stepId", `${path}.stepId`), `${path}.stepId`),
    stage: enumValue(readField(value, "stage", `${path}.stage`), `${path}.stage`, WORK_STAGES),
    instruction: stringValue(readField(value, "instruction", `${path}.instruction`), `${path}.instruction`),
    order: safeInteger(readField(value, "order", `${path}.order`), `${path}.order`, 1),
  };
}

function captureWorkDocument(value: unknown, path: string, keyStage: WorkStage): WorkDocument {
  if (!isRecord(value, path)) return invalid(path, value);
  const stage = enumValue(readField(value, "stage", `${path}.stage`), `${path}.stage`, WORK_STAGES);
  if (stage !== keyStage) return invalid(`${path}.stage`, stage);
  const document = {
    stage,
    scalable: booleanValue(readField(value, "scalable", `${path}.scalable`), `${path}.scalable`),
    ingredientLineKeys: captureStringArray(
      readField(value, "ingredientLineKeys", `${path}.ingredientLineKeys`),
      `${path}.ingredientLineKeys`,
    ),
    steps: captureArray(
      readField(value, "steps", `${path}.steps`),
      `${path}.steps`,
      captureWorkStep,
    ),
  };
  for (let index = 0; index < document.steps.length; index += 1) {
    if (document.steps[index]!.stage !== stage) {
      return invalid(`${path}.steps[${index}].stage`, document.steps[index]!.stage);
    }
  }
  assertUnique(document.ingredientLineKeys, `${path}.ingredientLineKeys`);
  assertUnique(document.steps.map((step) => step.stepId), `${path}.steps.stepId`);
  assertUnique(document.steps.map((step) => String(step.order)), `${path}.steps.order`);
  document.steps.sort(
    (left, right) => left.order - right.order || compareText(left.stepId, right.stepId),
  );
  return document;
}

function captureWorkDocuments(value: unknown, path: string): RecipeVersion["workDocuments"] {
  if (!isRecord(value, path)) return invalid(path, value);
  const result: RecipeVersion["workDocuments"] = {};
  for (const stage of WORK_STAGES) {
    const stagePath = `${path}.${stage}`;
    const document = readField(value, stage, stagePath);
    if (document !== undefined) result[stage] = captureWorkDocument(document, stagePath, stage);
  }
  return result;
}

function captureRecipe(value: unknown, path: string): RecipeVersion {
  if (!isRecord(value, path)) return invalid(path, value);
  const recipeId = recipeIdentity(readField(value, "recipeId", `${path}.recipeId`), `${path}.recipeId`);
  const recipeVersionId = meaningfulString(
    readField(value, "recipeVersionId", `${path}.recipeVersionId`),
    `${path}.recipeVersionId`,
  );
  const name = stringValue(readField(value, "name", `${path}.name`), `${path}.name`);
  const kind = enumValue(
    readField(value, "kind", `${path}.kind`),
    `${path}.kind`,
    ["sellable_menu", "prepared_recipe"] as const,
  );
  const parentRecipeIds = captureArray(
    readField(value, "parentRecipeIds", `${path}.parentRecipeIds`),
    `${path}.parentRecipeIds`,
    recipeIdentity,
  );
  const reviewState = enumValue(
    readField(value, "reviewState", `${path}.reviewState`),
    `${path}.reviewState`,
    ["confirmed", "candidate", "conflict", "blocked"] as const,
  );
  const sourceLocators = captureStringArray(readField(value, "sourceLocators", `${path}.sourceLocators`), `${path}.sourceLocators`);
  const lines = captureArray(readField(value, "lines", `${path}.lines`), `${path}.lines`, captureIngredientLine);
  const methodText = nullableString(readField(value, "methodText", `${path}.methodText`), `${path}.methodText`);
  const blockers = captureStringArray(readField(value, "blockers", `${path}.blockers`), `${path}.blockers`);
  const operationalNotes = captureStringArray(
    readField(value, "operationalNotes", `${path}.operationalNotes`),
    `${path}.operationalNotes`,
  );
  const workDocuments = captureWorkDocuments(
    readField(value, "workDocuments", `${path}.workDocuments`),
    `${path}.workDocuments`,
  );
  assertUnique(parentRecipeIds.map(identityKey), `${path}.parentRecipeIds`);
  assertUnique(lines.map((line) => line.lineKey), `${path}.lines.lineKey`);
  const lineKeys = new Set(lines.map((line) => line.lineKey));
  for (const stage of WORK_STAGES) {
    const document = workDocuments[stage];
    if (document === undefined) continue;
    for (let index = 0; index < document.ingredientLineKeys.length; index += 1) {
      const lineKey = document.ingredientLineKeys[index]!;
      if (!lineKeys.has(lineKey)) {
        throw new DanglingPrototypeExportLinkError(
          `${path}.workDocuments.${stage}.ingredientLineKeys[${index}]`,
          lineKey,
        );
      }
    }
  }
  return {
    recipeId,
    recipeVersionId,
    name,
    kind,
    parentRecipeIds,
    reviewState,
    sourceLocators,
    lines,
    methodText,
    blockers,
    operationalNotes,
    workDocuments,
  };
}

function capturePoint(value: unknown, path: string): FocalPoint | null {
  if (value === null) return null;
  if (!isRecord(value, path)) return invalid(path, value);
  return {
    x: finiteNumber(readField(value, "x", `${path}.x`), `${path}.x`),
    y: finiteNumber(readField(value, "y", `${path}.y`), `${path}.y`),
  };
}

function captureCrop(value: unknown, path: string): MediaCrop | null {
  if (value === null) return null;
  if (!isRecord(value, path)) return invalid(path, value);
  const width = finiteNumber(readField(value, "width", `${path}.width`), `${path}.width`);
  const height = finiteNumber(readField(value, "height", `${path}.height`), `${path}.height`);
  if (width <= 0) return invalid(`${path}.width`, width);
  if (height <= 0) return invalid(`${path}.height`, height);
  return {
    x: finiteNumber(readField(value, "x", `${path}.x`), `${path}.x`),
    y: finiteNumber(readField(value, "y", `${path}.y`), `${path}.y`),
    width,
    height,
  };
}

function captureMediaAsset(
  value: unknown,
  path: string,
): MediaAsset & { exportWarning?: "binary-not-included" } {
  if (!isRecord(value, path)) return invalid(path, value);
  const mediaId = meaningfulString(readField(value, "mediaId", `${path}.mediaId`), `${path}.mediaId`);
  const url = meaningfulString(readField(value, "url", `${path}.url`), `${path}.url`);
  const checkedUrl = url.trimStart().toLowerCase();
  if (checkedUrl.startsWith("data:") || checkedUrl.startsWith("file:")) {
    return invalid(`${path}.url`, url);
  }
  const caption = stringValue(readField(value, "caption", `${path}.caption`), `${path}.caption`);
  const altText = stringValue(readField(value, "altText", `${path}.altText`), `${path}.altText`);
  const source = nullableString(readField(value, "source", `${path}.source`), `${path}.source`);
  const capturedAt = nullableString(readField(value, "capturedAt", `${path}.capturedAt`), `${path}.capturedAt`);
  const author = nullableString(readField(value, "author", `${path}.author`), `${path}.author`);
  const reviewState = enumValue(
    readField(value, "reviewState", `${path}.reviewState`),
    `${path}.reviewState`,
    ["sample", "unreviewed", "confirmed"] as const,
  );
  const localSessionOnly = booleanValue(
    readField(value, "localSessionOnly", `${path}.localSessionOnly`),
    `${path}.localSessionOnly`,
  );
  const crop = captureCrop(readField(value, "crop", `${path}.crop`), `${path}.crop`);
  const focalPoint = capturePoint(readField(value, "focalPoint", `${path}.focalPoint`), `${path}.focalPoint`);
  const measurementAnnotation = nullableString(
    readField(value, "measurementAnnotation", `${path}.measurementAnnotation`),
    `${path}.measurementAnnotation`,
  );
  const asset = {
    mediaId,
    url,
    caption,
    altText,
    source,
    capturedAt,
    author,
    reviewState,
    localSessionOnly,
    crop,
    focalPoint,
    measurementAnnotation,
  };
  return localSessionOnly
    ? { ...asset, exportWarning: "binary-not-included" }
    : asset;
}

function captureStepMediaLink(value: unknown, path: string): StepMediaLink {
  if (!isRecord(value, path)) return invalid(path, value);
  const vesselValue = readField(value, "vessel", `${path}.vessel`);
  return {
    stepId: meaningfulString(readField(value, "stepId", `${path}.stepId`), `${path}.stepId`),
    mediaId: meaningfulString(readField(value, "mediaId", `${path}.mediaId`), `${path}.mediaId`),
    order: safeInteger(readField(value, "order", `${path}.order`), `${path}.order`, 1),
    role: enumValue(
      readField(value, "role", `${path}.role`),
      `${path}.role`,
      ["before", "during", "checkpoint", "final"] as const,
    ),
    vessel: vesselValue === null
      ? null
      : enumValue(vesselValue, `${path}.vessel`, ["plate", "delivery_box", "cup_1oz"] as const),
    reviewNeeded: booleanValue(
      readField(value, "reviewNeeded", `${path}.reviewNeeded`),
      `${path}.reviewNeeded`,
    ),
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateTimestamp(value: unknown): string {
  if (typeof value !== "string") throw new InvalidPrototypeExportTimestampError(value);
  try {
    if (new Date(value).toISOString() !== value) {
      throw new InvalidPrototypeExportTimestampError(value);
    }
  } catch (error) {
    if (error instanceof InvalidPrototypeExportTimestampError) throw error;
    throw new InvalidPrototypeExportTimestampError(value);
  }
  return value;
}

export function exportPrototypeSnapshot(
  snapshot: CookbookSnapshot,
  exportedAt: string = new Date().toISOString(),
): PrototypeExport {
  const capturedAt = validateTimestamp(exportedAt);
  if (!isRecord(snapshot, "snapshot")) return invalid("snapshot", snapshot);
  const recipes = captureArray(
    readField(snapshot, "recipes", "snapshot.recipes"),
    "snapshot.recipes",
    captureRecipe,
  );
  const media = captureArray(
    readField(snapshot, "media", "snapshot.media"),
    "snapshot.media",
    captureMediaAsset,
  );
  const stepMedia = captureArray(
    readField(snapshot, "stepMedia", "snapshot.stepMedia"),
    "snapshot.stepMedia",
    captureStepMediaLink,
  );

  assertUnique(recipes.map((recipe) => identityKey(recipe.recipeId)), "recipes.recipeId");
  assertUnique(recipes.map((recipe) => recipe.recipeVersionId), "recipes.recipeVersionId");
  assertUnique(media.map((asset) => asset.mediaId), "media.mediaId");

  const knownRecipeIds = new Set(recipes.map((recipe) => identityKey(recipe.recipeId)));
  for (let recipeIndex = 0; recipeIndex < recipes.length; recipeIndex += 1) {
    const recipe = recipes[recipeIndex]!;
    const recipePath = `snapshot.recipes[${recipeIndex}]`;
    for (let parentIndex = 0; parentIndex < recipe.parentRecipeIds.length; parentIndex += 1) {
      const parentRecipeId = recipe.parentRecipeIds[parentIndex]!;
      if (!knownRecipeIds.has(identityKey(parentRecipeId))) {
        throw new DanglingPrototypeExportLinkError(
          `${recipePath}.parentRecipeIds[${parentIndex}]`,
          identityKey(parentRecipeId),
        );
      }
    }
    for (let lineIndex = 0; lineIndex < recipe.lines.length; lineIndex += 1) {
      const line = recipe.lines[lineIndex]!;
      const componentPath = `${recipePath}.lines[${lineIndex}].componentRecipeId`;
      if (line.itemKind === "prepared_recipe") {
        if (line.ingredientId !== null) {
          return invalid(
            `${recipePath}.lines[${lineIndex}].ingredientId`,
            line.ingredientId,
          );
        }
        if (line.componentRecipeId === null) {
          return invalid(componentPath, line.componentRecipeId);
        }
        if (!knownRecipeIds.has(identityKey(line.componentRecipeId))) {
          throw new DanglingPrototypeExportLinkError(
            componentPath,
            identityKey(line.componentRecipeId),
          );
        }
      } else if (line.componentRecipeId !== null) {
        return invalid(componentPath, line.componentRecipeId);
      }
    }
  }

  const stepIds = recipes.flatMap((recipe) =>
    WORK_STAGES.flatMap((stage) => recipe.workDocuments[stage]?.steps.map((step) => step.stepId) ?? []),
  );
  assertUnique(stepIds, "recipes.workDocuments.steps.stepId");
  const knownStepIds = new Set(stepIds);
  const knownMediaIds = new Set(media.map((asset) => asset.mediaId));
  const linkPairs = new Set<string>();
  const linkOrders = new Set<string>();
  for (let index = 0; index < stepMedia.length; index += 1) {
    const link = stepMedia[index]!;
    if (!knownStepIds.has(link.stepId)) {
      throw new DanglingPrototypeExportLinkError(`stepMedia[${index}].stepId`, link.stepId);
    }
    if (!knownMediaIds.has(link.mediaId)) {
      throw new DanglingPrototypeExportLinkError(`stepMedia[${index}].mediaId`, link.mediaId);
    }
    const pair = JSON.stringify([link.stepId, link.mediaId]);
    if (linkPairs.has(pair)) {
      throw new DuplicatePrototypeExportIdentityError("stepMedia.stepId/mediaId", pair);
    }
    linkPairs.add(pair);
    const order = JSON.stringify([link.stepId, link.order]);
    if (linkOrders.has(order)) {
      throw new DuplicatePrototypeExportIdentityError("stepMedia.stepId/order", order);
    }
    linkOrders.add(order);
  }

  recipes.sort((left, right) => compareText(identityKey(left.recipeId), identityKey(right.recipeId)));
  media.sort((left, right) => compareText(left.mediaId, right.mediaId));
  stepMedia.sort(
    (left, right) =>
      compareText(left.stepId, right.stepId) ||
      left.order - right.order ||
      compareText(left.mediaId, right.mediaId),
  );

  return {
    schemaVersion: "cookbook-prototype-v1",
    exportedAt: capturedAt,
    recipes,
    media,
    stepMedia,
  };
}
