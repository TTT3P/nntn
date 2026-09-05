-- Idempotency for stock.submit_delivery — close the lost-response duplicate window (issue #53)
-- Authority: PENDING TINE deploy word (R1 prod migration). Do NOT apply until granted.
-- Follow-up to PR #52 / incident 2026-09-05 (duplicate NT20260905-2 double-deducted stock).
--
-- Problem left open by #52: if submit_delivery COMMITS on the server but the response is
--   lost in transit (network timeout / connection drop), the client enters catch with
--   _committed=false → shows fail + re-enables the button → user retries → a fresh bill_no
--   is generated (escapes the bill_no unique guard) → a SECOND delivery commits and stock
--   is double-deducted. The unique bill_no constraint cannot catch it because the retry
--   deliberately uses a new number.
--
-- Fix: the client sends a stable idempotency key per submit attempt (constant across retry).
--   The RPC records (key → delivery_id) on first commit; a retry with the same key returns
--   the original delivery_id WITHOUT committing again. A per-key transaction advisory lock
--   serializes concurrent same-key calls so the second waits for the first to commit and
--   then reads the recorded row (no race double-insert).
--
-- Backward compatible: p_idempotency_key defaults NULL. A NULL key preserves exactly the
--   old behavior (no dedup) — old clients and non-hub callers are unaffected.
--
-- Grants: CREATE FUNCTION restores EXECUTE to PUBLIC by default (this fn is SECURITY INVOKER,
--   so table access is still governed by the caller's role + RLS). We re-grant the same
--   named roles the pre-migration function carried. NOTE: submit_delivery predates the
--   2026-08-30 anon/PUBLIC lockdown (that migration scoped only public.rpc_* SECURITY DEFINER
--   fns); tightening anon here is a SEPARATE decision, not part of this change.
--
-- Falsifier (run BEFORE apply, against a copy or read-only reasoning):
--   * Old clients that omit p_idempotency_key must still commit exactly one delivery — YES,
--     param defaults NULL and the NULL branch is the original code path unchanged.
--   * Two different real submits must never collide — keys are client-random UUIDs, not
--     content hashes, so distinct attempts get distinct keys.
--   * A legit second identical non-meat delivery (same items/qty/dest/date) must still be
--     allowed — the client issues a NEW key after a confirmed success, so it is not deduped.
--
-- Verify AFTER apply (deploy-time checklist):
--   (a) authenticated hub-delivery submit (1 non-meat line) commits one delivery + one
--       stock_counts dispense; a re-POST with the SAME p_idempotency_key returns the same
--       uuid and adds NO second delivery / NO second stock_counts row.
--   (b) a submit WITHOUT p_idempotency_key still commits normally (backward compat).
--   (c) INSUFFICIENT_STOCK / bag-not-in-stock paths still raise as before.

BEGIN;

-- 1. Idempotency ledger (append-only; one row per committed submit that carried a key)
CREATE TABLE IF NOT EXISTS stock.delivery_idempotency (
  key         uuid PRIMARY KEY,
  delivery_id uuid NOT NULL REFERENCES stock.deliveries(id) ON DELETE CASCADE,
  bill_no     text,
  channel     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE stock.delivery_idempotency IS
  'submit_delivery idempotency ledger: key (client-generated per attempt) → committed delivery_id. Retry with same key returns original, no double-commit. Issue #53.';

-- 2. Replace submit_delivery: add p_idempotency_key (last, defaults NULL). Must DROP first —
--    adding a parameter changes the signature, which CREATE OR REPLACE cannot do.
DROP FUNCTION IF EXISTS stock.submit_delivery(text, text, date, text, bigint[], jsonb);

CREATE FUNCTION stock.submit_delivery(
  p_bill text,
  p_branch text,
  p_date date,
  p_channel text,
  p_bag_ids bigint[],
  p_nm_lines jsonb,
  p_idempotency_key uuid DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_delivery_id uuid;
  v_existing    uuid;
  v_bad_count   int;
  v_note_cw     text;
  v_missing     bigint[];
  v_bad_list    text;
BEGIN
  -- Idempotency short-circuit: serialize same-key callers within their tx, then reuse the
  -- delivery_id committed by the first one. Lost-response retries land here and return the
  -- original id without committing a second delivery.
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
    SELECT delivery_id INTO v_existing
      FROM stock.delivery_idempotency
     WHERE key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Defaults
  IF p_bag_ids  IS NULL THEN p_bag_ids  := ARRAY[]::bigint[]; END IF;
  IF p_nm_lines IS NULL THEN p_nm_lines := '[]'::jsonb;        END IF;

  IF coalesce(p_bill,'') = '' OR coalesce(p_branch,'') = '' OR p_date IS NULL THEN
    RAISE EXCEPTION 'submit_delivery: bill/branch/date required';
  END IF;

  IF array_length(p_bag_ids, 1) IS NULL AND jsonb_array_length(p_nm_lines) = 0 THEN
    RAISE EXCEPTION 'submit_delivery: no bags and no nm lines';
  END IF;

  v_note_cw := p_bill || ' → ' || p_branch || ' (' || p_date::text || ')';

  -- 1. Lock + validate bags
  IF array_length(p_bag_ids, 1) IS NOT NULL THEN
    PERFORM 1
      FROM public.catch_weight
      WHERE id = ANY(p_bag_ids)
      FOR UPDATE;

    SELECT count(*) INTO v_bad_count
      FROM public.catch_weight
      WHERE id = ANY(p_bag_ids)
        AND status <> '✅ In Stock';

    IF v_bad_count > 0 THEN
      SELECT string_agg(id::text || ' (' || status || ')', ', ' ORDER BY id)
        INTO v_bad_list
        FROM public.catch_weight
       WHERE id = ANY(p_bag_ids) AND status <> '✅ In Stock';
      RAISE EXCEPTION 'submit_delivery: % bag(s) not In Stock: %', v_bad_count, v_bad_list
        USING ERRCODE = 'P0001';
    END IF;

    IF (SELECT count(*) FROM public.catch_weight WHERE id = ANY(p_bag_ids)) <> array_length(p_bag_ids, 1) THEN
      SELECT array_agg(x ORDER BY x) INTO v_missing
        FROM unnest(p_bag_ids) AS x
       WHERE NOT EXISTS (SELECT 1 FROM public.catch_weight cw WHERE cw.id = x);
      RAISE EXCEPTION 'submit_delivery: bag IDs not found: %', coalesce(v_missing::text, '(duplicate ids)')
        USING ERRCODE = 'P0001';
    END IF;

    -- 2. Mark bags as Delivered (fires prevent_deliver_if_not_in_stock safety trigger)
    UPDATE public.catch_weight
       SET status = '🚚 Delivered',
           notes  = v_note_cw
     WHERE id = ANY(p_bag_ids);
  END IF;

  -- 3. Insert delivery header
  INSERT INTO stock.deliveries (bill_no, branch, date, channel)
  VALUES (p_bill, p_branch, p_date, p_channel)
  RETURNING id INTO v_delivery_id;

  -- 3b. Record idempotency key (same tx as the delivery — commits or rolls back together)
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO stock.delivery_idempotency (key, delivery_id, bill_no, channel)
    VALUES (p_idempotency_key, v_delivery_id, p_bill, p_channel);
  END IF;

  -- 4. Insert meat lines (from bags) + non-meat lines (from jsonb)
  IF array_length(p_bag_ids, 1) IS NOT NULL THEN
    INSERT INTO stock.delivery_lines (delivery_id, catch_weight_id, item_id, weight_g, qty)
    SELECT v_delivery_id, cw.id, cw.item_id, cw.weight_g, 1
      FROM public.catch_weight cw
     WHERE cw.id = ANY(p_bag_ids);
  END IF;

  IF jsonb_array_length(p_nm_lines) > 0 THEN
    INSERT INTO stock.delivery_lines (delivery_id, item_id, qty, weight_g, catch_weight_id, note)
    SELECT v_delivery_id,
           (elem->>'item_id')::uuid,
           (elem->>'qty')::numeric,
           NULL,
           NULL,
           NULLIF(elem->>'note','')
      FROM jsonb_array_elements(p_nm_lines) elem;
  END IF;

  -- 5. stock_counts 'dispense' for non-MISC nm lines
  IF jsonb_array_length(p_nm_lines) > 0 THEN
    INSERT INTO public.stock_counts (item_id, qty, dispense_qty, event_type, counted_by, note)
    SELECT (elem->>'item_id')::uuid,
           CASE
             WHEN elem->>'avail' IS NULL OR elem->>'avail' = 'null' THEN 0
             ELSE GREATEST(0, (elem->>'avail')::numeric - (elem->>'qty')::numeric)
           END,
           (elem->>'qty')::numeric,
           'dispense',
           'hub-delivery',
           p_bill || ' → ' || p_branch
      FROM jsonb_array_elements(p_nm_lines) elem
     WHERE coalesce(elem->>'is_misc','false')::boolean = false;
  END IF;

  RETURN v_delivery_id;
END;
$function$;

-- 3. Restore grants to match the pre-migration function (faithful; no security-scope change)
GRANT EXECUTE ON FUNCTION
  stock.submit_delivery(text, text, date, text, bigint[], jsonb, uuid)
  TO authenticated, anon, service_role;

COMMIT;
