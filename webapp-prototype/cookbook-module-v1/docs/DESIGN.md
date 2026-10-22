# Intelligent CookingBook Module V1 — Design

วันที่: 2026-08-04
สถานะ: Approved direction; written specification pending final user review

## 1. Summary

สร้าง CookingBook เป็นเว็บแอปแยกสำหรับงานครัวของ NNTN ก่อน โดยไม่แก้หรือพึ่งพาโค้ด frontend ของระบบ NNTN ที่ใช้งานอยู่ แอปใหม่ใช้ React, TypeScript และ Vite และยึดข้อมูลสูตรที่ตรวจจากต้นฉบับเป็นหลัก

V1 ต้องช่วยให้ผู้ใช้เห็นความสัมพันธ์ของเมนูขาย สูตรเตรียม และวัตถุดิบ แยกเอกสารตามจุดงาน เตรียมของ ครัวปรุง และจัดเสิร์ฟ แนบรูปหลายรูปกับแต่ละขั้นตอน และสร้างเอกสาร A5 สำหรับใช้งานจริง

ระบบนี้ใช้ในธุรกิจ NNTN ก่อน แต่โครงสร้างภายในต้องไม่ผูก business logic กับหน้าเว็บเดิมหรือ branding จนย้ายไปเป็นผลิตภัณฑ์ไม่ได้ V1 ยังเป็น single-organization application และไม่มี multi-tenant, billing หรือ AI ที่สร้างหรือแก้สูตรเอง

## 2. Product Position

CookingBook V1 เป็น vertical module ที่ทำงานได้ด้วยตัวเอง ไม่ใช่การ rewrite NNTN ทั้งระบบ

```text
NNTN frontend ปัจจุบัน
└── ใช้งานต่อ โดย CookingBook V1 ไม่ import โค้ดหรือ CSS จากระบบนี้

CookingBook Module V1
├── Recipe source review
├── Recipe graph and prepared components
├── Work-stage documents
├── Step-linked media
└── Print Center

Shared Supabase project — phase after prototype
└── Shared canonical ingredient IDs
```

การเชื่อมต่อระหว่างระบบจำกัดอยู่ที่ data contract เช่น `ingredient_id`, recipe identity, user identity และสิทธิ์ใน Supabase ไม่แชร์ component, global CSS, browser globals, `auth.js` หรือสูตรคำนวณจาก frontend เดิม

## 3. Goals

1. เก็บสูตรหน้าครัวโดยรักษาค่าและหน่วยจากแหล่งต้นฉบับ ห้ามแปลงช้อนชา ช้อนโต๊ะ กรัม หรือมิลลิลิตรโดยไม่มีหลักฐาน
2. แยก sellable menu, prepared recipe และ direct ingredient ออกจากกัน
3. แสดง dependency ของเมนูลงไปถึงซอส น้ำซุป เครื่องปรุง และของเตรียม โดยไม่พิมพ์สูตรประกอบซ้ำโดยไม่จำเป็น
4. สร้างเอกสารเฉพาะจุดงาน: ผลิตซอสและของเตรียม, ครัวปรุง/BOM และจัดเสิร์ฟหน้าร้าน
5. รองรับรูปหลายรูปเรียงตามขั้นตอน รวมถึงขนาดหั่น สี ความสุก ความข้น และตำแหน่งจัดเสิร์ฟ
6. ทยอยเติมรูปได้ สูตรที่ยังไม่มีรูปยังดูและพิมพ์ได้
7. พิมพ์ A5 แนวนอนเป็นค่าเริ่มต้น และจัดสองใบลง A4 ได้
8. ทำให้ revision, provenance, blocker และสถานะตรวจสอบมองเห็นได้
9. เตรียม boundary สำหรับเชื่อม Supabase และ ingredient master เดิม โดย prototype ไม่เขียน production

## 4. Non-goals for V1

