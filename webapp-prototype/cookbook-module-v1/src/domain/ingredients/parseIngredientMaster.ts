import type {
  ApprovalState,
  CookbookIngredient,
  CostObservation,
  IngredientAlias,
  IngredientMapping,
  IngredientMasterSnapshot,
  IngredientRedirect,
  IngredientSpecification,
  LegacySourceRecord,
  LinkIngredientPublishPayload,
  MergeRedirectPublishPayload,
  RecipeLineLink,
  ReconciliationAction,
  ReconciliationDecision,
  RecordStatus,
  SourceManifest,
  SpecificationPublishPayload,
  UnitConversionEvidence,
  UsableYieldEvidence,
} from "./types.ts";
import { validateRecipeLineLink } from "./ingredientPolicy.ts";

// Keep hostile transport input below the browser call-stack limit while returning the domain error.
const MAX_RAW_DEPTH = 256;

function invalid(): never {
  throw new Error("INVALID_INGREDIENT_MASTER_SNAPSHOT");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : invalid();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}

function identity(value: unknown): string {
  const text = stringValue(value);
  return text.length > 0 ? text : invalid();
}

function nullableIdentity(value: unknown): string | null {
  return value === null ? null : identity(value);
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : invalid();
}

function sha256(value: unknown): string {
  const text = stringValue(value);
  return /^[0-9a-f]{64}$/u.test(text) ? text : invalid();
}

function arrayValue<T>(value: unknown, parse: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(parse) : invalid();
}

function recordStatus(value: unknown): RecordStatus {
  return value === "active" || value === "inactive" ? value : invalid();
}

function approvalState(value: unknown): ApprovalState {
  return value === "pending" || value === "approved" || value === "rejected" ? value : invalid();
}

function approvedOrRejected(value: unknown): ReconciliationDecision["approvalState"] {
  return value === "approved" || value === "rejected" ? value : invalid();
}

function stringRecord(value: unknown): Record<string, string> {
  const record = recordValue(value);
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, stringValue(entry)]));
}

function numberRecord(value: unknown): Record<string, number> {
  const record = recordValue(value);
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, nonNegativeNumber(entry)]));
}

function jsonTransportValue(
  value: unknown,
  ancestors = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (depth > MAX_RAW_DEPTH) return invalid();
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : invalid();
  if (typeof value !== "object") return invalid();
  if (ancestors.has(value)) return invalid();

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) invalid();
      const copy: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) invalid();
        copy.push(jsonTransportValue(value[index], ancestors, depth + 1));
      }
      return copy;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) invalid();
    if (Reflect.ownKeys(value).length !== Object.keys(value).length) invalid();
    return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
      [key, jsonTransportValue(entry, ancestors, depth + 1)]));
  } finally {
    ancestors.delete(value);
  }
}

function parseIngredient(value: unknown): CookbookIngredient {
  const record = recordValue(value);
  const costingState = record.costingState;
  if (costingState !== "not_costed" && costingState !== "requires_specification") invalid();
  return {
    ingredientId: identity(record.ingredientId),
    primaryName: stringValue(record.primaryName),
    category: stringValue(record.category),
    status: recordStatus(record.status),
    costingState,
  };
}

function parseSpecification(value: unknown): IngredientSpecification {
  const record = recordValue(value);
  return {
    specificationId: identity(record.specificationId),
    ingredientId: identity(record.ingredientId),
    label: stringValue(record.label),
    attributes: stringRecord(record.attributes),
    status: recordStatus(record.status),
    approvalState: approvalState(record.approvalState),
  };
}

function parseAlias(value: unknown): IngredientAlias {
  const record = recordValue(value);
  return {
    aliasId: identity(record.aliasId),
    ingredientId: identity(record.ingredientId),
    text: stringValue(record.text),
    sourceRecordId: identity(record.sourceRecordId),
  };
}

function parseRedirect(value: unknown): IngredientRedirect {
  const record = recordValue(value);
  return {
    redirectId: identity(record.redirectId),
    fromIngredientId: identity(record.fromIngredientId),
    toIngredientId: identity(record.toIngredientId),
    decisionId: identity(record.decisionId),
  };
}

function parseMapping(value: unknown): IngredientMapping {
  const record = recordValue(value);
  return {
    mappingId: identity(record.mappingId),
    specificationId: identity(record.specificationId),
    stockItemId: identity(record.stockItemId),
    approvalState: approvalState(record.approvalState),
  };
}

