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
  [2, "reviewed_candidate"],
  [9, "reviewed_candidate"],
  [160, "reviewed_candidate"],
  [161, "reviewed_candidate"],
  [159, "reviewed_candidate"],
  [28, "reviewed_candidate"]
]);

const sourceLocatorAdditions = new Map([
  [165, [
    "Owner confirmation: 2026-08-04 — ข้าวหน้าเนื้อตุ๋นใช้ข้าวหอมมะลิ ไม่ใช่ข้าวญี่ปุ่น; น้ำหนักข้าวหอมมะลิหุงสุกต่อจานยังรอยืนยัน"
  ]],
  [2, [
    "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx",
    "Owner confirmation: 2026-08-04 — น้ำเปล่าประมาณ 50 ลิตร ใช้หม้อเบอร์ 70 และสูตรนี้ไม่รวมขั้นตอนลงเนื้อ",
    "Owner confirmation: 2026-08-04 — ซอสและซีอิ๊วใช้ ml; น้ำตาล ผงปรุงรส และเกลือใช้กรัม; ไม่ได้แปลงตัวเลขจาก V1/V2",
    "Owner confirmation: 2026-08-04 — สูตรชุดเครื่องเทศและชุดปรุงรอบ 2 ใน DOCX เป็นปริมาณเต็มชุดสำหรับซุป 1 หม้อ"
  ]],
  [9, [
    "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx / ชุดเครื่องเทศ",
    "Owner confirmation: 2026-08-04 — ตัวเลขเครื่องเทศทั้ง 11 รายการใช้หน่วยกรัม"
  ]],
  [160, [
    "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx / สูตรผสมซอสลับ",
    "Owner confirmation: 2026-08-04 — โชยุ ซอสฝาเขียว ซีอิ๊วขาว และซอสหอยนางรมใช้หน่วย ml"
  ]],
  [161, [
    "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx / ชุดปรุงรอบ 2",
    "Owner confirmation: 2026-08-04 — คิคโคแมนและซอสลับใช้ ml; น้ำตาลกรวด รสดีเนื้อ และเกลือใช้กรัม; ลำดับวิธีทำรอเติมภายหลัง"
  ]],
  [159, ["PDF: true-originals/_inbox/scan จากเล่ม หน้างานจริงพนักงาน/ข้าวหน้าเนื้อยากินิกุ.pdf"]],
  [28, [
    "PDF: true-originals/_inbox/scan จากเล่ม หน้างานจริงพนักงาน/ข้าวขยำเนื้อแดดเดียว.pdf",
    "Owner confirmation: 2026-08-04 — หมัก 1 ชั่วโมง; แดดแรง 1 ชั่วโมง กลับด้านแล้วตากต่อ 30 นาที; แดดไม่แรง 3 ชั่วโมงไม่ต้องกลับด้าน"
  ]]
]);

const importedCandidateRecipeIds = new Set([28]);

const soupV3RecipeIds = new Set([2, 9, 160, 161]);

const recipeNameOverrides = new Map([
  [2, "น้ำซุปก๋วยเตี๋ยว V3"],
  [9, "ชุดเครื่องเทศสำหรับซุป V3"],
  [160, "ซอสลับสำหรับซุป V3"],
  [161, "ชุดปรุงรอบ 2 สำหรับซุป V3"]
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
  [28, [
    "1. หมักเนื้อตามสูตร 1 ชั่วโมง",
    "2. หากแดดแรง ตาก 1 ชั่วโมง จากนั้นกลับด้านและตากต่ออีก 30 นาที",
    "3. หากแดดไม่แรง ตากต่อเนื่อง 3 ชั่วโมงโดยไม่ต้องกลับด้าน"
  ].join("\n")],
  [157, [
    "1. นำแครอทและกะหล่ำปลี อย่างละ 25 กรัม ใส่ในถ้วยและเติมน้ำเปล่าให้พอท่วมผัก จากนั้นนำเข้าไมโครเวฟไฟสูง 2 นาที",
    "2. เทน้ำออก สะเด็ดน้ำ ตั้งกระทะ เปิดไฟกลาง ใส่น้ำมัน 1 ช้อนชา ใส่ผักลงไปผัด ตามด้วยซอสอเนกประสงค์ 1 ช้อนชา โชยุ 1 กรัม น้ำมันงา 1 กรัม และงาขาวคั่ว 1 กรัม"
  ].join("\n")],
  [159, [
    "1. เตรียมข้าวเปล่าจัดใส่กล่อง จากนั้นนำผัดผักที่เตรียมไว้จัดใส่บนข้าวข้างกล่อง",
    "2. นำเนื้อพิคานย่าที่ย่างไว้หั่นและเรียงบนข้าวข้างผัดผัก",
    "3. ราดซอสยากินิกุ 3 ช้อนโต๊ะลงบนเนื้อพิคานย่าและผัดผักให้ทั่ว"
  ].join("\n")],
  [2, null],
  [160, null],
  [9, null],
  [161, null]
]);

