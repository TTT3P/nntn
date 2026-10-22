import {
  cloneKitchenSotDocument,
  type KitchenSotDocument,
  type KitchenSotRecipe,
} from "../domain/sot/kitchenSotDocument";

export function ownerConfirmedEggRecipe(): KitchenSotRecipe {
  return {
    recipe_id: 18,
    legacy_recipe_id: 18,
    recipe_version_id: "kitchen-v5-18-owner-20260809",
    recipe_name: "ไข่ข้น",
    recipe_type: "prepared_recipe",
    parent_recipe_ids: [],
    review_state: "owner_confirmed_missing_method",
    source_locators: [
      "Owner confirmation: TINE 2026-08-09",
      "V1 live snapshot: RCP-026 / cookingbook.recipes id=18",
    ],
    source_section_mappings: [],
    items: [
      {
        line_key: "ไข่ข้น:ไข่ไก่",
        item_name: "ไข่ไก่",
        item_kind: "direct_ingredient",
        component_recipe_id: null,
        source_values: { owner_confirmation: "2 ฟอง" },
        candidate_text: "2 ฟอง",
        selected_source: "owner_confirmation",
        decision_status: "confirmed_by_owner",
        decision_note: "เจ้าของยืนยันวันที่ 2026-08-09 ว่าไข่ข้น ใช้ไข่ไก่ 2 ฟอง",
      },
      {
        line_key: "ไข่ข้น:รสดีก๋วยเตี๋ยวเข้มข้น",
        item_name: "รสดีก๋วยเตี๋ยวเข้มข้น",
        item_kind: "direct_ingredient",
        component_recipe_id: null,
        source_values: { owner_confirmation: "ครึ่งช้อนชา (2.5g)" },
        candidate_text: "ครึ่งช้อนชา (2.5g)",
        selected_source: "owner_confirmation",
        decision_status: "confirmed_by_owner",
        decision_note: "เจ้าของยืนยันวันที่ 2026-08-09 ว่าไข่ข้น ใช้รสดีก๋วยเตี๋ยวเข้มข้น ครึ่งช้อนชา (2.5g)",
      },
    ],
    method_candidate_text: null,
    method_selected_source: null,
    method_decision_note: "ยังไม่มีวิธีทำไข่ข้นจากครัว จึงไม่เติมขั้นตอนเอง",
    yield_candidate_text: null,
    operational_notes: [
      "สูตรใหม่คือไข่ไก่ 2 ฟอง + รสดีก๋วยเตี๋ยวเข้มข้น ครึ่งช้อนชา (2.5g) เท่านั้น ตัดน้ำปลาทิพรส+ผงชูรสออก",
    ],
    blockers: [
      {
        code: "missing_method",
        message: "ยังไม่มีวิธีทำไข่ข้นที่เจ้าของหรือครัวยืนยัน",
      },
    ],
    work_documents: {
      cook: {
        stage: "cook",
        scalable: false,
        ingredient_line_keys: [
          "ไข่ข้น:ไข่ไก่",
          "ไข่ข้น:รสดีก๋วยเตี๋ยวเข้มข้น",
        ],
        steps: [],
      },
    },
  };
}

export function withOwnerConfirmedEggRecipe(
  source: KitchenSotDocument,
): KitchenSotDocument {
  const document = cloneKitchenSotDocument(source);
  document.schema_version = "2.2.0-prototype-draft";
  document.recipes.push(ownerConfirmedEggRecipe());
  return document;
}
