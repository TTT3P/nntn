# Handoff — Recipe Studio Prototype

**Prepared:** 4 สิงหาคม 2026  
**Target reader:** agent/developer ที่ไม่มี transcript ของ session นี้

## Spec Lock

**Prototype Spec v1 ถูกล็อกโดย TINE เมื่อ 4 สิงหาคม 2026**

- ไม่ต้องเพิ่มอะไรต่อจากสถานะปัจจุบัน
- Family Master แบบรวมและ Branch Pack ถูกพิจารณาแล้วแต่ไม่ต้องทำ
- งานถัดไปทำได้เฉพาะ defect fix เทียบกับ `docs/PRD-MVP.md`
- อย่าตีความ feedback เดิมเป็น backlog อัตโนมัติ
- ต้องได้รับคำสั่งใหม่จาก TINE เพื่อปลดล็อกหรือเปิด spec version ใหม่

## Start Here

Absolute folder:

```text
/Users/trirongyinwichapoon/tt3p/product-hub/nntn/webapp-prototype
```

เปิดใช้งานแบบถาวรโดยเปิด:

```text
/Users/trirongyinwichapoon/tt3p/product-hub/nntn/webapp-prototype/index.html
```

ไม่ต้องใช้ server; URL `127.0.0.1:8765` เป็นเพียง server ชั่วคราวสำหรับ browser verification ใน session ก่อนหน้า

## Current State

Prototype มีสอง workspace:

1. **Recipe Editor** — single/variant mode, SOP, Recipe Variants, SKU/Routing metadata, Measurement Knowledge, Food Cost Preview, Revision, Print Center
2. **สาขาและเมนู** — Company/Brand/Branch, Menu Sets, Menu Catalog, Dependencies, Readiness, Rollout

ทุก interaction เป็น mock in-memory และหายเมื่อ reload

## What Was Verified

- `node --check app.js` ผ่าน
- `node --check recipe-variants.js` ผ่าน
- `node --test tests/recipe-variants.test.js` ผ่าน 7 tests
- HTML ไม่มี duplicate IDs
- ไม่มี Supabase/DB/network API calls
- Recipe ingredient add/remove ทำงาน
- Food Cost examples:
  - ซีอิ๊ว 3 tbsp → measured mock
  - น้ำมัน 2 tbsp → manufacturer mock
  - น้ำตาล 1 tbsp → estimated mock
  - unknown ingredient → `รอข้อมูล`
- Print Center:
  - Master 4 selected recipes → 4 pages
  - Kitchen → 4 pages
  - Booklet → cover + TOC + 4 recipes = 6 pages
  - multiplier ×2 ปรับปริมาณใน preview
  - no-selection guard ป้องกัน print
- Branch Menu:
  - Express → 3 Menu Items / 6 unique dependencies
  - เพิ่ม Delivery menu → Custom / 4 Menu Items / 7 dependencies
  - เปลี่ยน branch โหลด profile และ preset ของ branch
  - clear selection → 0 dependency + publish guard
- Responsive 390px ไม่มี body overflow; cost/rollout tables scroll internally
- Browser console 0 errors; network มีเฉพาะ local HTML/CSS/JS

Variant change รอบล่าสุดตรวจด้วย unit/static checks แล้ว:

- normalize หนึ่ง Variant ที่มีหลายชิ้นส่วน
- รวม base ingredients + Variant parts สำหรับ cost/print model
- fallback เป็นสูตรเดี่ยวเมื่อไม่มี Variant
- เพิ่ม SOP note เฉพาะ Variant โดยไม่แก้ base steps
- explicit single/variant mode และ no-active fallback
- draft/active/inactive status
- SKU generation และ channel/branch/kitchen metadata normalization

หมายเหตุ: browser automation รอบล่าสุดเปิด Chromium ไม่สำเร็จเพราะ local browser process จบด้วย `SIGABRT`; หลักฐาน browser/responsive ด้านบนมาจาก prototype ก่อนเพิ่ม Variant จึงควร rerun visual smoke ใน session ถัดไปเมื่อ browser runner พร้อม

## Visual References

- `preview-desktop.png`
- `preview-food-cost-knowledge.png`
- `preview-print-center.png`
- `preview-branch-menu.png`
- ยังไม่มีภาพ `preview-recipe-variants.png` ที่ยืนยันแล้ว เพราะ browser runner รอบล่าสุดเปิดไม่สำเร็จ

## Decisions That Must Survive

1. ห้ามสร้าง recipe-management app ใหม่ทับระบบเดิม; prototype นี้แยกโดดเดี่ยว
2. รอบนี้ไม่เชื่อม DB/Supabase
3. SOP unit คือ source representation ของครัว
4. Normalized grams เป็น derived representation สำหรับต้นทุน
5. Conversion ต้อง ingredient-specific พร้อม provenance/confidence
6. ไม่มี knowledge ต้องไม่เดา
7. บริษัทอาจมีหลาย brand/branch; สาขาเลือกเฉพาะบาง Menu Item
8. Menu Item ต้องดึง recipe dependencies อัตโนมัติ
9. สาขาอ้าง Master Recipe Version ไม่ถือสำเนาสูตรอิสระ
10. TINE ยืนยันให้หยุด scope ที่ prototype ปัจจุบันเพื่อไม่ให้งานใหญ่เกิน
11. สูตรที่มีหลายเนื้อใช้ Recipe Family + Variant; ส่วนผสม/SOP ร่วมกันอยู่ที่สูตรแม่
12. หนึ่ง Variant มีเนื้อหลายชิ้นส่วนได้ และ Food Cost/Print ต้องรวมชิ้นส่วนเหล่านั้น
13. ไข่ดาว เพิ่มข้าว และของเพิ่มทั่วไปเป็น Modifier ไม่ใช่ Variant
14. เมนูเดี่ยวและเมนูมีตัวเลือกต้องเป็น explicit mode เพื่อไม่ให้ UX ตีความผิด
15. Variant ที่ปิดไม่ถูกลบ SKU หรือประวัติ แต่ไม่ส่งไป cost selector, sellable print หรือ routing
16. Metadata เป็นข้อมูลของ entity ส่วน Routing เป็นความสัมพันธ์ไปช่องทาง สาขา และจุดครัว
17. TINE ล็อก Prototype Spec v1 และยืนยันว่าไม่ต้องการ feature เพิ่ม

