# CookingBook V1 — Bundle Manifest

**Prepared:** 5 สิงหาคม 2026  
**Purpose:** ชุดส่งต่อให้ agent/session ใหม่ทำงานต่อโดยไม่ต้องอ่าน transcript เดิม

## Start Here

อ่านตามลำดับ:

1. `../AGENTS.md` — กฎ parent static prototype และ scope lock
2. `COOKBOOK-V1-BUNDLE-MANIFEST.md` — แผนที่ชุดส่งต่อฉบับนี้
3. `COOKBOOK-V1-DATA-READINESS.md` — สถานะข้อมูลจริงและกติกาเทียบเว็บ food cost
4. `COOKBOOK-V1-CONTINUE-BRIEF.md` — brief สำหรับ agent ถัดไป
5. `superpowers/specs/2026-08-04-intelligent-cookbook-module-v1-design.md` — product/design contract
6. `superpowers/plans/2026-08-04-intelligent-cookbook-module-v1.md` — implementation plan 14 tasks
7. `../cookbook-module-v1/AGENTS.md` — runtime/scope contract ของแอป React
8. `../cookbook-module-v1/docs/HANDOFF.md` — คำสั่งรัน ข้อจำกัด และ future gate

## ชุดส่งต่อที่ครบต้องประกอบด้วยอะไร

### 1. Product brief และ decisions

- `PRD-MVP.md` — brief ของ static Recipe Studio เดิม
- `ARCHITECTURE.md` — architecture ของ static prototype เดิม
- `2026-08-03-recipe-variants-design.md` — Recipe Family/Variant decisions เดิม
- `superpowers/specs/2026-08-04-intelligent-cookbook-module-v1-design.md` — design ที่ใช้สร้างโมดูลใหม่
- `superpowers/plans/2026-08-04-intelligent-cookbook-module-v1.md` — แผน implementation ที่ทำครบแล้ว

### 2. Runnable prototypes

- Parent `../index.html` — static prototype เดิม เปิดไฟล์ตรงได้ ไม่ต้อง build
- `../cookbook-module-v1/` — verified React/TypeScript/Vite snapshot สำหรับ CookingBook Module V1

สองตัวนี้มีเป้าหมายต่างกันและห้าม merge ทับกันโดยอัตโนมัติ:

- static prototype = Recipe Editor / Variant / Branch Menu concept exploration
- module V1 = kitchen recipe graph / source review / work stages / media / print / export

### 3. Versioned candidate data — not fully approved

- `COOKBOOK-V1-DATA-READINESS.md` — ขอบเขต 18 สูตร สถานะ blocker และวิธีเทียบกับเว็บเดิมโดยไม่เอา `qty_g` มาทับหน่วยครัว
- `../data/kitchen-sot-first-set-v2.json` — versioned first-set candidate artifact จาก static branch; ไม่ใช่สูตร Final ทั้งหมด
- `../cookbook-module-v1/src/data/fixtures/first-set.json` — runtime copy ของ module V1
- ทั้งสองไฟล์ SHA-256: `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`
- `../cookbook-module-v1/src/data/fixtures/first-set-media.json` — DEMO media manifest แยกจากสูตรหลัก

### 4. Verification evidence

- `COOKBOOK-V1-EXECUTION-PROGRESS.md` — ledger Task 1–14 และ review cycles
- `COOKBOOK-V1-FINAL-QA.md` — browser/network/handoff quality gate ล่าสุด
- `COOKBOOK-V1-VERIFICATION.md` — คำสั่งตรวจ bundle ที่ agent ใหม่ต้องรัน
- Tests ของแอปอยู่ใต้ `../cookbook-module-v1/src/**/*.test.*` และ `../cookbook-module-v1/tests/`

### 5. Continuation controls

- `COOKBOOK-V1-CONTINUE-BRIEF.md` — objective, allowed paths, stop conditions, unresolved gates
- `COOKBOOK-V1-DATA-READINESS.md` — ห้ามเรียกชุดนี้ว่า Final SOT จนกว่า owner จะปิด blocker
- `../cookbook-module-v1/SNAPSHOT-PROVENANCE.md` — source branch/commit และสิ่งที่ไม่ถูก copy
- `../cookbook-module-v1/SNAPSHOT-SHA256.txt` — file-integrity manifest ของ snapshot
- `HANDOFF.md` — parent history และความสัมพันธ์ระหว่าง prototype สองชุด

## สิ่งที่ตั้งใจไม่รวม

- `.git` และ source commit history ของ standalone repo
- `node_modules/`, `dist/`, Vite/Playwright cache และ browser reports
- review diff packages และ agent runtime state
- credentials, `.env`, Supabase keys หรือ browser profile data
- PDF/DOCX/ลายมือฉบับใหญ่จาก vault; ชุดนี้อ้าง path กลับไปยัง raw evidence แทน
- Production database schema/migration เพราะยังไม่ผ่าน gate

## Placement Decision

`cookbook-module-v1/` เป็น nested runnable snapshot ภายใน handoff worktree ไม่ใช่การแทนที่ static prototype และไม่ใช่ production cutover การเปลี่ยนตำแหน่งนี้ได้รับคำสั่งจาก TINE เมื่อ 5 สิงหาคม 2026 เพื่อให้ส่งต่อ agent/session ใหม่จาก folder เดียวได้
