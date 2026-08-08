import { describe, expect, test } from "vitest";
import {
  makeMediaAsset,
  makeProjectedWorkDocument,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../../test/builders";
import {
  DuplicatePrintMediaError,
  InvalidPrintDocumentError,
  InvalidPrintInputError,
  InvalidPrintMediaError,
  InvalidPrintMediaLinkError,
  InvalidPrintSettingsError,
  buildPrintPlan,
  buildMediaIndex,
  paginateWorkDocument,
  resolveTemplate,
} from "./printPlanner";

describe("resolveTemplate", () => {
  test.each(["prep", "cook", "service", "all"] as const)(
    "recommends station cards for automatic %s printing",
    (stage) => {
      expect(resolveTemplate("auto", stage)).toBe("station");
    },
  );

  test("rejects invalid runtime template and stage values with named contextual errors", () => {
    expect(() => resolveTemplate("booklet" as never, "prep")).toThrowError(
      expect.objectContaining({
        name: "InvalidPrintSettingsError",
        field: "template",
        value: "booklet",
      }),
    );
    expect(() => resolveTemplate("station", "finish" as never)).toThrow(
      InvalidPrintSettingsError,
    );
  });
});

describe("buildPrintPlan", () => {
  test("preserves dependency-deduped document order and filters the requested stage", () => {
    const prep = makeProjectedWorkDocument({ recipeId: "component", recipeVersionId: "component-v1" });
    const cook = makeProjectedWorkDocument({
      recipeId: "menu",
      recipeVersionId: "menu-v1",
      stage: "cook",
      steps: [makeWorkStep({ stepId: "cook-1", stage: "cook" })],
    });
    const service = makeProjectedWorkDocument({
      recipeId: "menu",
      recipeVersionId: "menu-v1",
      stage: "service",
      scalable: false,
      steps: [makeWorkStep({ stepId: "service-1", stage: "service" })],
    });
    const media = buildMediaIndex(makeSnapshot());

    const all = buildPrintPlan([prep, cook, service], media, {
      template: "station",
      stage: "all",
      multiplier: 1,
    });
    const filtered = buildPrintPlan([prep, cook, service], media, {
      template: "station",
      stage: "service",
      multiplier: 1,
    });

    expect(all.map((page) => page.kind === "station" && page.document.stage)).toEqual([
      "prep",
      "cook",
      "service",
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].kind === "station" && filtered[0].document.stage).toBe("service");
  });

  test("groups station cards into exactly two slots with an odd tail and no nesting", () => {
    const documents = [1, 2, 3].map((recipeId) => makeProjectedWorkDocument({
      recipeId,
      recipeVersionId: `recipe-${recipeId}-v1`,
      steps: [makeWorkStep({ stepId: `recipe-${recipeId}:prep:1` })],
    }));

    const plan = buildPrintPlan(documents, buildMediaIndex(makeSnapshot()), {
      template: "two-up",
      stage: "all",
      multiplier: 1,
    });

    expect(plan.map((page) => page.kind === "two-up" && page.slots.length)).toEqual([2, 1]);
    expect(plan.every((page) => page.kind === "two-up")).toBe(true);
    expect(plan.flatMap((page) => page.kind === "two-up"
      ? page.slots.map((slot) => slot.document.recipeId)
      : [])).toEqual([1, 2, 3]);
    expect(plan.flatMap((page) => page.kind === "two-up" ? page.slots : [])
      .every((slot) => slot.kind === "station")).toBe(true);
  });

  test("two-up groups continuation cards once in stable order", () => {
    const long = makeProjectedWorkDocument({
      recipeId: "long",
      recipeVersionId: "long-v1",
      steps: Array.from({ length: 8 }, (_, index) => makeWorkStep({
        stepId: `long-${index + 1}`,
        order: index + 1,
      })),
    });
    const tail = makeProjectedWorkDocument({
      recipeId: "tail",
      recipeVersionId: "tail-v1",
      steps: [makeWorkStep({ stepId: "tail-1" })],
    });

    const plan = buildPrintPlan([long, tail], buildMediaIndex(makeSnapshot()), {
      template: "two-up",
      stage: "prep",
      multiplier: 1,
    });
    const slots = plan.flatMap((page) => page.kind === "two-up" ? page.slots : []);

    expect(slots.map((slot) => [slot.document.recipeId, slot.partNumber])).toEqual([
      ["long", 1],
      ["long", 2],
      ["tail", 1],
    ]);
    expect(plan.map((page) => page.kind === "two-up" && page.slots.length)).toEqual([2, 1]);
  });

  test("normalizes service multiplier to one under stage all", () => {
    const service = makeProjectedWorkDocument({
      stage: "service",
      scalable: true,
      multiplier: 99,
      steps: [makeWorkStep({ stage: "service", stepId: "service-1" })],
    });

    const [page] = buildPrintPlan([service], buildMediaIndex(makeSnapshot()), {
      template: "station",
      stage: "all",
      multiplier: 5,
    });

    expect(page.kind === "station" && page.document.multiplier).toBe(1);
    expect(service.multiplier).toBe(99);
  });

  test("requires exact scalable non-service multiplier and one for non-scalable work", () => {
    const scalable = makeProjectedWorkDocument({ multiplier: 2 });
    const nonScalable = makeProjectedWorkDocument({ scalable: false, multiplier: 1 });

    expect(buildPrintPlan([scalable], buildMediaIndex(makeSnapshot()), {
      template: "station",
      stage: "prep",
      multiplier: 2,
    })).toHaveLength(1);
    expect(buildPrintPlan([nonScalable], buildMediaIndex(makeSnapshot()), {
      template: "station",
      stage: "prep",
      multiplier: 7,
    })).toHaveLength(1);
    expect(() => buildPrintPlan([
      makeProjectedWorkDocument({ multiplier: 1 }),
    ], buildMediaIndex(makeSnapshot()), {
      template: "station",
      stage: "prep",
      multiplier: 2,
    })).toThrowError(expect.objectContaining({
      name: "InvalidPrintDocumentError",
      field: "multiplier",
      value: 1,
    }));
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid requested multiplier %s",
    (multiplier) => {
      expect(() => buildPrintPlan([], buildMediaIndex(makeSnapshot()), {
        template: "station",
        stage: "all",
        multiplier,
      })).toThrowError(expect.objectContaining({
        name: "InvalidPrintSettingsError",
        field: "multiplier",
        value: multiplier,
      }));
    },
  );

  test("rejects malformed direct settings and document containers without TypeError", () => {
    const media = buildMediaIndex(makeSnapshot());
    expect(() => buildPrintPlan(null as never, media, {
      template: "station",
      stage: "all",
      multiplier: 1,
    })).toThrowError(expect.objectContaining({
      name: "InvalidPrintInputError",
      field: "documents",
    }));
    expect(() => buildPrintPlan([], media, null as never)).toThrowError(
      expect.objectContaining({ name: "InvalidPrintInputError", field: "settings" }),
    );
    expect(() => buildPrintPlan([], media, {
      template: "station",
      stage: "finish" as never,
      multiplier: 1,
    })).toThrow(InvalidPrintSettingsError);
  });

  test("rejects duplicate recipe-stage documents instead of reintroducing work", () => {
    const first = makeProjectedWorkDocument();
    const duplicate = makeProjectedWorkDocument({ recipeName: "duplicate copy" });

    expect(() => buildPrintPlan([first, duplicate], buildMediaIndex(makeSnapshot()), {
      template: "station",
      stage: "all",
      multiplier: 1,
    })).toThrowError(expect.objectContaining({
      name: "DuplicatePrintDocumentError",
      recipeId: 1,
      recipeVersionId: "test-v1-1",
      stage: "prep",
    }));
  });

  test("validates and deduplicates only the selected stage scope", () => {
    const malformedPrep = {
      ...makeProjectedWorkDocument(),
      steps: null,
    } as never;
    const duplicatePrep = makeProjectedWorkDocument({ recipeName: "duplicate prep" });
    const service = makeProjectedWorkDocument({
      recipeId: "service",
      recipeVersionId: "service-v1",
      stage: "service",
      scalable: false,
      steps: [makeWorkStep({ stepId: "service-1", stage: "service" })],
    });
    const settings = { template: "station", stage: "service", multiplier: 1 } as const;

    expect(buildPrintPlan(
      [malformedPrep, makeProjectedWorkDocument(), duplicatePrep, service],
      buildMediaIndex(makeSnapshot()),
      settings,
    )).toHaveLength(1);

    expect(() => buildPrintPlan(
      [service, { ...service, steps: null } as never],
      buildMediaIndex(makeSnapshot()),
      settings,
    )).toThrowError(expect.objectContaining({
      name: "InvalidPrintDocumentError",
      field: "steps",
    }));

    expect(() => buildPrintPlan(
      [makeProjectedWorkDocument(), duplicatePrep],
      buildMediaIndex(makeSnapshot()),
      { ...settings, stage: "all" },
    )).toThrowError(expect.objectContaining({ name: "DuplicatePrintDocumentError" }));
  });

  test("returns an empty plan for empty inputs and no-step documents", () => {
    const media = buildMediaIndex(makeSnapshot());
    const settings = { template: "auto", stage: "all", multiplier: 1 } as const;

    expect(buildPrintPlan([], media, settings)).toEqual([]);
    expect(buildPrintPlan([makeProjectedWorkDocument({ steps: [] })], media, settings)).toEqual([]);
  });

  test("returns independent plan structures without mutating inputs or sibling slots", () => {
    const documents = [1, 2].map((recipeId) => makeProjectedWorkDocument({
      recipeId,
      recipeVersionId: `v${recipeId}`,
      steps: [makeWorkStep({ stepId: `step-${recipeId}` })],
    }));
    const original = structuredClone(documents);
    const plan = buildPrintPlan(documents, buildMediaIndex(makeSnapshot()), {
      template: "two-up",
      stage: "all",
      multiplier: 1,
    });
    const page = plan[0];
    if (page.kind !== "two-up") throw new Error("expected two-up");

    page.slots[0].document.recipeName = "changed";
    expect(page.slots[1].document.recipeName).toBe("สูตรทดสอบ");
    expect(documents).toEqual(original);
  });

  test("snapshots operational facts and keeps a facts-only document printable", () => {
    const document = makeProjectedWorkDocument({
      steps: [],
      ingredients: [],
      ingredientLineKeys: [],
      operationalNotes: ["ใช้น้ำต่อหม้อเบอร์ 70"],
      yieldText: "ผลผลิต 50 ลิตร",
      methodDecisionNote: "ไม่รวมขั้นตอนลงเนื้อ",
    });
    const original = structuredClone(document);

    const plan = buildPrintPlan([document], buildMediaIndex(makeSnapshot()), {
      template: "station",
      stage: "prep",
      multiplier: 1,
    });

    expect(plan).toHaveLength(1);
    const page = plan[0];
    if (page.kind !== "station") throw new Error("expected station page");
    expect(page.document.operationalNotes).toEqual(["ใช้น้ำต่อหม้อเบอร์ 70"]);
    expect(page.document.yieldText).toBe("ผลผลิต 50 ลิตร");
    expect(page.document.methodDecisionNote).toBe("ไม่รวมขั้นตอนลงเนื้อ");

    page.document.operationalNotes[0] = "changed";
    expect(document).toEqual(original);
  });

  test("moves long source facts to a continuation sheet instead of clipping a full ingredient card", () => {
    const ingredients = Array.from({ length: 14 }, (_, index) => ({
      ...makeProjectedWorkDocument().ingredients[0]!,
      lineKey: `soup-${String(index + 1)}`,
      itemName: `วัตถุดิบซุป ${String(index + 1)}`,
      sourceText: `${String(index + 1)} กรัม`,
    }));
    const document = makeProjectedWorkDocument({
      recipeId: 2,
      recipeVersionId: "soup-v3",
      recipeName: "น้ำซุปก๋วยเตี๋ยว V3",
      ingredientLineKeys: ingredients.map(({ lineKey }) => lineKey),
      ingredients,
      steps: [],
      blockers: ["ยังไม่มีลำดับวิธีปรุงน้ำซุป"],
      operationalNotes: [
        "ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70",
        "ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ",
      ],
      methodDecisionNote: "DOCX V3 ระบุรายการส่วนผสมแต่ไม่มีลำดับวิธีปรุงน้ำซุป; ตัดวิธีเก่าที่มีขั้นตอนลงเนื้อออกตามขอบเขตที่เจ้าของยืนยัน",
    });

    const pages = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    expect(pages).toHaveLength(2);
    expect(pages.map(({ partNumber, totalParts }) => [partNumber, totalParts])).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(pages[0]!.document.ingredients).toHaveLength(14);
    expect(pages[0]!.document.operationalNotes).toEqual([]);
    expect(pages[0]!.document.methodDecisionNote).toBeNull();
    expect(pages[1]!.document.ingredients).toEqual([]);
    expect(pages[1]!.document.operationalNotes).toEqual(document.operationalNotes);
    expect(pages[1]!.document.methodDecisionNote).toBe(document.methodDecisionNote);
  });

  test.each([
    ["operationalNotes[]", { operationalNotes: [42] }],
    ["methodDecisionNote", { methodDecisionNote: [] }],
    ["yieldText", { yieldText: {} }],
    ["ingredients[test-line-1].servingNote", {
      ingredients: [{ ...makeProjectedWorkDocument().ingredients[0], servingNote: 180 }],
    }],
  ] as const)("rejects malformed projected operational fact %s", (field, overrides) => {
    const document = { ...makeProjectedWorkDocument(), ...overrides } as never;

    expect(() => buildPrintPlan([document], buildMediaIndex(makeSnapshot()), {
      template: "station",
      stage: "prep",
      multiplier: 1,
    })).toThrowError(expect.objectContaining({
      name: "InvalidPrintDocumentError",
      field,
    }));
  });

  test("snapshots settings and document stage getters once before selection", () => {
    const document = makeProjectedWorkDocument();
    const reads = { template: 0, stage: 0, multiplier: 0, documentStage: 0 };
    Object.defineProperty(document, "stage", {
      enumerable: true,
      get() {
        reads.documentStage += 1;
        return reads.documentStage === 1 ? "prep" : "service";
      },
    });
    const settings = {} as {
      template: "station";
      stage: "prep";
      multiplier: number;
    };
    Object.defineProperties(settings, {
      template: {
        enumerable: true,
        get() {
          reads.template += 1;
          return "station";
        },
      },
      stage: {
        enumerable: true,
        get() {
          reads.stage += 1;
          return "prep";
        },
      },
      multiplier: {
        enumerable: true,
        get() {
          reads.multiplier += 1;
          return 1;
        },
      },
    });

    const [page] = buildPrintPlan(
      [document],
      buildMediaIndex(makeSnapshot()),
      settings,
    );

    expect(page.kind === "station" && page.document.stage).toBe("prep");
    expect(reads).toEqual({ template: 1, stage: 1, multiplier: 1, documentStage: 1 });
  });

  test("captures a shared direct media index once for every document in one plan", () => {
    const asset = makeMediaAsset({ mediaId: "shared" });
    const link = makeStepMediaLink({ stepId: "shared-step", mediaId: "shared" });
    const reads = { url: 0, reviewState: 0, order: 0 };
    Object.defineProperties(asset, {
      url: {
        enumerable: true,
        get() {
          reads.url += 1;
          return reads.url === 1
            ? "/sample-media/shared.svg"
            : "https://example.com/shared.svg";
        },
      },
      reviewState: {
        enumerable: true,
        get() {
          reads.reviewState += 1;
          return reads.reviewState === 1 ? "sample" : "confirmed";
        },
      },
    });
    Object.defineProperty(link, "order", {
      enumerable: true,
      get() {
        reads.order += 1;
        return reads.order === 1 ? 1 : 99;
      },
    });
    const media = {
      assetsById: new Map([["shared", asset]]),
      linksByStepId: new Map([["shared-step", [link]]]),
    };
    const documents = [1, 2].map((recipeId) => makeProjectedWorkDocument({
      recipeId,
      recipeVersionId: `shared-v${recipeId}`,
      steps: [makeWorkStep({ stepId: "shared-step" })],
    }));

    const plan = buildPrintPlan(documents, media, {
      template: "station",
      stage: "prep",
      multiplier: 1,
    });

    expect(plan.map((page) => page.kind === "station" && page.blocks[0].layout)).toEqual([
      "with-media",
      "with-media",
    ]);
    expect(reads).toEqual({ url: 1, reviewState: 1, order: 1 });
  });
});

describe("paginateWorkDocument", () => {
  test.each([
    ["wide emoji", `${"😀".repeat(53)}ก`, `${"😀".repeat(53)}กก`],
    ["CJK wide characters", "漢".repeat(80), `${"漢".repeat(80)}ก`],
    ["emoji ZWJ sequence", `${"👩‍🍳".repeat(26)}กกกก`, `${"👩‍🍳".repeat(26)}กกกกก`],
    ["emoji variation selector", `${"❤️".repeat(53)}ก`, `${"❤️".repeat(53)}กก`],
    ["emoji modifier", `${"👍🏽".repeat(53)}ก`, `${"👍🏽".repeat(53)}กก`],
    ["Thai combining marks", "ก้".repeat(160), `${"ก้".repeat(160)}ก`],
    ["lone surrogate", "\ud800".repeat(160), `${"\ud800".repeat(160)}ก`],
  ] as const)("accepts the declared header display-width maximum for %s and rejects one more cell", (
    _case,
    acceptedName,
    rejectedName,
  ) => {
    const media = buildMediaIndex(makeSnapshot());

    expect(paginateWorkDocument(
      makeProjectedWorkDocument({ recipeName: acceptedName }),
      media,
    )).toHaveLength(1);
    expect(() => paginateWorkDocument(
      makeProjectedWorkDocument({ recipeName: rejectedName }),
      media,
    )).toThrowError(expect.objectContaining({
      name: "UnpageableDocumentError",
      section: "header",
    }));
  });

  test("rejects a single-line control even when the document has no steps", () => {
    expect(() => paginateWorkDocument(
      makeProjectedWorkDocument({ recipeName: "สูตร\nห้าม", steps: [] }),
      buildMediaIndex(makeSnapshot()),
    )).toThrowError(expect.objectContaining({
      name: "InvalidPrintInputError",
      field: "document.recipeName.layout_control",
      value: "<layout-control>",
    }));
  });

  test.each([
    ["item name", `${"😀".repeat(21)}ก`, "S", `${"😀".repeat(21)}กก`, "S"],
    ["source fact", "I", "😀".repeat(16), "I", `${"😀".repeat(16)}ก`],
    ["combined row text", "😀".repeat(16), "😀".repeat(16), `${"😀".repeat(16)}ก`, "😀".repeat(16)],
  ] as const)("accepts the declared ingredient %s display-width maximum and rejects one more cell", (
    _case,
    acceptedItemName,
    acceptedSourceText,
    rejectedItemName,
    rejectedSourceText,
  ) => {
    const documentWith = (itemName: string, sourceText: string) => {
      const ingredient = {
        ...makeProjectedWorkDocument().ingredients[0],
        itemName,
        sourceText,
      };
      return makeProjectedWorkDocument({ ingredients: [ingredient] });
    };
    const media = buildMediaIndex(makeSnapshot());

    expect(paginateWorkDocument(
      documentWith(acceptedItemName, acceptedSourceText),
      media,
    )).toHaveLength(1);
    expect(() => paginateWorkDocument(
      documentWith(rejectedItemName, rejectedSourceText),
      media,
    )).toThrowError(expect.objectContaining({
      name: "UnpageableDocumentError",
      section: "ingredients",
    }));
  });

  test("accepts the declared ingredient region display-width maximum and rejects one more cell", () => {
    const ingredients = Array.from({ length: 15 }, (_, index) => ({
      ...makeProjectedWorkDocument().ingredients[0],
      lineKey: `region-${index + 1}`,
      itemName: "ก้".repeat(10),
      sourceText: "ก้".repeat(10),
    }));
    const documentWith = (firstItemName: string) => makeProjectedWorkDocument({
      ingredientLineKeys: ingredients.map((line) => line.lineKey),
      ingredients: ingredients.map((line, index) => index === 0
        ? { ...line, itemName: firstItemName }
        : line),
    });
    const media = buildMediaIndex(makeSnapshot());

    expect(paginateWorkDocument(documentWith("ก้".repeat(10)), media)).toHaveLength(1);
    expect(() => paginateWorkDocument(documentWith(`${"ก้".repeat(10)}ก`), media))
      .toThrowError(expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "ingredients",
      }));
  });

  test("rejects the formerly clipped 15-row 300-emoji ingredient region", () => {
    const ingredients = Array.from({ length: 15 }, (_, index) => ({
      ...makeProjectedWorkDocument().ingredients[0],
      lineKey: `wide-region-${index + 1}`,
      itemName: "😀".repeat(10),
      sourceText: "😀".repeat(10),
    }));
    const document = makeProjectedWorkDocument({
      ingredientLineKeys: ingredients.map((line) => line.lineKey),
      ingredients,
    });

    expect(() => paginateWorkDocument(document, buildMediaIndex(makeSnapshot())))
      .toThrowError(expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "ingredients",
      }));
  });

  test.each([
    ["caption", `${"😀".repeat(40)}ก`, "A", null, `${"😀".repeat(40)}กก`, "A", null],
    ["digit keycap caption", `${"1️⃣".repeat(40)}ก`, "A", null, `${"1️⃣".repeat(40)}กก`, "A", null],
    ["digit keycap with VS15", `${"1\uFE0E\u20E3".repeat(40)}ก`, "A", null, `${"1\uFE0E\u20E3".repeat(40)}กก`, "A", null],
    ["digit keycap with repeated VS16", `${"1\uFE0F\uFE0F\u20E3".repeat(40)}ก`, "A", null, `${"1\uFE0F\uFE0F\u20E3".repeat(40)}กก`, "A", null],
    ["digit keycap with mixed selectors", `${"1\uFE0E\uFE0F\uFE0E\u20E3".repeat(40)}ก`, "A", null, `${"1\uFE0E\uFE0F\uFE0E\u20E3".repeat(40)}กก`, "A", null],
    ["hash keycap without VS16", `${"#⃣".repeat(40)}ก`, "A", null, `${"#⃣".repeat(40)}กก`, "A", null],
    ["asterisk keycap", `${"*️⃣".repeat(40)}ก`, "A", null, `${"*️⃣".repeat(40)}กก`, "A", null],
    ["alt text", "C", `${"😀".repeat(26)}กก`, null, "C", `${"😀".repeat(26)}กกก`, null],
    ["measurement", "C", "A", "😀".repeat(16), "C", "A", `${"😀".repeat(16)}ก`],
  ] as const)("accepts the declared media %s display-width maximum and rejects one more cell", (
    _case,
    acceptedCaption,
    acceptedAltText,
    acceptedMeasurement,
    rejectedCaption,
    rejectedAltText,
    rejectedMeasurement,
  ) => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "regional-media" })],
    });
    const mediaWith = (
      caption: string,
      altText: string,
      measurementAnnotation: string | null,
    ) => buildMediaIndex(makeSnapshot({
      media: [makeMediaAsset({
        mediaId: "regional-media-asset",
        url: "/sample-media/regional.svg",
        caption,
        altText,
        measurementAnnotation,
      })],
      stepMedia: [makeStepMediaLink({
        stepId: "regional-media",
        mediaId: "regional-media-asset",
      })],
    }));

    expect(paginateWorkDocument(document, mediaWith(
      acceptedCaption,
      acceptedAltText,
      acceptedMeasurement,
    ))).toHaveLength(1);
    expect(() => paginateWorkDocument(document, mediaWith(
      rejectedCaption,
      rejectedAltText,
      rejectedMeasurement,
    ))).toThrowError(expect.objectContaining({
      name: "UnpageableDocumentError",
      section: "media_metadata",
    }));
  });

  test("rejects the formerly clipped 121-keycap caption", () => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "keycap-overflow" })],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [makeMediaAsset({
        mediaId: "keycap-overflow-media",
        url: "/sample-media/keycap-overflow.svg",
        caption: "1️⃣".repeat(121),
      })],
      stepMedia: [makeStepMediaLink({
        stepId: "keycap-overflow",
        mediaId: "keycap-overflow-media",
      })],
    }));

    expect(() => paginateWorkDocument(document, media)).toThrowError(
      expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "media_metadata",
      }),
    );
  });

  test.each([
    ["NUL", "\u0000"],
    ["CRLF", "\r\n"],
    ["LF", "\n"],
    ["tab", "\t"],
    ["C1", "\u0085"],
    ["line separator", "\u2028"],
    ["paragraph separator", "\u2029"],
  ] as const)("rejects %s in a single-line header without echoing the control", (
    _case,
    control,
  ) => {
    expect(() => paginateWorkDocument(
      makeProjectedWorkDocument({ recipeName: `สูตร${control}ห้าม` }),
      buildMediaIndex(makeSnapshot()),
    )).toThrowError(expect.objectContaining({
      name: "InvalidPrintInputError",
      field: "document.recipeName.layout_control",
      value: "<layout-control>",
    }));
  });

  test.each([
    ["ingredient item", "document.ingredients.itemName.layout_control"],
    ["ingredient source", "document.ingredients.sourceFact.layout_control"],
    ["media caption", "media.caption.layout_control"],
    ["media alt", "media.altText.layout_control"],
    ["media measurement", "media.measurementAnnotation.layout_control"],
  ] as const)("rejects a hard break in single-line %s", (_case, expectedField) => {
    const ingredient = {
      ...makeProjectedWorkDocument().ingredients[0],
      itemName: expectedField.includes("itemName") ? "วัตถุดิบ\nใหม่" : "วัตถุดิบ",
      sourceText: expectedField.includes("sourceFact") ? "1\nกรัม" : "1 กรัม",
    };
    const document = makeProjectedWorkDocument({
      ingredients: [ingredient],
      steps: [makeWorkStep({ stepId: "control-media" })],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [makeMediaAsset({
        mediaId: "control-media-asset",
        url: "/sample-media/control.svg",
        caption: expectedField.includes("caption") ? "ภาพ\nใหม่" : "ภาพ",
        altText: expectedField.includes("altText") ? "คำ\nบรรยาย" : "คำบรรยาย",
        measurementAnnotation: expectedField.includes("measurement") ? "1\nซม." : "1 ซม.",
      })],
      stepMedia: [makeStepMediaLink({
        stepId: "control-media",
        mediaId: "control-media-asset",
      })],
    }));

    expect(() => paginateWorkDocument(document, media)).toThrowError(
      expect.objectContaining({
        name: "InvalidPrintInputError",
        field: expectedField,
        value: "<layout-control>",
      }),
    );
  });

  test("accepts the declared media metadata region display-width maximum and rejects one more cell", () => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "regional-media-total" })],
    });
    const mediaWith = (firstAltLength: number) => buildMediaIndex(makeSnapshot({
      media: [1, 2, 3].map((order) => makeMediaAsset({
        mediaId: `regional-total-${order}`,
        url: `/sample-media/regional-total-${order}.svg`,
        caption: "😀".repeat(40),
        altText: order === 1
          ? `${"😀".repeat(5)}ก${firstAltLength === 17 ? "ก" : ""}`
          : `${"😀".repeat(5)}ก`,
      })),
      stepMedia: [1, 2, 3].map((order) => makeStepMediaLink({
        stepId: "regional-media-total",
        mediaId: `regional-total-${order}`,
        order,
      })),
    }));

    expect(paginateWorkDocument(document, mediaWith(16))).toHaveLength(1);
    expect(() => paginateWorkDocument(document, mediaWith(17)))
      .toThrowError(expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "media_metadata",
      }));
  });

  test("fails closed before pages when rendered ingredient rows exceed card capacity", () => {
    const ingredients = Array.from({ length: 60 }, (_, index) => ({
      ...makeProjectedWorkDocument().ingredients[0],
      lineKey: `line-${index + 1}`,
      itemName: `วัตถุดิบ ${index + 1}`,
      sourceText: `${index + 1} กรัม`,
    }));
    const document = makeProjectedWorkDocument({
      ingredientLineKeys: ingredients.map((line) => line.lineKey),
      ingredients,
    });

    expect(() => paginateWorkDocument(document, buildMediaIndex(makeSnapshot())))
      .toThrowError(expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "ingredients",
        recipeId: 1,
      }));
  });

  test("fails closed for a header that cannot fit the fixed card", () => {
    const document = makeProjectedWorkDocument({ recipeName: "ชื่อสูตร".repeat(200) });

    expect(() => paginateWorkDocument(document, buildMediaIndex(makeSnapshot())))
      .toThrowError(expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "header",
      }));
  });

  test("fails closed for verbose media metadata instead of clipping it", () => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "verbose-media" })],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [makeMediaAsset({
        mediaId: "verbose",
        url: "/sample-media/verbose.svg",
        caption: "คำอธิบาย".repeat(180),
        measurementAnnotation: "รายละเอียดการวัด".repeat(100),
      })],
      stepMedia: [makeStepMediaLink({ stepId: "verbose-media", mediaId: "verbose" })],
    }));

    expect(() => paginateWorkDocument(document, media)).toThrowError(
      expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "media_metadata",
      }),
    );
  });

  test("rejects a combined page one ingredient row beyond the calibrated boundary", () => {
    const ingredients = Array.from({ length: 7 }, (_, index) => ({
      ...makeProjectedWorkDocument().ingredients[0],
      lineKey: `combined-${index + 1}`,
      itemName: `วัตถุดิบ ${index + 1}`,
      sourceText: `${index + 1} กรัม`,
    }));
    const document = makeProjectedWorkDocument({
      recipeName: "ช".repeat(160),
      ingredientLineKeys: ingredients.map((line) => line.lineKey),
      ingredients,
      steps: [makeWorkStep({ stepId: "combined-step" })],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [1, 2, 3].map((order) => makeMediaAsset({
        mediaId: `combined-media-${order}`,
        url: `/sample-media/combined-${order}.svg`,
        caption: "X".repeat(121),
        altText: `ภาพลำดับ ${order}`,
      })),
      stepMedia: [1, 2, 3].map((order) => makeStepMediaLink({
        stepId: "combined-step",
        mediaId: `combined-media-${order}`,
        order,
      })),
    }));

    expect(() => paginateWorkDocument(document, media)).toThrowError(
      expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "combined",
      }),
    );
  });

  test("accepts a wide-character combined page at 36 units and rejects unit 37", () => {
    const ingredients = Array.from({ length: 7 }, (_, index) => ({
      ...makeProjectedWorkDocument().ingredients[0],
      lineKey: `wide-combined-${index + 1}`,
      itemName: `วัตถุดิบ ${index + 1}`,
      sourceText: `${index + 1} กรัม`,
    }));
    const document = makeProjectedWorkDocument({
      recipeName: `${"😀".repeat(53)}ก`,
      ingredientLineKeys: ingredients.map((line) => line.lineKey),
      ingredients,
      steps: [makeWorkStep({ stepId: "wide-combined-step" })],
    });
    const mediaWith = (plusOneUnit: boolean) => buildMediaIndex(makeSnapshot({
      media: [
        makeMediaAsset({
          mediaId: "wide-combined-1",
          url: "/sample-media/wide-combined-1.svg",
          caption: `${"😀".repeat(40)}ก`,
          altText: `${"😀".repeat(26)}กก`,
          measurementAnnotation: plusOneUnit ? `${"😀".repeat(13)}ก` : "😀".repeat(13),
        }),
        makeMediaAsset({
          mediaId: "wide-combined-2",
          url: "/sample-media/wide-combined-2.svg",
          caption: "😀".repeat(14),
          altText: plusOneUnit ? `${"😀".repeat(13)}กก` : "😀".repeat(14),
        }),
        makeMediaAsset({
          mediaId: "wide-combined-3",
          url: "/sample-media/wide-combined-3.svg",
          caption: "😀".repeat(14),
          altText: "😀".repeat(14),
        }),
      ],
      stepMedia: [1, 2, 3].map((order) => makeStepMediaLink({
        stepId: "wide-combined-step",
        mediaId: `wide-combined-${order}`,
        order,
      })),
    }));

    expect(paginateWorkDocument(document, mediaWith(false))).toHaveLength(1);
    expect(() => paginateWorkDocument(document, mediaWith(true))).toThrowError(
      expect.objectContaining({
        name: "UnpageableDocumentError",
        section: "combined",
        contentUnits: 37,
        capacity: 36,
      }),
    );
  });

  test("uses the combined remaining capacity to create safe continuation pages", () => {
    const ingredients = Array.from({ length: 13 }, (_, index) => ({
      ...makeProjectedWorkDocument().ingredients[0],
      lineKey: `continuation-${index + 1}`,
      itemName: `วัตถุดิบ ${index + 1}`,
      sourceText: `${index + 1} กรัม`,
    }));
    const document = makeProjectedWorkDocument({
      ingredientLineKeys: ingredients.map((line) => line.lineKey),
      ingredients,
      steps: Array.from({ length: 7 }, (_, index) => makeWorkStep({
        stepId: `combined-continuation-${index + 1}`,
        order: index + 1,
      })),
    });

    const pages = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    expect(pages.map((page) => page.blocks.length)).toEqual([5, 2]);
    expect(pages.map((page) => page.partNumber)).toEqual([1, 2]);
  });

  test("splits a media-heavy candidate without changing step order", () => {
    const document = makeProjectedWorkDocument({
      steps: [1, 2].map((order) => makeWorkStep({
        stepId: `media-continuation-${order}`,
        order,
      })),
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [1, 2].map((order) => makeMediaAsset({
        mediaId: `media-continuation-asset-${order}`,
        url: `/sample-media/media-continuation-${order}.svg`,
        caption: "C".repeat(121),
        altText: "A".repeat(80),
        measurementAnnotation: "M".repeat(48),
      })),
      stepMedia: [1, 2].map((order) => makeStepMediaLink({
        stepId: `media-continuation-${order}`,
        mediaId: `media-continuation-asset-${order}`,
        order: 1,
      })),
    }));

    const pages = paginateWorkDocument(document, media);

    expect(pages.map((page) => page.blocks.map((block) => block.stepId))).toEqual([
      ["media-continuation-1"],
      ["media-continuation-2"],
    ]);
    expect(pages.map((page) => [page.partNumber, page.totalParts])).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  test("returns text-only space for a step without usable media", () => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "step-1", instruction: "อ่านข้อความอย่างเดียว" })],
    });

    const [page] = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    expect(page.blocks).toEqual([
      { kind: "step", stepId: "step-1", layout: "text-only" },
    ]);
    expect(page.partNumber).toBe(1);
    expect(page.totalParts).toBe(1);
  });

  test("creates deterministic continuations rather than relying on clipping", () => {
    const steps = Array.from({ length: 12 }, (_, index) => makeWorkStep({
      stepId: `step-${index + 1}`,
      order: index + 1,
      instruction: `ขั้นตอนลำดับ ${index + 1} พร้อมรายละเอียดการตรวจมาตรฐาน`,
    }));
    const document = makeProjectedWorkDocument({ steps });

    const first = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));
    const second = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    expect(first.map((page) => page.partNumber)).toEqual([1, 2]);
    expect(first.map((page) => page.totalParts)).toEqual([2, 2]);
    expect(first.flatMap((page) => page.blocks.map((block) => block.stepId))).toEqual(
      steps.map((step) => step.stepId),
    );
    expect(second).toEqual(first);
  });

  test("uses usable photo count and instruction length as deterministic content weight", () => {
    const document = makeProjectedWorkDocument({
      steps: [
        makeWorkStep({ stepId: "text-a", order: 1, instruction: "สั้น" }),
        makeWorkStep({ stepId: "photo-a", order: 2, instruction: "มีรูป" }),
        makeWorkStep({ stepId: "text-b", order: 3, instruction: "สั้น" }),
        makeWorkStep({ stepId: "photo-b", order: 4, instruction: "มีรูป" }),
      ],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [
        makeMediaAsset({ mediaId: "a", url: "/sample-media/a.svg" }),
        makeMediaAsset({ mediaId: "b", url: "/sample-media/b.svg" }),
      ],
      stepMedia: [
        makeStepMediaLink({ stepId: "photo-a", mediaId: "a" }),
        makeStepMediaLink({ stepId: "photo-b", mediaId: "b" }),
      ],
    }));

    const pages = paginateWorkDocument(document, media);

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.blocks.map((block) => [block.stepId, block.layout]))).toEqual([
      [["text-a", "text-only"], ["photo-a", "with-media"], ["text-b", "text-only"]],
      [["photo-b", "with-media"]],
    ]);
  });

  test("prints one short step with exactly three ordered photos on one station page", () => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "three-photos", instruction: "ตรวจสีและความสุก" })],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [1, 2, 3].map((order) => makeMediaAsset({
        mediaId: `photo-${order}`,
        url: `/sample-media/photo-${order}.svg`,
      })),
      stepMedia: [3, 1, 2].map((order) => makeStepMediaLink({
        stepId: "three-photos",
        mediaId: `photo-${order}`,
        order,
      })),
    }));

    const pages = paginateWorkDocument(document, media);

    expect(pages).toHaveLength(1);
    expect(pages[0].blocks).toEqual([
      { kind: "step", stepId: "three-photos", layout: "with-media" },
    ]);
    expect(media.linksByStepId.get("three-photos")?.map((link) => link.mediaId)).toEqual([
      "photo-1",
      "photo-2",
      "photo-3",
    ]);
  });

  test("rejects the fourth photo at the existing step-specific boundary", () => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "four-photos", instruction: "ตรวจสี" })],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: [1, 2, 3, 4].map((order) => makeMediaAsset({
        mediaId: `four-photo-${order}`,
        url: `/sample-media/four-photo-${order}.svg`,
      })),
      stepMedia: [1, 2, 3, 4].map((order) => makeStepMediaLink({
        stepId: "four-photos",
        mediaId: `four-photo-${order}`,
        order,
      })),
    }));

    expect(() => paginateWorkDocument(document, media)).toThrowError(
      expect.objectContaining({
        name: "UnpageableStepError",
        stepId: "four-photos",
        mediaCount: 4,
        capacity: 7,
      }),
    );
  });

  test("accepts the wide-character step display-width maximum and rejects one more cell", () => {
    const media = buildMediaIndex(makeSnapshot());

    expect(paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "wide-step-max", instruction: "😀".repeat(280) })],
    }), media)).toHaveLength(1);
    expect(() => paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({
        stepId: "wide-step-plus-one",
        instruction: `${"😀".repeat(280)}ก`,
      })],
    }), media)).toThrowError(expect.objectContaining({
      name: "UnpageableStepError",
      stepId: "wide-step-plus-one",
      textDisplayWidth: 841,
      mediaCount: 0,
      capacity: 7,
    }));
  });

  test.each([
    ["CRLF", "\r\n"],
    ["LF", "\n"],
    ["CR", "\r"],
    ["line separator", "\u2028"],
    ["paragraph separator", "\u2029"],
  ] as const)("counts %s as one hard break and rejects an eighth step line", (
    _case,
    separator,
  ) => {
    const media = buildMediaIndex(makeSnapshot());
    const instructionWithLines = (count: number) => Array.from(
      { length: count },
      (_, index) => `บรรทัด ${index + 1}`,
    ).join(separator);

    expect(paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "seven-lines", instruction: instructionWithLines(7) })],
    }), media)).toHaveLength(1);
    expect(() => paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "eight-lines", instruction: instructionWithLines(8) })],
    }), media)).toThrowError(expect.objectContaining({
      name: "UnpageableStepError",
      stepId: "eight-lines",
      textDisplayWidth: 960,
      capacity: 7,
    }));
  });

  test("counts tabs conservatively and rejects unsafe step controls", () => {
    const media = buildMediaIndex(makeSnapshot());

    expect(paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "tabs", instruction: "\t".repeat(210) })],
    }), media)).toHaveLength(1);
    expect(() => paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "tabs-plus-one", instruction: `${"\t".repeat(210)}ก` })],
    }), media)).toThrowError(expect.objectContaining({
      name: "UnpageableStepError",
      stepId: "tabs-plus-one",
      textDisplayWidth: 841,
      capacity: 7,
    }));
    expect(() => paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "unsafe-control", instruction: "ห้าม\u0000ทำ" })],
    }), media)).toThrowError(expect.objectContaining({
      name: "InvalidPrintInputError",
      field: "document.steps.instruction.layout_control",
      value: "<layout-control>",
    }));
  });

  test.each([
    ["long Thai text", "รายละเอียด".repeat(800), 0],
    ["wide Unicode sequence", "👩‍🍳".repeat(300), 0],
    ["many photos", "สั้น", 8],
    ["long text with three photos", "ข้อความ".repeat(100), 3],
  ] as const)("fails closed for an unpageable %s step without looping or clipping", (
    _case,
    instruction,
    photoCount,
  ) => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "overweight", instruction })],
    });
    const media = buildMediaIndex(makeSnapshot({
      media: Array.from({ length: photoCount }, (_, index) => makeMediaAsset({
        mediaId: `photo-${index + 1}`,
        url: `/sample-media/photo-${index + 1}.svg`,
      })),
      stepMedia: Array.from({ length: photoCount }, (_, index) => makeStepMediaLink({
        stepId: "overweight",
        mediaId: `photo-${index + 1}`,
        order: index + 1,
      })),
    }));

    expect(() => paginateWorkDocument(document, media)).toThrowError(
      expect.objectContaining({
        name: "UnpageableStepError",
        stepId: "overweight",
        mediaCount: photoCount,
        capacity: 7,
      }),
    );
  });

  test("returns no empty page for a no-step document", () => {
    expect(paginateWorkDocument(
      makeProjectedWorkDocument({ steps: [] }),
      buildMediaIndex(makeSnapshot()),
    )).toEqual([]);
  });

  test("orders steps by explicit order without mutating the document", () => {
    const document = makeProjectedWorkDocument({
      steps: [
        makeWorkStep({ stepId: "second", order: 2 }),
        makeWorkStep({ stepId: "first", order: 1 }),
      ],
    });
    const original = structuredClone(document);

    const pages = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    expect(pages[0].blocks.map((block) => block.stepId)).toEqual(["first", "second"]);
    expect(document).toEqual(original);
    expect(pages[0].document).not.toBe(document);
    pages[0].document.steps[0].instruction = "changed result";
    expect(document.steps[0].instruction).toBe(original.steps[0].instruction);
  });

  test("validates direct document and media-index containers with named errors", () => {
    expect(() => paginateWorkDocument(null as never, {
      assetsById: new Map(),
      linksByStepId: new Map(),
    })).toThrowError(expect.objectContaining({
      name: "InvalidPrintDocumentError",
      field: "document",
    }));
    expect(() => paginateWorkDocument(makeProjectedWorkDocument(), null as never)).toThrowError(
      expect.objectContaining({
        name: "InvalidPrintInputError",
        field: "media",
      }),
    );
    expect(() => paginateWorkDocument(makeProjectedWorkDocument(), {
      assetsById: {} as never,
      linksByStepId: new Map(),
    })).toThrow(InvalidPrintInputError);
  });

  test("rejects malformed step order and duplicate step identity with context", () => {
    expect(() => paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ order: Number.NaN })],
    }), buildMediaIndex(makeSnapshot()))).toThrowError(expect.objectContaining({
      name: "InvalidPrintDocumentError",
      field: "steps[test-v1-1:prep:1].order",
    }));

    expect(() => paginateWorkDocument(makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "same", order: 1 }), makeWorkStep({ stepId: "same", order: 2 })],
    }), buildMediaIndex(makeSnapshot()))).toThrow(InvalidPrintDocumentError);
  });

  test("treats unsafe assets in a direct media map as unavailable", () => {
    const document = makeProjectedWorkDocument({
      steps: [makeWorkStep({ stepId: "step-1" })],
    });
    const unsafeAsset = makeMediaAsset({ mediaId: "unsafe", url: "https://example.com/a.jpg" });
    const page = paginateWorkDocument(document, {
      assetsById: new Map([["unsafe", unsafeAsset]]),
      linksByStepId: new Map([["step-1", [makeStepMediaLink({ stepId: "step-1", mediaId: "unsafe" })]]]),
    })[0];

    expect(page.blocks[0].layout).toBe("text-only");
  });

  test("does not expose shared document references across continuation pages", () => {
    const document = makeProjectedWorkDocument({
      steps: Array.from({ length: 8 }, (_, index) => makeWorkStep({
        stepId: `step-${index + 1}`,
        order: index + 1,
      })),
    });
    const pages = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    pages[0].document.recipeName = "mutated";
    expect(pages[1].document.recipeName).toBe("สูตรทดสอบ");
  });

  test("clones only declared document fields without invoking unrelated getters or copying functions", () => {
    const document = makeProjectedWorkDocument() as ReturnType<typeof makeProjectedWorkDocument> & Record<string, unknown>;
    Object.defineProperty(document, "unrelated", {
      enumerable: true,
      get() {
        throw new Error("unrelated getter must not run");
      },
    });
    document.callback = () => undefined;

    const [page] = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    expect(Object.prototype.hasOwnProperty.call(page.document, "unrelated")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(page.document, "callback")).toBe(false);
  });

  test("snapshots declared document and step getters once before validation and output", () => {
    const document = makeProjectedWorkDocument();
    const step = document.steps[0];
    let recipeNameReads = 0;
    let instructionReads = 0;
    Object.defineProperty(document, "recipeName", {
      enumerable: true,
      get() {
        recipeNameReads += 1;
        return recipeNameReads === 1 ? "ค่าที่ตรวจแล้ว" : "ค่าที่เปลี่ยนภายหลัง";
      },
    });
    Object.defineProperty(step, "instruction", {
      enumerable: true,
      get() {
        instructionReads += 1;
        return instructionReads === 1 ? "ข้อความสั้นที่ตรวจแล้ว" : "ยาว".repeat(1000);
      },
    });

    const [page] = paginateWorkDocument(document, buildMediaIndex(makeSnapshot()));

    expect(page.document.recipeName).toBe("ค่าที่ตรวจแล้ว");
    expect(page.document.steps[0].instruction).toBe("ข้อความสั้นที่ตรวจแล้ว");
    expect(recipeNameReads).toBe(1);
    expect(instructionReads).toBe(1);
  });
});

