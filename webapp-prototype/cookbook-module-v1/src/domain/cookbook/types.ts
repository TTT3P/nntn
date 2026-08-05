export type RecipeKind = "sellable_menu" | "prepared_recipe";
export type RecipeIdentity = number | string;
export type WorkStage = "prep" | "cook" | "service";
export type ReviewState = "confirmed" | "candidate" | "conflict" | "blocked";

export interface IngredientLine {
  lineKey: string;
  itemName: string;
  itemKind: "direct_ingredient" | "prepared_recipe";
  ingredientId: number | null;
  componentRecipeId: RecipeIdentity | null;
  sourceText: string | null;
  sourceValue: number | null;
  sourceUnit: string | null;
  decisionStatus: string;
  selectedSource: string | null;
}

export interface WorkStep {
  stepId: string;
  stage: WorkStage;
  instruction: string;
  order: number;
}

export interface WorkDocument {
  stage: WorkStage;
  scalable: boolean;
  ingredientLineKeys: string[];
  steps: WorkStep[];
}

export interface RecipeVersion {
  recipeId: RecipeIdentity;
  recipeVersionId: string;
  name: string;
  kind: RecipeKind;
  parentRecipeIds: RecipeIdentity[];
  reviewState: ReviewState;
  sourceLocators: string[];
  lines: IngredientLine[];
  methodText: string | null;
  blockers: string[];
  operationalNotes: string[];
  workDocuments: Partial<Record<WorkStage, WorkDocument>>;
}

export interface MediaCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FocalPoint {
  x: number;
  y: number;
}

export type MediaReviewState = "sample" | "unreviewed" | "confirmed";
export type MediaRole = "before" | "during" | "checkpoint" | "final";
export type StepMediaRole = MediaRole;
export type Vessel = "plate" | "delivery_box" | "cup_1oz";

export interface MediaAsset {
  mediaId: string;
  url: string;
  caption: string;
  altText: string;
  source: string | null;
  capturedAt: string | null;
  author: string | null;
  reviewState: MediaReviewState;
  localSessionOnly: boolean;
  crop: MediaCrop | null;
  focalPoint: FocalPoint | null;
  measurementAnnotation: string | null;
}

export interface StepMediaLink {
  stepId: string;
  mediaId: string;
  order: number;
  role: StepMediaRole;
  vessel: Vessel | null;
  reviewNeeded: boolean;
}

export type NewStepMediaLink = Omit<StepMediaLink, "order" | "reviewNeeded">;

export interface CookbookSnapshot {
  recipes: RecipeVersion[];
  media: MediaAsset[];
  stepMedia: StepMediaLink[];
}
