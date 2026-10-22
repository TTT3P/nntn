import type {
  CookbookSnapshot,
  IngredientLine,
  RecipeIdentity,
  RecipeVersion,
  ReviewState,
  WorkDocument,
  WorkStage,
} from "../cookbook/types";
import type { CookbookV6Document, CookbookV6Recipe } from "./types";

export interface CookbookV6Projection {
  snapshot: CookbookSnapshot;
  recipeDraftById: ReadonlyMap<RecipeIdentity, boolean>;
}

function isDraft(recipe: CookbookV6Recipe): boolean {
  return recipe.reviewState === "waiting_for_kitchen" ||
    recipe.blockers.some(({ resolved }) => !resolved) ||
    recipe.ingredients.length === 0 ||
    recipe.ingredients.some((line) => line.active && (
      line.sourceDisplayText === "" ||
      line.decisionStatus === "needs_review" ||
      line.decisionStatus === "conflict"
    )) ||
    recipe.methodSteps.length === 0;
}

function projectReviewState(recipe: CookbookV6Recipe): ReviewState {
  if (isDraft(recipe)) return "blocked";
  if (recipe.reviewState === "conflict") return "conflict";
  return recipe.reviewState.includes("confirmed") ? "confirmed" : "candidate";
}

function projectLine(line: CookbookV6Recipe["ingredients"][number]): IngredientLine {
  return {
    lineKey: line.lineId,
    itemName: line.name,
    itemKind: line.kind === "prepared_recipe" ? "prepared_recipe" : "direct_ingredient",
    ingredientId: typeof line.ingredientId === "number" ? line.ingredientId : null,
    componentRecipeId: line.componentRecipeId,
    sourceText: line.sourceDisplayText === "" ? null : line.sourceDisplayText,
    sourceValue: null,
    sourceUnit: line.unitText === "" ? null : line.unitText,
    servingNote: line.servingNote === "" ? null : line.servingNote,
    decisionStatus: line.active ? line.decisionStatus : "removed_by_editor",
    selectedSource: line.selectedSource,
  };
}

function projectWorkDocuments(recipe: CookbookV6Recipe): RecipeVersion["workDocuments"] {
  const stepById = new Map(recipe.methodSteps.map((step) => [step.stepId, step]));
  const projected: RecipeVersion["workDocuments"] = {};
  for (const [stage, source] of Object.entries(recipe.workDocuments) as Array<[
    WorkStage,
    NonNullable<CookbookV6Recipe["workDocuments"][WorkStage]>,
  ]>) {
    const document: WorkDocument = {
      stage,
      scalable: source.scalable,
      ingredientLineKeys: [...source.ingredientLineIds],
      steps: source.stepIds.map((stepId) => {
        const step = stepById.get(stepId);
        if (step === undefined) throw new Error("INVALID_COOKBOOK_WORK_DOCUMENT");
        return { ...step };
      }),
    };
    projected[stage] = document;
  }
  return projected;
}

function projectRecipe(recipe: CookbookV6Recipe): RecipeVersion {
  const activeLines = recipe.ingredients.filter(({ active }) => active);
  const activeLineIds = new Set(activeLines.map(({ lineId }) => lineId));
  const workDocuments = projectWorkDocuments(recipe);
  for (const document of Object.values(workDocuments)) {
    document.ingredientLineKeys = document.ingredientLineKeys.filter((lineId) => activeLineIds.has(lineId));
  }
  const methodText = recipe.methodSteps.length === 0
    ? null
    : recipe.methodSteps.map(({ instruction }, index) => `${String(index + 1)}. ${instruction}`).join("\n");
  return {
    recipeId: recipe.recipeId,
    recipeVersionId: `cookbook-v6:${recipe.recipeId}`,
    name: recipe.name,
    kind: recipe.kind,
    category: recipe.category,
    parentRecipeIds: [...recipe.parentRecipeIds],
    reviewState: projectReviewState(recipe),
    sourceLocators: [...recipe.sourceLocators],
    lines: activeLines.map(projectLine),
    methodText,
    methodDecisionNote: recipe.methodDecisionNote === "" ? null : recipe.methodDecisionNote,
    yieldText: recipe.yieldText === "" ? null : recipe.yieldText,
    blockers: recipe.blockers.filter(({ resolved }) => !resolved).map(({ message }) => message),
    operationalNotes: [...recipe.operationalNotes],
    workDocuments,
  };
}

export function projectCookbookV6(
  document: CookbookV6Document,
  mediaSnapshot: CookbookSnapshot,
): CookbookV6Projection {
  return {
    snapshot: {
      recipes: document.recipes.filter(({ active }) => active).map(projectRecipe),
      media: structuredClone(mediaSnapshot.media),
      stepMedia: structuredClone(mediaSnapshot.stepMedia),
    },
    recipeDraftById: new Map(document.recipes.map((recipe) => [recipe.recipeId, isDraft(recipe)])),
  };
}
