-- Rollback for 20261111060000_security_lockdown_anon_definer.sql
-- Restores the pre-2026-11-11 grants exactly as audited live (do NOT run unless the lockdown broke
-- something — this re-opens the anon exposure).
begin;

drop policy if exists delivery_idempotency_auth_select on stock.delivery_idempotency;
drop policy if exists delivery_idempotency_auth_insert on stock.delivery_idempotency;
alter table stock.delivery_idempotency disable row level security;

alter view cookingbook.ingredients            reset (security_invoker);
alter view cookingbook.recipe_costs           reset (security_invoker);
alter view public.current_stock               reset (security_invoker);
alter view public.v_count_adjust_log          reset (security_invoker);
alter view public.v_divergence_mttr_30d       reset (security_invoker);
alter view public.v_meat_production_variance  reset (security_invoker);
alter view public.v_production_history        reset (security_invoker);
alter view public.v_production_reconciliation reset (security_invoker);
alter view public.v_production_yield          reset (security_invoker);
alter view public.v_sm_cw_divergence          reset (security_invoker);
alter view public.v_stock_unified             reset (security_invoker);
alter view public.v_user_actions_daily        reset (security_invoker);
alter view sales_ops.v_weekly_variance        reset (security_invoker);
grant select on public.v_stock_unified, public.v_count_adjust_log, public.v_production_history,
                cookingbook.ingredients, cookingbook.recipe_costs, cookingbook.srcp_cost_recursive,
                sales_ops.v_weekly_variance
  to anon;

grant execute on function
  public.aim_catch_weight_trigger(), public.aim_cw_status_summary_trigger(),
  public.aim_deliveries_trigger(), public.aim_items_trigger(), public.aim_process_summary_trigger(),
  public.aim_stock_counts_trigger(), public.check_stock_before_dispense(),
  public.cw_oos_alert_check(), public.emit_sm_cascade_bundle(),
  public.aim_notify(text), public.aim_outbox_drain(integer),
  public.nntn_confirm_aim_deliveries(), public.nntn_confirm_deliveries(),
  public.nntn_divergence_audit(), public.nntn_divergence_snapshot(), public.nntn_log_retention(),
  public.nntn_retry_aim_failures(), public.nntn_retry_failed_oos_alerts(), public.nntn_weekly_digest(),
  public.platform_auto_reconcile(),
  public.platform_audit_recent(integer), public.platform_health_delivery_24h(),
  public.platform_health_dlq_stuck(), public.platform_health_drift(), public.platform_health_negative(),
  public.platform_invariants(), public.platform_slos(),
  public.delete_cooking_session(uuid, text)
  to public, anon, authenticated;

alter default privileges for role postgres grant execute on functions to public;
alter default privileges for role postgres in schema public grant execute on functions to anon;
alter default privileges for role postgres in schema stock, cookingbook, sales_ops
  revoke execute on functions from authenticated, service_role;

commit;
