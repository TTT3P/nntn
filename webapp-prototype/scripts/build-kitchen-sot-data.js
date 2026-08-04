"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceReview = JSON.parse(fs.readFileSync(path.join(root, "data", "first-set-review-v1.json"), "utf8"));
const imported = JSON.parse(fs.readFileSync(path.join(root, "outputs", "nntn-cookbook-import", "NNTN-Kitchen-Cookbook-Import-v1.json"), "utf8"));

const rootRecipeIds = [165, 159, 37, 163];
const manifestById = new Map(sourceReview.manifest.map((row) => [row.recipe_id, row]));
const stepsById = new Map(imported.recipe_steps.map((row) => [row.recipe_id, row.v1_steps_text]));
const recipesById = new Map(sourceReview.recipes.map((row) => [row.recipe_id, row]));

const reviewStateOverrides = new Map([
  [159, "reviewed_candidate"]
]);

const sourceLocatorAdditions = new Map([
  [159, ["PDF: true-originals/_inbox/scan จากเล่ม หน้างานจริงพนักงาน/ข้าวหน้าเนื้อยากินิกุ.pdf"]]
]);

const componentAliases = new Map([
  ["เนื้อตุ๋น (ราดข้าว)", 164],
  ["น้ำซุปในหม้อหุงข้าว", 2],
  ["เนื้อแดดเดียว", 28],
  ["น้ำยำ", 16],
  ["ซอสยากินิกุ", 156],
  ["ผัดผัก", 157],
  ["น้ำจิ้มซีฟู้ด", 158],
  ["น้ำจิ้มซีฟู๊ด", 158],
  ["ซอสอเนกประสงค์", 14],
  ["ผงคั่วพริกเกลือ", 162],
  ["ถุงเครื่องเทศ", 9],
  ["เครื่องปรุงชุดสอง", 161],
  ["ซอสลับ (v2)", 160]
]);

const methodOverrides = new Map([
  [157, [
    "1. นำแครอทและกะหล่ำปลี อย่างละ 25 กรัม ใส่ในถ้วยและเติมน้ำเปล่าให้พอท่วมผัก จากนั้นนำเข้าไมโครเวฟไฟสูง 2 นาที",
    "2. เทน้ำออก สะเด็ดน้ำ ตั้งกระทะ เปิดไฟกลาง ใส่น้ำมัน 1 ช้อนชา ใส่ผักลงไปผัด ตามด้วยซอสอเนกประสงค์ 1 ช้อนชา โชยุ 1 กรัม น้ำมันงา 1 กรัม และงาขาวคั่ว 1 กรัม"
  ].join("\n")],
  [159, [
    "1. เตรียมข้าวเปล่าจัดใส่กล่อง จากนั้นนำผัดผักที่เตรียมไว้จัดใส่บนข้าวข้างกล่อง",
    "2. นำเนื้อพิคานย่าที่ย่างไว้หั่นและเรียงบนข้าวข้างผัดผัก",
    "3. ราดซอสยากินิกุ 3 ช้อนโต๊ะลงบนเนื้อพิคานย่าและผัดผักให้ทั่ว"
  ].join("\n")],
  [2, [
    "1. ใส่กระดูกวัวลงในน้ำร้อน แล้วละลายน้ำตาลมะพร้าว 500 กรัมผ่านกระชอน",
    "2. ใส่น้ำตาลกรวด 300 กรัม ซอสฝาเขียว 1 กระบวย โชยุ ARO 2 กระบวย และรสดีก๋วยเตี๋ยว 2½ กระบวย",
    "3. ใส่กระเทียมดองพร้อมน้ำ 2 แก้ว ถุงเครื่องเทศ 1 ถุง และลูกมะกรูดผ่าครึ่ง 4 ลูก แล้วปิดฝา",
    "4. ใส่เนื้อตามลำดับ เติมน้ำที่ตักออกให้ท่วมเนื้อ ใส่หัวไชเท้า 1 หัว ใบเตย 1 กำ และซีอิ๊วดำ ¾ กระบวย",
    "5. ตุ๋นและตรวจความสุกตามชนิดเนื้อ ตักฟองและไขมันออกตามขั้นตอนในต้นฉบับ",
    "6. หลังใช้งาน กรองเศษ ต้มน้ำซุปที่เหลือจนเดือด ปิดฝา และเก็บเป็นหัวเชื้อวันถัดไป"
  ].join("\n")],
  [160, "1. ผสมโชยุ 2,500 มิลลิลิตร ซอสฝาเขียว 2,000 มิลลิลิตร และซอสหอยนางรม 2 กระบวย (500 มิลลิลิตร) รวมกันในแกลอน 5 ลิตร"],
  [9, [
    "1. โขลกข่าเหลืองหยาบแล้วคั่วจนแห้ง",
    "2. บุบอบเชยแล้วคั่วจนหอมโดยไม่ให้ไหม้ จากนั้นคั่วโป๊ยกั๊กและพริกไทยดำแยกกัน",
    "3. โขลกกระเทียมจีน 150 กรัมและรากผักชี 50 กรัมแบบหยาบ",
    "4. รวมกับพริกไทยดำ 50 กรัม โป๊ยกั๊ก 50 กรัม อบเชย 50 กรัม และข่า 100 กรัม แบ่งเป็นถุงและเก็บในช่องแช่แข็ง",
    "5. ใช้ 1 ถุงต่อหม้อเบอร์ 50"
  ].join("\n")]
]);

