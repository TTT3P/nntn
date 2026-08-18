import type {
  ApprovalState,
  RecipeLineDecisionEvidence,
  RecipeLineLink,
  RecordStatus,
} from "./types";

export interface RelinkRecipeLine {
  readonly lineId: string;
  readonly name: string;
  readonly kind: "ingredient" | "prepared_recipe";
  readonly amountText: string;
  readonly unitText: string;
  readonly sourceDisplayText: string;
  readonly ingredientId: unknown;
  readonly componentRecipeId: unknown;
  readonly servingNote: string;
  readonly active: boolean;
}

export interface RelinkRecipeDocument {
  readonly schemaVersion: "6.0.0";
  readonly generatedAt: string;
  readonly derivedFrom: {
    readonly v5Path: string;
    readonly v5Sha256: string;
    readonly catalogSha256: string;
  };
  readonly recipes: readonly {
    readonly recipeId: string;
    readonly active: boolean;
    readonly ingredients: readonly RelinkRecipeLine[];
  }[];
}

export type RecipeRelinkDecision = RecipeLineDecisionEvidence;

export interface RecipeRelinkDecisionSet {
  readonly sourceSha256: string;
  readonly sourceManifest: DirectLineClosureManifest;
  readonly actualSourceManifest: DirectLineClosureManifest;
  readonly decisions: readonly RecipeRelinkDecision[];
  readonly ingredients: readonly {
    readonly ingredientId: string;
    readonly primaryName: string;
    readonly status: RecordStatus;
  }[];
  readonly specifications: readonly {
    readonly specificationId: string;
    readonly ingredientId: string;
    readonly label: string;
    readonly status: RecordStatus;
    readonly approvalState: ApprovalState;
  }[];
}

export type RecipeRelinkIssueCode =
  | "DUPLICATE_ACTIVE_SOURCE_LINE"
  | "DUPLICATE_INGREDIENT_ID"
  | "DUPLICATE_RECIPE_ID"
  | "DUPLICATE_RELINK_DECISION"
  | "DUPLICATE_RELINK_DECISION_ID"
  | "DUPLICATE_SPECIFICATION_ID"
  | "HISTORICAL_ONLY_RELINK_DECISION"
  | "INACTIVE_INGREDIENT_REPLACEMENT_REQUIRED"
  | "INACTIVE_SPECIFICATION_REPLACEMENT_REQUIRED"
  | "INVALID_COMPONENT_PAYLOAD"
  | "INVALID_RELINK_ACTION"
  | "INVALID_RELINK_ACTION_PAYLOAD"
  | "MISSING_COMPONENT_RECIPE"
  | "MISSING_RELINK_DECISION"
  | "SOURCE_REVISION_MISMATCH"
  | "SOURCE_MANIFEST_MISMATCH"
  | "SPECIFICATION_INGREDIENT_MISMATCH"
  | "UNAPPROVED_RELINK_DECISION"
  | "UNAPPROVED_SPECIFICATION"
  | "UNKNOWN_INGREDIENT"
  | "UNKNOWN_SPECIFICATION"
  | "UNUSED_RELINK_DECISION";

export interface RecipeRelinkIssue {
  readonly code: RecipeRelinkIssueCode;
  readonly sourceSha256: string;
  readonly recipeId: string;
  readonly lineId: string;
  readonly decisionId?: string;
  readonly ingredientId?: string;
  readonly specificationId?: string;
  readonly componentRecipeId?: string;
}

export type RelinkedRecipeLine = RecipeLineLink;

export interface DirectLineClosureManifest {
  readonly manifestId: string;
  readonly sourceSha256: string;
  readonly directLineCount: number;
}

export interface RecipeRelinkResult {
  readonly links: RelinkedRecipeLine[];
  readonly sourceLines: Array<{ recipeId: string; line: RelinkRecipeLine }>;
  readonly issues: RecipeRelinkIssue[];
}

export class RecipeRelinkError extends Error {
  readonly issues: readonly RecipeRelinkIssue[];

  constructor(issues: readonly RecipeRelinkIssue[]) {
    super("RECIPE_RELINK_FAILED");
    this.name = "RecipeRelinkError";
    this.issues = issues;
  }
}

