"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const kitchenData = require("../data/kitchen-sot-first-set-v2.json");
const { createKitchenSotStore } = require("../kitchen-sot.js");

test("first-set v2 contains 18 versioned recipes and no derived quantities", () => {
  assert.equal(kitchenData.recipes.length, 18);
  assert.deepEqual(kitchenData.root_recipe_ids, [165, 159, 37, 163]);

  for (const recipe of kitchenData.recipes) {
    assert.match(recipe.recipe_version_id, /^kitchen-v2-/);
    assert.ok(["sellable_menu", "prepared_recipe"].includes(recipe.recipe_type));
    assert.equal(Object.hasOwn(recipe, "normalized_grams"), false);
  }
});

test("the four root recipes are sellable menus", () => {
  const rootRecipes = kitchenData.root_recipe_ids.map((recipeId) => kitchenData.recipes.find((recipe) => recipe.recipe_id === recipeId));

  assert.ok(rootRecipes.every((recipe) => recipe.recipe_type === "sellable_menu"));
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
  assert.deepEqual(tree.children.map((child) => child.recipe.recipe_name), ["ซอสยากินิกุ", "ผัดผัก", "น้ำจิ้มซีฟู๊ด", "ข้าวญี่ปุ่นหุงสุก"]);
  assert.ok(tree.directIngredients.some((item) => item.item_name.includes("พิคานย่า")));
});

test("print bundle is dependency-first and de-duplicates prepared recipes", () => {
  const store = createKitchenSotStore(kitchenData);
  const bundle = store.buildPrintBundle([165, 159]);
  const recipeIds = bundle.recipes.map((recipe) => recipe.recipe_id);

  assert.equal(new Set(recipeIds).size, recipeIds.length);
  assert.ok(recipeIds.indexOf(158) < recipeIds.indexOf(159));
});

test("kitchen print recipes never inherit the prototype revision history", () => {
  const store = createKitchenSotStore(kitchenData);
  const bundle = store.buildPrintBundle([37]);

  assert.ok(bundle.recipes.length > 0);
  assert.ok(bundle.recipes.every((recipe) => Array.isArray(recipe.revisions)));
  assert.ok(bundle.recipes.every((recipe) => recipe.revisions.length === 0));
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
  const updated = store.updateItemCandidate(157, "ผัดผัก:น้ำมันปาล์ม", "2 ช้อนชา", "ยืนยันจากครัวจริง");
  const palmOil = updated.items.find((item) => item.line_key === "ผัดผัก:น้ำมันปาล์ม");

  assert.equal(palmOil.candidate_text, "2 ช้อนชา");
  assert.equal(palmOil.decision_note, "ยืนยันจากครัวจริง");
  assert.equal(JSON.stringify(updated).includes("normalized_grams"), false);
});

test("saving an unchanged candidate preserves its source decision", () => {
  const store = createKitchenSotStore(kitchenData);
  const before = store.getRecipe(2).items.find((item) => item.item_name === "ซอสลับสำหรับซุป V3");
  const updated = store.updateItemCandidate(2, before.line_key, before.candidate_text, "แก้ไขใน Prototype v2");
  const after = updated.items.find((item) => item.line_key === before.line_key);

  assert.equal(before.decision_status, "needs_review");
  assert.equal(after.decision_status, "needs_review");
  assert.equal(after.selected_source, before.selected_source);
  assert.equal(after.decision_note, before.decision_note);
});

test("owner can confirm an unchanged kitchen quantity without converting it", () => {
  const store = createKitchenSotStore(kitchenData);
  const before = store.getRecipe(2).items.find((item) => item.item_name === "ซอสลับสำหรับซุป V3");
  const updated = store.confirmItemCandidate(2, before.line_key, "ยืนยันเทียบกับครัวจริง");
  const after = updated.items.find((item) => item.line_key === before.line_key);
  const messages = store.evaluateRecipe(2).blockers.map((blocker) => blocker.message).join("\n");

  assert.equal(after.candidate_text, "1400 (DOCX V3 ไม่ระบุหน่วย)");
  assert.equal(after.decision_status, "confirmed_by_owner");
  assert.equal(after.selected_source, "owner_confirmation");
  assert.equal(after.decision_note, "ยืนยันเทียบกับครัวจริง");
  assert.doesNotMatch(messages, /ซอสลับสำหรับซุป V3 ยังรอครัวยืนยันค่าหน้าครัว/);
  assert.equal(JSON.stringify(updated).includes("normalized_grams"), false);
});

