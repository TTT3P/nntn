import type { RecipeCatalogEntry } from "../catalog/recipeCatalog.ts";
import type {
  KitchenSotBlocker,
  KitchenSotDocument,
  KitchenSotItem,
  KitchenSotRecipe,
  RecipeIdentity,
} from "../sot/kitchenSotDocument.ts";
import { parseCookbookV6 } from "./parseCookbookV6.ts";
import type {
  CookbookV6BlockerEvidence,
  CookbookV6Document,
  CookbookV6IngredientLine,
  CookbookV6MethodStep,
  CookbookV6Recipe,
  CookbookV6Stage,
  CookbookV6WorkDocument,
  V5RecipeCrosswalkEntry,
} from "./types.ts";

const V5_PATH = "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json";
const STAGES: CookbookV6Stage[] = ["prep", "cook", "service"];
const SAFE_UNIT_SUFFIXES = [
  "กิโลกรัม", "มิลลิลิตร", "ช้อนโต๊ะ", "ช้อนชา", "กระป๋อง",
  "กรัม", "ลิตร", "ถ้วย", "ทัพพี", "ฟอง", "ชิ้น", "กลีบ",
  "ขวด", "ซอง", "ถุง", "หม้อ", "จาน", "ชุด", "แว่น", "หัว",
  "ลูก", "ใบ", "กำ", "kg", "ml", "g",
].sort((left, right) => right.length - left.length);

