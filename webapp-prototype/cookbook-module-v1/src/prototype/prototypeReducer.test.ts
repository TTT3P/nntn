import { describe, expect, test } from "vitest";
import {
  makeMediaAsset,
  makeRecipe,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../test/builders";
import {
  DuplicateMediaAssetError,
  DuplicateStepMediaLinkError,
  InvalidPrototypeRecipeIdentityError,
  InvalidRecipeNoteError,
  InvalidSessionMediaIdentityError,
  MediaAssetLinkMismatchError,
  StepMediaTargetMismatchError,
  UnknownMediaAssetError,
  UnknownPrototypeActionError,
  UnknownRecipeIdentityError,
  UnknownWorkStepError,
  createPrototypeState,
  prototypeReducer,
} from "./prototypeReducer";

function makeSnapshotWithStep() {
  return makeSnapshot({
    recipes: [
      makeRecipe({
        workDocuments: {
          prep: {
            stage: "prep",
            scalable: true,
            ingredientLineKeys: [],
            steps: [makeWorkStep()],
          },
        },
      }),
    ],
  });
}

describe("prototypeReducer", () => {
  test("session edits target the exact recipe identity without claiming durable persistence", () => {
    const numericRecipe = makeRecipe({ recipeId: 1, name: "หมายเลข" });
    const stringRecipe = makeRecipe({ recipeId: "1", name: "ข้อความ" });
    const initialState = createPrototypeState(
      makeSnapshot({ recipes: [numericRecipe, stringRecipe] }),
    );

    const next = prototypeReducer(initialState, {
      type: "set-recipe-note",
      recipeId: "1",
      note: "ตรวจที่ครัวอีกครั้ง",
    });

    expect(next.snapshot.recipes).toEqual([
      numericRecipe,
      { ...stringRecipe, operationalNotes: ["ตรวจที่ครัวอีกครั้ง"] },
    ]);
    expect(next.dirty).toBe(true);
    expect(next.persistence).toBe("session");
    expect(initialState.snapshot.recipes).toEqual([numericRecipe, stringRecipe]);
  });

  test("unknown recipe identities fail clearly", () => {
    const initialState = createPrototypeState(
      makeSnapshot({ recipes: [makeRecipe({ recipeId: 1 })] }),
    );

    expect(() =>
      prototypeReducer(initialState, {
        type: "set-recipe-note",
        recipeId: "1",
        note: "ต้องไม่จับคู่กับหมายเลข 1",
      }),
    ).toThrow(UnknownRecipeIdentityError);
  });

  test.each([
    { recipeId: "", note: "บันทึก" },
    { recipeId: "\u200b", note: "บันทึก" },
    { recipeId: Number.NaN, note: "บันทึก" },
    { recipeId: Number.POSITIVE_INFINITY, note: "บันทึก" },
    { recipeId: null, note: "บันทึก" },
  ])("rejects malformed recipe identities without mutation", (payload) => {
    const state = createPrototypeState(makeSnapshot());
    const before = structuredClone(state);

    expect(() =>
      prototypeReducer(state, {
        type: "set-recipe-note",
        recipeId: payload.recipeId,
        note: payload.note,
      } as never),
    ).toThrow(InvalidPrototypeRecipeIdentityError);
    expect(state).toEqual(before);
  });

  test.each([undefined, null, "", "   ", "\u200b", "\u200f\u2060"])(
    "rejects a blank or non-string recipe note without mutation",
    (note) => {
      const state = createPrototypeState(makeSnapshot());
      const before = structuredClone(state);

      expect(() =>
        prototypeReducer(state, {
          type: "set-recipe-note",
          recipeId: 1,
          note,
        } as never),
      ).toThrow(InvalidRecipeNoteError);
      expect(state).toEqual(before);
    },
  );

  test("preserves valid recipe note text exactly", () => {
    const state = createPrototypeState(makeSnapshot());

    const next = prototypeReducer(state, {
      type: "set-recipe-note",
      recipeId: 1,
      note: "  ตรวจอีกครั้ง  ",
    });

    expect(next.snapshot.recipes[0]!.operationalNotes).toEqual([
      "  ตรวจอีกครั้ง  ",
    ]);
  });

  test("unknown action types fail closed without mutation", () => {
    const state = createPrototypeState(makeSnapshot());
    const before = structuredClone(state);

    expect(() =>
      prototypeReducer(state, { type: "invented-action" } as never),
    ).toThrow(UnknownPrototypeActionError);
    expect(state).toEqual(before);
  });

  test("initial and current snapshots are independent deep clones", () => {
    const source = makeSnapshot({
      recipes: [
        makeRecipe({
          operationalNotes: ["ต้นฉบับ"],
          workDocuments: {
            prep: {
              stage: "prep",
              scalable: true,
              ingredientLineKeys: [],
              steps: [],
            },
          },
        }),
      ],
    });

    const state = createPrototypeState(source);
    source.recipes[0]!.operationalNotes.push("แก้ภายนอก");
    state.snapshot.recipes[0]!.operationalNotes.push("แก้สถานะปัจจุบัน");

    expect(state.initialSnapshot.recipes[0]!.operationalNotes).toEqual([
      "ต้นฉบับ",
    ]);
    expect(state.snapshot.recipes[0]!.operationalNotes).toEqual([
      "ต้นฉบับ",
      "แก้สถานะปัจจุบัน",
    ]);
  });

  test("reset restores a fresh clone of the loaded snapshot", () => {
    const initialSnapshot = makeSnapshot({
      recipes: [makeRecipe({ operationalNotes: ["ต้นฉบับ"] })],
    });
    const editedState = prototypeReducer(createPrototypeState(initialSnapshot), {
      type: "set-recipe-note",
      recipeId: 1,
      note: "ฉบับแก้",
    });

    const firstReset = prototypeReducer(editedState, { type: "reset-session" });
    firstReset.snapshot.recipes[0]!.operationalNotes.push("แก้หลังรีเซ็ต");
    const secondReset = prototypeReducer(firstReset, { type: "reset-session" });

    expect(secondReset.snapshot).toEqual(initialSnapshot);
    expect(secondReset.snapshot).not.toBe(secondReset.initialSnapshot);
    expect(secondReset.dirty).toBe(false);
    expect(secondReset.persistence).toBe("session");
  });

  test("replace-snapshot clones its payload and marks the session dirty", () => {
    const replacement = makeSnapshot({
      recipes: [makeRecipe({ name: "ฉบับใหม่" })],
    });

    const next = prototypeReducer(createPrototypeState(makeSnapshot()), {
      type: "replace-snapshot",
      snapshot: replacement,
    });
    replacement.recipes[0]!.name = "แก้ payload ภายนอก";

    expect(next.snapshot.recipes[0]!.name).toBe("ฉบับใหม่");
    expect(next.dirty).toBe(true);
    expect(next.persistence).toBe("session");
  });

  test("media actions clone payloads and preserve deterministic order", () => {
    const asset = makeMediaAsset();
    const link = makeStepMediaLink();
    const added = prototypeReducer(createPrototypeState(makeSnapshotWithStep()), {
      type: "add-session-media",
      asset,
      link,
    });
    asset.altText = "แก้ payload ภายนอก";
    link.role = "final";

    expect(added.snapshot.media).toEqual([
      expect.objectContaining({ mediaId: "test-media-1", altText: "รูปประกอบขั้นตอนทดสอบ" }),
    ]);
    expect(added.snapshot.stepMedia).toEqual([
      expect.objectContaining({ mediaId: "test-media-1", role: "during" }),
    ]);

    const withSecondAsset = prototypeReducer(added, {
      type: "add-session-media",
      asset: makeMediaAsset({ mediaId: "second" }),
      link: makeStepMediaLink({ mediaId: "second", order: 2 }),
    });
    const mediaReady = prototypeReducer(withSecondAsset, {
      type: "add-session-media",
      asset: makeMediaAsset({ mediaId: "first" }),
      link: makeStepMediaLink({ mediaId: "first", order: 1 }),
    });
    const first = makeStepMediaLink({ mediaId: "second", order: 2 });
    const second = makeStepMediaLink({ mediaId: "first", order: 1 });
    const replaced = prototypeReducer(mediaReady, {
      type: "replace-step-media",
      stepId: link.stepId,
      links: [first, second],
    });
    first.order = 99;

    expect(replaced.snapshot.stepMedia).toEqual([
      expect.objectContaining({ mediaId: "second", order: 2 }),
      expect.objectContaining({ mediaId: "first", order: 1 }),
    ]);
    expect(replaced.dirty).toBe(true);
    expect(added.snapshot.stepMedia).toHaveLength(1);
  });

  test("domain media actions reuse assets, reorder exact links, and flag revisions", () => {
    const recipe = makeRecipe({
      workDocuments: {
        prep: {
          stage: "prep",
          scalable: true,
          ingredientLineKeys: [],
          steps: [
            makeWorkStep({ stepId: "step-1" }),
            makeWorkStep({ stepId: "step-2", order: 2 }),
          ],
        },
      },
    });
    const state = createPrototypeState(makeSnapshot({
      recipes: [recipe],
      media: [makeMediaAsset({ mediaId: "a" }), makeMediaAsset({ mediaId: "b" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "a" }),
        makeStepMediaLink({ stepId: "step-1", mediaId: "b", order: 2 }),
      ],
    }));

    const attached = prototypeReducer(state, {
      type: "attach-existing-media",
      link: { stepId: "step-2", mediaId: "a", role: "checkpoint", vessel: null },
    });
    const reordered = prototypeReducer(attached, {
      type: "reorder-step-media",
      stepId: "step-1",
      mediaIds: ["b", "a"],
    });
    const revised = prototypeReducer(reordered, {
      type: "mark-step-meaning-changed",
      stepId: "step-1",
    });

    expect(revised.snapshot.media).toHaveLength(2);
    expect(revised.snapshot.stepMedia.filter((link) => link.stepId === "step-1")).toEqual([
      expect.objectContaining({ mediaId: "b", order: 1, reviewNeeded: true }),
      expect.objectContaining({ mediaId: "a", order: 2, reviewNeeded: true }),
    ]);
    expect(revised.snapshot.stepMedia.find((link) => link.stepId === "step-2")).toEqual(
      expect.objectContaining({ mediaId: "a", order: 1, reviewNeeded: false }),
    );
    expect(revised.dirty).toBe(true);
    expect(state.snapshot.stepMedia.map((link) => link.mediaId)).toEqual(["a", "b"]);
  });

  test("media actions reject mismatched asset and step identities", () => {
    const state = createPrototypeState(makeSnapshotWithStep());

    expect(() =>
      prototypeReducer(state, {
        type: "add-session-media",
        asset: makeMediaAsset({ mediaId: "asset" }),
        link: makeStepMediaLink({ mediaId: "other" }),
      }),
    ).toThrow(MediaAssetLinkMismatchError);

    expect(() =>
      prototypeReducer(state, {
        type: "replace-step-media",
        stepId: "test-v1-1:prep:1",
        links: [makeStepMediaLink({ stepId: "other-step" })],
      }),
    ).toThrow(StepMediaTargetMismatchError);
  });

  test("add-session-media validates references and duplicates atomically", () => {
    const base = makeSnapshotWithStep();
    const existingAsset = makeMediaAsset({ mediaId: "existing" });
    const existingLink = makeStepMediaLink({ mediaId: "existing" });
    const state = createPrototypeState({
      ...base,
      media: [existingAsset],
      stepMedia: [existingLink],
    });
    const before = structuredClone(state);

    expect(() =>
      prototypeReducer(state, {
        type: "add-session-media",
        asset: makeMediaAsset({ mediaId: "existing" }),
        link: makeStepMediaLink({ mediaId: "existing", order: 2 }),
      }),
    ).toThrow(DuplicateMediaAssetError);
    expect(() =>
      prototypeReducer(state, {
        type: "add-session-media",
        asset: makeMediaAsset({ mediaId: "new" }),
        link: makeStepMediaLink({ mediaId: "new", stepId: "missing-step" }),
      }),
    ).toThrow(UnknownWorkStepError);
    expect(() =>
      prototypeReducer(state, {
        type: "add-session-media",
        asset: makeMediaAsset({ mediaId: "another" }),
        link: makeStepMediaLink({ mediaId: "another" }),
      }),
    ).not.toThrow();
    const duplicatePairState = createPrototypeState({
      ...base,
      media: [],
      stepMedia: [makeStepMediaLink({ mediaId: "orphan" })],
    });
    expect(() =>
      prototypeReducer(duplicatePairState, {
        type: "add-session-media",
        asset: makeMediaAsset({ mediaId: "orphan" }),
        link: makeStepMediaLink({ mediaId: "orphan" }),
      }),
    ).toThrow(DuplicateStepMediaLinkError);
    expect(state).toEqual(before);
  });

  test("add-session-media rejects blank runtime identifiers", () => {
    const state = createPrototypeState(makeSnapshotWithStep());

    expect(() =>
      prototypeReducer(state, {
        type: "add-session-media",
        asset: makeMediaAsset({ mediaId: "\u200b" }),
        link: makeStepMediaLink({ mediaId: "\u200b" }),
      }),
    ).toThrow(InvalidSessionMediaIdentityError);
  });

  test("replace-step-media validates target, assets, and pair uniqueness atomically", () => {
    const base = makeSnapshotWithStep();
    const state = createPrototypeState({
      ...base,
      media: [
        makeMediaAsset({ mediaId: "first" }),
        makeMediaAsset({ mediaId: "second" }),
      ],
      stepMedia: [makeStepMediaLink({ mediaId: "first" })],
    });
    const before = structuredClone(state);

    expect(() =>
      prototypeReducer(state, {
        type: "replace-step-media",
        stepId: "missing-step",
        links: [],
      }),
    ).toThrow(UnknownWorkStepError);
    expect(() =>
      prototypeReducer(state, {
        type: "replace-step-media",
        stepId: "test-v1-1:prep:1",
        links: [makeStepMediaLink({ mediaId: "missing-media" })],
      }),
    ).toThrow(UnknownMediaAssetError);
    expect(() =>
      prototypeReducer(state, {
        type: "replace-step-media",
        stepId: "test-v1-1:prep:1",
        links: [
          makeStepMediaLink({ mediaId: "second", order: 1 }),
          makeStepMediaLink({ mediaId: "second", order: 2 }),
        ],
      }),
    ).toThrow(DuplicateStepMediaLinkError);
    expect(state).toEqual(before);
  });

  test("replace-step-media rejects duplicate pairs remaining in the final state", () => {
    const recipe = makeRecipe({
      workDocuments: {
        prep: {
          stage: "prep",
          scalable: true,
          ingredientLineKeys: [],
          steps: [
            makeWorkStep(),
            makeWorkStep({ stepId: "test-v1-1:prep:2", order: 2 }),
          ],
        },
      },
    });
    const duplicatedOtherStep = makeStepMediaLink({
      stepId: "test-v1-1:prep:2",
      mediaId: "existing",
    });
    const state = createPrototypeState(
      makeSnapshot({
        recipes: [recipe],
        media: [makeMediaAsset({ mediaId: "existing" })],
        stepMedia: [duplicatedOtherStep, structuredClone(duplicatedOtherStep)],
      }),
    );
    const before = structuredClone(state);

    expect(() =>
      prototypeReducer(state, {
        type: "replace-step-media",
        stepId: "test-v1-1:prep:1",
        links: [],
      }),
    ).toThrow(DuplicateStepMediaLinkError);
    expect(state).toEqual(before);
  });

  test("media step lookup traverses recipes with numeric and string identities", () => {
    const stringRecipe = makeRecipe({
      recipeId: "1",
      recipeVersionId: "string-v1",
      workDocuments: {
        cook: {
          stage: "cook",
          scalable: true,
          ingredientLineKeys: [],
          steps: [makeWorkStep({ stepId: "string-v1:cook:1", stage: "cook" })],
        },
      },
    });
    const state = createPrototypeState(
      makeSnapshot({ recipes: [makeRecipe({ recipeId: 1 }), stringRecipe] }),
    );

    const next = prototypeReducer(state, {
      type: "add-session-media",
      asset: makeMediaAsset({ mediaId: "string-step-media" }),
      link: makeStepMediaLink({
        stepId: "string-v1:cook:1",
        mediaId: "string-step-media",
      }),
    });

    expect(next.snapshot.stepMedia[0]?.stepId).toBe("string-v1:cook:1");
  });
});
