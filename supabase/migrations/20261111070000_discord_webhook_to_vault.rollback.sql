-- Rollback for 20261111070000_discord_webhook_to_vault.sql
-- Puts the webhook back in public.aim_config (copied server-side from Vault — no URL literal) and makes
-- the 4 senders read aim_config again. The URL is NOT re-embedded in cw_oos_alert_check.
-- DLQ rows get the URL back from aim_config. Vault secret + getter/setter are dropped.
begin;

insert into public.aim_config(key, value)
select 'discord_webhook', public.nntn_discord_webhook()
where not exists (select 1 from public.aim_config where key = 'discord_webhook');
do $$ begin
  if (select value from public.aim_config where key = 'discord_webhook') is null then
    raise exception 'aim_config.discord_webhook empty — aborting rollback';
  end if;
end $$;

-- ─── senders read aim_config ─── ──────────────────────────────────────────────
create or replace function public.aim_notify(p_content text)
returns void language plpgsql security definer set search_path = public, net
as $function$
DECLARE v_webhook text; v_req_id bigint;
BEGIN
  v_webhook := (SELECT value FROM public.aim_config WHERE key='discord_webhook');
  IF v_webhook IS NULL THEN RETURN; END IF;
  v_req_id := net.http_post(
    url := v_webhook,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('content', p_content, 'username', 'NNTN AIM'),
    timeout_milliseconds := 5000
  );
  INSERT INTO public.aim_notify_dlq(content, webhook_url, pg_net_request_id)
  VALUES (p_content, (SELECT value FROM public.aim_config WHERE key='discord_webhook'), v_req_id);
END $function$;

create or replace function public.cw_oos_alert_check()
returns trigger language plpgsql security definer set search_path = public, net
as $function$
DECLARE
  v_item_id uuid;
  v_item record;
  v_qty int;
  v_last_alert timestamptz;
  v_webhook_url text;
  v_payload jsonb;
  v_msg text;
  v_req_id bigint;
