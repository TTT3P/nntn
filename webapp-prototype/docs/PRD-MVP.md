# PRD — NNTN Recipe Studio Prototype MVP

**สถานะ:** LOCKED — Prototype Spec v1  
**ล็อกเมื่อ:** 4 สิงหาคม 2026  
**เจ้าของ requirement:** TINE  
**ประเภท:** Static product/UX prototype

> TINE ยืนยันให้หยุดเพิ่ม feature หลัง SKU & Routing Sheet ขอบเขตในเอกสารนี้เป็น final scope ของ Prototype Spec v1 การแก้ไขหลังจากนี้ต้องมีคำสั่งใหม่ที่ระบุว่าเป็นการปลดล็อกหรือสร้าง version ถัดไป

## 1. Product Goal

สร้างต้นแบบระบบกลางสำหรับบริษัทอาหารที่มีหลายแบรนด์และหลายสาขา เพื่อสาธิต workflow ตั้งแต่เขียนสูตร SOP, อ้างอิงน้ำหนักเพื่อประมาณต้นทุน, พิมพ์ตำรา และเลือกเฉพาะเมนูที่แต่ละสาขาจะขาย

ระบบต้นแบบต้องตอบคำถามหลัก:

1. คนครัวบันทึกสูตรด้วยหน่วยที่ใช้จริงได้หรือไม่
2. ฝ่ายต้นทุนเห็นได้หรือไม่ว่าค่าแปลงใดชั่งจริง ค่าใดมาจากผู้ผลิตหรือเป็นค่าประมาณ
3. สูตรเดียวสามารถพิมพ์เป็นเอกสารหลายรูปแบบได้หรือไม่
4. บริษัทสามารถเลือกบางเมนูให้สาขาใหม่ แล้วดึงเฉพาะสูตรที่จำเป็นได้หรือไม่
5. สูตรแม่หนึ่งสูตรรองรับหลายตัวเลือกเนื้อ โดยไม่ทำสำเนาส่วนผสมและ SOP ร่วมกันได้หรือไม่

## 2. Product Principles

- **One recipe, two representations:** SOP รักษาหน่วยหน้างาน; costing ใช้ normalized weight ที่คำนวณแยก
- **Evidence before estimate:** ทุก conversion มี provenance และ confidence
- **Never guess missing conversions:** ไม่มีข้อมูลต้องแสดง `รอข้อมูล`
- **Master, not copies:** สาขาอ้าง Master Recipe Version ผ่าน Menu Assignment
- **Base + variants:** สูตรแม่เก็บส่วนร่วม แต่ละ Variant เก็บเฉพาะวัตถุดิบผันแปร ราคา และขั้นตอนที่ต่าง
- **Dependencies close automatically:** เลือก Menu Item แล้วรวม Master/Sub-recipe/Prep/Packaging ที่จำเป็นโดยไม่ซ้ำ
- **Prototype before platform:** รอบนี้พิสูจน์ workflow และหน้าจอ ไม่สร้างระบบ production

## 3. Users

- **ครัว/ผู้เขียนสูตร:** กรอก SOP และใช้เอกสารหน้าครัว
- **ทีมพัฒนาสูตร/ครัวกลาง:** ดู revision และ Master Recipe
- **ฝ่ายต้นทุน:** ดู normalized weight, provenance และ confidence
- **ฝ่ายปฏิบัติการสาขา:** เลือก Menu Set, ตรวจ dependency และ readiness
- **ผู้บริหาร/เจ้าของระบบ:** เปรียบเทียบ rollout ของหลายสาขา

## 4. MVP Functional Scope

### 4.1 Recipe Editor / SOP

- ชื่อเมนูและหมวด
- เลือกรูปแบบเมนูเดี่ยวหรือเมนูมีตัวเลือก
- เมนูเดี่ยวมี Recipe code, Internal SKU, สถานะ, จุดครัว และ Channel routing
- การสลับกลับเป็นเมนูเดี่ยวต้องซ่อนแต่ไม่ลบข้อมูล Variant
- รายการส่วนผสมเพิ่ม/ลบได้
- หน่วยกรัม, กิโลกรัม, มิลลิลิตร, ลิตร, ช้อนโต๊ะ, ช้อนชา และชิ้น
- ขั้นตอนวิธีทำ
- Revision history แบบ mock
- ล้างแบบฟอร์มและบันทึกแบบร่างจำลอง

### 4.2 Measurement Knowledge

