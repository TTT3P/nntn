-- platform_auto_reconcile เลิกสั่ง ALTER TABLE ทุก 5 นาที (TINE 2026-10-21 "แก้ข้อ 1 ก่อนเลย" · อาการ "เบิกของแล้วค้าง")
--
-- เดิม: cron nntn-platform-auto-reconcile (*/5) เรียก platform_auto_reconcile() ซึ่ง
--   ALTER TABLE stock_counts DISABLE/ENABLE TRIGGER aim_stock_counts_trg ทุกรอบ (แม้ไม่มีอะไรต้อง sync)
--   → 1) ALTER TABLE = DDL → event trigger pgrst_ddl_watch ยิง NOTIFY pgrst
--        → PostgREST reload schema cache + สร้าง connection pool ใหม่ทุก 5 นาที
--        (postgrest_logs 12 ครั้ง/ชม. ตรงเวลา cron · pg_stat_statements สะสม ~12.8k รอบตั้งแต่ 07/09)
--   → 2) ถือ ShareRowExclusiveLock บน stock_counts ตลอด transaction (เฉลี่ย 122ms สูงสุด 3.3s)
--        → การเบิก/นับ/รับเข้าที่ insert stock_counts ช่วงนั้นต้องรอ
--   → 3) DISABLE TRIGGER มีผลกับทุก session ไม่ใช่แค่ reconcile
--
-- Fix: ปิดแจ้งเตือน AIM เฉพาะ transaction ของ reconcile ด้วยธง GUC `nntn.skip_aim` (set_config is_local)
--   · aim_stock_counts_trigger ข้ามเมื่อธง = 'on' · ไม่มี DDL → ไม่ reload · ไม่ล็อกตาราง
--   · ผลลัพธ์ reconcile (แถว stock_counts + platform_reconcile_log) เหมือนเดิมทุกอย่าง
--
-- Rollback: apply นิยามเดิมด้านล่าง (=== DOWN ===) · snapshot 2026-10-21 จาก pg_get_functiondef

