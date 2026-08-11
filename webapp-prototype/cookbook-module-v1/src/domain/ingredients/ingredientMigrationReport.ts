import {
  exactMetricFactor,
  selectEffectiveObservation,
  validateYieldEvidence,
} from "./ingredientPolicy";
import { parseIngredientMaster } from "./parseIngredientMaster";
import { buildReconciliationQueue } from "./reconciliation";
import type {
  IngredientMasterSnapshot,
  RecipeLineLink,
  ReconciliationProposal,
} from "./types";

export interface ExpectedSourceCounts {
  direct: number;
  component: number;
  total: number;
}

export type ExpectedBySource = Readonly<Record<string, ExpectedSourceCounts>>;

export interface MigrationSourceCounts extends ExpectedSourceCounts {
  mapped: number;
  unmapped: number;
}

export interface MappedMigrationLine {
  recipeId: string;
  lineId: string;
  state: "ingredient" | "component";
  targetId: string;
}

export interface UnmappedMigrationLine {
  recipeId: string;
  lineId: string;
  sourceRecordId: string;
  reason: string;
}

export interface ResolvedDuplicate {
  redirectId: string;
  fromIngredientId: string;
  toIngredientId: string;
  decisionId: string;
}

export interface InactiveMigrationRecord {
  recordType: "ingredient" | "specification";
  recordId: string;
}

export interface MissingPriceEvidence {
  recipeId: string;
  lineId: string;
  specificationId: string;
  reason: "MISSING_PRICE_EVIDENCE";
}

export interface MissingConversionEvidence {
  recipeId: string;
  lineId: string;
  specificationId: string;
  fromUnit: string;
  toUnit: string;
  reason: "MISSING_CONVERSION_EVIDENCE";
}

export interface MissingYieldEvidence {
  recipeId: string;
  lineId: string;
  specificationId: string;
  reason: "MISSING_YIELD_EVIDENCE";
}

export interface IngredientMigrationReport {
  sourceCounts: Record<string, MigrationSourceCounts>;
  mapped: MappedMigrationLine[];
  unmapped: UnmappedMigrationLine[];
  duplicateCandidates: ReconciliationProposal[];
  resolvedDuplicates: ResolvedDuplicate[];
  inactive: InactiveMigrationRecord[];
  missingPrices: MissingPriceEvidence[];
  missingConversions: MissingConversionEvidence[];
  missingYields: MissingYieldEvidence[];
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareLine(
  left: Pick<RecipeLineLink, "recipeId" | "lineId">,
  right: Pick<RecipeLineLink, "recipeId" | "lineId">,
): number {
  return compareText(left.recipeId, right.recipeId) || compareText(left.lineId, right.lineId);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort(compareText).map((key) =>
    [key, canonicalize((value as Record<string, unknown>)[key])]));
}

function canonicalizeLegacySourceRecord(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return canonicalize(value);
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort(compareText).map((key) =>
    [key, key === "raw" ? record[key] : canonicalize(record[key])]));
}

function canonicalExportProjection(snapshot: IngredientMasterSnapshot): unknown {
  const record = snapshot as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort(compareText).map((key) => {
    if (key === "legacySourceRecords") {
      const records = record[key] as unknown[];
      return [key, records.map(canonicalizeLegacySourceRecord)];
    }
    return [key, canonicalize(record[key])];
  }));
}

export function serializeIngredientMaster(snapshot: IngredientMasterSnapshot): string {
  const parsed = parseIngredientMaster(snapshot);
  return `${JSON.stringify(canonicalExportProjection(parsed), null, 2)}\n`;
}

function mappedLine(link: Exclude<RecipeLineLink, { state: "unmapped" }>): MappedMigrationLine {
  return {
    recipeId: link.recipeId,
    lineId: link.lineId,
    state: link.state,
    targetId: link.state === "ingredient" ? link.ingredientId : link.componentRecipeId,
  };
}

