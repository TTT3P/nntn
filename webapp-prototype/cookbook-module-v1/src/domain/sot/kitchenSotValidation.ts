import type {
  JsonValue,
  KitchenSotBlocker,
  KitchenSotDocument,
  KitchenSotItem,
  KitchenSotRecipe,
} from "./kitchenSotDocument.ts";
import {
  KITCHEN_SOT_BLOCKER_KEY_ORDER,
  KITCHEN_SOT_ITEM_KEY_ORDER,
  isCanonicalKitchenSotTimestamp,
  type DerivedFrom,
} from "./kitchenSotEdits.ts";

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
const OWNER_RECIPE_SCHEMA_VERSION = "2.2.0-prototype-draft";
const OWNER_RECIPE_KEY_ORDER = [
  "recipe_id",
  "legacy_recipe_id",
  "recipe_version_id",
  "recipe_name",
  "recipe_type",
  "parent_recipe_ids",
  "review_state",
  "source_locators",
  "source_section_mappings",
  "items",
  "method_candidate_text",
  "method_selected_source",
  "method_decision_note",
  "yield_candidate_text",
  "operational_notes",
  "blockers",
  "work_documents",
] as const;

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

function identityKey(identity: KitchenSotRecipe["recipe_id"]): string {
  return typeof identity === "number"
    ? `number:${String(identity)}`
    : `string:${JSON.stringify(identity)}`;
}

function requireNonEmptyString(value: JsonValue | undefined, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(field, "must be a non-empty string");
  }
  return value;
}

function requireStringArray(value: JsonValue | undefined, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    fail(field, "must be a string array");
  }
  return value as string[];
}

function requireRecord(value: JsonValue | undefined, field: string): Record<string, JsonValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(field, "must be an object");
  }
  return value;
}

function requireCanonicalKeys(
  record: Record<string, JsonValue>,
  canonicalOrder: readonly string[],
  field: string,
): void {
  const actual = Object.keys(record);
  const expected = canonicalOrder.filter((key) => actual.includes(key));
  if (!jsonEqual(actual, expected)) {
    fail(field, "contains unknown fields or fields outside canonical order");
  }
}

function compareImmutableFields(
  baseline: Record<string, JsonValue>,
  submitted: Record<string, JsonValue>,
  mutable: Set<string>,
  appendOrder: readonly string[],
  structural: Set<string>,
  field: string,
  canonicalOrder?: readonly string[],
): void {
  const baselineKeys = Object.keys(baseline);
  const submittedKeys = Object.keys(submitted);
  if (canonicalOrder === undefined) {
    if (!jsonEqual(submittedKeys.slice(0, baselineKeys.length), baselineKeys)) {
      fail(field, "existing field keys were deleted or reordered");
    }
    const appendedKeys = submittedKeys.slice(baselineKeys.length);
    const expectedAppendedKeys = appendOrder.filter((key) =>
      !baselineKeys.includes(key) && appendedKeys.includes(key));
    if (!jsonEqual(appendedKeys, expectedAppendedKeys)) {
      fail(field, "new field keys are not allowed or were appended out of deterministic order");
    }
  } else {
    if (baselineKeys.some((key) => !submittedKeys.includes(key))) {
      fail(field, "existing field keys were deleted");
    }
    const addedKeys = submittedKeys.filter((key) => !baselineKeys.includes(key));
    if (addedKeys.some((key) => !appendOrder.includes(key))) {
      fail(field, "new field keys are not allowed");
    }
    const expectedKeys = [
      ...canonicalOrder.filter((key) => submittedKeys.includes(key)),
      ...baselineKeys.filter((key) => !canonicalOrder.includes(key)),
    ];
    if (!jsonEqual(submittedKeys, expectedKeys)) {
      fail(field, "field keys were deleted or are not in canonical order");
    }
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

function validateDirtyOwnerItem(
  recipe: KitchenSotRecipe,
  item: KitchenSotItem,
  field: string,
): void {
  if (item.selected_source !== "owner_confirmation") {
    fail(`${field}.selected_source`, "changed owner fields must select owner_confirmation");
  }
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
  const noteMatch = /^เจ้าของยืนยันวันที่ (\d{4}-\d{2}-\d{2}) ว่า(.+)$/u.exec(item.decision_note);
  if (noteMatch === null) {
    fail(`${field}.decision_note`, "must record the dated owner-confirmation mapping");
  }
  const date = noteMatch[1]!;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    fail(`${field}.decision_note`, "must contain a valid owner-confirmation date");
  }
  const expectedAccount = `${recipe.recipe_name} ใช้${item.item_name} ${owner}`;
  if (noteMatch[2] !== expectedAccount) {
    fail(`${field}.decision_note`, "must identify the exact recipe, item, and owner value");
  }
}

function validateItem(
  baseline: KitchenSotItem,
  submitted: KitchenSotItem,
  recipe: KitchenSotRecipe,
  field: string,
): void {
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
    KITCHEN_SOT_ITEM_KEY_ORDER,
  );
  compareSourceValues(baseline.source_values, submitted.source_values, `${field}.source_values`);
  const ownerMappingChanged = ["candidate_text", "selected_source", "decision_status", "decision_note"]
    .some((key) => !jsonEqual(baseline[key], submitted[key])) ||
    !jsonEqual(
      baseline.source_values.owner_confirmation,
      submitted.source_values.owner_confirmation,
    );
  if (ownerMappingChanged) validateDirtyOwnerItem(recipe, submitted, field);
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
    KITCHEN_SOT_BLOCKER_KEY_ORDER,
  );
  if (!jsonEqual(baseline, submitted)) validateDirtyBlocker(recipe, submitted, field);
}

