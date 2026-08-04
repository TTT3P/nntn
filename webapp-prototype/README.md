# NNTN Recipe Studio — Static Prototype

ต้นแบบหน้าเว็บแบบ static สำหรับทดลอง UI การกรอกสูตรอาหาร โดยตั้งใจให้แยกจากระบบ NNTN เดิมทั้งหมด

**สถานะ: Prototype Spec v1 ถูกล็อกเมื่อ 4 สิงหาคม 2026 ไม่เพิ่ม feature ต่อโดยไม่มีคำสั่งปลดล็อกจาก TINE**

## เอกสารสำหรับ Session/Agent ถัดไป

- `AGENTS.md` — ขอบเขตและกฎการแก้ไข
- `docs/PRD-MVP.md` — Product requirements ที่ยืนยันแล้ว
- `docs/ARCHITECTURE.md` — โครงสร้างไฟล์/state/functions
- `docs/HANDOFF.md` — สถานะล่าสุด หลักฐานทดสอบ และวิธีรับช่วงต่อ
- `docs/2026-08-03-recipe-variants-design.md` — แบบ Recipe Family + หลาย Variant/หลายชิ้นส่วน
- `docs/2026-08-03-recipe-variants-plan.md` — แผน implementation และ verification ของ feature นี้

## เปิดใช้งาน

เปิดไฟล์ `index.html` ด้วยเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้ง package, build หรือ start server

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
