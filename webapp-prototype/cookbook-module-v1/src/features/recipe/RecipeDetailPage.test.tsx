import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import type { CookbookSnapshot, RecipeIdentity } from "../../domain/cookbook/types";
import {
  makeIngredientLine,
  makeRecipe,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../../test/builders";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { RecipeLibraryPage } from "../library/RecipeLibraryPage";
import { RecipeDetailPage } from "./RecipeDetailPage";
import { decodeRecipeIdentity, encodeRecipeIdentity } from "./recipeRoute";

afterEach(cleanup);

function renderDetail(snapshot: CookbookSnapshot, route: string) {
  return renderWithPrototype(
    <Routes><Route path="/recipes/:recipeId" element={<RecipeDetailPage />} /></Routes>,
    { snapshot, route },
  );
}

describe("recipe identity route codec", () => {
  test.each<RecipeIdentity>([159, -2, "1", "candidate:สูตร/ไทย?x=1#ส่วน", "", "\ud800", "a|b~c"])(
    "round-trips the exact identity %j without numeric/string collisions",
    (identity) => {
      expect(decodeRecipeIdentity(encodeRecipeIdentity(identity))).toEqual(identity);
    },
  );

  test("keeps numeric and numeric-looking string routes distinct", () => {
    expect(encodeRecipeIdentity(159)).toBe("159");
    expect(encodeRecipeIdentity(1)).not.toBe(encodeRecipeIdentity("1"));
    expect(decodeRecipeIdentity("s~not-hex")).toBeNull();
    expect(decodeRecipeIdentity("01")).toBeNull();
  });
});

function graphSnapshot(): CookbookSnapshot {
  const shared = makeRecipe({ recipeId: "shared", recipeVersionId: "shared-v1", name: "ซอสกลาง", kind: "prepared_recipe" });
  const vegetables = makeRecipe({
    recipeId: 157,
    recipeVersionId: "veg-v1",
    name: "ผัดผัก",
    kind: "prepared_recipe",
    lines: [makeIngredientLine({ lineKey: "veg-shared", itemName: "ซอสกลาง", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "shared" })],
  });
  const sauce = makeRecipe({
    recipeId: "candidate:sauce",
    recipeVersionId: "sauce-v1",
    name: "ซอสยากินิกุ",
    kind: "prepared_recipe",
    reviewState: "conflict",
    lines: [makeIngredientLine({ lineKey: "sauce-shared", itemName: "ซอสกลาง", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "shared" })],
  });
  const root = makeRecipe({
    recipeId: 159,
    recipeVersionId: "menu-v1",
    name: "ข้าวหน้าเนื้อยากินิกุ",
    kind: "sellable_menu",
    lines: [
      makeIngredientLine({ lineKey: "root-veg", itemName: "ผัดผัก", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: 157 }),
      makeIngredientLine({ lineKey: "root-sauce", itemName: "ซอสยากินิกุ", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "candidate:sauce" }),
      makeIngredientLine({ lineKey: "root-beef", itemName: "เนื้อพิคานย่า", itemKind: "direct_ingredient", ingredientId: 44, componentRecipeId: null }),
    ],
  });
  return makeSnapshot({ recipes: [root, vegetables, sauce, shared] });
}

describe("RecipeDetailPage", () => {
  test("shows prepared recipes as links separately from direct ingredient text", () => {
    renderDetail(graphSnapshot(), "/recipes/159");

    expect(screen.getByRole("heading", { name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "สูตรเตรียม" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "วัตถุดิบโดยตรง" })).toBeVisible();
    expect(screen.getByRole("link", { name: "ผัดผัก" })).toHaveAttribute("href", "/recipes/157");
    const directSection = screen.getByRole("heading", { name: "วัตถุดิบโดยตรง" }).closest("section");
    expect(directSection).not.toBeNull();
    expect(within(directSection as HTMLElement).getByText("เนื้อพิคานย่า")).toBeVisible();
    expect(screen.queryByRole("link", { name: "เนื้อพิคานย่า" })).not.toBeInTheDocument();
  });

  test("resolves an encoded candidate identity exactly instead of coercing it to a number", () => {
    const stringRecipe = makeRecipe({ recipeId: "1", recipeVersionId: "string-v1", name: "สูตรรหัสข้อความ" });
    const numericRecipe = makeRecipe({ recipeId: 1, recipeVersionId: "numeric-v1", name: "สูตรรหัสตัวเลข" });
    renderDetail(makeSnapshot({ recipes: [numericRecipe, stringRecipe] }), `/recipes/${encodeRecipeIdentity("1")}`);

    expect(screen.getByRole("heading", { name: "สูตรรหัสข้อความ" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "สูตรรหัสตัวเลข" })).not.toBeInTheDocument();
  });

  test.each(["/recipes/404", "/recipes/s~broken"])("renders an accessible not-found error for %s", (route) => {
    renderDetail(graphSnapshot(), route);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("heading", { name: "ไม่พบสูตรอาหาร" })).toBeVisible();
  });

  test("shows a graph error accessibly instead of crashing", () => {
    const broken = makeRecipe({
      recipeId: 7,
      name: "สูตรลิงก์เสีย",
      lines: [makeIngredientLine({ itemKind: "prepared_recipe", componentRecipeId: "missing" })],
    });
    renderDetail(makeSnapshot({ recipes: [broken] }), "/recipes/7");

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("heading", { name: "แสดงโครงสร้างสูตรไม่ได้" })).toBeVisible();
  });

  test("labels graph node kinds, readiness, and source review state", () => {
    renderDetail(graphSnapshot(), "/recipes/159");
    expect(screen.getAllByText("เมนูขาย").length).toBeGreaterThan(0);
    expect(screen.getAllByText("สูตรเตรียม").length).toBeGreaterThan(0);
    expect(screen.getAllByText("วัตถุดิบโดยตรง").length).toBeGreaterThan(0);
    expect(screen.getAllByText("พร้อมใช้งาน").length).toBeGreaterThan(0);
    expect(screen.getAllByText("แหล่งข้อมูลขัดแย้ง").length).toBeGreaterThan(0);
  });

  test("reports the same unresolved media gap in the library and detail readiness badges", async () => {
    const user = userEvent.setup();
    const recipe = makeRecipe({
      recipeId: 77,
      name: "สูตรรูปขาด",
      workDocuments: {
        prep: {
          stage: "prep",
          scalable: true,
          ingredientLineKeys: [],
          steps: [makeWorkStep({ stepId: "step-77" })],
        },
      },
    });
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [],
      stepMedia: [
        makeStepMediaLink({
          stepId: "step-77",
          mediaId: "missing-media",
          reviewNeeded: true,
        }),
      ],
    });
    renderWithPrototype(<RecipeLibraryPage />, { snapshot });
    await user.click(
      screen.getByRole("checkbox", { name: "เฉพาะสูตรที่รูปขั้นตอนไม่ครบ" }),
    );
    expect(screen.getByRole("link", { name: "สูตรรูปขาด" })).toBeVisible();
    expect(screen.queryByText("รูปต้องตรวจสอบ")).not.toBeInTheDocument();

    cleanup();
    renderDetail(snapshot, "/recipes/77");
    expect(screen.getAllByText("รูปขั้นตอนไม่ครบ").length).toBeGreaterThan(0);
    expect(screen.queryByText("รูปต้องตรวจสอบ")).not.toBeInTheDocument();
  });

  test("expands dependency navigation and deduplicates a shared dependency", async () => {
    const user = userEvent.setup();
    renderDetail(graphSnapshot(), "/recipes/159");
    await user.click(screen.getByRole("button", { name: "แสดงสูตรที่เกี่ยวข้อง" }));

    expect(screen.getByRole("navigation", { name: "โครงสร้างสูตรที่เกี่ยวข้อง" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "ซอสกลาง" })).toHaveLength(1);
  });
});
