import type { LegacyStagingBatch } from "./legacyIngredientSnapshot";
import type {
  IngredientMasterSnapshot,
  LegacySourceRecord,
  ReconciliationAction,
  ReconciliationDecision,
  ReconciliationProposal,
} from "./types";

export interface BulkDecisionEvidence {
  records: readonly LegacySourceRecord[];
  comparisonFields: readonly string[];
}

export interface ReconciliationDecisionInput {
  decisionId: string;
  proposalId: string;
  manifestId: string;
  sourceSha256: string;
  sourceRecordId: string;
  decidedBy: string;
  decidedAt: string;
  note: string;
  approvalState: ReconciliationDecision["approvalState"];
  action: ReconciliationAction;
  snapshot: IngredientMasterSnapshot;
  availableComponentRecipeIds?: readonly string[];
  bulk?: BulkDecisionEvidence;
}

interface CandidateMatch {
  targetId: string;
  label: string;
  value: string;
  score: number;
}

const ACTION_TYPES: readonly ReconciliationAction["type"][] = [
  "create_ingredient",
  "create_specification",
  "link_ingredient",
  "merge_redirect",
  "link_component_recipe",
  "mark_unmapped",
];

const CONSEQUENCES: Readonly<Record<ReconciliationAction["type"], string>> = {
  create_ingredient: "Creates a new Cookbook-owned ingredient and its first reviewed specification only after approval.",
  create_specification: "Adds an owner-reviewed specification beneath an existing ingredient only after approval.",
  link_ingredient: "Links the source to an existing ingredient and optional required specification only after approval.",
  merge_redirect: "Preserves the duplicate identity and records a redirect only after approval.",
  link_component_recipe: "Reclassifies the source as exactly one prepared component recipe only after approval.",
  mark_unmapped: "Keeps the source explicit and unavailable for Food Cost until a later decision resolves it.",
};

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function rawRecord(record: LegacySourceRecord): Record<string, unknown> | null {
  return record.raw !== null && typeof record.raw === "object" && !Array.isArray(record.raw)
    ? record.raw as Record<string, unknown>
    : null;
}

