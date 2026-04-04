-- ============================================================
-- NNTN Non-Meat Stock System — Schema v2
-- เพิ่ม: production_log + suppliers + purchase_orders
-- อัปเดต: 2026-04-02
-- ============================================================
-- วิธีใช้: รันใน Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- TABLE: production_log — บันทึก batch ที่ทำแต่ละวัน
-- น้องกรอกทุกวัน: ทำ RCP อะไร กี่ batch ประเภทลูกค้า/พนักงาน
-- ใช้เทียบ BOM → theoretical ingredient usage
-- ============================================================
create table if not exists production_log (
  id          uuid primary key default gen_random_uuid(),
  logged_at   date not null default current_date,
  logged_by   text not null,
  rcp_code    text not null,     -- เช่น 'RCP-002'
  rcp_name    text not null,     -- เช่น 'น้ำซุป'
  batch_count numeric not null check (batch_count > 0),
  type        text not null check (type in ('customer', 'staff')),
  note        text,
  created_at  timestamptz default now()
);

create index if not exists production_log_date_idx on production_log (logged_at desc);

-- ============================================================
-- TABLE: suppliers — ซัพพลายเออร์
-- ============================================================
create table if not exists suppliers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact         text,
  lead_time_days  int not null default 1,
  note            text,
  created_at      timestamptz default now()
);

-- ============================================================
-- TABLE: item_suppliers — เชื่อม item กับ supplier (many-to-many)
-- ============================================================
create table if not exists item_suppliers (
  item_id       uuid not null references items(id) on delete cascade,
  supplier_id   uuid not null references suppliers(id) on delete cascade,
  is_preferred  boolean not null default true,
  primary key (item_id, supplier_id)
);

-- ============================================================
-- TABLE: purchase_orders — ใบสั่งซื้อ
-- ============================================================
create table if not exists purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid references suppliers(id),
  created_at    timestamptz default now(),
  created_by    text not null,
  status        text not null default 'draft'
                  check (status in ('draft','ordered','received')),
  ordered_at    timestamptz,
  expected_at   date,
  received_at   timestamptz,
  note          text
);

-- ============================================================
-- TABLE: purchase_order_items — รายการใน PO
-- ============================================================
create table if not exists purchase_order_items (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references purchase_orders(id) on delete cascade,
  item_id       uuid not null references items(id),
  qty_ordered   numeric not null check (qty_ordered > 0),
  qty_received  numeric check (qty_received >= 0),
  note          text
);

-- ============================================================
-- RLS: ตั้ง RLS ให้ anon อ่าน/เขียนได้ (เหมือน items + stock_counts)
-- ============================================================
alter table production_log     enable row level security;
alter table suppliers          enable row level security;
alter table item_suppliers     enable row level security;
alter table purchase_orders    enable row level security;
alter table purchase_order_items enable row level security;

-- Production log: anon read + insert
drop policy if exists "anon_read_production_log" on production_log;
drop policy if exists "anon_insert_production_log" on production_log;
create policy "anon_read_production_log"
  on production_log for select to anon using (true);
create policy "anon_insert_production_log"
  on production_log for insert to anon with check (true);

-- Suppliers: anon read only
drop policy if exists "anon_read_suppliers" on suppliers;
create policy "anon_read_suppliers"
  on suppliers for select to anon using (true);

-- Item suppliers: anon read only
drop policy if exists "anon_read_item_suppliers" on item_suppliers;
create policy "anon_read_item_suppliers"
  on item_suppliers for select to anon using (true);

-- Purchase orders: anon read + insert + update
drop policy if exists "anon_read_purchase_orders" on purchase_orders;
drop policy if exists "anon_insert_purchase_orders" on purchase_orders;
drop policy if exists "anon_update_purchase_orders" on purchase_orders;
create policy "anon_read_purchase_orders"
  on purchase_orders for select to anon using (true);
create policy "anon_insert_purchase_orders"
  on purchase_orders for insert to anon with check (true);
create policy "anon_update_purchase_orders"
  on purchase_orders for update to anon using (true);

-- Purchase order items: anon read + insert + update
drop policy if exists "anon_read_purchase_order_items" on purchase_order_items;
drop policy if exists "anon_insert_purchase_order_items" on purchase_order_items;
drop policy if exists "anon_update_purchase_order_items" on purchase_order_items;
create policy "anon_read_purchase_order_items"
  on purchase_order_items for select to anon using (true);
create policy "anon_insert_purchase_order_items"
  on purchase_order_items for insert to anon with check (true);
create policy "anon_update_purchase_order_items"
  on purchase_order_items for update to anon using (true);
