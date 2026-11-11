-- Security lockdown: anon key access to definer views / functions + RLS on stock.delivery_idempotency
--
-- Why: Supabase Security Advisor (Critical mail, 2026-11-08) — TINE → CROO → nntn 2026-11-11.
-- The anon key is public by design (hardcoded in the GitHub Pages HTML of a public repo), so
-- anything `anon` can read or execute is readable/executable by anyone on the internet.
-- Live audit 2026-11-11 (SET ROLE anon, read-only):
--   * anon could SELECT through SECURITY DEFINER views (bypassing table RLS): v_stock_unified (257 rows),
--     v_count_adjust_log (1349), v_production_history (2092), cookingbook.ingredients (160, prices),
--     cookingbook.recipe_costs (112, costs), sales_ops.v_weekly_variance (787)
--   * anon could EXECUTE 28 SECURITY DEFINER functions with no auth check in the body, incl.
--     aim_notify(p_content) (posts arbitrary text to the ops Discord), delete_cooking_session,
--     platform_auto_reconcile, nntn_log_retention (deletes), nntn_retry_* / nntn_confirm_*
--   * stock.delivery_idempotency had RLS off (anon had no grant; authenticated SELECT+INSERT)
--
-- Who still needs what (verified against the web code on main 1547b1f and cron.job):
--   * every page reading these views loads auth.js → requests carry the user JWT (role authenticated)
--   * platform-health.html calls platform_* readers — loads auth.js → authenticated
--   * all cron jobs run as postgres (owner) → unaffected by revokes
--   * trigger functions: EXECUTE is checked at CREATE TRIGGER, not when the trigger fires → unaffected
--   * public.v_active_skus is anon-readable ON PURPOSE (meat-stock/check-sku-refs.js in sku-guard CI,
--     columns sku,is_active only) → keeps anon SELECT and stays SECURITY DEFINER (as invoker anon
--     would lose it, since anon has no grant on public.items)
--   * stock.submit_delivery is SECURITY INVOKER and reads/writes delivery_idempotency as
--     authenticated → RLS policies below keep exactly that
--
-- Out of scope (flagged, not changed here): meeting.html (no auth.js) reads/inserts
-- meeting_messages as anon by design; projects/project_updates/commitments anon read policies
-- (goal-dashboard.html already uses auth.js); hardcoded Discord webhook in cw_oos_alert_check.
--
-- Rollback: 20261111060000_security_lockdown_anon_definer.rollback.sql (same folder).

begin;

-- ─── 1. stock.delivery_idempotency: RLS on, same access as before ─────────────
alter table stock.delivery_idempotency enable row level security;
create policy delivery_idempotency_auth_select on stock.delivery_idempotency
  for select to authenticated using (true);
create policy delivery_idempotency_auth_insert on stock.delivery_idempotency
  for insert to authenticated with check (true);

-- ─── 2. Views: anon loses the definer bypass ─────────────────────────────────
revoke select on public.v_stock_unified, public.v_count_adjust_log, public.v_production_history,
                 cookingbook.ingredients, cookingbook.recipe_costs, cookingbook.srcp_cost_recursive,
                 sales_ops.v_weekly_variance
  from anon;

-- definer → invoker (rows seen by authenticated verified identical, 14/14 views, 2026-11-11)
alter view cookingbook.ingredients            set (security_invoker = true);
alter view cookingbook.recipe_costs           set (security_invoker = true);
alter view public.current_stock               set (security_invoker = true);
alter view public.v_count_adjust_log          set (security_invoker = true);
alter view public.v_divergence_mttr_30d       set (security_invoker = true);
alter view public.v_meat_production_variance  set (security_invoker = true);
alter view public.v_production_history        set (security_invoker = true);
alter view public.v_production_reconciliation set (security_invoker = true);
alter view public.v_production_yield          set (security_invoker = true);
alter view public.v_sm_cw_divergence          set (security_invoker = true);
alter view public.v_stock_unified             set (security_invoker = true);
alter view public.v_user_actions_daily        set (security_invoker = true);
alter view sales_ops.v_weekly_variance        set (security_invoker = true);
-- public.v_active_skus intentionally stays definer + anon (see header)

-- ─── 3. Functions ────────────────────────────────────────────────────────────
-- 3a. trigger functions — nobody calls these via /rpc
revoke execute on function
  public.aim_catch_weight_trigger(), public.aim_cw_status_summary_trigger(),
  public.aim_deliveries_trigger(), public.aim_items_trigger(), public.aim_process_summary_trigger(),
  public.aim_stock_counts_trigger(), public.check_stock_before_dispense(),
  public.cw_oos_alert_check(), public.emit_sm_cascade_bundle()
  from public, anon, authenticated;

-- 3b. cron / internal only (cron runs as postgres)
revoke execute on function
  public.aim_notify(text), public.aim_outbox_drain(integer),
  public.nntn_confirm_aim_deliveries(), public.nntn_confirm_deliveries(),
  public.nntn_divergence_audit(), public.nntn_divergence_snapshot(), public.nntn_log_retention(),
  public.nntn_retry_aim_failures(), public.nntn_retry_failed_oos_alerts(), public.nntn_weekly_digest(),
  public.platform_auto_reconcile()
  from public, anon, authenticated;

-- 3c. platform-health.html readers — logged-in users only
revoke execute on function
  public.platform_audit_recent(integer), public.platform_health_delivery_24h(),
  public.platform_health_dlq_stuck(), public.platform_health_drift(), public.platform_health_negative(),
  public.platform_invariants(), public.platform_slos()
  from public, anon;
grant execute on function
  public.platform_audit_recent(integer), public.platform_health_delivery_24h(),
  public.platform_health_dlq_stuck(), public.platform_health_drift(), public.platform_health_negative(),
  public.platform_invariants(), public.platform_slos()
  to authenticated;

-- 3d. delete_cooking_session — no caller found in the web code; anon removed, authenticated kept
--     (decide later whether to drop authenticated too)
revoke execute on function public.delete_cooking_session(uuid, text) from public, anon;
grant execute on function public.delete_cooking_session(uuid, text) to authenticated;

-- ─── 4. Stop recurrence: new functions are not anon-executable by default ──────
-- PUBLIC's EXECUTE default on functions is global (Postgres ignores a per-schema revoke of it),
-- so revoke it globally for role postgres. Live default ACLs (2026-11-11): schema public already
-- grants authenticated/service_role/anon per-schema; stock/cookingbook/sales_ops have NO per-schema
-- default and relied on PUBLIC → give them authenticated + service_role explicitly so new functions
-- for the logged-in hub keep working, and drop anon's per-schema default in public.
-- Existing functions keep their current ACLs (default privileges only affect future objects).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema stock, cookingbook, sales_ops
  grant execute on functions to authenticated, service_role;

commit;