function rawText(raw: Record<string, unknown> | null, keys: readonly string[]): string | null {
  if (raw === null) return null;
  for (const key of keys) {
    const value = raw[key];
    if ((typeof value === "string" || typeof value === "number") && String(value).trim() !== "") {
      return String(value);
    }
  }
  return null;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function findCandidate(
  record: LegacySourceRecord,
  snapshot: IngredientMasterSnapshot,
): CandidateMatch | null {
  const raw = rawRecord(record);
  const name = rawText(raw, ["ingredient_name", "item_name", "name"]);
  const code = rawText(raw, ["ingredient_code", "item_code", "code"]);
  const legacyId = rawText(raw, ["ingredient_id", "legacy_id"]);
  const matches: CandidateMatch[] = [];

  for (const ingredient of snapshot.ingredients) {
    if (name !== null && normalized(ingredient.primaryName) === normalized(name)) {
      matches.push({ targetId: ingredient.ingredientId, label: "exact_name_match", value: name, score: 400 });
    }
    if (legacyId !== null && normalized(ingredient.ingredientId) === normalized(legacyId)) {
      matches.push({ targetId: ingredient.ingredientId, label: "exact_legacy_id_match", value: legacyId, score: 250 });
    }
  }

  for (const alias of snapshot.aliases) {
    if (name !== null && normalized(alias.text) === normalized(name)) {
      matches.push({ targetId: alias.ingredientId, label: "exact_alias_match", value: name, score: 350 });
    }
    if (code !== null && normalized(alias.sourceRecordId) === normalized(code)) {
      matches.push({ targetId: alias.ingredientId, label: "exact_legacy_code_match", value: code, score: 300 });
    }
    if (legacyId !== null && normalized(alias.sourceRecordId) === normalized(legacyId)) {
      matches.push({ targetId: alias.ingredientId, label: "exact_legacy_id_match", value: legacyId, score: 250 });
    }
  }

  matches.sort((left, right) => right.score - left.score || compareText(left.targetId, right.targetId));
  return matches[0] ?? null;
}

function proposalId(
  record: LegacySourceRecord,
  actionType: ReconciliationAction["type"],
): string {
  return `${record.sourceSha256}:${record.recordType}:${record.sourceRecordId}:${actionType}`;
}

function proposalFor(
  record: LegacySourceRecord,
  actionType: ReconciliationAction["type"],
  candidate: CandidateMatch | null,
): ReconciliationProposal {
  const raw = rawRecord(record);
  const componentRecipeId = rawText(raw, ["component_recipe_id", "componentRecipeId"]);
  const targetId = actionType === "link_component_recipe"
    ? componentRecipeId
    : actionType === "create_ingredient" || actionType === "mark_unmapped"
      ? null
      : candidate?.targetId ?? null;
  const evidence = [
    { label: "raw_source", value: JSON.stringify(record.raw) },
    { label: "source_record_id", value: record.sourceRecordId },
    { label: "record_type", value: record.recordType },
  ];
  if (candidate !== null) evidence.push({ label: candidate.label, value: candidate.value });

  return {
    proposalId: proposalId(record, actionType),
    manifestId: record.manifestId,
    sourceSha256: record.sourceSha256,
    sourceRecordId: record.sourceRecordId,
    actionType,
    suggestedTargetId: targetId,
    evidence,
    consequences: [CONSEQUENCES[actionType]],
  };
}

export function buildReconciliationQueue(
  batch: LegacyStagingBatch,
  snapshot: IngredientMasterSnapshot,
): ReconciliationProposal[] {
  const proposals = batch.records
    .filter(({ recordType }) => recordType !== "recipe")
    .flatMap((record) => {
      const candidate = findCandidate(record, snapshot);
      return ACTION_TYPES
        .filter((actionType) => actionType !== "link_component_recipe" || record.recordType === "recipe_line")
        .map((actionType) => ({
          recordType: record.recordType,
          proposal: proposalFor(record, actionType, candidate),
        }));
    });

  proposals.sort((left, right) =>
    compareText(left.proposal.sourceSha256, right.proposal.sourceSha256) ||
    compareText(left.recordType, right.recordType) ||
    compareText(left.proposal.sourceRecordId, right.proposal.sourceRecordId) ||
    compareText(left.proposal.proposalId, right.proposal.proposalId));
  return proposals.map(({ proposal }) => proposal);
}

function invalid(): never {
  throw new Error("INVALID_RECONCILIATION_DECISION");
}

function requireText(value: unknown): void {
  if (typeof value !== "string" || value.trim().length === 0) invalid();
}

function sourceKey(record: Pick<LegacySourceRecord, "manifestId" | "sourceSha256" | "sourceRecordId">): string {
  return JSON.stringify([record.manifestId, record.sourceSha256, record.sourceRecordId]);
}

function fullSourceKey(
  record: Pick<LegacySourceRecord, "manifestId" | "sourceSha256" | "recordType" | "sourceRecordId">,
): string {
  return JSON.stringify([
    record.manifestId,
    record.sourceSha256,
    record.recordType,
    record.sourceRecordId,
  ]);
}

function stagingIdentity(record: LegacySourceRecord): string {
  return typeof record.stagingId === "string" && record.stagingId.trim().length > 0
    ? `staging:${record.stagingId}`
    : `source:${fullSourceKey(record)}`;
}

function validateBulkEvidence(
  bulk: BulkDecisionEvidence | undefined,
  snapshot: IngredientMasterSnapshot,
  proposal: ReconciliationProposal,
): void {
  if (bulk === undefined) return;
  if (bulk.records.length < 2 || bulk.comparisonFields.length === 0 ||
    bulk.comparisonFields.some((field) => field.trim().length === 0)) invalid();

  const recordsByStagingId = new Map<string, LegacySourceRecord>();
  const recordsBySourceKey = new Map<string, LegacySourceRecord>();
  for (const canonical of snapshot.legacySourceRecords) {
    if (typeof canonical.stagingId === "string" && canonical.stagingId.trim().length > 0) {
      if (recordsByStagingId.has(canonical.stagingId)) invalid();
      recordsByStagingId.set(canonical.stagingId, canonical);
    }
    const canonicalSourceKey = fullSourceKey(canonical);
    if (recordsBySourceKey.has(canonicalSourceKey)) invalid();
    recordsBySourceKey.set(canonicalSourceKey, canonical);
  }

  const proposalRecordType = proposal.evidence.find(({ label }) => label === "record_type")?.value;
  const proposalSource = snapshot.legacySourceRecords.find((record) =>
    record.manifestId === proposal.manifestId &&
    record.sourceSha256 === proposal.sourceSha256 &&
    record.recordType === proposalRecordType &&
    record.sourceRecordId === proposal.sourceRecordId);
  if (proposalSource === undefined) invalid();

  const resolvedIdentities = new Set<string>();
  let comparison: string | undefined;
  for (const supplied of bulk.records) {
    const canonical = typeof supplied.stagingId === "string" && supplied.stagingId.trim().length > 0
      ? recordsByStagingId.get(supplied.stagingId)
      : recordsBySourceKey.get(fullSourceKey(supplied));
    if (canonical === undefined ||
      canonical.manifestId !== supplied.manifestId ||
      canonical.sourceSha256 !== supplied.sourceSha256 ||
      canonical.recordType !== supplied.recordType ||
      canonical.sourceRecordId !== supplied.sourceRecordId ||
      JSON.stringify(canonical.raw) !== JSON.stringify(supplied.raw)) invalid();

    const identity = stagingIdentity(canonical);
    if (resolvedIdentities.has(identity)) invalid();
    resolvedIdentities.add(identity);

    const raw = rawRecord(canonical);
    if (raw === null) invalid();
    if (bulk.comparisonFields.some((field) =>
      !Object.prototype.hasOwnProperty.call(raw, field))) invalid();
    const current = JSON.stringify(bulk.comparisonFields.map((field) => ({
      value: raw[field],
    })));
    if (comparison !== undefined && current !== comparison) invalid();
    comparison = current;
  }
  if (!resolvedIdentities.has(stagingIdentity(proposalSource))) invalid();
}

function validateRedirect(
  fromIngredientId: string,
  toIngredientId: string,
  snapshot: IngredientMasterSnapshot,
): void {
  const ingredientIds = new Set(snapshot.ingredients.map(({ ingredientId }) => ingredientId));
  if (fromIngredientId === toIngredientId ||
    !ingredientIds.has(fromIngredientId) || !ingredientIds.has(toIngredientId)) invalid();

  const redirectTargets = new Map(snapshot.redirects.map(({ fromIngredientId: from, toIngredientId: to }) => [from, to]));
  const visited = new Set<string>();
  let current: string | undefined = toIngredientId;
  while (current !== undefined) {
    if (current === fromIngredientId || visited.has(current)) invalid();
    visited.add(current);
    current = redirectTargets.get(current);
  }
}

function validateAction(
  action: ReconciliationAction,
  input: ReconciliationDecisionInput,
): void {
  const { snapshot } = input;
  const ingredientIds = new Set(snapshot.ingredients.map(({ ingredientId }) => ingredientId));
  const specifications = new Map(snapshot.specifications.map((specification) =>
    [specification.specificationId, specification]));

  switch (action.type) {
    case "create_ingredient":
      requireText(action.ingredient.ingredientId);
      requireText(action.firstSpecification.specificationId);
      if (ingredientIds.has(action.ingredient.ingredientId) ||
        specifications.has(action.firstSpecification.specificationId) ||
        action.firstSpecification.ingredientId !== action.ingredient.ingredientId ||
        action.firstSpecification.approvalState !== "approved") invalid();
      return;
    case "create_specification":
      if (!ingredientIds.has(action.specification.ingredientId) ||
        specifications.has(action.specification.specificationId)) invalid();
      return;
    case "link_ingredient": {
      if (!ingredientIds.has(action.ingredientId)) invalid();
      if (action.requiredSpecificationId !== null &&
        specifications.get(action.requiredSpecificationId)?.ingredientId !== action.ingredientId) invalid();
      return;
    }
    case "merge_redirect":
      validateRedirect(action.fromIngredientId, action.toIngredientId, snapshot);
      return;
    case "link_component_recipe":
      if (!(input.availableComponentRecipeIds ?? []).includes(action.componentRecipeId)) invalid();
      return;
    case "mark_unmapped":
      requireText(action.reason);
  }
}

export function recordReconciliationDecision(
  proposal: ReconciliationProposal,
  input: ReconciliationDecisionInput,
): ReconciliationDecision {
  requireText(input.decisionId);
  requireText(input.decidedBy);
  requireText(input.decidedAt);
  requireText(input.note);
  if (input.approvalState !== "approved" && input.approvalState !== "rejected") invalid();
  if (input.action === null || typeof input.action !== "object") invalid();
  if (input.proposalId !== proposal.proposalId ||
    input.manifestId !== proposal.manifestId ||
    input.sourceSha256 !== proposal.sourceSha256 ||
    input.sourceRecordId !== proposal.sourceRecordId ||
    input.action.type !== proposal.actionType) invalid();

  const matchingSource = input.snapshot.legacySourceRecords.some((record) =>
    sourceKey(record) === sourceKey(proposal));
  const matchingManifest = input.snapshot.sourceManifests.some(({ manifestId, sha256 }) =>
    manifestId === proposal.manifestId && sha256 === proposal.sourceSha256);
  if (!matchingSource || !matchingManifest) invalid();

  validateAction(input.action, input);
  validateBulkEvidence(input.bulk, input.snapshot, proposal);

  return {
    decisionId: input.decisionId,
    proposalId: proposal.proposalId,
    manifestId: proposal.manifestId,
    sourceSha256: proposal.sourceSha256,
    sourceRecordId: proposal.sourceRecordId,
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt,
    note: input.note,
    approvalState: input.approvalState,
    action: structuredClone(input.action),
  };
}
