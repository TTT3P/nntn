# CookingBook V1 — Data Readiness and Web Comparison Rules

## Status in one sentence

Bundle นี้รวบรวมและเรียบเรียง **โครงระบบกับข้อมูลชุดแรก** เสร็จแล้ว แต่ยังไม่ใช่เอกสารครัวทั้งหมดที่เจ้าของอนุมัติเป็น Final SOT

## Current first-set scope

- สูตรรวม 18 สูตร
- เมนูขาย 4 สูตร
- สูตรเตรียม/ซอส/ข้าว/ของประกอบ 14 สูตร
- ไม่มี blocker 6 สูตร
- มี blocker ที่ต้องตรวจต่อ 12 สูตร
- รายการส่วนผสม 126 รายการ: confirmed 45, confirmed by owner 39, confirmed from DOCX 13, confirmed from handwriting 13, conflict 7, needs review 8, removed by handwriting 1

คำว่า `reviewed_candidate` หมายถึงข้อมูลถูกเรียบเรียงเป็น candidate สำหรับตรวจแล้ว ไม่ได้แปลว่าอนุมัติ Final ทุกบรรทัด

## Why the current website can look different

เว็บ NNTN เดิมเน้น food cost และ consumer หลายจุดใช้ค่า `qty_g` จึงมีตัวเลขที่ถูก normalize เป็นกรัม ขณะที่ CookingBook หน้าครัวต้องรักษาหน่วยและข้อความต้นฉบับ เช่น ช้อนชา ช้อนโต๊ะ กรัม และ ml โดยไม่แปลงหรือเดา

ตัวอย่างสำคัญ:

- ข้าวดิบ 72 กรัม = cost basis เดิม
- ข้าวหุงสุก 180 กรัม = ปริมาณจัดเสิร์ฟหน้าร้าน

สองค่านี้อธิบายคนละขั้นของงาน จึงไม่ใช่ข้อมูลที่ควรเอามาทับกัน

## Comparison rules

เมื่อเทียบกับเว็บเดิม:

1. ห้ามเทียบ `qty_g` กับ `candidate_text` แล้วสรุปว่าอันใดอันหนึ่งผิดโดยอัตโนมัติ
2. แยกอย่างน้อยสามความหมาย: `cost_basis`, `kitchen_source_quantity`, `service_portion`
3. ค่าในเว็บเดิมเก็บเป็น legacy/cost evidence จนกว่าจะมี owner decision; ห้ามใช้เขียนทับหน่วยหน้าครัว
4. ใช้ `recipe_name` และ dependency type แยกเมนูขาย, สูตรเตรียม และวัตถุดิบโดยตรง; ห้ามจับคู่ด้วยชื่อบรรทัดอย่างเดียว
5. `conflict`, `needs_review`, `missing_method`, `missing_source` ต้องแสดงเป็นคิวตรวจ ไม่ส่งเป็นสูตร Final
6. สูตรที่มี blocker พิมพ์ได้เฉพาะฉบับร่างที่แสดง blocker ชัดเจน

## Recipes that still have blockers

- เนื้อตุ๋น (ราดข้าว)
- น้ำซุปก๋วยเตี๋ยว V3
- ซอสลับสำหรับซุป V3
- ชุดเครื่องเทศสำหรับซุป V3
- ชุดปรุงรอบ 2 สำหรับซุป V3
- น้ำจิ้มซีฟู๊ด
- ซอสยากินิกุ
- ซอสอเนกประสงค์
- เนื้อแดด (ข้าวขยำ)
- ผงคั่วพริกเกลือ
- ข้าวญี่ปุ่นหุงสุก
- ข้าวหอมมะลิหุงสุก

รายละเอียด blocker รายสูตรอยู่ใน `../data/kitchen-sot-first-set-v2.json` และแสดงใน Source Review ของ prototype

## Safe handoff wording

ให้เรียกชุดนี้ว่า:

> CookingBook V1 — first-set candidate SOT with explicit review blockers

อย่าเรียกว่า “สูตรครัว Final ทั้งหมด” จนกว่า owner จะปิด conflict/missing states และมี production migration brief แยกต่างหาก

## Migration gate

ยังห้าม sync หรือ overwrite เว็บ production/Supabase อัตโนมัติ ขั้นถัดไปต้องสร้าง reconciliation report ที่แสดงต่อหนึ่งรายการ:

- ชื่อเมนู/สูตรประกอบ
- ค่าเดิมในเว็บและความหมายด้าน cost
- ข้อความ/ค่า/หน่วยจากต้นฉบับครัว
- ปริมาณจัดเสิร์ฟ ถ้ามี
- แหล่งที่มาและวันที่
- decision status
- blocker
- owner approval

เมื่อรายงานนี้ผ่าน owner review จึงค่อยออกแบบ migration/backfill/rollback

## Kitchen SOT V4 binding (frozen upstream source)

สูตรและหลักฐานทั้งหมดเป็นของ vault ไม่ใช่ของ prototype นี้ prototype เป็น **consumer copy** เท่านั้น

| รายการ | ค่า |
|---|---|
| Vault release | `~/tt3p/vault/nntn/Operations/CookBook/sot/v4-2026-08-05/` |
| Workbook | `NNTN-Kitchen-SOT-V4-2026-08-05.xlsx` |
| Workbook SHA-256 | `b9560e48a48e2077960401968992141f77e7cd3cde33ed1ca99859e887924006` |
| Source JSON SHA-256 | `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d` |
| Release status | `FIRST_SET_CANDIDATE` (ไม่ใช่ Final Approved) |
| Data cutoff | `2026-08-04 18:35 ICT` |
| Vault commit | `2280119` |

V4 เป็น immutable หลัง freeze การแก้ข้อมูลสูตรแม้ช่องเดียวต้องออก V5 ที่ vault ก่อน แล้ว prototype จึงรับ fixture ใหม่เข้ามา การแก้ UI ในโฟลเดอร์นี้ห้ามเปลี่ยนข้อมูล V4 และห้ามทำให้ prototype กลายเป็นเจ้าของสูตร

ตรวจว่า fixture ยังตรงกับ V4:

```bash
cmp -s ~/tt3p/vault/nntn/Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json \
  data/kitchen-sot-first-set-v2.json
cmp -s data/kitchen-sot-first-set-v2.json cookbook-module-v1/src/data/fixtures/first-set.json
```

ยังค้างก่อนประกาศ Final Approved: recipe 159 `ข้าวหน้าเนื้อยากินิกุ:ข้าวญี่ปุ่น` มี `selected_source = owner_confirmation` แต่ `source_values` ไม่มี key นั้น ต้องเติมค่าจริงแล้วออกเป็น V5