- ไม่ rewrite หรือ refactor frontend NNTN ที่ใช้งานอยู่
- ไม่ทำ stock, purchasing, production dispense, sales, POS หรือ delivery routing
- ไม่ทำ Food Cost engine ตัวจริง แม้จะรักษาจุดเชื่อมกับ normalized costing data
- ไม่ทำ Supabase production migration, bucket หรือ RLS ใน prototype phase
- ไม่ทำ Google Sheet เป็น operational source of truth
- ไม่ทำ multi-tenant, subscription, billing หรือ marketplace
- ไม่ให้ AI เดาปริมาณ หน่วย conversion วิธีทำ หรือผลผลิต
- ไม่ทำ direct printer hardware integration

## 5. Technology and Isolation

### 5.1 Frontend target

- React
- TypeScript
- Vite
- Static deployment compatible with GitHub Pages
- Hash-based client routing for the first hosted version to avoid server rewrite requirements

### 5.2 Repository boundary

แอปจริงควรเริ่มใน repository แยกชื่อ `nntn-cookbook` เพื่อไม่ให้ build pipeline หรือ dependency ของแอปใหม่กระทบ NNTN ที่ใช้งานอยู่ Prototype ปัจจุบันใน worktree เป็น behavioral reference และ source-data staging area ไม่ใช่ตำแหน่งถาวรของ production application

### 5.3 Internal-first, product-ready boundary

V1 ใช้ organization เดียวคือ NNTN แต่:

- branding อยู่ใน configuration ไม่ฝังใน domain logic;
- recipe, work stage, media และ print model ใช้ชื่อทั่วไป;
- Supabase access อยู่หลัง repository interface;
- business rules เขียนเป็น pure functions ที่ทดสอบแยกจาก UI ได้;
- ไม่มี tenant abstraction ที่ยังไม่ได้ใช้งาน

## 6. Domain Model

### `IngredientRef`

อ้างวัตถุดิบ canonical ด้วย `ingredient_id` และชื่อสำหรับแสดงผล Prototype ใช้ fixture ID เดิม เมื่อเชื่อม Supabase ต้องชี้ไปยัง ingredient master เดียวกับ NNTN ห้ามสร้างรายการซ้ำเพราะชื่อสะกดต่างกัน

### `Recipe`

ตัวตนถาวรของเมนูหรือสูตรเตรียม มีชนิด `sellable_menu` หรือ `prepared_recipe`

### `RecipeVersion`

snapshot ของสูตร ณ revision หนึ่ง เก็บ:

- source locators;
- ingredient/component lines;
- source quantity text และ unit;
- method steps;
- yield เมื่อมีหลักฐาน;
- blockers;
- review and approval state.

### `RecipeComponentLine`

หนึ่งบรรทัดต้องอ้างอย่างใดอย่างหนึ่ง:

- direct ingredient ผ่าน `ingredient_id`; หรือ
- prepared recipe ผ่าน `component_recipe_id`.

ค่าหน้าครัวเก็บเป็น source value/text/unit แยกจาก derived normalized value สำหรับ costing ในอนาคต Derived value ห้ามเขียนทับค่าหน้าครัว

### `WorkDocument`

projection ของ RecipeVersion สำหรับจุดงานหนึ่ง:

- `prep` — ผลิตซอสและของเตรียม;
- `cook` — ครัวปรุง/BOM;
- `service` — จัดเสิร์ฟหน้าร้าน.

WorkDocument อ้าง step และ ingredient line เดิม ไม่ทำสำเนาสูตรอีกชุด

### `WorkStep`

ขั้นตอนเรียงลำดับที่มี `step_id` คงที่ภายในสาย revision และมี:

- instruction text;
- stage;
- optional visual checkpoint description;
- optional serving variant or vessel;
- ordered media links.

### `MediaAsset`

รายการรูปกลาง ประกอบด้วย:

- media identity and file URL/path;
- caption and alt text;
- source, capture date and optional author;
- review state;
- crop/focal-point metadata;
- optional measurement annotation.

### `StepMedia`

ความสัมพันธ์ระหว่างรูปกับขั้นตอน ระบุ:

- `step_id`;
- display order;
- role: `before`, `during`, `checkpoint`, `final`;
- optional vessel: `plate`, `delivery_box`, `cup_1oz` หรือค่าที่กำหนด;
- review-needed flag เมื่อความหมายของขั้นตอนเปลี่ยน

รูปหนึ่งใบเชื่อมได้หลายขั้นตอนโดยไม่ต้องเก็บไฟล์ซ้ำ

