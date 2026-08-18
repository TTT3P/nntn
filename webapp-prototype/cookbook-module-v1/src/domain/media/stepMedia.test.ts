import { describe, expect, test } from "vitest";
import {
  makeMediaAsset,
  makeRecipe,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../../test/builders";
import {
  DuplicateMediaAssetIdError,
  DuplicateStepIdError,
  DuplicateStepMediaLinkError,
  DuplicateStepMediaOrderError,
  InvalidMediaPermutationError,
  InvalidMediaAssetFieldError,
  InvalidStepMediaFieldError,
  StepMediaOrderOverflowError,
  UnknownMediaAssetError,
  UnknownWorkStepError,
  attachMedia,
  deriveRecipeMediaCoverage,
  markStepMeaningChanged,
  mediaCoverageForRecipe,
  reorderStepMedia,
} from "./stepMedia";

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

describe("attachMedia", () => {
  test("rejects a null direct input with a named domain error", () => {
    expect(() => attachMedia(makeSnapshot(), null as never)).toThrow(
      InvalidStepMediaFieldError,
    );
  });

  test("appends after the highest existing order without duplicating a reusable asset", () => {
    const recipe = recipeWithSteps(["step-1", "step-2"]);
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [makeMediaAsset({ mediaId: "media-a" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "media-a", order: 4 }),
      ],
    });

    const result = attachMedia(snapshot, {
      stepId: "step-2",
      mediaId: "media-a",
      role: "checkpoint",
      vessel: "plate",
    });

    expect(result.media).toHaveLength(1);
    expect(result.stepMedia).toEqual([
      snapshot.stepMedia[0],
      {
        stepId: "step-2",
        mediaId: "media-a",
        order: 1,
        role: "checkpoint",
        vessel: "plate",
        reviewNeeded: false,
      },
    ]);
    expect(result).not.toBe(snapshot);
    expect(result.media).not.toBe(snapshot.media);
    expect(result.media[0]).not.toBe(snapshot.media[0]);
  });

  test("uses the maximum target-step order when existing orders have gaps", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: [makeMediaAsset({ mediaId: "media-a" }), makeMediaAsset({ mediaId: "media-b" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "media-a", order: 7 })],
    });

    const result = attachMedia(snapshot, {
      stepId: "step-1",
      mediaId: "media-b",
      role: "final",
      vessel: null,
    });

    expect(result.stepMedia.map((link) => link.order)).toEqual([7, 8]);
  });

  test("fails closed before the next order would overflow a safe integer", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: [makeMediaAsset({ mediaId: "a" }), makeMediaAsset({ mediaId: "b" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: Number.MAX_SAFE_INTEGER })],
    });

    expect(() => attachMedia(snapshot, {
      stepId: "step-1",
      mediaId: "b",
      role: "final",
      vessel: null,
    })).toThrow(StepMediaOrderOverflowError);
  });

  test("rejects unknown targets, duplicate pairs, and malformed input with named errors", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: [makeMediaAsset({ mediaId: "media-a" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "media-a" })],
    });

    expect(() => attachMedia(snapshot, { stepId: "missing", mediaId: "media-a", role: "final", vessel: null })).toThrow(UnknownWorkStepError);
    expect(() => attachMedia(snapshot, { stepId: "step-1", mediaId: "missing", role: "final", vessel: null })).toThrow(UnknownMediaAssetError);
    expect(() => attachMedia(snapshot, { stepId: "step-1", mediaId: "media-a", role: "final", vessel: null })).toThrow(DuplicateStepMediaLinkError);
    expect(() => attachMedia(snapshot, { stepId: "step-1", mediaId: "media-a", role: "invalid" as never, vessel: null })).toThrow(InvalidStepMediaFieldError);
    expect(() => attachMedia(snapshot, { stepId: "step-1", mediaId: "media-a", role: "final", vessel: "bowl" as never })).toThrow(InvalidStepMediaFieldError);
  });

  test("rejects an existing dangling link in the target step", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: [makeMediaAsset({ mediaId: "media-a" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "missing" })],
    });
    expect(() => attachMedia(snapshot, { stepId: "step-1", mediaId: "media-a", role: "during", vessel: null })).toThrow(UnknownMediaAssetError);
  });

  test("fails closed when asset IDs or step IDs are ambiguous", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const duplicateStepRecipe = recipeWithSteps(["step-1"]);
    duplicateStepRecipe.recipeVersionId = "other-version";

    expect(() => attachMedia(makeSnapshot({ recipes: [recipe], media: [makeMediaAsset({ mediaId: "same" }), makeMediaAsset({ mediaId: "same" })] }), { stepId: "step-1", mediaId: "same", role: "during", vessel: null })).toThrow(DuplicateMediaAssetIdError);
    expect(() => attachMedia(makeSnapshot({ recipes: [recipe, duplicateStepRecipe], media: [makeMediaAsset({ mediaId: "media-a" })] }), { stepId: "step-1", mediaId: "media-a", role: "during", vessel: null })).toThrow(DuplicateStepIdError);
  });

  test("validates the complete target asset and ignores unrelated malformed assets", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const malformedTarget = makeMediaAsset({ mediaId: "target", caption: null as never });
    const malformedUnrelated = makeMediaAsset({ mediaId: "unrelated", reviewState: "candidate" as never });

    expect(() => attachMedia(makeSnapshot({ recipes: [recipe], media: [malformedTarget] }), {
      stepId: "step-1",
      mediaId: "target",
      role: "during",
      vessel: null,
    })).toThrow(InvalidMediaAssetFieldError);

    const result = attachMedia(makeSnapshot({
      recipes: [recipe],
      media: [null as never, malformedUnrelated, makeMediaAsset({ mediaId: "target" })],
    }), {
      stepId: "step-1",
      mediaId: "target",
      role: "during",
      vessel: null,
    });
    expect(result.stepMedia).toHaveLength(1);
  });
});

