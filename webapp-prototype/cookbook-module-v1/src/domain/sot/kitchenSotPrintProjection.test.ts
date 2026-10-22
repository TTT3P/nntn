import { describe, expect, test } from "vitest";
import fixture from "../../data/fixtures/first-set.json";
import { makeMediaAsset, makeSnapshot, makeStepMediaLink } from "../../test/builders";
import { parseKitchenSotDocument } from "./kitchenSotDocument";
import { projectKitchenSotPrintSnapshot } from "./kitchenSotPrintProjection";

describe("projectKitchenSotPrintSnapshot", () => {
  test("projects all 18 raw recipes while preserving candidate text and mixed identities", () => {
    const document = parseKitchenSotDocument(fixture);
    const media = makeMediaAsset({ mediaId: "sample-print-media" });
    const stepMedia = makeStepMediaLink({
      mediaId: media.mediaId,
      stepId: "kitchen-v2-165-draft-001:service:1",
    });

    const projected = projectKitchenSotPrintSnapshot(
      document,
      makeSnapshot({ media: [media], stepMedia: [stepMedia] }),
    );

    expect(projected.snapshot.recipes).toHaveLength(18);
    expect(projected.snapshot.recipes.map(({ name }) => name)).toEqual(
      document.recipes.map(({ recipe_name }) => recipe_name),
    );
    expect(projected.snapshot.recipes.at(0)?.recipeId).toBe(165);
    expect(projected.snapshot.recipes.at(-1)?.recipeId)
      .toBe("candidate:prepared:ข้าวหอมมะลิหุงสุก");
    expect(projected.snapshot.media).toEqual([media]);
    expect(projected.snapshot.stepMedia).toEqual([stepMedia]);

    const menu165 = projected.snapshot.recipes.find(({ recipeId }) => recipeId === 165)!;
    const rice = menu165.lines.find(({ itemName }) => itemName === "ข้าวหอมมะลิหุงสุก")!;
    expect(rice.sourceText).toBe("180 กรัม");
    expect(rice.sourceValue).toBeNull();
    expect(rice.sourceUnit).toBeNull();
  });

  test("uses the shared raw DRAFT predicate and exposes only unresolved blockers verbatim", () => {
    const document = parseKitchenSotDocument(fixture);
    const projected = projectKitchenSotPrintSnapshot(document, makeSnapshot());

    expect(projected.recipeDraftById.get(159)).toBe(true);
    expect(projected.recipeDraftById.get(165)).toBe(false);
    expect(projected.snapshot.recipes.find(({ recipeId }) => recipeId === 164)?.blockers)
      .toEqual([
        "แป้งมันฮ่องกง แป้งข้าวโพด และน้ำผสมแป้งใช้เท่าไรในฉบับลายมือสุดท้าย",
      ]);

    const resolved = parseKitchenSotDocument(fixture);
    resolved.recipes.find(({ recipe_id }) => recipe_id === 164)!.blockers[0]!.resolved = true;
    expect(
      projectKitchenSotPrintSnapshot(resolved, makeSnapshot()).snapshot.recipes
        .find(({ recipeId }) => recipeId === 164)?.blockers,
    ).toEqual([]);
  });

  test("preserves operational facts verbatim without projecting kitchen cost basis", () => {
    const document = parseKitchenSotDocument(fixture);
    const projected = projectKitchenSotPrintSnapshot(document, makeSnapshot());

    const soup = projected.snapshot.recipes.find(({ recipeId }) => recipeId === 2)!;
    expect(soup.operationalNotes).toEqual([
      "ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70",
      "ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ",
    ]);
    expect((soup as unknown as Record<string, unknown>).methodDecisionNote).toBe(
      "DOCX V3 ระบุรายการส่วนผสมแต่ไม่มีลำดับวิธีปรุงน้ำซุป; ตัดวิธีเก่าที่มีขั้นตอนลงเนื้อออกตามขอบเขตที่เจ้าของยืนยัน",
    );

    const japaneseRice = projected.snapshot.recipes.find(
      ({ recipeId }) => recipeId === "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
    )!;
    expect((japaneseRice as unknown as Record<string, unknown>).yieldText).toBe(
      "ข้าวหุงสุก 180 กรัม ต่อข้าวสารดิบ 72 กรัม",
    );

    const yakinikuRice = projected.snapshot.recipes
      .find(({ recipeId }) => recipeId === 159)!
      .lines.find(({ itemName }) => itemName === "ข้าวญี่ปุ่นหุงสุก")!;
    expect((yakinikuRice as unknown as Record<string, unknown>).servingNote).toBe(
      "ตักข้าวหุงสุก 180 กรัม",
    );
    expect(yakinikuRice).not.toHaveProperty("costBasisText");
    expect(yakinikuRice).not.toHaveProperty("cost_basis_text");
  });

  test.each([2, 160, 9, 161, 162])(
    "keeps missing-method recipe %s printable as a DRAFT projection",
    (recipeId) => {
      const projected = projectKitchenSotPrintSnapshot(
        parseKitchenSotDocument(fixture),
        makeSnapshot(),
      );
      const recipe = projected.snapshot.recipes.find((candidate) => candidate.recipeId === recipeId)!;

      expect(recipe).toBeDefined();
      expect(recipe.methodText).toBeNull();
      expect(projected.recipeDraftById.get(recipeId)).toBe(true);
      expect(Object.keys(recipe.workDocuments)).toEqual(["prep"]);
    },
  );
});
