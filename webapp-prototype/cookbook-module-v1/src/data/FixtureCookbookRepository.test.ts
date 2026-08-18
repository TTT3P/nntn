import { describe, expect, test } from "vitest";
import type { WorkStage } from "../domain/cookbook/types";
import { FixtureCookbookRepository } from "./FixtureCookbookRepository";
import cookSvg from "../../public/sample-media/cook-doneness.svg?raw";
import prepSvg from "../../public/sample-media/prep-cut-size.svg?raw";
import serviceSvg from "../../public/sample-media/service-delivery-layout.svg?raw";
import recipeFixtureText from "./fixtures/first-set.json?raw";

const repository = new FixtureCookbookRepository();

const expectedRecipeIds = [
  165,
  164,
  2,
  160,
  9,
  161,
  158,
  159,
  156,
  157,
  14,
  37,
  28,
  16,
  163,
  162,
  "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
  "candidate:prepared:ข้าวหอมมะลิหุงสุก",
];

const expectedCandidateLinks = [
  {
    lineKey: "ข้าวหน้าเนื้อตุ๋น:ข้าวญี่ปุ่น",
    componentRecipeId: "candidate:prepared:ข้าวหอมมะลิหุงสุก",
  },
  {
    lineKey: "ข้าวหน้าเนื้อยากินิกุ:ข้าวญี่ปุ่น",
    componentRecipeId: "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
  },
  {
    lineKey: "ข้าวขยำเนื้อแดดเดียว:ข้าวหอมมะลิ",
    componentRecipeId: "candidate:prepared:ข้าวหอมมะลิหุงสุก",
  },
];

const expectedBlockers = [
  "แป้งมันฮ่องกง แป้งข้าวโพด และน้ำผสมแป้งใช้เท่าไรในฉบับลายมือสุดท้าย",
  "DOCX V3 ยังไม่มีลำดับวิธีปรุงน้ำซุป และขอบเขตสูตรนี้ไม่รวมขั้นตอนลงเนื้อ",
  "ยังไม่มีวิธีผสมซอสลับ V3",
  "ยังไม่มีวิธีเตรียมชุดเครื่องเทศ V3",
  "ลำดับวิธีทำชุดปรุงรอบ 2 เว้นว่างไว้รอเจ้าของเติมภายหลัง",
  "น้ำเปล่าใช้ 120 กรัมตามรายการ หรือ 100 กรัมตามขั้นตอน",
  "น้ำเปล่า 100 กรัมใน DOCX ต้องใส่หรือไม่ เพราะไม่อยู่ใน V2/ลายมือ",
  "ยืนยันยี่ห้อน้ำมันหอย น้ำตาล และหน่วยเหล้าจีน 25 กรัมหรือ 25 ml",
  "ยังขาดข้อมูล: วิธีเตรียมชิ้นเนื้อก่อนหมัก การเก็บ และผลผลิตหลังตาก",
  "ขั้นตอนการผสม การเก็บ และผลผลิตสุดท้าย",
  "มีสัดส่วนผสมครบ แต่ยังไม่มีขั้นตอนคลุก/เก็บ/ผลผลิต จึงพิมพ์ได้เฉพาะฉบับร่าง",
  "ยังขาดข้อมูล: โปรแกรมหม้อ เวลา การพักข้าว และผลผลิตข้าวสุกต่อแบตช์",
  "ยังขาดข้อมูล: โปรแกรมหม้อ เวลา การพักข้าว และน้ำหนักข้าวสุกต่อแบตช์",
];

const expectedWorkDocuments: Array<
  [recipeVersionId: string, stage: WorkStage, stepCount: number]
> = [
  ["kitchen-v2-165-draft-001", "service", 2],
  ["kitchen-v2-164-draft-001", "prep", 5],
  ["kitchen-v2-2-draft-001", "prep", 0],
  ["kitchen-v2-160-draft-001", "prep", 0],
  ["kitchen-v2-9-draft-001", "prep", 0],
  ["kitchen-v2-161-draft-001", "prep", 0],
  ["kitchen-v2-158-draft-001", "prep", 3],
  ["kitchen-v2-159-draft-001", "service", 3],
  ["kitchen-v2-156-draft-001", "prep", 3],
  ["kitchen-v2-157-draft-001", "prep", 2],
  ["kitchen-v2-14-draft-001", "prep", 7],
  ["kitchen-v2-37-draft-001", "cook", 2],
  ["kitchen-v2-37-draft-001", "service", 5],
  ["kitchen-v2-28-draft-001", "prep", 3],
  ["kitchen-v2-16-draft-001", "prep", 4],
  ["kitchen-v2-163-draft-001", "cook", 4],
  ["kitchen-v2-162-draft-001", "prep", 0],
  ["kitchen-v2-candidate-cooked-japanese-rice-draft-001", "prep", 2],
  ["kitchen-v2-candidate-cooked-jasmine-rice-draft-001", "prep", 2],
];

