import type {
  CookbookSnapshot,
  IngredientLine,
  MediaAsset,
  RecipeVersion,
  StepMediaLink,
  WorkStep,
} from "../domain/cookbook/types";
import type { ProjectedWorkDocument } from "../domain/work/workDocuments";

export function makeIngredientLine(
  overrides: Partial<IngredientLine> = {},
): IngredientLine {
  return {
    lineKey: "test-line-1",
    itemName: "วัตถุดิบทดสอบ",
    itemKind: "direct_ingredient",
    ingredientId: 1,
    componentRecipeId: null,
    sourceText: "1 ช้อนชา",
    sourceValue: null,
    sourceUnit: null,
    decisionStatus: "confirmed",
    selectedSource: "TEST",
    ...overrides,
  };
}

export function makeWorkStep(overrides: Partial<WorkStep> = {}): WorkStep {
  return {
    stepId: "test-v1-1:prep:1",
    stage: "prep",
    instruction: "ทำตามขั้นตอนทดสอบ",
    order: 1,
    ...overrides,
  };
}

export function makeRecipe(
  overrides: Partial<RecipeVersion> = {},
): RecipeVersion {
  return {
    recipeId: 1,
    recipeVersionId: "test-v1-1",
    name: "สูตรทดสอบ",
    kind: "prepared_recipe",
    parentRecipeIds: [],
    reviewState: "confirmed",
    sourceLocators: ["TEST"],
    lines: [],
    methodText: "1. ทำตามขั้นตอนทดสอบ",
    blockers: [],
    operationalNotes: [],
    workDocuments: {},
    ...overrides,
  };
}

export function makeProjectedWorkDocument(
  overrides: Partial<ProjectedWorkDocument> = {},
): ProjectedWorkDocument {
  return {
    recipeId: 1,
    recipeVersionId: "test-v1-1",
    recipeName: "สูตรทดสอบ",
    stage: "prep",
    scalable: true,
    ingredientLineKeys: ["test-line-1"],
    ingredients: [makeIngredientLine()],
    steps: [makeWorkStep()],
    multiplier: 1,
    blockers: [],
    ...overrides,
  };
}

export function makeMediaAsset(
  overrides: Partial<MediaAsset> = {},
): MediaAsset {
  return {
    mediaId: "test-media-1",
    url: "/sample-media/test-media-1.jpg",
    caption: "รูปทดสอบ",
    altText: "รูปประกอบขั้นตอนทดสอบ",
    source: "TEST",
    capturedAt: null,
    author: null,
    reviewState: "confirmed",
    localSessionOnly: false,
    crop: null,
    focalPoint: null,
    measurementAnnotation: null,
    ...overrides,
  };
}

export function makeStepMediaLink(
  overrides: Partial<StepMediaLink> = {},
): StepMediaLink {
  return {
    stepId: "test-v1-1:prep:1",
    mediaId: "test-media-1",
    order: 1,
    role: "during",
    vessel: null,
    reviewNeeded: false,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<CookbookSnapshot> = {},
): CookbookSnapshot {
  return {
    recipes: [makeRecipe()],
    media: [],
    stepMedia: [],
    ...overrides,
  };
}