## 7. Image Workflow

### 7.1 Authoring flow

```text
เลือกรูป
→ ครอปหรือหมุน
→ ใส่คำอธิบาย ขนาด หรือจุดตรวจ
→ เลือกจุดงานและขั้นตอน
→ เลือกชนิดรูปและภาชนะเมื่อเกี่ยวข้อง
→ เรียงลำดับ
→ ดูตัวอย่างเอกสาร
```

### 7.2 Progressive completion

รูปเป็น optional ใน V1 เพราะต้องทยอยถ่ายจากหน้างาน:

- หน้า editor แสดง `เพิ่มรูปภายหลัง`;
- หน้า print ไม่แสดงกรอบว่าง;
- การไม่มีรูปไม่เปลี่ยนสูตรเป็น draft และไม่ขวางการพิมพ์;
- ระบบกรองรายการ `ยังไม่มีรูป` และ `รูปควรตรวจใหม่` ได้;
- รูปที่มีอยู่แสดงคู่กับขั้นตอนตามลำดับ.

### 7.3 Visual checkpoints by stage

- Prep: ขนาดหั่น รูปร่างก่อน/หลังเตรียม ความข้น สี และผลลัพธ์ batch
- Cook: สี ระดับความสุก เนื้อสัมผัส หรือสภาพปลายทางเฉพาะขั้นที่ข้อความอธิบายยาก
- Service: ภาพพร้อมเสิร์ฟแยกตามจาน กล่องเดลิเวอรี และภาชนะเสริม

### 7.4 Revision behavior

ถ้า instruction เปลี่ยนข้อความแต่ความหมายเดิมและ `step_id` เดิม รูปยังตาม revision ได้ ถ้าขั้นตอนเปลี่ยนความหมาย แยก รวม หรือลำดับที่ทำให้ภาพอาจไม่ตรง ระบบเก็บรูปไว้แต่ขึ้น `รูปควรตรวจใหม่` และไม่รับรองอัตโนมัติ

## 8. Workflows and Screens

### Recipe Library

ค้นด้วยชื่อเมนู ไม่บังคับให้จำรหัส กรองตามชนิด จุดงาน blocker วิธีทำ และความครบของรูป

### Recipe Detail and Graph

แสดงเมนูหลัก สูตรประกอบ และวัตถุดิบเป็นต้นไม้ ผู้ใช้เปิดลงไปดูซอส น้ำซุป หรือของเตรียมได้โดยไม่หลงว่าเป็น ingredient ธรรมดา

### Source Review

เทียบลายมือ, DOCX, V2 และรายการจากเว็บเดิม โดยค่าจากลายมือใหม่เป็นหลักเมื่อมีการแก้ ผู้ใช้เห็น provenance และ unresolved items เป็นชื่อเมนู ไม่ต้องไล่หารหัส

#### Operator fill-surface contract

ผู้ใช้หลักคือเจ้าของร้านที่ถามข้อมูลจากทีมครัวแล้วกรอกคำตอบ ไม่ใช่นักบัญชีหรือผู้ดูแล schema หน้าหลักจึงต้องสื่อสารด้วยคำถามจากงานจริงและไม่แสดงชื่อ field ภายใน เช่น `owner_confirmation`, `serving_note`, `cost_basis_text`, provenance หรือ decision status เป็นภาษาหลัก

- ต่อวัตถุดิบมีคำถามหลักเดียว: `ทีมครัวใช้เท่าไร?`
- แสดงตัวอย่างคำตอบที่รักษาหน่วยครัว เช่น `30 กรัมต่อจาน`, `1 ทัพพี`, `ครึ่งช้อนโต๊ะ`
- แสดงค่าปัจจุบันแบบอ่านง่ายว่า `ตอนนี้ใช้: …` แทน `candidate_text` หรือ `ค่าที่ใช้แสดง`
- ข้อมูลต้นทาง สถานะเชิงเทคนิค ปริมาณตอนเสิร์ฟ และปริมาณสำหรับคิดต้นทุนอยู่ใน `ตัวเลือกเพิ่มเติม` ซึ่งปิดเป็นค่าเริ่มต้น
- ช่องเพิ่มเติมต้องระบุว่าไม่บังคับและอธิบายว่าใช้เมื่อใด ห้ามให้ผู้ใช้เข้าใจว่าต้องกรอกครบทุกช่อง
- ข้อความผิดพลาดบอกสิ่งที่ต้องทำต่อ เช่น `กรอกปริมาณที่ทีมครัวใช้ก่อน` ไม่ใช้ศัพท์ provenance หรือ validation
- การซ่อนข้อมูลเป็น presentation เท่านั้น V5 raw-document mapping, readiness, blocker history และ validation contract ต้องคงเดิม