test("matching V1 and V2 confirm the 75 gram yakiniku beef portion", () => {
  const store = createKitchenSotStore(kitchenData);
  const yakiniku = store.getRecipe(159);
  const beef = yakiniku.items.find((item) => item.item_name === "เนื้อพิคานย่า");
  const messages = store.evaluateRecipe(159).blockers.map((blocker) => blocker.message).join("\n");

  assert.equal(beef.candidate_text, "75 กรัม");
  assert.equal(beef.decision_status, "confirmed");
  assert.equal(beef.selected_source, "matching_sources");
  assert.match(beef.decision_note, /V1 และ V2 ตรงกัน/);
  assert.equal(yakiniku.review_state, "reviewed_candidate");
  assert.doesNotMatch(messages, /เนื้อพิคานย่า/);
});

test("saving an unchanged method preserves its source", () => {
  const store = createKitchenSotStore(kitchenData);
  const before = store.getRecipe(157);
  const after = store.updateMethodCandidate(157, before.method_candidate_text, "แก้ไขใน Prototype v2");

  assert.equal(before.method_selected_source, "docx");
  assert.equal(after.method_selected_source, "docx");
  assert.equal(after.method_decision_note, before.method_decision_note);
});

test("ยากินิกุ uses one prepared batch of ผัดผัก from the DOCX", () => {
  const yakiniku = kitchenData.recipes.find((recipe) => recipe.recipe_id === 159);
  const vegetables = yakiniku.items.find((item) => item.component_recipe_id === 157);

  assert.equal(vegetables.candidate_text, "1 ชุดตามสูตร");
  assert.equal(vegetables.selected_source, "docx");
  assert.equal(vegetables.decision_status, "confirmed_from_docx");
});

test("ยากินิกุ serves 20 grams of seafood sauce separately in a 1 oz cup", () => {
  const store = createKitchenSotStore(kitchenData);
  const yakiniku = store.getRecipe(159);
  const seafood = yakiniku.items.find((item) => item.component_recipe_id === 158);
  const messages = store.evaluateRecipe(159).blockers.map((blocker) => blocker.message).join("\n");
  const printSeafood = store.buildPrintBundle([159]).recipes
    .find((recipe) => recipe.recipe_id === 159).ingredients
    .find((item) => item.name === "น้ำจิ้มซีฟู้ด");

  assert.equal(seafood.candidate_text, "20 กรัม");
  assert.equal(seafood.selected_source, "matching_sources");
  assert.equal(seafood.decision_status, "confirmed_by_owner");
  assert.equal(seafood.serving_note, "เสิร์ฟแยกในถ้วย 1 oz");
  assert.equal(printSeafood.servingNote, "เสิร์ฟแยกในถ้วย 1 oz");
  assert.doesNotMatch(messages, /น้ำจิ้มซีฟู้ด 20 กรัมเสิร์ฟตรงไหน/);
  assert.doesNotMatch(messages, /ยังต้องยืนยันน้ำจิ้มซีฟู้ด|ปริมาณผัดผัก/);
  assert.doesNotMatch(yakiniku.method_decision_note, /ยังต้องยืนยันน้ำจิ้มซีฟู้ด|ปริมาณผัดผัก/);
});

