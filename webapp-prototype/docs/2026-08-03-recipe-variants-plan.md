# Recipe Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มสูตรแม่ที่มีหลาย Protein Variant และรองรับหลายชิ้นส่วนต่อ Variant ใน static prototype

**Architecture:** แยกกติกาแปลง Variant เป็น printable/costable recipes ไว้ใน `recipe-variants.js` แบบ browser global + CommonJS export เพื่อทดสอบด้วย Node built-in test ได้ ส่วน DOM rendering และ event wiring อยู่ใน `app.js` ตามโครงเดิม

**Tech Stack:** Vanilla HTML/CSS/JS, Node `node:test`, ไม่มี dependency และไม่มี build step

## Global Constraints

- แก้เฉพาะ `webapp-prototype/`
- ไม่มี Supabase, database, network request หรือ persistence
- เปิด `index.html` ตรงจาก filesystem ได้
- หนึ่ง Variant มีวัตถุดิบผันแปรได้หลายรายการ
- หากไม่มี Variant ต้องคงพฤติกรรมสูตรเดี่ยวเดิม

---

### Task 1: Variant domain helper

**Files:**
- Create: `tests/recipe-variants.test.js`
- Create: `recipe-variants.js`

**Interfaces:**
- Produces: `RecipeVariants.normalizeVariants(variants)` และ `RecipeVariants.buildVariantRecipes(baseRecipe, variants)`

- [x] เขียน Node tests สำหรับการกรองรายการว่าง การรวม base ingredients กับหลายชิ้นส่วน และ fallback สูตรเดี่ยว
- [x] รัน `node --test tests/recipe-variants.test.js` และยืนยันว่า fail เพราะ helper ยังไม่มี
- [x] สร้าง helper ขั้นต่ำให้ผ่าน test และ expose ผ่าน browser global/CommonJS
- [x] รัน test ซ้ำให้ผ่าน

### Task 2: Recipe Variant editor

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

**Interfaces:**
- Consumes: `RecipeVariants.normalizeVariants()` และ `RecipeVariants.buildVariantRecipes()`
- Produces: dynamic Variant cards พร้อม nested protein rows

- [x] เพิ่ม semantic template และ section สำหรับ Variant
- [x] เพิ่ม renderer/event handlers สำหรับเพิ่ม ลบ และโหลดข้อมูลตัวอย่าง
- [x] เพิ่ม responsive CSS โดยให้ control ยุบเป็นหนึ่งคอลัมน์บนจอเล็ก
- [ ] ตรวจเพิ่ม/ลบ Variant และหลายชิ้นส่วนด้วย browser — browser runner รอบล่าสุดจบด้วย `SIGABRT`; ต้อง rerun เมื่อ environment พร้อม

### Task 3: Cost และ Print integration

**Files:**
- Modify: `index.html`
- Modify: `app.js`

**Interfaces:**
- Consumes: Variant state จาก editor
- Produces: variant selector สำหรับ cost และ printable recipe ต่อ Variant

- [x] เพิ่ม Variant selector ใน Food Cost Preview
- [x] รวม base ingredients กับส่วนผสมของ Variant ที่เลือกก่อน normalize
- [x] ให้ Print Center แสดงแต่ละ Variant ของสูตรปัจจุบันแยกกัน
- [x] ตรวจ escaping และ fallback เมื่อยังไม่มี Variant

### Task 4: Documentation และ verification

**Files:**
- Modify: `docs/PRD-MVP.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/HANDOFF.md`
- Modify: `README.md`

- [x] บันทึก entity/flow/acceptance criteria ของ Variant
- [x] รัน `node --check app.js` และ `node --check recipe-variants.js`
- [x] รัน `node --test tests/recipe-variants.test.js`
- [ ] ตรวจไม่มี Supabase/network reference และไม่มี console error — static scan ผ่าน; browser console รอ rerun
- [ ] ตรวจ desktop และ mobile 390px — CSS/static structure พร้อม; browser runner รอ rerun