const candidateOverrides = new Map([
  ["165:ข้าวญี่ปุ่น", {
    itemName: "ข้าวญี่ปุ่นหุงสุก",
    componentRecipeId: "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
    candidateText: "180 กรัม",
    selectedSource: "owner_confirmation",
    decisionStatus: "confirmed_by_owner",
    decisionNote: "72 กรัมคือข้าวสารดิบ; เจ้าของเมนูยืนยันให้ตักข้าวหุงสุก 180 กรัมต่อที่",
    costBasisText: "ข้าวสารญี่ปุ่นดิบ 72 กรัม",
    servingNote: "ตักข้าวหุงสุก 180 กรัม"
  }],
  ["159:ผัดผัก", {
    candidateText: "1 ชุดตามสูตร",
    selectedSource: "docx",
    decisionStatus: "confirmed_from_docx",
    decisionNote: "DOCX ระบุให้ทำผัดผัก 1 ชุดตามสูตรก่อนนำไปจัดเสิร์ฟ"
  }],
  ["159:น้ำจิ้มซีฟู้ด", {
    candidateText: "20 กรัม",
    selectedSource: "matching_sources",
    decisionStatus: "confirmed_by_owner",
    decisionNote: "เจ้าของเมนูยืนยันวันที่ 2026-08-04",
    servingNote: "เสิร์ฟแยกในถ้วย 1 oz"
  }],
  ["159:เนื้อพิคานย่า", {
    candidateText: "75 กรัม",
    selectedSource: "matching_sources",
    decisionStatus: "confirmed",
    decisionNote: "V1 และ V2 ตรงกันที่ 75 กรัม; DOCX/สแกนกล่าวถึงเนื้อแต่ไม่ระบุน้ำหนัก และลายมือไม่มีการแก้รายการนี้"
  }],
  ["159:ข้าวญี่ปุ่น", {
    itemName: "ข้าวญี่ปุ่นหุงสุก",
    componentRecipeId: "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
    candidateText: "180 กรัม",
    selectedSource: "owner_confirmation",
    decisionStatus: "confirmed_by_owner",
    decisionNote: "72 กรัมคือข้าวสารดิบ; เจ้าของเมนูยืนยันให้ตักข้าวหุงสุก 180 กรัมต่อที่",
    costBasisText: "ข้าวสารญี่ปุ่นดิบ 72 กรัม",
    servingNote: "ตักข้าวหุงสุก 180 กรัม"
  }]
]);

const resolvedUnresolvedQuestions = new Set([
  "ข้าวหน้าเนื้อยากินิกุ:น้ำจิ้มซีฟู้ด 20 กรัมเสิร์ฟตรงไหน และผัดผักนับเป็น 1 ชุดหรือ 53 กรัม"
]);

const methodDecisionNoteOverrides = new Map([
  [159, "DOCX ระบุขั้นตอนจัดเสิร์ฟ; เจ้าของเมนูยืนยันน้ำจิ้มซีฟู้ด 20 กรัมเสิร์ฟแยกในถ้วย 1 oz และใช้ผัดผัก 1 ชุดตามสูตร"]
]);