function sourceClosureFailure(): never {
  throw new Error("INGREDIENT_MIGRATION_SOURCE_CLOSURE_FAILED");
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function verifySourceClosure(
  snapshot: IngredientMasterSnapshot,
  expectedBySource: ExpectedBySource,
): Record<string, MigrationSourceCounts> {
  const manifestIds = snapshot.sourceManifests.map(({ manifestId }) => manifestId);
  const manifestIdSet = new Set(manifestIds);
  const expectedIds = Object.keys(expectedBySource);
  if (manifestIdSet.size !== manifestIds.length ||
    expectedIds.length !== manifestIds.length ||
    expectedIds.some((manifestId) => !manifestIdSet.has(manifestId))) {
    sourceClosureFailure();
  }

  const manifests = new Map(snapshot.sourceManifests.map((manifest) =>
    [manifest.manifestId, manifest]));
  const seenLinksByManifest = new Map<string, Set<string>>();
  const observed = new Map<string, { mapped: number; unmapped: number }>(
    manifestIds.map((manifestId) => [manifestId, { mapped: 0, unmapped: 0 }]),
  );

  for (const link of snapshot.recipeLineLinks) {
    const manifest = manifests.get(link.decisionEvidence.manifestId);
    if (manifest === undefined || manifest.sha256 !== link.decisionEvidence.sourceSha256) {
      sourceClosureFailure();
    }
    const identity = JSON.stringify([link.recipeId, link.lineId]);
    const seen = seenLinksByManifest.get(manifest.manifestId) ?? new Set<string>();
    if (seen.has(identity)) sourceClosureFailure();
    seen.add(identity);
    seenLinksByManifest.set(manifest.manifestId, seen);
    const counts = observed.get(manifest.manifestId)!;
    if (link.state === "unmapped") counts.unmapped += 1;
    else counts.mapped += 1;
  }

  for (const manifestId of manifestIds) {
    const expected = expectedBySource[manifestId];
    const manifest = manifests.get(manifestId)!;
    if (expected === undefined ||
      !validCount(expected.direct) ||
      !validCount(expected.component) ||
      !validCount(expected.total) ||
      expected.direct + expected.component !== expected.total ||
      !validCount(manifest.expectedCounts.direct_line) ||
      !validCount(manifest.expectedCounts.component_line) ||
      !validCount(manifest.expectedCounts.recipe_line) ||
      manifest.expectedCounts.direct_line + manifest.expectedCounts.component_line !==
        manifest.expectedCounts.recipe_line ||
      expected.direct !== manifest.expectedCounts.direct_line ||
      expected.component !== manifest.expectedCounts.component_line ||
      expected.total !== manifest.expectedCounts.recipe_line) {
      sourceClosureFailure();
    }
    const counts = observed.get(manifestId)!;
    if (counts.mapped + counts.unmapped !== expected.direct) sourceClosureFailure();
  }

  return Object.fromEntries([...manifestIds].sort(compareText).map((manifestId) => {
    const expected = expectedBySource[manifestId]!;
    const counts = observed.get(manifestId)!;
    return [manifestId, { ...expected, ...counts }];
  }));
}

function unresolvedDuplicateCandidates(
  snapshot: IngredientMasterSnapshot,
): ReconciliationProposal[] {
  const proposals = buildReconciliationQueue({ records: snapshot.legacySourceRecords }, snapshot);
  return proposals.filter((proposal) =>
    proposal.actionType === "merge_redirect" &&
    proposal.suggestedTargetId !== null &&
    !snapshot.reconciliationDecisions.some((decision) =>
      decision.approvalState === "approved" &&
      decision.proposalId === proposal.proposalId &&
      decision.manifestId === proposal.manifestId &&
      decision.sourceSha256 === proposal.sourceSha256 &&
      decision.sourceRecordId === proposal.sourceRecordId &&
      decision.action.type === "merge_redirect" &&
      decision.action.toIngredientId === proposal.suggestedTargetId));
}

export function buildIngredientMigrationReport(
  input: IngredientMasterSnapshot,
  expectedBySource: ExpectedBySource,
): IngredientMigrationReport {
  const sourceCounts = verifySourceClosure(input, expectedBySource);
  const snapshot = parseIngredientMaster(input);
  const ingredientLinks = snapshot.recipeLineLinks
    .filter((link): link is Extract<RecipeLineLink, { state: "ingredient" }> =>
      link.state === "ingredient" && link.requiredSpecificationId !== null)
    .sort(compareLine);
  const missingPrices: MissingPriceEvidence[] = [];
  const missingConversions: MissingConversionEvidence[] = [];
  const missingYields: MissingYieldEvidence[] = [];

  for (const link of ingredientLinks) {
    const specificationId = link.requiredSpecificationId!;
    const observations = snapshot.costObservations.filter((observation) =>
      observation.specificationId === specificationId);
    const observation = selectEffectiveObservation(observations, snapshot.generatedAt);
    if (observation === null) {
      missingPrices.push({
        recipeId: link.recipeId,
        lineId: link.lineId,
        specificationId,
        reason: "MISSING_PRICE_EVIDENCE",
      });
    } else {
      const hasConversion = link.unitText === observation.purchaseUnit ||
        exactMetricFactor(link.unitText, observation.purchaseUnit) !== null ||
        snapshot.unitConversions.some((conversion) =>
          conversion.specificationId === specificationId &&
          conversion.fromUnit === link.unitText &&
          conversion.toUnit === observation.purchaseUnit &&
          conversion.approvalState === "approved");
      if (!hasConversion) {
        missingConversions.push({
          recipeId: link.recipeId,
          lineId: link.lineId,
          specificationId,
          fromUnit: link.unitText,
          toUnit: observation.purchaseUnit,
          reason: "MISSING_CONVERSION_EVIDENCE",
        });
      }
    }

    const hasApprovedYield = snapshot.usableYields.some((evidence) =>
      evidence.specificationId === specificationId && validateYieldEvidence(evidence).length === 0);
    if (!hasApprovedYield) {
      missingYields.push({
        recipeId: link.recipeId,
        lineId: link.lineId,
        specificationId,
        reason: "MISSING_YIELD_EVIDENCE",
      });
    }
  }

  return {
    sourceCounts,
    mapped: snapshot.recipeLineLinks
      .filter((link): link is Exclude<RecipeLineLink, { state: "unmapped" }> =>
        link.state !== "unmapped")
      .sort(compareLine)
      .map(mappedLine),
    unmapped: snapshot.recipeLineLinks
      .filter((link): link is Extract<RecipeLineLink, { state: "unmapped" }> =>
        link.state === "unmapped")
      .sort(compareLine)
      .map(({ recipeId, lineId, sourceRecordId, reason }) => ({
        recipeId,
        lineId,
        sourceRecordId,
        reason,
      })),
    duplicateCandidates: unresolvedDuplicateCandidates(snapshot),
    resolvedDuplicates: [...snapshot.redirects]
      .sort((left, right) => compareText(left.redirectId, right.redirectId))
      .map(({ redirectId, fromIngredientId, toIngredientId, decisionId }) => ({
        redirectId,
        fromIngredientId,
        toIngredientId,
        decisionId,
      })),
    inactive: [
      ...snapshot.ingredients
        .filter(({ status }) => status === "inactive")
        .map(({ ingredientId }) => ({
          recordType: "ingredient" as const,
          recordId: ingredientId,
        })),
      ...snapshot.specifications
        .filter(({ status }) => status === "inactive")
        .map(({ specificationId }) => ({
          recordType: "specification" as const,
          recordId: specificationId,
        })),
    ].sort((left, right) =>
      compareText(left.recordType, right.recordType) || compareText(left.recordId, right.recordId)),
    missingPrices,
    missingConversions,
    missingYields,
  };
}
