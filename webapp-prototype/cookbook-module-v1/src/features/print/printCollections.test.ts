import { describe, expect, test } from "vitest";
import { makeRecipe } from "../../test/builders";
import {
  buildPrintCollections,
  recipePrintCollectionKey,
  STANDARD_PRINT_COLLECTIONS,
} from "./printCollections";

describe("buildPrintCollections", () => {
  test("returns every controlled collection in operator order and leaves unknown categories unassigned", () => {
    const menuRecipe = {
      ...makeRecipe({ recipeId: "RCP-MENU", name: "เมนู A", kind: "sellable_menu" }),
      category: "เมนูอาหาร",
    };
    const customRecipe = {
      ...makeRecipe({ recipeId: "RCP-CUSTOM", name: "สูตรเดิม", kind: "prepared_recipe" }),
      category: "หมวดเดิมจากระบบเก่า",
    };

    expect(buildPrintCollections([menuRecipe, customRecipe]).map(({ key, label, recipes }) => ({
      key,
      label,
      ids: recipes.map(({ recipeId }) => recipeId),
    }))).toEqual([
      { key: "menu", label: "เมนูอาหาร", ids: ["RCP-MENU"] },
      { key: "meat-prep", label: "เตรียมเนื้อ", ids: [] },
      { key: "sauce", label: "ซอสและน้ำจิ้ม", ids: [] },
      { key: "rice-sides", label: "ข้าวและเครื่องเคียง", ids: [] },
      { key: "stock-prep", label: "น้ำซุปและของเตรียม", ids: [] },
      { key: "plating", label: "จัดจาน", ids: [] },
      { key: "unassigned", label: "ยังไม่จัดหมวด", ids: ["RCP-CUSTOM"] },
    ]);

    expect(customRecipe.category).toBe("หมวดเดิมจากระบบเก่า");
  });

  test("matches trimmed controlled category text without falling back by recipe kind", () => {
    expect(recipePrintCollectionKey({
      ...makeRecipe({ recipeId: 2, name: "น้ำซุปก๋วยเตี๋ยว V3", kind: "prepared_recipe" }),
      category: "  น้ำซุปและของเตรียม  ",
    })).toBe("stock-prep");
    expect(recipePrintCollectionKey({
      ...makeRecipe({ recipeId: 165, name: "เมนูขาย", kind: "sellable_menu" }),
      category: "หมวดเดิมจากระบบเก่า",
    })).toBe("unassigned");
    expect(recipePrintCollectionKey({
      ...makeRecipe({ recipeId: 166, name: "เมนูขายอีกจาน", kind: "sellable_menu" }),
      category: "   ",
    })).toBe("unassigned");
  });

  test("sorts recipes within each collection by Thai name then stable recipe identity", () => {
    const collections = buildPrintCollections([
      { ...makeRecipe({ recipeId: 2, name: "ก ซอส", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
      { ...makeRecipe({ recipeId: 1, name: "ก ซอส", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
      { ...makeRecipe({ recipeId: 3, name: "ข น้ำจิ้ม", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
    ]);

    expect(collections.find(({ key }) => key === "sauce")?.recipes.map(({ recipeId }) => recipeId))
      .toEqual([1, 2, 3]);
  });

  test.each([
    [1, "1"],
    ["1", 1],
  ])("uses the recipe ID type to break equal-name ties for input order %j", (firstId, secondId) => {
    const collections = buildPrintCollections([
      { ...makeRecipe({ recipeId: firstId, name: "ก ซอส", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
      { ...makeRecipe({ recipeId: secondId, name: "ก ซอส", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
    ]);

    expect(collections.find(({ key }) => key === "sauce")?.recipes.map(({ recipeId }) => recipeId))
      .toEqual([1, "1"]);
  });

  test("exposes the controlled catalog with exact category mappings", () => {
    expect(STANDARD_PRINT_COLLECTIONS).toEqual([
      { key: "menu", label: "เมนูอาหาร", category: "เมนูอาหาร" },
      { key: "meat-prep", label: "เตรียมเนื้อ", category: "เตรียมเนื้อ" },
      { key: "sauce", label: "ซอสและน้ำจิ้ม", category: "ซอสและน้ำจิ้ม" },
      { key: "rice-sides", label: "ข้าวและเครื่องเคียง", category: "ข้าวและเครื่องเคียง" },
      { key: "stock-prep", label: "น้ำซุปและของเตรียม", category: "น้ำซุปและของเตรียม" },
      { key: "plating", label: "จัดจาน", category: "จัดจาน" },
      { key: "unassigned", label: "ยังไม่จัดหมวด", category: null },
    ]);
  });
});