describe("reorderStepMedia", () => {
  test("rejects a non-array media ID container with a named domain error", () => {
    const snapshot = makeSnapshot({ recipes: [recipeWithSteps(["step-1"])] });
    expect(() => reorderStepMedia(snapshot, "step-1", { mediaId: "a" } as never)).toThrow(
      InvalidStepMediaFieldError,
    );
  });

  test("reorders an exact permutation contiguously while preserving other links", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1", "step-2"])],
      media: ["a", "b", "other"].map((mediaId) => makeMediaAsset({ mediaId })),
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: 3 }),
        makeStepMediaLink({ stepId: "step-2", mediaId: "other", order: 9 }),
        makeStepMediaLink({ stepId: "step-1", mediaId: "b", order: 8 }),
      ],
    });

    const result = reorderStepMedia(snapshot, "step-1", ["b", "a"]);

    expect(result.stepMedia).toEqual([
      makeStepMediaLink({ stepId: "step-1", mediaId: "b", order: 1 }),
      snapshot.stepMedia[1],
      makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: 2 }),
    ]);
    expect(result.stepMedia[1]).not.toBe(snapshot.stepMedia[1]);
  });

  test("preserves an unrelated null link without dereferencing it", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: [makeMediaAsset({ mediaId: "a" })],
      stepMedia: [null as never, makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: 4 })],
    });

    const result = reorderStepMedia(snapshot, "step-1", ["a"]);
    expect(result.stepMedia).toEqual([
      null,
      makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: 1 }),
    ]);
  });

  test.each([
    ["missing", ["a"]],
    ["extra", ["a", "b", "c"]],
    ["duplicate", ["a", "a"]],
  ])("rejects an invalid %s permutation", (_name, mediaIds) => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: ["a", "b", "c"].map((mediaId) => makeMediaAsset({ mediaId })),
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "a" }),
        makeStepMediaLink({ stepId: "step-1", mediaId: "b", order: 2 }),
      ],
    });

    expect(() => reorderStepMedia(snapshot, "step-1", mediaIds)).toThrow(InvalidMediaPermutationError);
  });

  test("rejects dangling links and duplicate target orders", () => {
    const base = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: [makeMediaAsset({ mediaId: "a" }), makeMediaAsset({ mediaId: "b" })],
    });
    expect(() => reorderStepMedia({ ...base, stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "missing" })] }, "step-1", ["missing"])).toThrow(UnknownMediaAssetError);
    expect(() => reorderStepMedia({ ...base, stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: 1 }), makeStepMediaLink({ stepId: "step-1", mediaId: "b", order: 1 })] }, "step-1", ["a", "b"])).toThrow(DuplicateStepMediaOrderError);
  });
});

