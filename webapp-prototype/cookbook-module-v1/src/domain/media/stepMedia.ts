import type {
  CookbookSnapshot,
  MediaAsset,
  MediaRole,
  NewStepMediaLink,
  RecipeVersion,
  StepMediaLink,
  Vessel,
} from "../cookbook/types";
import type { MediaCoverage } from "../review/readiness";

export class InvalidStepMediaFieldError extends Error {
  readonly field: string;
  readonly value: unknown;
  constructor(field: string, value: unknown) {
    super(`Invalid step media ${field}: ${String(value)}`);
    this.name = "InvalidStepMediaFieldError";
    this.field = field;
    this.value = value;
  }
}

export class InvalidMediaAssetFieldError extends Error {
  readonly mediaId: string;
  readonly field: string;
  readonly value: unknown;
  constructor(mediaId: string, field: string, value: unknown) {
    super(`Invalid media asset ${mediaId} field ${field}: ${String(value)}`);
    this.name = "InvalidMediaAssetFieldError";
    this.mediaId = mediaId;
    this.field = field;
    this.value = value;
  }
}

export class DuplicateMediaAssetIdError extends Error {
  readonly mediaId: string;
  constructor(mediaId: string) {
    super(`Duplicate media asset ID: ${mediaId}`);
    this.name = "DuplicateMediaAssetIdError";
    this.mediaId = mediaId;
  }
}

export class DuplicateStepIdError extends Error {
  readonly stepId: string;
  constructor(stepId: string) {
    super(`Duplicate work step ID: ${stepId}`);
    this.name = "DuplicateStepIdError";
    this.stepId = stepId;
  }
}

export class DuplicateStepMediaLinkError extends Error {
  readonly stepId: string;
  readonly mediaId: string;
  constructor(stepId: string, mediaId: string) {
    super(`Duplicate step/media link: ${stepId} / ${mediaId}`);
    this.name = "DuplicateStepMediaLinkError";
    this.stepId = stepId;
    this.mediaId = mediaId;
  }
}

export class DuplicateStepMediaOrderError extends Error {
  readonly stepId: string;
  readonly order: number;
  constructor(stepId: string, order: number) {
    super(`Duplicate media order for step ${stepId}: ${order}`);
    this.name = "DuplicateStepMediaOrderError";
    this.stepId = stepId;
    this.order = order;
  }
}

export class UnknownWorkStepError extends Error {
  readonly stepId: string;
  constructor(stepId: string) {
    super(`Unknown work step: ${stepId}`);
    this.name = "UnknownWorkStepError";
    this.stepId = stepId;
  }
}

export class UnknownMediaAssetError extends Error {
  readonly mediaId: string;
  constructor(mediaId: string) {
    super(`Unknown media asset: ${mediaId}`);
    this.name = "UnknownMediaAssetError";
    this.mediaId = mediaId;
  }
}

export class InvalidMediaPermutationError extends Error {
  readonly stepId: string;
  constructor(stepId: string) {
    super(`Media IDs must be an exact duplicate-free permutation for step: ${stepId}`);
    this.name = "InvalidMediaPermutationError";
    this.stepId = stepId;
  }
}

export class StepMediaOrderOverflowError extends Error {
  readonly stepId: string;
  readonly currentOrder: number;
  constructor(stepId: string, currentOrder: number) {
    super(`Cannot append media after unsafe order for step ${stepId}: ${currentOrder}`);
    this.name = "StepMediaOrderOverflowError";
    this.stepId = stepId;
    this.currentOrder = currentOrder;
  }
}

const INVISIBLE_OR_WHITESPACE = /[\s\p{Cf}]/gu;

function validateId(value: unknown, field: "mediaId" | "stepId"): asserts value is string {
  if (typeof value !== "string" || value.replace(INVISIBLE_OR_WHITESPACE, "").length === 0) {
    throw new InvalidStepMediaFieldError(field, value);
  }
}

function validateRole(value: unknown): asserts value is MediaRole {
  if (
    value !== "before" &&
    value !== "during" &&
    value !== "checkpoint" &&
    value !== "final"
  ) {
    throw new InvalidStepMediaFieldError("role", value);
  }
}