-- === UP ===
CREATE OR REPLACE FUNCTION public.aim_stock_counts_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_name text; v_unit text; v_recv numeric;
BEGIN
  -- platform_auto_reconcile ตั้งธงนี้เฉพาะ transaction ของตัวเอง (กัน 429 flood ตอน bulk insert)
  IF current_setting('nntn.skip_aim', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT i.name, i.unit INTO v_name, v_unit
  FROM public.items i WHERE i.id = NEW.item_id;

  IF NEW.event_type = 'receive' THEN
    -- Parse amount received from note (rpc_receive_universal: "รับ X กก.")
    v_recv := NULLIF((regexp_match(COALESCE(NEW.note,''), 'รับ\s+([0-9]+(?:\.[0-9]+)?)'))[1], '')::numeric;
    -- Legacy fallback "(N หน่วย)"
    IF v_recv IS NULL THEN
      v_recv := NULLIF((regexp_match(COALESCE(NEW.note,''), '\(([0-9]+(?:\.[0-9]+)?)\s*หน่วย\)'))[1], '')::numeric;
    END IF;
  ELSIF NEW.event_type = 'dispense' THEN
    v_recv := NEW.dispense_qty;
  ELSE
    v_recv := NULL;
  END IF;

  INSERT INTO public.aim_outbox(event_type, actor, source, item_id, item_name, item_unit, qty, balance_after)
  VALUES (NEW.event_type, NEW.counted_by, 'stock_counts', NEW.item_id, v_name, v_unit, v_recv, NEW.qty);

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.platform_auto_reconcile()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_details jsonb := '[]'::jsonb;
  rec RECORD;
BEGIN
  -- ปิด AIM เฉพาะ transaction นี้ระหว่าง bulk insert (avoid 429 flood) · ไม่ใช้ DDL
  PERFORM set_config('nntn.skip_aim', 'on', true);

  FOR rec IN
    WITH latest AS (
      SELECT DISTINCT ON (item_id) item_id, qty AS sc_qty FROM public.stock_counts ORDER BY item_id, counted_at DESC
    ),
    agg AS (SELECT item_id, SUM(qty_delta) AS sm_qty FROM public.stock_movements GROUP BY item_id)
    SELECT i.id, i.sku, i.name,
      GREATEST(0, COALESCE(a.sm_qty,0))::numeric AS target_qty,
      COALESCE(l.sc_qty,0)::numeric AS prev_qty
    FROM public.items i
    LEFT JOIN agg a ON a.item_id=i.id
    LEFT JOIN latest l ON l.item_id=i.id
    WHERE i.type IN ('non_meat','packaging') AND i.is_active=true
      AND ABS(COALESCE(a.sm_qty,0) - COALESCE(l.sc_qty,0)) > 0.001
  LOOP
    INSERT INTO public.stock_counts (counted_at, counted_by, item_id, qty, note, event_type)
    VALUES (now(), 'platform_auto_reconcile', rec.id, rec.target_qty,
      'auto-sync: sm='||rec.target_qty||' prev sc='||rec.prev_qty, 'count');
    v_details := v_details || jsonb_build_object('sku', rec.sku, 'from', rec.prev_qty, 'to', rec.target_qty);
    v_count := v_count + 1;
  END LOOP;

  PERFORM set_config('nntn.skip_aim', 'off', true);

  IF v_count > 0 THEN
    INSERT INTO public.platform_reconcile_log(skus_synced, details) VALUES (v_count, v_details);
  END IF;
  RETURN v_count;
END $function$;

-- === DOWN (rollback) ===
-- นิยามเดิม snapshot 2026-10-21 (pg_get_functiondef ก่อน apply) — รันส่วนนี้เพื่อย้อน
-- CREATE OR REPLACE FUNCTION public.aim_stock_counts_trigger()
--  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
-- AS $function$
-- DECLARE
--   v_name text; v_unit text; v_recv numeric;
-- BEGIN
--   SELECT i.name, i.unit INTO v_name, v_unit
--   FROM public.items i WHERE i.id = NEW.item_id;
--   IF NEW.event_type = 'receive' THEN
--     v_recv := NULLIF((regexp_match(COALESCE(NEW.note,''), 'รับ\s+([0-9]+(?:\.[0-9]+)?)'))[1], '')::numeric;
--     IF v_recv IS NULL THEN
--       v_recv := NULLIF((regexp_match(COALESCE(NEW.note,''), '\(([0-9]+(?:\.[0-9]+)?)\s*หน่วย\)'))[1], '')::numeric;
--     END IF;
--   ELSIF NEW.event_type = 'dispense' THEN
--     v_recv := NEW.dispense_qty;
--   ELSE
--     v_recv := NULL;
--   END IF;
--   INSERT INTO public.aim_outbox(event_type, actor, source, item_id, item_name, item_unit, qty, balance_after)
--   VALUES (NEW.event_type, NEW.counted_by, 'stock_counts', NEW.item_id, v_name, v_unit, v_recv, NEW.qty);
--   RETURN NEW;
-- END $function$;
--
-- CREATE OR REPLACE FUNCTION public.platform_auto_reconcile()
--  RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   v_count int := 0;
--   v_details jsonb := '[]'::jsonb;
--   rec RECORD;
-- BEGIN
--   ALTER TABLE public.stock_counts DISABLE TRIGGER aim_stock_counts_trg;
--   FOR rec IN
--     WITH latest AS (
--       SELECT DISTINCT ON (item_id) item_id, qty AS sc_qty FROM public.stock_counts ORDER BY item_id, counted_at DESC
--     ),
--     agg AS (SELECT item_id, SUM(qty_delta) AS sm_qty FROM public.stock_movements GROUP BY item_id)
--     SELECT i.id, i.sku, i.name,
--       GREATEST(0, COALESCE(a.sm_qty,0))::numeric AS target_qty,
--       COALESCE(l.sc_qty,0)::numeric AS prev_qty
--     FROM public.items i
--     LEFT JOIN agg a ON a.item_id=i.id
--     LEFT JOIN latest l ON l.item_id=i.id
--     WHERE i.type IN ('non_meat','packaging') AND i.is_active=true
--       AND ABS(COALESCE(a.sm_qty,0) - COALESCE(l.sc_qty,0)) > 0.001
--   LOOP
--     INSERT INTO public.stock_counts (counted_at, counted_by, item_id, qty, note, event_type)
--     VALUES (now(), 'platform_auto_reconcile', rec.id, rec.target_qty,
--       'auto-sync: sm='||rec.target_qty||' prev sc='||rec.prev_qty, 'count');
--     v_details := v_details || jsonb_build_object('sku', rec.sku, 'from', rec.prev_qty, 'to', rec.target_qty);
--     v_count := v_count + 1;
--   END LOOP;
--   ALTER TABLE public.stock_counts ENABLE TRIGGER aim_stock_counts_trg;
--   IF v_count > 0 THEN
--     INSERT INTO public.platform_reconcile_log(skus_synced, details) VALUES (v_count, v_details);
--   END IF;
--   RETURN v_count;
-- END $function$;
