-- Fix PO number ซ้ำทุก 10 ใบ (TINE 2026-10-04 "จัดการหน่อย")
--
-- เดิม: v_seq = count(*)+1 ของ purchase_orders ทั้งตาราง แล้ว lpad(v_seq, 2)
--   → lpad ตัดเหลือ 2 ตัวแรกเมื่อเกิน 99 (เช่น 691 → '69', 700 → '70')
--   → PO 10 ใบติดกันได้เลขเดียวกัน (30 วันล่าสุด 31 เลขซ้ำ สูงสุด 7 ใบ/เลข)
--   → คนดูหน้ารับ PO แยกใบไม่ออก "เหมือนเปิดซ้ำ" (ข้อมูลไม่เสีย — id ต่างกัน)
--
-- Fix: ลำดับต่อวัน = max(ลำดับที่ใช้แล้วของวันนั้น)+1 · lpad ไม่ตัด (≥2 หลัก)
--   · advisory lock ต่อวัน กัน 2 คนสร้างพร้อมกันได้เลขเดียวกัน
--   · วันที่มีเลขเก่าอยู่แล้ว (เช่น PO-20261004-70) ต่อจาก max → 71 ไม่ชนของเดิม
-- Signature / return shape เดิม → po-receive.html ไม่ต้องแก้
-- Rollback: apply นิยามเดิมจาก 20260907033649_add_create_po_atomic_rpc.sql
--
-- Applied to prod (emjqulzikpxorvpaaiww) 2026-10-04 via MCP apply_migration.
-- Verified (DO block + raise → rollback): 2026-10-04 ×2 → PO-20261004-71, -72 (ต่อจากเลขเดิม -70)
--   · 2026-10-05 → PO-20261005-01 · leftover test rows 0
create or replace function public.create_po(p_supplier_id uuid, p_supplier_name text, p_date date, p_note text, p_created_by text, p_items jsonb)
 returns jsonb
 language plpgsql
as $function$
declare
  v_po_id uuid; v_po_number text; v_seq int; v_item jsonb; v_count int := 0;
  v_day text := to_char(coalesce(p_date, current_date), 'YYYYMMDD');
begin
  if p_supplier_id is null then raise exception 'create_po: supplier required'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'create_po: no line items'; end if;

  perform pg_advisory_xact_lock(hashtext('create_po:' || v_day));
  select coalesce(max(split_part(po_number, '-', 3)::int), 0) + 1 into v_seq
    from public.purchase_orders
   where po_number like 'PO-' || v_day || '-%' and split_part(po_number, '-', 3) ~ '^[0-9]+$';
  v_po_number := 'PO-' || v_day || '-' || lpad(v_seq::text, greatest(2, length(v_seq::text)), '0');

  insert into public.purchase_orders (po_number, supplier_id, supplier_name, status, ordered_at, created_by, note)
  values (v_po_number, p_supplier_id, p_supplier_name, 'ordered', now(), p_created_by, nullif(p_note,''))
  returning id into v_po_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'item_id') is null then raise exception 'create_po: line missing item_id'; end if;
    insert into public.purchase_order_items (po_id, item_id, qty_ordered, unit_price)
    values (
      v_po_id, (v_item->>'item_id')::uuid,
      nullif(v_item->>'qty_ordered','')::numeric,
      nullif(v_item->>'unit_price','')::numeric
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'po_id', v_po_id, 'po_number', v_po_number, 'item_count', v_count);
end;
$function$;