describe("buildMediaIndex", () => {
  test("resolves canonical local display media with stable ordered links and independent structures", () => {
    const first = makeMediaAsset({
      mediaId: "first",
      url: "/sample-media/first.svg",
      reviewState: "sample",
      crop: { x: 1, y: 2, width: 3, height: 4 },
    });
    const second = makeMediaAsset({
      mediaId: "second",
      url: "/sample-media/nested/second.png",
    });
    const snapshot = makeSnapshot({
      media: [first, second],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "second", order: 2 }),
        makeStepMediaLink({ stepId: "step-1", mediaId: "first", order: 1 }),
      ],
    });

    const index = buildMediaIndex(snapshot);

    expect([...index.assetsById.keys()]).toEqual(["first", "second"]);
    expect(index.assetsById.get("first")).toEqual(first);
    expect(index.assetsById.get("first")?.reviewState).toBe("sample");
    expect(index.linksByStepId.get("step-1")?.map((link) => link.mediaId)).toEqual([
      "first",
      "second",
    ]);
    expect(index.assetsById.get("first")).not.toBe(first);
    expect(index.linksByStepId.get("step-1")?.[0]).not.toBe(snapshot.stepMedia[1]);
    index.assetsById.get("first")!.crop!.x = 99;
    index.linksByStepId.get("step-1")![0].order = 99;
    expect(first.crop?.x).toBe(1);
    expect(snapshot.stepMedia[1].order).toBe(1);
  });

  test.each([
    "https://example.com/photo.jpg",
    "//example.com/photo.jpg",
    "data:image/png;base64,abc",
    "javascript:alert(1)",
    "blob:foreign",
    "/sample-media/../private.jpg",
    "/sample-media/%2e%2e/private.jpg",
    "/sample-media/photo.jpg?remote=https://example.com",
  ])("omits unsafe or non-display URL %s and its links", (url) => {
    const snapshot = makeSnapshot({
      media: [makeMediaAsset({ mediaId: "unsafe", url })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "unsafe" })],
    });

    const index = buildMediaIndex(snapshot);

    expect(index.assetsById.size).toBe(0);
    expect(index.linksByStepId.size).toBe(0);
  });

  test("omits dangling links without manufacturing media", () => {
    const index = buildMediaIndex(makeSnapshot({
      media: [makeMediaAsset({ mediaId: "known" })],
      stepMedia: [makeStepMediaLink({ mediaId: "missing" })],
    }));

    expect([...index.assetsById.keys()]).toEqual(["known"]);
    expect(index.linksByStepId.size).toBe(0);
  });

  test("validates direct containers without leaking raw runtime errors", () => {
    expect(() => buildMediaIndex(null as never)).toThrowError(
      expect.objectContaining({ name: "InvalidPrintInputError", field: "snapshot" }),
    );
    expect(() => buildMediaIndex({ media: null, stepMedia: [] } as never)).toThrow(
      InvalidPrintInputError,
    );
    expect(() => buildMediaIndex({ media: [], stepMedia: {} } as never)).toThrowError(
      expect.objectContaining({
        name: "InvalidPrintInputError",
        field: "snapshot.stepMedia",
      }),
    );
  });

  test("fails closed for malformed reachable media but ignores unrelated snapshot content", () => {
    const malformedReachable = makeMediaAsset({
      mediaId: "target",
      caption: null as never,
    });
    expect(() => buildMediaIndex(makeSnapshot({
      recipes: null as never,
      media: [malformedReachable],
      stepMedia: [makeStepMediaLink({ mediaId: "target" })],
    }))).toThrowError(expect.objectContaining({
      name: "InvalidPrintMediaError",
      mediaId: "target",
      field: "caption",
    }));

    const index = buildMediaIndex(makeSnapshot({
      recipes: null as never,
      media: [null as never, makeMediaAsset({ mediaId: "unused", caption: null as never })],
      stepMedia: [],
    }));
    expect(index.assetsById.size).toBe(0);
  });

  test("quarantines a throwing declared getter only when the asset is unreferenced", () => {
    const unreferenced = makeMediaAsset({ mediaId: "volatile" });
    Object.defineProperty(unreferenced, "url", {
      enumerable: true,
      get() {
        throw new Error("volatile URL getter");
      },
    });

    expect(buildMediaIndex(makeSnapshot({
      media: [unreferenced],
      stepMedia: [],
    })).assetsById.size).toBe(0);

    const referenced = makeMediaAsset({ mediaId: "volatile" });
    Object.defineProperty(referenced, "url", {
      enumerable: true,
      get() {
        throw new Error("volatile URL getter");
      },
    });
    expect(() => buildMediaIndex(makeSnapshot({
      media: [referenced],
      stepMedia: [makeStepMediaLink({ mediaId: "volatile" })],
    }))).toThrowError(expect.objectContaining({
      name: "InvalidPrintInputError",
      field: "snapshot.media[volatile]",
    }));
  });

  test("rejects malformed direct links with named contextual errors", () => {
    expect(() => buildMediaIndex(makeSnapshot({
      media: [makeMediaAsset({ mediaId: "target" })],
      stepMedia: [{ ...makeStepMediaLink({ mediaId: "target" }), order: 0 }],
    }))).toThrowError(expect.objectContaining({
      name: "InvalidPrintMediaLinkError",
      field: "order",
      stepId: "test-v1-1:prep:1",
      mediaId: "target",
    }));
    expect(() => buildMediaIndex(makeSnapshot({ stepMedia: [null as never] }))).toThrow(
      InvalidPrintMediaLinkError,
    );
  });

  test("rejects duplicate reachable asset IDs, link pairs, and orders", () => {
    const asset = makeMediaAsset({ mediaId: "same" });
    const baseLink = makeStepMediaLink({ stepId: "step-1", mediaId: "same", order: 1 });

    expect(() => buildMediaIndex(makeSnapshot({
      media: [asset, { ...asset }],
      stepMedia: [baseLink],
    }))).toThrowError(expect.objectContaining({
      name: "DuplicatePrintMediaError",
      duplicateKind: "asset",
      mediaId: "same",
    }));
    expect(() => buildMediaIndex(makeSnapshot({
      media: [asset],
      stepMedia: [baseLink, { ...baseLink, order: 2 }],
    }))).toThrowError(expect.objectContaining({ duplicateKind: "link" }));
    expect(() => buildMediaIndex(makeSnapshot({
      media: [asset, makeMediaAsset({ mediaId: "other" })],
      stepMedia: [baseLink, { ...baseLink, mediaId: "other" }],
    }))).toThrow(DuplicatePrintMediaError);
  });

  test("exports named media errors for callers that render a safe print failure", () => {
    expect(InvalidPrintMediaError.name).toBe("InvalidPrintMediaError");
    expect(InvalidPrintMediaLinkError.name).toBe("InvalidPrintMediaLinkError");
  });

  test("clones only declared media fields without invoking unrelated getters", () => {
    const asset = makeMediaAsset({ mediaId: "safe" }) as ReturnType<typeof makeMediaAsset> & Record<string, unknown>;
    Object.defineProperty(asset, "unrelated", {
      enumerable: true,
      get() {
        throw new Error("unrelated getter must not run");
      },
    });
    asset.callback = () => undefined;

    const index = buildMediaIndex(makeSnapshot({ media: [asset] }));
    const cloned = index.assetsById.get("safe")! as typeof asset;

    expect(Object.prototype.hasOwnProperty.call(cloned, "unrelated")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cloned, "callback")).toBe(false);
  });

  test("snapshots media and link fields once so URL and review state cannot flip after validation", () => {
    const asset = makeMediaAsset({ mediaId: "flip" });
    const link = makeStepMediaLink({ stepId: "step-1", mediaId: "flip" });
    const reads = { mediaId: 0, url: 0, reviewState: 0, order: 0 };
    Object.defineProperties(asset, {
      mediaId: {
        enumerable: true,
        get() {
          reads.mediaId += 1;
          return "flip";
        },
      },
      url: {
        enumerable: true,
        get() {
          reads.url += 1;
          return reads.url <= 2 ? "/sample-media/flip.svg" : "https://example.com/flip.svg";
        },
      },
      reviewState: {
        enumerable: true,
        get() {
          reads.reviewState += 1;
          return reads.reviewState === 1 ? "sample" : "confirmed";
        },
      },
    });
    Object.defineProperty(link, "order", {
      enumerable: true,
      get() {
        reads.order += 1;
        return reads.order <= 2 ? 1 : 99;
      },
    });

    const index = buildMediaIndex(makeSnapshot({ media: [asset], stepMedia: [link] }));

    expect(index.assetsById.get("flip")?.url).toBe("/sample-media/flip.svg");
    expect(index.assetsById.get("flip")?.reviewState).toBe("sample");
    expect(index.linksByStepId.get("step-1")?.[0].order).toBe(1);
    expect(reads).toEqual({ mediaId: 1, url: 1, reviewState: 1, order: 1 });
  });
});

