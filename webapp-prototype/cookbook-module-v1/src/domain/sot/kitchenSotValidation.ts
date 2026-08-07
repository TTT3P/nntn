import type {
  JsonValue,
  KitchenSotBlocker,
  KitchenSotDocument,
  KitchenSotItem,
  KitchenSotRecipe,
} from "./kitchenSotDocument";
import { isCanonicalKitchenSotTimestamp, type DerivedFrom } from "./kitchenSotEdits";

const TOP_LEVEL_MUTABLE = new Set(["schema_version", "generated_at", "derived_from"]);
const RECIPE_MUTABLE = new Set([
  "method_candidate_text",
  "method_selected_source",
  "method_decision_note",
  "yield_candidate_text",
]);
const ITEM_MUTABLE = new Set([
  "candidate_text",
  "selected_source",
  "decision_status",
  "decision_note",
  "serving_note",
  "cost_basis_text",
  "source_values",
]);
const BLOCKER_MUTABLE = new Set(["resolved", "resolved_note", "resolved_at"]);

const OWNER_NA_PREFIX = "เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A):";

export class KitchenSotValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "KitchenSotValidationError";
    this.field = field;
  }
}

export class InvalidKitchenSotTransitionError extends KitchenSotValidationError {
  constructor(field: string, message: string) {
    super(field, message);
    this.name = "InvalidKitchenSotTransitionError";
  }
}

function fail(field: string, message: string): never {
  throw new InvalidKitchenSotTransitionError(field, message);
}

function jsonEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireIsoTimestamp(value: unknown, field: string): void {
  if (!isCanonicalKitchenSotTimestamp(value)) {
    fail(field, "must be a canonical UTC ISO timestamp with millisecond precision");
  }
}

function compareImmutableFields(
  baseline: Record<string, JsonValue>,
  submitted: Record<string, JsonValue>,
  mutable: Set<string>,
  appendOrder: readonly string[],
  structural: Set<string>,
  field: string,
): void {
  const baselineKeys = Object.keys(baseline);
  const submittedKeys = Object.keys(submitted);
  if (!jsonEqual(submittedKeys.slice(0, baselineKeys.length), baselineKeys)) {
    fail(field, "existing field keys were deleted or reordered");
  }
  const appendedKeys = submittedKeys.slice(baselineKeys.length);
  const expectedAppendedKeys = appendOrder.filter((key) =>
    !baselineKeys.includes(key) && appendedKeys.includes(key));
  if (!jsonEqual(appendedKeys, expectedAppendedKeys)) {
    fail(field, "new field keys are not allowed or were appended out of deterministic order");
  }
  for (const key of baselineKeys.filter((key) => !mutable.has(key) && !structural.has(key))) {
    if (!jsonEqual(baseline[key], submitted[key])) {
      fail(`${field}.${key}`, "immutable field changed");
    }
  }
}

function compareSourceValues(
  baseline: KitchenSotItem["source_values"],
  submitted: KitchenSotItem["source_values"],
  field: string,
): void {
  const baselineKeys = Object.keys(baseline);
  const submittedKeys = Object.keys(submitted);
  const hadOwner = baselineKeys.includes("owner_confirmation");
  const expectedKeys = hadOwner
    ? baselineKeys
    : submitted.owner_confirmation === undefined
      ? baselineKeys
      : [...baselineKeys, "owner_confirmation"];
  if (!jsonEqual(expectedKeys, submittedKeys)) {
    fail(field, "only owner_confirmation may be appended; pre-existing key order must stay identical");
  }
  for (const key of baselineKeys) {
    if (key !== "owner_confirmation" && !jsonEqual(baseline[key], submitted[key])) {
      fail(`${field}.${key}`, "pre-existing source evidence changed");
    }
  }
}

function validateDirtyOwnerItem(item: KitchenSotItem, field: string): void {
  if (item.selected_source !== "owner_confirmation") return;
  const owner = item.source_values.owner_confirmation;
  if (typeof owner !== "string" || owner.trim() === "") {
    fail(`${field}.source_values.owner_confirmation`, "owner_confirmation is required");
  }
  if (item.candidate_text !== owner) {
    fail(`${field}.candidate_text`, "must equal owner_confirmation");
  }
  if (item.decision_status !== "confirmed_by_owner") {
    fail(`${field}.decision_status`, "must be confirmed_by_owner for owner_confirmation");
  }
  if (typeof item.decision_note !== "string" || item.decision_note.trim() === "") {
    fail(`${field}.decision_note`, "is required for owner_confirmation");
  }
}

function validateItem(baseline: KitchenSotItem, submitted: KitchenSotItem, field: string): void {
  if (baseline.line_key !== submitted.line_key) fail(`${field}.line_key`, "item identity changed");
  if (
    typeof baseline.component_recipe_id !== typeof submitted.component_recipe_id ||
    baseline.component_recipe_id !== submitted.component_recipe_id
  ) {
    fail(`${field}.component_recipe_id`, "component identity or JSON type changed");
  }
  compareImmutableFields(
    baseline,
    submitted,
    ITEM_MUTABLE,
    ["serving_note", "cost_basis_text"],
    new Set(),
    field,
  );
  compareSourceValues(baseline.source_values, submitted.source_values, `${field}.source_values`);
  if (!jsonEqual(baseline, submitted)) validateDirtyOwnerItem(submitted, field);
}

