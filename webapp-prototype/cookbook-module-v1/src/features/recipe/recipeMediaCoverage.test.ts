import { describe, expect, test } from "vitest";
import type { CookbookSnapshot } from "../../domain/cookbook/types";
import { DuplicateStepMediaLinkError } from "../../domain/media/stepMedia";
import {
  makeMediaAsset,
  makeRecipe,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../../test/builders";
import { deriveRecipeMediaCoverage } from "./recipeMediaCoverage";

function recipeWithSteps(stepIds: string[]) {
  return makeRecipe({
    workDocuments: {
      prep: {
        stage: "prep",
        scalable: true,
        ingredientLineKeys: [],
        steps: stepIds.map((stepId, index) =>
          makeWorkStep({ stepId, order: index + 1 }),
        ),
      },
    },
  });
}

function coverageSnapshot(
  recipe = recipeWithSteps(["step-1"]),
  overrides: Partial<CookbookSnapshot> = {},
) {
  return makeSnapshot({ recipes: [recipe], ...overrides });
}

describe("deriveRecipeMediaCoverage", () => {
  test("covers an actual step only with a link to an existing media asset", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = coverageSnapshot(recipe, {
      media: [makeMediaAsset({ mediaId: "media-1" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "media-1" })],
    });

    expect(deriveRecipeMediaCoverage(recipe, snapshot)).toEqual({
      coverage: { linked: 1, reviewNeeded: 0 },
      missingMedia: false,
      mediaReviewNeeded: false,
    });
  });

  test.each([
    [
      "dangling media",
      [makeStepMediaLink({ stepId: "step-1", mediaId: "missing-media", reviewNeeded: true })],
      [makeMediaAsset({ mediaId: "other-media" })],
    ],
    [
      "dangling step",
      [makeStepMediaLink({ stepId: "missing-step", mediaId: "media-1", reviewNeeded: true })],
      [makeMediaAsset({ mediaId: "media-1" })],
    ],
  ])("ignores a %s link", (_name, stepMedia, media) => {
    const recipe = recipeWithSteps(["step-1"]);
    expect(
      deriveRecipeMediaCoverage(recipe, coverageSnapshot(recipe, { stepMedia, media })),
    ).toEqual({
      coverage: { linked: 0, reviewNeeded: 0 },
      missingMedia: true,
      mediaReviewNeeded: false,
    });
  });

  test("keeps valid links when valid and dangling links are mixed", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = coverageSnapshot(recipe, {
      media: [makeMediaAsset({ mediaId: "media-1" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "media-1" }),
        makeStepMediaLink({ stepId: "step-1", mediaId: "missing-media", order: 2, reviewNeeded: true }),
        makeStepMediaLink({ stepId: "missing-step", mediaId: "media-1", reviewNeeded: true }),
      ],
    });

    expect(deriveRecipeMediaCoverage(recipe, snapshot)).toEqual({
      coverage: { linked: 1, reviewNeeded: 0 },
      missingMedia: false,
      mediaReviewNeeded: false,
    });
  });

  test("fails closed on duplicate resolved step/media pairs", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = coverageSnapshot(recipe, {
      media: [makeMediaAsset({ mediaId: "media-1" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "media-1" }),
        makeStepMediaLink({ stepId: "step-1", mediaId: "media-1", order: 2, reviewNeeded: true }),
      ],
    });

    expect(() => deriveRecipeMediaCoverage(recipe, snapshot)).toThrow(
      DuplicateStepMediaLinkError,
    );
  });

  test("does not invent a media requirement for a recipe with no work steps", () => {
    const recipe = makeRecipe({ workDocuments: {} });
    expect(deriveRecipeMediaCoverage(recipe, coverageSnapshot(recipe))).toEqual({
      coverage: { linked: 0, reviewNeeded: 0 },
      missingMedia: false,
      mediaReviewNeeded: false,
    });
  });

  test("does not mutate the recipe or snapshot", () => {
    const recipe = recipeWithSteps(["step-1", "step-2"]);
    const snapshot = coverageSnapshot(recipe, {
      media: [makeMediaAsset({ mediaId: "media-1" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "media-1" })],
    });
    const beforeRecipe = structuredClone(recipe);
    const beforeSnapshot = structuredClone(snapshot);

    deriveRecipeMediaCoverage(recipe, snapshot);

    expect(recipe).toEqual(beforeRecipe);
    expect(snapshot).toEqual(beforeSnapshot);
  });
});
