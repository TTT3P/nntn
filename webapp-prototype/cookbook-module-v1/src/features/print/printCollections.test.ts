import { describe, expect, test } from "vitest";
import { makeRecipe } from "../../test/builders";
import { buildPrintCollections } from "./printCollections";

describe("buildPrintCollections", () => {
  test("uses an editable category without classifying recipes from their names", () => {
    const collections = buildPrintCollections([
      { ...makeRecipe({ recipeId: 2, name: "น้ำซุปก๋วยเตี๋ยว V3", kind: "prepared_recipe" }), category: "ซอสและน้ำซุป" },
      { ...makeRecipe({ recipeId: 156, name: "ซอสยากินิกุ", kind: "prepared_recipe" }), category: "ซอสและน้ำซุป" },
      { ...makeRecipe({ recipeId: 28, name: "เนื้อแดด", kind: "prepared_recipe" }), category: "การเตรียมเนื้อ" },
    ]);

    expect(collections.map(({ key, label, recipes }) => ({
      key,
      label,
      recipeIds: recipes.map(({ recipeId }) => recipeId),
    }))).toEqual([
      { key: "category:การเตรียมเนื้อ", label: "การเตรียมเนื้อ", recipeIds: [28] },
      { key: "category:ซอสและน้ำซุป", label: "ซอสและน้ำซุป", recipeIds: [156, 2] },
    ]);
  });

  test("falls back by recipe kind when category is blank", () => {
    const collections = buildPrintCollections([
      { ...makeRecipe({ recipeId: 165, name: "เมนูขาย", kind: "sellable_menu" }), category: "   " },
      { ...makeRecipe({ recipeId: 14, name: "สูตรประกอบ", kind: "prepared_recipe" }), category: null },
    ]);

    expect(collections.map(({ label, recipes }) => ({
      label,
      recipeIds: recipes.map(({ recipeId }) => recipeId),
    }))).toEqual([
      { label: "เมนูและการประกอบ", recipeIds: [165] },
      { label: "สูตรเตรียมและส่วนประกอบ", recipeIds: [14] },
    ]);
  });
});