BEGIN
  v_item_id := COALESCE(NEW.item_id, OLD.item_id);
  IF v_item_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, sku, name, type, tier INTO v_item
  FROM public.items
  WHERE id = v_item_id AND type='meat' AND tier='raw' AND is_active=true;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_qty
  FROM public.catch_weight
  WHERE item_id = v_item_id AND status = '✅ In Stock';

  IF v_qty > 2 THEN RETURN NEW; END IF;

  -- Throttle via alert_log (legacy) OR dlq
  SELECT GREATEST(
    COALESCE((SELECT MAX(triggered_at) FROM public.cw_oos_alert_log WHERE item_id = v_item_id), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(triggered_at) FROM public.nntn_webhook_dlq WHERE sku_code = v_item.sku), '-infinity'::timestamptz)
  ) INTO v_last_alert;
  IF v_last_alert > now() - interval '6 hours' THEN RETURN NEW; END IF;

  v_webhook_url := (SELECT value FROM public.aim_config WHERE key='discord_webhook');
  IF v_webhook_url IS NULL THEN RETURN NEW; END IF;

  v_msg := CASE WHEN v_qty = 0
    THEN '🚨 **OUT OF STOCK** — ' || v_item.sku || ' ' || v_item.name || E'\nเนื้อดิบหมดแล้ว · ต้องสั่ง/รับเข้าใหม่'
    ELSE '⚠️ **Low stock** — ' || v_item.sku || ' ' || v_item.name || E'\nเหลือ ' || v_qty || ' ถุง (≤2 threshold) · เตรียมสั่งเพิ่ม'
  END;

  v_payload := jsonb_build_object('content', v_msg, 'username', 'NNTN OOS Alert');

  -- Fire with 5s timeout + capture request id
  v_req_id := net.http_post(
    url := v_webhook_url,
    body := v_payload,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  -- Insert into DLQ (crash-safe audit — survives even if response never lands)
  INSERT INTO public.nntn_webhook_dlq(
    sku_code, sku_name, qty_bags,
    discord_webhook_url, payload, pg_net_request_id
  ) VALUES (
    v_item.sku, v_item.name, v_qty,
    (SELECT value FROM public.aim_config WHERE key='discord_webhook'), v_payload::text, v_req_id
  );

  -- Legacy log (keep writing for backward compat with queries)
  INSERT INTO public.cw_oos_alert_log(item_id, sku, qty_at_alert, webhook_response)
  VALUES (v_item_id, v_item.sku, v_qty, jsonb_build_object('request_id', v_req_id));

  RETURN NEW;
END $function$;

create or replace function public.nntn_retry_aim_failures()
returns integer language plpgsql security definer set search_path = public, net
as $function$
DECLARE rec record; new_req_id bigint; backoff_min int; v_count int := 0; v_webhook text;
BEGIN
  v_webhook := (SELECT value FROM public.aim_config WHERE key='discord_webhook');
  IF v_webhook IS NULL THEN RETURN 0; END IF;
  FOR rec IN
    SELECT dl.* FROM public.aim_notify_dlq dl
    LEFT JOIN net._http_response r ON r.id = COALESCE(dl.last_pg_net_request_id, dl.pg_net_request_id)
    WHERE dl.delivered=false AND dl.retry_count<5
      AND (dl.next_retry_at IS NULL OR dl.next_retry_at <= now())
      AND (r.id IS NULL OR r.status_code IS NULL OR r.status_code>=500 OR r.status_code=429 OR r.timed_out=true)
    ORDER BY dl.triggered_at ASC LIMIT 10
  LOOP
    backoff_min := POWER(2, rec.retry_count)::int;
    new_req_id := net.http_post(url:=v_webhook,
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:=jsonb_build_object('content', rec.content, 'username', 'NNTN AIM'),
      timeout_milliseconds:=5000);
    UPDATE public.aim_notify_dlq
      SET retry_count=retry_count+1, last_retry_at=now(),
          next_retry_at=now()+(backoff_min||' minutes')::interval,
          last_pg_net_request_id=new_req_id
    WHERE id=rec.id;
    v_count := v_count+1;
  END LOOP;
  RETURN v_count;
END $function$;

create or replace function public.nntn_retry_failed_oos_alerts()
returns integer language plpgsql security definer set search_path = public, net
as $function$
DECLARE
  rec RECORD;
  new_request_id bigint;
  backoff_minutes int;
  v_count int := 0;
  v_webhook text;
BEGIN
  v_webhook := (SELECT value FROM public.aim_config WHERE key='discord_webhook');
  IF v_webhook IS NULL THEN RETURN 0; END IF;
  FOR rec IN
    SELECT dl.*
    FROM public.nntn_webhook_dlq dl
    LEFT JOIN net._http_response r ON r.id = COALESCE(dl.last_pg_net_request_id, dl.pg_net_request_id)
    WHERE dl.delivered = false
      AND dl.retry_count < 5
      AND (dl.next_retry_at IS NULL OR dl.next_retry_at <= now())
      AND (
        r.id IS NULL                 -- response lost (crash/TTL)
        OR r.status_code IS NULL     -- network failure
        OR r.status_code >= 500      -- server error (retryable)
        OR r.status_code = 429       -- rate limited
        OR r.timed_out = true        -- timeout
      )
    ORDER BY dl.triggered_at ASC
    LIMIT 10
  LOOP
    backoff_minutes := POWER(2, rec.retry_count)::int;

    new_request_id := net.http_post(
      url := v_webhook,
      body := rec.payload::jsonb,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );

    UPDATE public.nntn_webhook_dlq
    SET retry_count = retry_count + 1,
        last_retry_at = now(),
        next_retry_at = now() + (backoff_minutes || ' minutes')::interval,
        last_pg_net_request_id = new_request_id
    WHERE id = rec.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $function$;


update public.aim_notify_dlq  set webhook_url         = (select value from public.aim_config where key='discord_webhook') where webhook_url         = 'vault:discord_webhook_ops';
update public.nntn_webhook_dlq set discord_webhook_url = (select value from public.aim_config where key='discord_webhook') where discord_webhook_url = 'vault:discord_webhook_ops';

drop function if exists public.nntn_set_discord_webhook(text);
drop function if exists public.nntn_discord_webhook();
delete from vault.secrets where name = 'discord_webhook_ops';

commit;
