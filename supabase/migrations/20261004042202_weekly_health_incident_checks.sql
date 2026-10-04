-- Weekly health check รอบ 2: เพิ่มเช็คจากเหตุที่เว็บเคยพัง (TINE 2026-10-04 "ย้อนดูตอนเว็บมีปัญหา → สอดส่องตรงไหนอีก")
--
-- เหตุในอดีต → เช็คที่เพิ่ม:
--   2026-09-05 ใบนำส่งซ้ำ (จอหลอกว่าล้ม → กดซ้ำ → ตัดสต๊อก 2 รอบ)
--     → เบิกซ้ำทั้งชุด: คนเดิม รายการ+จำนวนตรงกันทุกตัว ภายใน 15 นาที (production_consume)
--       (ทดสอบ 60 วัน: จับเฉพาะ 05/09 09:20/09:31 · ไม่เตือนผิดชุดเบิก TINE ที่มีบางรายการตรงกัน)
--   2026-09-07 ส่ง Glass "บันทึกไม่สำเร็จ" ทุกครั้ง (code 23514 — UI เพิ่มปลายทางแต่ DB ไม่ตาม) ไม่มีใครเห็นจนน้องแจ้ง
--     → submit_log: ล้มกี่ครั้ง + error ที่เจอ · attempt ที่ไม่จบ (ไม่มี success/fail = response หาย)
--   2026-07-04 PO รับครบแต่ไม่ปิด (ค้าง ordered)
--     → PO ordered ที่ทุกบรรทัดรับแล้ว
-- ของเดิมคงไว้: invariants · รับ PO ซ้ำ · PO รอรับ > 2 วัน · ขนาด DB
-- Rollback: apply นิยามจาก 20261004041058_platform_weekly_health_text.sql + 20261004041122_weekly_digest_cron_add_health.sql

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

  -- กดบันทึกแล้วล้ม / response หาย (บทเรียน 07/09 + 05/09)
  select case when sum(n) filter (where status = 'fail') > 0
                or coalesce(sum(n) filter (where status = 'attempt'), 0)
                   - coalesce(sum(n) filter (where status in ('success', 'fail')), 0) > 0
              then format('ล้ม %s ครั้ง · ไม่จบ %s ครั้ง%s',
                          coalesce(sum(n) filter (where status = 'fail'), 0),
                          greatest(0, coalesce(sum(n) filter (where status = 'attempt'), 0)
                                      - coalesce(sum(n) filter (where status in ('success', 'fail')), 0)),
                          coalesce(E'\n• ' || string_agg(err, E'\n• ') filter (where status = 'fail'), ''))
         end
    into v_sub
    from (select action, status, count(*) n, left(max(error_msg), 100) err
            from stock.submit_log where created_at > now() - interval '7 days'
           group by 1, 2) s;

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
    || '**ใบนำส่งกดแล้วล้ม (7 วัน):** ' || coalesce(v_sub, '✅ ไม่มี') || E'\n'
    || '**PO รอรับ > 2 วัน:** ' || coalesce(E'\n' || v_po, '✅ ไม่มี') || E'\n'
    || '**PO รับครบแต่ไม่ปิด:** ' || coalesce(E'\n' || v_close, '✅ ไม่มี') || E'\n'
    || '**DB:** ' || v_db;
end $function$;

revoke all on function public.platform_weekly_health_text() from public, anon, authenticated;

-- Applied to prod (emjqulzikpxorvpaaiww) 2026-10-04 via MCP apply_migration.
-- Verified: select platform_weekly_health_text() → 7 หัวข้อ 303 ตัวอักษร (Discord ≤ 2000) · ผลตรงตรวจมือ
