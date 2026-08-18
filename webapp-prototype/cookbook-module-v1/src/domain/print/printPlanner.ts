import type {
  CookbookSnapshot,
  IngredientLine,
  MediaAsset,
  RecipeIdentity,
  StepMediaLink,
  WorkStep,
  WorkStage,
} from "../cookbook/types";
import type { ProjectedWorkDocument } from "../work/workDocuments";

export type PrintTemplate = "auto" | "station" | "two-up";
export type ComponentLabelResolver = (componentRecipeId: RecipeIdentity) => string | null;

export interface PrintSettings {
  template: PrintTemplate;
  stage: WorkStage | "all";
  multiplier: number;
}

export interface MediaIndex {
  assetsById: Map<string, MediaAsset>;
  linksByStepId: Map<string, StepMediaLink[]>;
}

export interface WorkstationPage {
  kind: "station";
  document: ProjectedWorkDocument;
  blocks: Array<{
    kind: "step";
    stepId: string;
    layout: "text-only" | "with-media";
  }>;
  partNumber: number;
  totalParts: number;
}

export interface TwoUpPage {
  kind: "two-up";
  slots: WorkstationPage[];
}

export type PrintPage = WorkstationPage | TwoUpPage;

function safeDiagnostic(value: unknown): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
      return `${value}`;
    case "undefined":
      return "undefined";
    case "symbol":
      return "<symbol>";
    case "function":
      return "<function>";
    case "object":
      return value === null ? "null" : "<object>";
  }
}

export class InvalidPrintSettingsError extends Error {
  readonly field: keyof PrintSettings;
  readonly value: unknown;

  constructor(field: keyof PrintSettings, value: unknown) {
    super(`Invalid print setting ${field}: ${safeDiagnostic(value)}`);
    this.name = "InvalidPrintSettingsError";
    this.field = field;
    this.value = value;
  }
}

export class InvalidPrintInputError extends Error {
  readonly field: string;
  readonly value: unknown;

  constructor(field: string, value: unknown) {
    super(`Invalid print input ${field}: ${safeDiagnostic(value)}`);
    this.name = "InvalidPrintInputError";
    this.field = field;
    this.value = value;
  }
}

export class InvalidPrintDocumentError extends Error {
  readonly recipeId: unknown;
  readonly field: string;
  readonly value: unknown;

  constructor(recipeId: unknown, field: string, value: unknown) {
    super(
      `Invalid print document field ${field} for recipe ${safeDiagnostic(recipeId)}: ${safeDiagnostic(value)}`,
    );
    this.name = "InvalidPrintDocumentError";
    this.recipeId = recipeId;
    this.field = field;
    this.value = value;
  }
}

type DuplicatePrintDocumentField = "recipe_identity" | "recipe_version_id";

export class DuplicatePrintDocumentError extends Error {
  readonly duplicateField: DuplicatePrintDocumentField;
  readonly recipeId: ProjectedWorkDocument["recipeId"];
  readonly recipeVersionId: string;
  readonly stage: WorkStage;

  constructor(
    duplicateField: DuplicatePrintDocumentField,
    document: ProjectedWorkDocument,
  ) {
    super(
      `Duplicate print document ${duplicateField}: recipe ${safeDiagnostic(document.recipeId)}, version ${document.recipeVersionId}, stage ${document.stage}`,
    );
    this.name = "DuplicatePrintDocumentError";
    this.duplicateField = duplicateField;
    this.recipeId = document.recipeId;
    this.recipeVersionId = document.recipeVersionId;
    this.stage = document.stage;
  }
}

export class InvalidPrintMediaError extends Error {
  readonly mediaId: string;
  readonly field: string;
  readonly value: unknown;

  constructor(mediaId: string, field: string, value: unknown) {
    super(`Invalid print media ${mediaId} field ${field}: ${safeDiagnostic(value)}`);
    this.name = "InvalidPrintMediaError";
    this.mediaId = mediaId;
    this.field = field;
    this.value = value;
  }
}

export class InvalidPrintMediaLinkError extends Error {
  readonly stepId: unknown;
  readonly mediaId: unknown;
  readonly field: string;
  readonly value: unknown;

  constructor(stepId: unknown, mediaId: unknown, field: string, value: unknown) {
    super(
      `Invalid print media link for step ${safeDiagnostic(stepId)} and media ${safeDiagnostic(mediaId)} field ${field}: ${safeDiagnostic(value)}`,
    );
    this.name = "InvalidPrintMediaLinkError";
    this.stepId = stepId;
    this.mediaId = mediaId;
    this.field = field;
    this.value = value;
  }
}

type DuplicatePrintMediaKind = "asset" | "link" | "order";

export class DuplicatePrintMediaError extends Error {
  readonly duplicateKind: DuplicatePrintMediaKind;
  readonly stepId: string | null;
  readonly mediaId: string;
  readonly order: number | null;

  constructor(
    duplicateKind: DuplicatePrintMediaKind,
    mediaId: string,
    stepId: string | null = null,
    order: number | null = null,
  ) {
    super(
      `Duplicate print media ${duplicateKind}: media ${mediaId}, step ${safeDiagnostic(stepId)}, order ${safeDiagnostic(order)}`,
    );
    this.name = "DuplicatePrintMediaError";
    this.duplicateKind = duplicateKind;
    this.stepId = stepId;
    this.mediaId = mediaId;
    this.order = order;
  }
}

export class UnpageableStepError extends Error {
  readonly recipeId: ProjectedWorkDocument["recipeId"];
  readonly stepId: string;
  readonly textDisplayWidth: number;
  readonly mediaCount: number;
  readonly capacity: number;

  constructor(
    document: ProjectedWorkDocument,
    stepId: string,
    textDisplayWidth: number,
    mediaCount: number,
    capacity: number,
  ) {
    super(
      `Step ${stepId} in recipe ${safeDiagnostic(document.recipeId)} exceeds print capacity ${capacity}: ${textDisplayWidth} text display cells, ${mediaCount} media`,
    );
    this.name = "UnpageableStepError";
    this.recipeId = document.recipeId;
    this.stepId = stepId;
    this.textDisplayWidth = textDisplayWidth;
    this.mediaCount = mediaCount;
    this.capacity = capacity;
  }
}

export type UnpageableDocumentSection =
  | "header"
  | "ingredients"
  | "operational_facts"
  | "media_metadata"
  | "combined";

export class UnpageableDocumentError extends Error {
  readonly recipeId: ProjectedWorkDocument["recipeId"];
  readonly section: UnpageableDocumentSection;
  readonly contentUnits: number;
  readonly capacity: number;

  constructor(
    document: ProjectedWorkDocument,
    section: UnpageableDocumentSection,
    contentUnits: number,
    capacity: number,
  ) {
    super(
      `Recipe ${safeDiagnostic(document.recipeId)} ${section} exceeds print capacity ${capacity}: ${contentUnits} content units`,
    );
    this.name = "UnpageableDocumentError";
    this.recipeId = document.recipeId;
    this.section = section;
    this.contentUnits = contentUnits;
    this.capacity = capacity;
  }
}