function selectedSource(status) {
  if (status === "confirmed_from_handwriting" || status === "removed_by_handwriting") return "handwriting";
  if (status === "confirmed_from_docx") return "docx";
  if (status === "confirmed") return "matching_sources";
  return null;
}

function componentIdFor(itemName) {
  return componentAliases.get(itemName) ?? null;
}

function decisionItem(recipeId, recipeName, decision) {
  const removed = decision.status === "removed_by_handwriting";
  const override = candidateOverrides.get(`${recipeId}:${decision.item_name}`);
  const itemName = override?.itemName ?? decision.item_name;
  const componentRecipeId = override?.componentRecipeId ?? componentIdFor(itemName);
  return {
    line_key: `${recipeName}:${decision.item_name}`,
    item_name: itemName,
    item_kind: componentRecipeId === null ? "direct_ingredient" : "prepared_recipe",
    component_recipe_id: componentRecipeId,
    source_values: {
      v1: decision.v1 ?? null,
      docx: decision.docx ?? null,
      v2: decision.v2 ?? null,
      handwriting: decision.handwriting ?? null
    },
    candidate_text: removed ? null : override?.candidateText ?? decision.candidate ?? null,
    selected_source: override?.selectedSource ?? selectedSource(decision.status),
    decision_status: override?.decisionStatus ?? decision.status,
    decision_note: removed ? "ตัดออกตามลายมือ" : override?.decisionNote ?? null,
    ...(override?.servingNote ? { serving_note: override.servingNote } : {}),
    ...(override?.costBasisText ? { cost_basis_text: override.costBasisText } : {})
  };
}

function importedDependencies(recipeId) {
  return imported.recipe_items.filter((item) => item.recipe_id === recipeId && item.item_kind === "prepared_recipe");
}

function ensureImportedDependencies(recipeId, recipeName, items) {
  const componentIds = new Set(items.map((item) => item.component_recipe_id).filter((value) => value !== null));
  for (const dependency of importedDependencies(recipeId)) {
    if (componentIds.has(dependency.component_recipe_id)) continue;
    items.push({
      line_key: `${recipeName}:${dependency.item_name}`,
      item_name: dependency.item_name,
      item_kind: "prepared_recipe",
      component_recipe_id: dependency.component_recipe_id,
      source_values: { v1: `${dependency.v1_quantity_value} ${dependency.v1_unit}`, docx: null, v2: null, handwriting: null },
      candidate_text: null,
      selected_source: null,
      decision_status: "needs_review",
      decision_note: "พบเป็นสูตรประกอบใน V1 แต่ยังไม่มีค่าหน้าครัวที่ยืนยัน"
    });
  }
  return items;
}

function parentRecipeIds(recipeId) {
  return [...new Set(imported.recipe_items
    .filter((item) => item.item_kind === "prepared_recipe" && item.component_recipe_id === recipeId)
    .map((item) => item.recipe_id)
    .filter((parentId) => manifestById.has(parentId)))];
}

function methodCandidate(recipe) {
  if (methodOverrides.has(recipe.recipe_id)) return methodOverrides.get(recipe.recipe_id);
  if (recipe.method_status === "missing_method") return null;
  return stepsById.get(recipe.recipe_id) ?? null;
}

function blockersFor(recipe) {
  const blockers = sourceReview.unresolved
    .filter((issue) => issue.recipe_name === recipe.recipe_name)
    .filter((issue) => !resolvedUnresolvedQuestions.has(`${issue.recipe_name}:${issue.question}`))
    .map((issue) => ({ code: "unresolved_source_conflict", message: issue.question }));

  if (!methodCandidate(recipe)) {
    blockers.push({ code: "missing_method", message: recipe.method_note });
  }

  const hasItemConflict = (recipe.decisions || []).some((decision) => ["conflict", "needs_review"].includes(decision.status));
  if (recipe.review_state === "conflict" && blockers.length === 0 && !hasItemConflict) {
    blockers.push({ code: "unresolved_source_conflict", message: recipe.method_note });
  }

  if (recipe.review_state === "missing_source") {
    blockers.push({ code: "missing_source", message: recipe.method_note });
  }

  return blockers;
}

