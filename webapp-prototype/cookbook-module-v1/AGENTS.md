# CookingBook Module V1 — Agent Contract

ขอบเขตของไฟล์นี้คือ `cookbook-module-v1/` และโฟลเดอร์ย่อยเท่านั้น โดย override กฎ static/no-build ของ parent prototype สำหรับโมดูล React ชุดนี้

## Purpose

Snapshot ที่รันได้ของ CookingBook Module V1 สำหรับค้นสูตร ตรวจ dependency แยก Prep/Cook/Service แนบรูปตามขั้นตอน พิมพ์ A5/A4 two-up และ export prototype snapshot

## Read Order

1. `SNAPSHOT-PROVENANCE.md`
2. `README.md`
3. `docs/PRD.html`
4. `docs/DESIGN.md`
5. `docs/HANDOFF.md`
6. Parent `../docs/COOKBOOK-V1-CONTINUE-BRIEF.md`

## Runtime Contract

- React + TypeScript + Vite
- ติดตั้งด้วย `npm ci`
- state เป็น session-only; reload กลับ fixture
- ห้าม Supabase, Storage, analytics, CDN, external media หรือ production write
- ห้ามแปลงหน่วยต้นฉบับหรือเดาค่าที่ขาด
- DEMO media ไม่ใช่หลักฐานครัวที่ยืนยันแล้ว
- Browser evidence ปัจจุบันยืนยันเฉพาะ Google Chrome

## Required Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:browser
npm run test:browser:export
npm run test:e2e
git diff --check
```

## Scope Gate

- แก้ defect และปรับ UX/content ภายใน prototype ได้เมื่อ TINE สั่ง
- Persistence/Supabase ต้องมี brief ใหม่ที่ระบุ schema, RLS, Storage, migration, rollback และ backfill
- ห้ามแก้ static prototype ใน parent หรือระบบ NNTN production โดยอนุมานเอง
- ห้าม commit/push/publish จน TINE สั่งโดยตรง

## Output and Cleanup

- Source/tests/docs อยู่ในโมดูลนี้
- `node_modules/`, `dist/`, `test-results/`, `playwright-report/` เป็น generated/runtime และห้ามส่งต่อหรือ commit
- ไฟล์ชั่วคราวให้อยู่นอก repo หรือใน path ที่ gitignore แล้ว