describe("markStepMeaningChanged", () => {
  test("marks every retained target link and leaves other links unchanged", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1", "step-2"])],
      media: ["a", "b"].map((mediaId) => makeMediaAsset({ mediaId })),
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "a" }),
        makeStepMediaLink({ stepId: "step-2", mediaId: "b" }),
      ],
    });

    const result = markStepMeaningChanged(snapshot, "step-1");

    expect(result.stepMedia.map((link) => link.reviewNeeded)).toEqual([true, false]);
    expect(result).not.toBe(snapshot);
    expect(result.stepMedia[1]).not.toBe(snapshot.stepMedia[1]);
  });

  test("preserves an unrelated null link without dereferencing it", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      media: [makeMediaAsset({ mediaId: "a" })],
      stepMedia: [null as never, makeStepMediaLink({ stepId: "step-1", mediaId: "a" })],
    });

    const result = markStepMeaningChanged(snapshot, "step-1");
    expect(result.stepMedia).toEqual([
      null,
      makeStepMediaLink({ stepId: "step-1", mediaId: "a", reviewNeeded: true }),
    ]);
  });

  test("returns an immutable clone when the known step has no media", () => {
    const snapshot = makeSnapshot({ recipes: [recipeWithSteps(["step-1"])] });
    const result = markStepMeaningChanged(snapshot, "step-1");
    expect(result).toEqual(snapshot);
    expect(result).not.toBe(snapshot);
    expect(result.recipes[0]).not.toBe(snapshot.recipes[0]);
  });

  test("rejects dangling retained media for the changed step", () => {
    const snapshot = makeSnapshot({
      recipes: [recipeWithSteps(["step-1"])],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "missing" })],
    });
    expect(() => markStepMeaningChanged(snapshot, "step-1")).toThrow(UnknownMediaAssetError);
  });
});

