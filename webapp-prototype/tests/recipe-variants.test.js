"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeVariants, buildVariantRecipes, suggestSku } = require("../recipe-variants.js");

test("normalizeVariants keeps multiple non-empty protein parts in one variant", () => {
  const variants = normalizeVariants([
    {
      id: "beef-mix",
      name: "เนื้อรวม",
      price: "95",
      active: true,
      parts: [
        { name: "เนื้อใบพาย", amount: "70", unit: "กรัม" },
        { name: "เนื้อน่องลาย", amount: "50", unit: "กรัม" },
        { name: "", amount: "", unit: "กรัม" }
      ]
    }
  ]);

  assert.equal(variants.length, 1);
  assert.equal(variants[0].parts.length, 2);
  assert.deepEqual(variants[0].parts.map((part) => part.name), ["เนื้อใบพาย", "เนื้อน่องลาย"]);
});

test("buildVariantRecipes combines base ingredients with each variant parts", () => {
  const baseRecipe = {
    id: "current",
    name: "กะเพรา",
    category: "เมนูหลัก",
    ingredients: [{ name: "ซอสกะเพรา", amount: "30", unit: "กรัม" }],
    steps: ["ผัดให้หอม"]
  };

  const recipes = buildVariantRecipes(baseRecipe, [
    {
      id: "beef-mix",
      name: "เนื้อรวม",
      price: "95",
      active: true,
      parts: [
        { name: "เนื้อใบพาย", amount: "70", unit: "กรัม" },
        { name: "เนื้อน่องลาย", amount: "50", unit: "กรัม" }
      ]
    }
  ]);

  assert.equal(recipes.length, 1);
  assert.equal(recipes[0].id, "current--beef-mix");
  assert.equal(recipes[0].name, "กะเพรา · เนื้อรวม");
  assert.equal(recipes[0].price, "95");
  assert.deepEqual(recipes[0].ingredients.map((ingredient) => ingredient.name), [
    "ซอสกะเพรา",
    "เนื้อใบพาย",
    "เนื้อน่องลาย"
  ]);
});

test("buildVariantRecipes returns the base recipe when no usable variants exist", () => {
  const baseRecipe = {
    id: "current",
    name: "สูตรใหม่",
    ingredients: [{ name: "น้ำ", amount: "100", unit: "มิลลิลิตร" }]
  };

  assert.deepEqual(buildVariantRecipes(baseRecipe, []), [baseRecipe]);
  assert.deepEqual(buildVariantRecipes(baseRecipe, [{ name: "", parts: [] }]), [baseRecipe]);
});

test("buildVariantRecipes appends a variant-specific SOP note without changing base steps", () => {
  const baseRecipe = { id: "current", name: "กะเพรา", ingredients: [], steps: ["ผัดซอส"] };
  const recipes = buildVariantRecipes(baseRecipe, [{
    id: "beef",
    name: "เนื้อ",
    note: "ผัดเนื้อ 45 วินาที",
    parts: [{ name: "เนื้อใบพาย", amount: "120", unit: "กรัม" }]
  }]);

  assert.deepEqual(baseRecipe.steps, ["ผัดซอส"]);
  assert.deepEqual(recipes[0].steps, ["ผัดซอส", "เฉพาะเนื้อ: ผัดเนื้อ 45 วินาที"]);
});

test("normalizeVariants keeps status, sellable metadata and enabled channel routes", () => {
  const [variant] = normalizeVariants([{
    id: "stew-tendon",
    name: "เนื้อตุ๋น + เอ็น",
    status: "inactive",
    code: "ST",
    sku: "KPR-ST",
    station: "กระทะ 1",
    branchRoute: "selected",
    routes: [
      { channel: "store", enabled: true, externalSku: "FS-1043" },
      { channel: "grab", enabled: false, externalSku: "GR-2043" }
    ],
    parts: [{ name: "เนื้อตุ๋น", amount: "80", unit: "กรัม" }]
  }]);

  assert.equal(variant.status, "inactive");
  assert.equal(variant.active, false);
  assert.equal(variant.sku, "KPR-ST");
  assert.equal(variant.station, "กระทะ 1");
  assert.equal(variant.branchRoute, "selected");
  assert.deepEqual(variant.routes.filter((route) => route.enabled).map((route) => route.channel), ["store"]);
});

test("buildVariantRecipes respects explicit single and variant modes", () => {
  const baseRecipe = { id: "current", name: "กะเพรา", ingredients: [], steps: [] };
  const variants = [
    { id: "pork", name: "หมู", status: "active", parts: [{ name: "หมูบด", amount: "120", unit: "กรัม" }] },
    { id: "beef", name: "เนื้อ", status: "draft", parts: [{ name: "เนื้อ", amount: "120", unit: "กรัม" }] },
    { id: "chicken", name: "ไก่", status: "inactive", parts: [{ name: "ไก่", amount: "120", unit: "กรัม" }] }
  ];

  assert.deepEqual(buildVariantRecipes(baseRecipe, variants, { mode: "single" }), [baseRecipe]);
  assert.deepEqual(buildVariantRecipes(baseRecipe, variants, { mode: "variant" }).map((recipe) => recipe.id), ["current--pork"]);
  assert.deepEqual(buildVariantRecipes(baseRecipe, variants.map((variant) => ({ ...variant, status: "inactive" })), { mode: "variant" }), []);
});

test("suggestSku creates a stable uppercase internal SKU from explicit codes", () => {
  assert.equal(suggestSku("kpr", "bf-mix"), "KPR-BF-MIX");
  assert.equal(suggestSku("", ""), "MENU-V01");
});