หลักวัดความสำเร็จ: ผู้ใช้ที่ไม่รู้จัก schema ต้องสามารถเลือกสูตร เห็นวัตถุดิบ และกรอกปริมาณหลักได้โดยไม่ต้องอ่านคู่มือหรือถามความหมายของชื่อช่อง

#### Operator worksheet visual contract

หน้า Recipe Studio เป็นสมุดกรอกสูตรสำหรับเจ้าของร้านที่นั่งกรอกข้อมูลจากคำตอบของทีมครัว งานหลักมีลำดับเดียว: เลือกสูตร → กรอกปริมาณหรือวิธีทำที่ขาด → บันทึกฉบับร่าง V5

- หัวหน้ากระชับและสรุปตัวเลขจากไฟล์ในบรรทัดเดียว ห้ามใช้ metric-card grid หรือ hero-stat layout
- desktop ใช้รายชื่อสูตรกว้าง 256px และ editor แบบ fluid ซึ่งจำกัดความยาวเนื้อหาไว้ประมาณ 768px; ห้ามยืดช่องกรอกตามความกว้างจอ
- ใช้ surface หลักเพียงชั้นเดียว แบ่งรายการด้วย spacing และเส้นคั่น ห้ามทำ card ซ้อน card
- ไม่ใช้ eyebrow ตัวพิมพ์ใหญ่, หมายเลข `01/02` เชิงตกแต่ง, แถบสีด้านข้างรายการที่เลือก, glass blur หรือสีครีมเป็นพื้นหลัง
- ลำดับสายตาต่อวัตถุดิบคือชื่อวัตถุดิบ → ค่าปัจจุบัน → คำถามและช่องกรอก → ตัวเลือกเพิ่มเติม
- รายการที่เลือกใช้ full border/background state; สถานะต้องมีข้อความกำกับและไม่พึ่งสีอย่างเดียว
- ใช้ spacing scale `4, 8, 12, 16, 24, 32`, radius `8, 16`, input สูงอย่างน้อย 48px และสีเทาอมเย็นแทน neutral สีครีม
- mobile ประมาณ 400px วางรายชื่อสูตรเหนือ editor, รักษาช่องกรอกและปุ่มหลักเต็มความกว้าง และเลื่อนข้อมูลเทคนิคไปหลัง disclosure
- มี primary action เดียวคือ `บันทึกฉบับร่าง V5`; action อื่นต้องเบากว่าและไม่แข่งขันกับปุ่มบันทึก

การจัดวางนี้เป็น presentation contract เท่านั้น ห้ามเปลี่ยน raw-document persistence, edit payload, readiness predicate, blocker history, optimistic concurrency หรือ V4 checksum gate

#### NNTN Kitchen Ledger aesthetic contract

ชั้นภาพของ Recipe Studio ใช้แนว “แฟ้มสูตรครัว NNTN” เพื่อให้หน้ากรอกข้อมูลมีเอกลักษณ์ของร้านโดยไม่เปลี่ยนกลับเป็น dashboard หรือเพิ่มองค์ประกอบที่แข่งขันกับงานกรอก

