-- Weekly health check ใน NNTN Weekly Digest (TINE 2026-10-04 "จัดการ" — maintenance เป็นกิจจะลักษณะ)
--
-- ปัญหาที่เจอ: platform_invariants() มีอยู่แต่ไม่มีใครเรียกเป็นรอบ → DLQ ค้าง 4 เดือนไม่มีใครเห็น ·
--   SO รับ PO ซ้ำ/รับก่อนของมา (01–03/10) เจอเพราะบังเอิญถาม · PO เปิดค้างไม่มีใครเห็น
-- Fix: platform_weekly_health_text() — อ่านอย่างเดียว คืนข้อความสรุปสุขภาพ (ทดสอบได้โดยไม่ส่ง Discord)
--   · cron weekly digest เดิมส่งข้อความนี้ตามหลัง digest (Sunday 20:00 ICT ช่องเดิม)
-- ตรวจ: invariants ที่ไม่ ok · รับซ้ำ (คนเดิม ของเดิม จำนวนเท่ากัน ต่าง PO ภายใน 15 นาที) 7 วัน ·
--   PO รอรับ > 2 วัน · ขนาด DB
-- Rollback: คืน cron command (ด้านล่าง) + drop function public.platform_weekly_health_text();

create or replace function public.platform_weekly_health_text()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_inv text; v_dup text; v_po text; v_db text;
begin
  select string_agg(format('%s %s: %s', case status when 'fail' then '🔴' else '⚠️' end, check_name, detail), E'\n')
    into v_inv from public.platform_invariants() where status <> 'ok';

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

  select string_agg(format('• %s %s (เปิด %s วัน)', po_number, supplier_name,
                           extract(day from now() - ordered_at)::int), E'\n' order by ordered_at)
    into v_po from public.purchase_orders where status = 'ordered' and ordered_at < now() - interval '2 days';

  v_db := pg_size_pretty(pg_database_size(current_database()));

  return E'**🩺 Health check:**\n'
    || coalesce(v_inv, '✅ invariants ผ่านทุกข้อ') || E'\n'
    || '**รับซ้ำ (7 วัน):** ' || coalesce(E'\n' || v_dup, '✅ ไม่มี') || E'\n'
    || '**PO รอรับ > 2 วัน:** ' || coalesce(E'\n' || v_po, '✅ ไม่มี') || E'\n'
    || '**DB:** ' || v_db;
end $function$;

revoke all on function public.platform_weekly_health_text() from public, anon, authenticated;

-- ส่งผล: cron job เดิม 'nntn-weekly-digest' (Sunday 13:00 UTC = 20:00 ICT) เรียก health ต่อท้ายเป็นข้อความที่ 2
--   (ไม่เขียน nntn_weekly_digest ใหม่ทั้งตัว — เลี่ยงความเสี่ยงทำ format เดิมพัง)
-- Rollback cron: command := ' SELECT public.nntn_weekly_digest(); '
select cron.alter_job(
  (select jobid from cron.job where jobname = 'nntn-weekly-digest'),
  command := $cmd$ SELECT public.nntn_weekly_digest(); SELECT public.aim_notify(public.platform_weekly_health_text()); $cmd$
);

-- Applied to prod (emjqulzikpxorvpaaiww) 2026-10-04 via MCP apply_migration (2 ส่วน).
-- Verified: select platform_weekly_health_text() → invariants ผ่าน · รับซ้ำ PKG-004 ×22 (SO 03/10 16:41) ·
--   PO รอรับ > 2 วัน: PO-20260930-69 Shopee · DB 163 MB (ตรงกับตรวจมือ) · cron command อ่านกลับตรง
