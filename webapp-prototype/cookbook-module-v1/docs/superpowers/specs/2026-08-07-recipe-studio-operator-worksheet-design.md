# Recipe Studio Operator Worksheet Design

วันที่: 2026-08-07
สถานะ: Approved by TINE

## Problem

Recipe Studio ปัจจุบันเปลี่ยนข้อความเป็นภาษาคนแล้ว แต่โครงสร้างยังเป็น dashboard ที่มี metric cards, card ซ้อนหลายชั้น, หมายเลขขั้นเชิงตกแต่ง และ editor กว้างเต็มจอ ทำให้คำถามหลักยังไม่เด่นและหน้าดูเหมือน prototype ที่สร้างจาก template

## User and physical context

- ผู้ใช้หลัก: เจ้าของร้านที่นั่งหน้า desktop และกรอกคำตอบที่ถามจากทีมครัว
- งานหลัก: เลือกสูตร กรอกข้อมูลที่ขาด แล้วบันทึกฉบับร่าง V5
- ข้อมูลจริง: 18 สูตร พร้อมรายการวัตถุดิบ วิธีทำ blocker และข้อความต้นทางที่ยาวไม่สม่ำเสมอ
- mobile: ใช้ตรวจหรือกรอกสั้น ๆ ด้วยจอประมาณ 400px; task-critical input และปุ่มบันทึกต้องเข้าถึงได้โดยไม่ซูม

## Design direction

ใช้โครงสร้าง “สมุดกรอกสูตร” ที่เป็น operational worksheet ไม่ใช่ dashboard:

```text
กรอกสูตรจากทีมครัว
18 สูตร · 4 เมนูขาย + 14 สูตรประกอบ · รอข้อมูล 16 รายการ · 13 ตัวขวาง

┌ รายชื่อสูตร 256px ┐  ┌ editor fluid, content max 768px ┐
│ ค้นหา / กรอง      │  │ ชื่อสูตร · สถานะ                │
│ สูตร A             │  │                                 │
│ สูตร B             │  │ วัตถุดิบ                        │
│ สูตร C             │  │ ตอนนี้ใช้ …                     │
│                    │  │ ทีมครัวใช้เท่าไร? [________]    │
│                    │  │ ▸ ตัวเลือกเพิ่มเติม              │
│                    │  │                                 │
│                    │  │ วิธีทำและผลผลิต                  │
└────────────────────┘  │                   [บันทึก V5]   │
                        └─────────────────────────────────┘
```

## Hierarchy

1. Primary: ช่องคำตอบหลักและปุ่ม `บันทึกฉบับร่าง V5`
2. Secondary: ชื่อสูตร ชื่อวัตถุดิบ ค่าปัจจุบัน วิธีทำ และ blocker ที่ยังเปิด
3. Tertiary: revision, source evidence, decision status, serving note และ cost basis

ตัวเลขสรุปเป็นข้อความบรรทัดเดียว ไม่เป็นกล่องตัวเลขสี่ใบ สีช่วยเสริม hierarchy แต่ไม่เปลี่ยนลำดับที่ทำงานได้ใน grayscale

## Layout and components

- page width สูงสุด 1120px; workspace เป็น surface หลักชั้นเดียว
- queue กว้าง 256px แยกจาก editor ด้วยเส้นคั่น ไม่ครอบแต่ละรายการด้วย card
- editor content จำกัดที่ 768px และชิดจุดเริ่มต้นของพื้นที่ ไม่ยืดตาม viewport
- ingredient fieldset ไม่มีกรอบ card; ใช้ระยะ 24px และเส้นคั่นระหว่างรายการ
- primary quantity input กว้างไม่เกิน 512px และสูง 48px
- optional details ใช้ cool inset well ไม่มี border ซ้อนหลายชั้น
- selected queue row ใช้ background และ full outline ไม่มี side stripe
- save bar เป็นพื้นขาวทึบ ไม่มี backdrop blur

## Visual system

- Color strategy: restrained, neutral cool surfaces + NNTN green accent
- Page: cool off-white, ไม่ใช้ cream/sand/beige
- Text: dark primary, cool grey secondary, lighter cool grey tertiary
- Spacing: `4, 8, 12, 16, 24, 32`
- Radius: `8, 16`
- Input height: `48px`
- Shadow: ใช้เฉพาะ workspace elevation หนึ่งระดับ; ไม่มี shadow ต่อ ingredient row

### Approved aesthetic direction: NNTN Kitchen Ledger

หลัง UX ผ่าน ผู้ใช้เลือกแนว `NNTN Kitchen Ledger` เพื่อยกระดับความสวยงามโดยไม่เปลี่ยน interaction:

- editor มีหัวแฟ้มสีเขียวเข้มเต็มความกว้าง เป็น visual signature หลักเพียงจุดเดียว
- เส้นทองเหลืองใช้จำกัดที่ขอบหัวแฟ้มและ focus detail ไม่ใช้สร้าง card หรือ decoration หลายจุด
- ชื่อสูตรเด่นกว่า revision/type/status อย่างชัดเจน
- queue ใช้พื้นเทาอมเขียวและ selected state แบบ full border/background
- ingredient rows ยังคง flat; ใช้ typography, spacing, ledger rule และ input treatment สร้างจังหวะแทน nested cards
- ฟอนต์ต้องรองรับภาษาไทยจาก system stack และไม่เพิ่ม dependency

## Copy

- Title: `กรอกสูตรจากทีมครัว`
- Queue heading: `เลือกสูตร`
- Main question: `ทีมครัวใช้ {ชื่อวัตถุดิบ} เท่าไร? (ต้องกรอก)`
- Current value: `ตอนนี้ใช้: …`
- Optional disclosure: `ตัวเลือกเพิ่มเติม (ไม่บังคับ)`
- ห้ามใช้ field/schema vocabulary เป็นภาษาหลัก

## Responsive behavior

- ที่ ≤ 800px queue และ editor stack เป็นหนึ่งคอลัมน์
- ที่ ≤ 480px page gutter 12px, filters stack, inputs และ save button เต็มความกว้าง
- status และความหมายยังต้องอ่านได้โดยไม่อาศัยสี

## Non-goals and invariants

- ไม่ redesign Print Center, Work stages, method semantics หรือ blocker semantics
- ไม่เพิ่ม dependency หรือ motion
- ไม่แก้ V5 edit payload, raw document, validation, readiness, concurrency หรือ middleware
- ไม่แตะ Stock V1/V2, auth, Supabase, production data หรือ deployment
- V4 ต้องคง checksum เดิมและ real V5 draft ต้องไม่ถูกสร้างระหว่าง verification

## Acceptance

1. หน้าไม่มี metric-card summary, decorative `01`, uppercase eyebrow หรือ nested ingredient cards
2. ผู้ใช้เห็นชื่อสูตร ค่าปัจจุบัน คำถามหลัก และช่องกรอกตามลำดับเดียว
3. source/serving/cost fields ยังอยู่และเปิดได้จาก disclosure แต่ไม่แข่งขันกับคำถามหลัก
4. queue เลือกสูตรและกรอง 18 สูตรได้เหมือนเดิม
5. payload และ persistence regression เดิมผ่านทั้งหมด
6. 400px layout ไม่มี horizontal overflow จาก recipe name, revision หรือ raw source text
7. editor อ่านเป็นแฟ้มสูตรของ NNTN จากหัวสูตรสีเขียวเข้มและ metadata hierarchy โดยไม่มี hero metrics หรือ card ซ้อน
8. visual polish ไม่เปลี่ยนข้อความคำถาม payload จำนวนสูตร readiness หรือ persistence behavior