- เก็บ layout และลำดับงานของ operator worksheet เดิมทั้งหมด
- ใช้หัวสูตรสีเขียวเข้มแบบปกแฟ้มเป็น visual signature เพียงจุดเดียว พร้อมเส้นทองเหลืองแบบจำกัด
- ชื่อสูตรเป็นจุดเด่นที่สุดใน editor; ประเภทสูตร revision และสถานะเป็น metadata รอง
- รายชื่อสูตรใช้พื้นเทาอมเขียว และรายการที่เลือกใช้พื้นเขียวอ่อนพร้อมกรอบเต็ม ไม่ใช้แถบสีด้านข้าง
- section heading ใช้เส้นคั่นแบบ ledger และช่องกรอกใช้กรอบคมชัดขึ้น แต่ไม่เพิ่ม card ต่อวัตถุดิบ
- สีทองเหลืองใช้เฉพาะเส้นหัวแฟ้ม focus detail หรือ metadata สำคัญ ไม่ใช้เป็นพื้นหลักหรือกระจายทั่วหน้า
- ใช้ฟอนต์ระบบที่รองรับภาษาไทยเป็นหลัก ห้ามเพิ่ม web-font dependency ใน local pilot
- motion, gradient text, glass effect, metric cards, nested cards และพื้นครีมยังเป็นข้อห้ามเดิม

ความสวยงามรอบนี้เป็น presentation-only เช่นกัน ห้ามเปลี่ยน V5 persistence/readiness/validation หรือข้อมูลต้นทาง

### Work-stage Editor

แก้และดู projection แยก Prep, Cook และ Service โดยข้อมูลยังมาจาก RecipeVersion เดียว

### Step Media Editor

แนบ เลือก เรียง และระบุชนิดรูปต่อขั้นตอน มี preview อัตราส่วนที่ใกล้การพิมพ์จริง

### Print Center

เลือกเมนู จุดงาน template batch multiplier และ revision status แล้วดู preview ก่อนพิมพ์

## 9. Printing Rules

### Default template

A5 landscape เป็นเอกสารหลักของจุดงาน A4 portrait two-up วาง A5 สองใบพร้อมเส้นตัด

### Step-photo layout

ใช้ layout ที่ผู้ใช้เลือกแบบ A:

- รูปอยู่คู่กับ instruction ของขั้นตอน;
- หนึ่งหน้าแสดงประมาณ 3–4 visual steps ตามความยาวจริง;
- เรียงซ้ายไปขวา บนลงล่างตามลำดับทำงาน;
- รูปมีเลขขั้น ชนิดรูป คำอธิบาย และ measurement annotation เมื่อมี;
- content เกินพื้นที่สร้าง continuation page ห้ามตัดหรือย่อจนอ่านไม่ได้;
- เมื่อขั้นใดไม่มีรูป layout คืนพื้นที่ให้ข้อความ;
- service image แยกตาม vessel และระบุให้ชัดว่าเป็นจานหรือกล่องใด.

### Shared dependency rule

การพิมพ์ complete pack เรียง Prep → Cook → Service และพิมพ์ prepared dependency เดียวเพียงครั้งเดียว เว้นแต่ผู้ใช้เลือกพิมพ์ซ้ำอย่างชัดเจน

### Draft rule

Blocker ของสูตรและวิธีทำยังคงสร้าง `DRAFT — ข้อมูลไม่ครบ` ตามกฎเดิม แต่การขาดรูปเพียงอย่างเดียวไม่สร้าง draft

## 10. Prototype Data and Persistence

Prototype ใช้ข้อมูล versioned ใน repository และ local sample assets เพื่อพิสูจน์ UI, graph, media ordering และ print layout:

- ไม่มี Supabase write;
- ไม่มี production upload;
- file picker อาจใช้ preview เพื่อทดสอบ interaction แต่ไม่อ้างว่าบันทึกข้ามอุปกรณ์;
- reload คืนสู่ fixture ที่ versioned ไว้;
- UI ต้องแสดง `Prototype · ข้อมูลจำลอง/เฉพาะเครื่อง` อย่างชัดเจน;
- source recipe fixtures และ sample media manifest ต้อง export/import ได้เป็นไฟล์มาตรฐานที่ส่งต่อให้ Supabase migration ภายหลังได้

เมื่อเปิด persistence phase ให้แทนที่ prototype repository adapter ด้วย Supabase adapter โดยไม่เปลี่ยน domain model หรือ print functions

## 11. Future Supabase Contract

Production NNTN และ CookingBook ใช้ Supabase project เดียวกันได้ แต่ frontend แยกกัน

แนว schema เป้าหมาย:

