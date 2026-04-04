-- ============================================================
-- NNTN Non-Meat Stock System — Supabase Schema
-- สร้าง: 2026-04-01
-- ระบบ Par Level สำหรับวัตถุดิบที่ไม่ใช่เนื้อ
-- ============================================================

-- UUID extension (Supabase มีให้แล้ว ไม่ต้อง run ก็ได้)
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLE: items — Master list วัตถุดิบ
-- ============================================================
create table items (
  id            uuid primary key default gen_random_uuid(),
  sku           text unique not null,         -- รหัส SP จาก CookingBook เช่น SP-001
  name          text not null,                -- ชื่อวัตถุดิบ
  category      text not null,                -- seasoning | spice | vegetable | packaging | consumable | noodle
  unit          text not null,                -- หน่วยนับ (ขวด, ถุง, กก., ซอง)
  pack_size     text,                         -- ขนาดแพ็ก reference เช่น "3L", "500g"
  par_level     numeric not null default 1,   -- ต้องมีอย่างน้อยเท่านี้
  max_level     numeric not null default 3,   -- เติมให้ถึงเท่านี้เมื่อสั่ง
  cost_per_pack numeric,                      -- ราคาซื้อต่อแพ็ก (฿)
  supplier      text,
  brand         text,
  is_active     boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- TABLE: stock_counts — น้องกรอกทุกกะ/ทุกวัน
-- ============================================================
create table stock_counts (
  id          uuid primary key default gen_random_uuid(),
  counted_at  timestamptz not null default now(),
  counted_by  text not null,                  -- ชื่อน้อง
  item_id     uuid not null references items(id) on delete restrict,
  qty         numeric not null check (qty >= 0),
  note        text
);

-- Index เพื่อ query เร็ว (latest count per item)
create index on stock_counts (item_id, counted_at desc);

-- ============================================================
-- VIEW: current_stock — สถานะสต๊อกปัจจุบัน
-- ============================================================
create or replace view current_stock as
select
  i.sku,
  i.name,
  i.category,
  i.unit,
  i.pack_size,
  i.par_level,
  i.max_level,
  coalesce(latest.qty, 0)                           as current_qty,
  greatest(i.par_level - coalesce(latest.qty, 0), 0) as shortage,
  i.max_level - coalesce(latest.qty, 0)             as order_qty,
  case
    when coalesce(latest.qty, 0) = 0                then 'OUT'
    when coalesce(latest.qty, 0) < i.par_level      then 'ORDER_NOW'
    when coalesce(latest.qty, 0) < i.par_level * 1.5 then 'LOW'
    else 'OK'
  end as status,
  latest.counted_at  as last_counted,
  latest.counted_by  as last_counted_by
from items i
left join lateral (
  select qty, counted_at, counted_by
  from stock_counts
  where item_id = i.id
  order by counted_at desc
  limit 1
) latest on true
where i.is_active = true
order by
  case
    when coalesce(latest.qty, 0) = 0               then 1
    when coalesce(latest.qty, 0) < i.par_level     then 2
    when coalesce(latest.qty, 0) < i.par_level*1.5 then 3
    else 4
  end,
  i.category, i.sku;

-- ============================================================
-- VIEW: order_list — รายการที่ต้องสั่งซื้อ
-- ============================================================
create or replace view order_list as
select
  sku,
  name,
  unit,
  pack_size,
  current_qty,
  par_level,
  order_qty,
  status
from current_stock
where status in ('OUT', 'ORDER_NOW')
order by status, sku;