test("Japanese rice is a cooked-rice dependency with separate raw cost basis", () => {
  const cookedRiceId = "candidate:prepared:ข้าวญี่ปุ่นหุงสุก";
  const cookedRice = kitchenData.recipes.find((recipe) => recipe.recipe_id === cookedRiceId);
  const menuRiceLines = [165, 159].map((recipeId) => kitchenData.recipes
    .find((recipe) => recipe.recipe_id === recipeId).items
    .find((item) => item.component_recipe_id === cookedRiceId));

  assert.equal(cookedRice.recipe_name, "ข้าวญี่ปุ่นหุงสุก");
  assert.equal(cookedRice.recipe_type, "prepared_recipe");
  assert.equal(cookedRice.yield_candidate_text, "ข้าวหุงสุก 180 กรัม ต่อข้าวสารดิบ 72 กรัม");
  assert.equal(cookedRice.items[0].item_name, "ข้าวสารญี่ปุ่นดิบ");
  assert.equal(cookedRice.items[0].candidate_text, "1500 ml");
  assert.equal(cookedRice.items[1].item_name, "น้ำ");
  assert.equal(cookedRice.items[1].candidate_text, "2100 ml");
  const riceBranOil = cookedRice.items.find((item) => item.item_name === "น้ำมันรำข้าว");
  assert.equal(riceBranOil?.candidate_text, "1 ช้อนโต๊ะ");
  assert.equal(typeof cookedRice.method_candidate_text, "string");
  assert.match(cookedRice.method_candidate_text, /ซาวข้าว.*น้ำให้ท่วมข้าว.*2 รอบ/s);
  assert.match(cookedRice.method_candidate_text, /น้ำมันรำข้าว 1 ช้อนโต๊ะ/);

  for (const rice of menuRiceLines) {
    assert.equal(rice.item_name, "ข้าวญี่ปุ่นหุงสุก");
    assert.equal(rice.item_kind, "prepared_recipe");
    assert.equal(rice.candidate_text, "180 กรัม");
    assert.equal(rice.cost_basis_text, "ข้าวสารญี่ปุ่นดิบ 72 กรัม");
    assert.equal(rice.serving_note, "ตักข้าวหุงสุก 180 กรัม");
    assert.equal(rice.decision_status, "confirmed_by_owner");
  }
});

test("jasmine rice batch preserves the owner's cup and ml units verbatim", () => {
  const jasmineRice = kitchenData.recipes.find((recipe) => recipe.recipe_id === "candidate:prepared:ข้าวหอมมะลิหุงสุก");

  assert.equal(jasmineRice.recipe_name, "ข้าวหอมมะลิหุงสุก");
  assert.deepEqual(jasmineRice.items.map((item) => [item.item_name, item.candidate_text]), [
    ["ข้าวหอมมะลิดิบ", "8 ถ้วย (350 ml)"],
    ["น้ำ", "2000 ml"]
  ]);
  assert.equal(typeof jasmineRice.method_candidate_text, "string");
  assert.match(jasmineRice.method_candidate_text, /ซาวข้าว.*น้ำให้ท่วมข้าว.*2 รอบ/s);
  assert.doesNotMatch(jasmineRice.method_candidate_text, /น้ำมันรำข้าว/);
  assert.equal(jasmineRice.yield_candidate_text, null);
});

test("sun-dried beef exposes the seven V1/V2 marinade ingredients for kitchen review", () => {
  const marinade = kitchenData.recipes.find((recipe) => recipe.recipe_id === 28);
  const evaluation = createKitchenSotStore(kitchenData).evaluateRecipe(28);
  const messages = evaluation.blockers.map((blocker) => blocker.message).join("\n");

  assert.deepEqual(marinade.items.map((item) => [item.item_name, item.candidate_text]), [
    ["สันนอก (ดิบ)", "1000 กรัม"],
    ["รสดีก๋วยเตี๋ยวเข้มข้น", "10 กรัม"],
    ["น้ำตาลทรายไม่ขัดสี", "20 กรัม"],
    ["ผงชูรส (อายิโนะโมะโต๊ะ)", "20 กรัม"],
    ["ซอสหอยนางรม (ไฮนซ์)", "80 กรัม"],
    ["เกลือสมุทร", "4 กรัม"],
    ["พริกไทยดำเม็ด (ง่วนสูน)", "4 กรัม"]
  ]);
  assert.ok(marinade.items.every((item) => item.decision_status === "needs_review"));
  assert.equal(marinade.items.some((item) => item.item_name === "สูตรหมักทั้งชุด"), false);
  assert.equal(marinade.method_selected_source, "owner_confirmation");
  assert.equal(typeof marinade.method_candidate_text, "string");
  assert.match(marinade.method_candidate_text, /หมักเนื้อตามสูตร 1 ชั่วโมง/);
  assert.match(marinade.method_candidate_text, /แดดแรง.*ตาก 1 ชั่วโมง.*กลับด้าน.*30 นาที/s);
  assert.match(marinade.method_candidate_text, /แดดไม่แรง.*ตากต่อเนื่อง 3 ชั่วโมง.*ไม่ต้องกลับด้าน/s);
  assert.match(messages, /สันนอก \(ดิบ\) ยังรอครัวยืนยันค่าหน้าครัว/);
  assert.doesNotMatch(messages, /สันนอก \(ดิบ\) ยังมีต้นฉบับขัดแย้งกัน/);
  assert.doesNotMatch(messages, /ยังไม่มีวิธีทำ|ยังไม่พบขั้นตอนหมัก ตาก\/อบ/);
  assert.match(messages, /ยังขาดข้อมูล: วิธีเตรียมชิ้นเนื้อก่อนหมัก การเก็บ และผลผลิตหลังตาก/);
});

