"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  filterReviewQueue,
  getFirstSetReview,
  getRecipeReviewDetail,
  getSourceSectionMappings,
  summarizeImport
} = require("../import-review.js");

const fixture = {
  meta: {
    counts: {
      active_ingredients: 3,
      active_recipes: 2,
      recipe_items: 4,
      direct_ingredient_lines: 2,
      prepared_recipe_lines: 2,
      v1_g_or_ml_lines: 3,
      recipes_with_v1_method: 1,
      recipes_missing_v1_method: 1
    }
  },
  recipes: [
    { recipe_id: 1, recipe_name: "ข้าวหน้าเนื้อ", recipe_kind: "menu" },
    { recipe_id: 2, recipe_name: "ซอสยากินิกุ", recipe_kind: "prep" }
  ],
  recipe_items: [
    { item_id: 1, recipe_id: 1, line_no: 1, item_kind: "direct_ingredient", item_name: "ข้าว", v1_quantity_value: 180, v1_unit: "g", final_quantity_value: null, final_unit: null },
    { item_id: 2, recipe_id: 1, line_no: 2, item_kind: "prepared_recipe", item_name: "ซอสยากินิกุ", v1_quantity_value: 2, v1_unit: "ช้อนโต๊ะ", final_quantity_value: null, final_unit: null },
    { item_id: 3, recipe_id: 2, line_no: 1, item_kind: "direct_ingredient", item_name: "ซีอิ๊ว", v1_quantity_value: 100, v1_unit: "ml", final_quantity_value: null, final_unit: null },
    { item_id: 4, recipe_id: 2, line_no: 2, item_kind: "prepared_recipe", item_name: "น้ำซุป", v1_quantity_value: 1, v1_unit: "batch", final_quantity_value: null, final_unit: null }
  ],
  recipe_steps: [
    { recipe_id: 1, v1_steps_text: "จัดจาน", decision_status: "needs_source_review" },
    { recipe_id: 2, v1_steps_text: null, decision_status: "missing_method" }
  ],
  review_queue: [
    { recipe_id: 1, recipe_name: "ข้าวหน้าเนื้อ", recipe_kind: "menu", v1_method_status: "draft", review_status: "not_started" },
    { recipe_id: 2, recipe_name: "ซอสยากินิกุ", recipe_kind: "prep", v1_method_status: "missing", review_status: "not_started" }
  ],
  first_set_review: {
    manifest: [
      { recipe_id: 1, recipe_name: "ข้าวหน้าเนื้อ", review_state: "conflict" },
      { recipe_id: 2, recipe_name: "ซอสยากินิกุ", review_state: "reviewed_candidate" }
    ],
    source_sections: [
      {
        source_document: "ข้าวหน้าเนื้อ.docx",
        sections: [
          { section_name: "ซอสยากินิกุ", maps_to_recipe_id: 2, parent_recipe_id: 1 },
          { section_name: "จัดเสิร์ฟ", maps_to_recipe_id: 1, parent_recipe_id: null }
        ]
      }
    ],
    recipes: [
      { recipe_id: 1, review_state: "conflict", decisions: [{ item_name: "ซอส", candidate: "3 ช้อนโต๊ะ", status: "confirmed_from_docx" }] }
    ]
  }
};

test("summarizeImport exposes migration counts without recalculating units", () => {
  assert.deepEqual(summarizeImport(fixture), fixture.meta.counts);
});

test("filterReviewQueue searches by Thai menu name and filters missing methods", () => {
  assert.deepEqual(
    filterReviewQueue(fixture.review_queue, { query: "ซอส", methodStatus: "missing" })
      .map((row) => row.recipe_name),
    ["ซอสยากินิกุ"]
  );
});

test("getRecipeReviewDetail separates direct ingredients from prepared recipes", () => {
  const detail = getRecipeReviewDetail(fixture, 1);

  assert.equal(detail.recipe.recipe_name, "ข้าวหน้าเนื้อ");
  assert.deepEqual(detail.directIngredients.map((line) => line.item_name), ["ข้าว"]);
  assert.deepEqual(detail.preparedRecipes.map((line) => line.item_name), ["ซอสยากินิกุ"]);
});

test("getRecipeReviewDetail preserves V1 units and leaves final kitchen units blank", () => {
  const detail = getRecipeReviewDetail(fixture, 1);
  const sauce = detail.preparedRecipes[0];

  assert.equal(sauce.v1_quantity_value, 2);
  assert.equal(sauce.v1_unit, "ช้อนโต๊ะ");
  assert.equal(sauce.final_quantity_value, null);
  assert.equal(sauce.final_unit, null);
});

test("getFirstSetReview returns manifest state and source decisions for a recipe", () => {
  const review = getFirstSetReview(fixture, 1);

  assert.equal(review.manifest.review_state, "conflict");
  assert.equal(review.recipe.decisions[0].candidate, "3 ช้อนโต๊ะ");
});

test("getSourceSectionMappings keeps embedded DOCX sections mapped to separate recipes", () => {
  const mappings = getSourceSectionMappings(fixture, 1);

  assert.equal(mappings[0].source_document, "ข้าวหน้าเนื้อ.docx");
  assert.deepEqual(mappings[0].sections.map((section) => section.maps_to_recipe_id), [2, 1]);
});
