import { describe, expect, test } from "vitest";

import { makeIngredientLine, makeRecipe } from "../../test/builders";
import {
  buildReviewQueue,
  DuplicateReviewQueueRecipeIdentityError,
  DuplicateReviewQueueRecipeVersionIdError,
  evaluateReadiness,
  InvalidIngredientSourceEvidenceError,
  InvalidIngredientSourceValueError,
  InvalidIngredientItemNameError,
  InvalidMediaCoverageError,
  InvalidRecipeIdentityError,
  InvalidRecipeLineKeyError,
  InvalidRecipeNameError,
  InvalidRecipeReviewStateError,
  InvalidRecipeVersionIdError,
  DuplicateRecipeLineKeyError,
} from "./readiness";

const noMedia = { linked: 0, reviewNeeded: 0 };

describe("evaluateReadiness", () => {
  test.each([null, "", "   \n\t"])(
    "missing or blank method %j blocks approved printing",
    (methodText) => {
      const result = evaluateReadiness(makeRecipe({ methodText }), noMedia);

      expect(result).toEqual({
        printableAsApproved: false,
        draft: true,
        missingMethod: true,
        blockers: ["Add a method for สูตรทดสอบ"],
        mediaGap: true,
        mediaReviewNeeded: false,
      });
    },
  );

  test.each(["\uFE0F", "\u034F", "\u0301"])(
    "mark-only method %j blocks approved printing",
    (methodText) => {
      const recipe = makeRecipe({ methodText });

      expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([
        "Add a method for สูตรทดสอบ",
      ]);
      expect(evaluateReadiness(recipe, noMedia).missingMethod).toBe(true);
      expect(recipe.methodText).toBe(methodText);
    },
  );

  test("explicit recipe blockers are retained in source order and deduplicated", () => {
    const recipe = makeRecipe({
      blockers: ["Confirm simmer time", "Confirm yield", "Confirm simmer time"],
    });

    const first = evaluateReadiness(recipe, noMedia);
    first.blockers.push("mutated result");
    const second = evaluateReadiness(recipe, noMedia);

    expect(second.blockers).toEqual(["Confirm simmer time", "Confirm yield"]);
    expect(recipe.blockers).toEqual([
      "Confirm simmer time",
      "Confirm yield",
      "Confirm simmer time",
    ]);
  });

  test("a visible base character followed by a combining mark is not a missing method", () => {
    expect(
      evaluateReadiness(makeRecipe({ methodText: "ก\u0301" }), noMedia)
        .missingMethod,
    ).toBe(false);
  });

  test("deduplicates an explicit blocker equal to a generated message after rendering", () => {
    const recipe = makeRecipe({
      methodText: null,
      blockers: ["Add a method for สูตรทดสอบ", "Confirm original source"],
    });

    const first = evaluateReadiness(recipe, noMedia);
    first.blockers.push("mutated result");

    expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([
      "Add a method for สูตรทดสอบ",
      "Confirm original source",
    ]);
    expect(recipe.blockers).toEqual([
      "Add a method for สูตรทดสอบ",
      "Confirm original source",
    ]);
  });

  test.each([
    ["candidate", true, []],
    ["confirmed", true, []],
    ["conflict", false, ["Resolve conflicting sources for สูตรทดสอบ"]],
    ["blocked", false, ["Resolve blocked review for สูตรทดสอบ"]],
  ] as const)(
    "%s review state retains its distinct print-readiness semantics",
    (reviewState, printableAsApproved, blockers) => {
      const result = evaluateReadiness(makeRecipe({ reviewState }), {
        linked: 1,
        reviewNeeded: 0,
      });

      expect(result.printableAsApproved).toBe(printableAsApproved);
      expect(result.draft).toBe(!printableAsApproved);
      expect(result.blockers).toEqual(blockers);
    },
  );

  test.each(["reviewed", "", undefined, null])(
    "rejects malformed runtime reviewState %j with a named error",
    (reviewState) => {
      const recipe = makeRecipe();
      recipe.reviewState = reviewState as never;

      expect(() => evaluateReadiness(recipe, noMedia)).toThrow(
        InvalidRecipeReviewStateError,
      );
    },
  );

  test.each([
    ["object", {}],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["fraction", 1.5],
    ["blank", "  \n"],
    ["zero-width", "\u200B"],
    ["surrogate-only", "\ud800"],
    ["variation-selector-only", "\uFE0F"],
    ["combining-grapheme-joiner-only", "\u034F"],
    ["combining-accent-only", "\u0301"],
  ])("rejects malformed runtime recipe identity %s", (_label, recipeId) => {
    const recipe = makeRecipe();
    recipe.recipeId = recipeId as never;

    expect(() => evaluateReadiness(recipe, noMedia)).toThrow(
      InvalidRecipeIdentityError,
    );
  });

  test.each([
    ["prepared undefined", "prepared_recipe", undefined],
    ["prepared object", "prepared_recipe", {}],
    ["direct fractional", "direct_ingredient", 1.2],
    ["direct invisible", "direct_ingredient", "\u200B"],
  ] as const)(
    "rejects malformed %s component identity",
    (_label, itemKind, componentRecipeId) => {
      const line = makeIngredientLine({ itemKind });
      line.componentRecipeId = componentRecipeId as never;

      expect(() =>
        evaluateReadiness(makeRecipe({ lines: [line] }), noMedia),
      ).toThrow(InvalidRecipeIdentityError);
    },
  );

  test("keeps a null prepared component as a blocker rather than a validation error", () => {
    const recipe = makeRecipe({
      lines: [
        makeIngredientLine({
          lineKey: "stock-line",
          itemKind: "prepared_recipe",
          componentRecipeId: null,
          itemName: "น้ำซุป",
        }),
      ],
    });

    expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([
      "Link the prepared recipe for น้ำซุป (line stock-line)",
    ]);
  });

  test.each(["", " \n", "\u200B", "\u0000\u200D", "\ud800"])(
    "rejects non-meaningful recipe names %j",
    (name) => {
      expect(() =>
        evaluateReadiness(makeRecipe({ name }), noMedia),
      ).toThrow(InvalidRecipeNameError);
    },
  );

  test.each(["", " \n", "\u200B", "\u0000\u200D", "\ud800"])(
    "rejects non-meaningful recipe version identities %j",
    (recipeVersionId) => {
      expect(() =>
        evaluateReadiness(makeRecipe({ recipeVersionId }), noMedia),
      ).toThrow(InvalidRecipeVersionIdError);
    },
  );

  test.each(["", " \n", "\u200B", "\u0000\u200D", "\ud800"])(
    "rejects non-meaningful line keys %j",
    (lineKey) => {
      const recipe = makeRecipe({ lines: [makeIngredientLine({ lineKey })] });

      expect(() => evaluateReadiness(recipe, noMedia)).toThrow(
        InvalidRecipeLineKeyError,
      );
    },
  );

  test("rejects an invisible-only ingredient name used in review questions", () => {
    const recipe = makeRecipe({
      lines: [makeIngredientLine({ itemName: "\u200B" })],
    });

    expect(() => evaluateReadiness(recipe, noMedia)).toThrow(
      InvalidIngredientItemNameError,
    );
  });

  test("rejects duplicate line keys with recipe and line context", () => {
    const recipe = makeRecipe({
      lines: [
        makeIngredientLine({ lineKey: "same", itemName: "เกลือ" }),
        makeIngredientLine({ lineKey: "same", itemName: "น้ำตาล" }),
      ],
    });

    expect(() => evaluateReadiness(recipe, noMedia)).toThrow(
      DuplicateRecipeLineKeyError,
    );
    try {
      evaluateReadiness(recipe, noMedia);
    } catch (error) {
      expect(error).toMatchObject({ recipeId: 1, lineKey: "same" });
    }
  });

  test("an unresolved prepared dependency blocks with a human-facing question", () => {
    const recipe = makeRecipe({
      lines: [
        makeIngredientLine({
          itemName: "น้ำซุปหลัก",
          itemKind: "prepared_recipe",
          componentRecipeId: null,
        }),
      ],
    });

    expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([
      "Link the prepared recipe for น้ำซุปหลัก (line test-line-1)",
    ]);
  });

  test("keeps same-named line problems distinct with line-key context", () => {
    const recipe = makeRecipe({
      lines: [
        makeIngredientLine({
          lineKey: "salt-prep",
          itemName: "เกลือ",
          sourceText: null,
        }),
        makeIngredientLine({
          lineKey: "salt-finish",
          itemName: "เกลือ",
          sourceText: null,
        }),
      ],
    });

    expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([
      "Confirm the source quantity for เกลือ (line salt-prep)",
      "Confirm the source quantity for เกลือ (line salt-finish)",
    ]);
  });

  test.each([
    [null, null, null],
    ["", null, null],
    [" \n", 2, ""],
    ["\t", 2, "   "],
    [null, null, "กรัม"],
  ] as const)(
    "missing source quantity evidence blocks for sourceText=%j sourceValue=%j sourceUnit=%j",
    (sourceText, sourceValue, sourceUnit) => {
      const recipe = makeRecipe({
        lines: [
          makeIngredientLine({
            itemName: "น้ำปลา",
            sourceText,
            sourceValue,
            sourceUnit,
          }),
        ],
      });

      expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([
        "Confirm the source quantity for น้ำปลา (line test-line-1)",
      ]);
    },
  );

  test.each([
    ["1 1/2 ช้อนโต๊ะ", null, null],
    ["คำอธิบายต้นฉบับที่ไม่ต้องแปลง", null, null],
    [null, 1.5, "ช้อนโต๊ะ"],
    ["", 0, "กรัม"],
  ] as const)(
    "accepts exact text or an explicit numeric value-unit pair without inference",
    (sourceText, sourceValue, sourceUnit) => {
      const recipe = makeRecipe({
        lines: [makeIngredientLine({ sourceText, sourceValue, sourceUnit })],
      });

      expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([]);
    },
  );

  test.each([Number.NaN, Number.POSITIVE_INFINITY, "2", undefined])(
    "rejects malformed runtime sourceValue %j with a named error",
    (sourceValue) => {
      const line = makeIngredientLine();
      line.sourceValue = sourceValue as unknown as number | null;

      expect(() =>
        evaluateReadiness(makeRecipe({ lines: [line] }), noMedia),
      ).toThrow(InvalidIngredientSourceValueError);
    },
  );

  test.each([
    ["sourceText", 12],
    ["sourceUnit", false],
  ] as const)("rejects malformed runtime %s with a named error", (field, value) => {
    const line = makeIngredientLine();
    line[field] = value as never;

    expect(() =>
      evaluateReadiness(makeRecipe({ lines: [line] }), noMedia),
    ).toThrow(InvalidIngredientSourceEvidenceError);
  });

  test("missing media and media review are separate non-blocking flags", () => {
    expect(evaluateReadiness(makeRecipe(), noMedia)).toEqual({
      printableAsApproved: true,
      draft: false,
      missingMethod: false,
      blockers: [],
      mediaGap: true,
      mediaReviewNeeded: false,
    });
    expect(
      evaluateReadiness(makeRecipe(), { linked: 2, reviewNeeded: 1 }),
    ).toEqual({
      printableAsApproved: true,
      draft: false,
      missingMethod: false,
      blockers: [],
      mediaGap: false,
      mediaReviewNeeded: true,
    });
  });

  test.each([
    [{ linked: Number.NaN, reviewNeeded: 0 }, "linked"],
    [{ linked: 1.5, reviewNeeded: 0 }, "linked"],
    [{ linked: -1, reviewNeeded: 0 }, "linked"],
    [{ linked: 0, reviewNeeded: Number.POSITIVE_INFINITY }, "reviewNeeded"],
    [{ linked: 0, reviewNeeded: -1 }, "reviewNeeded"],
    [{ linked: 0, reviewNeeded: 1 }, "reviewNeeded"],
  ] as const)("rejects malformed media coverage %j", (coverage, field) => {
    expect(() => evaluateReadiness(makeRecipe(), coverage)).toThrow(
      InvalidMediaCoverageError,
    );
    try {
      evaluateReadiness(makeRecipe(), coverage);
    } catch (error) {
      expect(error).toMatchObject({ field });
    }
  });

  test.each([null, undefined, [], "coverage", 4])(
    "rejects malformed media coverage shape %j with a named error",
    (coverage) => {
      expect(() =>
        evaluateReadiness(makeRecipe(), coverage as never),
      ).toThrow(InvalidMediaCoverageError);
    },
  );

  test.each(["\u200B", "\u0000\u200D", "\ud800"])(
    "treats invisible-only source text %j as missing without rewriting it",
    (sourceText) => {
      const line = makeIngredientLine({ sourceText });
      const recipe = makeRecipe({ lines: [line] });

      expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([
        "Confirm the source quantity for วัตถุดิบทดสอบ (line test-line-1)",
      ]);
      expect(line.sourceText).toBe(sourceText);
    },
  );

  test.each(["\uFE0F", "\u034F", "\u0301"])(
    "treats mark-only source text %j as missing without rewriting it",
    (sourceText) => {
      const line = makeIngredientLine({ sourceText });

      expect(
        evaluateReadiness(makeRecipe({ lines: [line] }), noMedia).blockers,
      ).toEqual([
        "Confirm the source quantity for วัตถุดิบทดสอบ (line test-line-1)",
      ]);
      expect(line.sourceText).toBe(sourceText);
    },
  );

  test.each(["\uFE0F", "\u034F", "\u0301"])(
    "treats mark-only source unit %j as missing without rewriting it",
    (sourceUnit) => {
      const line = makeIngredientLine({
        sourceText: null,
        sourceValue: 1,
        sourceUnit,
      });

      expect(
        evaluateReadiness(makeRecipe({ lines: [line] }), noMedia).blockers,
      ).toEqual([
        "Confirm the source quantity for วัตถุดิบทดสอบ (line test-line-1)",
      ]);
      expect(line.sourceUnit).toBe(sourceUnit);
    },
  );

  test("accepts and preserves visible base characters followed by combining marks", () => {
    const sourceText = "ก\u0E48";
    const sourceUnit = "g\u0301";
    const methodText = "e\u0301";
    const recipeId = "recipe\u0301";
    const textLine = makeIngredientLine({
      lineKey: "text",
      sourceText,
    });
    const numericLine = makeIngredientLine({
      lineKey: "numeric",
      sourceText: null,
      sourceValue: 1,
      sourceUnit,
    });
    const recipe = makeRecipe({
      recipeId,
      methodText,
      lines: [textLine, numericLine],
    });

    expect(evaluateReadiness(recipe, noMedia).blockers).toEqual([]);
    expect(recipe.recipeId).toBe(recipeId);
    expect(recipe.methodText).toBe(methodText);
    expect(textLine.sourceText).toBe(sourceText);
    expect(numericLine.sourceUnit).toBe(sourceUnit);
  });
});

