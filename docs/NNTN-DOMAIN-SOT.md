# NNTN Domain SOT — เล่มความจริงเชิงธุรกิจ (เนื้อในตำนาน)

> สร้าง: 2026-07-08 08:44 ICT · v1.0
> เอกสารนี้ = source of truth ระดับ "โดเมนธุรกิจ" ของ NNTN — ตอบว่าธุรกิจมีหน่วยอะไร
> ขายทางไหน ผลิตยังไง กฎอะไรห้ามละเมิด และอะไรยังไม่ confirm
> ไม่ใช่ spec ระบบ ไม่ใช่ตารางราคาฉบับเต็ม (ของพวกนั้นมี pointer ชี้ไป)

---

## 1. Purpose & Ownership

**เอกสารนี้ตอบอะไร:** โครงสร้างธุรกิจ NNTN 4 แกน (Brand / Location-Kitchen / Channel / Menu) ·
ศัพท์กลาง · สถานะเมนู-ต้นทุน · กฎ mapping ช่องทางขาย · flow ผลิต · invariant ที่ระบบใหม่ทุกตัวต้องเคารพ ·
และรายการที่ "ยังไม่รู้" อย่างตรงไปตรงมา

| บทบาท | ใคร | หน้าที่ |
|---|---|---|
| **Owner** | ทีม NNTN | เจ้าของเนื้อหา · ความจริงเรื่องสูตร/ครัว เข้าผ่าน TINE เท่านั้น |
| **Coordinator** | Tine Jr. | เก็บข้อมูลจาก Discord → เสนอ → TINE เคาะ → ค่อยบันทึกเข้าเล่ม (ห้ามเขียนตรงก่อนเคาะ) |
| **Governance review** | CROO | ตรวจว่าอัปเดตมี date + ที่มา · ไม่มี field ที่เดา |

**กติกาอัปเดต:** ทุก fact ใหม่ต้องมี (วันที่ + ที่มา: path หรือ "TINE <วันที่>") ·
ขัดกันระหว่างแหล่ง → ใหม่ชนะเก่า และจดว่าแหล่งเก่าว่าไง · ไม่รู้ = ลง section 9 ห้ามแต่งให้เนียน

---

## 2. โครงสร้างธุรกิจ 4 แกน

**Invariant #1: Brand / Location-Kitchen / Channel / Menu แยกเป็นคนละ entity เสมอ** —
ห้ามยุบรวมหรือ hardcode ปนกันในระบบใดๆ (บทเรียนจริง: ระบบ stock เดิม hardcode รหัส VT/R9
ทำให้เปิดจุดขายใหม่ลำบาก — ดู section 8)

```
                    ┌────────────────────────────┐
                    │  ครัวกลาง WTS55            │  ← Location-Kitchen (ผลิต)
                    │  (วชิรธรรมสาธิต 55)        │  ผลิตซุป/เนื้อตุ๋น/วัตถุดิบ
                    └──────┬──────────┬──────────┘
             ส่งวัตถุดิบ/ผลิตในที่   │
        ┌──────────────────┼──────────────────────┐
        ▼                  ▼                      ▼
 ┌───────────────┐ ┌────────────────┐ ┌────────────────────────┐
 │ ① ร้านเนื้อ    │ │ ② ครัวเนื้อ     │ │ ③ ครัวเนื้อในตำนาน      │
 │ ในตำนาน       │ │ ในตำนาน        │ │ @ Glass Bangna         │
 │ @ Foodstock   │ │ (NT-KITCHEN)   │ │ (โปรเจกต์ FC29)        │
 │ พัฒนาการ 32   │ │ virtual brand  │ │ กำลังเปิด ~16 ส.ค. 2026 │
 │ dine-in +     │ │ delivery-only  │ │ dine-in + delivery     │
 │ delivery      │ │ เมนูข้าว สเต็ก  │ │                        │
 └───────────────┘ └────────────────┘ └────────────────────────┘
```

(ที่มา: TINE 2026-07-08 — ความจริงล่าสุด ชนะทุกแหล่ง)

- **หน่วยขาย ①** ร้านเนื้อในตำนาน @ Foodstock พัฒนาการ 32 — หน้าร้านก๋วยเตี๋ยว/portion
  (SOP portion อยู่ที่ `vault/workspace/inbox/sop-portion-system.md`)