- Structured mock knowledge แยกตามวัตถุดิบและสภาพ
- Provenance: ชั่งจริง NNTN, ผู้ผลิต, ค่าประมาณ, หน่วยน้ำหนักตรง, ไม่มีข้อมูล
- Confidence และคำอธิบายสูตรคำนวณ
- Summary จำนวน profile ตาม provenance
- ไม่มี conversion ต้องไม่คำนวณน้ำหนัก

### 4.3 Recipe Family / Variants

- สูตรเดี่ยวเดิมยังใช้งานได้โดยไม่ต้องมี Variant
- สูตรแม่หนึ่งสูตรเพิ่ม/ลบ Variant ได้หลายตัวเลือก
- แต่ละ Variant มีชื่อ ราคาขาย mock และสถานะ แบบร่าง/เปิดใช้งาน/ปิดใช้งาน
- แต่ละ Variant มี Variant code, Internal SKU, จุดครัว, Branch routing และ Channel SKU mapping
- หนึ่ง Variant มีเนื้อหรือชิ้นส่วนหลายรายการได้ เช่น ใบพาย 70 g + น่องลาย 50 g
- Food Cost Preview เลือก Variant แล้วรวมส่วนผสมสูตรแม่กับวัตถุดิบของ Variant
- Print Center มองแต่ละ Variant เป็นเอกสารสูตรขายแยกกัน
- Food Cost selector, เอกสารสูตรขาย และ Routing รับเฉพาะ Variant ที่เปิดใช้งาน
- หากทุก Variant ถูกปิด ระบบต้องเตือนและห้ามเปลี่ยนกลับเป็นเมนูเดี่ยวอัตโนมัติ
- ของเพิ่ม เช่น ไข่ดาว เพิ่มข้าว และเพิ่มเนื้อ เป็น Modifier แยกจาก Variant

### 4.4 Food Cost Preview

- อ่านส่วนผสมจาก Recipe Editor แบบ real-time
- แสดงหน่วย SOP และ normalized grams
- แสดงสูตรแปลงและหลักฐาน
- ปุ่มข้อมูลตัวอย่างเพื่อสาธิต measured/manufacturer/estimated/missing
- รอบนี้ยังไม่คำนวณราคาหรือ Food Cost % จริง

### 4.5 Print Center

- เลือกสูตรเดียวหรือหลายสูตร
- ตัวคูณปริมาณ
- สถานะ DRAFT/ทดลอง/อนุมัติแล้ว
- เปิด/ปิด Revision history
- Preview และ `window.print()`/Save as PDF
- แม่แบบ A4 Master Recipe, A5 Kitchen Guide และ Cookbook Booklet
- SKU & Routing Sheet แสดง Internal SKU, External SKU, ช่องทาง, สาขา และจุดครัว

### 4.6 Company / Brand / Branch

- เลือกบริษัท แบรนด์ และสาขา
- Branch profile: รูปแบบร้าน พื้นที่ อุปกรณ์ และวันเปิดเป้าหมาย
- ข้อมูลทั้งหมดเป็น mock

### 4.7 Menu Assignment

- Menu Set: Full Menu, Express, Delivery Only
- เลือก/ตัด Menu Item รายตัวได้
- การเลือกต่างจาก preset ต้องแสดงเป็น Custom
- Menu Item แยกจาก Recipe

### 4.8 Dependency Preview

- รวม recipe dependency โดยไม่ซ้ำ
- แยกสูตรหลัก สูตรเตรียม ของเตรียม และบรรจุภัณฑ์
- แสดง version และ readiness ของ dependency
- ไม่มี Menu Item ต้องแสดง empty state

### 4.9 Branch Readiness / Rollout

- ตรวจการเลือกเมนู, dependency, Measurement Knowledge และราคา/Supplier mock
- แสดง progress และรายการพร้อม/ต้องเตรียม
- ป้องกันการเผยแพร่เมื่อไม่เลือกเมนู
- ตารางสาขาตัวอย่าง: ใช้งานแล้ว, รอทดสอบ, มีข้อยกเว้น, แบบร่าง

## 5. Core Conceptual Entities

```text
Company
└── Brand
    └── Branch

Recipe
└── Recipe Version
    ├── Base Ingredients / SOP Units
    ├── Base Steps
    ├── Recipe Variants
    │   ├── Variant Ingredients (one or many parts)
    │   ├── Price / Draft-Active-Inactive state
    │   ├── Internal SKU / Channel SKU mappings
    │   ├── Branch route / Kitchen station
    │   └── Variant-specific SOP note
    └── Measurement Knowledge references

Menu Item
└── Recipe Dependencies

Menu Set
└── Menu Items

Branch Menu Assignment
├── Branch
├── Menu Set or Custom selection
└── Effective Recipe Versions
```