describe("buildReviewQueue", () => {
  test("builds name-first rows with exact identities, statuses, and source questions", () => {
    const recipes = [
      makeRecipe({
        recipeId: "candidate:prepared:น้ำซุป",
        name: "น้ำซุป",
        reviewState: "conflict",
        lines: [
          makeIngredientLine({
            itemName: "เกลือ",
            sourceText: null,
            sourceValue: null,
            sourceUnit: null,
          }),
        ],
      }),
    ];

    expect(buildReviewQueue(recipes)).toEqual([
      {
        recipeId: "candidate:prepared:น้ำซุป",
        recipeVersionId: "test-v1-1",
        recipeName: "น้ำซุป",
        status: "conflict",
        blockers: [
          "Resolve conflicting sources for น้ำซุป",
          "Confirm the source quantity for เกลือ (line test-line-1)",
        ],
      },
    ]);
  });

  test("preserves candidate status rather than aliasing it to confirmed", () => {
    expect(
      buildReviewQueue([makeRecipe({ reviewState: "candidate" })])[0]?.status,
    ).toBe("candidate");
  });

  test("orders work by review priority, then recipe name, then exact identity", () => {
    const recipes = [
      makeRecipe({
        recipeId: 5,
        recipeVersionId: "candidate-zulu",
        name: "Zulu",
        reviewState: "candidate",
      }),
      makeRecipe({
        recipeId: "b",
        recipeVersionId: "blocked-alpha-b",
        name: "Alpha",
        blockers: ["Need source"],
      }),
      makeRecipe({
        recipeId: "z",
        recipeVersionId: "conflict-zulu",
        name: "Zulu",
        reviewState: "conflict",
      }),
      makeRecipe({
        recipeId: 9,
        recipeVersionId: "blocked-state",
        name: "Blocked",
        reviewState: "blocked",
      }),
      makeRecipe({
        recipeId: "a",
        recipeVersionId: "blocked-alpha-a",
        name: "Alpha",
        blockers: ["Need source"],
      }),
      makeRecipe({
        recipeId: 1,
        recipeVersionId: "confirmed-done",
        name: "Done",
        reviewState: "confirmed",
      }),
    ];

    const rows = buildReviewQueue(recipes);

    expect(rows.map(({ recipeId }) => recipeId)).toEqual([9, "z", "a", "b", 5]);
    expect(recipes.map(({ recipeId }) => recipeId)).toEqual([
      5,
      "b",
      "z",
      9,
      "a",
      1,
    ]);
  });

  test("produces the same total order for reversed input with equal Thai names", () => {
    const recipes = [
      makeRecipe({
        recipeId: "candidate:b",
        recipeVersionId: "version-b",
        name: "น้ำซุป",
        reviewState: "candidate",
      }),
      makeRecipe({
        recipeId: 1,
        recipeVersionId: "version-a",
        name: "น้ำซุป",
        reviewState: "candidate",
      }),
      makeRecipe({
        recipeId: "1",
        recipeVersionId: "version-c",
        name: "น้ำซุป",
        reviewState: "candidate",
      }),
    ];

    const forward = buildReviewQueue(recipes);
    const reversed = buildReviewQueue([...recipes].reverse());

    expect(forward).toEqual(reversed);
    expect(forward.map(({ recipeId }) => recipeId)).toEqual([
      1,
      "candidate:b",
      "1",
    ]);
  });

  test("rejects duplicate contributor recipe identities with a named error", () => {
    const recipes = [
      makeRecipe({
        recipeId: "same",
        recipeVersionId: "v1",
        reviewState: "candidate",
      }),
      makeRecipe({
        recipeId: "same",
        recipeVersionId: "v2",
        reviewState: "candidate",
      }),
    ];

    expect(() => buildReviewQueue(recipes)).toThrow(
      DuplicateReviewQueueRecipeIdentityError,
    );
  });

  test("rejects duplicate contributor version identities with a named error", () => {
    const recipes = [
      makeRecipe({
        recipeId: 1,
        recipeVersionId: "same",
        reviewState: "candidate",
      }),
      makeRecipe({
        recipeId: 2,
        recipeVersionId: "same",
        reviewState: "candidate",
      }),
    ];

    expect(() => buildReviewQueue(recipes)).toThrow(
      DuplicateReviewQueueRecipeVersionIdError,
    );
  });

  test("keeps numeric and string identities distinct in duplicate validation", () => {
    expect(() =>
      buildReviewQueue([
        makeRecipe({
          recipeId: 1,
          recipeVersionId: "numeric",
          reviewState: "candidate",
        }),
        makeRecipe({
          recipeId: "1",
          recipeVersionId: "string",
          reviewState: "candidate",
        }),
      ]),
    ).not.toThrow();
  });

  test("scopes duplicate checks to recipes that produce review rows", () => {
    expect(() =>
      buildReviewQueue([
        makeRecipe({ recipeId: 1, recipeVersionId: "same" }),
        makeRecipe({ recipeId: 1, recipeVersionId: "same" }),
        makeRecipe({
          recipeId: 2,
          recipeVersionId: "candidate",
          reviewState: "candidate",
        }),
      ]),
    ).not.toThrow();
  });

  test("returns isolated rows and blocker arrays on repeated calls", () => {
    const recipe = makeRecipe({ blockers: ["Confirm source"] });
    const first = buildReviewQueue([recipe]);
    first[0].recipeName = "Changed";
    first[0].blockers.push("Changed");

    expect(buildReviewQueue([recipe])).toEqual([
      {
        recipeId: 1,
        recipeVersionId: "test-v1-1",
        recipeName: "สูตรทดสอบ",
        status: "confirmed",
        blockers: ["Confirm source"],
      },
    ]);
    expect(recipe.name).toBe("สูตรทดสอบ");
    expect(recipe.blockers).toEqual(["Confirm source"]);
  });
});