const INVISIBLE_OR_WHITESPACE = /[\s\p{Cf}]/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function snapshotArray(
  value: unknown,
  snapshotItem: (item: unknown) => unknown = (item) => item,
): unknown {
  return Array.isArray(value) ? Array.from(value, snapshotItem) : value;
}

function snapshotPoint(value: unknown, crop: boolean): unknown {
  if (value === null || !isRecord(value)) return value;
  return crop
    ? { x: value.x, y: value.y, width: value.width, height: value.height }
    : { x: value.x, y: value.y };
}

const READ_MEDIA_ID = Symbol("read-media-id");

function snapshotMediaAsset(
  value: unknown,
  capturedMediaId: unknown | typeof READ_MEDIA_ID = READ_MEDIA_ID,
): unknown {
  if (!isRecord(value)) return value;
  return {
    mediaId: capturedMediaId === READ_MEDIA_ID ? value.mediaId : capturedMediaId,
    url: value.url,
    caption: value.caption,
    altText: value.altText,
    source: value.source,
    capturedAt: value.capturedAt,
    author: value.author,
    reviewState: value.reviewState,
    localSessionOnly: value.localSessionOnly,
    crop: snapshotPoint(value.crop, true),
    focalPoint: snapshotPoint(value.focalPoint, false),
    measurementAnnotation: value.measurementAnnotation,
  };
}

function snapshotMediaLink(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    stepId: value.stepId,
    mediaId: value.mediaId,
    order: value.order,
    role: value.role,
    vessel: value.vessel,
    reviewNeeded: value.reviewNeeded,
  };
}

function snapshotIngredient(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    lineKey: value.lineKey,
    itemName: value.itemName,
    itemKind: value.itemKind,
    ingredientId: value.ingredientId,
    componentRecipeId: value.componentRecipeId,
    sourceText: value.sourceText,
    sourceValue: value.sourceValue,
    sourceUnit: value.sourceUnit,
    servingNote: value.servingNote,
    decisionStatus: value.decisionStatus,
    selectedSource: value.selectedSource,
  };
}

function snapshotStep(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    stepId: value.stepId,
    stage: value.stage,
    instruction: value.instruction,
    order: value.order,
  };
}

const READ_DOCUMENT_STAGE = Symbol("read-document-stage");

function snapshotDocument(
  value: unknown,
  capturedStage: unknown | typeof READ_DOCUMENT_STAGE = READ_DOCUMENT_STAGE,
): unknown {
  if (!isRecord(value)) return value;
  return {
    recipeId: value.recipeId,
    recipeVersionId: value.recipeVersionId,
    recipeName: value.recipeName,
    stage: capturedStage === READ_DOCUMENT_STAGE ? value.stage : capturedStage,
    scalable: value.scalable,
    ingredientLineKeys: snapshotArray(value.ingredientLineKeys),
    ingredients: snapshotArray(value.ingredients, snapshotIngredient),
    steps: snapshotArray(value.steps, snapshotStep),
    multiplier: value.multiplier,
    blockers: snapshotArray(value.blockers),
    operationalNotes: snapshotArray(value.operationalNotes),
    methodDecisionNote: value.methodDecisionNote,
    yieldText: value.yieldText,
  };
}

function snapshotSettings(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    template: value.template,
    stage: value.stage,
    multiplier: value.multiplier,
  };
}

