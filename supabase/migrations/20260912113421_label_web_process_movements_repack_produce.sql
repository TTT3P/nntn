-- แปรรูป (meat-stock web-process / web-process-scrap / web-process-backfill) เดิมตกไป ELSE 'po_receive'
-- ทำให้ movement ของถุงแปรรูปดูเหมือนรับของจากซัพ → map เป็น 'repack_produce' (มีใน type_check + function_registry แล้ว)
-- forward-only: stock_movements append-only (sm_block_mutation) — แถวเก่าไม่ relabel
CREATE OR REPLACE FUNCTION public.emit_sm_from_cw_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_function text;
  v_item_type text;
BEGIN
  SELECT type INTO v_item_type FROM public.items WHERE id = NEW.item_id;

  v_function := CASE
    WHEN NEW.repack_session_id IS NOT NULL                        THEN 'repack_produce'
    WHEN NEW.cook_session_id IS NOT NULL                           THEN 'production_produce'
    WHEN NEW.source ILIKE '%repack%'                               THEN 'repack_produce'
    WHEN NEW.source ILIKE '%cook%' OR NEW.source ILIKE '%kanban%'  THEN 'production_produce'
    WHEN NEW.source ILIKE 'web-process%'                           THEN 'repack_produce'  -- แปรรูป output + เศษ
    WHEN NEW.source ILIKE '%opening_stock_seed%'                   THEN NULL  -- skip legacy seed
    ELSE 'po_receive'
  END;

  IF v_function IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.stock_movements(
    occurred_at, item_id, qty_delta, unit, weight_g,
    location_from, location_to, movement_type,
    ref_table, ref_id, lot_id, note, actor_id
  ) VALUES (
    COALESCE(NEW.created_at, NEW.lot_date::timestamptz, now()),
    NEW.item_id, 1, 'bag', NEW.weight_g,
    NULL, public._resolve_location(NEW.warehouse::text),
    v_function,
    'catch_weight', NEW.id::text, NEW.id,
    'auto-trigger: ' || v_function || CASE WHEN NEW.cook_session_id IS NOT NULL THEN ' (cook_session='||NEW.cook_session_id||')' ELSE '' END,
    public._resolve_actor()
  );
  RETURN NEW;
END $function$;