function identityKey(identity: RecipeIdentity): string {
  return typeof identity === "number" ? `number:${String(identity)}` : `string:${identity}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function nullableText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseCrosswalk(value: unknown): V5RecipeCrosswalkEntry[] {
  if (!Array.isArray(value) || value.length !== 19) throw new Error("INVALID_V5_CROSSWALK");
  const entries = value.map((entry): V5RecipeCrosswalkEntry => {
    if (!isRecord(entry)) throw new Error("INVALID_V5_CROSSWALK");
    const sourceRecipeId = entry.sourceRecipeId;
    if (!((typeof sourceRecipeId === "number" && Number.isFinite(sourceRecipeId)) || (typeof sourceRecipeId === "string" && sourceRecipeId.length > 0))) {
      throw new Error("INVALID_V5_CROSSWALK");
    }
    if (typeof entry.targetRecipeId !== "string" || entry.targetRecipeId.length === 0) throw new Error("INVALID_V5_CROSSWALK");
    if (entry.catalogCode !== null && (typeof entry.catalogCode !== "string" || entry.catalogCode.length === 0)) throw new Error("INVALID_V5_CROSSWALK");
    return { sourceRecipeId, targetRecipeId: entry.targetRecipeId, catalogCode: entry.catalogCode };
  });
  if (
    new Set(entries.map(({ sourceRecipeId }) => identityKey(sourceRecipeId))).size !== entries.length ||
    new Set(entries.map(({ targetRecipeId }) => targetRecipeId)).size !== entries.length
  ) {
    throw new Error("INVALID_V5_CROSSWALK");
  }
  return entries;
}

function splitQuantity(sourceDisplayText: string): { amountText: string; unitText: string } {
  for (const unitText of SAFE_UNIT_SUFFIXES) {
    const suffix = ` ${unitText}`;
    if (!sourceDisplayText.endsWith(suffix)) continue;
    const amountText = sourceDisplayText.slice(0, -suffix.length);
    if (amountText.length > 0 && `${amountText}${suffix}` === sourceDisplayText) {
      return { amountText, unitText };
    }
  }
  return { amountText: sourceDisplayText, unitText: "" };
}

export function formatV6Quantity(line: Pick<CookbookV6IngredientLine, "amountText" | "unitText">): string {
  return line.unitText.length === 0 ? line.amountText : `${line.amountText} ${line.unitText}`;
}

function itemKind(item: KitchenSotItem): CookbookV6IngredientLine["kind"] {
  return item.item_kind === "prepared_recipe" ? "prepared_recipe" : "ingredient";
}

function migrateItem(
  item: KitchenSotItem,
  targetBySourceIdentity: ReadonlyMap<string, string>,
): CookbookV6IngredientLine {
  const sourceDisplayText = item.candidate_text ?? "";
  const quantity = splitQuantity(sourceDisplayText);
  const sourceComponentId = item.component_recipe_id;
  const componentRecipeId = sourceComponentId === null
    ? null
    : targetBySourceIdentity.get(identityKey(sourceComponentId));
  if (sourceComponentId !== null && componentRecipeId === undefined) {
    throw new Error("UNMAPPED_V5_COMPONENT");
  }
  return {
    lineId: item.line_key,
    name: item.item_name,
    kind: itemKind(item),
    amountText: quantity.amountText,
    unitText: quantity.unitText,
    sourceDisplayText,
    ingredientId: null,
    componentRecipeId: componentRecipeId ?? null,
    servingNote: nullableText(item.serving_note),
    costBasisText: nullableText(item.cost_basis_text),
    decisionStatus: item.decision_status,
    selectedSource: item.selected_source,
    active: !item.decision_status.startsWith("removed_"),
  };
}

function migrateBlocker(blocker: KitchenSotBlocker): CookbookV6BlockerEvidence {
  return {
    code: blocker.code,
    message: blocker.message,
    resolved: blocker.resolved === true,
    resolvedNote: blocker.resolved_note ?? "",
    resolvedAt: blocker.resolved_at ?? "",
  };
}

function migrateWorkDocuments(recipe: KitchenSotRecipe): {
  methodSteps: CookbookV6MethodStep[];
  workDocuments: CookbookV6Recipe["workDocuments"];
} {
  const rawDocuments = isRecord(recipe.work_documents) ? recipe.work_documents : {};
  const stepsById = new Map<string, CookbookV6MethodStep>();
  const workDocuments: CookbookV6Recipe["workDocuments"] = {};
  for (const stage of STAGES) {
    const rawDocument = rawDocuments[stage];
    if (!isRecord(rawDocument)) continue;
    const rawSteps = Array.isArray(rawDocument.steps) ? rawDocument.steps : [];
    const stepIds: string[] = [];
    for (const [stepIndex, rawStep] of rawSteps.entries()) {
      if (typeof rawStep !== "string") {
        throw new Error("INVALID_V5_WORK_STEP");
      }
      const step: CookbookV6MethodStep = {
        stepId: `${recipe.recipe_version_id}:${stage}:${String(stepIndex + 1)}`,
        stage,
        instruction: rawStep,
        order: stepIndex + 1,
      };
      const existing = stepsById.get(step.stepId);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(step)) {
        throw new Error("DUPLICATE_V5_WORK_STEP");
      }
      stepsById.set(step.stepId, step);
      stepIds.push(step.stepId);
    }
    const document: CookbookV6WorkDocument = {
      stage,
      scalable: rawDocument.scalable === true,
      ingredientLineIds: strings(rawDocument.ingredient_line_keys),
      stepIds,
    };
    workDocuments[stage] = document;
  }
  const stageOrder = new Map(STAGES.map((stage, index) => [stage, index]));
  return {
    methodSteps: [...stepsById.values()].sort((left, right) =>
      (stageOrder.get(left.stage)! - stageOrder.get(right.stage)!) || left.order - right.order),
    workDocuments,
  };
}

function catalogRecipe(entry: RecipeCatalogEntry): CookbookV6Recipe {
  return {
    recipeId: entry.code,
    code: entry.code,
    name: entry.name,
    kind: entry.kind,
    category: "",
    active: true,
    reviewState: "waiting_for_kitchen",
    sourceLocators: [],
    yieldText: "",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [],
    methodSteps: [],
    blockers: [],
    workDocuments: {},
    parentRecipeIds: [],
    lineage: { source: "catalog", sourceRecipeId: null },
  };
}

function migrateRecipe(
  source: KitchenSotRecipe,
  crosswalk: V5RecipeCrosswalkEntry,
  catalogEntry: RecipeCatalogEntry | undefined,
  targetBySourceIdentity: ReadonlyMap<string, string>,
): CookbookV6Recipe {
  if (crosswalk.catalogCode !== null && catalogEntry === undefined) throw new Error("UNKNOWN_CATALOG_TARGET");
  const work = migrateWorkDocuments(source);
  const parentIds = Array.isArray(source.parent_recipe_ids)
    ? source.parent_recipe_ids.map((parentId) => {
        if (typeof parentId !== "string" && typeof parentId !== "number") throw new Error("INVALID_V5_PARENT");
        const target = targetBySourceIdentity.get(identityKey(parentId));
        if (target === undefined) throw new Error("UNMAPPED_V5_PARENT");
        return target;
      })
    : [];
  return {
    recipeId: crosswalk.targetRecipeId,
    code: crosswalk.catalogCode,
    name: source.recipe_name,
    kind: catalogEntry?.kind ?? source.recipe_type,
    category: "",
    active: true,
    reviewState: source.review_state,
    sourceLocators: strings(source.source_locators),
    yieldText: source.yield_candidate_text ?? "",
    operationalNotes: strings(source.operational_notes),
    methodDecisionNote: source.method_decision_note ?? "",
    ingredients: source.items.map((item) => migrateItem(item, targetBySourceIdentity)),
    methodSteps: work.methodSteps,
    blockers: source.blockers.map(migrateBlocker),
    workDocuments: work.workDocuments,
    parentRecipeIds: parentIds,
    lineage: { source: "v5", sourceRecipeId: source.recipe_id },
  };
}

export function migrateV5ToV6({
  catalog,
  v5,
  crosswalk: rawCrosswalk,
  v5Sha256,
  catalogSha256,
  generatedAt,
}: {
  catalog: readonly RecipeCatalogEntry[];
  v5: KitchenSotDocument;
  crosswalk: unknown;
  v5Sha256: string;
  catalogSha256: string;
  generatedAt: string;
}): CookbookV6Document {
  const crosswalk = parseCrosswalk(rawCrosswalk);
  if (v5.recipes.length !== crosswalk.length) throw new Error("V5_CROSSWALK_COUNT_MISMATCH");
  const catalogByCode = new Map(catalog.map((entry) => [entry.code, entry]));
  const targetBySourceIdentity = new Map(crosswalk.map((entry) => [identityKey(entry.sourceRecipeId), entry.targetRecipeId]));
  const sourceByIdentity = new Map(v5.recipes.map((recipe) => [identityKey(recipe.recipe_id), recipe]));
  const migratedByCatalogCode = new Map<string, CookbookV6Recipe>();
  const v5OnlyRecipes: CookbookV6Recipe[] = [];
  for (const entry of crosswalk) {
    const source = sourceByIdentity.get(identityKey(entry.sourceRecipeId));
    if (source === undefined) throw new Error("UNKNOWN_V5_RECIPE");
    const migrated = migrateRecipe(
      source,
      entry,
      entry.catalogCode === null ? undefined : catalogByCode.get(entry.catalogCode),
      targetBySourceIdentity,
    );
    if (entry.catalogCode === null) v5OnlyRecipes.push(migrated);
    else migratedByCatalogCode.set(entry.catalogCode, migrated);
  }
  const document: CookbookV6Document = {
    schemaVersion: "6.0.0",
    generatedAt,
    derivedFrom: { v5Path: V5_PATH, v5Sha256, catalogSha256 },
    recipes: [
      ...catalog.map((entry) => migratedByCatalogCode.get(entry.code) ?? catalogRecipe(entry)),
      ...v5OnlyRecipes,
    ],
  };
  for (const recipe of document.recipes) {
    for (const line of recipe.ingredients) {
      if (formatV6Quantity(line) !== line.sourceDisplayText) throw new Error("QUANTITY_ROUND_TRIP_FAILED");
    }
  }
  return parseCookbookV6(document);
}
