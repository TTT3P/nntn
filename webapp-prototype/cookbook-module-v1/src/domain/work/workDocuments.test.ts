import { beforeAll, describe, expect, test } from "vitest";
import { FixtureCookbookRepository } from "../../data/FixtureCookbookRepository";
import type { RecipeVersion, WorkStage } from "../cookbook/types";
import { makeIngredientLine, makeRecipe, makeWorkStep } from "../../test/builders";
import {
  InvalidProjectedWorkDocumentFieldError,
  DuplicateWorkIngredientLineKeyError,
  InvalidWorkMultiplierError,
  MissingWorkIngredientLineKeyError,
  projectWorkDocuments,
  scaleIngredientLine,
} from "./workDocuments";

const repository = new FixtureCookbookRepository();
let firstSet: { recipes: RecipeVersion[] };

beforeAll(async () => {
  firstSet = await repository.loadSnapshot();
});

function recipeWithStages(): RecipeVersion {
  const line = makeIngredientLine({
    lineKey: "staged:salt",
    sourceText: "2 ช้อนชา",
    sourceValue: 2,
    sourceUnit: "ช้อนชา",
  });

  return makeRecipe({
    recipeId: "recipe:staged",
    recipeVersionId: "staged-v1",
    name: "สูตรหลายขั้น",
    lines: [line],
    blockers: ["ตรวจสอบเตา"],
    workDocuments: {
      prep: {
        stage: "prep",
        scalable: true,
        ingredientLineKeys: [line.lineKey],
        steps: [makeWorkStep({ stepId: "staged:prep:1", stage: "prep" })],
      },
      cook: {
        stage: "cook",
        scalable: true,
        ingredientLineKeys: [line.lineKey],
        steps: [makeWorkStep({ stepId: "staged:cook:1", stage: "cook" })],
      },
      service: {
        stage: "service",
        scalable: true,
        ingredientLineKeys: [line.lineKey],
        steps: [makeWorkStep({ stepId: "staged:service:1", stage: "service" })],
      },
    },
  });
}

