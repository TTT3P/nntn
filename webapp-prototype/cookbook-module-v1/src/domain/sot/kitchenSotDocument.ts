export type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};

export type RecipeIdentity = number | string;

export type KitchenSotItem = Record<string, JsonValue> & {
  line_key: string;
  item_name: string;
  component_recipe_id: RecipeIdentity | null;
  candidate_text: string | null;
  selected_source: string | null;
  decision_status: string;
  decision_note: string | null;
  source_values: Record<string, JsonValue>;
};

export type KitchenSotBlocker = Record<string, JsonValue> & {
  code: string;
  message: string;
  resolved?: boolean;
  resolved_note?: string;
  resolved_at?: string;
};

export type KitchenSotRecipe = Record<string, JsonValue> & {
  recipe_id: RecipeIdentity;
  recipe_name: string;
  recipe_type: "sellable_menu" | "prepared_recipe";
  review_state: string;
  items: KitchenSotItem[];
  method_candidate_text: string | null;
  method_selected_source: string | null;
  method_decision_note: string | null;
  yield_candidate_text: string | null;
  blockers: KitchenSotBlocker[];
};

export type KitchenSotDocument = Record<string, JsonValue> & {
  schema_version: string;
  generated_at: string;
  recipes: KitchenSotRecipe[];
};

export interface FillSummary {
  recipeCount: number;
  sellableMenuCount: number;
  preparedRecipeCount: number;
  unresolvedItemCount: number;
  itemFillTargetCount: number;
  noSelectedSourceCount: number;
  blockerCount: number;
  missingMethodRecipeIds: RecipeIdentity[];
  provenanceIncompleteCount: number;
}

export class InvalidKitchenSotDocumentError extends Error {
  readonly field: string;
  readonly value: unknown;

  constructor(field: string, value: unknown) {
    super(`Invalid Kitchen SOT document field ${field}`);
    this.name = "InvalidKitchenSotDocumentError";
    this.field = field;
    this.value = value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new InvalidKitchenSotDocumentError(field, value);
  }
}

function requireArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new InvalidKitchenSotDocumentError(field, value);
  }
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string") {
    throw new InvalidKitchenSotDocumentError(field, value);
  }
}

function requireNullableString(
  value: unknown,
  field: string,
): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    throw new InvalidKitchenSotDocumentError(field, value);
  }
}

function requireRecipeIdentity(
  value: unknown,
  field: string,
): asserts value is RecipeIdentity {
  const validNumber = typeof value === "number" && Number.isFinite(value);
  const validString = typeof value === "string" && value.length > 0;
  if (!validNumber && !validString) {
    throw new InvalidKitchenSotDocumentError(field, value);
  }
}

