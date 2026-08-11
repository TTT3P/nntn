import type {
  CostObservation,
  IngredientMasterSnapshot,
  RecipeLineLink,
  UsableYieldEvidence,
} from "./types.ts";

export type DomainIssueCode =
  | "MISSING_YIELD_EVIDENCE"
  | "UNAPPROVED_YIELD_EVIDENCE"
  | "INVALID_YIELD_FACTOR"
  | "MISSING_YIELD_SOURCE"
  | "UNKNOWN_INGREDIENT"
  | "MISSING_COSTING_SPECIFICATION"
  | "UNKNOWN_SPECIFICATION"
  | "SPECIFICATION_INGREDIENT_MISMATCH"
  | "UNAPPROVED_SPECIFICATION"
  | "INACTIVE_SPECIFICATION"
  | "UNMAPPED_RECIPE_LINE";

export interface DomainIssue {
  code: DomainIssueCode;
}

export function exactMetricFactor(fromUnit: string, toUnit: string): number | null {
  if (fromUnit === "kg" && toUnit === "g") return 1000;
  if (fromUnit === "g" && toUnit === "kg") return 0.001;
  if (fromUnit === "L" && toUnit === "ml") return 1000;
  if (fromUnit === "ml" && toUnit === "L") return 0.001;
  return null;
}

export function validateYieldEvidence(
  evidence: UsableYieldEvidence | null | undefined,
): DomainIssue[] {
  if (evidence == null) return [{ code: "MISSING_YIELD_EVIDENCE" }];

  const issues: DomainIssue[] = [];
  if (evidence.approvalState !== "approved") {
    issues.push({ code: "UNAPPROVED_YIELD_EVIDENCE" });
  }

  const validFactor = evidence.mode === "no_adjustment"
    ? evidence.factor === 1
    : evidence.factor > 0 && evidence.factor <= 1;
  if (!validFactor) issues.push({ code: "INVALID_YIELD_FACTOR" });

  if (evidence.mode === "usable_yield" && evidence.sourceReference.trim().length === 0) {
    issues.push({ code: "MISSING_YIELD_SOURCE" });
  }

  return issues;
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function selectEffectiveObservation(
  observations: readonly CostObservation[],
  snapshotAt: string,
): CostObservation | null {
  const snapshotTime = Date.parse(snapshotAt);
  if (!Number.isFinite(snapshotTime)) return null;

  const eligible = observations.filter((observation) => {
    const effectiveTime = Date.parse(observation.effectiveAt);
    const recordedTime = Date.parse(observation.recordedAt);
    return observation.approvalState === "approved" &&
      Number.isFinite(effectiveTime) &&
      Number.isFinite(recordedTime) &&
      effectiveTime <= snapshotTime &&
      recordedTime <= snapshotTime;
  });

  eligible.sort((left, right) =>
    Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt) ||
    Date.parse(right.recordedAt) - Date.parse(left.recordedAt) ||
    compareText(right.observationId, left.observationId));

  return eligible[0] ?? null;
}

export function validateRecipeLineLink(
  link: RecipeLineLink,
  snapshot: IngredientMasterSnapshot,
): DomainIssue[] {
  if (link.state === "component") return [];
  if (link.state === "unmapped") return [{ code: "UNMAPPED_RECIPE_LINE" }];

  const ingredient = snapshot.ingredients.find(({ ingredientId }) =>
    ingredientId === link.ingredientId);
  if (ingredient === undefined) return [{ code: "UNKNOWN_INGREDIENT" }];
  if (link.requiredSpecificationId === null) {
    return [{ code: "MISSING_COSTING_SPECIFICATION" }];
  }

  const specification = snapshot.specifications.find(({ specificationId }) =>
    specificationId === link.requiredSpecificationId);
  if (specification === undefined) return [{ code: "UNKNOWN_SPECIFICATION" }];
  if (specification.ingredientId !== ingredient.ingredientId) {
    return [{ code: "SPECIFICATION_INGREDIENT_MISMATCH" }];
  }

  const issues: DomainIssue[] = [];
  if (specification.approvalState !== "approved") {
    issues.push({ code: "UNAPPROVED_SPECIFICATION" });
  }
  if (specification.status === "inactive") {
    issues.push({ code: "INACTIVE_SPECIFICATION" });
  }
  return issues;
}
