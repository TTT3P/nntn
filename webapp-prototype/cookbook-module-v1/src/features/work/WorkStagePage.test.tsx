import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { CookbookSnapshot, RecipeVersion, WorkStage } from "../../domain/cookbook/types";
import { FixtureCookbookRepository } from "../../data/FixtureCookbookRepository";
import { makeIngredientLine, makeMediaAsset, makeRecipe, makeSnapshot, makeStepMediaLink, makeWorkStep } from "../../test/builders";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { encodeRecipeIdentity } from "../recipe/recipeRoute";
import { WorkStagePage } from "./WorkStagePage";

afterEach(cleanup);
afterAll(() => vi.restoreAllMocks());

let firstSet: CookbookSnapshot;
beforeAll(async () => {
  firstSet = await new FixtureCookbookRepository().loadSnapshot();
});

function renderWork(options: { snapshot: CookbookSnapshot; route: string }) {
  return renderWithPrototype(
    <Routes><Route path="/work/:recipeId" element={<WorkStagePage />} /></Routes>,
    options,
  );
}

function document(stage: WorkStage, lineKey: string, instruction: string) {
  return {
    stage,
    scalable: stage !== "service",
    ingredientLineKeys: [lineKey],
    steps: [makeWorkStep({ stepId: `${lineKey}:${stage}`, stage, instruction })],
  };
}

function stagedRecipe(overrides: Partial<RecipeVersion> = {}): RecipeVersion {
  const line = makeIngredientLine({ lineKey: "root-line", sourceText: "1 ช้อนโต๊ะ\nห้ามแปลงหน่วย" });
  return makeRecipe({
    recipeId: 37,
    recipeVersionId: "root-v1",
    name: "เมนูหลัก",
    kind: "sellable_menu",
    lines: [line],
    workDocuments: {
      prep: document("prep", line.lineKey, "เตรียมของ"),
      cook: document("cook", line.lineKey, "ปรุงอาหาร"),
      service: document("service", line.lineKey, "จัดเสิร์ฟ"),
    },
    ...overrides,
  });
}