function requireJsonValue(value: unknown, field: string): asserts value is JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => requireJsonValue(entry, `${field}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, entry]) => requireJsonValue(entry, `${field}.${key}`));
    return;
  }
  throw new InvalidKitchenSotDocumentError(field, value);
}

function validateItem(value: unknown, field: string): void {
  requireRecord(value, field);
  requireString(value.line_key, `${field}.line_key`);
  requireString(value.item_name, `${field}.item_name`);
  if (value.component_recipe_id !== null) {
    requireRecipeIdentity(value.component_recipe_id, `${field}.component_recipe_id`);
  }
  requireNullableString(value.candidate_text, `${field}.candidate_text`);
  requireNullableString(value.selected_source, `${field}.selected_source`);
  requireString(value.decision_status, `${field}.decision_status`);
  requireNullableString(value.decision_note, `${field}.decision_note`);
  requireRecord(value.source_values, `${field}.source_values`);
}

function validateBlocker(value: unknown, field: string): void {
  requireRecord(value, field);
  requireString(value.code, `${field}.code`);
  requireString(value.message, `${field}.message`);
  if (value.resolved !== undefined && typeof value.resolved !== "boolean") {
    throw new InvalidKitchenSotDocumentError(`${field}.resolved`, value.resolved);
  }
  if (value.resolved_note !== undefined) {
    requireString(value.resolved_note, `${field}.resolved_note`);
  }
  if (value.resolved_at !== undefined) {
    requireString(value.resolved_at, `${field}.resolved_at`);
  }
}

function validateRecipe(value: unknown, field: string): void {
  requireRecord(value, field);
  requireRecipeIdentity(value.recipe_id, `${field}.recipe_id`);
  requireString(value.recipe_name, `${field}.recipe_name`);
  if (value.recipe_type !== "sellable_menu" && value.recipe_type !== "prepared_recipe") {
    throw new InvalidKitchenSotDocumentError(`${field}.recipe_type`, value.recipe_type);
  }
  requireString(value.review_state, `${field}.review_state`);
  requireArray(value.items, `${field}.items`);
  value.items.forEach((item, index) => validateItem(item, `${field}.items[${index}]`));
  requireNullableString(value.method_candidate_text, `${field}.method_candidate_text`);
  requireNullableString(value.method_selected_source, `${field}.method_selected_source`);
  requireNullableString(value.method_decision_note, `${field}.method_decision_note`);
  requireNullableString(value.yield_candidate_text, `${field}.yield_candidate_text`);
  requireArray(value.blockers, `${field}.blockers`);
  value.blockers.forEach((blocker, index) => validateBlocker(blocker, `${field}.blockers[${index}]`));
}

export function parseKitchenSotDocument(value: unknown): KitchenSotDocument {
  requireRecord(value, "document");
  requireJsonValue(value, "document");
  requireString(value.schema_version, "schema_version");
  requireString(value.generated_at, "generated_at");
  requireArray(value.recipes, "recipes");
  value.recipes.forEach((recipe, index) => validateRecipe(recipe, `recipes[${index}]`));
  return structuredClone(value) as KitchenSotDocument;
}

export function cloneKitchenSotDocument(document: KitchenSotDocument): KitchenSotDocument {
  return structuredClone(document);
}

export function isOwnerProvenanceIncomplete(item: KitchenSotItem): boolean {
  const owner = item.source_values.owner_confirmation;
  return item.selected_source === "owner_confirmation" &&
    (typeof owner !== "string" || owner.trim() === "");
}

export function isKitchenSotRecipeDraft(recipe: KitchenSotRecipe): boolean {
  return recipe.blockers.some(({ resolved }) => resolved !== true) ||
    recipe.items.some(({ decision_status }) =>
      decision_status === "needs_review" || decision_status === "conflict") ||
    recipe.items.some(isOwnerProvenanceIncomplete);
}

function isStatusUnresolved(item: KitchenSotItem): boolean {
  return item.decision_status === "needs_review" || item.decision_status === "conflict";
}

export function deriveFillSummary(document: KitchenSotDocument): FillSummary {
  const items = document.recipes.flatMap(({ items: recipeItems }) => recipeItems);
  return {
    recipeCount: document.recipes.length,
    sellableMenuCount: document.recipes.filter(({ recipe_type }) => recipe_type === "sellable_menu").length,
    preparedRecipeCount: document.recipes.filter(({ recipe_type }) => recipe_type === "prepared_recipe").length,
    unresolvedItemCount: items.filter(isStatusUnresolved).length,
    itemFillTargetCount: items.filter((item) =>
      isStatusUnresolved(item) || isOwnerProvenanceIncomplete(item)).length,
    noSelectedSourceCount: items.filter(({ selected_source }) => selected_source === null).length,
    blockerCount: document.recipes.reduce((count, { blockers }) => count + blockers.length, 0),
    missingMethodRecipeIds: document.recipes
      .filter(({ method_candidate_text }) =>
        method_candidate_text === null || method_candidate_text.trim() === "")
      .map(({ recipe_id }) => recipe_id),
    provenanceIncompleteCount: items.filter(isOwnerProvenanceIncomplete).length,
  };
}