function isNonBlankString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.replace(INVISIBLE_OR_WHITESPACE, "").length > 0
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isApprovedSampleMediaPath(value: string): boolean {
  if ([...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) return false;
  if (/[%?#\\]/u.test(value) || !value.startsWith("/sample-media/")) {
    return false;
  }
  const segments = value.slice("/sample-media/".length).split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(segment),
  );
}

function invalidMedia(mediaId: string, field: string, value: unknown): never {
  throw new InvalidPrintMediaError(mediaId, field, value);
}

function validatePoint(
  mediaId: string,
  field: "crop" | "focalPoint",
  value: unknown,
): void {
  if (value === null) return;
  if (!isRecord(value)) invalidMedia(mediaId, field, value);
  const coordinates = field === "crop"
    ? ["x", "y", "width", "height"]
    : ["x", "y"];
  for (const coordinate of coordinates) {
    const coordinateValue = value[coordinate];
    if (typeof coordinateValue !== "number" || !Number.isFinite(coordinateValue)) {
      invalidMedia(mediaId, `${field}.${coordinate}`, coordinateValue);
    }
    if ((coordinate === "width" || coordinate === "height") && coordinateValue <= 0) {
      invalidMedia(mediaId, `${field}.${coordinate}`, coordinateValue);
    }
  }
}

function validateMediaAsset(value: unknown, mediaId: string): asserts value is MediaAsset {
  if (!isRecord(value)) invalidMedia(mediaId, "asset", value);
  if (value.mediaId !== mediaId) invalidMedia(mediaId, "mediaId", value.mediaId);
  if (!isNonBlankString(value.url)) invalidMedia(mediaId, "url", value.url);
  if (typeof value.caption !== "string") invalidMedia(mediaId, "caption", value.caption);
  if (!isNonBlankString(value.altText)) invalidMedia(mediaId, "altText", value.altText);
  for (const field of ["source", "capturedAt", "author", "measurementAnnotation"] as const) {
    if (!isNullableString(value[field])) invalidMedia(mediaId, field, value[field]);
  }
  if (
    value.reviewState !== "sample" &&
    value.reviewState !== "unreviewed" &&
    value.reviewState !== "confirmed"
  ) {
    invalidMedia(mediaId, "reviewState", value.reviewState);
  }
  if (typeof value.localSessionOnly !== "boolean") {
    invalidMedia(mediaId, "localSessionOnly", value.localSessionOnly);
  }
  validatePoint(mediaId, "crop", value.crop);
  validatePoint(mediaId, "focalPoint", value.focalPoint);
}

function invalidLink(
  value: unknown,
  field: string,
  fieldValue: unknown,
): never {
  const record = isRecord(value) ? value : {};
  throw new InvalidPrintMediaLinkError(
    record.stepId,
    record.mediaId,
    field,
    fieldValue,
  );
}

function validateMediaLink(value: unknown): asserts value is StepMediaLink {
  if (!isRecord(value)) invalidLink(value, "link", value);
  if (!isNonBlankString(value.stepId)) invalidLink(value, "stepId", value.stepId);
  if (!isNonBlankString(value.mediaId)) invalidLink(value, "mediaId", value.mediaId);
  if (!Number.isSafeInteger(value.order) || (value.order as number) < 1) {
    invalidLink(value, "order", value.order);
  }
  if (
    value.role !== "before" &&
    value.role !== "during" &&
    value.role !== "checkpoint" &&
    value.role !== "final"
  ) {
    invalidLink(value, "role", value.role);
  }
  if (
    value.vessel !== null &&
    value.vessel !== "plate" &&
    value.vessel !== "delivery_box" &&
    value.vessel !== "cup_1oz"
  ) {
    invalidLink(value, "vessel", value.vessel);
  }
  if (typeof value.reviewNeeded !== "boolean") {
    invalidLink(value, "reviewNeeded", value.reviewNeeded);
  }
}

function invalidDocument(
  document: unknown,
  field: string,
  value: unknown,
): never {
  let recipeId: unknown;
  try {
    recipeId = isRecord(document) ? document.recipeId : undefined;
  } catch {
    recipeId = undefined;
  }
  throw new InvalidPrintDocumentError(recipeId, field, value);
}

function validateRecipeIdentity(
  document: unknown,
  field: string,
  value: unknown,
): void {
  if (
    (typeof value !== "string" || !isNonBlankString(value)) &&
    (typeof value !== "number" || !Number.isSafeInteger(value))
  ) {
    invalidDocument(document, field, value);
  }
}

function validateStringArray(
  document: unknown,
  field: string,
  value: unknown,
  nonBlank = false,
): void {
  if (!Array.isArray(value)) invalidDocument(document, field, value);
  for (const item of value) {
    if (typeof item !== "string" || (nonBlank && !isNonBlankString(item))) {
      invalidDocument(document, `${field}[]`, item);
    }
  }
}

function validateIngredient(document: unknown, value: unknown, index: number): void {
  if (!isRecord(value)) invalidDocument(document, `ingredients[${index}]`, value);
  const context = `ingredients[${safeDiagnostic(value.lineKey)}]`;
  if (!isNonBlankString(value.lineKey)) invalidDocument(document, `${context}.lineKey`, value.lineKey);
  if (!isNonBlankString(value.itemName)) invalidDocument(document, `${context}.itemName`, value.itemName);
  if (value.itemKind !== "direct_ingredient" && value.itemKind !== "prepared_recipe") {
    invalidDocument(document, `${context}.itemKind`, value.itemKind);
  }
  if (value.ingredientId !== null && (!Number.isSafeInteger(value.ingredientId))) {
    invalidDocument(document, `${context}.ingredientId`, value.ingredientId);
  }
  if (value.componentRecipeId !== null) {
    validateRecipeIdentity(document, `${context}.componentRecipeId`, value.componentRecipeId);
  }
  if (!isNullableString(value.sourceText)) invalidDocument(document, `${context}.sourceText`, value.sourceText);
  if (
    value.sourceValue !== null &&
    (typeof value.sourceValue !== "number" || !Number.isFinite(value.sourceValue))
  ) {
    invalidDocument(document, `${context}.sourceValue`, value.sourceValue);
  }
  if (!isNullableString(value.sourceUnit)) invalidDocument(document, `${context}.sourceUnit`, value.sourceUnit);
  if (!isNullableString(value.servingNote)) invalidDocument(document, `${context}.servingNote`, value.servingNote);
  if (typeof value.decisionStatus !== "string") invalidDocument(document, `${context}.decisionStatus`, value.decisionStatus);
  if (!isNullableString(value.selectedSource)) invalidDocument(document, `${context}.selectedSource`, value.selectedSource);
}

function validateProjectedDocument(value: unknown): asserts value is ProjectedWorkDocument {
  if (!isRecord(value)) invalidDocument(value, "document", value);
  validateRecipeIdentity(value, "recipeId", value.recipeId);
  if (!isNonBlankString(value.recipeVersionId)) invalidDocument(value, "recipeVersionId", value.recipeVersionId);
  if (!isNonBlankString(value.recipeName)) invalidDocument(value, "recipeName", value.recipeName);
  if (!isWorkStage(value.stage)) invalidDocument(value, "stage", value.stage);
  if (typeof value.scalable !== "boolean") invalidDocument(value, "scalable", value.scalable);
  validateStringArray(value, "ingredientLineKeys", value.ingredientLineKeys, true);
  if (!Array.isArray(value.ingredients)) invalidDocument(value, "ingredients", value.ingredients);
  value.ingredients.forEach((ingredient, index) => validateIngredient(value, ingredient, index));
  validateStringArray(value, "blockers", value.blockers);
  validateStringArray(value, "operationalNotes", value.operationalNotes);
  if (!isNullableString(value.methodDecisionNote)) {
    invalidDocument(value, "methodDecisionNote", value.methodDecisionNote);
  }
  if (!isNullableString(value.yieldText)) invalidDocument(value, "yieldText", value.yieldText);
  if (!Number.isSafeInteger(value.multiplier) || (value.multiplier as number) < 1) {
    invalidDocument(value, "multiplier", value.multiplier);
  }
  if (!Array.isArray(value.steps)) invalidDocument(value, "steps", value.steps);
  const stepIds = new Set<string>();
  const stepOrders = new Set<number>();
  for (const step of value.steps) {
    if (!isRecord(step)) invalidDocument(value, "steps[]", step);
    if (!isNonBlankString(step.stepId)) invalidDocument(value, "steps[].stepId", step.stepId);
    if (stepIds.has(step.stepId)) {
      invalidDocument(value, `steps[${step.stepId}].stepId`, step.stepId);
    }
    stepIds.add(step.stepId);
    if (step.stage !== value.stage) invalidDocument(value, `steps[${step.stepId}].stage`, step.stage);
    if (typeof step.instruction !== "string") {
      invalidDocument(value, `steps[${step.stepId}].instruction`, step.instruction);
    }
    if (!Number.isSafeInteger(step.order) || (step.order as number) < 1) {
      invalidDocument(value, `steps[${step.stepId}].order`, step.order);
    }
    if (stepOrders.has(step.order as number)) {
      invalidDocument(value, `steps[${step.stepId}].order`, step.order);
    }
    stepOrders.add(step.order as number);
  }
}

function normalizeMediaIndex(value: unknown): MediaIndex {
  if (!isRecord(value)) throw new InvalidPrintInputError("media", value);
  const rawAssetsById = value.assetsById;
  const rawLinksByStepId = value.linksByStepId;
  if (!(rawAssetsById instanceof Map)) {
    throw new InvalidPrintInputError("media.assetsById", rawAssetsById);
  }
  if (!(rawLinksByStepId instanceof Map)) {
    throw new InvalidPrintInputError("media.linksByStepId", rawLinksByStepId);
  }

  const assetsById = new Map<string, MediaAsset>();
  for (const [mediaId, rawAsset] of rawAssetsById) {
    if (!isNonBlankString(mediaId)) {
      throw new InvalidPrintInputError("media.assetsById key", mediaId);
    }
    const capturedAsset = snapshotMediaAsset(rawAsset);
    validateMediaAsset(capturedAsset, mediaId);
    if (!isApprovedSampleMediaPath(capturedAsset.url)) continue;
    assetsById.set(mediaId, capturedAsset);
  }

  const linksByStepId = new Map<string, StepMediaLink[]>();
  const pairs = new Set<string>();
  const orders = new Map<string, Set<number>>();
  for (const [stepId, rawLinks] of rawLinksByStepId) {
    if (!isNonBlankString(stepId)) {
      throw new InvalidPrintInputError("media.linksByStepId key", stepId);
    }
    if (!Array.isArray(rawLinks)) {
      throw new InvalidPrintInputError(`media.linksByStepId[${stepId}]`, rawLinks);
    }
    const capturedLinks = Array.from(rawLinks, snapshotMediaLink);
    for (const capturedLink of capturedLinks) {
      validateMediaLink(capturedLink);
      const link = capturedLink;
      if (link.stepId !== stepId) {
        throw new InvalidPrintMediaLinkError(stepId, link.mediaId, "stepId", link.stepId);
      }
      if (!assetsById.has(link.mediaId)) continue;
      const pair = `${JSON.stringify(link.stepId)}\u0000${JSON.stringify(link.mediaId)}`;
      if (pairs.has(pair)) {
        throw new DuplicatePrintMediaError("link", link.mediaId, link.stepId);
      }
      pairs.add(pair);
      const stepOrders = orders.get(stepId) ?? new Set<number>();
      if (stepOrders.has(link.order)) {
        throw new DuplicatePrintMediaError("order", link.mediaId, stepId, link.order);
      }
      stepOrders.add(link.order);
      orders.set(stepId, stepOrders);
      const links = linksByStepId.get(stepId);
      if (links) links.push(link);
      else linksByStepId.set(stepId, [link]);
    }
  }
  for (const links of linksByStepId.values()) {
    links.sort((left, right) => left.order - right.order);
  }
  return { assetsById, linksByStepId };
}

function cloneIngredient(line: IngredientLine): IngredientLine {
  return {
    lineKey: line.lineKey,
    itemName: line.itemName,
    itemKind: line.itemKind,
    ingredientId: line.ingredientId,
    componentRecipeId: line.componentRecipeId,
    sourceText: line.sourceText,
    sourceValue: line.sourceValue,
    sourceUnit: line.sourceUnit,
    servingNote: line.servingNote,
    decisionStatus: line.decisionStatus,
    selectedSource: line.selectedSource,
  };
}

function cloneStep(step: WorkStep): WorkStep {
  return {
    stepId: step.stepId,
    stage: step.stage,
    instruction: step.instruction,
    order: step.order,
  };
}

function cloneDocument(document: ProjectedWorkDocument): ProjectedWorkDocument {
  return {
    recipeId: document.recipeId,
    recipeVersionId: document.recipeVersionId,
    recipeName: document.recipeName,
    stage: document.stage,
    scalable: document.scalable,
    ingredientLineKeys: document.ingredientLineKeys.map((lineKey) => lineKey),
    ingredients: document.ingredients.map(cloneIngredient),
    steps: document.steps.map(cloneStep),
    multiplier: document.multiplier,
    blockers: document.blockers.map((blocker) => blocker),
    operationalNotes: document.operationalNotes.map((note) => note),
    methodDecisionNote: document.methodDecisionNote,
    yieldText: document.yieldText,
  };
}

function isPlannerError(error: unknown): boolean {
  try {
    return (
      error instanceof InvalidPrintSettingsError ||
      error instanceof InvalidPrintInputError ||
      error instanceof InvalidPrintDocumentError ||
      error instanceof DuplicatePrintDocumentError ||
      error instanceof InvalidPrintMediaError ||
      error instanceof InvalidPrintMediaLinkError ||
      error instanceof DuplicatePrintMediaError ||
      error instanceof UnpageableStepError ||
      error instanceof UnpageableDocumentError
    );
  } catch {
    return false;
  }
}

function usableLinksForStep(
  media: MediaIndex,
  stepId: string,
): StepMediaLink[] {
  return media.linksByStepId.get(stepId) ?? [];
}

const ZERO_WIDTH_DISPLAY_CHARACTER = /[\p{M}\p{Cf}\p{Emoji_Modifier}]/u;
const EXTRA_WIDE_EMOJI_CHARACTER = /\p{Extended_Pictographic}/u;
const WIDE_REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;
const KEYCAP_BASE = /[0-9#*]/u;
const HARD_LINE_BREAK = /\r\n|[\n\r\u2028\u2029]/u;
const DISPLAY_CELLS_PER_LAYOUT_UNIT = 120;
const TAB_DISPLAY_WIDTH = 4;

function isEastAsianWide(codePoint: number): boolean {
  return codePoint >= 0x1100 && (
    codePoint <= 0x115f ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3040 && codePoint <= 0x3247) ||
    (codePoint >= 0x3250 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0xa4c6) ||
    (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6b) ||
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1b000 && codePoint <= 0x1b001) ||
    (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function displayCharacterWidth(character: string): number {
  if (ZERO_WIDTH_DISPLAY_CHARACTER.test(character)) return 0;
  const codePoint = character.codePointAt(0);
  if (EXTRA_WIDE_EMOJI_CHARACTER.test(character)) return 3;
  if (
    WIDE_REGIONAL_INDICATOR.test(character) ||
    (codePoint !== undefined && isEastAsianWide(codePoint))
  ) {
    return 2;
  }
  return 1;
}

function keycapSequenceEnd(value: string, index: number): number | null {
  if (!KEYCAP_BASE.test(value[index] ?? "")) return null;
  let cursor = index + 1;
  while (
    value.charCodeAt(cursor) === 0xfe0e ||
    value.charCodeAt(cursor) === 0xfe0f
  ) {
    cursor += 1;
  }
  return value.charCodeAt(cursor) === 0x20e3 ? cursor + 1 : null;
}

function renderedDisplayWidth(value: string): number {
  let width = 0;
  for (let index = 0; index < value.length;) {
    const keycapEnd = keycapSequenceEnd(value, index);
    if (keycapEnd !== null) {
      width += 3;
      index = keycapEnd;
      continue;
    }
    const codePoint = value.codePointAt(index);
    const character = codePoint === undefined
      ? value[index]
      : String.fromCodePoint(codePoint);
    width += displayCharacterWidth(character);
    index += character.length;
  }
  return width;
}

function hasSingleLineLayoutControl(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

function hasUnsafeMultilineLayoutControl(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return false;
    const isAllowedC0 = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d;
    return (
      (codePoint <= 0x1f && !isAllowedC0) ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    );
  });
}

function rejectSingleLineLayoutControl(value: string, field: string): void {
  if (hasSingleLineLayoutControl(value)) {
    throw new InvalidPrintInputError(field, "<layout-control>");
  }
}

function multilineDisplayWidth(value: string, field: string): number {
  if (hasUnsafeMultilineLayoutControl(value)) {
    throw new InvalidPrintInputError(field, "<layout-control>");
  }
  const lines = value.split(HARD_LINE_BREAK);
  const lineWidths = lines.map((line) => {
    const tabSeparatedParts = line.split("\t");
    return tabSeparatedParts.reduce(
      (total, part) => total + renderedDisplayWidth(part),
      (tabSeparatedParts.length - 1) * TAB_DISPLAY_WIDTH,
    );
  });
  if (lines.length === 1) return lineWidths[0];
  return lineWidths.reduce(
    (total, lineWidth) => total + Math.max(
      1,
      Math.ceil(lineWidth / DISPLAY_CELLS_PER_LAYOUT_UNIT),
    ) * DISPLAY_CELLS_PER_LAYOUT_UNIT,
    0,
  );
}

function stepInstructionDisplayWidth(value: string): number {
  return multilineDisplayWidth(
    value,
    "document.steps.instruction.layout_control",
  );
}

function sourceFactText(line: IngredientLine): string {
  if (line.sourceText !== null) return line.sourceText;
  if (line.sourceValue !== null && line.sourceUnit !== null) {
    return `${String(line.sourceValue)} ${line.sourceUnit}`;
  }
  if (line.sourceValue !== null) return String(line.sourceValue);
  if (line.sourceUnit !== null) return line.sourceUnit;
  return "ไม่ระบุในต้นฉบับ";
}

function servingNoteDisplayWidth(
  document: ProjectedWorkDocument,
  line: IngredientLine,
): number {
  if (document.stage !== "service" || line.servingNote === null) {
    return 0;
  }
  return multilineDisplayWidth(
    line.servingNote,
    "document.ingredients.servingNote.layout_control",
  );
}

type ResolvedComponentLabels = ReadonlyMap<string, string>;

function resolveComponentLabels(
  document: ProjectedWorkDocument,
  componentLabelFor?: ComponentLabelResolver,
): ResolvedComponentLabels {
  const labels = new Map<string, string>();
  if (componentLabelFor === undefined) return labels;
  for (const line of document.ingredients) {
    if (line.componentRecipeId === null) continue;
    const label: unknown = componentLabelFor(line.componentRecipeId);
    if (label === null) continue;
    if (typeof label !== "string") {
      throw new InvalidPrintInputError(
        "document.ingredients.componentReference",
        label,
      );
    }
    rejectSingleLineLayoutControl(
      label,
      "document.ingredients.componentReference.layout_control",
    );
    labels.set(line.lineKey, label);
  }
  return labels;
}

function operationalFactStrings(document: ProjectedWorkDocument): string[] {
  return [
    ...document.operationalNotes,
    ...(document.yieldText === null ? [] : [document.yieldText]),
    ...(document.methodDecisionNote === null ? [] : [document.methodDecisionNote]),
  ];
}

const REGIONAL_LAYOUT_CAPACITY = {
  header: 160,
  ingredientRows: 15,
  ingredientItemDisplayWidth: 64,
  ingredientSourceFactDisplayWidth: 48,
  ingredientRowDisplayWidth: 96,
  ingredientRegionDisplayWidth: 300,
  operationalFactsDisplayWidth: 480,
  mediaCount: 3,
  mediaCaptionDisplayWidth: 121,
  mediaAltTextDisplayWidth: 80,
  mediaMeasurementDisplayWidth: 48,
  mediaRegionDisplayWidth: 480,
  mediaFixedLabelAllowance: 24,
} as const;
const COMPACT_REFERENCE_LINES_PER_LAYOUT_UNIT = 2;

function throwRegionalLayoutError(
  document: ProjectedWorkDocument,
  section: Exclude<UnpageableDocumentSection, "combined">,
  contentUnits: number,
  capacity: number,
): never {
  throw new UnpageableDocumentError(document, section, contentUnits, capacity);
}

function validateFixedRegionalLayout(
  document: ProjectedWorkDocument,
  componentLabels: ResolvedComponentLabels,
): void {
  rejectSingleLineLayoutControl(
    document.recipeName,
    "document.recipeName.layout_control",
  );
  const headerDisplayWidth = renderedDisplayWidth(document.recipeName);
  if (headerDisplayWidth > REGIONAL_LAYOUT_CAPACITY.header) {
    throwRegionalLayoutError(
      document,
      "header",
      headerDisplayWidth,
      REGIONAL_LAYOUT_CAPACITY.header,
    );
  }

  if (document.ingredients.length > REGIONAL_LAYOUT_CAPACITY.ingredientRows) {
    throwRegionalLayoutError(
      document,
      "ingredients",
      document.ingredients.length,
      REGIONAL_LAYOUT_CAPACITY.ingredientRows,
    );
  }

  let regionDisplayWidth = 0;
  for (const line of document.ingredients) {
    rejectSingleLineLayoutControl(
      line.itemName,
      "document.ingredients.itemName.layout_control",
    );
    const factText = sourceFactText(line);
    rejectSingleLineLayoutControl(
      factText,
      "document.ingredients.sourceFact.layout_control",
    );
    const sourceDisplayWidth = renderedDisplayWidth(factText);
    const factDisplayWidth = Math.max(
      sourceDisplayWidth,
      servingNoteDisplayWidth(document, line),
    );
    const itemDisplayWidth = renderedDisplayWidth(line.itemName);
    const componentDisplayWidth = renderedDisplayWidth(
      componentLabels.get(line.lineKey) ?? "",
    );
    if (itemDisplayWidth > REGIONAL_LAYOUT_CAPACITY.ingredientItemDisplayWidth) {
      throwRegionalLayoutError(
        document,
        "ingredients",
        itemDisplayWidth,
        REGIONAL_LAYOUT_CAPACITY.ingredientItemDisplayWidth,
      );
    }
    if (componentDisplayWidth > REGIONAL_LAYOUT_CAPACITY.ingredientItemDisplayWidth) {
      throwRegionalLayoutError(
        document,
        "ingredients",
        componentDisplayWidth,
        REGIONAL_LAYOUT_CAPACITY.ingredientItemDisplayWidth,
      );
    }
    if (factDisplayWidth > REGIONAL_LAYOUT_CAPACITY.ingredientSourceFactDisplayWidth) {
      throwRegionalLayoutError(
        document,
        "ingredients",
        factDisplayWidth,
        REGIONAL_LAYOUT_CAPACITY.ingredientSourceFactDisplayWidth,
      );
    }
    const rowDisplayWidth = itemDisplayWidth + factDisplayWidth;
    if (rowDisplayWidth > REGIONAL_LAYOUT_CAPACITY.ingredientRowDisplayWidth) {
      throwRegionalLayoutError(
        document,
        "ingredients",
        rowDisplayWidth,
        REGIONAL_LAYOUT_CAPACITY.ingredientRowDisplayWidth,
      );
    }
    regionDisplayWidth += rowDisplayWidth;
  }
  if (regionDisplayWidth > REGIONAL_LAYOUT_CAPACITY.ingredientRegionDisplayWidth) {
    throwRegionalLayoutError(
      document,
      "ingredients",
      regionDisplayWidth,
      REGIONAL_LAYOUT_CAPACITY.ingredientRegionDisplayWidth,
    );
  }


  const operationalFactsDisplayWidth = operationalFactStrings(document).reduce(
    (total, fact) => total + multilineDisplayWidth(
      fact,
      "document.operationalFacts.layout_control",
    ),
    0,
  );
  if (operationalFactsDisplayWidth > REGIONAL_LAYOUT_CAPACITY.operationalFactsDisplayWidth) {
    throwRegionalLayoutError(
      document,
      "operational_facts",
      operationalFactsDisplayWidth,
      REGIONAL_LAYOUT_CAPACITY.operationalFactsDisplayWidth,
    );
  }
}

type MediaRegionalLayout = {
  capacity: number;
  contentUnits: number;
  exceeded: boolean;
};

function mediaRegionalLayout(
  media: MediaIndex,
  blocks: WorkstationPage["blocks"],
): MediaRegionalLayout {
  const assets = blocks.flatMap((block) => usableLinksForStep(media, block.stepId))
    .flatMap((link) => {
      const asset = media.assetsById.get(link.mediaId);
      return asset === undefined ? [] : [asset];
    });
  if (assets.length > REGIONAL_LAYOUT_CAPACITY.mediaCount) {
    return {
      capacity: REGIONAL_LAYOUT_CAPACITY.mediaCount,
      contentUnits: assets.length,
      exceeded: true,
    };
  }

  let regionDisplayWidth = assets.length * REGIONAL_LAYOUT_CAPACITY.mediaFixedLabelAllowance;
  for (const asset of assets) {
    rejectSingleLineLayoutControl(asset.caption, "media.caption.layout_control");
    rejectSingleLineLayoutControl(asset.altText, "media.altText.layout_control");
    if (asset.measurementAnnotation !== null) {
      rejectSingleLineLayoutControl(
        asset.measurementAnnotation,
        "media.measurementAnnotation.layout_control",
      );
    }
    const captionDisplayWidth = renderedDisplayWidth(asset.caption);
    if (captionDisplayWidth > REGIONAL_LAYOUT_CAPACITY.mediaCaptionDisplayWidth) {
      return {
        capacity: REGIONAL_LAYOUT_CAPACITY.mediaCaptionDisplayWidth,
        contentUnits: captionDisplayWidth,
        exceeded: true,
      };
    }
    const altTextDisplayWidth = renderedDisplayWidth(asset.altText);
    if (altTextDisplayWidth > REGIONAL_LAYOUT_CAPACITY.mediaAltTextDisplayWidth) {
      return {
        capacity: REGIONAL_LAYOUT_CAPACITY.mediaAltTextDisplayWidth,
        contentUnits: altTextDisplayWidth,
        exceeded: true,
      };
    }
    const measurementDisplayWidth = asset.measurementAnnotation === null
      ? 0
      : renderedDisplayWidth(asset.measurementAnnotation);
    if (measurementDisplayWidth > REGIONAL_LAYOUT_CAPACITY.mediaMeasurementDisplayWidth) {
      return {
        capacity: REGIONAL_LAYOUT_CAPACITY.mediaMeasurementDisplayWidth,
        contentUnits: measurementDisplayWidth,
        exceeded: true,
      };
    }
    regionDisplayWidth +=
      captionDisplayWidth + altTextDisplayWidth + measurementDisplayWidth;
  }
  return {
    capacity: REGIONAL_LAYOUT_CAPACITY.mediaRegionDisplayWidth,
    contentUnits: regionDisplayWidth,
    exceeded: regionDisplayWidth > REGIONAL_LAYOUT_CAPACITY.mediaRegionDisplayWidth,
  };
}

function validateMediaRegionalLayout(
  document: ProjectedWorkDocument,
  media: MediaIndex,
  blocks: WorkstationPage["blocks"],
): void {
  const layout = mediaRegionalLayout(media, blocks);
  if (!layout.exceeded) return;
  throwRegionalLayoutError(
    document,
    "media_metadata",
    layout.contentUnits,
    layout.capacity,
  );
}

function ingredientLayoutUnits(
  document: ProjectedWorkDocument,
  componentLabels: ResolvedComponentLabels,
): number {
  const ingredientUnits = document.ingredients.reduce(
    (total, line) => {
      const componentLabel = componentLabels.get(line.lineKey);
      return total + 1 + Math.max(
        1,
        Math.ceil(
          (renderedDisplayWidth(line.itemName) +
            (componentLabel === undefined ? 0 : renderedDisplayWidth(componentLabel)) +
            renderedDisplayWidth(sourceFactText(line)) +
            servingNoteDisplayWidth(document, line)) /
            DISPLAY_CELLS_PER_LAYOUT_UNIT,
        ),
      );
    },
    0,
  );
  const compactReferenceLineUnits = Math.ceil(
    componentLabels.size / COMPACT_REFERENCE_LINES_PER_LAYOUT_UNIT,
  );
  return ingredientUnits + compactReferenceLineUnits;
}

function operationalFactsLayoutUnits(document: ProjectedWorkDocument): number {
  return operationalFactStrings(document).reduce(
    (total, fact) => total + Math.max(
      1,
      Math.ceil(multilineDisplayWidth(
        fact,
        "document.operationalFacts.layout_control",
      ) / 80),
    ),
    0,
  );
}

function mediaMetadataUnits(
  media: MediaIndex,
  blocks: WorkstationPage["blocks"],
): number {
  return blocks.reduce((pageTotal, block) => {
    const links = usableLinksForStep(media, block.stepId);
    return pageTotal + links.reduce((stepTotal, link) => {
      const asset = media.assetsById.get(link.mediaId);
      if (asset === undefined) return stepTotal;
      const renderedTextDisplayWidth =
        renderedDisplayWidth(asset.caption) +
        renderedDisplayWidth(asset.altText) +
        (asset.measurementAnnotation === null
          ? 0
          : renderedDisplayWidth(asset.measurementAnnotation));
      return stepTotal + 1 + Math.max(
        1,
        Math.ceil(renderedTextDisplayWidth / DISPLAY_CELLS_PER_LAYOUT_UNIT),
      );
    }, 0);
  }, 0);
}

function stepLayoutUnits(
  document: ProjectedWorkDocument,
  media: MediaIndex,
  blocks: WorkstationPage["blocks"],
): number {
  const stepsById = new Map(document.steps.map((step) => [step.stepId, step]));
  return blocks.reduce((total, block) => {
    const step = stepsById.get(block.stepId);
    if (step === undefined) return total;
    const textWeight = Math.max(
      1,
      Math.ceil(
        stepInstructionDisplayWidth(step.instruction) /
          DISPLAY_CELLS_PER_LAYOUT_UNIT,
      ),
    );
    return total + textWeight + usableLinksForStep(media, step.stepId).length * 2;
  }, 0);
}

function combinedPageLayout(
  document: ProjectedWorkDocument,
  media: MediaIndex,
  blocks: WorkstationPage["blocks"],
  componentLabels: ResolvedComponentLabels,
): {
  capacity: number;
  contentUnits: number;
  section: UnpageableDocumentSection;
} {
  const capacity = 36;
  const fixedChromeAndWarningUnits = 4;
  const contributions = {
    header: Math.max(1, Math.ceil(renderedDisplayWidth(document.recipeName) / 40)),
    ingredients: ingredientLayoutUnits(document, componentLabels),
    operational_facts: operationalFactsLayoutUnits(document),
    steps: stepLayoutUnits(document, media, blocks),
    media_metadata: mediaMetadataUnits(media, blocks),
  };
  const contentUnits =
    fixedChromeAndWarningUnits +
    contributions.header +
    contributions.ingredients +
    contributions.operational_facts +
    contributions.steps +
    contributions.media_metadata;

  const dominant = (["header", "ingredients", "operational_facts", "media_metadata"] as const)
    .reduce((largest, section) =>
      contributions[section] > contributions[largest] ? section : largest,
    );
  const section: UnpageableDocumentSection =
    contributions[dominant] > capacity / 2 ? dominant : "combined";
  return { capacity, contentUnits, section };
}

function validateCombinedPageLayout(
  document: ProjectedWorkDocument,
  media: MediaIndex,
  blocks: WorkstationPage["blocks"],
  componentLabels: ResolvedComponentLabels,
): void {
  const layout = combinedPageLayout(document, media, blocks, componentLabels);
  if (layout.contentUnits <= layout.capacity) return;

  throw new UnpageableDocumentError(
    document,
    layout.section,
    layout.contentUnits,
    layout.capacity,
  );
}

function isWorkStage(value: unknown): value is WorkStage {
  return value === "prep" || value === "cook" || value === "service";
}

export function resolveTemplate(
  template: PrintTemplate,
  stage: WorkStage | "all",
): Exclude<PrintTemplate, "auto"> {
  if (template !== "auto" && template !== "station" && template !== "two-up") {
    throw new InvalidPrintSettingsError("template", template);
  }
  if (!isWorkStage(stage) && stage !== "all") {
    throw new InvalidPrintSettingsError("stage", stage);
  }
  return template === "auto" ? "station" : template;
}

function buildMediaIndexInternal(snapshot: CookbookSnapshot): MediaIndex {
  if (!isRecord(snapshot)) {
    throw new InvalidPrintInputError("snapshot", snapshot);
  }
  const rawMedia = snapshot.media;
  if (!Array.isArray(rawMedia)) {
    throw new InvalidPrintInputError("snapshot.media", rawMedia);
  }
  const rawStepMedia = snapshot.stepMedia;
  if (!Array.isArray(rawStepMedia)) {
    throw new InvalidPrintInputError("snapshot.stepMedia", rawStepMedia);
  }

  const capturedLinks = Array.from(rawStepMedia, snapshotMediaLink);
  for (const link of capturedLinks) validateMediaLink(link);
  const linksSnapshot = capturedLinks as StepMediaLink[];
  const referencedIds = new Set(linksSnapshot.map((link) => link.mediaId));

  const candidatesById = new Map<string, unknown[]>();
  for (const rawAsset of rawMedia) {
    if (!isRecord(rawAsset)) continue;
    let mediaId: unknown;
    try {
      mediaId = rawAsset.mediaId;
    } catch {
      continue;
    }
    if (!isNonBlankString(mediaId)) continue;
    const candidates = candidatesById.get(mediaId);
    if (candidates) candidates.push(rawAsset);
    else candidatesById.set(mediaId, [rawAsset]);
  }

  const assetsById = new Map<string, MediaAsset>();
  for (const [mediaId, rawCandidates] of candidatesById) {
    if (rawCandidates.length > 1) {
      throw new DuplicatePrintMediaError("asset", mediaId);
    }
    let candidate: unknown;
    try {
      candidate = snapshotMediaAsset(rawCandidates[0], mediaId);
    } catch {
      if (referencedIds.has(mediaId)) {
        throw new InvalidPrintInputError(`snapshot.media[${mediaId}]`, rawCandidates[0]);
      }
      continue;
    }
    try {
      validateMediaAsset(candidate, mediaId);
    } catch (error) {
      if (referencedIds.has(mediaId)) throw error;
      continue;
    }
    if (!isApprovedSampleMediaPath(candidate.url)) continue;
    assetsById.set(mediaId, candidate);
  }

  const linksByStepId = new Map<string, StepMediaLink[]>();
  const pairs = new Set<string>();
  const orders = new Map<string, Set<number>>();
  for (const link of linksSnapshot) {
    if (!assetsById.has(link.mediaId)) continue;
    const pair = `${JSON.stringify(link.stepId)}\u0000${JSON.stringify(link.mediaId)}`;
    if (pairs.has(pair)) {
      throw new DuplicatePrintMediaError("link", link.mediaId, link.stepId);
    }
    pairs.add(pair);
    const stepOrders = orders.get(link.stepId) ?? new Set<number>();
    if (stepOrders.has(link.order)) {
      throw new DuplicatePrintMediaError("order", link.mediaId, link.stepId, link.order);
    }
    stepOrders.add(link.order);
    orders.set(link.stepId, stepOrders);
    const links = linksByStepId.get(link.stepId);
    if (links) links.push(link);
    else linksByStepId.set(link.stepId, [link]);
  }
  for (const links of linksByStepId.values()) {
    links.sort((left, right) => left.order - right.order);
  }

  return { assetsById, linksByStepId };
}

export function buildMediaIndex(snapshot: CookbookSnapshot): MediaIndex {
  try {
    return buildMediaIndexInternal(snapshot);
  } catch (error) {
    if (isPlannerError(error)) throw error;
    throw new InvalidPrintInputError("snapshot", snapshot);
  }
}

function paginateCapturedDocument(
  documentSnapshot: ProjectedWorkDocument,
  mediaSnapshot: MediaIndex,
  componentLabelFor?: ComponentLabelResolver,
): WorkstationPage[] {
  const steps = [...documentSnapshot.steps].sort((left, right) => left.order - right.order);
  const componentLabels = resolveComponentLabels(documentSnapshot, componentLabelFor);
  validateFixedRegionalLayout(documentSnapshot, componentLabels);
  if (steps.length === 0) {
    if (
      documentSnapshot.blockers.length === 0 &&
      documentSnapshot.operationalNotes.length === 0 &&
      documentSnapshot.yieldText === null &&
      documentSnapshot.methodDecisionNote === null
    ) return [];
    const fullLayout = combinedPageLayout(documentSnapshot, mediaSnapshot, [], componentLabels);
    if (fullLayout.contentUnits <= fullLayout.capacity) {
      return [{
        kind: "station",
        document: cloneDocument(documentSnapshot),
        blocks: [],
        partNumber: 1,
        totalParts: 1,
      }];
    }

    const hasFacts = operationalFactStrings(documentSnapshot).length > 0;
    if (documentSnapshot.ingredients.length > 0 && hasFacts) {
      const ingredientsDocument = cloneDocument(documentSnapshot);
      ingredientsDocument.operationalNotes = [];
      ingredientsDocument.methodDecisionNote = null;
      ingredientsDocument.yieldText = null;
      const factsDocument = cloneDocument(documentSnapshot);
      factsDocument.ingredientLineKeys = [];
      factsDocument.ingredients = [];
      validateCombinedPageLayout(ingredientsDocument, mediaSnapshot, [], componentLabels);
      validateCombinedPageLayout(factsDocument, mediaSnapshot, [], new Map());
      return [ingredientsDocument, factsDocument].map((document, index) => ({
        kind: "station" as const,
        document,
        blocks: [],
        partNumber: index + 1,
        totalParts: 2,
      }));
    }

    validateCombinedPageLayout(documentSnapshot, mediaSnapshot, [], componentLabels);
    throw new Error("unreachable print layout validation");
  }

  const capacity = 7;
  const pageBlocks: WorkstationPage["blocks"][] = [];
  let currentBlocks: WorkstationPage["blocks"] = [];
  let currentWeight = 0;

  for (const step of steps) {
    const mediaCount = usableLinksForStep(mediaSnapshot, step.stepId).length;
    const textDisplayWidth = stepInstructionDisplayWidth(step.instruction);
    const textWeight = Math.max(
      1,
      Math.ceil(textDisplayWidth / DISPLAY_CELLS_PER_LAYOUT_UNIT),
    );
    const weight = textWeight + mediaCount * 2;
    if (weight > capacity) {
      throw new UnpageableStepError(
        documentSnapshot,
        step.stepId,
        textDisplayWidth,
        mediaCount,
        capacity,
      );
    }
    const block: WorkstationPage["blocks"][number] = {
      kind: "step",
      stepId: step.stepId,
      layout: mediaCount > 0 ? "with-media" : "text-only",
    };

    const candidateBlocks = [...currentBlocks, block];
    const candidateLayout = combinedPageLayout(
      documentSnapshot,
      mediaSnapshot,
      candidateBlocks,
      componentLabels,
    );
    const candidateMediaLayout = mediaRegionalLayout(mediaSnapshot, candidateBlocks);
    if (
      currentBlocks.length > 0 &&
      (currentWeight + weight > capacity ||
        candidateMediaLayout.exceeded ||
        candidateLayout.contentUnits > candidateLayout.capacity)
    ) {
      pageBlocks.push(currentBlocks);
      currentBlocks = [];
      currentWeight = 0;
    }
    validateMediaRegionalLayout(documentSnapshot, mediaSnapshot, [block]);
    validateCombinedPageLayout(documentSnapshot, mediaSnapshot, [block], componentLabels);
    currentBlocks.push(block);
    currentWeight += weight;
    if (currentWeight >= capacity) {
      pageBlocks.push(currentBlocks);
      currentBlocks = [];
      currentWeight = 0;
    }
  }
  if (currentBlocks.length > 0) pageBlocks.push(currentBlocks);

  for (const blocks of pageBlocks) {
    validateMediaRegionalLayout(documentSnapshot, mediaSnapshot, blocks);
    validateCombinedPageLayout(documentSnapshot, mediaSnapshot, blocks, componentLabels);
  }

  const totalParts = pageBlocks.length;
  return pageBlocks.map((blocks, index) => ({
    kind: "station",
    document: cloneDocument(documentSnapshot),
    blocks: blocks.map((block) => ({ ...block })),
    partNumber: index + 1,
    totalParts,
  }));
}

function paginateWorkDocumentInternal(
  document: ProjectedWorkDocument,
  media: MediaIndex,
  componentLabelFor?: ComponentLabelResolver,
): WorkstationPage[] {
  const capturedDocument = snapshotDocument(document);
  validateProjectedDocument(capturedDocument);
  const mediaSnapshot = normalizeMediaIndex(media);
  return paginateCapturedDocument(capturedDocument, mediaSnapshot, componentLabelFor);
}

export function paginateWorkDocument(
  document: ProjectedWorkDocument,
  media: MediaIndex,
  componentLabelFor?: ComponentLabelResolver,
): WorkstationPage[] {
  try {
    return paginateWorkDocumentInternal(document, media, componentLabelFor);
  } catch (error) {
    if (isPlannerError(error)) throw error;
    throw new InvalidPrintDocumentError(undefined, "document", document);
  }
}

function snapshotSelectedDocuments(
  documents: ProjectedWorkDocument[],
  requestedStage: WorkStage | "all",
): unknown[] {
  const selected: unknown[] = [];
  for (const document of documents) {
    if (!isRecord(document)) {
      selected.push(snapshotDocument(document));
      continue;
    }
    const stage = document.stage;
    if (
      requestedStage !== "all" &&
      isWorkStage(stage) &&
      stage !== requestedStage
    ) {
      continue;
    }
    selected.push(snapshotDocument(document, stage));
  }
  return selected;
}

function buildPrintPlanInternal(
  documents: ProjectedWorkDocument[],
  media: MediaIndex,
  settings: PrintSettings,
  componentLabelFor?: ComponentLabelResolver,
): PrintPage[] {
  if (!Array.isArray(documents)) {
    throw new InvalidPrintInputError("documents", documents);
  }
  const mediaSnapshot = normalizeMediaIndex(media);
  const capturedSettings = snapshotSettings(settings);
  if (!isRecord(capturedSettings)) {
    throw new InvalidPrintInputError("settings", capturedSettings);
  }
  const settingsSnapshot = capturedSettings as unknown as PrintSettings;
  const template = resolveTemplate(settingsSnapshot.template, settingsSnapshot.stage);
  if (!Number.isSafeInteger(settingsSnapshot.multiplier) || settingsSnapshot.multiplier < 1) {
    throw new InvalidPrintSettingsError("multiplier", settingsSnapshot.multiplier);
  }

  const capturedDocuments = snapshotSelectedDocuments(
    documents,
    settingsSnapshot.stage,
  );
  const selectedDocuments: ProjectedWorkDocument[] = [];
  const identities = new Set<string>();
  const versionIds = new Set<string>();
  for (const capturedDocument of capturedDocuments) {
    validateProjectedDocument(capturedDocument);
    const document = capturedDocument;
    selectedDocuments.push(document);
    const identity = typeof document.recipeId === "number"
      ? `number:${String(document.recipeId)}`
      : `string:${JSON.stringify(document.recipeId)}`;
    const identityStage = `${identity}\u0000${document.stage}`;
    if (identities.has(identityStage)) {
      throw new DuplicatePrintDocumentError("recipe_identity", document);
    }
    identities.add(identityStage);
    const versionStage = `${JSON.stringify(document.recipeVersionId)}\u0000${document.stage}`;
    if (versionIds.has(versionStage)) {
      throw new DuplicatePrintDocumentError("recipe_version_id", document);
    }
    versionIds.add(versionStage);
  }

  const stationPages = selectedDocuments
    .flatMap((document) => {
      let printDocument = document;
      if (document.stage === "service") {
        printDocument = cloneDocument(document);
        printDocument.multiplier = 1;
      } else {
        const expectedMultiplier = document.scalable ? settingsSnapshot.multiplier : 1;
        if (document.multiplier !== expectedMultiplier) {
          throw new InvalidPrintDocumentError(
            document.recipeId,
            "multiplier",
            document.multiplier,
          );
        }
      }
      return paginateCapturedDocument(printDocument, mediaSnapshot, componentLabelFor);
    });

  if (template === "station") return stationPages;

  const pages: TwoUpPage[] = [];
  for (let index = 0; index < stationPages.length; index += 2) {
    pages.push({ kind: "two-up", slots: stationPages.slice(index, index + 2) });
  }
  return pages;
}

export function buildPrintPlan(
  documents: ProjectedWorkDocument[],
  media: MediaIndex,
  settings: PrintSettings,
  componentLabelFor?: ComponentLabelResolver,
): PrintPage[] {
  try {
    return buildPrintPlanInternal(documents, media, settings, componentLabelFor);
  } catch (error) {
    if (isPlannerError(error)) throw error;
    throw new InvalidPrintInputError("printPlan", error);
  }
}
