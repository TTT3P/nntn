# NNTN Recipe Studio — Static Prototype

ต้นแบบหน้าเว็บแบบ static สำหรับทดลอง UI การกรอกสูตรอาหาร โดยตั้งใจให้แยกจากระบบ NNTN เดิมทั้งหมด

**สถานะ: Prototype Spec v1 ถูกล็อกเมื่อ 4 สิงหาคม 2026 ไม่เพิ่ม feature ต่อโดยไม่มีคำสั่งปลดล็อกจาก TINE**

## CookingBook V1 Handoff Bundle — 5 สิงหาคม 2026

Folder นี้รวมทั้ง static prototype เดิมและ snapshot ของ CookingBook Module V1 ที่ผ่าน QA แล้ว เพื่อส่งต่อ agent/session ใหม่จากจุดเดียว

เริ่มอ่านที่:

- `docs/COOKBOOK-V1-BUNDLE-MANIFEST.md` — ในชุดมีอะไรและอะไรตั้งใจไม่รวม
- `docs/COOKBOOK-V1-DATA-READINESS.md` — สถานะข้อมูลจริง จุดค้าง และกติกาเทียบเว็บ food cost
- `docs/COOKBOOK-V1-CONTINUE-BRIEF.md` — brief สำหรับ agent ถัดไป
- `docs/COOKBOOK-V1-VERIFICATION.md` — checksum, tests, browser flow และคำสั่งรัน
- `cookbook-module-v1/AGENTS.md` — กฎเฉพาะของแอป React/Vite
- `cookbook-module-v1/SNAPSHOT-PROVENANCE.md` — source branch/commit ของ snapshot

`cookbook-module-v1/` เป็น runnable snapshot แยกจาก static prototype นี้ ไม่ได้แทนที่ `index.html` และไม่ใช่ production cutover

ข้อมูลใน bundle เป็น **first-set candidate SOT** จำนวน 18 สูตร ไม่ใช่สูตรครัว Final ทั้งหมด ปัจจุบัน 6 สูตรไม่มี blocker และ 12 สูตรยังต้องตรวจต่อ ห้ามนำค่า `qty_g` จากเว็บเดิมมาทับหน่วยหน้าครัว; อ่าน `docs/COOKBOOK-V1-DATA-READINESS.md` ก่อนเทียบหรือ migrate ข้อมูล

## เอกสารสำหรับ Session/Agent ถัดไป

- `AGENTS.md` — ขอบเขตและกฎการแก้ไข
- `docs/PRD-MVP.md` — Product requirements ที่ยืนยันแล้ว
- `docs/ARCHITECTURE.md` — โครงสร้างไฟล์/state/functions
- `docs/HANDOFF.md` — สถานะล่าสุด หลักฐานทดสอบ และวิธีรับช่วงต่อ
- `docs/2026-08-03-recipe-variants-design.md` — แบบ Recipe Family + หลาย Variant/หลายชิ้นส่วน
- `docs/2026-08-03-recipe-variants-plan.md` — แผน implementation และ verification ของ feature นี้

## เปิดใช้งาน

เปิดไฟล์ `index.html` ด้วยเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้ง package, build หรือ start server

สำหรับ CookingBook Module V1:

```bash
cd cookbook-module-v1
npm ci
npm run dev -- --host 127.0.0.1
```

แอปใช้ base path `/nntn-cookbook/`; production preview และ quality gate อยู่ใน `docs/COOKBOOK-V1-VERIFICATION.md`

## ขอบเขต

- ไม่มี Supabase หรือฐานข้อมูล
- ไม่มี network request
- ไม่มีการบันทึกข้อมูลจริง
- มีฟอร์มสูตรอาหาร รายการส่วนผสมเพิ่ม/ลบได้ และ revision history แบบข้อมูลตัวอย่าง
- มี Recipe Variants: สูตรแม่หนึ่งสูตรมีตัวเลือกเนื้อหลายแบบ และแต่ละตัวเลือกมีหลายชิ้นส่วนได้
- เลือกโหมดเมนูเดี่ยวหรือเมนูมีตัวเลือกได้ โดยไม่ลบข้อมูล Variant เมื่อสลับโหมด
- มีสถานะแบบร่าง/เปิด/ปิด พร้อม Internal SKU, External SKU, Branch routing และจุดครัวแบบ mock
- Food Cost Preview และ Print Center รวมส่วนผสมสูตรแม่กับ Variant ที่เลือก
- มี Food Cost Preview และ Measurement Knowledge แบบ mock แยกสถานะชั่งจริง ผู้ผลิต ค่าประมาณ และข้อมูลที่ยังขาด
- การแปลงหน่วยเป็นน้ำหนักอิงวัตถุดิบและสภาพวัตถุดิบแต่ละชนิด ไม่ใช้ค่า global ร่วมกัน
- มีหน้า `สาขาและเมนู` สำหรับเลือกบริษัท แบรนด์ สาขา Menu Set และเมนูรายตัว พร้อมดึง dependency ของสูตรโดยอัตโนมัติ
- มี Branch Readiness และตาราง rollout เพื่อแยก Master Recipe, branch assignment และข้อยกเว้นของสาขา
- มี Print Center เลือกหลายสูตร ตัวคูณปริมาณ สถานะเอกสาร และแม่แบบ A4 Master, A5 Kitchen หรือ Cookbook Booklet
- มี SKU & Routing Sheet สำหรับตรวจ mapping ของเมนูขายแต่ละรายการ
- พิมพ์ผ่าน Print dialog ของเบราว์เซอร์ หรือเลือก Save as PDF ได้ โดยไม่มีบริการสร้าง PDF ภายนอก
- คัดลอกเฉพาะค่าสีจาก `tokens.css` และ `nntn-theme.css` มาไว้ใน `styles.css`; ไม่ import ไฟล์จากระบบเดิม

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
