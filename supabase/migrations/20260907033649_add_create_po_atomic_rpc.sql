-- Atomic PO create RPC (issue #64, whole-web audit follow-up)
--
-- เดิม po-receive.html savePO() insert 2 ตารางแยก (purchase_orders → purchase_order_items)
-- + items insert ไม่เช็ค error → partial PO ได้ (header ไม่มี line) + กดซ้ำได้ PO ซ้ำ.
-- คลาสเดียวกับ submit_delivery / submit_production. Severity Low (เอกสาร ไม่กระทบสต๊อก).
--
-- Fix: public.create_po() insert header + items ในทรานแซกชันเดียว (all-or-nothing).
-- SECURITY INVOKER → สิทธิ์ authenticated เหมือน insert ตรงเดิม.
-- po_number = count+1 แบบเดิม (คงพฤติกรรม; race numbering เป็น pre-existing นอก scope นี้).
--
-- Applied to prod (emjqulzikpxorvpaaiww) 2026-09-07 via MCP apply_migration.
-- Verified: good-path (PO-20260907-59, item 1) + falsifier (line ไม่มี item_id → raise P0001,
-- leftover 0 = rollback header+item ครบ) → ลบ test rows แล้ว.
-- Rollback: drop function public.create_po(uuid,text,date,text,text,jsonb);

create or replace function public.create_po(
  p_supplier_id uuid,
  p_supplier_name text,
  p_date date,
  p_note text,
  p_created_by text,
  p_items jsonb   -- [{item_id, qty_ordered, unit_price}]
) returns jsonb
language plpgsql
as $$
declare
  v_po_id uuid; v_po_number text; v_seq int; v_item jsonb; v_count int := 0;
begin
  if p_supplier_id is null then raise exception 'create_po: supplier required'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'create_po: no line items'; end if;

  select count(*) + 1 into v_seq from public.purchase_orders;
  v_po_number := 'PO-' || to_char(coalesce(p_date, current_date), 'YYYYMMDD') || '-' || lpad(v_seq::text, 2, '0');

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
$$;

revoke all on function public.create_po(uuid,text,date,text,text,jsonb) from public, anon;
grant execute on function public.create_po(uuid,text,date,text,text,jsonb) to authenticated, service_role;