describe("adversarial runtime diagnostics", () => {
  test.each([
    Object.create(null),
    { [Symbol.toPrimitive]() { throw new Error("coercion"); } },
    { toString() { throw new Error("coercion"); } },
  ])("keeps invalid settings errors named when values cannot be stringified", (value) => {
    expect(() => resolveTemplate(value as never, "prep")).toThrowError(
      expect.objectContaining({ name: "InvalidPrintSettingsError", field: "template", value }),
    );
  });

  test("translates hostile input getters to named public-boundary errors", () => {
    const hostileSnapshot = new Proxy({}, {
      get() {
        throw new Error("hostile getter");
      },
    });
    const hostileDocument = new Proxy({}, {
      get() {
        throw new Error("hostile getter");
      },
    });

    expect(() => buildMediaIndex(hostileSnapshot as never)).toThrowError(
      expect.objectContaining({ name: "InvalidPrintInputError", field: "snapshot" }),
    );
    expect(() => paginateWorkDocument(hostileDocument as never, {
      assetsById: new Map(),
      linksByStepId: new Map(),
    })).toThrowError(expect.objectContaining({
      name: "InvalidPrintDocumentError",
      field: "document",
    }));
  });

  test("does not leak when a hostile getter throws a proxy error", () => {
    const hostileError = new Proxy({}, {
      getPrototypeOf() {
        throw new Error("hostile prototype");
      },
    });
    const snapshot = new Proxy({}, {
      get() {
        throw hostileError;
      },
    });

    expect(() => buildMediaIndex(snapshot as never)).toThrowError(
      expect.objectContaining({ name: "InvalidPrintInputError", field: "snapshot" }),
    );
  });
});
