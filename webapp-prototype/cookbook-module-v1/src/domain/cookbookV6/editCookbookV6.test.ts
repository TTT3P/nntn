import { describe, expect, test } from "vitest";
import type { CookbookV6Document, CookbookV6IngredientLine } from "./types";
import { applyCookbookV6Edits } from "./editCookbookV6";

function makeDocument(): CookbookV6Document {
  return {
    schemaVersion: "6.0.0",
    generatedAt: "2026-08-10T00:00:00.000Z",
    derivedFrom: {
      v5Path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
      v5Sha256: "9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7",
      catalogSha256: "9aa666169fc04774ba735894553d0a8f984f566f2004cbb2a315240cf0a00d66",
    },
    recipes: [
      {
        recipeId: "RCP-026",
        code: "RCP-026",
        name: "ไข่ข้น",
        kind: "prepared_recipe",
        category: "ไข่",
        active: true,
        reviewState: "confirmed_by_owner",
        sourceLocators: [],
        yieldText: "",
        operationalNotes: [],
        methodDecisionNote: "",
        ingredients: [makeLine("egg", "ไข่ไก่", "2", "ฟอง")],
        methodSteps: [{ stepId: "mix", stage: "cook", instruction: "ตีไข่", order: 1 }],
        blockers: [],
        workDocuments: {
          cook: { stage: "cook", scalable: false, ingredientLineIds: ["egg"], stepIds: ["mix"] },
        },
        parentRecipeIds: [],
        lineage: { source: "v5", sourceRecipeId: 18 },
      },
      {
        recipeId: "RCP-002",
        code: "RCP-002",
        name: "น้ำซุปก๋วยเตี๋ยว V3",
        kind: "prepared_recipe",
        category: "",
        active: true,
        reviewState: "waiting_for_kitchen",
        sourceLocators: [],
        yieldText: "",
        operationalNotes: [],
        methodDecisionNote: "",
        ingredients: [],
        methodSteps: [],
        blockers: [],
        workDocuments: {},
        parentRecipeIds: [],
        lineage: { source: "v5", sourceRecipeId: 2 },
      },
    ],
  };
}

function makeLine(lineId: string, name: string, amountText = "", unitText = ""): CookbookV6IngredientLine {
  return {
    lineId,
    name,
    kind: "ingredient",
    amountText,
    unitText,
    sourceDisplayText: unitText === "" ? amountText : `${amountText} ${unitText}`,
    ingredientId: null,
    componentRecipeId: null,
    servingNote: "",
    costBasisText: "",
    decisionStatus: "confirmed_by_owner",
    selectedSource: "owner_confirmation",
    active: true,
  };
}

describe("applyCookbookV6Edits", () => {
  test("adds, renames, updates, reorders and removes ingredients without changing another recipe", () => {
    const document = makeDocument();
    const otherRecipeBefore = structuredClone(document.recipes[1]);
    const newLine = makeLine("oil", "น้ำมัน", "1", "ช้อนโต๊ะ");

    const edited = applyCookbookV6Edits(document, [
      { type: "ingredient-add", recipeId: "RCP-026", afterLineId: "egg", line: newLine },
      { type: "ingredient-rename", recipeId: "RCP-026", lineId: "oil", name: "น้ำมันรำข้าว" },
      { type: "ingredient-update", recipeId: "RCP-026", lineId: "oil", patch: { amountText: "2", unitText: "ช้อนชา" } },
      { type: "ingredient-move", recipeId: "RCP-026", lineId: "oil", toIndex: 0 },
      { type: "ingredient-remove", recipeId: "RCP-026", lineId: "egg" },
    ]);

    expect(edited.recipes[0]?.ingredients).toEqual([
      expect.objectContaining({ lineId: "oil", name: "น้ำมันรำข้าว", amountText: "2", unitText: "ช้อนชา", sourceDisplayText: "2 ช้อนชา" }),
    ]);
    expect(edited.recipes[0]?.workDocuments.cook?.ingredientLineIds).toEqual(["oil"]);
    expect(edited.recipes[1]).toEqual(otherRecipeBefore);
    expect(document).toEqual(makeDocument());
  });

  test("adds, updates, reorders and removes method steps", () => {
    const edited = applyCookbookV6Edits(makeDocument(), [
      { type: "method-add", recipeId: "RCP-026", step: { stepId: "season", stage: "cook", instruction: "ปรุงรส", order: 2 } },
      { type: "method-update", recipeId: "RCP-026", stepId: "season", patch: { instruction: "ปรุงรสให้เข้ากัน" } },
      { type: "method-move", recipeId: "RCP-026", stepId: "season", toIndex: 0 },
      { type: "method-remove", recipeId: "RCP-026", stepId: "mix" },
    ]);

    expect(edited.recipes[0]?.methodSteps).toEqual([
      { stepId: "season", stage: "cook", instruction: "ปรุงรสให้เข้ากัน", order: 1 },
    ]);
    expect(edited.recipes[0]?.workDocuments.cook?.stepIds).toEqual(["season"]);
  });

  test("updates recipe fields and rejects unknown targets or duplicate identities", () => {
    const edited = applyCookbookV6Edits(makeDocument(), [
      { type: "recipe-update", recipeId: "RCP-026", patch: { code: "RCP-026-NEW", name: "ไข่ข้นกระทะ", kind: "sub_recipe", active: false, yieldText: "1 ที่" } },
    ]);
    expect(edited.recipes[0]).toMatchObject({ code: "RCP-026-NEW", name: "ไข่ข้นกระทะ", kind: "sub_recipe", active: false, yieldText: "1 ที่" });

    expect(() => applyCookbookV6Edits(makeDocument(), [
      { type: "ingredient-remove", recipeId: "missing", lineId: "egg" },
    ])).toThrow("UNKNOWN_RECIPE");
    expect(() => applyCookbookV6Edits(makeDocument(), [
      { type: "ingredient-add", recipeId: "RCP-026", afterLineId: null, line: makeLine("egg", "ไข่เพิ่ม") },
    ])).toThrow("DUPLICATE_INGREDIENT_LINE");
  });
});
