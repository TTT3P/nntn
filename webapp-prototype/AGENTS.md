# Recipe Studio Prototype — Local Agent Contract

ขอบเขตของไฟล์นี้คือ `webapp-prototype/` และโฟลเดอร์ย่อยเท่านั้น

## เป้าหมาย

รักษา prototype แบบ static สำหรับสำรวจ Product/UX ของระบบสูตรอาหาร ต้นทุน เอกสารพิมพ์ และการจัดเมนูหลายสาขา

## ข้อจำกัดที่ยืนยันแล้ว

- ห้ามแก้ไฟล์ระบบ NNTN เดิมนอก `webapp-prototype/`
- ไม่มี Supabase, PostgREST, database หรือ network request
- ไม่มี build step และไม่เพิ่ม dependency
- ต้องเปิด `index.html` โดยตรงจาก browser ได้
- ข้อมูลและตัวเลขทั้งหมดเป็น mock จนกว่าจะมีเอกสารยืนยันเป็นอย่างอื่น
- Measurement conversion ต้องแยกตามวัตถุดิบ/สภาพวัตถุดิบ ห้ามใช้ค่า `1 tbsp = X g` ร่วมกันทั้งระบบ
- เมื่อไม่มี conversion ให้แสดงว่า `รอข้อมูล` ห้ามเดาน้ำหนัก
- สูตร SOP ต้องรักษาหน่วยที่ครัวใช้จริง ส่วน normalized grams เป็น derived data
- หลายสาขาต้องใช้ Master Recipe + Menu Assignment ห้ามคัดลอกสูตรอิสระต่อสาขา

## Source of Truth

อ่านตามลำดับ:

1. `docs/PRD-MVP.md`
2. `docs/ARCHITECTURE.md`
3. `docs/HANDOFF.md`
4. `docs/2026-08-03-recipe-variants-design.md`
5. `README.md`

งาน UI/UX/CSS ต้องอ่าน design rule ปัจจุบันจาก:

```text
/Users/trirongyinwichapoon/.claude-config-repo/rules/design.md
```

อย่าสร้าง `DESIGN.md` ใหม่ใน prototype เว้นแต่ TINE สั่งโดยตรง

## Verification ขั้นต่ำ

```bash
node --check app.js
node --check recipe-variants.js
node --test tests/recipe-variants.test.js
grep -RniE 'supabase|postgrest|fetch\(|XMLHttpRequest|WebSocket' . --exclude=README.md --exclude='*.md' --exclude='*.png'
```

จากนั้นเปิด `index.html` และตรวจอย่างน้อย:

- Recipe Editor เพิ่ม/ลบส่วนผสมได้
- Recipe Variant เพิ่ม/ลบตัวเลือกและเพิ่มหลายชิ้นส่วนต่อหนึ่งตัวเลือกได้
- สลับเมนูเดี่ยว/เมนูมีตัวเลือกแล้วไม่ลบข้อมูล Variant ที่ซ่อนไว้
- Print Center และ cost selector รับเฉพาะ Variant สถานะเปิดใช้งาน
- Food Cost Preview แสดง measured/manufacturer/estimated/missing ได้
- Print Center สลับ A4/A5/Booklet ได้
- สาขาและเมนูสลับ Menu Set และคำนวณ dependency ได้
- หน้าจอ 390px ไม่มี body overflow; ตารางเลื่อนภายในได้

## Scope Guard

**SPEC LOCK: Prototype Spec v1 ถูกล็อกโดย TINE เมื่อ 4 สิงหาคม 2026**

- ห้ามเพิ่ม feature, print template, entity, routing rule หรือ integration ใหม่
- ทำได้เฉพาะแก้ defect ที่ขัดกับ `docs/PRD-MVP.md`
- Family Master แบบรวมและ Branch Pack อยู่นอกขอบเขต
- การขยายงานต้องมีคำสั่งใหม่จาก TINE ที่ระบุว่าปลดล็อก spec หรือสร้าง version ถัดไป
- ยังคงห้าม auth, persistence, supplier integration, production costing, approval engine และ audit log
