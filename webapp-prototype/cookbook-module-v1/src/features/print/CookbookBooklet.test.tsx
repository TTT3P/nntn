import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { makeIngredientLine, makeRecipe } from "../../test/builders";
import { CookbookBooklet } from "./CookbookBooklet";

describe("CookbookBooklet", () => {
  test("renders cover, contents, and recipe pages in reading order without expanding referenced components", () => {
    const sauce = makeRecipe({
      recipeId: "RCP-156",
      recipeVersionId: "sauce-v1",
      name: "ซอสยากินิกุ",
      kind: "prepared_recipe",
    });
    const menu = makeRecipe({
      recipeId: "RCP-069",
      recipeVersionId: "menu-v1",
      name: "ข้าวหน้าเนื้อยากินิกุ",
      kind: "sellable_menu",
      yieldText: "1 จาน",
      operationalNotes: ["ตักข้าวหุงสุก 180 กรัม"],
      lines: [makeIngredientLine({
        lineKey: "sauce",
        itemName: "ซอสยากินิกุ",
        itemKind: "prepared_recipe",
        componentRecipeId: "RCP-156",
        sourceText: "30 กรัม",
      })],
      methodText: "ราดซอสและจัดเสิร์ฟ",
    });

    const view = render(
      <CookbookBooklet
        recipes={[menu]}
        allRecipes={[menu, sauce]}
        readinessFor={() => "ready"}
      />,
    );

    expect(screen.getByRole("heading", { name: "คู่มือสูตรครัว NNTN" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "สารบัญ" })).toBeVisible();
    expect(screen.getByRole("article", { name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
    expect(screen.getByText("ซอสยากินิกุ · RCP-156")).toBeVisible();
    expect(view.container.querySelectorAll(".cookbook-page--recipe")).toHaveLength(1);
    expect(view.container.textContent).not.toMatch(/cost|ต้นทุน|AI|schema|source|blocker|V[456]/iu);
  });

  test("keeps an incomplete recipe printable with neutral fill-later cues", () => {
    const recipe = makeRecipe({
      recipeId: 162,
      name: "ผงคั่วพริกเกลือ",
      kind: "prepared_recipe",
      yieldText: null,
      methodText: null,
      operationalNotes: ["เก็บข้อมูลเพิ่มเติมภายหลัง"],
      lines: [makeIngredientLine({ itemName: "พริก", sourceText: "10 กรัม" })],
    });

    render(
      <CookbookBooklet
        recipes={[recipe]}
        allRecipes={[recipe]}
        readinessFor={() => "draft"}
      />,
    );

    const page = screen.getByRole("article", { name: "ผงคั่วพริกเกลือ" });
    expect(within(page).getByText("ข้อมูลยังไม่ครบ")).toBeVisible();
    expect(within(page).getByText("รอเติมผลผลิต")).toBeVisible();
    expect(within(page).getByText("รอเติมวิธีทำ")).toBeVisible();
    expect(within(page).getByText("พริก")).toBeVisible();
    expect(within(page).getByText("10 กรัม")).toBeVisible();
    expect(within(page).getByText("เก็บข้อมูลเพิ่มเติมภายหลัง")).toBeVisible();
  });

  test("splits a long contents list into physical pages and keeps reading-order page numbers", () => {
    const recipes = Array.from({ length: 13 }, (_, index) => makeRecipe({
      recipeId: `RCP-${String(index + 1).padStart(3, "0")}`,
      recipeVersionId: `recipe-${String(index + 1)}`,
      name: `สูตรลำดับ ${String(index + 1)}`,
      kind: "prepared_recipe",
    }));

    const view = render(
      <CookbookBooklet
        recipes={recipes}
        allRecipes={recipes}
        readinessFor={() => "ready"}
      />,
    );

    expect(view.container.querySelectorAll(".cookbook-page--contents")).toHaveLength(2);
    const firstContents = view.container.querySelector<HTMLElement>(".cookbook-page--contents");
    expect(firstContents).not.toBeNull();
    expect(within(firstContents!).getByText("04")).toBeVisible();
    expect(within(firstContents!).getByText("15")).toBeVisible();
  });
});
