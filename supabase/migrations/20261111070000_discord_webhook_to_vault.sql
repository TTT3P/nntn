-- Move the ops Discord webhook out of code/config into Supabase Vault (prep for rotation)
--
-- Why: 2026-11-11 security triage found the ops webhook URL
--   * hardcoded as a literal in public.cw_oos_alert_check (OOS alerts)
--   * stored in public.aim_config('discord_webhook') — readable/writable by EVERY logged-in user
--     (policy authenticated_all) — used by aim_notify
--   * copied into every DLQ row: aim_notify_dlq.webhook_url (159) + nntn_webhook_dlq.discord_webhook_url (13),
--     both readable by authenticated
-- The literal and the aim_config value are the same webhook (md5 equal) → one secret serves both.
-- TINE word via CROO 2026-11-11 ("ทำแทนผมดิ" / "ลุย"): migration + rotation, apply after nntn-qa PASS.
--
-- This file contains NO webhook URL. The secret is copied server-side from aim_config.
-- Rotation afterwards = one call to public.nntn_set_discord_webhook(url) (service_role/postgres only).
--
-- After this migration:
--   * Vault secret 'discord_webhook_ops' holds the URL (vault.decrypted_secrets: no anon/authenticated access)
--   * public.nntn_discord_webhook() reads it — owner-only (callers are SECURITY DEFINER functions)
--   * aim_notify / cw_oos_alert_check / nntn_retry_aim_failures / nntn_retry_failed_oos_alerts read the
--     CURRENT secret at send time (retries of old DLQ rows also go to the current URL after rotation)
--   * DLQ url columns store the marker 'vault:discord_webhook_ops' instead of the URL (existing rows scrubbed)
--   * aim_config row 'discord_webhook' deleted
-- Bodies are otherwise identical to the live definitions read 2026-11-11 (only the URL source changed).
-- Grants: CREATE OR REPLACE keeps the ACLs set by 20261111060000_security_lockdown_anon_definer.
--
-- Not changed: supabase_migrations.schema_migrations still holds the OLD url in 3 historical entries
-- (20260416105525, 20260420150812, 20260420155025; postgres-only) — dead once the old webhook is deleted.
-- Rollback: 20261111070000_discord_webhook_to_vault.rollback.sql

begin;

-- ─── 1. Vault secret, copied server-side from the current config ─────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'discord_webhook_ops') then
    perform vault.create_secret(
      (select value from public.aim_config where key = 'discord_webhook'),
      'discord_webhook_ops',
      'NNTN ops Discord webhook (AIM + OOS alerts). Set via public.nntn_set_discord_webhook(url).');
  end if;
  if (select decrypted_secret from vault.decrypted_secrets where name = 'discord_webhook_ops') is null then
    raise exception 'discord_webhook_ops is empty — aborting';
  end if;
end $$;

-- ─── 2. Getter (owner-only) ──────────────────────────────────────────────────
create or replace function public.nntn_discord_webhook()
returns text language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'discord_webhook_ops' limit 1 $$;
revoke all on function public.nntn_discord_webhook() from public, anon, authenticated;

-- ─── 3. Setter for rotation (owner/service_role only; never echoes the value) ───
create or replace function public.nntn_set_discord_webhook(p_url text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if p_url is null or p_url !~ '^https://(discord|discordapp)\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception 'nntn_set_discord_webhook: value is not a Discord webhook URL';
  end if;
  select id into v_id from vault.secrets where name = 'discord_webhook_ops';
  if v_id is null then raise exception 'nntn_set_discord_webhook: secret discord_webhook_ops missing'; end if;
  perform vault.update_secret(v_id, p_url);
  return jsonb_build_object('webhook_id', substring(p_url from 'webhooks/([0-9]+)/'), 'updated_at', now());
end $$;
revoke all on function public.nntn_set_discord_webhook(text) from public, anon, authenticated;
grant execute on function public.nntn_set_discord_webhook(text) to service_role;

-- ─── 4. Senders read the secret ──────────────────────────────────────────────
create or replace function public.aim_notify(p_content text)
returns void language plpgsql security definer set search_path = public, net
as $function$
DECLARE v_webhook text; v_req_id bigint;
BEGIN
  v_webhook := public.nntn_discord_webhook();
  IF v_webhook IS NULL THEN RETURN; END IF;
  v_req_id := net.http_post(
    url := v_webhook,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('content', p_content, 'username', 'NNTN AIM'),
    timeout_milliseconds := 5000
  );
  INSERT INTO public.aim_notify_dlq(content, webhook_url, pg_net_request_id)
  VALUES (p_content, 'vault:discord_webhook_ops', v_req_id);
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

  v_webhook_url := public.nntn_discord_webhook();
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
    'vault:discord_webhook_ops', v_payload::text, v_req_id
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
  v_webhook := public.nntn_discord_webhook();
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
  v_webhook := public.nntn_discord_webhook();
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

-- ─── 5. Scrub stored copies ──────────────────────────────────────────────────
update public.aim_notify_dlq  set webhook_url         = 'vault:discord_webhook_ops' where webhook_url         ~ 'discord(app)?\.com/api/webhooks/';
update public.nntn_webhook_dlq set discord_webhook_url = 'vault:discord_webhook_ops' where discord_webhook_url ~ 'discord(app)?\.com/api/webhooks/';
delete from public.aim_config where key = 'discord_webhook';

commit;
