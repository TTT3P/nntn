"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const kitchenData = require("../data/kitchen-sot-first-set-v2.json");

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
