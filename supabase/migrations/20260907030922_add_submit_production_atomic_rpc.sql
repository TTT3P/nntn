-- Atomic production submit RPC (stock V1)
--
-- Finding 2026-09-07 (whole-web audit): production-log-form insert 2 ตารางแยก
-- (production_log loop + ingredient_dispense) ไม่ atomic → ถ้า ingredient_dispense
-- ล้มหลัง production_log commit → user กดซ้ำ = re-insert production_log ซ้ำ (ไม่มี guard).
-- คลาสเดียวกับ delivery 5/9 + atomic-violation 18/04.
--
-- Fix: public.submit_production() insert ทั้ง 2 ตารางในทรานแซกชันเดียว (all-or-nothing).
-- SECURITY INVOKER → รันด้วยสิทธิ์ authenticated เหมือน insert ตรงเดิม (RLS + actor_verified trigger ทำงานปกติ).
--
-- Applied to prod (emjqulzikpxorvpaaiww) 2026-09-07 via MCP apply_migration (verified: self-test ok + cleaned).
-- Rollback: drop function public.submit_production(jsonb, jsonb);

create or replace function public.submit_production(
  p_logs jsonb,      -- [{ref, logged_at, logged_by, rcp_code, rcp_name, batch_count, type, note, output_qty, output_unit, waste_qty}]
  p_dispense jsonb   -- [{log_ref, logged_at, rcp_code, sp_code, ingredient, qty_expected, qty_actual, unit, note}]
) returns jsonb
language plpgsql
as $$
declare
  v_map jsonb := '{}'::jsonb;
  v_log jsonb; v_disp jsonb; v_new_id uuid;
  v_log_count int := 0; v_disp_count int := 0;
begin
  if p_logs is null or jsonb_array_length(p_logs) = 0 then
    raise exception 'submit_production: no production_log rows';
  end if;

  for v_log in select * from jsonb_array_elements(p_logs) loop
    insert into public.production_log
      (logged_at, logged_by, rcp_code, rcp_name, batch_count, type, note, output_qty, output_unit, waste_qty)
    values (
      coalesce(nullif(v_log->>'logged_at','')::date, current_date),
      v_log->>'logged_by', v_log->>'rcp_code', v_log->>'rcp_name',
      (v_log->>'batch_count')::numeric, v_log->>'type', v_log->>'note',
      nullif(v_log->>'output_qty','')::numeric, v_log->>'output_unit',
      nullif(v_log->>'waste_qty','')::numeric
    ) returning id into v_new_id;
    v_log_count := v_log_count + 1;
    v_map := v_map || jsonb_build_object(v_log->>'ref', v_new_id::text);
  end loop;

  if p_dispense is not null and jsonb_array_length(p_dispense) > 0 then
    for v_disp in select * from jsonb_array_elements(p_dispense) loop
      insert into public.ingredient_dispense
        (production_log_id, logged_at, rcp_code, sp_code, ingredient, qty_expected, qty_actual, unit, note)
      values (
        (v_map->>(v_disp->>'log_ref'))::uuid,
        coalesce(nullif(v_disp->>'logged_at','')::date, current_date),
        v_disp->>'rcp_code', v_disp->>'sp_code', v_disp->>'ingredient',
        (v_disp->>'qty_expected')::numeric, (v_disp->>'qty_actual')::numeric,
        v_disp->>'unit', v_disp->>'note'
      );
      v_disp_count := v_disp_count + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'log_count', v_log_count, 'dispense_count', v_disp_count, 'ids', v_map);
end;
$$;

revoke all on function public.submit_production(jsonb, jsonb) from public, anon;
grant execute on function public.submit_production(jsonb, jsonb) to authenticated, service_role;