test("second seasoning keeps V1 as comparison evidence under the newer V3 candidate", () => {
  const store = createKitchenSotStore(kitchenData);
  const seasoning = store.getRecipe(161);
  const tree = store.getRecipeTree(161);
  const sauce = seasoning.items.find((item) => item.item_name === "ซอสลับสำหรับซุป V3");

  assert.equal(seasoning.items.length, 8);
  assert.equal(sauce.item_kind, "prepared_recipe");
  assert.equal(sauce.component_recipe_id, 160);
  assert.equal(sauce.source_values.v1, "250 ml");
  assert.equal(sauce.candidate_text, "150 (DOCX V3 ไม่ระบุหน่วย)");
  assert.equal(sauce.decision_status, "needs_review");
  assert.equal(seasoning.items.some((item) => item.item_name === "สูตรทั้งชุด"), false);
  assert.equal(tree.children[0].recipe.recipe_name, "ซอสลับสำหรับซุป V3");
  assert.match(seasoning.method_candidate_text, /ปั่น.*รวมกัน/);
});

test("noodle soup V3 keeps the owner water and pot scope without meat-stage instructions", () => {
  const store = createKitchenSotStore(kitchenData);
  const soup = store.getRecipe(2);
  const water = soup.items.find((item) => item.item_name === "น้ำเปล่า");

  assert.equal(soup.recipe_name, "น้ำซุปก๋วยเตี๋ยว V3");
  assert.ok(soup.source_locators.some((source) => source.includes("ซุปก๋วยเตี๋ยว V3.docx")));
  assert.equal(water.candidate_text, "ประมาณ 50 ลิตร");
  assert.equal(water.decision_status, "confirmed_by_owner");
  assert.match(soup.operational_notes.join("\n"), /หม้อเบอร์ 70/);
  assert.match(soup.operational_notes.join("\n"), /ไม่รวมขั้นตอนลงเนื้อ/);
  assert.equal(soup.method_candidate_text, null);
  assert.equal(soup.method_selected_source, null);
  assert.doesNotMatch(`${soup.method_candidate_text || ""}\n${soup.method_decision_note}`, /ใส่เนื้อ|ตุ๋น.*ชนิดเนื้อ/);
  assert.match(JSON.stringify(soup.source_section_mappings), /ซุปก๋วยเตี๋ยว V3\.docx/);
  assert.doesNotMatch(JSON.stringify(soup.source_section_mappings), /การลงเนื้อ/);

  const printSoup = store.buildPrintBundle([2]).recipes.find((recipe) => recipe.recipe_id === 2);
  assert.deepEqual(printSoup.operationalNotes, [
    "ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70",
    "ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ"
  ]);
});

test("noodle soup V3 preserves missing units instead of inventing grams or milliliters", () => {
  const store = createKitchenSotStore(kitchenData);
  const soup = store.getRecipe(2);

  assert.deepEqual(soup.items.slice(0, 12).map((item) => [item.item_name, item.candidate_text]), [
    ["น้ำเปล่า", "ประมาณ 50 ลิตร"],
    ["ซอสลับสำหรับซุป V3", "1400 (DOCX V3 ไม่ระบุหน่วย)"],
    ["น้ำตาลมะพร้าว", "350 (DOCX V3 ไม่ระบุหน่วย)"],
    ["น้ำตาลกรวด", "250 (DOCX V3 ไม่ระบุหน่วย)"],
    ["รสดีก๋วยเตี๋ยวเข้มข้น", "500 (DOCX V3 ไม่ระบุหน่วย)"],
    ["รสดี ผงปรุงรสเนื้อ", "100 (DOCX V3 ไม่ระบุหน่วย)"],
    ["ซีอิ๊วดำ", "170 (DOCX V3 ไม่ระบุหน่วย)"],
    ["กระเทียมดอง", "1 ถ้วย"],
    ["เกลือ", "10 (DOCX V3 ไม่ระบุหน่วย)"],
    ["มะกรูด", "4 ลูก"],
    ["ใบเตย", "10 ใบ"],
    ["หัวไชเท้า", "2 หัว"]
  ]);
  assert.equal(soup.items.find((item) => item.item_name === "ชุดเครื่องเทศสำหรับซุป V3").candidate_text, null);
  assert.equal(soup.items.find((item) => item.item_name === "ชุดปรุงรอบ 2 สำหรับซุป V3").candidate_text, null);
});