const candidateOverrides = new Map([
  ["165:ข้าวญี่ปุ่น", {
    itemName: "ข้าวหอมมะลิหุงสุก",
    componentRecipeId: "candidate:prepared:ข้าวหอมมะลิหุงสุก",
    candidateText: null,
    selectedSource: "owner_confirmation",
    decisionStatus: "needs_review",
    decisionNote: "เจ้าของยืนยันชนิดข้าวเป็นข้าวหอมมะลิ; ยังไม่ยืนยันน้ำหนักข้าวหอมมะลิหุงสุกต่อจาน",
    ownerConfirmation: "ข้าวหน้าเนื้อตุ๋นใช้ข้าวหอมมะลิ",
    costBasisText: "ข้าวหอมมะลิดิบ 72 กรัม"
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

function soupV3Item(recipeName, itemName, candidateText, docxText, options = {}) {
  const decisionStatus = options.decisionStatus ?? "needs_review";
  const selectedSource = decisionStatus === "confirmed_by_owner"
    ? "owner_confirmation"
    : decisionStatus === "confirmed_from_docx"
      ? "docx"
      : candidateText
        ? "docx"
        : null;
  return {
    line_key: `${recipeName}:${itemName}`,
    item_name: itemName,
    item_kind: options.componentRecipeId == null ? "direct_ingredient" : "prepared_recipe",
    component_recipe_id: options.componentRecipeId ?? null,
    source_values: {
      v1: options.v1 ?? null,
      docx: docxText,
      v2: options.v2 ?? options.v1 ?? null,
      handwriting: null,
      ...(options.ownerConfirmation ? { owner_confirmation: options.ownerConfirmation } : {})
    },
    candidate_text: candidateText,
    selected_source: selectedSource,
    decision_status: decisionStatus,
    decision_note: options.decisionNote ?? (
      decisionStatus === "needs_review"
        ? "DOCX V3 เป็นหลักฐานล่าสุด แต่ยังไม่อนุมัติค่าที่ไม่ระบุหน่วยหรือปริมาณ"
        : "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
    )
  };
}

function ownerConfirmedUnit(value) {
  return {
    ownerConfirmation: value,
    decisionStatus: "confirmed_by_owner",
    decisionNote: "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
  };
}

const soupV3ItemOverrides = new Map([
  [2, [
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "น้ำเปล่า", "ประมาณ 50 ลิตร", "ไม่มีใน DOCX V3", {
      ownerConfirmation: "ประมาณ 50 ลิตร · หม้อเบอร์ 70",
      decisionStatus: "confirmed_by_owner",
      decisionNote: "เจ้าของยืนยันวันที่ 2026-08-04; คงคำว่า ‘ประมาณ’ ไว้ตามหน้างาน"
    }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "ซอสลับสำหรับซุป V3", "1400 ml", "ซอสลับ 1400 (ไม่ระบุหน่วย)", {
      componentRecipeId: 160,
      v1: "ซอสลับ (v2) 1500 ml",
      ...ownerConfirmedUnit("1400 ml")
    }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "น้ำตาลมะพร้าว", "350 กรัม", "น้ำตาลมะพร้าว 350 (ไม่ระบุหน่วย)", { v1: "350 g", ...ownerConfirmedUnit("350 กรัม") }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "น้ำตาลกรวด", "250 กรัม", "น้ำตาลกรวด 250 (ไม่ระบุหน่วย)", { v1: "250 g", ...ownerConfirmedUnit("250 กรัม") }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "รสดีก๋วยเตี๋ยวเข้มข้น", "500 กรัม", "รสดีก๋วยเตี๋ยวเข้มข้น 500 (ไม่ระบุหน่วย)", { v1: "500 g", ...ownerConfirmedUnit("500 กรัม") }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "รสดี ผงปรุงรสเนื้อ", "100 กรัม", "รสดีเนื้อ 100 (ไม่ระบุหน่วย)", { v1: "100 g", ...ownerConfirmedUnit("100 กรัม") }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "ซีอิ๊วดำ", "170 ml", "ซีอิ๊วดำ 170 (ไม่ระบุหน่วย)", { v1: "150 g", ...ownerConfirmedUnit("170 ml") }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "กระเทียมดอง", "1 ถ้วย", "กระเทียมดอง 1 ถ้วย", { v1: "200 g", decisionStatus: "confirmed_from_docx" }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "เกลือ", "10 กรัม", "เกลือ 10 (ไม่ระบุหน่วย)", { v1: "10 g", ...ownerConfirmedUnit("10 กรัม") }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "มะกรูด", "4 ลูก", "มะกรูด 4 ลูก", { v1: "150 g", decisionStatus: "confirmed_from_docx" }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "ใบเตย", "10 ใบ", "ใบเตย 10 ใบ", { v1: "100 g", decisionStatus: "confirmed_from_docx" }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "หัวไชเท้า", "2 หัว", "หัวไชเท้า 2 หัว", { v1: "1500 g", decisionStatus: "confirmed_from_docx" }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "ชุดเครื่องเทศสำหรับซุป V3", "1 ชุดตามสูตร", "มีสูตรแยกหัวข้อ ‘ชุดเครื่องเทศ’", {
      componentRecipeId: 9,
      v1: "กระปุกเครื่องเทศ [70g] 50 ลิตร",
      ...ownerConfirmedUnit("1 ชุดตามสูตร ต่อซุป 1 หม้อ")
    }),
    soupV3Item("น้ำซุปก๋วยเตี๋ยว V3", "ชุดปรุงรอบ 2 สำหรับซุป V3", "1 ชุดตามสูตร", "มีสูตรแยกหัวข้อ ‘ชุดปรุงรอบ 2’", {
      componentRecipeId: 161,
      v1: "เครื่องปรุงชุดสอง 643 g",
      ...ownerConfirmedUnit("1 ชุดตามสูตร ต่อซุป 1 หม้อ")
    })
  ]],
  [160, [
    soupV3Item("ซอสลับสำหรับซุป V3", "โชยุ", "2100 ml", "โชยุ 2100 (ไม่ระบุหน่วย)", { v1: "1100 g", ...ownerConfirmedUnit("2100 ml") }),
    soupV3Item("ซอสลับสำหรับซุป V3", "ซอสฝาเขียว", "1000 ml", "ฝาเขียว 1000 (ไม่ระบุหน่วย)", { v1: "1000 g", ...ownerConfirmedUnit("1000 ml") }),
    soupV3Item("ซอสลับสำหรับซุป V3", "ซีอิ๊วขาว", "1000 ml", "ซีอิ๊วขาว 1000 (ไม่ระบุหน่วย)", { v1: "1000 g", ...ownerConfirmedUnit("1000 ml") }),
    soupV3Item("ซอสลับสำหรับซุป V3", "ซอสหอยนางรม", "400 ml", "ซอสหอยนางรม (ไม่ระบุปริมาณ)", {
      v1: "400 g",
      ownerConfirmation: "400 ml",
      decisionStatus: "confirmed_by_owner",
      decisionNote: "เจ้าของยืนยันวันที่ 2026-08-04; เป็นค่าหน้าครัว ไม่ใช่การแปลงจาก V1 400 g"
    })
  ]],
  [9, [
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "อบเชย", "20 กรัม", "อบเชย 20 (ไม่ระบุหน่วย)", { v1: "20 g", ...ownerConfirmedUnit("20 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "โป๊ยกั๊ก", "20 กรัม", "โป๊ยกั๊ก 20 (ไม่ระบุหน่วย)", { v1: "20 g", ...ownerConfirmedUnit("20 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "พริกไทยดำ", "20 กรัม", "พริกไทยดำ 20 (ไม่ระบุหน่วย)", { v1: "20 g", ...ownerConfirmedUnit("20 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "กระเทียมจีน", "100 กรัม", "กระเทียมจีน 100 (ไม่ระบุหน่วย)", { v1: "100 g", ...ownerConfirmedUnit("100 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "รากผักชี", "100 กรัม", "รากผักชี 100 (ไม่ระบุหน่วย)", { v1: "100 g", ...ownerConfirmedUnit("100 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "ข่าเหลือง", "100 กรัม", "ข่าเหลือง 100 (ไม่ระบุหน่วย)", { v1: "70 g", ...ownerConfirmedUnit("100 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "ซวงเจีย", "7 กรัม", "ซวงเจีย 7 (ไม่ระบุหน่วย)", { v1: "7 g · V1 ไม่พบชื่อวัตถุดิบ", ...ownerConfirmedUnit("7 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "ลูกเฉาก๋วย", "7 กรัม", "ลูกเฉาก๋วย 7 (ไม่ระบุหน่วย)", { v1: "7 g", ...ownerConfirmedUnit("7 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "ฮ่วยซัว", "50 กรัม", "ฮ่วยซัว 50 (ไม่ระบุหน่วย)", { v1: "50 g", ...ownerConfirmedUnit("50 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "เก๋ากี้", "15 กรัม", "เก๋ากี้ 15 (ไม่ระบุหน่วย)", { v1: "15 g", ...ownerConfirmedUnit("15 กรัม") }),
    soupV3Item("ชุดเครื่องเทศสำหรับซุป V3", "หญ้าหอม", "3 กรัม", "หญ้าหอม 3 (ไม่ระบุหน่วย)", { v1: "3 g", ...ownerConfirmedUnit("3 กรัม") })
  ]],
  [161, [
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "ซอสถั่วเหลืองคิคโคแมน", "20 ml", "Kikoman 20 (ไม่ระบุหน่วย)", { v1: "20 g", ...ownerConfirmedUnit("20 ml") }),
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "ซอสลับสำหรับซุป V3", "150 ml", "ซอสลับ 150 (ไม่ระบุหน่วย)", { componentRecipeId: 160, v1: "250 ml", ...ownerConfirmedUnit("150 ml") }),
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "น้ำตาลกรวด", "100 กรัม", "น้ำตาลกรวด 100 (ไม่ระบุหน่วย)", { v1: "120 g", ...ownerConfirmedUnit("100 กรัม") }),
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "รสดี ผงปรุงรสเนื้อ", "70 กรัม", "รสดีเนื้อ 70 (ไม่ระบุหน่วย)", { v1: "50 g", ...ownerConfirmedUnit("70 กรัม") }),
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "เกลือ", "5 กรัม", "เกลือ 5 (ไม่ระบุหน่วย)", { v1: "3 g", ...ownerConfirmedUnit("5 กรัม") }),
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "ม้ามตุ๋น", "50 กรัม", "ม้ามตุ๋น 50 กรัม", { v1: "200 g", decisionStatus: "confirmed_from_docx" }),
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "ใบเตย", "3 ใบ", "ใบเตย 3 ใบ", { decisionStatus: "confirmed_from_docx" }),
    soupV3Item("ชุดปรุงรอบ 2 สำหรับซุป V3", "ข่า", "2 แว่น", "ข่า 2 แว่น", { decisionStatus: "confirmed_from_docx" })
  ]]
]);

const resolvedUnresolvedQuestions = new Set([
  "ข้าวหน้าเนื้อยากินิกุ:น้ำจิ้มซีฟู้ด 20 กรัมเสิร์ฟตรงไหน และผัดผักนับเป็น 1 ชุดหรือ 53 กรัม",
  "เนื้อแดด (ข้าวขยำ):ยังไม่พบขั้นตอนหมัก ตาก/อบ การเก็บ และผลผลิตจากต้นฉบับ"
]);

const methodDecisionNoteOverrides = new Map([
  [2, "DOCX V3 ระบุรายการส่วนผสมแต่ไม่มีลำดับวิธีปรุงน้ำซุป; ตัดวิธีเก่าที่มีขั้นตอนลงเนื้อออกตามขอบเขตที่เจ้าของยืนยัน"],
  [9, "DOCX V3 ระบุรายการชุดเครื่องเทศเท่านั้น ยังไม่มีวิธีเตรียม คั่ว บด แบ่งชุด หรือวิธีเก็บ"],
  [160, "DOCX V3 ระบุรายการสูตรผสมซอสลับเท่านั้น ยังไม่มีวิธีผสม; เจ้าของยืนยันซอสหอยนางรม 400 ml"],
  [161, "คงข้อความ ‘ปั่นรวมกัน’ เป็นหมายเหตุจากต้นฉบับเท่านั้น; ลำดับวิธีทำชุดปรุงรอบ 2 เว้นว่างไว้รอเจ้าของเติมภายหลัง"],
  [159, "DOCX ระบุขั้นตอนจัดเสิร์ฟ; เจ้าของเมนูยืนยันน้ำจิ้มซีฟู้ด 20 กรัมเสิร์ฟแยกในถ้วย 1 oz และใช้ผัดผัก 1 ชุดตามสูตร"],
  [28, "เรียบเรียงจากคำบอกของครัวเท่าที่ได้รับ โดยไม่เติมวิธีเตรียมชิ้นเนื้อ การเก็บ หรือผลผลิตหลังตาก"]
]);

const methodSelectedSourceOverrides = new Map([
  [28, "owner_confirmation"]
]);

const blockerAdditions = new Map([
  [2, [
    { code: "missing_method", message: "DOCX V3 ยังไม่มีลำดับวิธีปรุงน้ำซุป และขอบเขตสูตรนี้ไม่รวมขั้นตอนลงเนื้อ" }
  ]],
  [9, [
    { code: "missing_method", message: "ยังไม่มีวิธีเตรียมชุดเครื่องเทศ V3" }
  ]],
  [160, [
    { code: "missing_method", message: "ยังไม่มีวิธีผสมซอสลับ V3" }
  ]],
  [161, [
    { code: "missing_method", message: "ลำดับวิธีทำชุดปรุงรอบ 2 เว้นว่างไว้รอเจ้าของเติมภายหลัง" }
  ]],
  [28, [{ code: "missing_source", message: "ยังขาดข้อมูล: วิธีเตรียมชิ้นเนื้อก่อนหมัก การเก็บ และผลผลิตหลังตาก" }]]
]);

const operationalNoteOverrides = new Map([
  [2, [
    "ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70",
    "ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ"
  ]],
  [161, [
    "ต้นฉบับ V3 ระบุ: ม้ามตุ๋น 50 กรัม ใบเตย 3 ใบ และข่า 2 แว่น ปั่นรวมกัน"
  ]]
]);

const soupV3SourceSections = {
  source_document: "ซุปก๋วยเตี๋ยว V3.docx",
  sections: [
    { section_name: "วิธีปรุงซุป (รายการส่วนผสม; ยังไม่มีลำดับวิธีทำ)", maps_to_recipe_id: 2, maps_to_recipe_name: "น้ำซุปก๋วยเตี๋ยว V3" },
    { section_name: "สูตรผสมซอสลับ", maps_to_recipe_id: 160, maps_to_recipe_name: "ซอสลับสำหรับซุป V3" },
    { section_name: "ชุดเครื่องเทศ", maps_to_recipe_id: 9, maps_to_recipe_name: "ชุดเครื่องเทศสำหรับซุป V3" },
    { section_name: "ชุดปรุงรอบ 2", maps_to_recipe_id: 161, maps_to_recipe_name: "ชุดปรุงรอบ 2 สำหรับซุป V3" }
  ]
};

const sourceSectionMappingOverrides = new Map([
  [2, [soupV3SourceSections]],
  [9, [{ ...soupV3SourceSections, sections: [soupV3SourceSections.sections[2]] }]],
  [160, [{ ...soupV3SourceSections, sections: [soupV3SourceSections.sections[1]] }]],
  [161, [{ ...soupV3SourceSections, sections: [soupV3SourceSections.sections[3]] }]]
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
      handwriting: decision.handwriting ?? null,
      ...(override?.ownerConfirmation ? { owner_confirmation: override.ownerConfirmation } : {})
    },
    candidate_text: removed
      ? null
      : override && Object.hasOwn(override, "candidateText")
        ? override.candidateText
        : decision.candidate ?? null,
    selected_source: override?.selectedSource ?? selectedSource(decision.status),
    decision_status: override?.decisionStatus ?? decision.status,
    decision_note: removed ? "ตัดออกตามลายมือ" : override?.decisionNote ?? null,
    ...(override?.servingNote ? { serving_note: override.servingNote } : {}),
    ...(override?.costBasisText ? { cost_basis_text: override.costBasisText } : {})
  };
}

function importedCandidateItems(recipe) {
  return imported.recipe_items
    .filter((item) => item.recipe_id === recipe.recipe_id)
    .sort((a, b) => a.line_no - b.line_no)
    .map((item) => {
      const sourceText = `${item.v1_quantity_value} ${item.v1_unit}`;
      const kitchenUnit = item.v1_unit === "g" ? "กรัม" : item.v1_unit;
      return {
        line_key: `${recipe.recipe_name}:${item.item_name}`,
        item_name: item.item_name,
        item_kind: item.item_kind,
        component_recipe_id: item.component_recipe_id,
        source_values: {
          v1: sourceText,
          docx: recipe.recipe_id === 28 ? "ไม่พบสูตรหมัก" : "ยังไม่พบต้นฉบับ",
          v2: `เหมือน V1: ${sourceText}`,
          handwriting: "ไม่มีการแก้สูตรนี้"
        },
        candidate_text: `${item.v1_quantity_value} ${kitchenUnit}`,
        selected_source: "matching_sources",
        decision_status: "needs_review",
        decision_note: "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
      };
    });
}

function reviewItems(recipe) {
  if (soupV3ItemOverrides.has(recipe.recipe_id)) {
    return structuredClone(soupV3ItemOverrides.get(recipe.recipe_id));
  }
  if (importedCandidateRecipeIds.has(recipe.recipe_id)) return importedCandidateItems(recipe);
  return (recipe.decisions || []).map((decision) => decisionItem(recipe.recipe_id, recipe.recipe_name, decision));
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

function methodSource(recipe) {
  if (!methodCandidate(recipe)) return null;
  if (methodSelectedSourceOverrides.has(recipe.recipe_id)) return methodSelectedSourceOverrides.get(recipe.recipe_id);
  if (recipe.method_status.includes("handwriting")) return "handwriting";
  if (recipe.method_status.includes("docx") || recipe.method_status === "candidate_from_docx") return "docx";
  return "matching_sources";
}

function blockersFor(recipe) {
  const blockers = soupV3RecipeIds.has(recipe.recipe_id)
    ? []
    : sourceReview.unresolved
      .filter((issue) => issue.recipe_name === recipe.recipe_name)
      .filter((issue) => !resolvedUnresolvedQuestions.has(`${issue.recipe_name}:${issue.question}`))
      .map((issue) => ({ code: "unresolved_source_conflict", message: issue.question }));

  const additions = blockerAdditions.get(recipe.recipe_id) || [];
  if (!methodCandidate(recipe) && !additions.some((blocker) => blocker.code === "missing_method")) {
    blockers.push({ code: "missing_method", message: recipe.method_note });
  }

  const hasItemConflict = (recipe.decisions || []).some((decision) => ["conflict", "needs_review"].includes(decision.status));
  const reviewState = reviewStateOverrides.get(recipe.recipe_id) ?? recipe.review_state;
  if (reviewState === "conflict" && blockers.length === 0 && !hasItemConflict) {
    blockers.push({ code: "unresolved_source_conflict", message: recipe.method_note });
  }

  if (reviewState === "missing_source") {
    blockers.push({ code: "missing_source", message: recipe.method_note });
  }

  blockers.push(...additions);

  return blockers;
}

const recipes = sourceReview.manifest.map((manifest) => {
  const recipe = recipesById.get(manifest.recipe_id);
  const recipeName = recipeNameOverrides.get(recipe.recipe_id) ?? recipe.recipe_name;
  const items = ensureImportedDependencies(
    recipe.recipe_id,
    recipeName,
    reviewItems(recipe)
  );
  return {
    recipe_id: recipe.recipe_id,
    legacy_recipe_id: recipe.recipe_id,
    recipe_version_id: `kitchen-v2-${recipe.recipe_id}-draft-001`,
    recipe_name: recipeName,
    recipe_type: manifest.role === "root_menu" ? "sellable_menu" : "prepared_recipe",
    parent_recipe_ids: parentRecipeIds(recipe.recipe_id),
    review_state: reviewStateOverrides.get(recipe.recipe_id) ?? recipe.review_state,
    source_locators: [...recipe.source_locators, ...(sourceLocatorAdditions.get(recipe.recipe_id) || [])],
    source_section_mappings: structuredClone(sourceSectionMappingOverrides.get(recipe.recipe_id) ?? []),
    items,
    method_candidate_text: methodCandidate(recipe),
    method_selected_source: methodSource(recipe),
    method_decision_note: methodDecisionNoteOverrides.get(recipe.recipe_id) ?? recipe.method_note,
    yield_candidate_text: null,
    operational_notes: operationalNoteOverrides.get(recipe.recipe_id) ?? [],
    blockers: blockersFor(recipe)
  };
});

recipes.push({
  recipe_id: "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
  legacy_recipe_id: null,
  recipe_version_id: "kitchen-v2-candidate-cooked-japanese-rice-draft-001",
  recipe_name: "ข้าวญี่ปุ่นหุงสุก",
  recipe_type: "prepared_recipe",
  parent_recipe_ids: [159],
  review_state: "missing_source",
  source_locators: [
    "V1 import note: 72g ดิบ → 180g สุก (×2.5)",
    "Owner confirmation: 2026-08-04 — ข้าว 1500 ml + น้ำ 2100 ml + น้ำมันรำข้าว 1 ช้อนโต๊ะ; ซาว 2 รอบโดยใช้น้ำให้ท่วมข้าว",
    "Owner confirmation: 2026-08-04 — ใช้ข้าวญี่ปุ่นเฉพาะข้าวหน้าเนื้อกิวด้งและข้าวหน้าเนื้อยากินิกุ"
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
    "เมนูหน้าครัวตักข้าวหุงสุก 180 กรัมต่อที่",
    "ใช้เฉพาะเมนูข้าวหน้าเนื้อกิวด้งและข้าวหน้าเนื้อยากินิกุ"
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
  parent_recipe_ids: [165],
  review_state: "missing_source",
  source_locators: [
    "Owner confirmation: 2026-08-04 — ข้าว 8 ถ้วย (350 ml) + น้ำ 2000 ml; ซาว 2 รอบโดยใช้น้ำให้ท่วมข้าว",
    "Owner confirmation: 2026-08-04 — ข้าวหน้าเนื้อตุ๋นใช้ข้าวหอมมะลิ; น้ำหนักข้าวหุงสุกต่อจานยังรอยืนยัน"
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
  generated_at: "2026-08-04T18:35:00+07:00",
  source_policy: "latest owner-designated source > handwriting corrections > other DOCX true originals > V2 coverage; preserve kitchen units; never convert",
  root_recipe_ids: rootRecipeIds,
  recipes
};

const jsonPath = path.join(root, "data", "kitchen-sot-first-set-v2.json");
const jsPath = path.join(root, "data", "kitchen-sot-first-set-v2.js");
fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
fs.writeFileSync(jsPath, `window.NNTNKitchenSotFirstSetV2 = ${JSON.stringify(data, null, 2)};\n`, "utf8");