function validateChangedMethod(recipe: KitchenSotRecipe, field: string): void {
  if (recipe.method_selected_source !== "owner_confirmation") {
    fail(`${field}.method_selected_source`, "changed method must select owner_confirmation");
  }
  if (typeof recipe.method_candidate_text !== "string" || recipe.method_candidate_text.trim() === "") {
    fail(`${field}.method_candidate_text`, "changed method must be meaningful");
  }
  if (typeof recipe.method_decision_note !== "string" || recipe.method_decision_note.trim() === "") {
    fail(`${field}.method_decision_note`, "changed method requires a no-invention note");
  }
}

function validateDirtyBlocker(
  recipe: KitchenSotRecipe,
  blocker: KitchenSotBlocker,
  field: string,
): void {
  if (blocker.resolved !== true) fail(`${field}.resolved`, "changed blocker must be resolved");
  if (typeof blocker.resolved_note !== "string" || blocker.resolved_note.trim() === "") {
    fail(`${field}.resolved_note`, "resolved blocker requires a meaningful note");
  }
  requireIsoTimestamp(blocker.resolved_at, `${field}.resolved_at`);
  const methodEmpty = recipe.method_candidate_text === null || recipe.method_candidate_text.trim() === "";
  if (blocker.code === "missing_method" && methodEmpty) {
    if (!blocker.resolved_note.startsWith(OWNER_NA_PREFIX)) {
      fail(`${field}.resolved_note`, "missing method requires explicit owner N/A confirmation");
    }
    if (blocker.resolved_note.slice(OWNER_NA_PREFIX.length).trim() === "") {
      fail(`${field}.resolved_note`, "owner N/A confirmation requires a meaningful reason");
    }
  }
}

function validateBlocker(
  baseline: KitchenSotBlocker,
  submitted: KitchenSotBlocker,
  recipe: KitchenSotRecipe,
  field: string,
): void {
  compareImmutableFields(
    baseline,
    submitted,
    BLOCKER_MUTABLE,
    ["resolved", "resolved_note", "resolved_at"],
    new Set(),
    field,
  );
  if (!jsonEqual(baseline, submitted)) validateDirtyBlocker(recipe, submitted, field);
}

function validateRecipe(baseline: KitchenSotRecipe, submitted: KitchenSotRecipe, field: string): void {
  if (typeof baseline.recipe_id !== typeof submitted.recipe_id || baseline.recipe_id !== submitted.recipe_id) {
    fail(`${field}.recipe_id`, "recipe identity or JSON type changed");
  }
  compareImmutableFields(baseline, submitted, RECIPE_MUTABLE, [], new Set(["items", "blockers"]), field);
  if (baseline.items.length !== submitted.items.length) fail(`${field}.items`, "array length changed");
  baseline.items.forEach((item, index) => validateItem(item, submitted.items[index]!, `${field}.items[${index}]`));
  if (baseline.blockers.length !== submitted.blockers.length) fail(`${field}.blockers`, "array length changed");
  baseline.blockers.forEach((blocker, index) =>
    validateBlocker(blocker, submitted.blockers[index]!, submitted, `${field}.blockers[${index}]`));

  const methodFields = ["method_candidate_text", "method_selected_source", "method_decision_note"] as const;
  if (methodFields.some((key) => !jsonEqual(baseline[key], submitted[key]))) {
    validateChangedMethod(submitted, field);
  }
}

function validateMetadata(submitted: KitchenSotDocument, derivedFrom: DerivedFrom): void {
  if (submitted.schema_version !== "2.1.0-prototype-draft") {
    fail("schema_version", "must be 2.1.0-prototype-draft");
  }
  requireIsoTimestamp(submitted.generated_at, "generated_at");
  if (!jsonEqual(submitted.derived_from, derivedFrom as unknown as JsonValue)) {
    fail("derived_from", "must identify the exact frozen V4 source");
  }
}

export function validateKitchenSotTransition(
  sourceV4: KitchenSotDocument,
  previousV5: KitchenSotDocument | null,
  submitted: KitchenSotDocument,
  derivedFrom: DerivedFrom,
): void {
  const baseline = previousV5 ?? sourceV4;
  validateMetadata(submitted, derivedFrom);
  compareImmutableFields(
    baseline,
    submitted,
    TOP_LEVEL_MUTABLE,
    ["derived_from"],
    new Set(["recipes"]),
    "document",
  );
  if (baseline.recipes.length !== submitted.recipes.length) fail("recipes", "array length changed");
  baseline.recipes.forEach((recipe, index) =>
    validateRecipe(recipe, submitted.recipes[index]!, `recipes[${index}]`));
}