## Known Limitations by Design

- ตัวเลข measurement/cost/price/date ทั้งหมดเป็น mock
- Food Cost Preview ยังไม่มี yield, waste, supplier price หรือ baht calculation จริง
- ไม่มี calibration form, approval, effective date, rollback หรือ audit
- Company/Brand dropdown ยังไม่กรอง catalog จริง
- Print data มี sample recipes ฝังใน JS
- ไม่มี persistence; reload แล้วกลับค่าเริ่มต้น
- ราคาขาย Variant เป็น mock และยังไม่เชื่อมราคาวัตถุดิบ/POS SKU
- SKU และ routing ทั้งหมดเป็น mock ไม่มีการ reserve code หรือ sync กับ POS จริง

## Recommended Next Session

1. อ่าน `AGENTS.md` และ `docs/PRD-MVP.md`
2. เปิด `index.html` และรีวิว workflow กับ TINE
3. เก็บ feedback เป็นรายการเฉพาะจุด
4. แก้เฉพาะจุดที่ผู้ใช้ยืนยัน; อย่าเพิ่ม platform scope โดยอัตโนมัติ
5. รัน verification ใน `AGENTS.md`

## Suggested Skills

- `recap` หรือ `memory-search` หากต้องกู้บริบทข้าม session
- `scrutinize` สำหรับรีวิว prototype/PRD จากมุมมองคนนอก
- `design` เมื่อ TINE ยืนยันการปรับ product/UX รอบใหญ่
- `ralplan` เฉพาะเมื่อจะเปลี่ยน prototype เป็น implementation plan
- `verification-before-completion` ก่อนประกาศการแก้ไขรอบถัดไปเสร็จ

## Repository Warning

Parent repository มี tracked/untracked work อื่นอยู่ก่อนเริ่มงานนี้ ห้าม cleanup, reset หรือ commit งานที่ไม่เกี่ยวข้อง การแก้ไขของ prototype รอบนี้ควรอยู่ใต้ `webapp-prototype/` เท่านั้น

## Prototype v2 Kitchen SOT Update

**Branch:** `feature/kitchen-sot-prototype-v2`

**Worktree:** `/Users/trirongyinwichapoon/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2`

The Source Review workspace is now the default landing screen. The first set contains four sellable menus and twelve prepared recipes. Users navigate by Thai recipe name, select nested prepared recipes, compare V1/DOCX/V2/handwriting, edit a kitchen candidate, and save an in-memory draft.

Important behavior:

- A DOCX can map multiple sections to separate recipes.
- Sellable menus, prepared recipes, and direct ingredients are separate types.
- The first 16 recipes use version IDs such as `kitchen-v2-157-draft-001`.
- Spoon, gram, millilitre, ladle, glass, bag, head, bunch, and other source units remain unchanged.
- Duplicate prepared-recipe dependencies appear once in the visible tree and print bundle.
- Missing quantities, source conflicts, missing methods, missing dependencies, and cycles block final output by name.
- `บันทึกฉบับร่าง` updates only the page's in-memory store; reload restores the generated candidate data.
- `เพิ่มเมนูและสูตรเตรียมลงชุดพิมพ์` expands dependencies recursively and opens the existing Print Center.
- A bundle with any blocker is forced to `DRAFT — ข้อมูลไม่ครบ`; the `อนุมัติแล้ว` option is disabled and each affected sheet prints its blockers.
- `print_ready` is prototype terminology only, not production approval or Kitchen SOT designation.

Generated data:

- `data/kitchen-sot-first-set-v2.json` — inspectable first-set candidate artifact.
- `data/kitchen-sot-first-set-v2.js` — direct-browser asset.
- `scripts/build-kitchen-sot-data.js` — deterministic generator.

Fresh verification on 4 August 2026:

- all Node tests pass;
- Source Review is the default workspace;
- `ข้าวหน้าเนื้อยากินิกุ` expands to `ซอสยากินิกุ`, `ผัดผัก`, `ซอสอเนกประสงค์`, and `น้ำจิ้มซีฟู๊ด` without duplicates;
- `ผัดผัก` shows seven candidate lines and the two DOCX method steps;
- A kitchen bundle opens five print pages and retains `1 ช้อนชา` values;
- blocked kitchen output disables the approved status and shows the draft watermark;
- Recipe Editor add-ingredient regression passes in browser;
- Branch Menu Express still resolves 3 menu items and 6 dependencies;
- desktop and 390 px views have no body overflow; and
- the browser console reports zero local application errors.

Screenshots:

- `preview-kitchen-sot-desktop.png`
- `preview-kitchen-sot-mobile.png`

Google Sheets, Apps Script, authentication, production approval, and production mutation remain outside this branch. The next milestone should persist versioned records only after TINE accepts this static workflow.