test("noodle soup V3 updates all three prepared component formulas", () => {
  const store = createKitchenSotStore(kitchenData);
  const sauce = store.getRecipe(160);
  const spices = store.getRecipe(9);
  const roundTwo = store.getRecipe(161);

  assert.equal(sauce.recipe_name, "ซอสลับสำหรับซุป V3");
  assert.deepEqual(sauce.items.map((item) => [item.item_name, item.candidate_text]), [
    ["โชยุ", "2100 (DOCX V3 ไม่ระบุหน่วย)"],
    ["ซอสฝาเขียว", "1000 (DOCX V3 ไม่ระบุหน่วย)"],
    ["ซีอิ๊วขาว", "1000 (DOCX V3 ไม่ระบุหน่วย)"],
    ["ซอสหอยนางรม", "400 ml"]
  ]);
  assert.equal(sauce.items.find((item) => item.item_name === "ซอสหอยนางรม").decision_status, "confirmed_by_owner");

  assert.equal(spices.recipe_name, "ชุดเครื่องเทศสำหรับซุป V3");
  assert.equal(spices.items.length, 11);
  assert.deepEqual(spices.items.map((item) => item.candidate_text), [
    "20 (DOCX V3 ไม่ระบุหน่วย)", "20 (DOCX V3 ไม่ระบุหน่วย)", "20 (DOCX V3 ไม่ระบุหน่วย)",
    "100 (DOCX V3 ไม่ระบุหน่วย)", "100 (DOCX V3 ไม่ระบุหน่วย)", "100 (DOCX V3 ไม่ระบุหน่วย)",
    "7 (DOCX V3 ไม่ระบุหน่วย)", "7 (DOCX V3 ไม่ระบุหน่วย)", "50 (DOCX V3 ไม่ระบุหน่วย)",
    "15 (DOCX V3 ไม่ระบุหน่วย)", "3 (DOCX V3 ไม่ระบุหน่วย)"
  ]);

  assert.equal(roundTwo.recipe_name, "ชุดปรุงรอบ 2 สำหรับซุป V3");
  assert.deepEqual(roundTwo.items.slice(-3).map((item) => [item.item_name, item.candidate_text]), [
    ["ม้ามตุ๋น", "50 กรัม"],
    ["ใบเตย", "3 ใบ"],
    ["ข่า", "2 แว่น"]
  ]);
  assert.match(roundTwo.method_candidate_text, /ปั่น.*ม้ามตุ๋น.*ใบเตย.*ข่า.*รวมกัน/);
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
    { name: "น้ำจิ้มซีฟู๊ด", depth: 1 },
    { name: "ข้าวญี่ปุ่นหุงสุก", depth: 1 }
  ]);
  assert.equal(rows.some((row) => /^RCP-|^SRCP-/.test(row.name)), false);
});

test("recipeTreeRows shows each prepared recipe once even when V1 has duplicate lines", () => {
  const rows = createKitchenSotStore(kitchenData).recipeTreeRows(165);
  const secretSauceRows = rows.filter((row) => row.name === "ซอสลับสำหรับซุป V3");

  assert.equal(secretSauceRows.length, 1);
});

test("blocked recipes become draft print models with blocker text", () => {
  const bundle = createKitchenSotStore(kitchenData).buildPrintBundle([159]);

  assert.equal(bundle.allowedFinal, false);
  assert.ok(bundle.recipes.every((recipe) => recipe.id.startsWith("kitchen:")));
  assert.ok(bundle.blockers.some((blocker) => blocker.recipeName === "ซอสยากินิกุ"));
  assert.ok(bundle.recipes.find((recipe) => recipe.recipe_id === 156).blockers.length > 0);
});

test("print ingredients use candidate text without unit conversion", () => {
  const bundle = createKitchenSotStore(kitchenData).buildPrintBundle([159]);
  const vegetables = bundle.recipes.find((recipe) => recipe.name === "ผัดผัก");

  assert.ok(vegetables.ingredients.some((item) => item.amount === "1" && item.unit === "ช้อนชา"));
  assert.ok(vegetables.ingredients.some((item) => item.sourceAmountText === "1 ช้อนชา"));
  assert.equal(JSON.stringify(bundle).includes("normalized"), false);
});