```text
cookingbook.ingredients       shared canonical ingredient master
cookingbook.recipes           costing/BOM identity where already canonical
kitchen.recipe_versions       kitchen source and revision records
kitchen.recipe_lines          kitchen quantities and component links
kitchen.work_steps            ordered stage steps
kitchen.media                 media metadata
kitchen.step_media            step/media relationships
storage bucket: kitchen-media image binaries
```

การสร้าง schema, migration, RLS และ bucket ไม่อยู่ใน prototype scope ต้อง review กับ owner ของ Supabase ก่อน production mutation

## 12. Intelligent Behavior in V1

คำว่า intelligent ใน V1 หมายถึง rule-based assistance ที่ตรวจสอบได้:

- สร้าง dependency-first print pack;
- แยก projection ตามจุดงานอัตโนมัติ;
- แนะนำ A5 template;
- pagination โดยไม่ตัดเนื้อหา;
- ตรวจ missing method, quantity/unit, source conflict และ photo coverage;
- เตือนรูปที่อาจไม่ตรงหลัง revision;
- รักษา no-guess conversion rule.

V1 ไม่มี generative AI ที่แก้สูตรหรือสร้าง conversion เอง Future AI อาจช่วยร่าง caption, tag รูป หรือสรุป gap ได้ แต่ผลลัพธ์ต้องผ่านคนก่อนเป็น SOT

## 13. Error and Safety Behavior

- Missing image: render text-only and record a non-blocking media gap
- Broken image path: show a clear placeholder in preview; print omits the broken image and retains caption/error marker in draft mode
- Missing recipe dependency: block approved printing and name the missing recipe
- Dependency cycle: block bundle generation and show the cycle by recipe name
- Missing source quantity/unit: never infer; show unresolved state
- Supabase unavailable in future phase: preserve unsaved local form state and do not claim save success
- Upload failure in future phase: keep selected file locally until retry or explicit discard

## 14. Testing and Acceptance

### Unit tests

- ingredient/component distinction;
- dependency ordering and deduplication;
- work-stage projection;
- step media ordering and reuse;
- optional missing media behavior;
- revision media review flag;
- A5 and two-up page planning;
- pagination with mixed photo and text steps;
- no unit conversion side effects.

### Browser tests

- recipe search and graph navigation;
- stage switching;
- media attachment preview and reordering;
- no blank image space when media is missing;
- plate/delivery/cup variants;
- A5 and A4 two-up print preview at desktop and narrow widths;
- clean console and local-only network boundary in prototype.

### Acceptance scenarios

1. ผู้ใช้เปิดเมนูข้าวหน้าเนื้อตุ๋นและเห็น prepared dependencies โดยชื่อ
2. Service document แสดงข้าวหอมมะลิหุงสุก 180 กรัม และไม่แสดง raw cost basis 72 กรัม
3. ขั้นตอนที่มีสามรูปแสดงตามลำดับพร้อม caption บน A5
4. ขั้นตอนที่ไม่มีรูปยังพิมพ์ได้โดยไม่มีกรอบว่าง
5. ภาพจัดเสิร์ฟจานและกล่องเดลิเวอรีแยกกันได้
6. complete pack เรียง Prep → Cook → Service และไม่พิมพ์สูตรเตรียมซ้ำ
7. สูตรที่ขาดวิธีทำยังเป็น draft แต่สูตรที่ขาดเฉพาะรูปไม่เป็น draft
8. ไม่มี request ไป production Supabase จาก prototype

## 15. Delivery Sequence

1. Preserve the current static prototype as reference and fixture source
2. Scaffold isolated React/TypeScript/Vite application
3. Port domain models and existing tested pure transformations
4. Build Recipe Library and Recipe Graph
5. Build work-stage views
6. Add step-linked sample media and media editor interaction
7. Port Print Center with photo-aware pagination
8. Add tests and browser verification
9. Prepare a separate Supabase implementation brief and migration plan

## 16. Success Condition

CookingBook Module V1 succeeds when NNTN can review the first recipe set, understand every prepared dependency, see source kitchen units without conversion, attach or preview ordered step images, and print practical A5 documents for Prep, Cook and Service — while the current operational NNTN frontend and production Supabase remain untouched.
