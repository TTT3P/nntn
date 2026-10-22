import { describe, expect, test } from "vitest";
import { UnresolvedRecipeDependencyError } from "../../domain/graph/recipeGraph";
import { makeIngredientLine, makeRecipe } from "../../test/builders";
import { projectPrintSet } from "./printSetProjection";

function preparedLine(
  lineKey: string,
  componentRecipeId: string,
  decisionStatus = "confirmed",
) {
  return makeIngredientLine({
    lineKey,
    itemName: componentRecipeId,
    itemKind: "prepared_recipe",
    ingredientId: null,
    componentRecipeId,
    decisionStatus,
  });
}

function sharedMenuRecipes() {
  const rice = {
    ...makeRecipe({
      recipeId: "RICE",
      recipeVersionId: "rice-v1",
      name: "ข้าวหุงสุก",
      kind: "prepared_recipe",
    }),
    category: "ข้าวและเครื่องเคียง",
  };
  const removedSauce = {
    ...makeRecipe({
      recipeId: "REMOVED-SAUCE",
      recipeVersionId: "removed-sauce-v1",
      name: "ซอสที่ถอดออก",
      kind: "prepared_recipe",
    }),
    category: "ซอสและน้ำจิ้ม",
  };
  const menuA = {
    ...makeRecipe({
      recipeId: "MENU-A",
      recipeVersionId: "menu-a-v1",
      name: "เมนู A",
      kind: "sellable_menu",
      lines: [
        preparedLine("menu-a:rice", "RICE"),
        preparedLine("menu-a:removed", "REMOVED-SAUCE", "removed_by_editor"),
      ],
    }),
    category: "เมนูอาหาร",
  };
  const menuB = {
    ...makeRecipe({
      recipeId: "MENU-B",
      recipeVersionId: "menu-b-v1",
      name: "เมนู B",
      kind: "sellable_menu",
      lines: [preparedLine("menu-b:rice", "RICE")],
    }),
    category: "เมนูอาหาร",
  };

  return [menuA, menuB, rice, removedSauce];
}

describe("projectPrintSet", () => {
  test("keeps collection documents in-category and lists shared active dependencies once as external references", () => {
    const collection = projectPrintSet(sharedMenuRecipes(), ["MENU-A", "MENU-B"], {
      kind: "collection",
      collectionKey: "menu",
    });

    expect(collection.fullRecipes.map(({ recipeId }) => recipeId)).toEqual(["MENU-A", "MENU-B"]);
    expect(collection.externalReferences.map(({ recipeId }) => recipeId)).toEqual(["RICE"]);
    expect(collection.duplicateFree).toBe(true);
  });

  test("expands a daily packet dependency-first without duplicates or removed dependencies", () => {
    const daily = projectPrintSet(sharedMenuRecipes(), ["MENU-A", "MENU-B"], { kind: "daily" });

    expect(daily.fullRecipes.filter(({ recipeId }) => recipeId === "RICE")).toHaveLength(1);
    expect(daily.fullRecipes.some(({ recipeId }) => recipeId === "REMOVED-SAUCE")).toBe(false);
    expect(daily.fullRecipes.map(({ recipeId }) => recipeId)).toEqual(["RICE", "MENU-A", "MENU-B"]);
    expect(daily.duplicateFree).toBe(true);
  });

  test("excludes a selected recipe outside the active collection without inferring from its name or kind", () => {
    const wrongCategory = {
      ...makeRecipe({
        recipeId: "MENU-NAMED-BUT-UNASSIGNED",
        recipeVersionId: "wrong-category-v1",
        name: "เมนูอาหารจานพิเศษ",
        kind: "sellable_menu",
      }),
      category: "หมวดเดิมจากระบบเก่า",
    };

    const collection = projectPrintSet(
      [...sharedMenuRecipes(), wrongCategory],
      ["MENU-A", "MENU-NAMED-BUT-UNASSIGNED"],
      { kind: "collection", collectionKey: "menu" },
    );

    expect(collection.fullRecipes.map(({ recipeId }) => recipeId)).toEqual(["MENU-A"]);
  });

  test("keeps throwing for an unresolved active canonical dependency", () => {
    const menu = {
      ...makeRecipe({
        recipeId: "MENU-BROKEN",
        recipeVersionId: "menu-broken-v1",
        name: "เมนูที่ลิงก์ไม่ครบ",
        kind: "sellable_menu",
        lines: [preparedLine("menu-broken:missing", "MISSING")],
      }),
      category: "เมนูอาหาร",
    };

    expect(() => projectPrintSet([menu], ["MENU-BROKEN"], {
      kind: "collection",
      collectionKey: "menu",
    })).toThrow(UnresolvedRecipeDependencyError);
  });
});