describe("mediaCoverageForRecipe", () => {
  test("rejects a direct null recipe input with a named domain error", () => {
    expect(() => mediaCoverageForRecipe(makeSnapshot(), null as never)).toThrow(
      InvalidStepMediaFieldError,
    );
    expect(() => deriveRecipeMediaCoverage(null as never, makeSnapshot())).toThrow(
      InvalidStepMediaFieldError,
    );
  });

  test("counts only resolved links for recipe steps and review warnings", () => {
    const recipe = recipeWithSteps(["step-1", "step-2"]);
    const snapshot = makeSnapshot({
      recipes: [recipe, recipeWithSteps(["other-step"])],
      media: [makeMediaAsset({ mediaId: "a" }), makeMediaAsset({ mediaId: "other" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "a", reviewNeeded: true }),
        makeStepMediaLink({ stepId: "step-2", mediaId: "dangling", reviewNeeded: true }),
        makeStepMediaLink({ stepId: "missing-step", mediaId: "a", reviewNeeded: true }),
        makeStepMediaLink({ stepId: "other-step", mediaId: "other", reviewNeeded: true }),
      ],
    });

    expect(mediaCoverageForRecipe(snapshot, recipe)).toEqual({ linked: 1, reviewNeeded: 1 });
  });

  test.each([
    ["sample", makeMediaAsset({ mediaId: "a", reviewState: "sample", localSessionOnly: false })],
    ["local-session sample", makeMediaAsset({ mediaId: "a", reviewState: "sample", localSessionOnly: true })],
  ])("does not treat %s media as verified kitchen coverage", (_name, asset) => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [asset],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "a", reviewNeeded: true })],
    });

    expect(mediaCoverageForRecipe(snapshot, recipe)).toEqual({ linked: 0, reviewNeeded: 0 });
    expect(deriveRecipeMediaCoverage(recipe, snapshot)).toEqual({
      coverage: { linked: 0, reviewNeeded: 0 },
      missingMedia: true,
      mediaReviewNeeded: false,
    });
  });

  test("counts non-local unreviewed media while keeping reviewNeeded link-driven", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [makeMediaAsset({ mediaId: "a", reviewState: "unreviewed", localSessionOnly: false })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "a", reviewNeeded: false })],
    });
    expect(deriveRecipeMediaCoverage(recipe, snapshot)).toEqual({
      coverage: { linked: 1, reviewNeeded: 0 },
      missingMedia: false,
      mediaReviewNeeded: false,
    });
  });

  test.each(["unreviewed", "confirmed"] as const)(
    "counts a genuine local-session %s upload as coverage",
    (reviewState) => {
      const recipe = recipeWithSteps(["step-1"]);
      const snapshot = makeSnapshot({
        recipes: [recipe],
        media: [makeMediaAsset({ mediaId: "a", reviewState, localSessionOnly: true })],
        stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "a", reviewNeeded: true })],
      });
      expect(deriveRecipeMediaCoverage(recipe, snapshot)).toEqual({
        coverage: { linked: 1, reviewNeeded: 1 },
        missingMedia: false,
        mediaReviewNeeded: true,
      });
    },
  );

  test("rejects a malformed resolved asset with context but ignores unreachable malformed assets", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const malformedResolved = makeMediaAsset({ mediaId: "a", localSessionOnly: "false" as never });
    const unrelated = makeMediaAsset({ mediaId: "other", crop: { x: Number.NaN, y: 0, width: 1, height: 1 } });
    const link = makeStepMediaLink({ stepId: "step-1", mediaId: "a" });

    expect(() => mediaCoverageForRecipe(makeSnapshot({ recipes: [recipe], media: [null as never, unrelated, malformedResolved], stepMedia: [link] }), recipe)).toThrow(InvalidMediaAssetFieldError);
    expect(mediaCoverageForRecipe(makeSnapshot({ recipes: [recipe], media: [null as never, unrelated], stepMedia: [link] }), recipe)).toEqual({ linked: 0, reviewNeeded: 0 });
  });

  test("ignores malformed and duplicate links outside the recipe's reachable steps", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [makeMediaAsset({ mediaId: "a" })],
      stepMedia: [
        null as never,
        makeStepMediaLink({ stepId: "step-1", mediaId: "a" }),
        makeStepMediaLink({ stepId: "other-step", mediaId: "a", order: 1 }),
        makeStepMediaLink({ stepId: "other-step", mediaId: "a", order: 1 }),
        { ...makeStepMediaLink(), stepId: "bad-step", mediaId: "bad", role: "bad" as never },
      ],
    });

    expect(mediaCoverageForRecipe(snapshot, recipe)).toEqual({ linked: 1, reviewNeeded: 0 });
  });

  test("ignores dangling target-step links before validating link metadata or order collisions", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [makeMediaAsset({ mediaId: "a" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: 1 }),
        { ...makeStepMediaLink(), stepId: "step-1", mediaId: "missing", order: 1, role: "bad" as never },
      ],
    });
    expect(mediaCoverageForRecipe(snapshot, recipe)).toEqual({ linked: 1, reviewNeeded: 0 });
  });

  test("clones nested media metadata without reference leakage", () => {
    const recipe = recipeWithSteps(["step-1"]);
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [makeMediaAsset({ mediaId: "a", crop: { x: 1, y: 2, width: 3, height: 4 }, focalPoint: { x: 5, y: 6 } })],
    });

    const result = markStepMeaningChanged(snapshot, "step-1");
    result.media[0].crop!.x = 99;
    result.media[0].focalPoint!.x = 99;

    expect(snapshot.media[0].crop?.x).toBe(1);
    expect(snapshot.media[0].focalPoint?.x).toBe(5);
  });

  test("derives missing-step and review warnings from the same resolved-link rules", () => {
    const recipe = recipeWithSteps(["step-1", "step-2"]);
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [makeMediaAsset({ mediaId: "a" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "a", reviewNeeded: true })],
    });

    expect(deriveRecipeMediaCoverage(recipe, snapshot)).toEqual({
      coverage: { linked: 1, reviewNeeded: 1 },
      missingMedia: true,
      mediaReviewNeeded: true,
    });
  });
});