function parseSourceManifest(value: unknown): SourceManifest {
  const record = recordValue(value);
  return {
    manifestId: identity(record.manifestId),
    sourcePath: stringValue(record.sourcePath),
    sha256: sha256(record.sha256),
    byteLength: nonNegativeNumber(record.byteLength),
    extractedAt: stringValue(record.extractedAt),
    sourcePolicy: stringValue(record.sourcePolicy),
    expectedCounts: numberRecord(record.expectedCounts),
  };
}

function parseLegacySourceRecord(value: unknown): LegacySourceRecord {
  const record = recordValue(value);
  const recordType = record.recordType;
  if (recordType !== "ingredient" && recordType !== "recipe" && recordType !== "recipe_line") invalid();
  if (!Object.prototype.hasOwnProperty.call(record, "raw")) invalid();
  return {
    stagingId: identity(record.stagingId),
    manifestId: identity(record.manifestId),
    sourceSha256: sha256(record.sourceSha256),
    recordType,
    sourceRecordId: identity(record.sourceRecordId),
    raw: jsonTransportValue(record.raw),
  };
}

function parseUnitConversion(value: unknown): UnitConversionEvidence {
  const record = recordValue(value);
  return {
    conversionId: identity(record.conversionId),
    specificationId: identity(record.specificationId),
    fromUnit: stringValue(record.fromUnit),
    toUnit: stringValue(record.toUnit),
    factor: nonNegativeNumber(record.factor),
    sourceReference: stringValue(record.sourceReference),
    approvalState: approvalState(record.approvalState),
  };
}

function parseUsableYield(value: unknown): UsableYieldEvidence {
  const record = recordValue(value);
  const mode = record.mode;
  if (mode !== "no_adjustment" && mode !== "usable_yield") invalid();
  return {
    yieldEvidenceId: identity(record.yieldEvidenceId),
    specificationId: identity(record.specificationId),
    mode,
    factor: nonNegativeNumber(record.factor),
    sourceReference: stringValue(record.sourceReference),
    approvalState: approvalState(record.approvalState),
  };
}

function parseCostObservation(value: unknown): CostObservation {
  const record = recordValue(value);
  return {
    observationId: identity(record.observationId),
    specificationId: identity(record.specificationId),
    stockItemId: nullableIdentity(record.stockItemId),
    price: nonNegativeNumber(record.price),
    currency: stringValue(record.currency),
    purchaseQuantity: nonNegativeNumber(record.purchaseQuantity),
    purchaseUnit: stringValue(record.purchaseUnit),
    effectiveAt: stringValue(record.effectiveAt),
    recordedAt: stringValue(record.recordedAt),
    sourceReference: stringValue(record.sourceReference),
    approvalState: approvalState(record.approvalState),
  };
}

function parseSpecificationPublishPayload(
  value: unknown,
  allowRename = false,
): SpecificationPublishPayload {
  const record = recordValue(value);
  if ((!allowRename && record.rename !== undefined) || record.redirectId !== undefined) invalid();
  const payload: SpecificationPublishPayload = {};
  if (record.mappings !== undefined) payload.mappings = arrayValue(record.mappings, parseMapping);
  if (record.costObservations !== undefined) {
    payload.costObservations = arrayValue(record.costObservations, parseCostObservation);
  }
  if (record.usableYields !== undefined) {
    payload.usableYields = arrayValue(record.usableYields, parseUsableYield);
  }
  return payload;
}

function parseLinkIngredientPublishPayload(value: unknown): LinkIngredientPublishPayload {
  const record = recordValue(value);
  if (record.redirectId !== undefined) invalid();
  const payload: LinkIngredientPublishPayload = parseSpecificationPublishPayload(record, true);
  if (record.rename !== undefined) {
    const rename = recordValue(record.rename);
    payload.rename = {
      ingredientId: identity(rename.ingredientId),
      primaryName: stringValue(rename.primaryName),
      alias: parseAlias(rename.alias),
    };
  }
  return payload;
}

function parseMergeRedirectPublishPayload(value: unknown): MergeRedirectPublishPayload {
  const record = recordValue(value);
  if (record.rename !== undefined || record.mappings !== undefined ||
    record.costObservations !== undefined || record.usableYields !== undefined) invalid();
  return { redirectId: identity(record.redirectId) };
}

function optionalSpecificationPublishPayload(record: Record<string, unknown>):
  | { publish: SpecificationPublishPayload }
  | Record<string, never> {
  return record.publish === undefined ? {} : {
    publish: parseSpecificationPublishPayload(record.publish),
  };
}

function optionalLinkPublishPayload(record: Record<string, unknown>):
  | { publish: LinkIngredientPublishPayload }
  | Record<string, never> {
  return record.publish === undefined ? {} : {
    publish: parseLinkIngredientPublishPayload(record.publish),
  };
}