describe("projectWorkDocuments", () => {
  test.each([
    ["recipe name", (recipe: RecipeVersion) => { recipe.name = { bad: true } as never; }],
    ["recipe version", (recipe: RecipeVersion) => { recipe.recipeVersionId = undefined as never; }],
    ["ingredient name", (recipe: RecipeVersion) => { recipe.lines[0]!.itemName = [] as never; }],
    ["source text", (recipe: RecipeVersion) => { recipe.lines[0]!.sourceText = {} as never; }],
    ["source unit", (recipe: RecipeVersion) => { recipe.lines[0]!.sourceUnit = [] as never; }],
    ["step id", (recipe: RecipeVersion) => { recipe.workDocuments.prep!.steps[0]!.stepId = undefined as never; }],
    ["instruction", (recipe: RecipeVersion) => { recipe.workDocuments.prep!.steps[0]!.instruction = {} as never; }],
    ["step order", (recipe: RecipeVersion) => { recipe.workDocuments.prep!.steps[0]!.order = "1" as never; }],
    ["blocker", (recipe: RecipeVersion) => { recipe.blockers = [42 as never]; }],
  ] as const)("rejects malformed projected render field: %s", (_label, corrupt) => {
    const recipe = recipeWithStages();
    corrupt(recipe);

    expect(() => projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 })).toThrow(
      InvalidProjectedWorkDocumentFieldError,
    );
  });

  test.each([
    ["blockers collection", (recipe: RecipeVersion) => { recipe.blockers = {} as never; }],
    ["ingredient collection", (recipe: RecipeVersion) => { recipe.lines = undefined as never; }],
    ["step collection", (recipe: RecipeVersion) => { recipe.workDocuments.prep!.steps = {} as never; }],
  ] as const)("names malformed projected render collections: %s", (_label, corrupt) => {
    const recipe = recipeWithStages();
    corrupt(recipe);

    expect(() => projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 })).toThrow(
      InvalidProjectedWorkDocumentFieldError,
    );
  });

  test("groups all documents prep then cook then service while preserving dependency order within each stage", () => {
    const first = recipeWithStages();
    const second = {
      ...recipeWithStages(),
      recipeId: "recipe:second",
      recipeVersionId: "second-v1",
      name: "สูตรที่สอง",
    };

    const documents = projectWorkDocuments([first, second], {
      stage: "all",
      multiplier: 3,
    });

    expect(documents.map(({ stage, recipeId }) => [stage, recipeId])).toEqual([
      ["prep", "recipe:staged"],
      ["prep", "recipe:second"],
      ["cook", "recipe:staged"],
      ["cook", "recipe:second"],
      ["service", "recipe:staged"],
      ["service", "recipe:second"],
    ]);
  });

  test.each<WorkStage>(["prep", "cook", "service"])(
    "returns only %s documents and preserves input order",
    (stage) => {
      const first = recipeWithStages();
      const second = {
        ...recipeWithStages(),
        recipeId: "recipe:second",
        recipeVersionId: "second-v1",
      };

      const documents = projectWorkDocuments([first, second], {
        stage,
        multiplier: 2,
      });

      expect(documents.map((document) => document.stage)).toEqual([stage, stage]);
      expect(documents.map((document) => document.recipeId)).toEqual([
        "recipe:staged",
        "recipe:second",
      ]);
    },
  );

  test("returns empty arrays for empty selections and absent stages", () => {
    expect(
      projectWorkDocuments([], { stage: "all", multiplier: 1 }),
    ).toEqual([]);
    expect(
      projectWorkDocuments([makeRecipe()], { stage: "cook", multiplier: 1 }),
    ).toEqual([]);
  });

  test("uses requested multiplier only for scalable prep and cook documents", () => {
    const documents = projectWorkDocuments([recipeWithStages()], {
      stage: "all",
      multiplier: 2.5,
    });

    expect(documents.map((document) => document.multiplier)).toEqual([2.5, 2.5, 1]);
    expect(documents.map((document) => document.ingredients[0].sourceValue)).toEqual([
      5,
      5,
      2,
    ]);
  });

  test("uses effective multiplier one for non-scalable prep and cook documents", () => {
    const recipe = recipeWithStages();
    recipe.workDocuments.prep = {
      ...recipe.workDocuments.prep!,
      scalable: false,
    };
    recipe.workDocuments.cook = {
      ...recipe.workDocuments.cook!,
      scalable: false,
    };

    const documents = projectWorkDocuments([recipe], {
      stage: "all",
      multiplier: 4,
    });

    expect(documents.map((document) => document.multiplier)).toEqual([1, 1, 1]);
    expect(documents.map((document) => document.ingredients[0].sourceValue)).toEqual([
      2,
      2,
      2,
    ]);
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid requested multiplier %s",
    (multiplier) => {
      expect(() =>
        projectWorkDocuments([], { stage: "all", multiplier }),
      ).toThrow(InvalidWorkMultiplierError);
    },
  );

  test("rejects an invalid runtime requested stage instead of returning an empty selection", () => {
    expect(() =>
      projectWorkDocuments([], {
        stage: "finish" as WorkStage,
        multiplier: 1,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: "InvalidWorkStageError",
        stage: "finish",
      }),
    );
  });

  test("rejects a work document whose record key disagrees with its stage", () => {
    const recipe = recipeWithStages();
    recipe.workDocuments.prep = {
      ...recipe.workDocuments.prep!,
      stage: "cook",
    };

    expect(() =>
      projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "WorkDocumentStageIntegrityError",
        recipeId: "recipe:staged",
        recipeVersionId: "staged-v1",
        recipeName: "สูตรหลายขั้น",
        keyStage: "prep",
        documentStage: "cook",
        offendingStepId: null,
        offendingStepStage: null,
      }),
    );
  });

  test("rejects a work step whose stage disagrees with its document stage", () => {
    const recipe = recipeWithStages();
    recipe.workDocuments.cook = {
      ...recipe.workDocuments.cook!,
      steps: [
        makeWorkStep({ stepId: "staged:cook:wrong", stage: "service" }),
      ],
    };

    expect(() =>
      projectWorkDocuments([recipe], { stage: "cook", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "WorkDocumentStageIntegrityError",
        recipeId: "recipe:staged",
        recipeVersionId: "staged-v1",
        recipeName: "สูตรหลายขั้น",
        keyStage: "cook",
        documentStage: "cook",
        offendingStepId: "staged:cook:wrong",
        offendingStepStage: "service",
      }),
    );
  });

  test("rejects the same work document object referenced under a second stage key", () => {
    const recipe = recipeWithStages();
    const prep = recipe.workDocuments.prep!;
    recipe.workDocuments.cook = prep;

    expect(() =>
      projectWorkDocuments([recipe], { stage: "all", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "WorkDocumentStageIntegrityError",
        keyStage: "cook",
        documentStage: "prep",
      }),
    );
  });

  test("fails contextually when a document references a missing ingredient line", () => {
    const recipe = recipeWithStages();
    recipe.workDocuments.prep = {
      ...recipe.workDocuments.prep!,
      ingredientLineKeys: ["staged:missing"],
    };

    expect(() =>
      projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "MissingWorkIngredientLineKeyError",
        recipeId: "recipe:staged",
        recipeVersionId: "staged-v1",
        stage: "prep",
        lineKey: "staged:missing",
      }),
    );
    expect(() =>
      projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 }),
    ).toThrow(MissingWorkIngredientLineKeyError);
  });

  test("fails contextually when recipe lines contain a duplicate referenced key", () => {
    const recipe = recipeWithStages();
    recipe.lines.push({ ...recipe.lines[0] });

    expect(() =>
      projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "DuplicateWorkIngredientLineKeyError",
        recipeId: "recipe:staged",
        recipeVersionId: "staged-v1",
        stage: "prep",
        lineKey: "staged:salt",
      }),
    );
    expect(() =>
      projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 }),
    ).toThrow(DuplicateWorkIngredientLineKeyError);
  });

  test("fails when a work document repeats an ingredient line key", () => {
    const recipe = recipeWithStages();
    recipe.workDocuments.prep = {
      ...recipe.workDocuments.prep!,
      ingredientLineKeys: ["staged:salt", "staged:salt"],
    };

    expect(() =>
      projectWorkDocuments([recipe], { stage: "prep", multiplier: 1 }),
    ).toThrow(DuplicateWorkIngredientLineKeyError);
  });

  test("returns independent documents, lines, steps, keys, and blocker arrays", () => {
    const recipe = recipeWithStages();
    const projected = projectWorkDocuments([recipe], {
      stage: "prep",
      multiplier: 2,
    })[0];

    projected.ingredients[0].itemName = "เปลี่ยนใน projection";
    projected.steps[0].instruction = "เปลี่ยนขั้นตอน";
    projected.ingredientLineKeys.push("projection-only");
    projected.blockers.push("projection-only");

    expect(recipe.lines[0].itemName).toBe("วัตถุดิบทดสอบ");
    expect(recipe.workDocuments.prep?.steps[0].instruction).toBe(
      "ทำตามขั้นตอนทดสอบ",
    );
    expect(recipe.workDocuments.prep?.ingredientLineKeys).toEqual(["staged:salt"]);
    expect(recipe.blockers).toEqual(["ตรวจสอบเตา"]);
    expect(projected).not.toBe(recipe.workDocuments.prep);
    expect(projected.ingredients[0]).not.toBe(recipe.lines[0]);
    expect(projected.steps[0]).not.toBe(recipe.workDocuments.prep?.steps[0]);
  });

  test("preserves canonical string recipe identities", () => {
    const [document] = projectWorkDocuments([recipeWithStages()], {
      stage: "prep",
      multiplier: 1,
    });

    expect(document.recipeId).toBe("recipe:staged");
    expect(typeof document.recipeId).toBe("string");
  });

  test("duplicate service-only recipes do not block prep projection", () => {
    const prepContributor = recipeWithStages();
    prepContributor.recipeId = "recipe:prep";
    prepContributor.recipeVersionId = "prep-v1";
    prepContributor.workDocuments = {
      prep: prepContributor.workDocuments.prep,
    };
    const firstServiceOnly = recipeWithStages();
    firstServiceOnly.workDocuments = {
      service: firstServiceOnly.workDocuments.service,
    };
    const secondServiceOnly = recipeWithStages();
    secondServiceOnly.workDocuments = {
      service: secondServiceOnly.workDocuments.service,
    };

    expect(
      projectWorkDocuments(
        [firstServiceOnly, prepContributor, secondServiceOnly],
        { stage: "prep", multiplier: 1 },
      ).map((document) => document.recipeId),
    ).toEqual(["recipe:prep"]);
  });

  test("duplicate recipes without work documents do not block all projection", () => {
    const first = makeRecipe({
      recipeId: "recipe:empty",
      recipeVersionId: "empty-v1",
    });
    const second = makeRecipe({
      recipeId: "recipe:empty",
      recipeVersionId: "empty-v1",
    });

    expect(
      projectWorkDocuments([first, second], { stage: "all", multiplier: 1 }),
    ).toEqual([]);
  });

  test("a duplicate non-contributor does not block its prep contributor", () => {
    const contributor = recipeWithStages();
    contributor.workDocuments = {
      prep: contributor.workDocuments.prep,
    };
    const nonContributor = makeRecipe({
      recipeId: contributor.recipeId,
      recipeVersionId: contributor.recipeVersionId,
      name: "สูตรซ้ำที่ไม่ร่วมขั้น",
    });

    expect(
      projectWorkDocuments([contributor, nonContributor], {
        stage: "prep",
        multiplier: 1,
      }).map((document) => document.recipeId),
    ).toEqual(["recipe:staged"]);
  });

  test("two prep contributors with duplicate identity and version still fail", () => {
    const first = recipeWithStages();
    first.workDocuments = { prep: first.workDocuments.prep };
    const second = recipeWithStages();
    second.workDocuments = { prep: second.workDocuments.prep };

    expect(() =>
      projectWorkDocuments([first, second], { stage: "prep", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "DuplicateProjectedRecipeError",
        duplicateField: "recipe_identity",
      }),
    );
  });

  test("all rejects duplicates that contribute different stages", () => {
    const prepContributor = recipeWithStages();
    prepContributor.workDocuments = {
      prep: prepContributor.workDocuments.prep,
    };
    const serviceContributor = recipeWithStages();
    serviceContributor.workDocuments = {
      service: serviceContributor.workDocuments.service,
    };

    expect(() =>
      projectWorkDocuments([prepContributor, serviceContributor], {
        stage: "all",
        multiplier: 1,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: "DuplicateProjectedRecipeError",
        duplicateField: "recipe_identity",
      }),
    );
  });

  test("numeric and string contributor identities remain distinct", () => {
    const numeric = recipeWithStages();
    numeric.recipeId = 1;
    numeric.recipeVersionId = "contributor-number-v1";
    numeric.workDocuments = { prep: numeric.workDocuments.prep };
    const textual = recipeWithStages();
    textual.recipeId = "1";
    textual.recipeVersionId = "contributor-string-v1";
    textual.workDocuments = { prep: textual.workDocuments.prep };

    expect(
      projectWorkDocuments([numeric, textual], {
        stage: "prep",
        multiplier: 1,
      }).map((document) => document.recipeId),
    ).toEqual([1, "1"]);
  });

  test("rejects the same recipe object repeated in projection input", () => {
    const recipe = recipeWithStages();

    expect(() =>
      projectWorkDocuments([recipe, recipe], { stage: "prep", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "DuplicateProjectedRecipeError",
        duplicateField: "recipe_identity",
        firstRecipeId: "recipe:staged",
        firstRecipeVersionId: "staged-v1",
        duplicateRecipeId: "recipe:staged",
        duplicateRecipeVersionId: "staged-v1",
      }),
    );
  });

  test("rejects duplicate canonical recipe identities across versions", () => {
    const first = recipeWithStages();
    const second = {
      ...recipeWithStages(),
      recipeVersionId: "staged-v2",
    };

    expect(() =>
      projectWorkDocuments([first, second], { stage: "prep", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "DuplicateProjectedRecipeError",
        duplicateField: "recipe_identity",
        firstRecipeVersionId: "staged-v1",
        duplicateRecipeVersionId: "staged-v2",
      }),
    );
  });

  test("rejects duplicate recipe version identities across recipes", () => {
    const first = recipeWithStages();
    const second = {
      ...recipeWithStages(),
      recipeId: "recipe:second",
    };

    expect(() =>
      projectWorkDocuments([first, second], { stage: "prep", multiplier: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: "DuplicateProjectedRecipeError",
        duplicateField: "recipe_version_id",
        firstRecipeId: "recipe:staged",
        duplicateRecipeId: "recipe:second",
        firstRecipeVersionId: "staged-v1",
        duplicateRecipeVersionId: "staged-v1",
      }),
    );
  });

  test("does not collide numeric and string recipe identities", () => {
    const numeric = recipeWithStages();
    numeric.recipeId = 1;
    numeric.recipeVersionId = "numeric-v1";
    const textual = recipeWithStages();
    textual.recipeId = "1";
    textual.recipeVersionId = "text-v1";

    expect(
      projectWorkDocuments([numeric, textual], {
        stage: "prep",
        multiplier: 1,
      }).map((document) => document.recipeId),
    ).toEqual([1, "1"]);
  });

  test("serves 180 grams of cooked rice and never exposes the 72 gram raw cost basis", () => {
    const service = projectWorkDocuments(firstSet.recipes, {
      stage: "service",
      multiplier: 5,
    });
    const stewedBeef = service.find(
      (document) => document.recipeName === "ข้าวหน้าเนื้อตุ๋น",
    );

    expect(stewedBeef?.multiplier).toBe(1);
    expect(stewedBeef?.ingredients).toContainEqual(
      expect.objectContaining({
        itemName: "ข้าวหอมมะลิหุงสุก",
        sourceText: "180 กรัม",
      }),
    );
    expect(
      stewedBeef?.ingredients.some((line) => line.sourceText === "72 กรัม"),
    ).toBe(false);
  });

  test.each([
    ["prep", true, undefined],
    ["cook", true, "2"],
    ["service", true, Number.NaN],
    ["prep", false, Number.POSITIVE_INFINITY],
  ] as const)(
    "rejects malformed sourceValue %s/%s before projection",
    (stage, scalable, value) => {
      const recipe = recipeWithStages();
      recipe.lines[0].sourceValue = value as unknown as number | null;
      recipe.workDocuments[stage] = {
        ...recipe.workDocuments[stage]!,
        scalable,
      };

      expect(() =>
        projectWorkDocuments([recipe], { stage, multiplier: 2 }),
      ).toThrowError(
        expect.objectContaining({
          name: "InvalidIngredientSourceValueError",
          lineKey: "staged:salt",
          itemName: "วัตถุดิบทดสอบ",
          stage,
          value,
        }),
      );
    },
  );

  test("rejects sourceValue overflow in scalable prep projection", () => {
    const recipe = recipeWithStages();
    recipe.lines[0].sourceValue = Number.MAX_VALUE;

    expect(() =>
      projectWorkDocuments([recipe], { stage: "prep", multiplier: 2 }),
    ).toThrowError(
      expect.objectContaining({
        name: "InvalidIngredientSourceValueError",
        lineKey: "staged:salt",
        itemName: "วัตถุดิบทดสอบ",
        stage: "prep",
        value: Number.POSITIVE_INFINITY,
      }),
    );
  });
});

