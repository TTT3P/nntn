-- ============================================================
-- Migration: catch_weight updated_at bump trigger
-- Date: 2026-07-19
-- ใช้: แก้บั๊ก updated_at ไม่ขยับตอนเปลี่ยน status/weight/warehouse
--      (ถุงที่ Delivered แล้ว updated_at ยังค้างที่ created_at ตอน INSERT
--       ทำให้พนักงานเข้าใจผิดว่าถุงยังไม่ถูกส่ง — เคสจริง MT-047 id=14045
--       18/07/2026: updated_at=17/07 09:30 = created_at แม้ status=Delivered)
--      สร้าง BEFORE UPDATE trigger บน public.catch_weight bump
--      updated_at = now() ทุกครั้งที่มี UPDATE ใดๆ (ตาม pattern per-table
--      เดิมของระบบ เช่น cookingbook.tg_sop_steps_updated_at)
--
-- Trigger order note: catch_weight มี BEFORE trigger เดิมอยู่แล้ว 2 ตัว —
--   prevent_deliver_if_not_in_stock (เช็ค/RAISE เท่านั้น ไม่แก้ NEW)
--   stamp_actor_catch_weight        (แก้ NEW.actor_id / NEW.updated_by)
-- Postgres รัน BEFORE ROW trigger เรียงตามชื่อ (a→z):
--   catch_weight_bump_updated_at → prevent_deliver_if_not_in_stock → stamp_actor_catch_weight
-- ไม่ชนกัน เพราะแต่ละตัวแก้คนละคอลัมน์ (ไม่มีตัวไหนอ่าน/เขียน updated_at ซ้ำ)
--
-- Verify: ทดสอบบน Supabase dev/preview branch (แยกจาก prod emjqulzikpxorvpaaiww
--      ไม่ได้รันบน prod) — UPDATE status In Stock → Delivered บนแถวทดสอบ:
--      updated_at ก่อน = created_at (07:09:43.826359+00)
--      updated_at หลัง = เวลา UPDATE จริง (07:09:58.46949+00) — ตรงกับ now() ของ DB
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_catch_weight_bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS catch_weight_bump_updated_at ON public.catch_weight;

CREATE TRIGGER catch_weight_bump_updated_at
  BEFORE UPDATE ON public.catch_weight
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_catch_weight_bump_updated_at();

-- ============================================================
-- Rollback (ถ้าต้องถอย):
-- DROP TRIGGER IF EXISTS catch_weight_bump_updated_at ON public.catch_weight;
-- DROP FUNCTION IF EXISTS public.tg_catch_weight_bump_updated_at();
-- ============================================================
