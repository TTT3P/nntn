import {
  cloneKitchenSotDocument,
  type KitchenSotBlocker,
  type KitchenSotDocument,
  type KitchenSotItem,
  type KitchenSotRecipe,
  type RecipeIdentity,
} from "./kitchenSotDocument";

export type KitchenSotEdit =
  | { kind: "item-owner-confirmation"; recipeId: RecipeIdentity; lineKey: string; value: string; confirmedOn: string }
  | { kind: "item-serving-note"; recipeId: RecipeIdentity; lineKey: string; value: string }
  | { kind: "item-cost-basis"; recipeId: RecipeIdentity; lineKey: string; value: string }
  | { kind: "method"; recipeId: RecipeIdentity; value: string; decisionNote: string }
  | { kind: "yield"; recipeId: RecipeIdentity; value: string }
  | {
      kind: "resolve-blocker";
      recipeId: RecipeIdentity;
      blockerIndex: number;
      note: string;
      resolvedAt: string;
      ownerMethodNa?: boolean;
    };

export interface DerivedFrom {
  path: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
  sha256: string;
}

export class InvalidKitchenSotEditError extends Error {
  readonly field: string;
  readonly value: unknown;

  constructor(field: string, value: unknown, message = `Invalid Kitchen SOT edit field ${field}`) {
    super(message);
    this.name = "InvalidKitchenSotEditError";
    this.field = field;
    this.value = value;
  }
}

export class KitchenSotIdentityNotFoundError extends Error {
  readonly identity: unknown;

  constructor(kind: "recipe" | "item" | "blocker", identity: unknown) {
    super(`Kitchen SOT ${kind} identity not found: ${String(identity)}`);
    this.name = "KitchenSotIdentityNotFoundError";
    this.identity = identity;
  }
}

function requireText(value: string, field: string): void {
  if (value.trim() === "") {
    throw new InvalidKitchenSotEditError(field, value);
  }
}

function requireIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new InvalidKitchenSotEditError(field, value);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new InvalidKitchenSotEditError(field, value);
  }
}

function requireIsoTimestamp(value: string, field: string): void {
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u;
  const parsed = new Date(value);
  if (!isoTimestamp.test(value) || Number.isNaN(parsed.valueOf())) {
    throw new InvalidKitchenSotEditError(field, value);
  }
}

function findRecipe(document: KitchenSotDocument, recipeId: RecipeIdentity): KitchenSotRecipe {
  const recipe = document.recipes.find(({ recipe_id }) => recipe_id === recipeId);
  if (!recipe) throw new KitchenSotIdentityNotFoundError("recipe", recipeId);
  return recipe;
}

function findItem(recipe: KitchenSotRecipe, lineKey: string): KitchenSotItem {
  const item = recipe.items.find(({ line_key }) => line_key === lineKey);
  if (!item) throw new KitchenSotIdentityNotFoundError("item", lineKey);
  return item;
}

function findBlocker(recipe: KitchenSotRecipe, blockerIndex: number): KitchenSotBlocker {
  if (!Number.isInteger(blockerIndex) || blockerIndex < 0 || blockerIndex >= recipe.blockers.length) {
    throw new KitchenSotIdentityNotFoundError("blocker", blockerIndex);
  }
  return recipe.blockers[blockerIndex]!;
}

export function applyKitchenSotEdit(
  document: KitchenSotDocument,
  edit: KitchenSotEdit,
): KitchenSotDocument {
  const edited = cloneKitchenSotDocument(document);
  const recipe = findRecipe(edited, edit.recipeId);

  switch (edit.kind) {
    case "item-owner-confirmation": {
      requireText(edit.value, "value");
      requireIsoDate(edit.confirmedOn, "confirmedOn");
      const item = findItem(recipe, edit.lineKey);
      item.source_values.owner_confirmation = edit.value;
      item.candidate_text = edit.value;
      item.selected_source = "owner_confirmation";
      item.decision_status = "confirmed_by_owner";
      item.decision_note = `เจ้าของยืนยันวันที่ ${edit.confirmedOn} ว่า${recipe.recipe_name} ใช้${item.item_name} ${edit.value}`;
      break;
    }
    case "item-serving-note":
      findItem(recipe, edit.lineKey).serving_note = edit.value;
      break;
    case "item-cost-basis":
      findItem(recipe, edit.lineKey).cost_basis_text = edit.value;
      break;
    case "method":
      requireText(edit.value, "value");
      requireText(edit.decisionNote, "decisionNote");
      recipe.method_candidate_text = edit.value;
      recipe.method_selected_source = "owner_confirmation";
      recipe.method_decision_note = edit.decisionNote;
      break;
    case "yield":
      requireText(edit.value, "value");
      recipe.yield_candidate_text = edit.value;
      break;
    case "resolve-blocker": {
      requireText(edit.note, "note");
      requireIsoTimestamp(edit.resolvedAt, "resolvedAt");
      const blocker = findBlocker(recipe, edit.blockerIndex);
      let resolvedNote = edit.note;
      const missingMethod = blocker.code === "missing_method" &&
        (recipe.method_candidate_text === null || recipe.method_candidate_text.trim() === "");
      if (missingMethod) {
        if (edit.ownerMethodNa !== true) {
          throw new InvalidKitchenSotEditError(
            "ownerMethodNa",
            edit.ownerMethodNa,
            "A missing_method blocker with no method requires explicit ownerMethodNa",
          );
        }
        resolvedNote = `เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A): ${edit.note}`;
      }
      blocker.resolved = true;
      blocker.resolved_note = resolvedNote;
      blocker.resolved_at = edit.resolvedAt;
      break;
    }
  }

  return edited;
}

export function buildV5Draft(
  working: KitchenSotDocument,
  generatedAt: string,
  derivedFrom: DerivedFrom,
): KitchenSotDocument {
  requireIsoTimestamp(generatedAt, "generatedAt");
  requireText(derivedFrom.sha256, "derivedFrom.sha256");
  const draft = cloneKitchenSotDocument(working);
  draft.schema_version = "2.1.0-prototype-draft";
  draft.generated_at = generatedAt;
  draft.derived_from = structuredClone(derivedFrom) as unknown as KitchenSotDocument["derived_from"];
  return draft;
}
