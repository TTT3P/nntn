-- Fix rpc_manual_add_portioned after nntn-qa post-hoc FAIL (30/08/2026)
-- Addresses: D1 NULL-unsafe guard (prod), D2 actor-in-source ILIKE collision (latent),
--            D3 invariant_delta not enforced (fail-open). D4 is doc-only (BLUEPRINT/pending).
-- Authority: TINE 'ลุยเอง' word (same work), relayed via CROO 30/08.
-- Rollback: restore prior definition (git history, migration 20260830105141) and revert MT-051 tier.

-- D1 data fix: MT-051 [75G]เนื้อตุ๋น(ราดข้าว) is a portioned final item but had tier=NULL
--   (only meat item with NULL tier; category=meat_portioned, unit=bag, same shape as MT-037).
UPDATE public.items SET tier = 'final'
  WHERE sku = 'MT-051' AND type = 'meat' AND tier IS NULL;

CREATE OR REPLACE FUNCTION public.rpc_manual_add_portioned(
  p_actor text,
  p_item_id uuid,
  p_qty numeric,
  p_lot_date date DEFAULT CURRENT_DATE,
  p_warehouse character DEFAULT 'C',
  p_weight_g numeric DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item items%ROWTYPE;
  v_weight numeric;
  v_start_bag int;
  v_i int;
  v_cw_id bigint;
  v_sm_id bigint;
  v_cw_ids bigint[] := ARRAY[]::bigint[];
  v_sm_ids bigint[] := ARRAY[]::bigint[];
  v_cw_before int; v_cw_after int;
  v_sm_before numeric; v_sm_after numeric;
  v_sm_delta numeric; v_cw_delta int;
BEGIN
  PERFORM set_config('app.actor', p_actor, true);
  IF p_actor IS NULL OR length(trim(p_actor)) = 0 THEN
    RAISE EXCEPTION 'ACTOR_REQUIRED';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 OR p_qty <> floor(p_qty) THEN
    RAISE EXCEPTION 'QTY_INVALID: must be a positive whole number of bags (got %)', p_qty;
  END IF;
  IF p_warehouse IS NULL OR p_warehouse NOT IN ('A','B','C') THEN
    RAISE EXCEPTION 'WAREHOUSE_INVALID: %', p_warehouse;
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND: %', p_item_id; END IF;
  -- D1: NULL-safe guard. tier is nullable in prod; plain <> lets a NULL-tier meat item slip through.
  IF v_item.type IS DISTINCT FROM 'meat' OR v_item.tier IS DISTINCT FROM 'final' THEN
    RAISE EXCEPTION 'ITEM_NOT_PORTIONED_FINAL: sku=% type=% tier=% (this RPC is only for portioned meat, tier=final)', v_item.sku, v_item.type, v_item.tier;
  END IF;

  -- weight per bag: use provided, else derive from latest In Stock bag of this item
  v_weight := p_weight_g;
  IF v_weight IS NULL THEN
    SELECT weight_g INTO v_weight FROM public.catch_weight
      WHERE item_id = p_item_id AND status = '✅ In Stock'
      ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_weight IS NULL OR v_weight <= 0 THEN
    RAISE EXCEPTION 'WEIGHT_REQUIRED: provide p_weight_g (no in-stock bag to derive from)';
  END IF;

  SELECT COALESCE(sum(qty_delta),0) INTO v_sm_before FROM public.stock_movements WHERE item_id = p_item_id;
  SELECT count(*) INTO v_cw_before FROM public.catch_weight WHERE item_id = p_item_id AND status = '✅ In Stock';
  SELECT COALESCE(max(bag_no),0) INTO v_start_bag FROM public.catch_weight WHERE item_id = p_item_id AND lot_date = p_lot_date;

  -- D2: constant source (no actor interpolation) so emit_sm_from_cw_insert ILIKE routing can never
  --     be hijacked by an actor containing cook/kanban/repack/opening_stock_seed. '-backfill' suffix
  --     makes aim_catch_weight_trigger skip the per-row Discord notify. Actor lives in app.actor +
  --     catch_weight.actor_id (auto-stamp) and in notes below.
  FOR v_i IN 1..p_qty::int LOOP
    INSERT INTO public.catch_weight(item_id, lot_date, bag_no, weight_g, warehouse, status, source, notes, date_recorded)
    VALUES (p_item_id, p_lot_date, v_start_bag + v_i, v_weight, p_warehouse::char(1), '✅ In Stock',
            'manual-add-backfill',
            nullif(concat_ws(' · ', p_note, 'actor='||p_actor), ''),
            p_lot_date)
    RETURNING id INTO v_cw_id;
    v_cw_ids := v_cw_ids || v_cw_id;
    SELECT id INTO v_sm_id FROM public.stock_movements WHERE lot_id = v_cw_id ORDER BY id DESC LIMIT 1;
    v_sm_ids := v_sm_ids || v_sm_id;
  END LOOP;

  SELECT COALESCE(sum(qty_delta),0) INTO v_sm_after FROM public.stock_movements WHERE item_id = p_item_id;
  SELECT count(*) INTO v_cw_after FROM public.catch_weight WHERE item_id = p_item_id AND status = '✅ In Stock';
  v_sm_delta := v_sm_after - v_sm_before;
  v_cw_delta := v_cw_after - v_cw_before;

  -- D3: fail-closed. If the SM/CW invariant did not move together, abort the whole batch.
  IF v_sm_delta <> v_cw_delta THEN
    RAISE EXCEPTION 'INVARIANT_VIOLATION: sm_delta=% cw_delta=% (batch rolled back)', v_sm_delta, v_cw_delta;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'route', 'manual-add-portioned',
    'item', v_item.sku,
    'added', p_qty,
    'weight_g', v_weight,
    'warehouse', p_warehouse,
    'lot_date', p_lot_date,
    'cw_ids', v_cw_ids,
    'sm_ids', v_sm_ids,
    'cw_before', v_cw_before, 'cw_after', v_cw_after,
    'sm_before', v_sm_before, 'sm_after', v_sm_after,
    'invariant_delta', v_sm_delta - v_cw_delta,
    'note', p_note
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.rpc_manual_add_portioned(text, uuid, numeric, date, character, numeric, text) TO authenticated, service_role;