function validateVessel(value: unknown): asserts value is Vessel | null {
  if (
    value !== null &&
    value !== "plate" &&
    value !== "delivery_box" &&
    value !== "cup_1oz"
  ) {
    throw new InvalidStepMediaFieldError("vessel", value);
  }
}

function validateLink(link: StepMediaLink): void {
  validateId(link.stepId, "stepId");
  validateId(link.mediaId, "mediaId");
  if (!Number.isSafeInteger(link.order) || link.order < 1) {
    throw new InvalidStepMediaFieldError("order", link.order);
  }
  validateRole(link.role);
  validateVessel(link.vessel);
  if (typeof link.reviewNeeded !== "boolean") {
    throw new InvalidStepMediaFieldError("reviewNeeded", link.reviewNeeded);
  }
}

function allStepIds(snapshot: CookbookSnapshot): string[] {
  return snapshot.recipes.flatMap((recipe) =>
    Object.values(recipe.workDocuments).flatMap((document) =>
      document ? document.steps.map((step) => step.stepId) : [],
    ),
  );
}

function uniqueIds(ids: string[], duplicateError: (id: string) => Error): Set<string> {
  const result = new Set<string>();
  for (const id of ids) {
    if (result.has(id)) throw duplicateError(id);
    result.add(id);
  }
  return result;
}