function validateRecipe(baseline: KitchenSotRecipe, submitted: KitchenSotRecipe, field: string): void {
  if (typeof baseline.recipe_id !== typeof submitted.recipe_id || baseline.recipe_id !== submitted.recipe_id) {
    fail(`${field}.recipe_id`, "recipe identity or JSON type changed");
  }
  compareImmutableFields(baseline, submitted, RECIPE_MUTABLE, [], new Set(["items", "blockers"]), field);
  if (baseline.items.length !== submitted.items.length) fail(`${field}.items`, "array length changed");
  baseline.items.forEach((item, index) =>
    validateItem(item, submitted.items[index]!, submitted, `${field}.items[${index}]`));
  if (baseline.blockers.length !== submitted.blockers.length) fail(`${field}.blockers`, "array length changed");
  baseline.blockers.forEach((blocker, index) =>
    validateBlocker(blocker, submitted.blockers[index]!, submitted, `${field}.blockers[${index}]`));

  const methodFields = ["method_candidate_text", "method_selected_source", "method_decision_note"] as const;
  if (methodFields.some((key) => !jsonEqual(baseline[key], submitted[key]))) {
    validateChangedMethod(submitted, field);
  }
}

function validateAppendedWorkDocuments(recipe: KitchenSotRecipe, field: string): void {
  const documents = requireRecord(recipe.work_documents, `${field}.work_documents`);
  const stages = Object.keys(documents);
  if (stages.length === 0 || stages.some((stage) => !["prep", "cook", "service"].includes(stage))) {
    fail(`${field}.work_documents`, "must contain at least one known work stage");
  }
  const itemKeys = new Set(recipe.items.map(({ line_key }) => line_key));
  const referencedKeys = new Set<string>();
  for (const stage of stages) {
    const documentField = `${field}.work_documents.${stage}`;
    const document = requireRecord(documents[stage], documentField);
    requireCanonicalKeys(
      document,
      ["stage", "scalable", "ingredient_line_keys", "steps"],
      documentField,
    );
    if (document.stage !== stage) fail(`${documentField}.stage`, "must match its work stage key");
    if (typeof document.scalable !== "boolean") {
      fail(`${documentField}.scalable`, "must be boolean");
    }
    const ingredientLineKeys = requireStringArray(
      document.ingredient_line_keys,
      `${documentField}.ingredient_line_keys`,
    );
    for (const lineKey of ingredientLineKeys) {
      if (!itemKeys.has(lineKey)) fail(`${documentField}.ingredient_line_keys`, "references an unknown item");
      if (referencedKeys.has(lineKey)) fail(`${documentField}.ingredient_line_keys`, "duplicates an item across work stages");
      referencedKeys.add(lineKey);
    }
    const steps = requireStringArray(document.steps, `${documentField}.steps`);
    if (recipe.method_candidate_text === null && steps.length > 0) {
      fail(`${documentField}.steps`, "cannot invent steps while the owner-confirmed method is missing");
    }
  }
  if (recipe.items.some(({ line_key }) => !referencedKeys.has(line_key))) {
    fail(`${field}.work_documents`, "must place every owner-confirmed item in a work stage");
  }
}