## 6. Main User Flows

### Recipe and Cost Reference

```text
กรอก SOP
→ ระบบอ่านวัตถุดิบ/หน่วย
→ หา Measurement Knowledge
→ แสดง normalized grams + provenance
→ ไม่มีข้อมูล = รอข้อมูล
```

### Recipe Family and Variant

```text
กรอกส่วนผสมและ SOP สูตรแม่
→ เพิ่มตัวเลือกเนื้อ
→ เพิ่มหนึ่งหรือหลายชิ้นส่วนในแต่ละตัวเลือก
→ เลือก Variant สำหรับดูน้ำหนักต้นทุน
→ เลือกพิมพ์แต่ละ Variant เป็นเอกสารแยก
```

### New Branch Menu Setup

```text
เลือก Company/Brand/Branch
→ เลือก Menu Set
→ เพิ่ม/ตัด Menu Item
→ รวม Recipe Dependencies
→ ตรวจ Readiness
→ บันทึก/เผยแพร่แบบจำลอง
```

### Printing

```text
เลือกสูตร
→ เลือก A4/A5/Booklet
→ ตั้ง multiplier/status
→ Preview
→ Print หรือ Save PDF
```

## 7. Non-Functional Requirements

- Static HTML/CSS/JS และเปิดตรงจาก filesystem ได้
- Responsive desktop/mobile
- Keyboard-accessible controls และ semantic labels พื้นฐาน
- ไม่มี runtime network call
- ไม่มี database หรือ persistence
- ใช้ palette ที่คัดลอกจาก NNTN theme โดยไม่ import parent files
- User input ที่นำไป render ใน print/cost detail ต้อง escape

## 8. Explicitly Out of Scope

- Authentication/authorization
- Database/API/Supabase
- Supplier/price integration
- Production food-cost calculation, yield/waste และ Food Cost %
- Calibration workflow และการบันทึกผลชั่งจริง
- Approval engine, effective date, rollback และ audit log
- Branch override editor เต็มระบบ
- Import/export และ migration จากระบบเดิม
- Family Master แบบรวมสูตรแม่และ Variant ทั้งหมดในหน้าเดียว
- Branch Pack ที่เลือกสาขาแล้วสร้างชุดเอกสารอัตโนมัติ
- ฟีเจอร์ SKU, Routing, Print หรือ workflow เพิ่มเติมนอกเหนือจากที่มีใน Prototype Spec v1

## 9. MVP Acceptance Criteria

- เปิด `index.html` ได้โดยไม่ build/server
- Recipe Editor, Food Cost Preview, Print Center และ Branch Menu สาธิตได้ครบ
- สูตรกะเพราตัวอย่างสร้าง Variant หมูสับ เนื้อรวม และไก่ได้
- Variant เนื้อรวมเก็บและแสดงชิ้นส่วนอย่างน้อยสองรายการได้
- Food Cost Preview และ Print Center รวม base ingredients กับ Variant ingredients ถูกต้อง
- เมนูเดี่ยวไม่แสดง Variant editor และสร้าง SKU ตัวอย่างได้
- ตัวเลือกแบบร่างหรือปิดใช้งานไม่ปรากฏเป็นสูตรขายใน Print Center
- ตัวอย่างกะเพราแสดง 2 ตัวเลือกเปิดใช้งานและ 1 ตัวเลือกปิดใช้งาน
- SKU & Routing Sheet แสดง mapping แยกตามช่องทางได้
- Measurement Knowledge แยก measured/manufacturer/estimated/missing ชัดเจน
- Express preset เลือก 3 เมนูและรวม dependency ที่จำเป็น
- การเพิ่มเมนูเองเปลี่ยนสถานะเป็น Custom
- เปลี่ยนสาขาแล้ว profile/Menu Set/readiness เปลี่ยนตาม
- Print templates สร้างจำนวนหน้าถูกต้องตามสูตรที่เลือก
- ไม่มี console error และไม่มี external request
- Mobile 390px ไม่มี body horizontal overflow

## 10. Stop Condition

Prototype Spec v1 ถูกล็อกแล้วและถือว่าเสร็จสำหรับการรีวิว workflow ห้ามเพิ่ม feature, template, entity หรือ integration ต่อจากขอบเขตนี้โดยอัตโนมัติ งานรอบถัดไปทำได้เฉพาะแก้ defect ที่ทำให้ behavior ที่ล็อกไว้ทำงานไม่ถูกต้อง เว้นแต่ TINE สั่งปลดล็อกหรือเปิด version ใหม่โดยตรง
