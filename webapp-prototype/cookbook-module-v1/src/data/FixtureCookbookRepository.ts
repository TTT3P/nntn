import type {
  CookbookSnapshot,
  IngredientLine,
  MediaAsset,
  MediaReviewState,
  MediaRole,
  RecipeKind,
  RecipeIdentity,
  RecipeVersion,
  ReviewState,
  StepMediaLink,
  Vessel,
  WorkDocument,
  WorkStage,
} from "../domain/cookbook/types";
import type {
  CookbookRepository,
  RepositoryCapabilities,
} from "./CookbookRepository";
import fixtureJson from "./fixtures/first-set.json";
import mediaFixtureJson from "./fixtures/first-set-media.json";

interface FixtureItem {
  line_key: string;
  item_name: string;
  item_kind: string;
  ingredient_id?: number | null;
  component_recipe_id: RecipeIdentity | null;
  candidate_text: string | null;
  source_value?: number | null;
  source_unit?: string | null;
  serving_note?: string | null;
  decision_status: string;
  selected_source: string | null;
}

interface FixtureWorkDocument {
  stage: string;
  scalable: boolean;
  ingredient_line_keys: string[];
  steps: string[];
}

interface FixtureRecipe {
  recipe_id: RecipeIdentity;
  recipe_version_id: string;
  recipe_name: string;
  recipe_type: string;
  parent_recipe_ids: RecipeIdentity[];
  review_state: string;
  source_locators: string[];
  items: FixtureItem[];
  method_candidate_text: string | null;
  method_decision_note: string | null;
  yield_candidate_text: string | null;
  blockers: Array<{ code: string; message: string }>;
  operational_notes: string[];
  work_documents: Partial<Record<WorkStage, FixtureWorkDocument>>;
}

interface FixtureDocument {
  recipes: FixtureRecipe[];
}

const fixture: FixtureDocument = fixtureJson;

interface FixtureMediaAsset extends Omit<MediaAsset, "reviewState"> {
  reviewState: string;
}

interface FixtureStepMediaLink extends Omit<StepMediaLink, "role" | "vessel"> {
  role: string;
  vessel: string | null;
}

interface FixtureMediaDocument {
  media: FixtureMediaAsset[];
  stepMedia: FixtureStepMediaLink[];
}

const mediaFixture: FixtureMediaDocument = mediaFixtureJson;

function mapMediaReviewState(state: string): MediaReviewState {
  if (state === "sample" || state === "unreviewed" || state === "confirmed") return state;
  throw new Error(`Unknown fixture media review state: ${state}`);
}

function mapMediaRole(role: string): MediaRole {
  if (role === "before" || role === "during" || role === "checkpoint" || role === "final") return role;
  throw new Error(`Unknown fixture media role: ${role}`);
}

function mapVessel(vessel: string | null): Vessel | null {
  if (vessel === null || vessel === "plate" || vessel === "delivery_box" || vessel === "cup_1oz") return vessel;
  throw new Error(`Unknown fixture media vessel: ${vessel}`);
}

function mapMediaAsset(asset: FixtureMediaAsset): MediaAsset {
  return {
    ...structuredClone(asset),
    reviewState: mapMediaReviewState(asset.reviewState),
  };
}

function mapStepMediaLink(link: FixtureStepMediaLink): StepMediaLink {
  return {
    ...structuredClone(link),
    role: mapMediaRole(link.role),
    vessel: mapVessel(link.vessel),
  };
}

function stepId(
  recipeVersionId: string,
  stage: WorkStage,
  order: number,
): string {
  return `${recipeVersionId}:${stage}:${order}`;
}

function mapReviewState(reviewState: string): ReviewState {
  const states: Record<string, ReviewState> = {
    reviewed_candidate: "candidate",
    conflict: "conflict",
    missing_method: "blocked",
    missing_source: "blocked",
  };

  const mapped = states[reviewState];
  if (!mapped) throw new Error(`Unknown fixture review state: ${reviewState}`);
  return mapped;
}

function mapRecipeKind(kind: string): RecipeKind {
  if (kind === "sellable_menu" || kind === "prepared_recipe") return kind;
  throw new Error(`Unknown fixture recipe kind: ${kind}`);
}

function mapItemKind(kind: string): IngredientLine["itemKind"] {
  if (kind === "direct_ingredient" || kind === "prepared_recipe") return kind;
  throw new Error(`Unknown fixture item kind: ${kind}`);
}

function mapWorkStage(stage: string): WorkStage {
  if (stage === "prep" || stage === "cook" || stage === "service") return stage;
  throw new Error(`Unknown fixture work stage: ${stage}`);
}

function mapLine(item: FixtureItem): IngredientLine {
  return {
    lineKey: item.line_key,
    itemName: item.item_name,
    itemKind: mapItemKind(item.item_kind),
    ingredientId: item.ingredient_id ?? null,
    componentRecipeId: item.component_recipe_id,
    sourceText: item.candidate_text,
    sourceValue: item.source_value ?? null,
    sourceUnit: item.source_unit ?? null,
    servingNote: item.serving_note ?? null,
    decisionStatus: item.decision_status,
    selectedSource: item.selected_source,
  };
}

function mapWorkDocuments(
  recipeVersionId: string,
  documents: FixtureRecipe["work_documents"],
): RecipeVersion["workDocuments"] {
  const mapped: RecipeVersion["workDocuments"] = {};

  for (const document of Object.values(documents)) {
    if (!document) continue;
    const stage = mapWorkStage(document.stage);

    const mappedDocument: WorkDocument = {
      stage,
      scalable: document.scalable,
      ingredientLineKeys: [...document.ingredient_line_keys],
      steps: document.steps.map((instruction, index) => {
        const order = index + 1;
        return {
          stepId: stepId(recipeVersionId, stage, order),
          stage,
          instruction,
          order,
        };
      }),
    };
    mapped[stage] = mappedDocument;
  }

  return mapped;
}

function mapRecipe(recipe: FixtureRecipe): RecipeVersion {
  return {
    recipeId: recipe.recipe_id,
    recipeVersionId: recipe.recipe_version_id,
    name: recipe.recipe_name,
    kind: mapRecipeKind(recipe.recipe_type),
    parentRecipeIds: [...recipe.parent_recipe_ids],
    reviewState: mapReviewState(recipe.review_state),
    sourceLocators: [...recipe.source_locators],
    lines: recipe.items.map(mapLine),
    methodText: recipe.method_candidate_text,
    methodDecisionNote: recipe.method_decision_note,
    yieldText: recipe.yield_candidate_text,
    blockers: recipe.blockers.map((blocker) => blocker.message),
    operationalNotes: [...recipe.operational_notes],
    workDocuments: mapWorkDocuments(
      recipe.recipe_version_id,
      recipe.work_documents,
    ),
  };
}

export class FixtureCookbookRepository implements CookbookRepository {
  readonly capabilities: RepositoryCapabilities = {
    persistence: "session",
    mediaUpload: false,
    production: false,
  };

  async loadSnapshot(): Promise<CookbookSnapshot> {
    return {
      recipes: fixture.recipes.map(mapRecipe),
      media: mediaFixture.media.map(mapMediaAsset),
      stepMedia: mediaFixture.stepMedia.map(mapStepMediaLink),
    };
  }

  async saveSessionSnapshot(
    snapshot: CookbookSnapshot,
  ): Promise<{ persisted: false; scope: "session" }> {
    void snapshot;
    return { persisted: false, scope: "session" };
  }
}