function validateKnownStep(snapshot: CookbookSnapshot, stepId: unknown): string {
  validateId(stepId, "stepId");
  const stepIds = allStepIds(snapshot);
  for (const id of stepIds) validateId(id, "stepId");
  const known = uniqueIds(stepIds, (id) => new DuplicateStepIdError(id));
  if (!known.has(stepId)) throw new UnknownWorkStepError(stepId);
  return stepId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateSnapshotContainers(snapshot: unknown): asserts snapshot is CookbookSnapshot {
  if (!isRecord(snapshot)) throw new InvalidStepMediaFieldError("snapshot", snapshot);
  for (const field of ["recipes", "media", "stepMedia"]) {
    if (!Array.isArray(snapshot[field])) {
      throw new InvalidStepMediaFieldError(`snapshot.${field}`, snapshot[field]);
    }
  }
}

function validateRecipeInput(recipe: unknown): asserts recipe is RecipeVersion {
  if (!isRecord(recipe)) throw new InvalidStepMediaFieldError("recipe", recipe);
  if (!isRecord(recipe.workDocuments)) {
    throw new InvalidStepMediaFieldError("recipe.workDocuments", recipe.workDocuments);
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function invalidAssetField(mediaId: string, field: string, value: unknown): never {
  throw new InvalidMediaAssetFieldError(mediaId, field, value);
}

function validatePoint(
  mediaId: string,
  field: "crop" | "focalPoint",
  value: unknown,
): void {
  if (value === null) return;
  if (!isRecord(value)) invalidAssetField(mediaId, field, value);
  const required = field === "crop" ? ["x", "y", "width", "height"] : ["x", "y"];
  for (const coordinate of required) {
    const coordinateValue = value[coordinate];
    if (typeof coordinateValue !== "number" || !Number.isFinite(coordinateValue)) {
      invalidAssetField(mediaId, `${field}.${coordinate}`, coordinateValue);
    }
    if ((coordinate === "width" || coordinate === "height") && coordinateValue <= 0) {
      invalidAssetField(mediaId, `${field}.${coordinate}`, coordinateValue);
    }
  }
}

function validateMediaAsset(value: unknown, mediaId: string): asserts value is MediaAsset {
  if (!isRecord(value)) invalidAssetField(mediaId, "asset", value);
  if (value.mediaId !== mediaId) invalidAssetField(mediaId, "mediaId", value.mediaId);
  if (typeof value.url !== "string" || value.url.replace(INVISIBLE_OR_WHITESPACE, "").length === 0) {
    invalidAssetField(mediaId, "url", value.url);
  }
  if (typeof value.caption !== "string") invalidAssetField(mediaId, "caption", value.caption);
  if (typeof value.altText !== "string" || value.altText.replace(INVISIBLE_OR_WHITESPACE, "").length === 0) {
    invalidAssetField(mediaId, "altText", value.altText);
  }
  const nullableStringFields: Array<
    "source" | "capturedAt" | "author" | "measurementAnnotation"
  > = ["source", "capturedAt", "author", "measurementAnnotation"];
  for (const field of nullableStringFields) {
    if (!isNullableString(value[field])) invalidAssetField(mediaId, field, value[field]);
  }
  if (
    value.reviewState !== "sample" &&
    value.reviewState !== "unreviewed" &&
    value.reviewState !== "confirmed"
  ) {
    invalidAssetField(mediaId, "reviewState", value.reviewState);
  }
  if (typeof value.localSessionOnly !== "boolean") {
    invalidAssetField(mediaId, "localSessionOnly", value.localSessionOnly);
  }
  validatePoint(mediaId, "crop", value.crop);
  validatePoint(mediaId, "focalPoint", value.focalPoint);
}

function resolveMediaAsset(snapshot: CookbookSnapshot, mediaId: string): MediaAsset | undefined {
  const matches: unknown[] = [];
  for (const asset of snapshot.media) {
    if (isRecord(asset) && asset.mediaId === mediaId) matches.push(asset);
  }
  if (matches.length > 1) throw new DuplicateMediaAssetIdError(mediaId);
  const match = matches[0];
  if (match === undefined) return undefined;
  validateMediaAsset(match, mediaId);
  return match;
}

function requireMediaAsset(snapshot: CookbookSnapshot, mediaId: string): MediaAsset {
  const asset = resolveMediaAsset(snapshot, mediaId);
  if (asset === undefined) throw new UnknownMediaAssetError(mediaId);
  return asset;
}

function validateTargetLinks(snapshot: CookbookSnapshot, stepId: string): StepMediaLink[] {
  const links = snapshot.stepMedia.filter(
    (link) => isRecord(link) && link.stepId === stepId,
  );
  const pairs = new Set<string>();
  const orders = new Set<number>();
  for (const link of links) {
    validateLink(link);
    if (pairs.has(link.mediaId)) throw new DuplicateStepMediaLinkError(stepId, link.mediaId);
    if (orders.has(link.order)) throw new DuplicateStepMediaOrderError(stepId, link.order);
    pairs.add(link.mediaId);
    orders.add(link.order);
  }
  return links;
}

function cloneSnapshot(snapshot: CookbookSnapshot): CookbookSnapshot {
  return structuredClone(snapshot);
}

export function attachMedia(snapshot: CookbookSnapshot, input: NewStepMediaLink): CookbookSnapshot {
  validateSnapshotContainers(snapshot);
  if (!isRecord(input)) throw new InvalidStepMediaFieldError("input", input);
  const stepId = validateKnownStep(snapshot, input.stepId);
  validateId(input.mediaId, "mediaId");
  validateRole(input.role);
  validateVessel(input.vessel);
  requireMediaAsset(snapshot, input.mediaId);
  const targetLinks = validateTargetLinks(snapshot, stepId);
  for (const link of targetLinks) {
    requireMediaAsset(snapshot, link.mediaId);
  }
  if (targetLinks.some((link) => link.mediaId === input.mediaId)) {
    throw new DuplicateStepMediaLinkError(stepId, input.mediaId);
  }
  const maximumOrder = targetLinks.reduce((maximum, link) => Math.max(maximum, link.order), 0);
  if (maximumOrder === Number.MAX_SAFE_INTEGER) {
    throw new StepMediaOrderOverflowError(stepId, maximumOrder);
  }
  const order = maximumOrder + 1;
  const result = cloneSnapshot(snapshot);
  result.stepMedia.push({ ...structuredClone(input), order, reviewNeeded: false });
  return result;
}

export function reorderStepMedia(snapshot: CookbookSnapshot, stepId: string, mediaIds: string[]): CookbookSnapshot {
  validateSnapshotContainers(snapshot);
  if (!Array.isArray(mediaIds)) throw new InvalidStepMediaFieldError("mediaIds", mediaIds);
  const knownStepId = validateKnownStep(snapshot, stepId);
  const targetLinks = validateTargetLinks(snapshot, knownStepId);
  for (const link of targetLinks) {
    requireMediaAsset(snapshot, link.mediaId);
  }
  for (const mediaId of mediaIds) validateId(mediaId, "mediaId");
  const supplied = new Set(mediaIds);
  const current = new Set(targetLinks.map((link) => link.mediaId));
  if (supplied.size !== mediaIds.length || supplied.size !== current.size || [...supplied].some((id) => !current.has(id))) {
    throw new InvalidMediaPermutationError(knownStepId);
  }
  const byMediaId = new Map(targetLinks.map((link) => [link.mediaId, link]));
  let targetIndex = 0;
  const result = cloneSnapshot(snapshot);
  result.stepMedia = result.stepMedia.map((link) => {
    if (!isRecord(link) || link.stepId !== knownStepId) return link;
    const mediaId = mediaIds[targetIndex];
    targetIndex += 1;
    return { ...structuredClone(byMediaId.get(mediaId)!), order: targetIndex };
  });
  return result;
}

export function markStepMeaningChanged(snapshot: CookbookSnapshot, stepId: string): CookbookSnapshot {
  validateSnapshotContainers(snapshot);
  const knownStepId = validateKnownStep(snapshot, stepId);
  const targetLinks = validateTargetLinks(snapshot, knownStepId);
  for (const link of targetLinks) {
    requireMediaAsset(snapshot, link.mediaId);
  }
  const result = cloneSnapshot(snapshot);
  result.stepMedia = result.stepMedia.map((link) =>
    isRecord(link) && link.stepId === knownStepId
      ? { ...link, reviewNeeded: true }
      : link,
  );
  return result;
}

export interface ResolvedRecipeMediaCoverage {
  coverage: MediaCoverage;
  missingMedia: boolean;
  mediaReviewNeeded: boolean;
}

function resolveRecipeMedia(snapshot: CookbookSnapshot, recipe: RecipeVersion): {
  coverage: MediaCoverage;
  stepIds: Set<string>;
  coveredStepIds: Set<string>;
} {
  validateRecipeInput(recipe);
  const stepIds = allStepIds({ recipes: [recipe], media: [], stepMedia: [] });
  for (const stepId of stepIds) validateId(stepId, "stepId");
  const reachableSteps = uniqueIds(stepIds, (id) => new DuplicateStepIdError(id));
  const relevantLinks = snapshot.stepMedia.filter(
    (link) => isRecord(link) && typeof link.stepId === "string" && reachableSteps.has(link.stepId),
  );
  const resolvedLinks = relevantLinks.flatMap((link) => {
    const asset = resolveMediaAsset(snapshot, link.mediaId);
    return asset === undefined ? [] : [{ link, asset }];
  });
  const pairs = new Set<string>();
  const ordersByStep = new Map<string, Set<number>>();
  let linked = 0;
  let reviewNeeded = 0;
  for (const { link, asset } of resolvedLinks) {
    validateLink(link);
    const pair = `${link.stepId}\0${link.mediaId}`;
    if (pairs.has(pair)) throw new DuplicateStepMediaLinkError(link.stepId, link.mediaId);
    pairs.add(pair);
    const orders = ordersByStep.get(link.stepId) ?? new Set<number>();
    if (orders.has(link.order)) throw new DuplicateStepMediaOrderError(link.stepId, link.order);
    orders.add(link.order);
    ordersByStep.set(link.stepId, orders);
    if (asset.reviewState === "sample") continue;
    linked += 1;
    if (link.reviewNeeded) reviewNeeded += 1;
  }
  return {
    coverage: { linked, reviewNeeded },
    stepIds: reachableSteps,
    coveredStepIds: new Set(
      resolvedLinks
        .filter(({ asset }) => asset.reviewState !== "sample")
        .map(({ link }) => link.stepId),
    ),
  };
}

export function mediaCoverageForRecipe(snapshot: CookbookSnapshot, recipe: RecipeVersion): MediaCoverage {
  validateSnapshotContainers(snapshot);
  return resolveRecipeMedia(snapshot, recipe).coverage;
}

export function deriveRecipeMediaCoverage(
  recipe: RecipeVersion,
  snapshot: CookbookSnapshot,
): ResolvedRecipeMediaCoverage {
  validateSnapshotContainers(snapshot);
  const resolved = resolveRecipeMedia(snapshot, recipe);
  return {
    coverage: resolved.coverage,
    missingMedia:
      resolved.stepIds.size > 0 &&
      [...resolved.stepIds].some((stepId) => !resolved.coveredStepIds.has(stepId)),
    mediaReviewNeeded: resolved.coverage.reviewNeeded > 0,
  };
}
