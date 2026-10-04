-- Weekly health check รอบ 3: submit_log ครอบทุกหน้า (Phase B — รับ PO · ผลิต · เบิก · Loss) (TINE 2026-10-04 "ลุย")
-- เดิมหัวข้อ "ใบนำส่งกดแล้วล้ม" นับรวมทุก action → adjust_* (ไม่มี attempt) หักล้างยอด attempt ของ action อื่นได้
-- แก้: นับ ล้ม/ไม่จบ แยกต่อ action · cancel ไม่นับ (ใบนำส่ง log cancel ก่อน attempt) · หัวข้อ "กดบันทึกแล้วล้ม/ไม่จบ (7 วัน)" แสดงรายการต่อ action
-- Rollback: apply นิยามจาก 20261004042202_weekly_health_incident_checks.sql

create or replace function public.platform_weekly_health_text()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_inv text; v_dup text; v_disp text; v_sub text; v_po text; v_close text; v_db text;
begin
  select string_agg(format('%s %s: %s', case status when 'fail' then '🔴' else '⚠️' end, check_name, detail), E'\n')
    into v_inv from public.platform_invariants() where status <> 'ok';

  -- รับ PO ซ้ำ: คนเดิม ของเดิม จำนวนเท่ากัน ต่าง PO ภายใน 15 นาที
  with r as (
    select m.occurred_at, m.actor_id, m.item_id, m.qty_delta, substring(m.note from 'PO ([0-9a-f-]{36})') po
      from public.stock_movements m
     where m.movement_type = 'po_receive' and m.ref_table = 'stock_counts' and m.occurred_at > now() - interval '7 days')
  select string_agg(format('• %s %s ×%s (%s · %s)', i.sku, i.name, a.qty_delta, a.actor_id,
                           to_char(a.occurred_at at time zone 'Asia/Bangkok', 'DD/MM HH24:MI')), E'\n')
    into v_dup
    from r a join r b on a.item_id = b.item_id and a.qty_delta = b.qty_delta and a.actor_id = b.actor_id
                     and a.po <> b.po and b.occurred_at > a.occurred_at and b.occurred_at < a.occurred_at + interval '15 min'
    join public.items i on i.id = a.item_id;

  -- เบิกซ้ำทั้งชุด (บทเรียน 05/09)
  with b as (
    select actor_id, date_trunc('second', occurred_at) t, count(*) n,
           string_agg(item_id::text || ':' || qty_delta::text, ',' order by item_id, qty_delta) fp
      from public.stock_movements
     where movement_type = 'production_consume' and ref_table = 'stock_counts' and occurred_at > now() - interval '7 days'
     group by 1, 2)
  select string_agg(format('• %s %s รายการ (%s และ %s)', a.actor_id, a.n,
                           to_char(a.t at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'), to_char(c.t at time zone 'Asia/Bangkok', 'HH24:MI')), E'\n')
    into v_disp
    from b a join b c on a.actor_id = c.actor_id and a.fp = c.fp and c.t > a.t and c.t <= a.t + interval '15 min';

  -- กดบันทึกแล้วล้ม / ไม่จบ ทุกหน้า (submit_log Phase A+B) · "ไม่จบ" นับแยกต่อ action
  -- (action ที่ไม่มี attempt เช่น adjust_* ห้ามไปหักล้างยอดของ action อื่น)
  with a as (
    select action,
           count(*) filter (where status = 'fail') fails,
           greatest(0, count(*) filter (where status = 'attempt')
                       - count(*) filter (where status in ('success', 'fail'))) open_n,
           left(max(error_msg) filter (where status = 'fail'), 100) err
      from stock.submit_log where created_at > now() - interval '7 days'
     group by action)
  select string_agg(format('• %s: ล้ม %s · ไม่จบ %s%s', action, fails, open_n, coalesce(' — ' || err, '')), E'\n' order by action)
    into v_sub from a where fails > 0 or open_n > 0;

  -- PO รอรับ > 2 วัน
  select string_agg(format('• %s %s (เปิด %s วัน)', po_number, supplier_name,
                           extract(day from now() - ordered_at)::int), E'\n' order by ordered_at)
    into v_po from public.purchase_orders where status = 'ordered' and ordered_at < now() - interval '2 days';

  -- PO รับครบแต่ไม่ปิด (บทเรียน 04/07)
  select string_agg(format('• %s %s', po.po_number, po.supplier_name), E'\n')
    into v_close
    from public.purchase_orders po
   where po.status = 'ordered'
     and exists (select 1 from public.purchase_order_items l where l.po_id = po.id)
     and not exists (select 1 from public.purchase_order_items l where l.po_id = po.id and coalesce(l.qty_received, 0) <= 0);

  v_db := pg_size_pretty(pg_database_size(current_database()));

  return E'**🩺 Health check:**\n'
    || coalesce(v_inv, '✅ invariants ผ่านทุกข้อ') || E'\n'
    || '**รับ PO ซ้ำ (7 วัน):** ' || coalesce(E'\n' || v_dup, '✅ ไม่มี') || E'\n'
    || '**เบิกซ้ำทั้งชุด (7 วัน):** ' || coalesce(E'\n' || v_disp, '✅ ไม่มี') || E'\n'
    || '**กดบันทึกแล้วล้ม/ไม่จบ (7 วัน):** ' || coalesce(E'\n' || v_sub, '✅ ไม่มี') || E'\n'
    || '**PO รอรับ > 2 วัน:** ' || coalesce(E'\n' || v_po, '✅ ไม่มี') || E'\n'
    || '**PO รับครบแต่ไม่ปิด:** ' || coalesce(E'\n' || v_close, '✅ ไม่มี') || E'\n'
    || '**DB:** ' || v_db;
end $function$;

revoke all on function public.platform_weekly_health_text() from public, anon, authenticated;


-- Applied to prod (emjqulzikpxorvpaaiww) 2026-10-04 via MCP apply_migration.
-- Verified (DO + raise → rollback, leftover 0): po_receive.all attempt ค้าง → "ไม่จบ 1" ·
--   production.submit fail → "ล้ม 1 — code 23514 test" · adjust_reverse success ไม่หักล้าง action อื่น · ข้อมูลจริงตอนนี้ ✅ ไม่มี