- **หน่วยขาย ②** ครัวเนื้อในตำนาน = **virtual brand** — ไม่มีหน้าร้านจริง ขายผ่าน delivery เท่านั้น
  ผลิตในครัวกลางเดียวกัน · ใน FoodStory/DB ใช้ branch code **NT-KITCHEN**
  (ที่มา: `arra-oracle-v3/ψ/outbox/cookingbook-cost-bom-2026-07-07-v3.md` — "delivery only, ยืนยันโดย TINE")
- **หน่วยขาย ③** Glass Bangna — สาขา dine-in+delivery ใหม่ของแบรนด์ "ครัวเนื้อในตำนาน"
  เมนูชุดเดียวกับ NT-KITCHEN แต่ FC% อ้างราคา dine-in เป็นหลัก
- **หมายเหตุแหล่งเก่า:** nntn-bible (เม.ย. 2026) เล่าเป็น "ลูกค้า 2 กลุ่ม: หน้าร้าน NT + FoodStory batch" —
  ภาพ 3 หน่วยขาย + Glass ยังไม่มีตอนนั้น ใช้ bible เป็นโครง narrative ได้ แต่ตัวเลข/โครงสร้าง ณ เม.ย. ต้อง verify ก่อนใช้

---

## 3. Glossary — ศัพท์กลาง

### ศัพท์ธุรกิจ NNTN

| ศัพท์ | ความหมาย | ที่มา |
|---|---|---|
| **CW (Catch Weight)** | ตารางน้ำหนักจริงรายถุงของเนื้อตุ๋น — "CW = ความจริง" ไม่มี source อื่น override | nntn-bible.md |
| **FIFO** | ถุงผลิตก่อนออกก่อน — เป็นทั้ง accounting และ quality control | nntn-bible.md |
| **BOM** | Bill of Materials — สูตรวัตถุดิบต่อเมนู ใช้คำนวณต้นทุน/จาน | nntn-bible.md |
| **SP-xxx / RCP-xxx / SRCP-xxx / MT-xxx / PKG-xxx** | รหัสวัตถุดิบ / recipe / sub-recipe / เนื้อ portion / batch-pack ใน cookingbook | supabase-schema-cookingbook.md + BOM v3 |
| **overhead 1.15** | ตัวคูณ true cost บน bom_cost_raw → ต้นทุนรวม/จาน | BOM v3 2026-07-07 |
| **`ข้าว...` vs `...กับข้าว`** | prefix "ข้าว" = จานพร้อมข้าว (เนื้อ 75g + ข้าว 72g) · suffix "กับข้าว" = กับข้าวล้วน (เนื้อ 150g+ ไม่มีข้าว) — โปรตีนเดียวกัน = คนละ RCP | project_nntn-food-conventions.md |
| **portion มาตรฐาน** | เนื้อ default 75g · พิเศษ 100g · ข้าว 72g raw/180g สุก | project_nntn-food-conventions.md |
| **mode FoodStory** | ราคาขายที่พบบ่อยสุดใน 30 วันจากข้อมูล FoodStory — ใช้เป็นราคาอ้างอิงฝั่ง delivery | BOM v3 2026-07-07 |

### ศัพท์วงการ

| ศัพท์ | ความหมาย |
|---|---|
| **Virtual brand** | แบรนด์ที่มีตัวตนเฉพาะบนแพลตฟอร์ม delivery ไม่มีหน้าร้าน — ผลิตจากครัวที่มีอยู่แล้ว (= ครัวเนื้อในตำนาน/NT-KITCHEN) |
| **Central kitchen / commissary** | ครัวกลางผลิตรวมแล้วกระจายให้จุดขาย (= WTS55) |
| **Channel** | ช่องทางที่ order เข้ามา (dine-in POS / Grab / LINE MAN ฯลฯ) — คนละแกนกับ brand และ location |
| **PLU / menu mapping** | การ map รหัสเมนูใน POS/แพลตฟอร์ม ↔ เมนู canonical กลาง — จุดที่พังบ่อยสุดเมื่อชื่อ/โปรโมต่างกันต่อช่องทาง |
| **FC% (food cost)** | ต้นทุนวัตถุดิบ ÷ ราคาขาย × 100 — ตัวชี้กำไรขั้นต้นต่อจาน |

