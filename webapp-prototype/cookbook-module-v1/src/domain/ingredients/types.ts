export type RecordStatus = "active" | "inactive";
export type ApprovalState = "pending" | "approved" | "rejected";

export interface CookbookIngredient {
  ingredientId: string;
  primaryName: string;
  category: string;
  status: RecordStatus;
  costingState: "not_costed" | "requires_specification";
}

export interface IngredientSpecification {
  specificationId: string;
  ingredientId: string;
  label: string;
  attributes: Record<string, string>;
  status: RecordStatus;
  approvalState: ApprovalState;
}

export interface IngredientAlias {
  aliasId: string;
  ingredientId: string;
  text: string;
  sourceRecordId: string;
}

export interface IngredientMapping {
  mappingId: string;
  specificationId: string;
  stockItemId: string;
  approvalState: ApprovalState;
}

export interface IngredientRedirect {
  redirectId: string;
  fromIngredientId: string;
  toIngredientId: string;
  decisionId: string;
}

export type RecipeLineLink =
  | { state: "ingredient"; recipeId: string; lineId: string; ingredientId: string; requiredSpecificationId: string | null; historicalLabel: string }
  | { state: "component"; recipeId: string; lineId: string; componentRecipeId: string; historicalLabel: string }
  | { state: "unmapped"; recipeId: string; lineId: string; sourceRecordId: string; reason: string; historicalLabel: string };

export interface SourceManifest {
  manifestId: string;
  sourcePath: string;
  sha256: string;
  byteLength: number;
  extractedAt: string;
  sourcePolicy: string;
  expectedCounts: Record<string, number>;
}

export interface LegacySourceRecord {
  stagingId: string;
  manifestId: string;
  sourceSha256: string;
  recordType: "ingredient" | "recipe" | "recipe_line";
  sourceRecordId: string;
  raw: unknown;
}

export interface UnitConversionEvidence {
  conversionId: string;
  specificationId: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  sourceReference: string;
  approvalState: ApprovalState;
}

export interface UsableYieldEvidence {
  yieldEvidenceId: string;
  specificationId: string;
  mode: "no_adjustment" | "usable_yield";
  factor: number;
  sourceReference: string;
  approvalState: ApprovalState;
}

export interface CostObservation {
  observationId: string;
  specificationId: string;
  stockItemId: string | null;
  price: number;
  currency: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  effectiveAt: string;
  recordedAt: string;
  sourceReference: string;
  approvalState: ApprovalState;
}

export interface ReconciliationPublishPayload {
  rename?: {
    ingredientId: string;
    primaryName: string;
    alias: IngredientAlias;
  };
  redirectId?: string;
  mappings?: IngredientMapping[];
  costObservations?: CostObservation[];
  usableYields?: UsableYieldEvidence[];
}

export type ReconciliationAction =
  | { type: "create_ingredient"; ingredient: CookbookIngredient; firstSpecification: IngredientSpecification; publish?: ReconciliationPublishPayload }
  | { type: "create_specification"; specification: IngredientSpecification; publish?: ReconciliationPublishPayload }
  | { type: "link_ingredient"; ingredientId: string; requiredSpecificationId: string | null; publish?: ReconciliationPublishPayload }
  | { type: "merge_redirect"; fromIngredientId: string; toIngredientId: string; publish?: ReconciliationPublishPayload }
  | { type: "link_component_recipe"; componentRecipeId: string; publish?: ReconciliationPublishPayload }
  | { type: "mark_unmapped"; reason: string; publish?: ReconciliationPublishPayload };

export interface ReconciliationProposal {
  proposalId: string;
  manifestId: string;
  sourceSha256: string;
  sourceRecordId: string;
  actionType: ReconciliationAction["type"];
  suggestedTargetId: string | null;
  evidence: Array<{ label: string; value: string }>;
  consequences: string[];
}

export interface ReconciliationDecision {
  decisionId: string;
  proposalId: string;
  manifestId: string;
  sourceSha256: string;
  sourceRecordId: string;
  decidedBy: string;
  decidedAt: string;
  note: string;
  approvalState: Exclude<ApprovalState, "pending">;
  action: ReconciliationAction;
}

export interface IngredientMasterSnapshot {
  schemaVersion: "1.0.0";
  generatedAt: string;
  sourceManifests: SourceManifest[];
  legacySourceRecords: LegacySourceRecord[];
  ingredients: CookbookIngredient[];
  specifications: IngredientSpecification[];
  aliases: IngredientAlias[];
  redirects: IngredientRedirect[];
  mappings: IngredientMapping[];
  unitConversions: UnitConversionEvidence[];
  usableYields: UsableYieldEvidence[];
  costObservations: CostObservation[];
  reconciliationDecisions: ReconciliationDecision[];
  recipeLineLinks: RecipeLineLink[];
}
