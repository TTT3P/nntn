import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import type { CookbookSnapshot, RecipeVersion } from "../../domain/cookbook/types";
import { makeMediaAsset, makeRecipe, makeSnapshot, makeStepMediaLink, makeWorkStep } from "../../test/builders";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { RecipeLibraryPage } from "./RecipeLibraryPage";

afterEach(cleanup);

function recipe(overrides: Partial<RecipeVersion>): RecipeVersion {
  return makeRecipe({
    recipeId: "base",
    recipeVersionId: `version-${String(overrides.recipeId ?? "base")}`,
    name: "สูตรพื้นฐาน",
    kind: "prepared_recipe",
    reviewState: "confirmed",
    methodText: "ทำตามขั้นตอน",
    workDocuments: {
      prep: {
        stage: "prep",
        scalable: true,
        ingredientLineKeys: [],
        steps: [makeWorkStep({ stepId: `step-${String(overrides.recipeId ?? "base")}` })],
      },
    },
    ...overrides,
  });
}

function librarySnapshot(): CookbookSnapshot {
  const recipes = [
    recipe({ recipeId: 159, name: "ข้าวหน้าเนื้อยากินิกุ", kind: "sellable_menu", workDocuments: {
      service: { stage: "service", scalable: false, ingredientLineKeys: [], steps: [makeWorkStep({ stepId: "step-159", stage: "service" })] },
    } }),
    recipe({ recipeId: "missing", name: "สูตรไม่มีวิธี", methodText: "\u200b\u0301\t" }),
    recipe({ recipeId: "conflict", name: "สูตรข้อมูลขัดแย้ง", reviewState: "conflict" }),
    recipe({ recipeId: "review", name: "สูตรรอตรวจรูป" }),
    recipe({ recipeId: "complete", name: "สูตรพร้อม", workDocuments: {
      cook: { stage: "cook", scalable: true, ingredientLineKeys: [], steps: [makeWorkStep({ stepId: "step-complete", stage: "cook" })] },
    } }),
  ];
  return makeSnapshot({
    recipes,
    media: [
      makeMediaAsset({ mediaId: "review-media" }),
      makeMediaAsset({ mediaId: "complete-media" }),
    ],
    stepMedia: [
      makeStepMediaLink({ stepId: "step-review", mediaId: "review-media", reviewNeeded: true }),
      makeStepMediaLink({ stepId: "step-complete", mediaId: "complete-media" }),
    ],
  });
}

describe("RecipeLibraryPage", () => {
  test("searches Thai recipe names without mutating names or making identifiers primary labels", async () => {
    const user = userEvent.setup();
    const snapshot = librarySnapshot();
    const before = structuredClone(snapshot);
    renderWithPrototype(<RecipeLibraryPage />, { snapshot });

    await user.type(screen.getByRole("searchbox", { name: "ค้นหาสูตรอาหาร" }), "  ยากินิกุ  ");

    expect(screen.getByRole("link", { name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
    expect(screen.queryByText("159")).not.toBeInTheDocument();
    expect(snapshot).toEqual(before);
  });

  test.each([
    ["ประเภทสูตร", "sellable_menu", "ข้าวหน้าเนื้อยากินิกุ"],
    ["ขั้นตอนงาน", "cook", "สูตรพร้อม"],
  ])("filters independently with %s", async (label, value, expectedName) => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });

    await user.selectOptions(screen.getByLabelText(label), value);

    expect(screen.getByRole("link", { name: expectedName })).toBeVisible();
    expect(screen.getByText("1 สูตร")).toBeVisible();
  });

  test.each([
    ["เฉพาะสูตรที่วิธีทำไม่ครบ", "สูตรไม่มีวิธี", "วิธีทำยังไม่ครบ"],
    ["เฉพาะสูตรที่แหล่งข้อมูลขัดแย้ง", "สูตรข้อมูลขัดแย้ง", "แหล่งข้อมูลขัดแย้ง"],
    ["เฉพาะสูตรที่รูปขั้นตอนไม่ครบ", "ข้าวหน้าเนื้อยากินิกุ", "รูปขั้นตอนไม่ครบ"],
    ["เฉพาะสูตรที่รูปต้องตรวจสอบ", "สูตรรอตรวจรูป", "รูปต้องตรวจสอบ"],
  ])("filters independently by %s", async (label, expectedName, status) => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });

    await user.click(screen.getByRole("checkbox", { name: label }));

    expect(screen.getByRole("link", { name: expectedName })).toBeVisible();
    expect(screen.getAllByText(status).length).toBeGreaterThan(0);
  });

  test("combines filters and keeps missing media separate from readiness draft status", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });

    await user.selectOptions(screen.getByLabelText("ประเภทสูตร"), "sellable_menu");
    await user.click(screen.getByRole("checkbox", { name: "เฉพาะสูตรที่รูปขั้นตอนไม่ครบ" }));

    expect(screen.getByRole("link", { name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
    expect(screen.getByText("พร้อมใช้งาน")).toBeVisible();
    expect(screen.queryByText("ฉบับร่าง")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "สูตรไม่มีวิธี" })).not.toBeInTheDocument();
  });

  test("treats a dangling media link as missing coverage and not review work", async () => {
    const user = userEvent.setup();
    const dangling = recipe({ recipeId: "dangling", name: "สูตรลิงก์รูปเสีย" });
    const snapshot = makeSnapshot({
      recipes: [dangling],
      media: [],
      stepMedia: [
        makeStepMediaLink({
          stepId: "step-dangling",
          mediaId: "missing-media",
          reviewNeeded: true,
        }),
      ],
    });
    renderWithPrototype(<RecipeLibraryPage />, { snapshot });

    await user.click(
      screen.getByRole("checkbox", { name: "เฉพาะสูตรที่รูปขั้นตอนไม่ครบ" }),
    );
    expect(screen.getByRole("link", { name: "สูตรลิงก์รูปเสีย" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
    await user.click(
      screen.getByRole("checkbox", { name: "เฉพาะสูตรที่รูปต้องตรวจสอบ" }),
    );
    expect(screen.getByText("0 สูตร")).toBeVisible();
  });

  test("shows an accurate empty state and clears every search and filter control", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });

    await user.type(screen.getByRole("searchbox", { name: "ค้นหาสูตรอาหาร" }), "ไม่พบแน่นอน");
    await user.selectOptions(screen.getByLabelText("ประเภทสูตร"), "sellable_menu");
    expect(screen.getByText("0 สูตร")).toBeVisible();
    expect(screen.getByText("ไม่พบสูตรที่ตรงกับเงื่อนไข")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));

    expect(screen.getByRole("searchbox", { name: "ค้นหาสูตรอาหาร" })).toHaveValue("");
    expect(screen.getByLabelText("ประเภทสูตร")).toHaveValue("all");
    expect(screen.getByText("5 สูตร")).toBeVisible();
  });
});
