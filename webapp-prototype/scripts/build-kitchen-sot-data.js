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
  ["159:ผัดผัก", {
    candidateText: "1 ชุดตามสูตร",
    selectedSource: "docx",
    decisionStatus: "confirmed_from_docx",
    decisionNote: "DOCX ระบุให้ทำผัดผัก 1 ชุดตามสูตรก่อนนำไปจัดเสิร์ฟ"
  }]
]);

const unresolvedQuestionOverrides = new Map([
  ["ข้าวหน้าเนื้อยากินิกุ", "น้ำจิ้มซีฟู้ด 20 กรัมเสิร์ฟตรงไหน"]
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
  const componentRecipeId = componentIdFor(decision.item_name);
  const removed = decision.status === "removed_by_handwriting";
  const override = candidateOverrides.get(`${recipeId}:${decision.item_name}`);
  return {
    line_key: `${recipeName}:${decision.item_name}`,
    item_name: decision.item_name,
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
    decision_note: removed ? "ตัดออกตามลายมือ" : override?.decisionNote ?? null
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
    .map((issue) => ({
      code: "unresolved_source_conflict",
      message: unresolvedQuestionOverrides.get(recipe.recipe_name) ?? issue.question
    }));

  if (!methodCandidate(recipe)) {
    blockers.push({ code: "missing_method", message: recipe.method_note });
  }

  if (recipe.review_state === "conflict" && blockers.length === 0) {
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
    review_state: recipe.review_state,
    source_locators: recipe.source_locators,
    items,
    method_candidate_text: methodCandidate(recipe),
    method_selected_source: recipe.method_status.includes("handwriting") ? "handwriting" : recipe.method_status.includes("docx") || recipe.method_status === "candidate_from_docx" ? "docx" : methodCandidate(recipe) ? "matching_sources" : null,
    method_decision_note: recipe.method_note,
    yield_candidate_text: null,
    operational_notes: [],
    blockers: blockersFor(recipe)
  };
});

const data = {
  schema_version: "2.0.0-prototype",
  generated_at: "2026-08-04T15:30:00+07:00",
  source_policy: "ลายมือแก้ไขล่าสุด > DOCX true original > V2 coverage; preserve kitchen units; never convert",
  root_recipe_ids: rootRecipeIds,
  recipes
};

const jsonPath = path.join(root, "data", "kitchen-sot-first-set-v2.json");
const jsPath = path.join(root, "data", "kitchen-sot-first-set-v2.js");
fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
fs.writeFileSync(jsPath, `window.NNTNKitchenSotFirstSetV2 = ${JSON.stringify(data, null, 2)};\n`, "utf8");
