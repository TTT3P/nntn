import { describe, expect, test } from "vitest";
import { FixtureCookbookRepository } from "../data/FixtureCookbookRepository";
import type { CookbookSnapshot, RecipeVersion } from "../domain/cookbook/types";
import {
  makeIngredientLine,
  makeMediaAsset,
  makeRecipe,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../test/builders";
import {
  DanglingPrototypeExportLinkError,
  DuplicatePrototypeExportIdentityError,
  InvalidPrototypeExportFieldError,
  InvalidPrototypeExportTimestampError,
  exportPrototypeSnapshot,
} from "./snapshotExport";

const EXPORTED_AT = "2026-08-04T00:00:00.000Z";

function recipeWithWork(overrides: Partial<RecipeVersion> = {}): RecipeVersion {
  const line = makeIngredientLine({
    lineKey: "source-line",
    sourceText: "  1 ½ ช้อนโต๊ะ\nตามต้นฉบับ  ",
    sourceValue: 1.5,
    sourceUnit: "ช้อนโต๊ะ (เดิม)",
  });
  return makeRecipe({
    recipeId: "สูตร-01",
    recipeVersionId: "revision-verbatim",
    parentRecipeIds: [9, "root"],
    sourceLocators: ["หน้า 2", "หน้า 1"],
    lines: [line],
    methodText: "  ห้ามตัดช่องว่าง\nบรรทัดที่สอง  ",
    blockers: ["ตรวจหน่วยเดิม"],
    operationalNotes: ["หมายเหตุเดิม"],
    workDocuments: {
      service: {
        stage: "service",
        scalable: false,
        ingredientLineKeys: [line.lineKey],
        steps: [makeWorkStep({
          stepId: "service-step",
          stage: "service",
          instruction: "  จัดเสิร์ฟตามข้อความเดิม  ",
          order: 2,
        })],
      },
      prep: {
        stage: "prep",
        scalable: true,
        ingredientLineKeys: [line.lineKey],
        steps: [makeWorkStep({ stepId: "prep-step", instruction: "เตรียม", order: 1 })],
      },
    },
    ...overrides,
  });
}

describe("exportPrototypeSnapshot", () => {
  test("exports the complete versioned repository fixture through the same validated contract", async () => {
    const snapshot = await new FixtureCookbookRepository().loadSnapshot();

    const exported = exportPrototypeSnapshot(snapshot, EXPORTED_AT);

    expect(exported.recipes).toHaveLength(snapshot.recipes.length);
    expect(exported.media).toHaveLength(snapshot.media.length);
    expect(exported.stepMedia).toHaveLength(snapshot.stepMedia.length);
    expect(exported.media.every((asset) => asset.exportWarning === "binary-not-included")).toBe(true);
  });

  test("exports the exact versioned contract and warns only for session-only media", () => {
    const sessionAsset = makeMediaAsset({
      mediaId: "session-media",
      url: "blob:owned-preview",
      localSessionOnly: true,
    });
    const durableAsset = makeMediaAsset({
      mediaId: "fixture-media",
      url: "/sample-media/fixture.svg",
      localSessionOnly: false,
    });

    const exported = exportPrototypeSnapshot(
      makeSnapshot({ media: [sessionAsset, durableAsset] }),
      EXPORTED_AT,
    );

    expect(exported).toEqual({
      schemaVersion: "cookbook-prototype-v1",
      exportedAt: EXPORTED_AT,
      recipes: [makeRecipe()],
      media: [
        durableAsset,
        { ...sessionAsset, exportWarning: "binary-not-included" },
      ],
      stepMedia: [],
    });
    expect(exported.media[0]).not.toHaveProperty("exportWarning");
  });

  test("produces byte-equivalent JSON for shuffled top-level collections", () => {
    const first = recipeWithWork({
      recipeId: 2,
      recipeVersionId: "version-b",
      parentRecipeIds: [],
      workDocuments: {
        prep: {
          stage: "prep",
          scalable: true,
          ingredientLineKeys: [],
          steps: [makeWorkStep({ stepId: "first-step" })],
        },
      },
    });
    const second = recipeWithWork({ recipeId: 1, recipeVersionId: "version-a", parentRecipeIds: [] });
    const mediaA = makeMediaAsset({ mediaId: "a" });
    const mediaB = makeMediaAsset({ mediaId: "b" });
    const linkA = makeStepMediaLink({ stepId: "first-step", mediaId: "a", order: 1 });
    const linkB = makeStepMediaLink({ stepId: "service-step", mediaId: "b", order: 1 });
    const canonical = makeSnapshot({
      recipes: [second, first],
      media: [mediaA, mediaB],
      stepMedia: [linkA, linkB],
    });
    const shuffled = makeSnapshot({
      recipes: [first, second],
      media: [mediaB, mediaA],
      stepMedia: [linkB, linkA],
    });

    expect(JSON.stringify(exportPrototypeSnapshot(shuffled, EXPORTED_AT))).toBe(
      JSON.stringify(exportPrototypeSnapshot(canonical, EXPORTED_AT)),
    );
  });

  test("canonicalizes explicitly ordered work steps without changing their field values", () => {
    const early = makeWorkStep({ stepId: "ordered-early", order: 1, instruction: "  first  " });
    const late = makeWorkStep({ stepId: "ordered-late", order: 2, instruction: "second" });
    const recipe = recipeWithWork({
      parentRecipeIds: [],
      workDocuments: {
        prep: {
          stage: "prep",
          scalable: true,
          ingredientLineKeys: [],
          steps: [late, early],
        },
      },
    });

    const exported = exportPrototypeSnapshot(makeSnapshot({ recipes: [recipe] }), EXPORTED_AT);

    expect(exported.recipes[0]!.workDocuments.prep!.steps).toEqual([early, late]);
    expect(recipe.workDocuments.prep!.steps).toEqual([late, early]);
  });

  test("deep-clones declared fields while preserving source text, units, graph, revision, and work documents verbatim", () => {
    const recipe = recipeWithWork({ parentRecipeIds: [] });
    const sessionAsset = makeMediaAsset({
      mediaId: "session-media",
      url: "blob:session-preview-metadata",
      localSessionOnly: true,
      crop: { x: 1, y: 2, width: 3, height: 4 },
      focalPoint: { x: 5, y: 6 },
    });
    const snapshot = makeSnapshot({ recipes: [recipe], media: [sessionAsset] });

    const exported = exportPrototypeSnapshot(snapshot, EXPORTED_AT);

    expect(exported.recipes[0]).toEqual(recipe);
    expect(exported.recipes[0]).not.toBe(recipe);
    expect(exported.recipes[0]!.lines[0]).not.toBe(recipe.lines[0]);
    expect(exported.recipes[0]!.workDocuments.prep).not.toBe(recipe.workDocuments.prep);
    expect(exported.media[0]!.url).toBe("blob:session-preview-metadata");
    expect(exported.media[0]!.exportWarning).toBe("binary-not-included");

    exported.recipes[0]!.lines[0]!.sourceText = "changed export";
    exported.recipes[0]!.workDocuments.prep!.steps[0]!.instruction = "changed export";
    exported.media[0]!.crop!.x = 99;
    expect(recipe.lines[0]!.sourceText).toBe("  1 ½ ช้อนโต๊ะ\nตามต้นฉบับ  ");
    expect(recipe.workDocuments.prep!.steps[0]!.instruction).toBe("เตรียม");
    expect(sessionAsset.crop!.x).toBe(1);

    recipe.lines[0]!.sourceUnit = "changed source";
    sessionAsset.focalPoint!.x = 100;
    expect(exported.recipes[0]!.lines[0]!.sourceUnit).toBe("ช้อนโต๊ะ (เดิม)");
    expect(exported.media[0]!.focalPoint!.x).toBe(5);
  });

  test("reads every declared getter once before returning an independent export", () => {
    const source = recipeWithWork({ parentRecipeIds: [] });
    let nameReads = 0;
    let linesReads = 0;
    Object.defineProperty(source, "name", {
      configurable: true,
      enumerable: true,
      get() {
        nameReads += 1;
        return nameReads === 1 ? "captured once" : "TOCTOU value";
      },
    });
    Object.defineProperty(source, "lines", {
      configurable: true,
      enumerable: true,
      get() {
        linesReads += 1;
        return linesReads === 1 ? [makeIngredientLine({ lineKey: "source-line" })] : null;
      },
    });

    const exported = exportPrototypeSnapshot(makeSnapshot({ recipes: [source] }), EXPORTED_AT);

    expect(exported.recipes[0]!.name).toBe("captured once");
    expect(exported.recipes[0]!.lines).toHaveLength(1);
    expect(nameReads).toBe(1);
    expect(linesReads).toBe(1);
  });

  test.each([
    ["snapshot.media", { recipes: [], media: null, stepMedia: [] }],
    ["snapshot.recipes[0].lines", makeSnapshot({ recipes: [makeRecipe({ lines: {} as never })] })],
    ["snapshot.media[0].crop.width", makeSnapshot({ media: [makeMediaAsset({ crop: { x: 0, y: 0, width: Number.NaN, height: 1 } })] })],
    ["snapshot.stepMedia[0].order", makeSnapshot({ stepMedia: [{ ...makeStepMediaLink(), order: 0 }] })],
  ] as const)("fails closed with a contextual field error for %s", (_field, value) => {
    expect(() => exportPrototypeSnapshot(value as CookbookSnapshot, EXPORTED_AT)).toThrow(
      InvalidPrototypeExportFieldError,
    );
    try {
      exportPrototypeSnapshot(value as CookbookSnapshot, EXPORTED_AT);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPrototypeExportFieldError);
      expect((error as InvalidPrototypeExportFieldError).path).toBe(_field);
      expect(error).not.toBeInstanceOf(TypeError);
    }
  });

  test("wraps hostile getter failures in a named contextual error", () => {
    const recipe = makeRecipe();
    Object.defineProperty(recipe, "name", {
      enumerable: true,
      get() {
        throw new TypeError("hostile getter");
      },
    });

    expect(() => exportPrototypeSnapshot(makeSnapshot({ recipes: [recipe] }), EXPORTED_AT)).toThrow(
      expect.objectContaining({
        name: "InvalidPrototypeExportFieldError",
        path: "snapshot.recipes[0].name",
      }),
    );
  });

  test.each([
    makeSnapshot({ recipes: [makeRecipe(), makeRecipe()] }),
    makeSnapshot({ media: [makeMediaAsset(), makeMediaAsset()] }),
    makeSnapshot({
      recipes: [recipeWithWork({ parentRecipeIds: [] })],
      media: [makeMediaAsset({ mediaId: "a" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "prep-step", mediaId: "a", order: 1 }),
        makeStepMediaLink({ stepId: "prep-step", mediaId: "a", order: 2 }),
      ],
    }),
  ])("rejects duplicate identities without mutation", (snapshot) => {
    expect(() => exportPrototypeSnapshot(snapshot, EXPORTED_AT)).toThrow(
      DuplicatePrototypeExportIdentityError,
    );
  });

  test.each([
    makeSnapshot({ stepMedia: [makeStepMediaLink({ stepId: "missing", mediaId: "missing" })] }),
    makeSnapshot({
      recipes: [recipeWithWork({ parentRecipeIds: [] })],
      stepMedia: [makeStepMediaLink({ stepId: "prep-step", mediaId: "missing" })],
    }),
  ])("rejects dangling step/media graph links with a named error", (snapshot) => {
    expect(() => exportPrototypeSnapshot(snapshot, EXPORTED_AT)).toThrow(
      DanglingPrototypeExportLinkError,
    );
  });

  test.each([
    [
      "snapshot.recipes[0].parentRecipeIds[0]",
      makeSnapshot({ recipes: [makeRecipe({ parentRecipeIds: [888] })] }),
    ],
    [
      "snapshot.recipes[0].lines[0].componentRecipeId",
      makeSnapshot({
        recipes: [makeRecipe({
          lines: [makeIngredientLine({
            itemKind: "prepared_recipe",
            ingredientId: null,
            componentRecipeId: 999,
          })],
        })],
      }),
    ],
  ] as const)("rejects an unresolved or cross-kind graph reference at %s", (path, snapshot) => {
    try {
      exportPrototypeSnapshot(snapshot, EXPORTED_AT);
      throw new Error("expected export to reject graph reference");
    } catch (error) {
      expect(error).toBeInstanceOf(DanglingPrototypeExportLinkError);
      expect(error).toMatchObject({ path });
    }
  });

  test.each([
    [
      "snapshot.recipes[0].lines[0].ingredientId",
      "<number>",
      makeSnapshot({
        recipes: [
          makeRecipe({
            recipeId: 1,
            recipeVersionId: "owner-version",
            lines: [makeIngredientLine({
              itemKind: "prepared_recipe",
              ingredientId: 123,
              componentRecipeId: 2,
            })],
          }),
          makeRecipe({ recipeId: 2, recipeVersionId: "component-version" }),
        ],
      }),
    ],
    [
      "snapshot.recipes[0].lines[0].componentRecipeId",
      "<number>",
      makeSnapshot({
        recipes: [makeRecipe({
          lines: [makeIngredientLine({
            itemKind: "direct_ingredient",
            ingredientId: 123,
            componentRecipeId: 2,
          })],
        })],
      }),
    ],
    [
      "snapshot.recipes[0].lines[0].componentRecipeId",
      "<null>",
      makeSnapshot({
        recipes: [makeRecipe({
          lines: [makeIngredientLine({
            itemKind: "prepared_recipe",
            ingredientId: null,
            componentRecipeId: null,
          })],
        })],
      }),
    ],
  ] as const)("rejects a wrong-kind or missing line target at %s", (path, value, snapshot) => {
    try {
      exportPrototypeSnapshot(snapshot, EXPORTED_AT);
      throw new Error("expected exact-one-target rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPrototypeExportFieldError);
      expect(error).toMatchObject({ path, value });
    }
  });

  test("captures ingredient and component target getters once before validating the captured values", () => {
    const line = makeIngredientLine({
      itemKind: "prepared_recipe",
      ingredientId: null,
      componentRecipeId: 2,
    });
    let ingredientReads = 0;
    let componentReads = 0;
    Object.defineProperty(line, "ingredientId", {
      enumerable: true,
      get() {
        ingredientReads += 1;
        return ingredientReads === 1 ? null : 123;
      },
    });
    Object.defineProperty(line, "componentRecipeId", {
      enumerable: true,
      get() {
        componentReads += 1;
        return componentReads === 1 ? 2 : null;
      },
    });
    const snapshot = makeSnapshot({
      recipes: [
        makeRecipe({ recipeId: 1, recipeVersionId: "owner", lines: [line] }),
        makeRecipe({ recipeId: 2, recipeVersionId: "component" }),
      ],
    });

    const exported = exportPrototypeSnapshot(snapshot, EXPORTED_AT);

    expect(exported.recipes.find((recipe) => recipe.recipeId === 1)!.lines[0]).toMatchObject({
      ingredientId: null,
      componentRecipeId: 2,
    });
    expect(ingredientReads).toBe(1);
    expect(componentReads).toBe(1);
  });

  test("resolves numeric and numeric-looking string graph identities without cross-kind coercion", () => {
    const numeric = makeRecipe({
      recipeId: 1,
      recipeVersionId: "numeric-version",
      parentRecipeIds: ["1"],
      lines: [makeIngredientLine({
        lineKey: "numeric:string-component",
        itemKind: "prepared_recipe",
        ingredientId: null,
        componentRecipeId: "1",
      })],
    });
    const text = makeRecipe({
      recipeId: "1",
      recipeVersionId: "string-version",
      parentRecipeIds: [1],
    });

    expect(() => exportPrototypeSnapshot(
      makeSnapshot({ recipes: [numeric, text] }),
      EXPORTED_AT,
    )).not.toThrow();

    numeric.lines[0]!.componentRecipeId = "missing";
    expect(() => exportPrototypeSnapshot(
      makeSnapshot({ recipes: [numeric, text] }),
      EXPORTED_AT,
    )).toThrow(DanglingPrototypeExportLinkError);
  });

  test("preserves known self-references for the domain cycle detector instead of recursing", () => {
    const cyclic = makeRecipe({
      recipeId: "self",
      parentRecipeIds: ["self"],
      lines: [makeIngredientLine({
        itemKind: "prepared_recipe",
        ingredientId: null,
        componentRecipeId: "self",
      })],
    });

    const exported = exportPrototypeSnapshot(makeSnapshot({ recipes: [cyclic] }), EXPORTED_AT);

    expect(exported.recipes[0]!.parentRecipeIds).toEqual(["self"]);
    expect(exported.recipes[0]!.lines[0]!.componentRecipeId).toBe("self");
  });

  test.each([
    ["snapshot", () => {
      const revoked = Proxy.revocable({}, {});
      revoked.revoke();
      return revoked.proxy;
    }],
    ["snapshot.recipes", () => {
      const revoked = Proxy.revocable([], {});
      revoked.revoke();
      return { recipes: revoked.proxy, media: [], stepMedia: [] };
    }],
    ["snapshot.recipes[0]", () => {
      const revoked = Proxy.revocable({}, {});
      revoked.revoke();
      return makeSnapshot({ recipes: [revoked.proxy as never] });
    }],
    ["snapshot.recipes[0].lines", () => {
      const revoked = Proxy.revocable([], {});
      revoked.revoke();
      return makeSnapshot({ recipes: [makeRecipe({ lines: revoked.proxy as never })] });
    }],
    ["snapshot.recipes[0].workDocuments", () => {
      const revoked = Proxy.revocable({}, {});
      revoked.revoke();
      return makeSnapshot({ recipes: [makeRecipe({ workDocuments: revoked.proxy as never })] });
    }],
    ["snapshot.media[0]", () => {
      const revoked = Proxy.revocable({}, {});
      revoked.revoke();
      return makeSnapshot({ media: [revoked.proxy as never] });
    }],
    ["snapshot.stepMedia[0]", () => {
      const revoked = Proxy.revocable({}, {});
      revoked.revoke();
      return makeSnapshot({ stepMedia: [revoked.proxy as never] });
    }],
  ] as const)("wraps revoked proxy traps at %s without leaking a raw TypeError", (path, makeValue) => {
    try {
      exportPrototypeSnapshot(makeValue() as CookbookSnapshot, EXPORTED_AT);
      throw new Error("expected revoked proxy rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPrototypeExportFieldError);
      expect(error).toMatchObject({ path });
      expect(error).not.toBeInstanceOf(TypeError);
    }
  });

  test("rejects an array proxy with a hostile length instead of silently exporting an empty container", () => {
    const recipes = new Proxy([], {
      get(target, property, receiver) {
        if (property === "length") return -1;
        return Reflect.get(target, property, receiver);
      },
    });

    expect(() => exportPrototypeSnapshot(
      { recipes, media: [], stepMedia: [] },
      EXPORTED_AT,
    )).toThrow(expect.objectContaining({
      name: "InvalidPrototypeExportFieldError",
      path: "snapshot.recipes.length",
    }));
  });

  test("stores only a sanitized value category for invalid hostile fields", () => {
    const snapshot = makeSnapshot({
      media: [makeMediaAsset({ caption: Symbol("do-not-echo") as never })],
    });

    try {
      exportPrototypeSnapshot(snapshot, EXPORTED_AT);
      throw new Error("expected invalid caption rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPrototypeExportFieldError);
      expect(error).toMatchObject({ value: "<symbol>" });
      expect((error as Error).message).not.toContain("do-not-echo");
    }
  });

  test.each([
    "",
    "2026-08-04",
    "2026-08-04T00:00:00Z",
    "not-a-date",
    "2026-08-04T00:00:00.000+07:00",
  ])("rejects a non-canonical injected timestamp: %s", (timestamp) => {
    expect(() => exportPrototypeSnapshot(makeSnapshot(), timestamp)).toThrow(
      InvalidPrototypeExportTimestampError,
    );
  });

  test("rejects embedded file and data media URLs without coercion", () => {
    for (const url of ["data:image/png;base64,AAAA", "file:///tmp/secret.png"]) {
      const snapshot = makeSnapshot({ media: [makeMediaAsset({ url })] });
      expect(() => exportPrototypeSnapshot(snapshot, EXPORTED_AT)).toThrow(
        InvalidPrototypeExportFieldError,
      );
    }
  });
});