function validateAppendedOwnerRecipe(recipe: KitchenSotRecipe, field: string): void {
  requireCanonicalKeys(recipe, OWNER_RECIPE_KEY_ORDER, field);
  if (recipe.legacy_recipe_id !== undefined && recipe.legacy_recipe_id !== recipe.recipe_id) {
    fail(`${field}.legacy_recipe_id`, "must preserve the matching legacy identity");
  }
  requireNonEmptyString(recipe.recipe_version_id, `${field}.recipe_version_id`);
  if (!Array.isArray(recipe.parent_recipe_ids)) {
    fail(`${field}.parent_recipe_ids`, "must be an identity array");
  }
  const sourceLocators = requireStringArray(recipe.source_locators, `${field}.source_locators`);
  if (!sourceLocators.some((locator) => locator.startsWith("Owner confirmation:"))) {
    fail(`${field}.source_locators`, "must include dated owner-confirmation provenance");
  }
  if (!Array.isArray(recipe.source_section_mappings)) {
    fail(`${field}.source_section_mappings`, "must be an array");
  }
  requireStringArray(recipe.operational_notes, `${field}.operational_notes`);
  if (recipe.items.length === 0) fail(`${field}.items`, "must contain at least one item");

  const lineKeys = new Set<string>();
  recipe.items.forEach((item, index) => {
    const itemField = `${field}.items[${String(index)}]`;
    requireCanonicalKeys(item, KITCHEN_SOT_ITEM_KEY_ORDER, itemField);
    if (lineKeys.has(item.line_key)) fail(`${itemField}.line_key`, "must be unique within the recipe");
    lineKeys.add(item.line_key);
    if (item.item_kind !== "direct_ingredient" && item.item_kind !== "prepared_recipe") {
      fail(`${itemField}.item_kind`, "must be a known ingredient kind");
    }
    if (!jsonEqual(Object.keys(item.source_values), ["owner_confirmation"])) {
      fail(`${itemField}.source_values`, "new owner recipes may contain only owner_confirmation evidence");
    }
    validateDirtyOwnerItem(recipe, item, itemField);
  });

  if (recipe.method_candidate_text === null) {
    if (recipe.method_selected_source !== null) {
      fail(`${field}.method_selected_source`, "must be null while the method is missing");
    }
    requireNonEmptyString(recipe.method_decision_note, `${field}.method_decision_note`);
    if (!recipe.blockers.some(({ code, resolved }) => code === "missing_method" && resolved !== true)) {
      fail(`${field}.blockers`, "must retain an unresolved missing_method blocker");
    }
  } else {
    validateChangedMethod(recipe, field);
  }

  recipe.blockers.forEach((blocker, index) => {
    const blockerField = `${field}.blockers[${String(index)}]`;
    requireCanonicalKeys(blocker, KITCHEN_SOT_BLOCKER_KEY_ORDER, blockerField);
    requireNonEmptyString(blocker.code, `${blockerField}.code`);
    requireNonEmptyString(blocker.message, `${blockerField}.message`);
    if (blocker.resolved !== undefined) validateDirtyBlocker(recipe, blocker, blockerField);
  });
  validateAppendedWorkDocuments(recipe, field);
}

function validateMetadata(
  submitted: KitchenSotDocument,
  derivedFrom: DerivedFrom,
  hasOwnerRecipes: boolean,
): void {
  const expectedSchema = hasOwnerRecipes ? OWNER_RECIPE_SCHEMA_VERSION : "2.1.0-prototype-draft";
  if (submitted.schema_version !== expectedSchema) {
    fail("schema_version", `must be ${expectedSchema}`);
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
  const hasOwnerRecipes = submitted.recipes.length > sourceV4.recipes.length;
  validateMetadata(submitted, derivedFrom, hasOwnerRecipes);
  compareImmutableFields(
    baseline,
    submitted,
    TOP_LEVEL_MUTABLE,
    ["derived_from"],
    new Set(["recipes"]),
    "document",
  );
  if (submitted.recipes.length < baseline.recipes.length) {
    fail("recipes", "existing recipes were deleted");
  }
  baseline.recipes.forEach((recipe, index) =>
    validateRecipe(recipe, submitted.recipes[index]!, `recipes[${index}]`));

  const identities = new Set(sourceV4.recipes.map(({ recipe_id }) => identityKey(recipe_id)));
  submitted.recipes.slice(sourceV4.recipes.length).forEach((recipe, offset) => {
    const field = `recipes[${String(sourceV4.recipes.length + offset)}]`;
    const key = identityKey(recipe.recipe_id);
    if (identities.has(key)) fail(`${field}.recipe_id`, "duplicates an existing recipe identity");
    identities.add(key);
    if (sourceV4.recipes.length + offset >= baseline.recipes.length) {
      validateAppendedOwnerRecipe(recipe, field);
    }
  });
}