function optionalRedirectPublishPayload(record: Record<string, unknown>):
  | { publish: MergeRedirectPublishPayload }
  | Record<string, never> {
  return record.publish === undefined ? {} : {
    publish: parseMergeRedirectPublishPayload(record.publish),
  };
}

function parseReconciliationAction(value: unknown): ReconciliationAction {
  const record = recordValue(value);
  switch (record.type) {
    case "create_ingredient":
      return {
        type: "create_ingredient",
        ingredient: parseIngredient(record.ingredient),
        firstSpecification: parseSpecification(record.firstSpecification),
        ...optionalSpecificationPublishPayload(record),
      };
    case "create_specification":
      return {
        type: "create_specification",
        specification: parseSpecification(record.specification),
        ...optionalSpecificationPublishPayload(record),
      };
    case "link_ingredient":
      return {
        type: "link_ingredient",
        ingredientId: identity(record.ingredientId),
        requiredSpecificationId: nullableIdentity(record.requiredSpecificationId),
        ...optionalLinkPublishPayload(record),
      };
    case "merge_redirect":
      return {
        type: "merge_redirect",
        fromIngredientId: identity(record.fromIngredientId),
        toIngredientId: identity(record.toIngredientId),
        ...optionalRedirectPublishPayload(record),
      };
    case "link_component_recipe":
      if (record.publish !== undefined) invalid();
      return {
        type: "link_component_recipe",
        componentRecipeId: identity(record.componentRecipeId),
      };
    case "mark_unmapped":
      if (record.publish !== undefined) invalid();
      return {
        type: "mark_unmapped",
        reason: stringValue(record.reason),
      };
    default:
      return invalid();
  }
}

export function parseReconciliationDecision(value: unknown): ReconciliationDecision {
  const record = recordValue(value);
  return {
    decisionId: identity(record.decisionId),
    proposalId: identity(record.proposalId),
    manifestId: identity(record.manifestId),
    sourceSha256: sha256(record.sourceSha256),
    sourceRecordId: identity(record.sourceRecordId),
    decidedBy: identity(record.decidedBy),
    decidedAt: stringValue(record.decidedAt),
    note: stringValue(record.note),
    approvalState: approvedOrRejected(record.approvalState),
    action: parseReconciliationAction(record.action),
  };
}

function parseRecipeLineLink(value: unknown): RecipeLineLink {
  const record = recordValue(value);
  switch (record.state) {
    case "ingredient":
      return {
        state: "ingredient",
        recipeId: identity(record.recipeId),
        lineId: identity(record.lineId),
        ingredientId: identity(record.ingredientId),
        requiredSpecificationId: nullableIdentity(record.requiredSpecificationId),
        historicalLabel: stringValue(record.historicalLabel),
      };
    case "component":
      return {
        state: "component",
        recipeId: identity(record.recipeId),
        lineId: identity(record.lineId),
        componentRecipeId: identity(record.componentRecipeId),
        historicalLabel: stringValue(record.historicalLabel),
      };
    case "unmapped":
      return {
        state: "unmapped",
        recipeId: identity(record.recipeId),
        lineId: identity(record.lineId),
        sourceRecordId: identity(record.sourceRecordId),
        reason: stringValue(record.reason),
        historicalLabel: stringValue(record.historicalLabel),
      };
    default:
      return invalid();
  }
}

function assertUnique<T>(records: T[], id: (record: T) => string): void {
  if (new Set(records.map(id)).size !== records.length) invalid();
}

