window.NNTNKitchenSotFirstSetV2 = {
  "schema_version": "2.0.0-prototype",
  "generated_at": "2026-08-04T18:35:00+07:00",
  "source_policy": "latest owner-designated source > handwriting corrections > other DOCX true originals > V2 coverage; preserve kitchen units; never convert",
  "root_recipe_ids": [
    165,
    159,
    37,
    163
  ],
  "recipes": [
    {
      "recipe_id": 165,
      "legacy_recipe_id": 165,
      "recipe_version_id": "kitchen-v2-165-draft-001",
      "recipe_name": "ข้าวหน้าเนื้อตุ๋น",
      "recipe_type": "sellable_menu",
      "parent_recipe_ids": [],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: true-originals/_inbox/ข้าวหน้าเนื้อตุ๋น.docx",
        "V2: ข้าวหน้าเนื้อตุ๋น",
        "ลายมือ: หน้า 1",
        "Owner confirmation: 2026-08-04 — ข้าวหน้าเนื้อตุ๋นใช้ข้าวหอมมะลิ ไม่ใช่ข้าวญี่ปุ่น; เมนูข้าวตักข้าวหุงสุก 180 กรัมต่อจาน"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "ข้าวหน้าเนื้อตุ๋น:เนื้อตุ๋น (ราดข้าว)",
          "item_name": "เนื้อตุ๋น (ราดข้าว)",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 164,
          "source_values": {
            "v1": "75 g",
            "docx": "375 กรัม / 5 เสิร์ฟ",
            "v2": "75 g",
            "handwriting": "75 g"
          },
          "candidate_text": "75 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ข้าวหน้าเนื้อตุ๋น:ข้าวญี่ปุ่น",
          "item_name": "ข้าวหอมมะลิหุงสุก",
          "item_kind": "prepared_recipe",
          "component_recipe_id": "candidate:prepared:ข้าวหอมมะลิหุงสุก",
          "source_values": {
            "v1": "72 g",
            "docx": "กล่าวถึงข้าว แต่ไม่ระบุปริมาณ",
            "v2": "72 g",
            "handwriting": "72 g",
            "owner_confirmation": "ข้าวหอมมะลิหุงสุก 180 กรัมต่อจาน"
          },
          "candidate_text": "180 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันวันที่ 2026-08-04 ว่าเมนูข้าวตักข้าวหุงสุก 180 กรัมต่อจาน",
          "serving_note": "ตักข้าวหุงสุก 180 กรัม",
          "cost_basis_text": "ข้าวหอมมะลิดิบ 72 กรัม"
        },
        {
          "line_key": "ข้าวหน้าเนื้อตุ๋น:น้ำจิ้มซีฟู้ด",
          "item_name": "น้ำจิ้มซีฟู้ด",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 158,
          "source_values": {
            "v1": "30 g",
            "docx": "เสิร์ฟคู่กัน แต่ไม่ระบุปริมาณ",
            "v2": "30 g",
            "handwriting": "30 g"
          },
          "candidate_text": "30 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ข้าวหน้าเนื้อตุ๋น:ผักชีไทย",
          "item_name": "ผักชีไทย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "3 g",
            "docx": "โรยนิดหน่อย",
            "v2": "3 g",
            "handwriting": "3 g"
          },
          "candidate_text": "3 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. นำเนื้อตุ๋นที่แพ็คไว้ไปอุ่นในไมโครเวฟ ไฟแรง 2 นาที\n2. นำน้ำเนื้อตุ๋นเทใส่ถ้วยน้ำจิ้ม ส่วนตัวเนื้อเทใส่ถาดรองอาหาร โรยด้วยผักชีไทยนิดหน่อย เสิร์ฟคู่กับน้ำจิ้มซีฟู๊ด",
      "method_selected_source": "matching_sources",
      "method_decision_note": "ใช้ขั้นตอนจัดเสิร์ฟจาก DOCX/V2; ลายมือหน้า 1 เพิ่มสูตรเตรียมเนื้อตุ๋นแยกต่างหาก",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": []
    },
    {
      "recipe_id": 164,
      "legacy_recipe_id": 164,
      "recipe_version_id": "kitchen-v2-164-draft-001",
      "recipe_name": "เนื้อตุ๋น (ราดข้าว)",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        165
      ],
      "review_state": "conflict",
      "source_locators": [
        "DOCX: true-originals/_inbox/ข้าวหน้าเนื้อตุ๋น.docx",
        "V2: เนื้อตุ๋น (ราดข้าว)",
        "ลายมือ: หน้า 1"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):เนื้อตุ๋น",
          "item_name": "เนื้อตุ๋น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "375 g",
            "docx": "375 กรัม",
            "v2": "375 g",
            "handwriting": "375 g"
          },
          "candidate_text": "375 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):น้ำซุปในหม้อหุงข้าว",
          "item_name": "น้ำซุปในหม้อหุงข้าว",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 2,
          "source_values": {
            "v1": "1000 g",
            "docx": "1000 ml",
            "v2": "1000 g",
            "handwriting": "1000 g"
          },
          "candidate_text": "1000 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):น้ำเปล่า",
          "item_name": "น้ำเปล่า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1000 g",
            "docx": "1000 ml",
            "v2": "1000 g",
            "handwriting": "1000 g"
          },
          "candidate_text": "1000 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):แม็กกี้ Seasoning",
          "item_name": "แม็กกี้ Seasoning",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "15 g",
            "docx": "1 ช้อนโต๊ะ",
            "v2": "15 g",
            "handwriting": "1 tb"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):เหล้าจีน",
          "item_name": "เหล้าจีน",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "15 g",
            "docx": "1 ช้อนโต๊ะ",
            "v2": "15 g",
            "handwriting": "1 tb"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):ซีอิ๊วขาว Amoy",
          "item_name": "ซีอิ๊วขาว Amoy",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "15 g",
            "docx": "1 ช้อนโต๊ะ",
            "v2": "15 g",
            "handwriting": "1 tb"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):น้ำตาลทรายไม่ขัดสี",
          "item_name": "น้ำตาลทรายไม่ขัดสี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "13 g",
            "docx": "1 ช้อนโต๊ะ",
            "v2": "13 g",
            "handwriting": "1 tb"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):ผงชูรส",
          "item_name": "ผงชูรส",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "12 g",
            "docx": "1 ช้อนชา",
            "v2": "12 g",
            "handwriting": "1 tb"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):แป้งมันฮ่องกง",
          "item_name": "แป้งมันฮ่องกง",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "16 g",
            "docx": "2 ช้อนโต๊ะ",
            "v2": "16 g",
            "handwriting": "ขั้นตอนกล่าวถึงแป้ง แต่ไม่มีในรายการ"
          },
          "candidate_text": null,
          "selected_source": null,
          "decision_status": "conflict",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):แป้งข้าวโพด",
          "item_name": "แป้งข้าวโพด",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "16 g",
            "docx": "2 ช้อนโต๊ะ",
            "v2": "16 g",
            "handwriting": "ขั้นตอนกล่าวถึงแป้ง แต่ไม่มีในรายการ"
          },
          "candidate_text": null,
          "selected_source": null,
          "decision_status": "conflict",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋น (ราดข้าว):น้ำสำหรับผสมแป้ง",
          "item_name": "น้ำสำหรับผสมแป้ง",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "ไม่แยกบรรทัด",
            "docx": "120 ml",
            "v2": "ระบุในขั้นตอน 120 ml",
            "handwriting": "กล่าวถึงน้ำ แต่ไม่ระบุปริมาณ"
          },
          "candidate_text": null,
          "selected_source": null,
          "decision_status": "conflict",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. นำเนื้อสามชั้นตุ๋นมาหั่น ชิ้นละ 10 กรัม จากนั้นนำน้ำซุปจากหม้อหุงข้าว และน้ำเปล่า อย่างละ 1000 ml เทใส่ในหม้อที่เตรียมไว้\n2. นำเนื้อสามชั้นลงไปในหม้อ และตั้งไฟตุ๋นต่อ 45 นาที\n3. พอครบ 45 นาที นำซีอิ๊วขาว น้ำตาลทรายไม่ขัดสี ผงชูรส ใส่ลงไปในหม้อคนให้เข้ากัน จากนั้นเปิดไฟแรงให้น้ำเดือด และใส่เหล้าจีนลงไป\n4. คนเครื่องปรุงทุกอย่างให้เข้ากัน นำแป้งทั้ง 2 อย่าง (แป้งมันฮ่องกง + แป้งข้าวโพด) มาผสมกับน้ำเปล่า 120 ml และค่อยๆ หยอดเติมลงไปในหม้อตุ๋น ระหว่างที่เติมแป้งลงไปต้องคนตลอดเวลา\n5. หลังจากใส่แป้งและคนจนเข้ากันแล้ว จะสังเกตเห็นว่าเนื้อในหม้อเริ่มข้นและหนืดขึ้น ลดไฟให้เหลือปานกลางค่อนอ่อน และตุ๋นทิ้งไว้อีก 5 นาที และแพ็คใส่ถุงสำหรับเตรียมขาย",
      "method_selected_source": "matching_sources",
      "method_decision_note": "ใช้โครงขั้นตอนลายมือ แต่ต้องยืนยันแป้งสองชนิดและน้ำผสมแป้งก่อนพิมพ์ฉบับใช้งาน",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "unresolved_source_conflict",
          "message": "แป้งมันฮ่องกง แป้งข้าวโพด และน้ำผสมแป้งใช้เท่าไรในฉบับลายมือสุดท้าย"
        }
      ]
    },
    {
      "recipe_id": 2,
      "legacy_recipe_id": 2,
      "recipe_version_id": "kitchen-v2-2-draft-001",
      "recipe_name": "น้ำซุปก๋วยเตี๋ยว V3",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        164
      ],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: true-originals/_inbox/ต้นฉบับ ก๋วยเตี๋ยว/สูตรก๋วยเตี๋ยววัดหนัง-ห้ามแก้ไข.docx",
        "DOCX: true-originals/_inbox/ต้นฉบับ ก๋วยเตี๋ยว/เครื่องเทศ+เครื่องปรุง-ห้ามแก้ไข.docx",
        "V2: น้ำซุป",
        "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx",
        "Owner confirmation: 2026-08-04 — น้ำเปล่าประมาณ 50 ลิตร ใช้หม้อเบอร์ 70 และสูตรนี้ไม่รวมขั้นตอนลงเนื้อ",
        "Owner confirmation: 2026-08-04 — ซอสและซีอิ๊วใช้ ml; น้ำตาล ผงปรุงรส และเกลือใช้กรัม; ไม่ได้แปลงตัวเลขจาก V1/V2",
        "Owner confirmation: 2026-08-04 — สูตรชุดเครื่องเทศและชุดปรุงรอบ 2 ใน DOCX เป็นปริมาณเต็มชุดสำหรับซุป 1 หม้อ"
      ],
      "source_section_mappings": [
        {
          "source_document": "ซุปก๋วยเตี๋ยว V3.docx",
          "sections": [
            {
              "section_name": "วิธีปรุงซุป (รายการส่วนผสม; ยังไม่มีลำดับวิธีทำ)",
              "maps_to_recipe_id": 2,
              "maps_to_recipe_name": "น้ำซุปก๋วยเตี๋ยว V3"
            },
            {
              "section_name": "สูตรผสมซอสลับ",
              "maps_to_recipe_id": 160,
              "maps_to_recipe_name": "ซอสลับสำหรับซุป V3"
            },
            {
              "section_name": "ชุดเครื่องเทศ",
              "maps_to_recipe_id": 9,
              "maps_to_recipe_name": "ชุดเครื่องเทศสำหรับซุป V3"
            },
            {
              "section_name": "ชุดปรุงรอบ 2",
              "maps_to_recipe_id": 161,
              "maps_to_recipe_name": "ชุดปรุงรอบ 2 สำหรับซุป V3"
            }
          ]
        }
      ],
      "items": [
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:น้ำเปล่า",
          "item_name": "น้ำเปล่า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": null,
            "docx": "ไม่มีใน DOCX V3",
            "v2": null,
            "handwriting": null,
            "owner_confirmation": "ประมาณ 50 ลิตร · หม้อเบอร์ 70"
          },
          "candidate_text": "ประมาณ 50 ลิตร",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันวันที่ 2026-08-04; คงคำว่า ‘ประมาณ’ ไว้ตามหน้างาน"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:ซอสลับสำหรับซุป V3",
          "item_name": "ซอสลับสำหรับซุป V3",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 160,
          "source_values": {
            "v1": "ซอสลับ (v2) 1500 ml",
            "docx": "ซอสลับ 1400 (ไม่ระบุหน่วย)",
            "v2": "ซอสลับ (v2) 1500 ml",
            "handwriting": null,
            "owner_confirmation": "1400 ml"
          },
          "candidate_text": "1400 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:น้ำตาลมะพร้าว",
          "item_name": "น้ำตาลมะพร้าว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "350 g",
            "docx": "น้ำตาลมะพร้าว 350 (ไม่ระบุหน่วย)",
            "v2": "350 g",
            "handwriting": null,
            "owner_confirmation": "350 กรัม"
          },
          "candidate_text": "350 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:น้ำตาลกรวด",
          "item_name": "น้ำตาลกรวด",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "250 g",
            "docx": "น้ำตาลกรวด 250 (ไม่ระบุหน่วย)",
            "v2": "250 g",
            "handwriting": null,
            "owner_confirmation": "250 กรัม"
          },
          "candidate_text": "250 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:รสดีก๋วยเตี๋ยวเข้มข้น",
          "item_name": "รสดีก๋วยเตี๋ยวเข้มข้น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "500 g",
            "docx": "รสดีก๋วยเตี๋ยวเข้มข้น 500 (ไม่ระบุหน่วย)",
            "v2": "500 g",
            "handwriting": null,
            "owner_confirmation": "500 กรัม"
          },
          "candidate_text": "500 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:รสดี ผงปรุงรสเนื้อ",
          "item_name": "รสดี ผงปรุงรสเนื้อ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "รสดีเนื้อ 100 (ไม่ระบุหน่วย)",
            "v2": "100 g",
            "handwriting": null,
            "owner_confirmation": "100 กรัม"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:ซีอิ๊วดำ",
          "item_name": "ซีอิ๊วดำ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "150 g",
            "docx": "ซีอิ๊วดำ 170 (ไม่ระบุหน่วย)",
            "v2": "150 g",
            "handwriting": null,
            "owner_confirmation": "170 ml"
          },
          "candidate_text": "170 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:กระเทียมดอง",
          "item_name": "กระเทียมดอง",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "200 g",
            "docx": "กระเทียมดอง 1 ถ้วย",
            "v2": "200 g",
            "handwriting": null
          },
          "candidate_text": "1 ถ้วย",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:เกลือ",
          "item_name": "เกลือ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "10 g",
            "docx": "เกลือ 10 (ไม่ระบุหน่วย)",
            "v2": "10 g",
            "handwriting": null,
            "owner_confirmation": "10 กรัม"
          },
          "candidate_text": "10 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:มะกรูด",
          "item_name": "มะกรูด",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "150 g",
            "docx": "มะกรูด 4 ลูก",
            "v2": "150 g",
            "handwriting": null
          },
          "candidate_text": "4 ลูก",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:ใบเตย",
          "item_name": "ใบเตย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "ใบเตย 10 ใบ",
            "v2": "100 g",
            "handwriting": null
          },
          "candidate_text": "10 ใบ",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:หัวไชเท้า",
          "item_name": "หัวไชเท้า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1500 g",
            "docx": "หัวไชเท้า 2 หัว",
            "v2": "1500 g",
            "handwriting": null
          },
          "candidate_text": "2 หัว",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:ชุดเครื่องเทศสำหรับซุป V3",
          "item_name": "ชุดเครื่องเทศสำหรับซุป V3",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 9,
          "source_values": {
            "v1": "กระปุกเครื่องเทศ [70g] 50 ลิตร",
            "docx": "มีสูตรแยกหัวข้อ ‘ชุดเครื่องเทศ’",
            "v2": "กระปุกเครื่องเทศ [70g] 50 ลิตร",
            "handwriting": null,
            "owner_confirmation": "1 ชุดตามสูตร ต่อซุป 1 หม้อ"
          },
          "candidate_text": "1 ชุดตามสูตร",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "น้ำซุปก๋วยเตี๋ยว V3:ชุดปรุงรอบ 2 สำหรับซุป V3",
          "item_name": "ชุดปรุงรอบ 2 สำหรับซุป V3",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 161,
          "source_values": {
            "v1": "เครื่องปรุงชุดสอง 643 g",
            "docx": "มีสูตรแยกหัวข้อ ‘ชุดปรุงรอบ 2’",
            "v2": "เครื่องปรุงชุดสอง 643 g",
            "handwriting": null,
            "owner_confirmation": "1 ชุดตามสูตร ต่อซุป 1 หม้อ"
          },
          "candidate_text": "1 ชุดตามสูตร",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        }
      ],
      "method_candidate_text": null,
      "method_selected_source": null,
      "method_decision_note": "DOCX V3 ระบุรายการส่วนผสมแต่ไม่มีลำดับวิธีปรุงน้ำซุป; ตัดวิธีเก่าที่มีขั้นตอนลงเนื้อออกตามขอบเขตที่เจ้าของยืนยัน",
      "yield_candidate_text": null,
      "operational_notes": [
        "ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70",
        "ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ"
      ],
      "blockers": [
        {
          "code": "missing_method",
          "message": "DOCX V3 ยังไม่มีลำดับวิธีปรุงน้ำซุป และขอบเขตสูตรนี้ไม่รวมขั้นตอนลงเนื้อ"
        }
      ]
    },
    {
      "recipe_id": 160,
      "legacy_recipe_id": 160,
      "recipe_version_id": "kitchen-v2-160-draft-001",
      "recipe_name": "ซอสลับสำหรับซุป V3",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        2,
        161
      ],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: สูตรก๋วยเตี๋ยววัดหนัง-ห้ามแก้ไข.docx / ผสมซอสปรุงน้ำ",
        "V2: ซอสลับ (v2)",
        "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx / สูตรผสมซอสลับ",
        "Owner confirmation: 2026-08-04 — โชยุ ซอสฝาเขียว ซีอิ๊วขาว และซอสหอยนางรมใช้หน่วย ml"
      ],
      "source_section_mappings": [
        {
          "source_document": "ซุปก๋วยเตี๋ยว V3.docx",
          "sections": [
            {
              "section_name": "สูตรผสมซอสลับ",
              "maps_to_recipe_id": 160,
              "maps_to_recipe_name": "ซอสลับสำหรับซุป V3"
            }
          ]
        }
      ],
      "items": [
        {
          "line_key": "ซอสลับสำหรับซุป V3:โชยุ",
          "item_name": "โชยุ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1100 g",
            "docx": "โชยุ 2100 (ไม่ระบุหน่วย)",
            "v2": "1100 g",
            "handwriting": null,
            "owner_confirmation": "2100 ml"
          },
          "candidate_text": "2100 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ซอสลับสำหรับซุป V3:ซอสฝาเขียว",
          "item_name": "ซอสฝาเขียว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1000 g",
            "docx": "ฝาเขียว 1000 (ไม่ระบุหน่วย)",
            "v2": "1000 g",
            "handwriting": null,
            "owner_confirmation": "1000 ml"
          },
          "candidate_text": "1000 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ซอสลับสำหรับซุป V3:ซีอิ๊วขาว",
          "item_name": "ซีอิ๊วขาว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1000 g",
            "docx": "ซีอิ๊วขาว 1000 (ไม่ระบุหน่วย)",
            "v2": "1000 g",
            "handwriting": null,
            "owner_confirmation": "1000 ml"
          },
          "candidate_text": "1000 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ซอสลับสำหรับซุป V3:ซอสหอยนางรม",
          "item_name": "ซอสหอยนางรม",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "400 g",
            "docx": "ซอสหอยนางรม (ไม่ระบุปริมาณ)",
            "v2": "400 g",
            "handwriting": null,
            "owner_confirmation": "400 ml"
          },
          "candidate_text": "400 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันวันที่ 2026-08-04; เป็นค่าหน้าครัว ไม่ใช่การแปลงจาก V1 400 g"
        }
      ],
      "method_candidate_text": null,
      "method_selected_source": null,
      "method_decision_note": "DOCX V3 ระบุรายการสูตรผสมซอสลับเท่านั้น ยังไม่มีวิธีผสม; เจ้าของยืนยันซอสหอยนางรม 400 ml",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "missing_method",
          "message": "ยังไม่มีวิธีผสมซอสลับ V3"
        }
      ]
    },
    {
      "recipe_id": 9,
      "legacy_recipe_id": 9,
      "recipe_version_id": "kitchen-v2-9-draft-001",
      "recipe_name": "ชุดเครื่องเทศสำหรับซุป V3",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        2
      ],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: เครื่องเทศ+เครื่องปรุง-ห้ามแก้ไข.docx",
        "V2: กระปุกเครื่องเทศ [70g]",
        "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx / ชุดเครื่องเทศ",
        "Owner confirmation: 2026-08-04 — ตัวเลขเครื่องเทศทั้ง 11 รายการใช้หน่วยกรัม"
      ],
      "source_section_mappings": [
        {
          "source_document": "ซุปก๋วยเตี๋ยว V3.docx",
          "sections": [
            {
              "section_name": "ชุดเครื่องเทศ",
              "maps_to_recipe_id": 9,
              "maps_to_recipe_name": "ชุดเครื่องเทศสำหรับซุป V3"
            }
          ]
        }
      ],
      "items": [
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:อบเชย",
          "item_name": "อบเชย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "20 g",
            "docx": "อบเชย 20 (ไม่ระบุหน่วย)",
            "v2": "20 g",
            "handwriting": null,
            "owner_confirmation": "20 กรัม"
          },
          "candidate_text": "20 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:โป๊ยกั๊ก",
          "item_name": "โป๊ยกั๊ก",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "20 g",
            "docx": "โป๊ยกั๊ก 20 (ไม่ระบุหน่วย)",
            "v2": "20 g",
            "handwriting": null,
            "owner_confirmation": "20 กรัม"
          },
          "candidate_text": "20 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:พริกไทยดำ",
          "item_name": "พริกไทยดำ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "20 g",
            "docx": "พริกไทยดำ 20 (ไม่ระบุหน่วย)",
            "v2": "20 g",
            "handwriting": null,
            "owner_confirmation": "20 กรัม"
          },
          "candidate_text": "20 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:กระเทียมจีน",
          "item_name": "กระเทียมจีน",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "กระเทียมจีน 100 (ไม่ระบุหน่วย)",
            "v2": "100 g",
            "handwriting": null,
            "owner_confirmation": "100 กรัม"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:รากผักชี",
          "item_name": "รากผักชี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "รากผักชี 100 (ไม่ระบุหน่วย)",
            "v2": "100 g",
            "handwriting": null,
            "owner_confirmation": "100 กรัม"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:ข่าเหลือง",
          "item_name": "ข่าเหลือง",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "70 g",
            "docx": "ข่าเหลือง 100 (ไม่ระบุหน่วย)",
            "v2": "70 g",
            "handwriting": null,
            "owner_confirmation": "100 กรัม"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:ซวงเจีย",
          "item_name": "ซวงเจีย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "7 g · V1 ไม่พบชื่อวัตถุดิบ",
            "docx": "ซวงเจีย 7 (ไม่ระบุหน่วย)",
            "v2": "7 g · V1 ไม่พบชื่อวัตถุดิบ",
            "handwriting": null,
            "owner_confirmation": "7 กรัม"
          },
          "candidate_text": "7 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:ลูกเฉาก๋วย",
          "item_name": "ลูกเฉาก๋วย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "7 g",
            "docx": "ลูกเฉาก๋วย 7 (ไม่ระบุหน่วย)",
            "v2": "7 g",
            "handwriting": null,
            "owner_confirmation": "7 กรัม"
          },
          "candidate_text": "7 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:ฮ่วยซัว",
          "item_name": "ฮ่วยซัว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "50 g",
            "docx": "ฮ่วยซัว 50 (ไม่ระบุหน่วย)",
            "v2": "50 g",
            "handwriting": null,
            "owner_confirmation": "50 กรัม"
          },
          "candidate_text": "50 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:เก๋ากี้",
          "item_name": "เก๋ากี้",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "15 g",
            "docx": "เก๋ากี้ 15 (ไม่ระบุหน่วย)",
            "v2": "15 g",
            "handwriting": null,
            "owner_confirmation": "15 กรัม"
          },
          "candidate_text": "15 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดเครื่องเทศสำหรับซุป V3:หญ้าหอม",
          "item_name": "หญ้าหอม",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "3 g",
            "docx": "หญ้าหอม 3 (ไม่ระบุหน่วย)",
            "v2": "3 g",
            "handwriting": null,
            "owner_confirmation": "3 กรัม"
          },
          "candidate_text": "3 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        }
      ],
      "method_candidate_text": null,
      "method_selected_source": null,
      "method_decision_note": "DOCX V3 ระบุรายการชุดเครื่องเทศเท่านั้น ยังไม่มีวิธีเตรียม คั่ว บด แบ่งชุด หรือวิธีเก็บ",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "missing_method",
          "message": "ยังไม่มีวิธีเตรียมชุดเครื่องเทศ V3"
        }
      ]
    },
    {
      "recipe_id": 161,
      "legacy_recipe_id": 161,
      "recipe_version_id": "kitchen-v2-161-draft-001",
      "recipe_name": "ชุดปรุงรอบ 2 สำหรับซุป V3",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        2
      ],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "V2: เครื่องปรุงชุดสอง",
        "DOCX: true-originals/_inbox/ซุปก๋วยเตี๋ยว V3.docx / ชุดปรุงรอบ 2",
        "Owner confirmation: 2026-08-04 — คิคโคแมนและซอสลับใช้ ml; น้ำตาลกรวด รสดีเนื้อ และเกลือใช้กรัม; ลำดับวิธีทำรอเติมภายหลัง"
      ],
      "source_section_mappings": [
        {
          "source_document": "ซุปก๋วยเตี๋ยว V3.docx",
          "sections": [
            {
              "section_name": "ชุดปรุงรอบ 2",
              "maps_to_recipe_id": 161,
              "maps_to_recipe_name": "ชุดปรุงรอบ 2 สำหรับซุป V3"
            }
          ]
        }
      ],
      "items": [
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:ซอสถั่วเหลืองคิคโคแมน",
          "item_name": "ซอสถั่วเหลืองคิคโคแมน",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "20 g",
            "docx": "Kikoman 20 (ไม่ระบุหน่วย)",
            "v2": "20 g",
            "handwriting": null,
            "owner_confirmation": "20 ml"
          },
          "candidate_text": "20 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:ซอสลับสำหรับซุป V3",
          "item_name": "ซอสลับสำหรับซุป V3",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 160,
          "source_values": {
            "v1": "250 ml",
            "docx": "ซอสลับ 150 (ไม่ระบุหน่วย)",
            "v2": "250 ml",
            "handwriting": null,
            "owner_confirmation": "150 ml"
          },
          "candidate_text": "150 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:น้ำตาลกรวด",
          "item_name": "น้ำตาลกรวด",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "120 g",
            "docx": "น้ำตาลกรวด 100 (ไม่ระบุหน่วย)",
            "v2": "120 g",
            "handwriting": null,
            "owner_confirmation": "100 กรัม"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:รสดี ผงปรุงรสเนื้อ",
          "item_name": "รสดี ผงปรุงรสเนื้อ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "50 g",
            "docx": "รสดีเนื้อ 70 (ไม่ระบุหน่วย)",
            "v2": "50 g",
            "handwriting": null,
            "owner_confirmation": "70 กรัม"
          },
          "candidate_text": "70 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:เกลือ",
          "item_name": "เกลือ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "3 g",
            "docx": "เกลือ 5 (ไม่ระบุหน่วย)",
            "v2": "3 g",
            "handwriting": null,
            "owner_confirmation": "5 กรัม"
          },
          "candidate_text": "5 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันหน่วยวันที่ 2026-08-04; คงตัวเลขจาก DOCX V3 และไม่ได้แปลงค่าจาก V1/V2"
        },
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:ม้ามตุ๋น",
          "item_name": "ม้ามตุ๋น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "200 g",
            "docx": "ม้ามตุ๋น 50 กรัม",
            "v2": "200 g",
            "handwriting": null
          },
          "candidate_text": "50 กรัม",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
        },
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:ใบเตย",
          "item_name": "ใบเตย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": null,
            "docx": "ใบเตย 3 ใบ",
            "v2": null,
            "handwriting": null
          },
          "candidate_text": "3 ใบ",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
        },
        {
          "line_key": "ชุดปรุงรอบ 2 สำหรับซุป V3:ข่า",
          "item_name": "ข่า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": null,
            "docx": "ข่า 2 แว่น",
            "v2": null,
            "handwriting": null
          },
          "candidate_text": "2 แว่น",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "ใช้ค่าตาม DOCX V3 โดยไม่แปลงหน่วย"
        }
      ],
      "method_candidate_text": null,
      "method_selected_source": null,
      "method_decision_note": "คงข้อความ ‘ปั่นรวมกัน’ เป็นหมายเหตุจากต้นฉบับเท่านั้น; ลำดับวิธีทำชุดปรุงรอบ 2 เว้นว่างไว้รอเจ้าของเติมภายหลัง",
      "yield_candidate_text": null,
      "operational_notes": [
        "ต้นฉบับ V3 ระบุ: ม้ามตุ๋น 50 กรัม ใบเตย 3 ใบ และข่า 2 แว่น ปั่นรวมกัน"
      ],
      "blockers": [
        {
          "code": "missing_method",
          "message": "ลำดับวิธีทำชุดปรุงรอบ 2 เว้นว่างไว้รอเจ้าของเติมภายหลัง"
        }
      ]
    },
    {
      "recipe_id": 158,
      "legacy_recipe_id": 158,
      "recipe_version_id": "kitchen-v2-158-draft-001",
      "recipe_name": "น้ำจิ้มซีฟู๊ด",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        159,
        165
      ],
      "review_state": "conflict",
      "source_locators": [
        "DOCX: true-originals/_inbox/ข้าวหน้าเนื้อยากินิกุ.docx",
        "V2: น้ำจิ้มซีฟู๊ด",
        "ลายมือ: หน้า 3"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:น้ำมะนาว ARO",
          "item_name": "น้ำมะนาว ARO",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "300 g",
            "docx": "18 ช้อนโต๊ะ",
            "v2": "300 g",
            "handwriting": "แก้เป็น 300 g"
          },
          "candidate_text": "300 กรัม",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:น้ำตาลทรายไม่ขัดสี",
          "item_name": "น้ำตาลทรายไม่ขัดสี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "120 g",
            "docx": "9 ช้อนโต๊ะ",
            "v2": "120 g",
            "handwriting": "แก้เป็น 120 g"
          },
          "candidate_text": "120 กรัม",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:น้ำปลาทิพรส",
          "item_name": "น้ำปลาทิพรส",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "170 g",
            "docx": "11 ช้อนโต๊ะ",
            "v2": "170 g",
            "handwriting": "แก้เป็น 170 g"
          },
          "candidate_text": "170 กรัม",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:ผงชูรส",
          "item_name": "ผงชูรส",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "30 g",
            "docx": "2 ช้อนโต๊ะ",
            "v2": "30 g",
            "handwriting": "แก้เป็น 30 g"
          },
          "candidate_text": "30 กรัม",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:พริกแดงจินดา",
          "item_name": "พริกแดงจินดา",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "160 g",
            "docx": "ไม่ระบุปริมาณ",
            "v2": "160 g",
            "handwriting": "160 g"
          },
          "candidate_text": "160 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:พริกเขียวจินดา",
          "item_name": "พริกเขียวจินดา",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "160 g",
            "docx": "ไม่ระบุปริมาณ",
            "v2": "160 g",
            "handwriting": "160 g"
          },
          "candidate_text": "160 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:กระเทียมจีน",
          "item_name": "กระเทียมจีน",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "250 g",
            "docx": "ไม่ระบุปริมาณ",
            "v2": "250 g",
            "handwriting": "250 g"
          },
          "candidate_text": "250 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "น้ำจิ้มซีฟู๊ด:น้ำเปล่า",
          "item_name": "น้ำเปล่า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "120 g",
            "docx": "100 กรัม",
            "v2": "120 g แต่ขั้นตอน 100 กรัม",
            "handwriting": "เพิ่ม 120 g แต่ขั้นตอนพิมพ์ 100 g"
          },
          "candidate_text": null,
          "selected_source": null,
          "decision_status": "conflict",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. นำพริกและกระเทียมไปปั่นรวมกันให้ละเอียด\n2. หลังจากนั้น เตรียมเครื่องปรุงส่วนผสมทุกอย่างมาผสมรวมกัน และคนให้น้ำตาลทรายไม่ขัดสีละลาย ยกเว้นน้ำเปล่า\n3. พอส่วนผสมทุกอย่างเข้ากัน นำน้ำพริกและกระเทียมที่ปั่นไว้มาเทผสมรวมกัน จากนั้นเติมน้ำต้มสุก 100 กรัม",
      "method_selected_source": "matching_sources",
      "method_decision_note": "ต้องยืนยันน้ำเปล่าว่าใช้ 120 กรัมตามรายการ หรือ 100 กรัมตามขั้นตอน",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "unresolved_source_conflict",
          "message": "น้ำเปล่าใช้ 120 กรัมตามรายการ หรือ 100 กรัมตามขั้นตอน"
        }
      ]
    },
    {
      "recipe_id": 159,
      "legacy_recipe_id": 159,
      "recipe_version_id": "kitchen-v2-159-draft-001",
      "recipe_name": "ข้าวหน้าเนื้อยากินิกุ",
      "recipe_type": "sellable_menu",
      "parent_recipe_ids": [],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: true-originals/_inbox/ข้าวหน้าเนื้อยากินิกุ.docx",
        "V2: ข้าวหน้าเนื้อยากินิกุ",
        "PDF: true-originals/_inbox/scan จากเล่ม หน้างานจริงพนักงาน/ข้าวหน้าเนื้อยากินิกุ.pdf"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "ข้าวหน้าเนื้อยากินิกุ:ซอสยากินิกุ",
          "item_name": "ซอสยากินิกุ",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 156,
          "source_values": {
            "v1": "45 g",
            "docx": "ราด 3 ช้อนโต๊ะ",
            "v2": "45 g",
            "handwriting": "ไม่มีการแก้เมนูนี้"
          },
          "candidate_text": "3 ช้อนโต๊ะ",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": null
        },
        {
          "line_key": "ข้าวหน้าเนื้อยากินิกุ:ผัดผัก",
          "item_name": "ผัดผัก",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 157,
          "source_values": {
            "v1": "53 g",
            "docx": "ทำ 1 ชุดตามสูตร",
            "v2": "53 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "1 ชุดตามสูตร",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": "DOCX ระบุให้ทำผัดผัก 1 ชุดตามสูตรก่อนนำไปจัดเสิร์ฟ"
        },
        {
          "line_key": "ข้าวหน้าเนื้อยากินิกุ:น้ำจิ้มซีฟู้ด",
          "item_name": "น้ำจิ้มซีฟู้ด",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 158,
          "source_values": {
            "v1": "20 g",
            "docx": "มีสูตร แต่ขั้นตอนจัดเสิร์ฟไม่ได้ระบุ",
            "v2": "20 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "20 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของเมนูยืนยันวันที่ 2026-08-04",
          "serving_note": "เสิร์ฟแยกในถ้วย 1 oz"
        },
        {
          "line_key": "ข้าวหน้าเนื้อยากินิกุ:เนื้อพิคานย่า",
          "item_name": "เนื้อพิคานย่า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "75 g",
            "docx": "ไม่ระบุปริมาณ",
            "v2": "75 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "75 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": "V1 และ V2 ตรงกันที่ 75 กรัม; DOCX/สแกนกล่าวถึงเนื้อแต่ไม่ระบุน้ำหนัก และลายมือไม่มีการแก้รายการนี้"
        },
        {
          "line_key": "ข้าวหน้าเนื้อยากินิกุ:ข้าวญี่ปุ่น",
          "item_name": "ข้าวญี่ปุ่นหุงสุก",
          "item_kind": "prepared_recipe",
          "component_recipe_id": "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
          "source_values": {
            "v1": "72 g",
            "docx": "ไม่ระบุปริมาณ",
            "v2": "72 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "180 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "72 กรัมคือข้าวสารดิบ; เจ้าของเมนูยืนยันให้ตักข้าวหุงสุก 180 กรัมต่อที่",
          "serving_note": "ตักข้าวหุงสุก 180 กรัม",
          "cost_basis_text": "ข้าวสารญี่ปุ่นดิบ 72 กรัม"
        }
      ],
      "method_candidate_text": "1. เตรียมข้าวเปล่าจัดใส่กล่อง จากนั้นนำผัดผักที่เตรียมไว้จัดใส่บนข้าวข้างกล่อง\n2. นำเนื้อพิคานย่าที่ย่างไว้หั่นและเรียงบนข้าวข้างผัดผัก\n3. ราดซอสยากินิกุ 3 ช้อนโต๊ะลงบนเนื้อพิคานย่าและผัดผักให้ทั่ว",
      "method_selected_source": "docx",
      "method_decision_note": "DOCX ระบุขั้นตอนจัดเสิร์ฟ; เจ้าของเมนูยืนยันน้ำจิ้มซีฟู้ด 20 กรัมเสิร์ฟแยกในถ้วย 1 oz และใช้ผัดผัก 1 ชุดตามสูตร",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": []
    },
    {
      "recipe_id": 156,
      "legacy_recipe_id": 156,
      "recipe_version_id": "kitchen-v2-156-draft-001",
      "recipe_name": "ซอสยากินิกุ",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        159
      ],
      "review_state": "conflict",
      "source_locators": [
        "DOCX: true-originals/_inbox/ข้าวหน้าเนื้อยากินิกุ.docx",
        "V2: ซอสยากินิกุ",
        "ลายมือ: หน้า 23"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "ซอสยากินิกุ:โชยุ",
          "item_name": "โชยุ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "100 กรัม",
            "v2": "100 g",
            "handwriting": "100 g"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:มิริน",
          "item_name": "มิริน",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "100 กรัม",
            "v2": "100 g",
            "handwriting": "100 g"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:น้ำตาลทรายไม่ขัดสี",
          "item_name": "น้ำตาลทรายไม่ขัดสี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "45 g",
            "docx": "45 กรัม",
            "v2": "45 g",
            "handwriting": "45 g"
          },
          "candidate_text": "45 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:กระเทียมขูด",
          "item_name": "กระเทียมขูด",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "12 g",
            "docx": "12 กรัม",
            "v2": "12 g",
            "handwriting": "12 g"
          },
          "candidate_text": "12 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:ขิงขูด",
          "item_name": "ขิงขูด",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "12 g",
            "docx": "12 กรัม",
            "v2": "12 g",
            "handwriting": "12 g"
          },
          "candidate_text": "12 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:น้ำส้มสายชู",
          "item_name": "น้ำส้มสายชู",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "5 g",
            "docx": "5 กรัม",
            "v2": "5 g",
            "handwriting": "5 g"
          },
          "candidate_text": "5 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:น้ำมันงา",
          "item_name": "น้ำมันงา",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "10 g",
            "docx": "10 กรัม",
            "v2": "10 g",
            "handwriting": "10 g"
          },
          "candidate_text": "10 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:งาคั่ว",
          "item_name": "งาคั่ว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "3 g",
            "docx": "3 กรัม",
            "v2": "3 g",
            "handwriting": "3 g"
          },
          "candidate_text": "3 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:ชิโรดาชิ",
          "item_name": "ชิโรดาชิ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "10 g",
            "docx": "10 กรัม",
            "v2": "10 g",
            "handwriting": "10 g"
          },
          "candidate_text": "10 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:ฮอนสึยุ",
          "item_name": "ฮอนสึยุ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "10 g",
            "docx": "10 กรัม",
            "v2": "10 g",
            "handwriting": "10 g"
          },
          "candidate_text": "10 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสยากินิกุ:ซอสอเนกประสงค์",
          "item_name": "ซอสอเนกประสงค์",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 14,
          "source_values": {
            "v1": "0 / ไม่มีปริมาณ",
            "docx": "ไม่ใช้",
            "v2": "แถวเปล่า",
            "handwriting": "ขีดฆ่าและเขียนตัดออก"
          },
          "candidate_text": null,
          "selected_source": "handwriting",
          "decision_status": "removed_by_handwriting",
          "decision_note": "ตัดออกตามลายมือ"
        },
        {
          "line_key": "ซอสยากินิกุ:น้ำเปล่า",
          "item_name": "น้ำเปล่า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "ไม่มี",
            "docx": "100 กรัม",
            "v2": "ไม่มี",
            "handwriting": "ไม่มีในรายการ"
          },
          "candidate_text": null,
          "selected_source": null,
          "decision_status": "conflict",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. ตั้งหม้อเปิดไฟกลาง ใส่ซอสต่างๆ ลงไป ยกเว้นน้ำมันงา\n2. พอเริ่มเดือด ใส่งาคั่ว กระเทียมขูด ขิงขูด ตั้งไฟกลางต่อ 3 นาที\n3. หลังจากนั้นใส่น้ำมันงาลงไป ปรับไฟลงไฟเบาที่สุด หลังจากนั้นปิดไฟ เสร็จ",
      "method_selected_source": "matching_sources",
      "method_decision_note": "วิธีทำตรงกัน แต่ต้องยืนยันน้ำเปล่า 100 กรัมที่พบเฉพาะ DOCX",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "unresolved_source_conflict",
          "message": "น้ำเปล่า 100 กรัมใน DOCX ต้องใส่หรือไม่ เพราะไม่อยู่ใน V2/ลายมือ"
        }
      ]
    },
    {
      "recipe_id": 157,
      "legacy_recipe_id": 157,
      "recipe_version_id": "kitchen-v2-157-draft-001",
      "recipe_name": "ผัดผัก",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        159
      ],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: true-originals/_inbox/ข้าวหน้าเนื้อยากินิกุ.docx",
        "V2: ผัดผัก"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "ผัดผัก:กะหล่ำปลี",
          "item_name": "กะหล่ำปลี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "25 g",
            "docx": "25 กรัม",
            "v2": "25 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "25 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ผัดผัก:แครอทหั่นเส้น",
          "item_name": "แครอทหั่นเส้น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "25 g",
            "docx": "25 กรัม",
            "v2": "25 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "25 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ผัดผัก:น้ำมันปาล์ม",
          "item_name": "น้ำมันปาล์ม",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1 tsp",
            "docx": "1 ช้อนชา",
            "v2": "tsp แต่จำนวนหาย",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "1 ช้อนชา",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": null
        },
        {
          "line_key": "ผัดผัก:ซอสอเนกประสงค์",
          "item_name": "ซอสอเนกประสงค์",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 14,
          "source_values": {
            "v1": "1 tsp",
            "docx": "1 ช้อนชา",
            "v2": "tsp แต่จำนวนหาย",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "1 ช้อนชา",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": null
        },
        {
          "line_key": "ผัดผัก:โชยุ",
          "item_name": "โชยุ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1 g",
            "docx": "1 กรัม",
            "v2": "1 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "1 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ผัดผัก:น้ำมันงา",
          "item_name": "น้ำมันงา",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1 g",
            "docx": "1 กรัม",
            "v2": "1 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "1 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ผัดผัก:งาขาวคั่ว",
          "item_name": "งาขาวคั่ว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1 g",
            "docx": "1 กรัม",
            "v2": "1 g",
            "handwriting": "ไม่มีการแก้"
          },
          "candidate_text": "1 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. นำแครอทและกะหล่ำปลี อย่างละ 25 กรัม ใส่ในถ้วยและเติมน้ำเปล่าให้พอท่วมผัก จากนั้นนำเข้าไมโครเวฟไฟสูง 2 นาที\n2. เทน้ำออก สะเด็ดน้ำ ตั้งกระทะ เปิดไฟกลาง ใส่น้ำมัน 1 ช้อนชา ใส่ผักลงไปผัด ตามด้วยซอสอเนกประสงค์ 1 ช้อนชา โชยุ 1 กรัม น้ำมันงา 1 กรัม และงาขาวคั่ว 1 กรัม",
      "method_selected_source": "docx",
      "method_decision_note": "V1 ระบุว่าไม่มีวิธีทำ แต่ DOCX มี 2 ขั้นตอนครบ จึงนำมาเป็น candidate",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": []
    },
    {
      "recipe_id": 14,
      "legacy_recipe_id": 14,
      "recipe_version_id": "kitchen-v2-14-draft-001",
      "recipe_name": "ซอสอเนกประสงค์",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        157
      ],
      "review_state": "conflict",
      "source_locators": [
        "DOCX: สูตรอาหาร ครัวเนื้อในตำนาน.docx / SOP ซอสอเนกประสงค์",
        "V2: ซอสอเนกประสงค์"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "ซอสอเนกประสงค์:น้ำมันหอย",
          "item_name": "น้ำมันหอย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "ไฮนซ์ 500 g",
            "docx": "แพนกวิน 3 ตัว 500 กรัม",
            "v2": "ไฮนซ์ 500 g",
            "handwriting": "ไม่มี"
          },
          "candidate_text": "แพนกวิน 3 ตัว 500 กรัม",
          "selected_source": null,
          "decision_status": "conflict",
          "decision_note": null
        },
        {
          "line_key": "ซอสอเนกประสงค์:น้ำตาลทราย",
          "item_name": "น้ำตาลทราย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "น้ำตาลทรายขาว 75 g",
            "docx": "มิตรผล 75 กรัม",
            "v2": "น้ำตาลทรายขาว 75 g",
            "handwriting": "ไม่มี"
          },
          "candidate_text": "มิตรผล 75 กรัม",
          "selected_source": null,
          "decision_status": "needs_review",
          "decision_note": null
        },
        {
          "line_key": "ซอสอเนกประสงค์:ซอสปรุงรสฝาเขียว",
          "item_name": "ซอสปรุงรสฝาเขียว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "ภูเขาทอง 38 g",
            "docx": "38 กรัม",
            "v2": "ภูเขาทอง 38 g",
            "handwriting": "ไม่มี"
          },
          "candidate_text": "38 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสอเนกประสงค์:คนอร์ไก่ฮ่องกง",
          "item_name": "คนอร์ไก่ฮ่องกง",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "60 g",
            "docx": "60 กรัม",
            "v2": "60 g",
            "handwriting": "ไม่มี"
          },
          "candidate_text": "60 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสอเนกประสงค์:พริกไทยขาวป่น",
          "item_name": "พริกไทยขาวป่น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "2.5 g",
            "docx": "2.5 กรัม",
            "v2": "2.5 g",
            "handwriting": "ไม่มี"
          },
          "candidate_text": "2.5 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ซอสอเนกประสงค์:เหล้าจีน",
          "item_name": "เหล้าจีน",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "25 ml",
            "docx": "25 กรัม",
            "v2": "25 ml",
            "handwriting": "ไม่มี"
          },
          "candidate_text": null,
          "selected_source": null,
          "decision_status": "conflict",
          "decision_note": null
        },
        {
          "line_key": "ซอสอเนกประสงค์:ผงชูรส",
          "item_name": "ผงชูรส",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "50 g",
            "docx": "50 กรัม",
            "v2": "50 g",
            "handwriting": "ไม่มี"
          },
          "candidate_text": "50 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. ใส่ส่วนผสมทั้งหมดลงในหม้อหรือภาชนะสำหรับทำซอส\n2. คนให้เข้ากันจนส่วนผสมละลายเข้ากันดี\n3. เปิดไฟอ่อนๆ เคี่ยวจนซอสเริ่มเดือด เพื่อให้เครื่องปรุงเข้ากันดี\n4. เมื่อซอสเดือดทั่ว ให้ปิดไฟและพักให้เย็น\n5. ตักใส่กล่องหรือขวดที่สะอาดและปิดฝาให้สนิท\nจัดเก็บ: ภาชนะปิดสนิทป้องกันอากาศและความชื้น · แช่เย็น 0–5°C เพื่อยืดอายุ · ใช้ได้ประมาณ 1 เดือนหลังผลิต\nการนำไปใช้: ซอสผัด ซอสหมัก หรือซอสปรุงรสทั่วไป · ใช้ในเมนูผัดกระเทียม ผัดเนื้อ ผัดน้ำมันหอย หรือซอสคลุกข้าวได้",
      "method_selected_source": "docx",
      "method_decision_note": "DOCX มีวิธีทำ การเก็บ 0-5°C อายุประมาณ 1 เดือน และการนำไปใช้ครบ",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "unresolved_source_conflict",
          "message": "ยืนยันยี่ห้อน้ำมันหอย น้ำตาล และหน่วยเหล้าจีน 25 กรัมหรือ 25 ml"
        }
      ]
    },
    {
      "recipe_id": 37,
      "legacy_recipe_id": 37,
      "recipe_version_id": "kitchen-v2-37-draft-001",
      "recipe_name": "ข้าวขยำเนื้อแดดเดียว",
      "recipe_type": "sellable_menu",
      "parent_recipe_ids": [],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: true-originals/_inbox/ข้าวขยำเนื้อแดดเดียว.docx",
        "V2: ข้าวขยำเนื้อแดดเดียว",
        "ลายมือ: หน้า 9",
        "Owner confirmation: 2026-08-04 — เมนูข้าวตักข้าวหุงสุก 180 กรัมต่อจาน; 72 กรัมคงไว้เฉพาะฐานต้นทุนข้าวสารดิบ"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:เนื้อแดดเดียว",
          "item_name": "เนื้อแดดเดียว",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 28,
          "source_values": {
            "v1": "75 g",
            "docx": "75 กรัม",
            "v2": "75 g",
            "handwriting": "75 g"
          },
          "candidate_text": "75 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:ข้าวหอมมะลิ",
          "item_name": "ข้าวหอมมะลิหุงสุก",
          "item_kind": "prepared_recipe",
          "component_recipe_id": "candidate:prepared:ข้าวหอมมะลิหุงสุก",
          "source_values": {
            "v1": "72 g",
            "docx": "กล่าวถึงข้าว แต่ไม่ระบุปริมาณ",
            "v2": "72 g",
            "handwriting": "72 g",
            "owner_confirmation": "ข้าวหอมมะลิหุงสุก 180 กรัมต่อจาน"
          },
          "candidate_text": "180 กรัม",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "เจ้าของยืนยันวันที่ 2026-08-04 ว่าเมนูข้าวตักข้าวหุงสุก 180 กรัมต่อจาน",
          "serving_note": "ตักข้าวหุงสุก 180 กรัม",
          "cost_basis_text": "ข้าวหอมมะลิดิบ 72 กรัม"
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:หอมอินเดีย",
          "item_name": "หอมอินเดีย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "10 g",
            "docx": "10 กรัม",
            "v2": "10 g",
            "handwriting": "10 g"
          },
          "candidate_text": "10 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:พริกแดงจินดา",
          "item_name": "พริกแดงจินดา",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "8 g",
            "docx": "8 กรัม",
            "v2": "8 g",
            "handwriting": "8 g"
          },
          "candidate_text": "8 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:ผักชีไทย",
          "item_name": "ผักชีไทย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "5 g",
            "docx": "5 กรัม",
            "v2": "5 g",
            "handwriting": "5 g"
          },
          "candidate_text": "5 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:กระเทียมกรอบ",
          "item_name": "กระเทียมกรอบ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "5 g",
            "docx": "1 ช้อนโต๊ะ",
            "v2": "5 g",
            "handwriting": "ไม่แก้"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": null
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:น้ำมะนาวสด",
          "item_name": "น้ำมะนาวสด",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "น้ำมะนาว ARO 5 g",
            "docx": "รายการ 1 ช้อนโต๊ะ / ขั้นตอน 1 ช้อนชา",
            "v2": "น้ำมะนาว ARO 5 g",
            "handwriting": "เปลี่ยนเป็นน้ำมะนาวสด และแก้เป็น 1 ts"
          },
          "candidate_text": "1 ช้อนชา",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:ผงชูรส",
          "item_name": "ผงชูรส",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "0.5 g",
            "docx": "ปลายช้อน",
            "v2": "0.5 g",
            "handwriting": "ไม่แก้"
          },
          "candidate_text": "ปลายช้อน",
          "selected_source": "docx",
          "decision_status": "confirmed_from_docx",
          "decision_note": null
        },
        {
          "line_key": "ข้าวขยำเนื้อแดดเดียว:น้ำยำ",
          "item_name": "น้ำยำ",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 16,
          "source_values": {
            "v1": "15 ml",
            "docx": "1 ช้อนโต๊ะ",
            "v2": "15 ml",
            "handwriting": "1 tb"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. ก่อนแพ็ค ตัดเนื้อให้เป็นชิ้นพอดีคำ ความยาวประมาณ 1.5 นิ้ว\n2. ทอดเนื้อแดดเดียว แล้วพักไว้\n3. ตักข้าวใส่กล่อง นำผักต่างๆ จัดวางไว้รอบๆ กล่อง แล้วโปะเนื้อที่เตรียมไว้ลงไป ยกเว้นกระเทียมกรอบ\n4. จากนั้นตักน้ำยำ 1 ช้อนโต๊ะ ใส่ถ้วยสแตนเลสอันเล็ก ใส่น้ำมะนาว 1 ช้อนชา ผงชูรสปลายช้อน\n5. คนให้ละลายและเข้ากัน จากนั้นส่งให้คนหน้าบ้านเทใส่ถ้วยน้ำจิ้มพร้อมเสิร์ฟ\n6. นำกระเทียมกรอบใส่ถุงซิปแยกให้ลูกค้า\n(หมายเหตุ: น้ำยำ base ต่อ batch = น้ำตาลทราย 100g · น้ำปลา 100g · น้ำเปล่า 250g · น้ำตาลมะพร้าว 55g)",
      "method_selected_source": "matching_sources",
      "method_decision_note": "ใช้วิธีทำจาก DOCX/V2 และใช้หน่วยช้อนตามลายมือหน้า 9",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": []
    },
    {
      "recipe_id": 28,
      "legacy_recipe_id": 28,
      "recipe_version_id": "kitchen-v2-28-draft-001",
      "recipe_name": "เนื้อแดด (ข้าวขยำ)",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        37
      ],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: ข้าวขยำเนื้อแดดเดียว.docx / ใช้เนื้อแดดเดียว 75 กรัม",
        "V2: เนื้อแดด (ข้าวขยำ)",
        "PDF: true-originals/_inbox/scan จากเล่ม หน้างานจริงพนักงาน/ข้าวขยำเนื้อแดดเดียว.pdf",
        "Owner confirmation: 2026-08-04 — หมัก 1 ชั่วโมง; แดดแรง 1 ชั่วโมง กลับด้านแล้วตากต่อ 30 นาที; แดดไม่แรง 3 ชั่วโมงไม่ต้องกลับด้าน"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "เนื้อแดด (ข้าวขยำ):สันนอก (ดิบ)",
          "item_name": "สันนอก (ดิบ)",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1000 g",
            "docx": "ไม่พบสูตรหมัก",
            "v2": "เหมือน V1: 1000 g",
            "handwriting": "ไม่มีการแก้สูตรนี้"
          },
          "candidate_text": "1000 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "needs_review",
          "decision_note": "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
        },
        {
          "line_key": "เนื้อแดด (ข้าวขยำ):รสดีก๋วยเตี๋ยวเข้มข้น",
          "item_name": "รสดีก๋วยเตี๋ยวเข้มข้น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "10 g",
            "docx": "ไม่พบสูตรหมัก",
            "v2": "เหมือน V1: 10 g",
            "handwriting": "ไม่มีการแก้สูตรนี้"
          },
          "candidate_text": "10 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "needs_review",
          "decision_note": "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
        },
        {
          "line_key": "เนื้อแดด (ข้าวขยำ):น้ำตาลทรายไม่ขัดสี",
          "item_name": "น้ำตาลทรายไม่ขัดสี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "20 g",
            "docx": "ไม่พบสูตรหมัก",
            "v2": "เหมือน V1: 20 g",
            "handwriting": "ไม่มีการแก้สูตรนี้"
          },
          "candidate_text": "20 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "needs_review",
          "decision_note": "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
        },
        {
          "line_key": "เนื้อแดด (ข้าวขยำ):ผงชูรส (อายิโนะโมะโต๊ะ)",
          "item_name": "ผงชูรส (อายิโนะโมะโต๊ะ)",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "20 g",
            "docx": "ไม่พบสูตรหมัก",
            "v2": "เหมือน V1: 20 g",
            "handwriting": "ไม่มีการแก้สูตรนี้"
          },
          "candidate_text": "20 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "needs_review",
          "decision_note": "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
        },
        {
          "line_key": "เนื้อแดด (ข้าวขยำ):ซอสหอยนางรม (ไฮนซ์)",
          "item_name": "ซอสหอยนางรม (ไฮนซ์)",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "80 g",
            "docx": "ไม่พบสูตรหมัก",
            "v2": "เหมือน V1: 80 g",
            "handwriting": "ไม่มีการแก้สูตรนี้"
          },
          "candidate_text": "80 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "needs_review",
          "decision_note": "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
        },
        {
          "line_key": "เนื้อแดด (ข้าวขยำ):เกลือสมุทร",
          "item_name": "เกลือสมุทร",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "4 g",
            "docx": "ไม่พบสูตรหมัก",
            "v2": "เหมือน V1: 4 g",
            "handwriting": "ไม่มีการแก้สูตรนี้"
          },
          "candidate_text": "4 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "needs_review",
          "decision_note": "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
        },
        {
          "line_key": "เนื้อแดด (ข้าวขยำ):พริกไทยดำเม็ด (ง่วนสูน)",
          "item_name": "พริกไทยดำเม็ด (ง่วนสูน)",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "4 g",
            "docx": "ไม่พบสูตรหมัก",
            "v2": "เหมือน V1: 4 g",
            "handwriting": "ไม่มีการแก้สูตรนี้"
          },
          "candidate_text": "4 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "needs_review",
          "decision_note": "ย้ายรายการเดิมจาก V1/V2 มาให้ครัวตรวจทีละรายการ; ยังไม่ถือว่าอนุมัติสูตร"
        }
      ],
      "method_candidate_text": "1. หมักเนื้อตามสูตร 1 ชั่วโมง\n2. หากแดดแรง ตาก 1 ชั่วโมง จากนั้นกลับด้านและตากต่ออีก 30 นาที\n3. หากแดดไม่แรง ตากต่อเนื่อง 3 ชั่วโมงโดยไม่ต้องกลับด้าน",
      "method_selected_source": "owner_confirmation",
      "method_decision_note": "เรียบเรียงจากคำบอกของครัวเท่าที่ได้รับ โดยไม่เติมวิธีเตรียมชิ้นเนื้อ การเก็บ หรือผลผลิตหลังตาก",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "missing_source",
          "message": "ยังขาดข้อมูล: วิธีเตรียมชิ้นเนื้อก่อนหมัก การเก็บ และผลผลิตหลังตาก"
        }
      ]
    },
    {
      "recipe_id": 16,
      "legacy_recipe_id": 16,
      "recipe_version_id": "kitchen-v2-16-draft-001",
      "recipe_name": "น้ำยำ",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        37
      ],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "V2: น้ำยำ",
        "ลายมือ: หน้า 21"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "น้ำยำ:น้ำตาลทรายไม่ขัดสี",
          "item_name": "น้ำตาลทรายไม่ขัดสี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "100 กรัม",
            "v2": "100 g",
            "handwriting": "แก้ชนิดน้ำตาล"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "น้ำยำ:น้ำปลาทิพรส",
          "item_name": "น้ำปลาทิพรส",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "100 g",
            "docx": "100 กรัม",
            "v2": "100 g",
            "handwriting": "100 g"
          },
          "candidate_text": "100 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "น้ำยำ:น้ำตาลมะพร้าว",
          "item_name": "น้ำตาลมะพร้าว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "55 g",
            "docx": "55 กรัม",
            "v2": "55 g",
            "handwriting": "55 g"
          },
          "candidate_text": "55 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "น้ำยำ:น้ำเปล่า",
          "item_name": "น้ำเปล่า",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "250 g",
            "docx": "250 กรัม",
            "v2": "250 g",
            "handwriting": "เพิ่ม 250 g"
          },
          "candidate_text": "250 กรัม",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. ใส่น้ำปลาลงหม้อ ตั้งไฟกลาง รอให้เริ่มเดือดปุด ๆ มีกลิ่นหอม\n2. เบาไฟ ใส่น้ำตาล และน้ำเปล่า คนให้น้ำตาลละลาย\n3. เร่งไฟกลาง ให้เดือด · เบาไฟ เคี่ยวต่ออีก 5 นาที\n\nหมายเหตุ: ครัวเขียนมาเอง (ลายมือหน้า 21 · 2026-08-02) · หัวเรื่องครัวกำกับว่า \"(ข้าวขยำเนื้อ)\"",
      "method_selected_source": "handwriting",
      "method_decision_note": "ใช้ขั้นตอนลายมือหน้า 21 ทั้งชุด",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": []
    },
    {
      "recipe_id": 163,
      "legacy_recipe_id": 163,
      "recipe_version_id": "kitchen-v2-163-draft-001",
      "recipe_name": "เนื้อตุ๋นคั่วพริกเกลือ",
      "recipe_type": "sellable_menu",
      "parent_recipe_ids": [],
      "review_state": "reviewed_candidate",
      "source_locators": [
        "DOCX: true-originals/_inbox/เนื้อตุ๋นคั่วพริกเกลือ.docx",
        "V2: เนื้อตุ๋นคั่วพริกเกลือ",
        "ลายมือ: หน้า 19"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "เนื้อตุ๋นคั่วพริกเกลือ:พริกแดงจินดา",
          "item_name": "พริกแดงจินดา",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "3 g",
            "docx": "3 กรัม",
            "v2": "3 g",
            "handwriting": "1 ts"
          },
          "candidate_text": "1 ช้อนชา",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋นคั่วพริกเกลือ:ต้นหอมซอย",
          "item_name": "ต้นหอมซอย",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "3 g",
            "docx": "3 กรัม",
            "v2": "3 g",
            "handwriting": "1 ts"
          },
          "candidate_text": "1 ช้อนชา",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋นคั่วพริกเกลือ:พริกไทยป่น",
          "item_name": "พริกไทยป่น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "1 g",
            "docx": "1 กรัม",
            "v2": "1 g",
            "handwriting": "ไม่แก้"
          },
          "candidate_text": "1 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋นคั่วพริกเกลือ:กระเทียมป่น",
          "item_name": "กระเทียมป่น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "กระเทียมไทย 5 g",
            "docx": "กระเทียมสับ 5 กรัม",
            "v2": "กระเทียมไทย 5 g",
            "handwriting": "เปลี่ยนเป็นกระเทียมป่น 1 ts"
          },
          "candidate_text": "1 ช้อนชา",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋นคั่วพริกเกลือ:เนื้อตุ๋น",
          "item_name": "เนื้อตุ๋น",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "75 g",
            "docx": "กล่าวถึงแต่ไม่ใส่ในรายการ",
            "v2": "75 g",
            "handwriting": "75 g"
          },
          "candidate_text": "75 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "เนื้อตุ๋นคั่วพริกเกลือ:ผงคั่วพริกเกลือ",
          "item_name": "ผงคั่วพริกเกลือ",
          "item_kind": "prepared_recipe",
          "component_recipe_id": 162,
          "source_values": {
            "v1": "15 g",
            "docx": "1 ช้อนโต๊ะ",
            "v2": "15 g",
            "handwriting": "1 tb"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "handwriting",
          "decision_status": "confirmed_from_handwriting",
          "decision_note": null
        }
      ],
      "method_candidate_text": "1. ตั้งกระทะเปิดไฟกลาง รวนเนื้อตุ๋นให้เปลี่ยนสี\n2. หลังจากเนื้อตุ๋นได้ที่ ใส่กระเทียมลงไปผัด ให้กระเทียมสุก ตามด้วยผงคั่วพริกเกลือ\n3. ผัดทุกอย่างให้เข้ากัน หลังจากนั้นใส่ต้นหอมซอยลงไป\n(ผงคั่วพริกเกลือ ผสมเป็น batch: น้ำตาลทรายไม่ขัดสี 90g · รสดีเนื้อ 120g · ผงชูรส 90g · เกลือ 30g — ต่อ 1 เสิร์ฟใช้ผง 1 ช้อนโต๊ะ + พริกจินดาแดง 3g + ต้นหอมซอย 3g + พริกไทยป่น 1g + กระเทียมสับ 5g)",
      "method_selected_source": "matching_sources",
      "method_decision_note": "วิธีทำตรงกันและใช้หน่วยช้อนตามลายมือหน้า 19",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": []
    },
    {
      "recipe_id": 162,
      "legacy_recipe_id": 162,
      "recipe_version_id": "kitchen-v2-162-draft-001",
      "recipe_name": "ผงคั่วพริกเกลือ",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        163
      ],
      "review_state": "missing_method",
      "source_locators": [
        "DOCX: true-originals/_inbox/เนื้อตุ๋นคั่วพริกเกลือ.docx",
        "V2: ผงคั่วพริกเกลือ"
      ],
      "source_section_mappings": [],
      "items": [
        {
          "line_key": "ผงคั่วพริกเกลือ:น้ำตาลทรายไม่ขัดสี",
          "item_name": "น้ำตาลทรายไม่ขัดสี",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "90 g",
            "docx": "90 กรัม",
            "v2": "90 g",
            "handwriting": "ไม่แก้"
          },
          "candidate_text": "90 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ผงคั่วพริกเกลือ:รสดีเนื้อ",
          "item_name": "รสดีเนื้อ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "120 g",
            "docx": "120 กรัม",
            "v2": "120 g",
            "handwriting": "ไม่แก้"
          },
          "candidate_text": "120 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ผงคั่วพริกเกลือ:ผงชูรส",
          "item_name": "ผงชูรส",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "90 g",
            "docx": "90 กรัม",
            "v2": "90 g",
            "handwriting": "ไม่แก้"
          },
          "candidate_text": "90 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        },
        {
          "line_key": "ผงคั่วพริกเกลือ:เกลือ",
          "item_name": "เกลือ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "30 g",
            "docx": "30 กรัม",
            "v2": "30 g",
            "handwriting": "ไม่แก้"
          },
          "candidate_text": "30 กรัม",
          "selected_source": "matching_sources",
          "decision_status": "confirmed",
          "decision_note": null
        }
      ],
      "method_candidate_text": null,
      "method_selected_source": null,
      "method_decision_note": "มีสัดส่วนผสมครบ แต่ยังไม่มีขั้นตอนคลุก/เก็บ/ผลผลิต จึงพิมพ์ได้เฉพาะฉบับร่าง",
      "yield_candidate_text": null,
      "operational_notes": [],
      "blockers": [
        {
          "code": "unresolved_source_conflict",
          "message": "ขั้นตอนการผสม การเก็บ และผลผลิตสุดท้าย"
        },
        {
          "code": "missing_method",
          "message": "มีสัดส่วนผสมครบ แต่ยังไม่มีขั้นตอนคลุก/เก็บ/ผลผลิต จึงพิมพ์ได้เฉพาะฉบับร่าง"
        }
      ]
    },
    {
      "recipe_id": "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
      "legacy_recipe_id": null,
      "recipe_version_id": "kitchen-v2-candidate-cooked-japanese-rice-draft-001",
      "recipe_name": "ข้าวญี่ปุ่นหุงสุก",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        159
      ],
      "review_state": "missing_source",
      "source_locators": [
        "V1 import note: 72g ดิบ → 180g สุก (×2.5)",
        "Owner confirmation: 2026-08-04 — ข้าว 1500 ml + น้ำ 2100 ml + น้ำมันรำข้าว 1 ช้อนโต๊ะ; ซาว 2 รอบโดยใช้น้ำให้ท่วมข้าว",
        "Owner confirmation: 2026-08-04 — ใช้ข้าวญี่ปุ่นเฉพาะข้าวหน้าเนื้อกิวด้งและข้าวหน้าเนื้อยากินิกุ"
      ],
      "items": [
        {
          "line_key": "ข้าวญี่ปุ่นหุงสุก:ข้าวสารญี่ปุ่นดิบ",
          "item_name": "ข้าวสารญี่ปุ่นดิบ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "v1": "72 g ดิบ → 180 g สุก (×2.5)",
            "docx": null,
            "v2": "72 g",
            "handwriting": null,
            "owner_confirmation": "1500 ml"
          },
          "candidate_text": "1500 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "ปริมาณข้าวสารดิบสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
        },
        {
          "line_key": "ข้าวญี่ปุ่นหุงสุก:น้ำ",
          "item_name": "น้ำ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "owner_confirmation": "2100 ml"
          },
          "candidate_text": "2100 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "ปริมาณน้ำสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
        },
        {
          "line_key": "ข้าวญี่ปุ่นหุงสุก:น้ำมันรำข้าว",
          "item_name": "น้ำมันรำข้าว",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "owner_confirmation": "1 ช้อนโต๊ะ"
          },
          "candidate_text": "1 ช้อนโต๊ะ",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "ใส่ในข้าวญี่ปุ่นก่อนนำไปหุงตามที่เจ้าของยืนยัน"
        }
      ],
      "method_candidate_text": "1. ซาวข้าวโดยเติมน้ำให้ท่วมข้าว แล้วเทน้ำซาวออก ทำซ้ำรวม 2 รอบ\n2. เติมน้ำตามปริมาณที่ระบุในสูตร ใส่น้ำมันรำข้าว 1 ช้อนโต๊ะ แล้วนำไปหุง",
      "method_selected_source": "owner_confirmation",
      "method_decision_note": "เรียบเรียงจากคำบอกของครัวเท่าที่ได้รับ โดยไม่เติมเวลา โปรแกรมหม้อ หรือวิธีพักข้าว",
      "yield_candidate_text": "ข้าวหุงสุก 180 กรัม ต่อข้าวสารดิบ 72 กรัม",
      "operational_notes": [
        "สูตรแบตช์: ข้าวสารญี่ปุ่นดิบ 1500 ml + น้ำ 2100 ml + น้ำมันรำข้าว 1 ช้อนโต๊ะ",
        "ฐานต้นทุนต่อที่: ข้าวสารญี่ปุ่นดิบ 72 กรัม",
        "เมนูหน้าครัวตักข้าวหุงสุก 180 กรัมต่อที่",
        "ใช้เฉพาะเมนูข้าวหน้าเนื้อกิวด้งและข้าวหน้าเนื้อยากินิกุ"
      ],
      "blockers": [
        {
          "code": "missing_source",
          "message": "ยังขาดข้อมูล: โปรแกรมหม้อ เวลา การพักข้าว และผลผลิตข้าวสุกต่อแบตช์"
        }
      ]
    },
    {
      "recipe_id": "candidate:prepared:ข้าวหอมมะลิหุงสุก",
      "legacy_recipe_id": null,
      "recipe_version_id": "kitchen-v2-candidate-cooked-jasmine-rice-draft-001",
      "recipe_name": "ข้าวหอมมะลิหุงสุก",
      "recipe_type": "prepared_recipe",
      "parent_recipe_ids": [
        165,
        37
      ],
      "review_state": "missing_source",
      "source_locators": [
        "Owner confirmation: 2026-08-04 — ข้าว 8 ถ้วย (350 ml) + น้ำ 2000 ml; ซาว 2 รอบโดยใช้น้ำให้ท่วมข้าว",
        "Owner confirmation: 2026-08-04 — ข้าวหน้าเนื้อตุ๋นและข้าวขยำเนื้อแดดเดียวใช้ข้าวหอมมะลิหุงสุก 180 กรัมต่อจาน"
      ],
      "items": [
        {
          "line_key": "ข้าวหอมมะลิหุงสุก:ข้าวหอมมะลิดิบ",
          "item_name": "ข้าวหอมมะลิดิบ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "owner_confirmation": "8 ถ้วย (350 ml)"
          },
          "candidate_text": "8 ถ้วย (350 ml)",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "ปริมาณข้าวสารดิบสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
        },
        {
          "line_key": "ข้าวหอมมะลิหุงสุก:น้ำ",
          "item_name": "น้ำ",
          "item_kind": "direct_ingredient",
          "component_recipe_id": null,
          "source_values": {
            "owner_confirmation": "2000 ml"
          },
          "candidate_text": "2000 ml",
          "selected_source": "owner_confirmation",
          "decision_status": "confirmed_by_owner",
          "decision_note": "ปริมาณน้ำสำหรับหุงหนึ่งแบตช์ตามที่เจ้าของยืนยัน"
        }
      ],
      "method_candidate_text": "1. ซาวข้าวโดยเติมน้ำให้ท่วมข้าว แล้วเทน้ำซาวออก ทำซ้ำรวม 2 รอบ\n2. เติมน้ำตามปริมาณที่ระบุในสูตร แล้วนำไปหุง",
      "method_selected_source": "owner_confirmation",
      "method_decision_note": "เรียบเรียงจากคำบอกของครัวเท่าที่ได้รับ โดยไม่เติมเวลา โปรแกรมหม้อ หรือวิธีพักข้าว",
      "yield_candidate_text": null,
      "operational_notes": [
        "สูตรแบตช์: ข้าวหอมมะลิ 8 ถ้วย (350 ml) + น้ำ 2000 ml",
        "เมนูหน้าครัวตักข้าวหุงสุก 180 กรัมต่อจาน",
        "ฐานต้นทุนต่อจาน: ข้าวหอมมะลิดิบ 72 กรัม"
      ],
      "blockers": [
        {
          "code": "missing_source",
          "message": "ยังขาดข้อมูล: โปรแกรมหม้อ เวลา การพักข้าว และน้ำหนักข้าวสุกต่อแบตช์"
        }
      ]
    }
  ]
};