describe("scaleIngredientLine", () => {
  test.each<WorkStage>(["prep", "cook"])(
    "multiplies only explicit sourceValue for scalable %s projections",
    (stage) => {
      const source = makeIngredientLine({
        sourceText: "1 1/2 ช้อนโต๊ะ",
        sourceValue: 1.5,
        sourceUnit: "ช้อนโต๊ะ",
      });

      const scaled = scaleIngredientLine(source, 3, stage);

      expect(scaled.sourceValue).toBe(4.5);
      expect(scaled.sourceText).toBe("1 1/2 ช้อนโต๊ะ");
      expect(scaled.sourceUnit).toBe("ช้อนโต๊ะ");
      expect(scaled).not.toBe(source);
      expect(source.sourceValue).toBe(1.5);
    },
  );

  test("does not parse authoritative sourceText when sourceValue is absent", () => {
    const source = makeIngredientLine({
      sourceText: "180 กรัม",
      sourceValue: null,
      sourceUnit: null,
    });

    expect(scaleIngredientLine(source, 4, "prep")).toEqual(source);
    expect(scaleIngredientLine(source, 4, "prep")).not.toBe(source);
  });

  test("never multiplies service quantities", () => {
    const source = makeIngredientLine({ sourceValue: 180, sourceUnit: "กรัม" });

    expect(scaleIngredientLine(source, 5, "service").sourceValue).toBe(180);
  });

  test.each([
    ["prep", undefined],
    ["cook", "5"],
    ["service", Number.NEGATIVE_INFINITY],
  ] as const)("rejects malformed %s sourceValue", (stage, value) => {
    const source = makeIngredientLine({
      sourceValue: value as unknown as number | null,
    });

    expect(() => scaleIngredientLine(source, 2, stage)).toThrowError(
      expect.objectContaining({
        name: "InvalidIngredientSourceValueError",
        lineKey: "test-line-1",
        itemName: "วัตถุดิบทดสอบ",
        stage,
        value,
      }),
    );
  });

  test("rejects multiplication overflow without changing source wording", () => {
    const source = makeIngredientLine({
      sourceText: "จำนวนมาก",
      sourceValue: Number.MAX_VALUE,
      sourceUnit: "หน่วยเดิม",
    });

    expect(() => scaleIngredientLine(source, 2, "cook")).toThrowError(
      expect.objectContaining({
        name: "InvalidIngredientSourceValueError",
        value: Number.POSITIVE_INFINITY,
      }),
    );
    expect(source.sourceText).toBe("จำนวนมาก");
    expect(source.sourceUnit).toBe("หน่วยเดิม");
  });
});