function validateReferences(snapshot: IngredientMasterSnapshot): void {
  const manifests = new Map(snapshot.sourceManifests.map((manifest) => [manifest.manifestId, manifest]));
  const ingredientIds = new Set(snapshot.ingredients.map(({ ingredientId }) => ingredientId));
  const specificationIds = new Set(snapshot.specifications.map(({ specificationId }) => specificationId));
  const decisionIds = new Set(snapshot.reconciliationDecisions.map(({ decisionId }) => decisionId));
  const sourceRecordKeys = new Set(snapshot.legacySourceRecords.map(({ manifestId, sourceSha256, sourceRecordId }) =>
    JSON.stringify([manifestId, sourceSha256, sourceRecordId])));

  if (snapshot.legacySourceRecords.some(({ manifestId, sourceSha256 }) =>
    manifests.get(manifestId)?.sha256 !== sourceSha256)) invalid();
  if (snapshot.specifications.some(({ ingredientId }) => !ingredientIds.has(ingredientId))) invalid();
  if (snapshot.aliases.some(({ ingredientId }) => !ingredientIds.has(ingredientId))) invalid();
  if (snapshot.redirects.some(({ fromIngredientId, toIngredientId, decisionId }) =>
    !ingredientIds.has(fromIngredientId) || !ingredientIds.has(toIngredientId) || !decisionIds.has(decisionId))) invalid();
  if (snapshot.mappings.some(({ specificationId }) => !specificationIds.has(specificationId))) invalid();
  if (snapshot.unitConversions.some(({ specificationId }) => !specificationIds.has(specificationId))) invalid();
  if (snapshot.usableYields.some(({ specificationId }) => !specificationIds.has(specificationId))) invalid();
  if (snapshot.costObservations.some(({ specificationId }) => !specificationIds.has(specificationId))) invalid();
  if (snapshot.reconciliationDecisions.some(({ manifestId, sourceSha256, sourceRecordId }) =>
    manifests.get(manifestId)?.sha256 !== sourceSha256 ||
    !sourceRecordKeys.has(JSON.stringify([manifestId, sourceSha256, sourceRecordId])))) invalid();

  const mappedSpecifications = new Map<string, string>();
  for (const mapping of snapshot.mappings) {
    const previous = mappedSpecifications.get(mapping.stockItemId);
    if (previous !== undefined && previous !== mapping.specificationId) invalid();
    mappedSpecifications.set(mapping.stockItemId, mapping.specificationId);
  }

  for (const ingredient of snapshot.ingredients) {
    if (ingredient.costingState === "requires_specification" &&
      !snapshot.specifications.some((specification) =>
        specification.ingredientId === ingredient.ingredientId && specification.approvalState === "approved")) invalid();
  }

  for (const link of snapshot.recipeLineLinks) {
    const identityIssue = validateRecipeLineLink(link, snapshot).some(({ code }) =>
      code === "UNKNOWN_INGREDIENT" ||
      code === "UNKNOWN_SPECIFICATION" ||
      code === "SPECIFICATION_INGREDIENT_MISMATCH");
    if (identityIssue) invalid();
  }
}

function validateStableIds(snapshot: IngredientMasterSnapshot): void {
  assertUnique(snapshot.sourceManifests, ({ manifestId }) => manifestId);
  assertUnique(snapshot.legacySourceRecords, ({ stagingId }) => stagingId);
  assertUnique(snapshot.ingredients, ({ ingredientId }) => ingredientId);
  assertUnique(snapshot.specifications, ({ specificationId }) => specificationId);
  assertUnique(snapshot.aliases, ({ aliasId }) => aliasId);
  assertUnique(snapshot.redirects, ({ redirectId }) => redirectId);
  assertUnique(snapshot.redirects, ({ fromIngredientId }) => fromIngredientId);
  assertUnique(snapshot.mappings, ({ mappingId }) => mappingId);
  assertUnique(snapshot.unitConversions, ({ conversionId }) => conversionId);
  assertUnique(snapshot.usableYields, ({ yieldEvidenceId }) => yieldEvidenceId);
  assertUnique(snapshot.costObservations, ({ observationId }) => observationId);
  assertUnique(snapshot.reconciliationDecisions, ({ decisionId }) => decisionId);
  const lineIdsByRecipe = new Map<string, Set<string>>();
  for (const { recipeId, lineId } of snapshot.recipeLineLinks) {
    const lineIds = lineIdsByRecipe.get(recipeId) ?? new Set<string>();
    if (lineIds.has(lineId)) invalid();
    lineIds.add(lineId);
    lineIdsByRecipe.set(recipeId, lineIds);
  }
}

export function parseIngredientMaster(value: unknown): IngredientMasterSnapshot {
  const record = recordValue(value);
  if (record.schemaVersion !== "1.0.0") invalid();

  const snapshot: IngredientMasterSnapshot = {
    schemaVersion: "1.0.0",
    generatedAt: stringValue(record.generatedAt),
    sourceManifests: arrayValue(record.sourceManifests, parseSourceManifest),
    legacySourceRecords: arrayValue(record.legacySourceRecords, parseLegacySourceRecord),
    ingredients: arrayValue(record.ingredients, parseIngredient),
    specifications: arrayValue(record.specifications, parseSpecification),
    aliases: arrayValue(record.aliases, parseAlias),
    redirects: arrayValue(record.redirects, parseRedirect),
    mappings: arrayValue(record.mappings, parseMapping),
    unitConversions: arrayValue(record.unitConversions, parseUnitConversion),
    usableYields: arrayValue(record.usableYields, parseUsableYield),
    costObservations: arrayValue(record.costObservations, parseCostObservation),
    reconciliationDecisions: arrayValue(record.reconciliationDecisions, parseReconciliationDecision),
    recipeLineLinks: arrayValue(record.recipeLineLinks, parseRecipeLineLink),
  };

  validateStableIds(snapshot);
  validateReferences(snapshot);
  return snapshot;
}
