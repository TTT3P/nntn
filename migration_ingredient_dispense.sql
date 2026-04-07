-- ============================================================
-- Migration: ingredient_dispense TABLE
-- Date: 07/04/2026
-- ใช้: เก็บวัตถุดิบที่ใช้จริงแต่ละ production_log
--      เทียบกับ BOM qty_expected → variance
-- ============================================================

CREATE TABLE IF NOT EXISTS ingredient_dispense (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_log_id uuid NOT NULL REFERENCES production_log(id) ON DELETE CASCADE,
  logged_at         date NOT NULL,
  rcp_code          text NOT NULL,
  sp_code           text,            -- SP-xxx (อาจ null สำหรับ sub-recipe)
  ingredient        text NOT NULL,   -- ชื่อวัตถุดิบ (จาก BOM)
  qty_expected      numeric,         -- theoretical จาก BOM × batch_count
  qty_actual        numeric NOT NULL CHECK (qty_actual >= 0),
  unit              text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingredient_dispense_log_idx  ON ingredient_dispense (production_log_id);
CREATE INDEX IF NOT EXISTS ingredient_dispense_date_idx ON ingredient_dispense (logged_at DESC);
CREATE INDEX IF NOT EXISTS ingredient_dispense_sku_idx  ON ingredient_dispense (sp_code);

ALTER TABLE ingredient_dispense ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_ingredient_dispense"   ON ingredient_dispense;
DROP POLICY IF EXISTS "anon_insert_ingredient_dispense" ON ingredient_dispense;

CREATE POLICY "anon_read_ingredient_dispense"
  ON ingredient_dispense FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_ingredient_dispense"
  ON ingredient_dispense FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- Variance VIEW: เทียบ expected vs actual ต่อ sp_code ต่อวัน
-- ============================================================
CREATE OR REPLACE VIEW ingredient_variance AS
SELECT
  d.logged_at,
  d.rcp_code,
  d.sp_code,
  d.ingredient,
  d.unit,
  SUM(d.qty_expected) AS qty_expected_total,
  SUM(d.qty_actual)   AS qty_actual_total,
  SUM(d.qty_actual) - SUM(d.qty_expected) AS variance,
  CASE
    WHEN SUM(d.qty_expected) = 0 THEN NULL
    ELSE ROUND(
      ((SUM(d.qty_actual) - SUM(d.qty_expected)) / SUM(d.qty_expected)) * 100,
      1
    )
  END AS variance_pct
FROM ingredient_dispense d
GROUP BY d.logged_at, d.rcp_code, d.sp_code, d.ingredient, d.unit;

GRANT SELECT ON ingredient_variance TO anon;
GRANT SELECT ON ingredient_variance TO authenticated;