const recipes = sourceReview.manifest.map((manifest) => {
  const recipe = recipesById.get(manifest.recipe_id);
  const items = ensureImportedDependencies(
    recipe.recipe_id,
    recipe.recipe_name,
    (recipe.decisions || []).map((decision) => decisionItem(recipe.recipe_id, recipe.recipe_name, decision))
  );
  return {
    recipe_id: recipe.recipe_id,
    legacy_recipe_id: recipe.recipe_id,
    recipe_version_id: `kitchen-v2-${recipe.recipe_id}-draft-001`,
    recipe_name: recipe.recipe_name,
    recipe_type: manifest.role === "root_menu" ? "sellable_menu" : "prepared_recipe",
    parent_recipe_ids: parentRecipeIds(recipe.recipe_id),
    review_state: reviewStateOverrides.get(recipe.recipe_id) ?? recipe.review_state,
    source_locators: [...recipe.source_locators, ...(sourceLocatorAdditions.get(recipe.recipe_id) || [])],
    items,
    method_candidate_text: methodCandidate(recipe),
    method_selected_source: recipe.method_status.includes("handwriting") ? "handwriting" : recipe.method_status.includes("docx") || recipe.method_status === "candidate_from_docx" ? "docx" : methodCandidate(recipe) ? "matching_sources" : null,
    method_decision_note: methodDecisionNoteOverrides.get(recipe.recipe_id) ?? recipe.method_note,
    yield_candidate_text: null,
    operational_notes: [],
    blockers: blockersFor(recipe)
  };
});

recipes.push({
  recipe_id: "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
  legacy_recipe_id: null,
  recipe_version_id: "kitchen-v2-candidate-cooked-japanese-rice-draft-001",
  recipe_name: "ข้าวญี่ปุ่นหุงสุก",
  recipe_type: "prepared_recipe",
  parent_recipe_ids: [165, 159],
  review_state: "missing_source",
  source_locators: [
    "V1 import note: 72g ดิบ → 180g สุก (×2.5)",
    "Owner confirmation: 2026-08-04 — ข้าว 1500 ml + น้ำ 2100 ml + น้ำมันรำข้าว 1 ช้อนโต๊ะ; ซาว 2 รอบโดยใช้น้ำให้ท่วมข้าว"
  ],
  items: [
    {
      line_key: "ข้าวญี่ปุ่นหุงสุก:ข้าวสารญี่ปุ่นดิบ",
      item_name: "ข้าวสารญี่ปุ่นดิบ",
      item_kind: "direct_ingredient",
      component_recipe_id: null,
      source_values: {
        v1: "72 g ดิบ → 180 g สุก (×2.5)",
        docx: null,
        v2: "72 g",
        handwriting: null,
        owner_confirmation: "1500 ml"
      },
      candidate_text: "1500 ml",
      selected_source: "owner_confirmation",
      decision_status: "confirmed_by_owner",
      decision_note: "ปริมาณข้าวสารดิบสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
    },
    {
      line_key: "ข้าวญี่ปุ่นหุงสุก:น้ำ",
      item_name: "น้ำ",
      item_kind: "direct_ingredient",
      component_recipe_id: null,
      source_values: { owner_confirmation: "2100 ml" },
      candidate_text: "2100 ml",
      selected_source: "owner_confirmation",
      decision_status: "confirmed_by_owner",
      decision_note: "ปริมาณน้ำสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
    },
    {
      line_key: "ข้าวญี่ปุ่นหุงสุก:น้ำมันรำข้าว",
      item_name: "น้ำมันรำข้าว",
      item_kind: "direct_ingredient",
      component_recipe_id: null,
      source_values: { owner_confirmation: "1 ช้อนโต๊ะ" },
      candidate_text: "1 ช้อนโต๊ะ",
      selected_source: "owner_confirmation",
      decision_status: "confirmed_by_owner",
      decision_note: "ใส่ในข้าวญี่ปุ่นก่อนนำไปหุงตามที่เจ้าของยืนยัน"
    }
  ],
  method_candidate_text: [
    "1. ซาวข้าวโดยเติมน้ำให้ท่วมข้าว แล้วเทน้ำซาวออก ทำซ้ำรวม 2 รอบ",
    "2. เติมน้ำตามปริมาณที่ระบุในสูตร ใส่น้ำมันรำข้าว 1 ช้อนโต๊ะ แล้วนำไปหุง"
  ].join("\n"),
  method_selected_source: "owner_confirmation",
  method_decision_note: "เรียบเรียงจากคำบอกของครัวเท่าที่ได้รับ โดยไม่เติมเวลา โปรแกรมหม้อ หรือวิธีพักข้าว",
  yield_candidate_text: "ข้าวหุงสุก 180 กรัม ต่อข้าวสารดิบ 72 กรัม",
  operational_notes: [
    "สูตรแบตช์: ข้าวสารญี่ปุ่นดิบ 1500 ml + น้ำ 2100 ml + น้ำมันรำข้าว 1 ช้อนโต๊ะ",
    "ฐานต้นทุนต่อที่: ข้าวสารญี่ปุ่นดิบ 72 กรัม",
    "เมนูหน้าครัวตักข้าวหุงสุก 180 กรัมต่อที่"
  ],
  blockers: [{
    code: "missing_source",
    message: "ยังขาดข้อมูล: โปรแกรมหม้อ เวลา การพักข้าว และผลผลิตข้าวสุกต่อแบตช์"
  }]
});