---

## 4. Menu & Costing — สถานะ ณ 2026-07-07

แหล่งตัวเลข (ไฟล์เต็ม — เล่มนี้สรุปเท่านั้น):
- **Menu SoT (Glass/FC29):** `~/tt3p/ghq/github.com/TTT3P/arra-oracle-v3/ψ/outbox/glass-bangna-menu-sot-v1.md`
- **BOM/cost (NT-KITCHEN):** `~/tt3p/ghq/github.com/TTT3P/arra-oracle-v3/ψ/outbox/cookingbook-cost-bom-2026-07-07-v3.md`
- ตัวเลขดึงสดจาก `cookingbook.recipe_costs` (Supabase `emjqulzikpxorvpaaiww`) หลัง data-fix patch 2026-07-07

**สรุปสถานะ:**

| เรื่อง | ตัวเลข |
|---|---|
| Menu SoT Glass v1 | รวม 44 รหัส = 24 เมนูมี BOM ครบ + 20 รหัสมีราคาแต่ยังไม่มี BOM ตรงตัว (variant พิเศษ/ไซส์กิวด้ง/ไม่มีข้าว) |
| BOM v3 (NT-KITCHEN) | 33 เมนูเดี่ยวขายจริง · ต้นทุนครบ 33/33 (0 gap) |
| FC% ที่ราคา mode delivery (NT-KITCHEN) | ช่วง ~1% (น้ำสมุนไพร) ถึง ~47% (ลูกชิ้นปิ้ง RCP-057) |
| FC% dine-in Glass ≥40% (🔴) | 12 เมนู: A1A, A2, A3, A4, A91MM, A12, D1S, E1, E2, E3, E4, E5 |
| FC% dine-in Glass 30–39% (🟡) | 5 เมนู: A5, A8, A13, B9, B10 |
| เมนูใหม่รอ TINE เคาะราคาหน้าร้าน | 9 รายการ (funnel #14) — RCP-070/039/027/017D/017E/011/069/071 + PKG-004 |

**Caveat ต้นทุนที่ต้องรู้ (จากทั้งสองไฟล์):**
- SP-206 พิคานย่าไทย มี `yield_pct=0.9` แต่ cost engine ไม่อ่านค่านี้ → ต้นทุนเมนูที่ใช้ SP-206/MT-020 ต่ำกว่าจริงเชิง yield
- RCP-069 มี sub-recipe ซ้อน 2 ชั้นที่ formula นับลึกแค่ 1 ชั้น (ผลกระทบเล็ก)
- PKG-004 เป็น batch 1000g — ตัวเลข ฿4.26 คือ "ต้นทุน/ถุง" (presentation choice ไม่แตะ DB)
- FC% แดงฝั่ง Glass เพราะอ้างราคา **dine-in** ซึ่งต่ำกว่า delivery — เมนูเดียวกันฝั่ง NT-KITCHEN (ราคา mode delivery) หลายตัว FC% ปกติ

---

## 5. Channel & Menu Mapping

### ช่องทางขายต่อหน่วย

| หน่วยขาย | dine-in | delivery | ระบบบันทึกขาย |
|---|---|---|---|
| ① ร้านเนื้อในตำนาน @ Foodstock | ✅ | ✅ | FoodStory POS (ที่มา: TINE 2026-07-08) |
| ② ครัวเนื้อในตำนาน (NT-KITCHEN) | ❌ (virtual) | ✅ เท่านั้น | FoodStory branch NT-KITCHEN |
| ③ Glass Bangna (เปิด ~16 ส.ค.) | ✅ | ✅ | (รอเปิด — ยังไม่มีข้อมูลจริง) |

- **ช่องทางที่มีจริง = FoodStory (POS หน้าร้าน) + Grab (delivery) เท่านั้น** — ไม่มี "NT main" / Wongnai แยก
  (ที่มา: `federation-kb/_from-croo-oracle/project_nntn-sales-channels.md` — TINE ยืนยัน)
- LINE MAN เข้ามาทาง FoodStory (report "ยอดเคลม LINE MAN") + email รายวัน — ไม่ต้องแยก portal
  (ที่มา: `ψ/memory/survey-foodstory-grab-rawdata-2026-07-04.md`)
- **FoodStory owner portal = master sales source เดียวที่สะอาด** — รวมทุกช่องทาง export CSV/Excel ได้ ·
  Grab Merchant portal = เสริม (history ~30 วันแล้วหายถาวร · GMFR/invoice ต้อง owner role) (ที่มา: survey 07-04)

### กฎราคาและ mapping

- **ราคา dine-in ≠ ราคา delivery เสมอ** — delivery มี markup (เช่น A2: dine-in ฿65 / delivery ฿95) ·
  ตัวคูณ delivery_markup 1.20 ปรากฏใน schema draft เม.ย. — ค่าจริงปัจจุบันยังไม่ verify (ดู section 9)
- ราคา delivery ใน menu SoT ส่วนใหญ่ตรงกับ mode FoodStory พอดี · มีข้อยกเว้นที่ mode ไม่ตรง
  (A1A/A3/A5/A8/Y1 — flag ไว้ในไฟล์ menu SoT แล้ว)
- POS-name → canonical mapping: "เนื้อตุ๋น"=สามชั้นตุ๋น · "เนื้อบด"=โคขุนสับ trim · "เนื้อนุ่ม"=หมักนุ่ม ·
  "ข้าวเปล่า/ข้าวสวย/ข้าวหอมมะลิ" = SP-072 เสมอ · โปรโมสตริง `[LINE MAN][ดีลเดือด]` = alias เข้า base RCP
  (ที่มา: `project_nntn-food-conventions.md`)

---

## 6. Production & Fulfillment

Flow ครัวกลาง → จุดขาย (โครงจาก nntn-bible เม.ย. 2026 — หลักการยังใช้ ตัวเลข/เครื่องมือ ณ เม.ย.):

```
ซัพพลายเออร์ส่งเนื้อสด → คลัง A (เนื้อสด)
  → ครัวกลางตุ๋น → คลัง B (เนื้อตุ๋น)
  → ชั่ง+แพ็คถุง → CW บันทึก (✅ In Stock) + คลัง C (พร้อมส่ง)
  → จุดขายสั่ง/ส่ง → CW → 🚚 Delivered
  → เงินเข้า → Revenue → FC% → Sales Ops
```

- ทุกถุงผ่าน CW · ทุกขั้นบันทึก — ขาดขั้นไหนตัวเลขปลายทางผิด · FIFO บังคับ
- Non-meat (ซอส/เครื่องปรุง/prep) flow เดียวกัน (รับเข้า→ผลิต→เก็บ→เบิก) แต่คนละเครื่องมือมาแต่แรก —
  bible ระบุ meat=Excel/non-meat=Supabase ณ เม.ย. · ตั้งแต่ 27/04/2026 Supabase เป็น SOT เดียว
  Excel เป็น read-only mirror (ที่มา: `product-hub/nntn/BLUEPRINT.md §0`)
- **SOP การประกอบเมนูอยู่ใน DB** `cookingbook.sop_steps` — ครบ **36/51 เมนู ณ 2026-07-07**
  (ที่มา: TINE 2026-07-08) · หน้า authoring/QC: `admin-sop.html` (7-state workflow) + `sop-review.html`
  (ที่มา: BLUEPRINT.md)
- SOP หน้าร้าน (portion ก๋วยเตี๋ยว S/M/L/XL, 12+2 ตัวเลือก) = `vault/workspace/inbox/sop-portion-system.md`
  (v1.1 LOCKED · launch 1 พ.ค. 2026)

---

## 7. Invariants & Business Rules

1. **4 แกนแยกกันเสมอ** — Brand / Location-Kitchen / Channel / Menu คนละ entity · ห้าม hardcode รหัสสาขา/แบรนด์ในโค้ดหรือ schema (ที่มา: มาตรฐานวงการ Deliverect/Otter · เสนอโดย CROO 2026-07-08 — โครง 3 หน่วยขายเป็นของ TINE 2026-07-08)
2. **ทุก order ต้อง resolve เป็น (brand, location, channel) เดียว** — ไม่มี order ลอยที่ไม่รู้ว่าขายจากหน่วยไหนทางไหน (ที่มา: มาตรฐานวงการ · เสนอโดย CROO 2026-07-08)
3. **ต้นทางสูตร/เมนู = ครัวผ่าน TINE เท่านั้น** — agent/เอกสารห้ามแต่งสูตร แก้ portion หรือเคาะราคาเอง (ที่มา: TINE 2026-07-08)
4. **ราคา delivery มี markup ต่างจาก dine-in** — ห้ามใช้ราคาเดียวข้าม channel · FC% ต้องระบุเสมอว่าอ้างราคา channel ไหน (ที่มา: menu SoT 07-07)
5. **CW = ความจริงของ stock เนื้อ** — ไม่มี source override · ถุงเดียวส่งสองที่ไม่ได้ (ที่มา: nntn-bible)
6. **Supabase = SOT ข้อมูล operational · ห้าม dual-write** — Excel คือ mirror (ที่มา: BLUEPRINT.md §0, effective 27/04/2026)
7. **ตัวเลขไม่มีหลักฐาน = tag "ไม่มีข้อมูล" ห้ามเดา** — convention เดียวกับ BOM v3 บังคับใช้ทั้งเล่มนี้
8. **ช่องทางขายใน report = FoodStory + Grab เท่านั้น** — ห้ามเติมช่องทางที่ไม่มีจริง (ที่มา: project_nntn-sales-channels.md)

---

## 8. Lifecycle Notes — เปิดสาขา/แบรนด์ใหม่ต้องแตะอะไร

บทเรียนจาก Glass Bangna (FC29):

| ต้องแตะ | รายละเอียด |
|---|---|
| Entity ใหม่ | ลงทะเบียน location (+brand ถ้าใหม่) เป็น entity แยก — **ห้ามโคลนโค้ด/hardcode รหัสเพิ่ม** |
| Menu + ราคา per channel | เมนูชุดไหนขาย · ราคา dine-in/delivery ต่อ location — ปัจจุบัน `selling_price` เป็น global ไม่แยก location (ดู section 9) |
| FC% ต่อ channel | Glass ขายหน้าร้าน → FC% อ้าง dine-in → เมนูที่ FC% ปกติฝั่ง delivery กลายเป็น 🔴 ได้ (12 เมนู) — ต้อง review ราคา/สูตรก่อนเปิด |
| POS/channel mapping | ตั้ง branch ใน FoodStory + map Grab/LINE MAN เข้า location ใหม่ |
| SOP + คน | sop_steps ครอบเมนูที่ขายจริง · train ครัวปลายทาง |
| Stock/ส่งของ | เส้นทางครัวกลาง WTS55 → location ใหม่ เข้า flow CW/delivery เดิม |

**อาการของการไม่แยก 4 แกน (ของจริง):** ระบบ stock เดิม hardcode รหัส **VT/R9** —
พอเปิดหน่วยขายใหม่ (Glass) ระบบรองรับไม่ได้ทันที — Wayne ประเมินให้แก้ hardcode เป็น P0 ของแผนเร่งเวป
(ที่มา: hardcode VT/R9 = TINE/Wayne 2026-07-07 · "rebuild บนโมเดล 4 แกน" = ข้อเสนอของเล่มนี้ ยังไม่ใช่ spec ที่เคาะ ·
mapping VT/R9 ↔ ร้านจริง ยังไม่ confirm — ดู section 9)

---

## 9. ⚠️ Unconfirmed / Open Questions

| # | เรื่อง | สถานะ | ใครปิดได้ |
|---|---|---|---|
| 1 | mapping รหัส **VT / R9 ↔ ร้านจริง** ในระบบ stock เดิม | ยังไม่ confirm — ห้าม assume ว่า VT=หน่วยไหน | TINE / ทีม NNTN |
| 2 | **ราคาต่อ location ไม่มีใน DB** — `selling_price` เป็น global ค่าเดียว ไม่แยก Glass/Foodstock/NT-KITCHEN | gap เชิง schema — Glass ต้องการราคา dine-in ของตัวเอง | ทีม dev (V2) + TINE เคาะราคา |
| 3 | **ค่าคอม/สัญญา Grab + FoodStory** — GP%, ค่าธรรมเนียม, เงื่อนไขสัญญา | ไม่มีเอกสารในมือ (Grab GMFR ต้อง owner role · เลข GP 32.1% ใน draft เม.ย. ยังไม่ verify) | TINE (owner login) |
| 4 | **เมนูใหม่ 9 รายการรอราคาหน้าร้าน** (funnel #14 — RCP-070/039/027/017D/017E/011/069/071, PKG-004) | มีต้นทุนแล้ว รอ TINE เคาะราคา dine-in | TINE |
| 5 | 20 รหัสใน menu SoT ที่ **ไม่มี BOM ตรงตัว** (variant พิเศษ X, ไซส์กิวด้ง A92–A96, B1–B3 ไม่มีข้าว, A1B ออส, A10/A11) | ต้นทุนไม่มีข้อมูล — D1 [4ไม้] มีแค่ตัวเลขประมาณ ห้ามใช้เป็นทางการ | ครัว+Platform เพิ่ม BOM |
| 6 | ตัวคูณ **delivery_markup / overhead / GP factor ปัจจุบัน** — เลข 1.20 / 1.15 / 0.679 มาจาก schema draft เม.ย. | 1.15 ยืนยันใช้จริงใน recipe_costs (07-07) · ตัวอื่นยังไม่ verify กับ DB จริง | ตรวจ `cookingbook.control_params` |
| 7 | ข้อมูลขาย/ช่องทางของ **Glass** | ยังไม่มี — ร้านยังไม่เปิด (~16 ส.ค. 2026) | หลังเปิด |
| 8 | ความสัมพันธ์ **WTS55 ↔ สาขา "วชิรธรรมสาธิต55" ใน FoodStory** — ชื่อพ้องกัน (survey 07-04 เห็น สาขา=วชิรธรรมสาธิต55) · evidence เพิ่ม: ทิศ FC29 จาก Tine Jr. 07-07 ปฏิบัติกับ "สาขาวชิรธรรมสาธิต55" = ครัวกลาง (ทะเบียนทิศ CROO 07-07 17:29) แต่ยังไม่ confirm ข้ามทุกระบบเป็นทางการ | มี evidence สนับสนุน · รอ confirm | TINE / Tine Jr. |

---

## 10. Decision Log + System Mapping

### Entity ↔ ระบบจริง

| Entity/ข้อมูล | ระบบ | สถานะ/กฎ |
|---|---|---|
| Stock + BOM + SOP + sales_ops (V1) | Supabase `emjqulzikpxorvpaaiww` (schemas: public, stock, cookingbook, sales_ops) | **LIVE = PROTECT** ห้ามแตะ prod โดยไม่ผ่าน gate (ที่มา: BLUEPRINT.md + TINE 2026-07-08) |
| ระบบ stock V2 | Supabase `nntn-stock-dev` (rebuild) + prod `nntn-stock-v2-anzk.vercel.app` — แผนแก้ hardcode VT/R9 อยู่ระหว่างรอ TINE เคาะ (build FREEZE) | กำลังทำ (ที่มา: ทะเบียนงาน CROO 2026-07-08) |
| ข้อมูลขายทุกช่องทาง | **FoodStory owner portal = master sales source** (รวม dine-in/Grab/LINE MAN · export CSV) | ที่มา: survey 07-04 |
| Web frontend (V1) | GitHub Pages `ttt3p.github.io/nntn` (repo `github.com/TTT3P/nntn`) | ที่มา: BLUEPRINT.md |
| Menu library (ราคาครัวกลาง) | `krua-menu-library.vercel.app` (Vercel prod) | ที่มา: menu SoT 07-07 |
| เอกสารโดเมน (เล่มนี้) | `product-hub/nntn/docs/NNTN-DOMAIN-SOT.md` | owner=NNTN · flow ผ่าน Tine Jr. |

### Decision Log

| วันที่ | ตัดสินใจ | โดย | หมายเหตุ |
|---|---|---|---|
| 2026-07-08 | สร้างเล่ม NNTN-DOMAIN-SOT · owner = ทีม NNTN · coordinator = Tine Jr. · governance review = CROO | TINE | entry แรก |

> เพิ่ม decision ใหม่: append แถวล่างสุด · timestamp ใช้ `TZ=Asia/Bangkok date` จริง ห้ามพิมพ์เอง

---

*v1.0 · 2026-07-08 08:44 ICT · ร่างโดย CROO subagent จาก 8 แหล่ง (ลำดับความน่าเชื่อ: TINE 07-08 > ไฟล์ 07-07 > survey 07-04 > SOP มิ.ย. > bible/schema เม.ย.) · review รอ CROO/TINE*
