-- ============================================================
-- Phase 3 Migration: สร้าง suppliers + item_suppliers
-- Date: 05/04/2026 | Approved: COO + ไทน์
-- Context: ทะเบียนวัตถุดิบ — เพิ่มข้อมูล brand/supplier/ราคา
--          suppliers = master รายชื่อผู้ขาย
--          item_suppliers = mapping item ↔ supplier (many-to-many)
-- ============================================================

-- 1. Suppliers master
CREATE TABLE IF NOT EXISTS public.suppliers (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  contact         TEXT,
  lead_time_days  INT NOT NULL DEFAULT 1,
  note            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Item ↔ Supplier mapping
CREATE TABLE IF NOT EXISTS public.item_suppliers (
  item_id         UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  supplier_id     INT  NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  is_preferred    BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (item_id, supplier_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_item_suppliers_item_id     ON public.item_suppliers(item_id);
CREATE INDEX IF NOT EXISTS idx_item_suppliers_supplier_id ON public.item_suppliers(supplier_id);

-- 4. Grant
GRANT SELECT ON public.suppliers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.suppliers_id_seq TO authenticated;

GRANT SELECT ON public.item_suppliers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_suppliers TO authenticated;

-- 5. Seed ผู้ขายเริ่มต้น
INSERT INTO public.suppliers (name, contact, lead_time_days, note) VALUES
  ('Makro',         NULL, 1, 'ซื้อตรง / walk-in'),
  ('ง่วนสูน',        NULL, 1, 'เครื่องปรุงจีน, ซีอิ๊ว, เต้าเจี้ยว'),
  ('ARO / Metro',   NULL, 1, 'สินค้า ARO label'),
  ('ตลาดสด',        NULL, 1, 'สมุนไพร, ผัก, วัตถุดิบสด'),
  ('ร้านเนื้อ',       NULL, 1, 'เนื้อวัว — พิคานย่า, สันนอก, เนื้อตุ๋น'),
  ('ออนไลน์/Lazada', NULL, 2, 'แพ็กเกจจิ้ง, ถุง, กล่อง')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ROLLBACK:
-- DROP TABLE IF EXISTS public.item_suppliers;
-- DROP TABLE IF EXISTS public.suppliers;
-- ============================================================
