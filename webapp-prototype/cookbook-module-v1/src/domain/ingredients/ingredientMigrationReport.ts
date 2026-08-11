import {
  exactMetricFactor,
  selectEffectiveObservation,
  validateYieldEvidence,
} from "./ingredientPolicy";
import { parseIngredientMaster } from "./parseIngredientMaster";
import type {
  IngredientMasterSnapshot,
  RecipeLineLink,
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

export interface DuplicateCandidate {
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
  duplicateCandidates: DuplicateCandidate[];
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

function buildSourceCounts(
  links: readonly RecipeLineLink[],
  expectedBySource: ExpectedBySource,
): Record<string, MigrationSourceCounts> {
  return Object.fromEntries(Object.keys(expectedBySource).sort(compareText).map((source) => {
    const expected = expectedBySource[source]!;
    const sourceLinks = links.filter(({ decisionEvidence }) =>
      decisionEvidence.manifestId === source);
    return [source, {
      direct: expected.direct,
      component: expected.component,
      total: expected.total,
      mapped: sourceLinks.filter(({ state }) => state !== "unmapped").length,
      unmapped: sourceLinks.filter(({ state }) => state === "unmapped").length,
    }];
  }));
}

export function buildIngredientMigrationReport(
  input: IngredientMasterSnapshot,
  expectedBySource: ExpectedBySource,
): IngredientMigrationReport {
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
    sourceCounts: buildSourceCounts(snapshot.recipeLineLinks, expectedBySource),
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
    duplicateCandidates: [...snapshot.redirects]
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
