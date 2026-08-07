# CookingBook V1 — Verification Guide

## Snapshot integrity

จาก `webapp-prototype/`:

```bash
shasum -a 256 data/kitchen-sot-first-set-v2.json cookbook-module-v1/src/data/fixtures/first-set.json
cd cookbook-module-v1
shasum -a 256 -c SNAPSHOT-SHA256.txt
```

Expected fixture hash for both files:

```text
09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d
```

## Static parent prototype

จาก `webapp-prototype/`:

```bash
node --check app.js
node --check recipe-variants.js
node --check import-review.js
node --check import-review-ui.js
node --check kitchen-sot.js
node --check print-center.js
node --test tests/*.test.js
```

Static parent เปิด `index.html` ได้ตรงจาก browser และไม่ต้องใช้ package manager

## CookingBook Module V1

จาก `webapp-prototype/cookbook-module-v1/`:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm run test:browser
npm run test:browser:export
npm run test:e2e
git diff --check
```

Expected source-snapshot evidence:

- Vitest: 21 files / 558 tests
- Playwright: 20/20
- build: 49 modules at source commit
- browser guards: loopback-only, GET/HEAD, no body, no Supabase/external/analytics/CDN
- no listeners remain on 4175, 4176, 4187 after tests

Counts may change after an intentional edit; every change must explain the new count and preserve the behavioral gates

## Manual flow

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4187 --strictPort
```

Open:

```text
http://127.0.0.1:4187/nntn-cookbook/
```

Verify:

1. ค้น `ข้าวหน้าเนื้อตุ๋น`
2. เปิด dependency และเห็น `เนื้อตุ๋น (ราดข้าว)`
3. เปิด Print Center เลือก Service
4. เห็น `ข้าวหอมมะลิหุงสุก 180 กรัม`
5. ไม่เห็น `72 กรัม` เป็น service portion
6. DEMO media โหลดจาก app base และติดอยู่กับ step ที่ถูกต้อง
7. Export JSON มี schema `cookbook-prototype-v1` และ session media warning

หยุด preview server หลังตรวจเสร็จ

## Fresh bundle verification — 2026-08-05

รันจาก snapshot ที่รวมไว้ใน worktree นี้แล้ว ได้ผลดังนี้:

- parent static syntax checks: ผ่าน 6/6 ไฟล์
- parent static tests: 56/56 ผ่าน
- snapshot checksum: ผ่าน 88/88 ไฟล์
- fixture hash: parent และ module ตรงกันที่ `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`
- Vitest: 21/21 files, 558/558 tests ผ่าน
- ESLint, TypeScript typecheck และ production build: ผ่าน; Vite transform 49 modules
- print-layout browser harness และ snapshot-export browser harness: ผ่าน
- Playwright: 20/20 ผ่าน รวม desktop/mobile overflow, media, print, export และ read-only network guard
- listener หลังจบ: ไม่มี process ค้างบน 4175, 4176 หรือ 4187
- secret-pattern scan ใน bundle: ไม่พบ credential/key/private-key pattern
- `git diff --check`: ผ่าน

Dependency note: `npm audit` ณ วันที่ตรวจรายงาน 2 high findings จาก `react-router`/`react-router-dom` advisory `GHSA-qwww-vcr4-c8h2`. Prototype นี้เป็น client-only loopback app และไม่มี RSC action endpoint แต่ dependency finding ยังต้องถือเป็น open risk; ห้าม deploy production จนกว่าจะมี dependency-review task แยกและรัน regression gate ครบอีกครั้ง ไม่ใช้ `npm audit fix --force` ใน snapshot นี้เพราะจะทำให้ verified source เปลี่ยนโดยไม่มี brief

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
