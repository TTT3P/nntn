"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const kitchenData = require("../data/kitchen-sot-first-set-v2.json");
const { createKitchenSotStore } = require("../kitchen-sot.js");

test("first-set v2 contains 16 versioned recipes and no derived quantities", () => {
  assert.equal(kitchenData.recipes.length, 16);
  assert.deepEqual(kitchenData.root_recipe_ids, [165, 159, 37, 163]);

  for (const recipe of kitchenData.recipes) {
    assert.match(recipe.recipe_version_id, /^kitchen-v2-/);
    assert.ok(["sellable_menu", "prepared_recipe"].includes(recipe.recipe_type));
    assert.equal(Object.hasOwn(recipe, "normalized_grams"), false);
  }
});

test("ผัดผัก keeps the DOCX method and source kitchen units", () => {
  const stirFry = kitchenData.recipes.find((recipe) => recipe.recipe_id === 157);

  assert.match(stirFry.method_candidate_text, /ไมโครเวฟไฟสูง 2 นาที/);
  assert.deepEqual(
    stirFry.items.filter((item) => item.candidate_text).map((item) => item.candidate_text),
    ["25 กรัม", "25 กรัม", "1 ช้อนชา", "1 ช้อนชา", "1 กรัม", "1 กรัม", "1 กรัม"]
  );
});

test("recipe tree separates menu, prepared recipes, and direct ingredients", () => {
  const store = createKitchenSotStore(kitchenData);
  const tree = store.getRecipeTree(159);

  assert.equal(tree.recipe.recipe_name, "ข้าวหน้าเนื้อยากินิกุ");
  assert.deepEqual(tree.children.map((child) => child.recipe.recipe_name), ["ซอสยากินิกุ", "ผัดผัก", "น้ำจิ้มซีฟู๊ด"]);
  assert.ok(tree.directIngredients.some((item) => item.item_name.includes("พิคานย่า")));
});

test("print bundle is dependency-first and de-duplicates prepared recipes", () => {
  const store = createKitchenSotStore(kitchenData);
  const bundle = store.buildPrintBundle([165, 159]);
  const recipeIds = bundle.recipes.map((recipe) => recipe.recipe_id);

  assert.equal(new Set(recipeIds).size, recipeIds.length);
  assert.ok(recipeIds.indexOf(158) < recipeIds.indexOf(159));
});

test("dependency cycles are named and block printing", () => {
  const cyclic = structuredClone(kitchenData);
  cyclic.recipes.find((recipe) => recipe.recipe_id === 156).items.push({
    line_key: "cycle",
    item_name: "เมนูหลัก",
    item_kind: "prepared_recipe",
    component_recipe_id: 159,
    source_values: {},
    candidate_text: "1 ชุด",
    selected_source: "manual_review",
    decision_status: "confirmed",
    decision_note: "fixture"
  });

  const result = createKitchenSotStore(cyclic).buildPrintBundle([159]);
  assert.equal(result.allowedFinal, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "dependency_cycle"));
  assert.ok(result.blockers.some((blocker) => blocker.message.includes("ข้าวหน้าเนื้อยากินิกุ")));
});

test("editing a spoon value never creates normalized grams", () => {
  const store = createKitchenSotStore(kitchenData);
  const updated = store.updateItemCandidate(157, "ผัดผัก:น้ำมันปาล์ม", "1 ช้อนชา", "ยืนยันจาก DOCX");
  const palmOil = updated.items.find((item) => item.line_key === "ผัดผัก:น้ำมันปาล์ม");

  assert.equal(palmOil.candidate_text, "1 ช้อนชา");
  assert.equal(palmOil.decision_note, "ยืนยันจาก DOCX");
  assert.equal(JSON.stringify(updated).includes("normalized_grams"), false);
});

test("a DOCX-only section stays a named blocked candidate recipe", () => {
  const sourceOnly = structuredClone(kitchenData);
  sourceOnly.recipes.push({
    recipe_id: "candidate:example-docx:ซอสใหม่",
    legacy_recipe_id: null,
    recipe_version_id: "kitchen-v2-candidate-example-draft-001",
    recipe_name: "ซอสใหม่",
    recipe_type: "prepared_recipe",
    parent_recipe_ids: [159],
    review_state: "missing_legacy_recipe",
    source_locators: ["DOCX: example.docx / ซอสใหม่"],
    items: [],
    method_candidate_text: null,
    blockers: [{ code: "missing_legacy_recipe", message: "ยังไม่มีสูตรเดิมบนเว็บ" }]
  });

  const store = createKitchenSotStore(sourceOnly);
  const candidate = store.getRecipe("candidate:example-docx:ซอสใหม่");
  assert.equal(candidate.recipe_name, "ซอสใหม่");
  assert.equal(store.evaluateRecipe(candidate.recipe_id).status, "blocked");
});

test("recipeTreeRows uses names and depth instead of requiring recipe codes", () => {
  const rows = createKitchenSotStore(kitchenData).recipeTreeRows(159);

  assert.deepEqual(rows.map(({ name, depth }) => ({ name, depth })), [
    { name: "ข้าวหน้าเนื้อยากินิกุ", depth: 0 },
    { name: "ซอสยากินิกุ", depth: 1 },
    { name: "ผัดผัก", depth: 1 },
    { name: "ซอสอเนกประสงค์", depth: 2 },
    { name: "น้ำจิ้มซีฟู๊ด", depth: 1 }
  ]);
  assert.equal(rows.some((row) => /^RCP-|^SRCP-/.test(row.name)), false);
});

test("recipeTreeRows shows each prepared recipe once even when V1 has duplicate lines", () => {
  const rows = createKitchenSotStore(kitchenData).recipeTreeRows(165);
  const secretSauceRows = rows.filter((row) => row.name === "ซอสลับ (v2)");

  assert.equal(secretSauceRows.length, 1);
});
