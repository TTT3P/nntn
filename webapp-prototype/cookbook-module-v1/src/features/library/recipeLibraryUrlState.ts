import {
  STANDARD_PRINT_COLLECTIONS,
  type PrintCollectionKey,
} from "../print/printCollections";

export type LibraryMode = "read" | "work" | "manage";
export type LibraryView = "read" | "compact";
export type RecipeKindFilter =
  | "all"
  | "sellable_menu"
  | "prepared_recipe"
  | "sub_recipe";
export type RecipeStatusFilter = "all" | "ready" | "waiting";
export type RecipeStageFilter = "all" | "prep" | "cook" | "service";
export type RecipeCollectionFilter = "all" | PrintCollectionKey;

export interface RecipeLibraryUrlState {
  mode: LibraryMode;
  view: LibraryView;
  query: string;
  kind: RecipeKindFilter;
  status: RecipeStatusFilter;
  stage: RecipeStageFilter;
  collection: RecipeCollectionFilter;
}

const modes = new Set<LibraryMode>(["work", "manage"]);
const views = new Set<LibraryView>(["compact"]);
const kinds = new Set<RecipeKindFilter>([
  "sellable_menu",
  "prepared_recipe",
  "sub_recipe",
]);
const statuses = new Set<RecipeStatusFilter>(["ready", "waiting"]);
const stages = new Set<RecipeStageFilter>(["prep", "cook", "service"]);
const collections = new Set<PrintCollectionKey>(
  STANDARD_PRINT_COLLECTIONS.map(({ key }) => key),
);

function allowlistedValue<T extends string>(
  value: string | null,
  allowlist: ReadonlySet<T>,
  fallback: T,
): T {
  return value !== null && allowlist.has(value as T) ? (value as T) : fallback;
}

export function parseRecipeLibraryUrlState(
  params: URLSearchParams,
): RecipeLibraryUrlState {
  return {
    mode: allowlistedValue(params.get("mode"), modes, "read"),
    view: allowlistedValue(params.get("view"), views, "read"),
    query: params.get("q")?.trim() ?? "",
    kind: allowlistedValue(params.get("kind"), kinds, "all"),
    status: allowlistedValue(params.get("status"), statuses, "all"),
    stage: allowlistedValue(params.get("stage"), stages, "all"),
    collection: allowlistedValue(params.get("collection"), collections, "all"),
  };
}

export function updateRecipeLibraryUrlState(
  current: URLSearchParams,
  patch: Partial<RecipeLibraryUrlState>,
): URLSearchParams {
  const existing = parseRecipeLibraryUrlState(current);
  const state: RecipeLibraryUrlState = {
    mode:
      patch.mode === undefined
        ? existing.mode
        : allowlistedValue(patch.mode, modes, "read"),
    view:
      patch.view === undefined
        ? existing.view
        : allowlistedValue(patch.view, views, "read"),
    query: (patch.query ?? existing.query).trim(),
    kind:
      patch.kind === undefined
        ? existing.kind
        : allowlistedValue(patch.kind, kinds, "all"),
    status:
      patch.status === undefined
        ? existing.status
        : allowlistedValue(patch.status, statuses, "all"),
    stage:
      patch.stage === undefined
        ? existing.stage
        : allowlistedValue(patch.stage, stages, "all"),
    collection:
      patch.collection === undefined
        ? existing.collection
        : allowlistedValue(patch.collection, collections, "all"),
  };

  const next = new URLSearchParams();
  if (state.mode !== "read") next.set("mode", state.mode);
  if (state.view !== "read") next.set("view", state.view);
  if (state.query !== "") next.set("q", state.query);
  if (state.kind !== "all") next.set("kind", state.kind);
  if (state.status !== "all") next.set("status", state.status);
  if (state.stage !== "all") next.set("stage", state.stage);
  if (state.collection !== "all") next.set("collection", state.collection);
  return next;
}
