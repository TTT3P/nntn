# CookingBook V1 — Continuation Brief

## Objective for the next agent

รับช่วง CookingBook Module V1 จาก bundle นี้ ตรวจว่ารันซ้ำได้ แล้วทำเฉพาะงานรอบใหม่ที่ TINE ระบุ โดยรักษา source text/unit แบบไม่เดาและไม่กระทบ NNTN production app

## Working directory

```text
~/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype
```

Runnable module:

```text
~/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype/cookbook-module-v1
```

## First turn checklist

1. อ่าน `AGENTS.md` ของ parent และ `cookbook-module-v1/AGENTS.md`
2. อ่าน manifest, design, plan และ module handoff ตาม read order
3. อ่าน `COOKBOOK-V1-DATA-READINESS.md`; ห้ามเรียก candidate set ว่า Final SOT
4. ตรวจ `SNAPSHOT-PROVENANCE.md` และ checksum manifest
5. รัน `npm ci` ภายใน module
6. รัน quality gate ใน `COOKBOOK-V1-VERIFICATION.md`
7. เปิด production preview และเดิน flow หลักด้วยชื่อเมนู ไม่ใช้ recipe code เป็น primary navigation
8. รายงานความต่างจาก evidence ที่บันทึกไว้ก่อนแก้ไฟล์

## Domain invariants that must survive

- หน่วยครัวต้นฉบับ เช่น ช้อนชา ช้อนโต๊ะ กรัม และมิลลิลิตร ต้องเก็บ verbatim
- ห้ามแปลงหน่วยหรือเดาค่าเพื่อให้ครบ
- newer handwriting correction มีสิทธิเหนือ source เก่าเฉพาะเมื่อ decision ถูกบันทึกแล้ว
- DOCX/V2 ใช้เทียบ; V1 ใช้เป็น baseline ไม่ใช่ authority สุดท้าย
- sellable menu, prepared recipe และ direct ingredient เป็นคนละชนิด
- ซอส น้ำซุป ข้าวหุง และของเตรียมเป็น prepared recipe ที่ถูก reuse ผ่าน dependency graph
- งานแยกเป็น `prep`, `cook`, `service`; recipe graph เดียวสร้างเอกสารหลายจุดงาน
- ข้าวจัดเสิร์ฟคือข้าวหุงสุก 180 กรัมเมื่อเมนูมีข้าว; 72 กรัมเป็นฐานข้าวสารดิบเพื่อ cost เท่านั้น
- ข้าวญี่ปุ่นใช้กับข้าวหน้าเนื้อกิวด้งและข้าวหน้าเนื้อยากินิกุ; เมนูอื่นใช้ข้าวหอมมะลิตาม fixture ที่อนุมัติ
- รูป DEMO ไม่ใช่หลักฐานครัวจริง; session upload ไม่ persist และ binary ไม่รวมใน export
- Print planner ต้อง fail closed ก่อนข้อมูลถูกตัด; CSS ห้ามซ่อนเนื้อหาที่ planner ยอมรับ

## Raw evidence paths — read-only

```text
~/tt3p/vault/nntn/Operations/CookBook/original-scan/2026-08-02_ถอดลายมือ.md
~/tt3p/vault/nntn/Operations/CookBook/original-scan/2026-08-02_ลายมือครัว-23หน้า.pdf
~/tt3p/vault/nntn/Operations/CookBook/true-originals/_inbox
```

`original-scan` เป็น path แยกจาก `true-originals` อย่าแก้ให้ซ้อนกัน

## Current delivered scope

- name-first recipe library and filters
- recipe dependency graph and component navigation
- source-review queue and session draft editing
- Prep/Cook/Service work projections
- ordered reusable step media with review warnings
- A5 landscape workstation cards and A4 two-up sheets
- deterministic fail-closed pagination with browser-calibrated Unicode/layout boundaries
- JSON prototype snapshot export with `binary-not-included` warnings
- Chrome browser QA and strict loopback/read-only request guards

รายละเอียดอยู่ใน module `docs/HANDOFF.md` และ parent `COOKBOOK-V1-FINAL-QA.md`

## Not authorized yet

- Supabase schema/table/RLS/Storage changes
- production migration, backfill, rollback หรือ data write
- auth, approval engine, audit log หรือ production costing
- การแก้เว็บ NNTN production เดิม
- Google Sheets เป็น database/persistence
- publish, push, PR หรือ deploy โดยไม่มีคำสั่ง TINE

## If the next request is Supabase persistence

หยุด implementation จนมี brief ใหม่ที่ระบุครบ:

1. exact tables/fields and typed IDs
2. source quantity/unit vs derived normalized values
3. RLS and roles
4. Storage buckets/policies and image lifecycle
5. migration/backfill sequence
6. compatibility with existing `qty_g` consumers
7. rollback and data validation
8. production access and approval owner

## Suggested skills

- `recap` หรือ `memory-search` เมื่อต้องกู้ decision เก่า
- `analyze` สำหรับ read-only mapping ก่อนแก้ architecture
- `design` เมื่อ TINE เปิด UX/spec version ใหม่
- `ralplan` เมื่อ requirements ใหม่ชัดและต้องทำ implementation plan
- `subagent-driven-development` สำหรับ task plan ที่อนุมัติแล้ว
- `systematic-debugging` เมื่อ browser/test behavior ผิดคาด
- `verification-before-completion` ก่อนประกาศงานเสร็จ

## Stop condition

หยุดและขอ TINE เมื่อ scope ใหม่ต้องแตะ production, credentials, Supabase, remote publish, irreversible migration หรือ decision ที่เปลี่ยน source authority

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
