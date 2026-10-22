import {
  legacyStagingId,
  type LegacyStagingBatch,
} from "./legacyIngredientSnapshot";
import {
  parseIngredientMaster,
  parseReconciliationDecision,
} from "./parseIngredientMaster";
import { buildReconciliationQueue } from "./reconciliation";
import type {
  CostObservation,
  IngredientMasterSnapshot,
  LegacySourceRecord,
  LinkIngredientPublishPayload,
  ReconciliationAction,
  ReconciliationDecision,
  SpecificationPublishPayload,
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

function canonicalDecisionBytes(decision: ReconciliationDecision): string {
  function sortObjectKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) =>
      [key, sortObjectKeys((value as Record<string, unknown>)[key])]));
  }

  return JSON.stringify(sortObjectKeys(decision));
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
  const candidates = snapshot.legacySourceRecords.filter((record) =>
    record.manifestId === decision.manifestId &&
    record.sourceSha256 === decision.sourceSha256 &&
    record.sourceRecordId === decision.sourceRecordId);
  const matches = candidates.filter((record) => {
    const batch: LegacyStagingBatch = {
      records: [record],
      ingredients: record.recordType === "ingredient" ? [record] : [],
      recipes: record.recordType === "recipe" ? [record] : [],
      lines: record.recordType === "recipe_line" ? [record] : [],
      directLines: record.recordType === "recipe_line" ? [record] : [],
      componentLines: [],
    };
    return buildReconciliationQueue(batch, snapshot).some((proposal) =>
      proposal.proposalId === decision.proposalId &&
      proposal.actionType === decision.action.type &&
      proposal.manifestId === decision.manifestId &&
      proposal.sourceSha256 === decision.sourceSha256 &&
      proposal.sourceRecordId === decision.sourceRecordId);
  });
  return matches.length === 1 ? matches[0]! : fail("INVALID_RECONCILIATION_PROPOSAL", decision);
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
  payload: LinkIngredientPublishPayload | SpecificationPublishPayload | undefined,
  authorizedIngredientId: string,
  authorizedSpecificationId: string | null,
  source: LegacySourceRecord,
  decision: ReconciliationDecision,
): void {
  if (payload === undefined) return;

  const rename = "rename" in payload ? payload.rename : undefined;
  if (rename !== undefined) {
    if (rename.ingredientId !== authorizedIngredientId) {
      fail("UNAUTHORIZED_PUBLISH_TARGET", decision);
    }
    const ingredient = snapshot.ingredients.find(({ ingredientId }) =>
      ingredientId === rename.ingredientId);
    if (ingredient === undefined || ingredient.primaryName !== rename.alias.text ||
      rename.primaryName.trim() === "" ||
      rename.alias.ingredientId !== ingredient.ingredientId ||
      rename.alias.sourceRecordId !== decision.sourceRecordId) {
      fail("INVALID_RENAME", decision);
    }
    ingredient.primaryName = rename.primaryName;
    appendById(snapshot.aliases, rename.alias, ({ aliasId }) => aliasId,
      "ALIAS_ID_CONFLICT", decision);
  }

  for (const mapping of payload.mappings ?? []) {
    if (authorizedSpecificationId === null ||
      mapping.specificationId !== authorizedSpecificationId) {
      fail("UNAUTHORIZED_PUBLISH_TARGET", decision);
    }
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
    if (authorizedSpecificationId === null ||
      observation.specificationId !== authorizedSpecificationId) {
      fail("UNAUTHORIZED_PUBLISH_TARGET", decision);
    }
    validateLegacyCostObservation(observation, source, decision);
    appendById(snapshot.costObservations, observation, ({ observationId }) => observationId,
      "APPEND_ONLY_CONFLICT", decision);
  }

  for (const evidence of payload.usableYields ?? []) {
    if (authorizedSpecificationId === null ||
      evidence.specificationId !== authorizedSpecificationId) {
      fail("UNAUTHORIZED_PUBLISH_TARGET", decision);
    }
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
  if (snapshot.redirects.some(({ fromIngredientId }) =>
    fromIngredientId === action.fromIngredientId)) {
    fail("DUPLICATE_REDIRECT_SOURCE", decision);
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

  switch (action.type) {
    case "create_ingredient":
      applyPublishPayload(snapshot, action.publish, action.ingredient.ingredientId,
        action.firstSpecification.specificationId, source, decision);
      return;
    case "create_specification":
      applyPublishPayload(snapshot, action.publish, action.specification.ingredientId,
        action.specification.specificationId, source, decision);
      return;
    case "link_ingredient":
      applyPublishPayload(snapshot, action.publish, action.ingredientId,
        action.requiredSpecificationId, source, decision);
      return;
    case "merge_redirect":
    case "link_component_recipe":
    case "mark_unmapped":
      return;
  }
}

function validateRejected(
  snapshot: IngredientMasterSnapshot,
  decision: ReconciliationDecision,
  source: LegacySourceRecord,
): void {
  if ("publish" in decision.action && decision.action.publish !== undefined) {
    fail("UNAUTHORIZED_PUBLISH_SIDE_EFFECT", decision);
  }
  const clone = structuredClone(snapshot);
  if (decision.action.type === "merge_redirect") {
    const action = decision.action;
    const ingredientIds = new Set(clone.ingredients.map(({ ingredientId }) => ingredientId));
    if (action.fromIngredientId === action.toIngredientId ||
      !ingredientIds.has(action.fromIngredientId) || !ingredientIds.has(action.toIngredientId)) {
      fail("INVALID_RECONCILIATION_PUBLISH", decision);
    }
    return;
  }
  validateAndApplyApproved(clone, decision, source);
}

function mergeStagingRecords(
  snapshot: IngredientMasterSnapshot,
  records: readonly LegacySourceRecord[],
): void {
  const existingBySource = new Map<string, LegacySourceRecord>();
  const existingByStaging = new Map<string, LegacySourceRecord>();
  for (const record of snapshot.legacySourceRecords) {
    if (record.stagingId !== legacyStagingId(
      record.sourceSha256,
      record.recordType,
      record.sourceRecordId,
    )) fail("INVALID_STAGING_ID");
    const key = sourceKey(record);
    if (existingBySource.has(key)) fail("DUPLICATE_SOURCE_IDENTITY");
    existingBySource.set(key, record);
    existingByStaging.set(record.stagingId, record);
  }

  const incomingKeys = new Set<string>();
  for (const record of records) {
    if (record.stagingId !== legacyStagingId(
      record.sourceSha256,
      record.recordType,
      record.sourceRecordId,
    )) fail("INVALID_STAGING_ID");
    const key = sourceKey(record);
    if (incomingKeys.has(key)) fail("DUPLICATE_SOURCE_IDENTITY");
    incomingKeys.add(key);

    const sameSource = existingBySource.get(key);
    if (sameSource !== undefined) {
      if (bytes(sameSource) !== bytes(record)) fail("DUPLICATE_SOURCE_IDENTITY");
      continue;
    }
    if (existingByStaging.has(record.stagingId)) fail("STAGING_ID_CONFLICT");
    const clone = structuredClone(record);
    snapshot.legacySourceRecords.push(clone);
    existingBySource.set(key, clone);
    existingByStaging.set(clone.stagingId, clone);
  }
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

  mergeStagingRecords(next, staging.records);

  const alreadyAppliedDecisionIds: string[] = [];
  const sortedDecisions = [...decisions].sort((left, right) => compareText(left.decisionId, right.decisionId));
  const suppliedIds = new Map<string, string>();
  for (const supplied of sortedDecisions) {
    const suppliedAction = supplied.action as ReconciliationAction & { publish?: unknown };
    if (suppliedAction.publish !== undefined &&
      (supplied.approvalState === "rejected" ||
        suppliedAction.type === "mark_unmapped" ||
        suppliedAction.type === "link_component_recipe")) {
      fail("UNAUTHORIZED_PUBLISH_SIDE_EFFECT", supplied);
    }
    let decision: ReconciliationDecision;
    try {
      decision = parseReconciliationDecision(supplied);
    } catch {
      fail("INVALID_RECONCILIATION_PUBLISH", supplied);
    }
    const canonicalSuppliedBytes = canonicalDecisionBytes(decision);
    const priorSuppliedBytes = suppliedIds.get(decision.decisionId);
    if (priorSuppliedBytes !== undefined) {
      if (priorSuppliedBytes !== canonicalSuppliedBytes) fail("DECISION_ID_CONFLICT", decision);
      continue;
    }
    suppliedIds.set(decision.decisionId, canonicalSuppliedBytes);
    const source = resolveSource(next, decision);

    const existing = next.reconciliationDecisions.find(({ decisionId }) =>
      decisionId === decision.decisionId);
    if (existing !== undefined) {
      if (canonicalDecisionBytes(existing) !== canonicalSuppliedBytes) {
        fail("DECISION_ID_CONFLICT", decision);
      }
      alreadyAppliedDecisionIds.push(decision.decisionId);
      continue;
    }

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
