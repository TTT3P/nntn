import type { LegacyStagingBatch } from "./legacyIngredientSnapshot";
import {
  parseIngredientMaster,
  parseReconciliationDecision,
} from "./parseIngredientMaster";
import type {
  CostObservation,
  IngredientMasterSnapshot,
  LegacySourceRecord,
  ReconciliationAction,
  ReconciliationDecision,
  ReconciliationPublishPayload,
  UsableYieldEvidence,
} from "./types";

export interface PublishIssue {
  code: string;
  decisionId?: string;
  sourceRecordId?: string;
}

export class IngredientPublishError extends Error {
  readonly issues: readonly PublishIssue[];

  constructor(issue: PublishIssue) {
    super(issue.code);
    this.name = "IngredientPublishError";
    this.issues = [issue];
  }
}

export interface PublishResult {
  snapshot: IngredientMasterSnapshot;
  alreadyAppliedDecisionIds: string[];
}

function fail(code: string, decision?: ReconciliationDecision): never {
  throw new IngredientPublishError({
    code,
    ...(decision === undefined ? {} : {
      decisionId: decision.decisionId,
      sourceRecordId: decision.sourceRecordId,
    }),
  });
}

function bytes(value: unknown): string {
  return JSON.stringify(value);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function appendById<T>(
  records: T[],
  incoming: T,
  idOf: (record: T) => string,
  conflictCode: string,
  decision?: ReconciliationDecision,
): void {
  const existing = records.find((record) => idOf(record) === idOf(incoming));
  if (existing === undefined) {
    records.push(structuredClone(incoming));
    return;
  }
  if (bytes(existing) !== bytes(incoming)) fail(conflictCode, decision);
}

function sourceKey(record: LegacySourceRecord): string {
  return JSON.stringify([
    record.manifestId,
    record.sourceSha256,
    record.recordType,
    record.sourceRecordId,
  ]);
}

function resolveSource(
  snapshot: IngredientMasterSnapshot,
  decision: ReconciliationDecision,
): LegacySourceRecord {
  const matches = snapshot.legacySourceRecords.filter((record) =>
    record.manifestId === decision.manifestId &&
    record.sourceSha256 === decision.sourceSha256 &&
    record.sourceRecordId === decision.sourceRecordId);
  return matches.length === 1 ? matches[0]! : fail("INVALID_RECONCILIATION_PUBLISH", decision);
}

function rawRecord(source: LegacySourceRecord): Record<string, unknown> | null {
  return source.raw !== null && typeof source.raw === "object" && !Array.isArray(source.raw)
    ? source.raw as Record<string, unknown>
    : null;
}

function validateLegacyCostObservation(
  observation: CostObservation,
  source: LegacySourceRecord,
  decision: ReconciliationDecision,
): void {
  const rawPrice = rawRecord(source)?.cost_per_unit_v1;
  if (typeof rawPrice !== "number" || !Number.isFinite(rawPrice) || rawPrice < 0 ||
    observation.price !== rawPrice || observation.approvalState !== "pending") {
    fail("INVALID_LEGACY_COST_OBSERVATION", decision);
  }
}

function validateLegacyYield(
  evidence: UsableYieldEvidence,
  source: LegacySourceRecord,
  decision: ReconciliationDecision,
): void {
  if (rawRecord(source)?.yield_pct_v1 !== 1 || evidence.factor !== 1 ||
    evidence.approvalState !== "pending") {
    fail("INVALID_LEGACY_YIELD_EVIDENCE", decision);
  }
}

function applyPublishPayload(
  snapshot: IngredientMasterSnapshot,
  payload: ReconciliationPublishPayload | undefined,
  source: LegacySourceRecord,
  decision: ReconciliationDecision,
): void {
  if (payload === undefined) return;

  if (payload.rename !== undefined) {
    const ingredient = snapshot.ingredients.find(({ ingredientId }) =>
      ingredientId === payload.rename!.ingredientId);
    if (ingredient === undefined || ingredient.primaryName !== payload.rename.alias.text ||
      payload.rename.primaryName.trim() === "" ||
      payload.rename.alias.ingredientId !== ingredient.ingredientId ||
      payload.rename.alias.sourceRecordId !== decision.sourceRecordId) {
      fail("INVALID_RENAME", decision);
    }
    ingredient.primaryName = payload.rename.primaryName;
    appendById(snapshot.aliases, payload.rename.alias, ({ aliasId }) => aliasId,
      "ALIAS_ID_CONFLICT", decision);
  }

  for (const mapping of payload.mappings ?? []) {
    const specification = snapshot.specifications.find(({ specificationId }) =>
      specificationId === mapping.specificationId);
    if (mapping.approvalState !== "approved" || specification?.status !== "active" ||
      specification.approvalState !== "approved") {
      fail("INVALID_STOCK_MAPPING", decision);
    }
    appendById(snapshot.mappings, mapping, ({ mappingId }) => mappingId,
      "MAPPING_ID_CONFLICT", decision);
  }

  for (const observation of payload.costObservations ?? []) {
    validateLegacyCostObservation(observation, source, decision);
    appendById(snapshot.costObservations, observation, ({ observationId }) => observationId,
      "APPEND_ONLY_CONFLICT", decision);
  }

  for (const evidence of payload.usableYields ?? []) {
    validateLegacyYield(evidence, source, decision);
    appendById(snapshot.usableYields, evidence, ({ yieldEvidenceId }) => yieldEvidenceId,
      "APPEND_ONLY_CONFLICT", decision);
  }
}

function validateRedirect(
  snapshot: IngredientMasterSnapshot,
  action: Extract<ReconciliationAction, { type: "merge_redirect" }>,
  decision: ReconciliationDecision,
): void {
  const ingredientIds = new Set(snapshot.ingredients.map(({ ingredientId }) => ingredientId));
  if (action.fromIngredientId === action.toIngredientId ||
    !ingredientIds.has(action.fromIngredientId) || !ingredientIds.has(action.toIngredientId) ||
    action.publish?.redirectId === undefined) {
    fail("INVALID_RECONCILIATION_PUBLISH", decision);
  }
  const targets = new Map(snapshot.redirects.map(({ fromIngredientId, toIngredientId }) =>
    [fromIngredientId, toIngredientId]));
  let target: string | undefined = action.toIngredientId;
  const visited = new Set<string>();
  while (target !== undefined) {
    if (target === action.fromIngredientId || visited.has(target)) {
      fail("INVALID_RECONCILIATION_PUBLISH", decision);
    }
    visited.add(target);
    target = targets.get(target);
  }
}

function validateAndApplyApproved(
  snapshot: IngredientMasterSnapshot,
  decision: ReconciliationDecision,
  source: LegacySourceRecord,
): void {
  const action = decision.action;
  const ingredients = new Map(snapshot.ingredients.map((ingredient) => [ingredient.ingredientId, ingredient]));
  const specifications = new Map(snapshot.specifications.map((specification) =>
    [specification.specificationId, specification]));

  switch (action.type) {
    case "create_ingredient":
      if (ingredients.has(action.ingredient.ingredientId) ||
        specifications.has(action.firstSpecification.specificationId) ||
        action.firstSpecification.ingredientId !== action.ingredient.ingredientId ||
        action.firstSpecification.approvalState !== "approved") {
        fail("INVALID_RECONCILIATION_PUBLISH", decision);
      }
      snapshot.ingredients.push(structuredClone(action.ingredient));
      snapshot.specifications.push(structuredClone(action.firstSpecification));
      break;
    case "create_specification":
      if (!ingredients.has(action.specification.ingredientId) ||
        specifications.has(action.specification.specificationId)) {
        fail("INVALID_RECONCILIATION_PUBLISH", decision);
      }
      snapshot.specifications.push(structuredClone(action.specification));
      break;
    case "link_ingredient": {
      const ingredient = ingredients.get(action.ingredientId);
      if (ingredient === undefined || ingredient.status !== "active") {
        fail("INVALID_RECONCILIATION_PUBLISH", decision);
      }
      if (action.requiredSpecificationId !== null) {
        const specification = specifications.get(action.requiredSpecificationId);
        if (specification?.ingredientId !== action.ingredientId ||
          specification.approvalState !== "approved") {
          fail("INVALID_RECONCILIATION_PUBLISH", decision);
        }
        if (specification.status !== "active") fail("INACTIVE_SPECIFICATION", decision);
      }
      break;
    }
    case "merge_redirect":
      validateRedirect(snapshot, action, decision);
      appendById(snapshot.redirects, {
        redirectId: action.publish!.redirectId!,
        fromIngredientId: action.fromIngredientId,
        toIngredientId: action.toIngredientId,
        decisionId: decision.decisionId,
      }, ({ redirectId }) => redirectId, "REDIRECT_ID_CONFLICT", decision);
      break;
    case "link_component_recipe":
      if (action.componentRecipeId.trim() === "") fail("INVALID_RECONCILIATION_PUBLISH", decision);
      break;
    case "mark_unmapped":
      if (action.reason.trim() === "") fail("INVALID_RECONCILIATION_PUBLISH", decision);
      break;
  }

  applyPublishPayload(snapshot, action.publish, source, decision);
}

function validateRejected(
  snapshot: IngredientMasterSnapshot,
  decision: ReconciliationDecision,
  source: LegacySourceRecord,
): void {
  validateAndApplyApproved(structuredClone(snapshot), decision, source);
}

function sortSnapshot(snapshot: IngredientMasterSnapshot): void {
  snapshot.sourceManifests.sort((left, right) => compareText(left.manifestId, right.manifestId));
  snapshot.legacySourceRecords.sort((left, right) => compareText(left.stagingId, right.stagingId));
  snapshot.ingredients.sort((left, right) => compareText(left.ingredientId, right.ingredientId));
  snapshot.specifications.sort((left, right) => compareText(left.specificationId, right.specificationId));
  snapshot.aliases.sort((left, right) => compareText(left.aliasId, right.aliasId));
  snapshot.redirects.sort((left, right) => compareText(left.redirectId, right.redirectId));
  snapshot.mappings.sort((left, right) => compareText(left.mappingId, right.mappingId));
  snapshot.unitConversions.sort((left, right) => compareText(left.conversionId, right.conversionId));
  snapshot.usableYields.sort((left, right) => compareText(left.yieldEvidenceId, right.yieldEvidenceId));
  snapshot.costObservations.sort((left, right) => compareText(left.observationId, right.observationId));
  snapshot.reconciliationDecisions.sort((left, right) => compareText(left.decisionId, right.decisionId));
  snapshot.recipeLineLinks.sort((left, right) =>
    compareText(left.recipeId, right.recipeId) || compareText(left.lineId, right.lineId));
}

export function publishReconciliationBatch(
  current: IngredientMasterSnapshot,
  staging: LegacyStagingBatch,
  decisions: readonly ReconciliationDecision[],
): PublishResult {
  let next: IngredientMasterSnapshot;
  try {
    next = parseIngredientMaster(current);
  } catch {
    return fail("INVALID_RECONCILIATION_PUBLISH");
  }

  for (const record of staging.records) {
    const existing = next.legacySourceRecords.find(({ stagingId }) => stagingId === record.stagingId);
    if (existing === undefined) {
      next.legacySourceRecords.push(structuredClone(record));
    } else if (sourceKey(existing) !== sourceKey(record) || bytes(existing.raw) !== bytes(record.raw)) {
      fail("STAGING_ID_CONFLICT");
    }
  }

  const alreadyAppliedDecisionIds: string[] = [];
  const sortedDecisions = [...decisions].sort((left, right) => compareText(left.decisionId, right.decisionId));
  const suppliedIds = new Map<string, string>();
  for (const supplied of sortedDecisions) {
    const rawSuppliedBytes = bytes(supplied);
    const priorSuppliedBytes = suppliedIds.get(supplied.decisionId);
    if (priorSuppliedBytes !== undefined) {
      if (priorSuppliedBytes !== rawSuppliedBytes) fail("DECISION_ID_CONFLICT", supplied);
      continue;
    }
    suppliedIds.set(supplied.decisionId, rawSuppliedBytes);

    const existing = next.reconciliationDecisions.find(({ decisionId }) =>
      decisionId === supplied.decisionId);
    if (existing !== undefined) {
      if (bytes(existing) !== rawSuppliedBytes) fail("DECISION_ID_CONFLICT", supplied);
      alreadyAppliedDecisionIds.push(supplied.decisionId);
      continue;
    }

    let decision: ReconciliationDecision;
    try {
      decision = parseReconciliationDecision(supplied);
    } catch {
      fail("INVALID_RECONCILIATION_PUBLISH", supplied);
    }

    const source = resolveSource(next, decision);
    if (decision.approvalState === "approved") {
      validateAndApplyApproved(next, decision, source);
    } else {
      validateRejected(next, decision, source);
    }
    next.reconciliationDecisions.push(decision);
  }

  if (sortedDecisions.some((decision) =>
    !alreadyAppliedDecisionIds.includes(decision.decisionId))) {
    next.generatedAt = sortedDecisions.reduce((latest, decision) =>
      compareText(decision.decidedAt, latest) > 0 ? decision.decidedAt : latest, next.generatedAt);
  }
  sortSnapshot(next);
  try {
    next = parseIngredientMaster(next);
  } catch {
    fail("INVALID_INGREDIENT_MASTER_SNAPSHOT");
  }
  alreadyAppliedDecisionIds.sort(compareText);
  return { snapshot: next, alreadyAppliedDecisionIds };
}