recipes.push({
  recipe_id: "candidate:prepared:ข้าวหอมมะลิหุงสุก",
  legacy_recipe_id: null,
  recipe_version_id: "kitchen-v2-candidate-cooked-jasmine-rice-draft-001",
  recipe_name: "ข้าวหอมมะลิหุงสุก",
  recipe_type: "prepared_recipe",
  parent_recipe_ids: [],
  review_state: "missing_source",
  source_locators: [
    "Owner confirmation: 2026-08-04 — ข้าว 8 ถ้วย (350 ml) + น้ำ 2000 ml; ซาว 2 รอบโดยใช้น้ำให้ท่วมข้าว"
  ],
  items: [
    {
      line_key: "ข้าวหอมมะลิหุงสุก:ข้าวหอมมะลิดิบ",
      item_name: "ข้าวหอมมะลิดิบ",
      item_kind: "direct_ingredient",
      component_recipe_id: null,
      source_values: { owner_confirmation: "8 ถ้วย (350 ml)" },
      candidate_text: "8 ถ้วย (350 ml)",
      selected_source: "owner_confirmation",
      decision_status: "confirmed_by_owner",
      decision_note: "ปริมาณข้าวสารดิบสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
    },
    {
      line_key: "ข้าวหอมมะลิหุงสุก:น้ำ",
      item_name: "น้ำ",
      item_kind: "direct_ingredient",
      component_recipe_id: null,
      source_values: { owner_confirmation: "2000 ml" },
      candidate_text: "2000 ml",
      selected_source: "owner_confirmation",
      decision_status: "confirmed_by_owner",
      decision_note: "ปริมาณน้ำสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
    }
  ],
  method_candidate_text: [
    "1. ซาวข้าวโดยเติมน้ำให้ท่วมข้าว แล้วเทน้ำซาวออก ทำซ้ำรวม 2 รอบ",
    "2. เติมน้ำตามปริมาณที่ระบุในสูตร แล้วนำไปหุง"
  ].join("\n"),
  method_selected_source: "owner_confirmation",
  method_decision_note: "เรียบเรียงจากคำบอกของครัวเท่าที่ได้รับ โดยไม่เติมเวลา โปรแกรมหม้อ หรือวิธีพักข้าว",
  yield_candidate_text: null,
  operational_notes: ["สูตรแบตช์: ข้าวหอมมะลิ 8 ถ้วย (350 ml) + น้ำ 2000 ml"],
  blockers: [{
    code: "missing_source",
    message: "ยังขาดข้อมูล: โปรแกรมหม้อ เวลา การพักข้าว และน้ำหนักข้าวสุกต่อแบตช์"
  }]
});

const data = {
  schema_version: "2.0.0-prototype",
  generated_at: "2026-08-04T17:18:00+07:00",
  source_policy: "ลายมือแก้ไขล่าสุด > DOCX true original > V2 coverage; preserve kitchen units; never convert",
  root_recipe_ids: rootRecipeIds,
  recipes
};

const jsonPath = path.join(root, "data", "kitchen-sot-first-set-v2.json");
const jsPath = path.join(root, "data", "kitchen-sot-first-set-v2.js");
fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
fs.writeFileSync(jsPath, `window.NNTNKitchenSotFirstSetV2 = ${JSON.stringify(data, null, 2)};\n`, "utf8");