function key(sourceSha256: string, recipeId: string, lineId: string): string {
  return JSON.stringify([sourceSha256, recipeId, lineId]);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function sortIssues(issues: RecipeRelinkIssue[]): void {
  issues.sort((left, right) =>
    compareText(left.sourceSha256, right.sourceSha256) ||
    compareText(left.recipeId, right.recipeId) ||
    compareText(left.lineId, right.lineId) ||
    compareText(left.code, right.code) ||
    compareText(left.decisionId ?? "", right.decisionId ?? ""));
}

function issue(
  code: RecipeRelinkIssueCode,
  sourceSha256: string,
  recipeId: string,
  lineId: string,
  decision?: RecipeRelinkDecision,
  details: Pick<RecipeRelinkIssue, "ingredientId" | "specificationId" | "componentRecipeId"> = {},
): RecipeRelinkIssue {
  return {
    code,
    sourceSha256,
    recipeId,
    lineId,
    ...(decision === undefined ? {} : { decisionId: decision.decisionId }),
    ...details,
  };
}

function commonLink(
  recipeId: string,
  line: RelinkRecipeLine,
  decision: RecipeRelinkDecision,
) {
  return {
    recipeId,
    lineId: line.lineId,
    historicalLabel: line.name,
    amountText: line.amountText,
    unitText: line.unitText,
    sourceDisplayText: line.sourceDisplayText,
    servingNote: line.servingNote,
    decisionEvidence: structuredClone(decision),
  };
}

function duplicateValues(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function hasExactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === allowed.length && keys.every((entry) =>
    typeof entry === "string" && allowed.includes(entry));
}

function actionHasExactKeys(action: RecipeRelinkDecision["action"]): boolean {
  switch (action.type) {
    case "link_ingredient":
      return hasExactKeys(action, ["type", "ingredientId", "requiredSpecificationId"]);
    case "link_component_recipe":
      return hasExactKeys(action, ["type", "componentRecipeId"]);
    case "mark_unmapped":
      return hasExactKeys(action, ["type", "reason"]);
    default:
      return false;
  }
}

export function relinkRecipeIngredients(
  document: RelinkRecipeDocument,
  decisionSet: RecipeRelinkDecisionSet,
): RecipeRelinkResult {
  if (decisionSet.sourceSha256 !== decisionSet.actualSourceManifest.sourceSha256 ||
    decisionSet.actualSourceManifest.sourceSha256 !== document.derivedFrom.v5Sha256) {
    throw new RecipeRelinkError([issue(
      "SOURCE_REVISION_MISMATCH",
      decisionSet.sourceSha256,
      "",
      "",
    )]);
  }
  const links: RelinkedRecipeLine[] = [];
  const sourceLines: Array<{ recipeId: string; line: RelinkRecipeLine }> = [];
  const issues: RecipeRelinkIssue[] = [];
  const fatalIssues: RecipeRelinkIssue[] = [];
  const decisionByLine = new Map<string, RecipeRelinkDecision>();
  const consumedDecisionIds = new Set<string>();

  if (decisionSet.sourceManifest.sourceSha256 !== decisionSet.sourceSha256) {
    fatalIssues.push(issue("SOURCE_MANIFEST_MISMATCH", decisionSet.sourceSha256, "", ""));
  }
  for (const duplicate of duplicateValues(
    decisionSet.decisions.map(({ decisionId }) => decisionId),
  )) {
    const decision = decisionSet.decisions.find(({ decisionId }) => decisionId === duplicate)!;
    fatalIssues.push(issue("DUPLICATE_RELINK_DECISION_ID", decision.sourceSha256,
      decision.recipeId, decision.lineId, decision));
  }
  for (const duplicate of duplicateValues(
    decisionSet.ingredients.map(({ ingredientId }) => ingredientId),
  )) {
    fatalIssues.push(issue("DUPLICATE_INGREDIENT_ID", decisionSet.sourceSha256, "", "",
      undefined, { ingredientId: duplicate }));
  }
  for (const duplicate of duplicateValues(
    decisionSet.specifications.map(({ specificationId }) => specificationId),
  )) {
    fatalIssues.push(issue("DUPLICATE_SPECIFICATION_ID", decisionSet.sourceSha256, "", "",
      undefined, { specificationId: duplicate }));
  }
  for (const duplicate of duplicateValues(document.recipes.map(({ recipeId }) => recipeId))) {
    fatalIssues.push(issue("DUPLICATE_RECIPE_ID", decisionSet.sourceSha256, duplicate, ""));
  }
  const activeDirectLineKeys = document.recipes.flatMap((recipe) =>
    recipe.active
      ? recipe.ingredients
        .filter(({ kind, active }) => kind === "ingredient" && active)
        .map(({ lineId }) => key(decisionSet.sourceSha256, recipe.recipeId, lineId))
      : []);
  for (const duplicate of duplicateValues(activeDirectLineKeys)) {
    const [, recipeId, lineId] = JSON.parse(duplicate) as [string, string, string];
    fatalIssues.push(issue("DUPLICATE_ACTIVE_SOURCE_LINE", decisionSet.sourceSha256,
      recipeId, lineId));
  }
  for (const decision of decisionSet.decisions) {
    if (!actionHasExactKeys(decision.action)) {
      fatalIssues.push(issue("INVALID_RELINK_ACTION_PAYLOAD", decision.sourceSha256,
        decision.recipeId, decision.lineId, decision));
    }
    if (decision.manifestId !== decisionSet.actualSourceManifest.manifestId) {
      fatalIssues.push(issue("SOURCE_MANIFEST_MISMATCH", decision.sourceSha256,
        decision.recipeId, decision.lineId, decision));
    }
  }

  sortIssues(fatalIssues);
  if (fatalIssues.length > 0) throw new RecipeRelinkError(fatalIssues);

  for (const decision of decisionSet.decisions) {
    const decisionKey = key(decision.sourceSha256, decision.recipeId, decision.lineId);
    const existing = decisionByLine.get(decisionKey);
    if (existing !== undefined) {
      fatalIssues.push(issue(
        "DUPLICATE_RELINK_DECISION",
        decision.sourceSha256,
        decision.recipeId,
        decision.lineId,
        decision,
      ));
      continue;
    }
    decisionByLine.set(decisionKey, decision);
  }

  const ingredients = new Map(decisionSet.ingredients.map((ingredient) =>
    [ingredient.ingredientId, ingredient]));
  const specifications = new Map(decisionSet.specifications.map((specification) =>
    [specification.specificationId, specification]));
  const recipeIds = new Set(document.recipes.map(({ recipeId }) => recipeId));

  for (const recipe of document.recipes) {
    for (const sourceLine of recipe.ingredients) {
      if (sourceLine.kind !== "ingredient") continue;
      const line = structuredClone(sourceLine);
      sourceLines.push({ recipeId: recipe.recipeId, line });

      const decision = decisionByLine.get(key(
        decisionSet.sourceSha256,
        recipe.recipeId,
        sourceLine.lineId,
      ));
      if (!recipe.active || !sourceLine.active) {
        if (decision !== undefined) {
          consumedDecisionIds.add(decision.decisionId);
          issues.push(issue("HISTORICAL_ONLY_RELINK_DECISION", decisionSet.sourceSha256,
            recipe.recipeId, sourceLine.lineId, decision));
        }
        continue;
      }
      if (decision === undefined) {
        fatalIssues.push(issue(
          "MISSING_RELINK_DECISION",
          decisionSet.sourceSha256,
          recipe.recipeId,
          sourceLine.lineId,
        ));
        continue;
      }

      consumedDecisionIds.add(decision.decisionId);
      if (decision.approvalState !== "approved") {
        fatalIssues.push(issue(
          "UNAPPROVED_RELINK_DECISION",
          decisionSet.sourceSha256,
          recipe.recipeId,
          sourceLine.lineId,
          decision,
        ));
        continue;
      }

      const common = commonLink(recipe.recipeId, sourceLine, decision);
      const action = decision.action;
      if (action.type === "link_ingredient") {
        const ingredient = ingredients.get(action.ingredientId);
        if (ingredient === undefined) {
          fatalIssues.push(issue("UNKNOWN_INGREDIENT", decisionSet.sourceSha256,
            recipe.recipeId, sourceLine.lineId, decision, { ingredientId: action.ingredientId }));
          continue;
        }
        if (ingredient.status === "inactive") {
          issues.push(issue("INACTIVE_INGREDIENT_REPLACEMENT_REQUIRED",
            decisionSet.sourceSha256, recipe.recipeId, sourceLine.lineId, decision,
            { ingredientId: action.ingredientId }));
        }
        if (action.requiredSpecificationId !== null) {
          const specification = specifications.get(action.requiredSpecificationId);
          if (specification === undefined) {
            fatalIssues.push(issue("UNKNOWN_SPECIFICATION", decisionSet.sourceSha256,
              recipe.recipeId, sourceLine.lineId, decision,
              { specificationId: action.requiredSpecificationId }));
            continue;
          }
          if (specification.ingredientId !== action.ingredientId) {
            fatalIssues.push(issue("SPECIFICATION_INGREDIENT_MISMATCH",
              decisionSet.sourceSha256, recipe.recipeId, sourceLine.lineId, decision,
              { ingredientId: action.ingredientId, specificationId: action.requiredSpecificationId }));
            continue;
          }
          if (specification.approvalState !== "approved") {
            fatalIssues.push(issue("UNAPPROVED_SPECIFICATION", decisionSet.sourceSha256,
              recipe.recipeId, sourceLine.lineId, decision,
              { specificationId: action.requiredSpecificationId }));
            continue;
          }
          if (specification.status === "inactive") {
            issues.push(issue("INACTIVE_SPECIFICATION_REPLACEMENT_REQUIRED",
              decisionSet.sourceSha256, recipe.recipeId, sourceLine.lineId, decision,
              { specificationId: action.requiredSpecificationId }));
          }
        }
        links.push({
          state: "ingredient",
          ...common,
          ingredientId: action.ingredientId,
          requiredSpecificationId: action.requiredSpecificationId,
        });
        continue;
      }

      if (action.type === "link_component_recipe") {
        if (!recipeIds.has(action.componentRecipeId)) {
          fatalIssues.push(issue("MISSING_COMPONENT_RECIPE", decisionSet.sourceSha256,
            recipe.recipeId, sourceLine.lineId, decision,
            { componentRecipeId: action.componentRecipeId }));
          continue;
        }
        links.push({
          state: "component",
          ...common,
          componentRecipeId: action.componentRecipeId,
        });
        continue;
      }

      if (action.type === "mark_unmapped") {
        if (action.reason.trim().length === 0) {
          fatalIssues.push(issue("INVALID_RELINK_ACTION", decisionSet.sourceSha256,
            recipe.recipeId, sourceLine.lineId, decision));
          continue;
        }
        links.push({
          state: "unmapped",
          ...common,
          sourceRecordId: decision.sourceRecordId,
          reason: action.reason,
        });
        continue;
      }

      fatalIssues.push(issue("INVALID_RELINK_ACTION", decisionSet.sourceSha256,
        recipe.recipeId, sourceLine.lineId, decision));
    }
  }

  for (const decision of decisionSet.decisions) {
    if (!consumedDecisionIds.has(decision.decisionId)) {
      fatalIssues.push(issue("UNUSED_RELINK_DECISION", decision.sourceSha256,
        decision.recipeId, decision.lineId, decision));
    }
  }

  sortIssues(fatalIssues);
  if (fatalIssues.length > 0) throw new RecipeRelinkError(fatalIssues);
  sortIssues(issues);
  if (decisionSet.actualSourceManifest.directLineCount !== activeDirectLineKeys.length) {
    throw new Error("RECIPE_LINE_CLOSURE_FAILED");
  }
  assertManifestDirectLineClosure(
    decisionSet.sourceManifest,
    decisionSet.actualSourceManifest,
    links,
  );
  return { links, sourceLines, issues };
}

export function assertDirectLineClosure(expected: number, links: RecipeLineLink[]): void {
  if (links.length !== expected || new Set(links.map((link) =>
    JSON.stringify([link.recipeId, link.lineId]))).size !== expected) {
    throw new Error("RECIPE_LINE_CLOSURE_FAILED");
  }
}

export function assertManifestDirectLineClosure(
  expected: DirectLineClosureManifest,
  actual: DirectLineClosureManifest,
  links: RecipeLineLink[],
): void {
  if (expected.manifestId !== actual.manifestId ||
    expected.sourceSha256 !== actual.sourceSha256 ||
    expected.directLineCount !== actual.directLineCount) {
    throw new Error("RECIPE_LINE_CLOSURE_FAILED");
  }
  assertDirectLineClosure(expected.directLineCount, links);
}