describe("FixtureCookbookRepository", () => {
  test("loads every recipe and ingredient line without normalizing kitchen quantities", async () => {
    const snapshot = await repository.loadSnapshot();

    expect(snapshot.recipes.map((recipe) => recipe.recipeId)).toEqual(
      expectedRecipeIds,
    );
    expect(
      snapshot.recipes.reduce((count, recipe) => count + recipe.lines.length, 0),
    ).toBe(126);

    const vegetables = snapshot.recipes.find(
      (recipe) => recipe.name === "ผัดผัก",
    );
    const teaspoonLine = vegetables?.lines.find(
      (line) => line.sourceText === "1 ช้อนชา",
    );

    expect(teaspoonLine).toMatchObject({
      sourceText: "1 ช้อนชา",
      sourceValue: null,
      sourceUnit: null,
    });
  });

  test("preserves candidate recipe identities and every incoming component edge", async () => {
    const snapshot = await repository.loadSnapshot();
    const candidateRecipes = snapshot.recipes.filter(
      (recipe) => typeof recipe.recipeId === "string",
    );
    const candidateLinks = snapshot.recipes
      .flatMap((recipe) => recipe.lines)
      .filter((line) => typeof line.componentRecipeId === "string")
      .map(({ lineKey, componentRecipeId }) => ({ lineKey, componentRecipeId }));
    const allComponentLinks = snapshot.recipes
      .flatMap((recipe) => recipe.lines)
      .filter((line) => line.componentRecipeId !== null);

    expect(candidateRecipes.map((recipe) => recipe.recipeId)).toEqual([
      "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
      "candidate:prepared:ข้าวหอมมะลิหุงสุก",
    ]);
    expect(candidateLinks).toEqual(expectedCandidateLinks);
    expect(allComponentLinks).toHaveLength(18);
    expect(
      allComponentLinks.every((link) =>
        snapshot.recipes.some(
          (recipe) => recipe.recipeId === link.componentRecipeId,
        ),
      ),
    ).toBe(true);
  });

  test("maps every blocker object to its exact message", async () => {
    const snapshot = await repository.loadSnapshot();
    const blockers = snapshot.recipes.flatMap((recipe) => recipe.blockers);

    expect(blockers).toEqual(expectedBlockers);
    expect(blockers.every((blocker) => typeof blocker === "string")).toBe(true);
  });

  test("maps all fixture review states and preserves method text", async () => {
    const snapshot = await repository.loadSnapshot();
    const reviewCounts = snapshot.recipes.reduce<Record<string, number>>(
      (counts, recipe) => ({
        ...counts,
        [recipe.reviewState]: (counts[recipe.reviewState] ?? 0) + 1,
      }),
      {},
    );
    const riceMenu = snapshot.recipes.find((recipe) => recipe.recipeId === 165);

    expect(reviewCounts).toEqual({ candidate: 11, conflict: 4, blocked: 3 });
    expect(
      [
        165,
        164,
        162,
        "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
      ].map((recipeId) =>
        snapshot.recipes.find((recipe) => recipe.recipeId === recipeId)
          ?.reviewState,
      ),
    ).toEqual(["candidate", "conflict", "blocked", "blocked"]);
    expect(riceMenu?.methodText).toBe(
      "1. นำเนื้อตุ๋นที่แพ็คไว้ไปอุ่นในไมโครเวฟ ไฟแรง 2 นาที\n2. นำน้ำเนื้อตุ๋นเทใส่ถ้วยน้ำจิ้ม ส่วนตัวเนื้อเทใส่ถาดรองอาหาร โรยด้วยผักชีไทยนิดหน่อย เสิร์ฟคู่กับน้ำจิ้มซีฟู๊ด",
    );
  });

  test("creates all 47 stable ordered work steps", async () => {
    const snapshot = await repository.loadSnapshot();
    let totalSteps = 0;

    for (const [recipeVersionId, stage, stepCount] of expectedWorkDocuments) {
      const recipe = snapshot.recipes.find(
        (candidate) => candidate.recipeVersionId === recipeVersionId,
      );
      const steps = recipe?.workDocuments[stage]?.steps;
      totalSteps += steps?.length ?? 0;

      expect(steps?.map(({ stepId, order }) => ({ stepId, order }))).toEqual(
        Array.from({ length: stepCount }, (_, index) => ({
          stepId: `${recipeVersionId}:${stage}:${index + 1}`,
          order: index + 1,
        })),
      );
    }

    expect(totalSteps).toBe(47);
  });

  test("returns independent snapshots on repeated loads", async () => {
    const first = await repository.loadSnapshot();
    const firstRecipe = first.recipes[0];
    const firstBlockerRecipe = first.recipes.find(
      (recipe) => recipe.blockers.length > 0,
    );

    firstRecipe.name = "changed";
    firstRecipe.lines[0].sourceText = "changed";
    firstRecipe.sourceLocators.push("changed");
    firstRecipe.workDocuments.service?.steps.splice(0);
    const firstBlocker = firstBlockerRecipe?.blockers[0] as unknown;
    if (typeof firstBlocker === "object" && firstBlocker !== null) {
      (firstBlocker as { message: string }).message = "changed";
    } else if (firstBlockerRecipe) {
      firstBlockerRecipe.blockers[0] = "changed";
    }

    const second = await repository.loadSnapshot();
    const secondRiceMenu = second.recipes.find(
      (recipe) => recipe.recipeId === 165,
    );

    expect(secondRiceMenu?.name).toBe("ข้าวหน้าเนื้อตุ๋น");
    expect(secondRiceMenu?.lines[0].sourceText).toBe("75 กรัม");
    expect(secondRiceMenu?.sourceLocators).not.toContain("changed");
    expect(secondRiceMenu?.workDocuments.service?.steps).toHaveLength(2);
    expect(second.recipes.flatMap((recipe) => recipe.blockers)).toEqual(
      expectedBlockers,
    );
    expect(second.media[0]).not.toBe(first.media[0]);
    expect(second.media[0].crop).not.toBe(first.media[0].crop);
  });

  test("maps three local demo media samples to real stable work steps", async () => {
    const snapshot = await repository.loadSnapshot();
    const allStepIds = new Set(snapshot.recipes.flatMap((recipe) =>
      Object.values(recipe.workDocuments).flatMap((document) =>
        document ? document.steps.map((step) => step.stepId) : [],
      ),
    ));

    expect(snapshot.media).toHaveLength(3);
    expect(snapshot.stepMedia).toHaveLength(3);
    expect(snapshot.media.map(({ url, reviewState, localSessionOnly }) => ({ url, reviewState, localSessionOnly }))).toEqual([
      { url: "/sample-media/prep-cut-size.svg", reviewState: "sample", localSessionOnly: true },
      { url: "/sample-media/cook-doneness.svg", reviewState: "sample", localSessionOnly: true },
      { url: "/sample-media/service-delivery-layout.svg", reviewState: "sample", localSessionOnly: true },
    ]);
    expect(snapshot.stepMedia).toEqual([
      expect.objectContaining({ stepId: "kitchen-v2-164-draft-001:prep:1", order: 1, role: "checkpoint", vessel: "plate", reviewNeeded: false }),
      expect.objectContaining({ stepId: "kitchen-v2-37-draft-001:cook:2", order: 1, role: "final", vessel: "plate", reviewNeeded: false }),
      expect.objectContaining({ stepId: "kitchen-v2-165-draft-001:service:2", order: 1, role: "final", vessel: "delivery_box", reviewNeeded: false }),
    ]);
    expect(snapshot.stepMedia.every((link) => allStepIds.has(link.stepId))).toBe(true);

    for (const svg of [prepSvg, cookSvg, serviceSvg]) {
      expect(svg).toContain("DEMO");
      expect(svg).toMatch(/[ก-๙]/u);
      expect(svg).toMatch(/[A-Za-z]/u);
    }
  });

  test("keeps the source recipe fixture byte-for-byte unchanged", async () => {
    const bytes = new TextEncoder().encode(recipeFixtureText);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(hex).toBe(
      "09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d",
    );
  });

  test("advertises session-only non-production capabilities", () => {
    expect(repository.capabilities).toEqual({
      persistence: "session",
      mediaUpload: false,
      production: false,
    });
  });
});