describe("WorkStagePage", () => {
  test.each([
    ["numeric", "/work/404?stage=all"],
    ["encoded string", `/work/${encodeRecipeIdentity("candidate:missing")}?stage=all`],
  ])("classifies an absent %s selected root as a route-level not-found", (_kind, route) => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route,
    });

    expect(screen.getByRole("alert")).toHaveAccessibleName("เปิดจุดงานไม่ได้");
    expect(screen.getByText("รหัสสูตรไม่ถูกต้องหรือไม่มีอยู่ในคลังสูตร")).toBeVisible();
    expect(screen.queryByText("สร้างเอกสารจุดงานไม่ได้")).not.toBeInTheDocument();
  });

  test("shows only service steps and the 180 gram cooked rice portion", () => {
    renderWork({
      snapshot: firstSet,
      route: "/work/165?stage=service",
    });
    expect(screen.getByText("ข้าวหอมมะลิหุงสุก")).toBeVisible();
    expect(screen.getByText("180 กรัม")).toBeVisible();
    expect(screen.queryByText("72 กรัม")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "จัดเสิร์ฟหน้าร้าน" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "ครัวปรุง / BOM" })).not.toBeInTheDocument();
  });

  test("defaults a missing stage to all and labels stages in operational order", () => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37",
    });
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["ผลิตซอสและของเตรียม", "ครัวปรุง / BOM", "จัดเสิร์ฟหน้าร้าน"]);
  });

  test("accepts exact numeric and string identities and preserves them in stage links", () => {
    const numeric = stagedRecipe({ recipeId: 1, recipeVersionId: "numeric" });
    const textual = stagedRecipe({ recipeId: "1", recipeVersionId: "text", name: "สูตรข้อความ" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [numeric, textual] }),
      route: `/work/${encodeRecipeIdentity("1")}?stage=prep`,
    });
    expect(screen.getByRole("heading", { level: 2, name: "สูตรข้อความ" })).toBeVisible();
    expect(screen.getByRole("link", { name: "ครัวปรุง / BOM" })).toHaveAttribute(
      "href",
      `/work/${encodeRecipeIdentity("1")}?stage=cook`,
    );
  });

  test.each(["invalid", "", "PREP", "prep&stage=cook", "prep&extra=1", "all&extra=1"])(
    "rejects invalid explicit stage query %s",
    (stage) => {
      renderWork({
        snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
        route: `/work/37?stage=${stage}`,
      });
      expect(screen.getByRole("alert")).toHaveAccessibleName("จุดงานไม่ถูกต้อง");
      expect(screen.getByRole("link", { name: "ดูทุกจุดงาน" })).toHaveAttribute("href", "/work/37?stage=all");
    },
  );

  test("rejects a query containing only an unrelated parameter", () => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?extra=1",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("จุดงานไม่ถูกต้อง");
  });

  test("updates the selected stage through accessible navigation", async () => {
    const user = userEvent.setup();
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });

    await user.click(screen.getByRole("link", { name: "ครัวปรุง / BOM" }));

    expect(screen.getByRole("heading", { level: 3, name: "ครัวปรุง / BOM" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 3, name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
  });

  test("renders dependency-first recipes once and never projects unrelated recipes", () => {
    const dependency = stagedRecipe({
      recipeId: "dep",
      recipeVersionId: "dep-v1",
      name: "สูตรเตรียมก่อน",
      kind: "prepared_recipe",
      lines: [makeIngredientLine({ lineKey: "dep-line", sourceText: "2 ช้อนชา" })],
      workDocuments: { prep: document("prep", "dep-line", "ทำสูตรเตรียม") },
    });
    const root = stagedRecipe({
      lines: [makeIngredientLine({ lineKey: "root-dep", itemKind: "prepared_recipe", componentRecipeId: "dep", ingredientId: null })],
      workDocuments: { prep: document("prep", "root-dep", "ประกอบเมนู") },
    });
    const unrelated = stagedRecipe({ recipeId: 99, recipeVersionId: "other", name: "สูตรนอกกราฟ" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root, unrelated, dependency] }),
      route: "/work/37?stage=prep",
    });

    const recipeHeadings = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(recipeHeadings).toEqual(["สูตรเตรียมก่อน", "เมนูหลัก"]);
    expect(screen.queryByText("สูตรนอกกราฟ")).not.toBeInTheDocument();
  });

  test("does not render empty stages and explains an explicitly selected unmapped stage", () => {
    const recipe = stagedRecipe({ workDocuments: { cook: document("cook", "root-line", "ทอด") } });
    const all = renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=all",
    });
    expect(screen.getByRole("heading", { name: "ครัวปรุง / BOM" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
    all.unmount();

    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=service",
    });
    expect(screen.getByText("เมนูนี้ไม่มีขั้นตอนในจุดงานที่เลือก")).toBeVisible();
  });

  test("renders exact source fields without conversion and separates DRAFT from media gaps", () => {
    const recipe = stagedRecipe({
      blockers: ["ยืนยันวิธีทอด"],
      lines: [makeIngredientLine({ lineKey: "root-line", sourceText: null, sourceValue: 1.5, sourceUnit: "ช้อนโต๊ะ (เดิม)" })],
      workDocuments: { prep: document("prep", "root-line", "เตรียม") },
    });
    const before = structuredClone(recipe);
    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=prep",
    });
    expect(screen.getByText("1.5 ช้อนโต๊ะ (เดิม)")).toBeVisible();
    expect(screen.getByText("DRAFT")).toBeVisible();
    expect(screen.getByText("ยืนยันวิธีทอด")).toBeVisible();
    expect(screen.getByText("รูปขั้นตอนไม่ครบ")).toBeVisible();
    expect(recipe).toEqual(before);
  });

  test("surfaces malformed identities and graph/projection failures as named errors", () => {
    const malformed = renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/01?stage=all",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("เปิดจุดงานไม่ได้");
    malformed.unmount();

    const root = stagedRecipe({
      lines: [makeIngredientLine({ lineKey: "missing", itemKind: "prepared_recipe", componentRecipeId: "unknown", ingredientId: null })],
    });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root] }),
      route: "/work/37?stage=all",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("Unresolved dependency");
  });

  test("keeps an unknown reachable component classified as a document error", () => {
    const root = stagedRecipe({
      lines: [makeIngredientLine({ lineKey: "unknown-component", itemKind: "prepared_recipe", componentRecipeId: "candidate:missing", ingredientId: null })],
    });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root] }),
      route: "/work/37?stage=all",
    });

    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.queryByText("เปิดจุดงานไม่ได้")).not.toBeInTheDocument();
  });

  test("surfaces work-document integrity errors without partial output", () => {
    const recipe = stagedRecipe();
    recipe.workDocuments.prep!.stage = "cook";
    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=prep",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("WorkDocumentStageIntegrityError");
    expect(screen.queryByRole("heading", { name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
  });

  test("rejects duplicate selected identities before mixing recipe revisions", () => {
    const first = stagedRecipe({ recipeVersionId: "root-v1", name: "ชื่อ revision แรก" });
    const second = stagedRecipe({ recipeVersionId: "root-v2", name: "ชื่อ revision สอง" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [first, second] }),
      route: "/work/37?stage=all",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("DuplicateRecipeIdentityError");
    expect(screen.queryByText("ชื่อ revision แรก")).not.toBeInTheDocument();
    expect(screen.queryByText("ชื่อ revision สอง")).not.toBeInTheDocument();
  });

  test("rejects duplicate version IDs in the reachable graph but ignores unreachable duplicates", () => {
    const dependency = stagedRecipe({ recipeId: "dep", recipeVersionId: "shared-v1", name: "สูตรย่อย" });
    const root = stagedRecipe({
      recipeVersionId: "shared-v1",
      lines: [makeIngredientLine({ lineKey: "root-dep", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "dep" })],
      workDocuments: { prep: document("prep", "root-dep", "ประกอบ") },
    });
    const unreachableA = stagedRecipe({ recipeId: 90, recipeVersionId: "outside-v1" });
    const unreachableB = stagedRecipe({ recipeId: 91, recipeVersionId: "outside-v1" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root, dependency, unreachableA, unreachableB] }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("DuplicateReachableRecipeVersionIdError");
  });

  test("turns malformed projected render values into a named alert without partial output", () => {
    const recipe = stagedRecipe();
    recipe.lines[0]!.itemName = { hostile: true } as never;
    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("InvalidProjectedWorkDocumentFieldError");
    expect(screen.queryByRole("heading", { name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
  });

  test("does not introduce a nested main landmark", () => {
    const view = renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });
    expect(view.container.querySelector("main")).toBeNull();
  });

  test("renders a media editor for each visible projected step", () => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByRole("group", { name: "รูปของขั้นตอน เตรียมของ" })).toBeVisible();
    expect(screen.getByText("เพิ่มรูปภายหลัง")).toBeVisible();
    expect(screen.getByText("แก้ไขรูปได้เฉพาะ session นี้")).toBeVisible();
  });

  test("edits media through a visible work step without changing readiness status", async () => {
    const user = userEvent.setup();
    renderWork({
      snapshot: makeSnapshot({
        recipes: [stagedRecipe()],
        media: [makeMediaAsset({ mediaId: "prep-photo", caption: "ภาพเตรียม", altText: "ภาพเตรียมของ" })],
        stepMedia: [makeStepMediaLink({ stepId: "root-line:prep", mediaId: "prep-photo", reviewNeeded: true })],
      }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByText("รูปควรตรวจใหม่")).toBeVisible();
    expect(screen.getByText("พร้อมใช้งาน")).toBeVisible();
    expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ชนิดรูป"), "final");
    await user.selectOptions(screen.getByLabelText("ภาชนะ"), "plate");
    expect(screen.getByLabelText("ชนิดรูป")).toHaveValue("final");
    expect(screen.getByLabelText("ภาชนะ")).toHaveValue("plate");
    expect(screen.getByText("พร้อมใช้งาน")).toBeVisible();
  });

  test("previews a local file from the visible stage editor", async () => {
    const user = userEvent.setup();
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });

    await user.upload(
      screen.getByLabelText("เลือกรูป"),
      new File(["preview"], "station-prep.png", { type: "image/png" }),
    );

    expect(screen.getByAltText("ตัวอย่าง station-prep.png")).toBeVisible();
    expect(screen.getByText("รูปนี้อยู่เฉพาะ session และจะหายเมื่อ reload")).toBeVisible();
    expect(screen.getByText("พร้อมใช้งาน")).toBeVisible();
  });
});
