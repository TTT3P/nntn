-- ============================================================
-- NNTN Non-Meat Stock System — Schema v3
-- เพิ่ม: prep_log + portion_log + SRCP/PKG items
-- อัปเดต: 2026-04-03
-- ============================================================

-- ============================================================
-- TABLE: prep_log — บันทึกการผลิต Sub-Recipe (SRCP)
-- เช่น ผลิตกระเทียมเจียว 1 batch ได้ 3,200g
-- ============================================================
create table if not exists prep_log (
  id            uuid primary key default gen_random_uuid(),
  logged_at     date not null default current_date,
  logged_by     text not null,
  srcp_code     text not null,   -- เช่น 'SRCP-005'
  srcp_name     text not null,   -- เช่น 'กระเทียมเจียว'
  batch_count   numeric not null check (batch_count > 0),
  yield_grams   numeric not null check (yield_grams > 0),  -- yield จริงที่ได้ (กรัม)
  note          text,
  created_at    timestamptz default now()
);

create index if not exists prep_log_date_idx on prep_log (logged_at desc);
create index if not exists prep_log_srcp_idx on prep_log (srcp_code);

-- RLS
alter table prep_log enable row level security;

drop policy if exists "anon_read_prep_log" on prep_log;
create policy "anon_read_prep_log" on prep_log
  for select to anon using (true);

drop policy if exists "anon_insert_prep_log" on prep_log;
create policy "anon_insert_prep_log" on prep_log
  for insert to anon with check (true);

-- ============================================================
-- TABLE: portion_log — บันทึกการแบ่งถุง SRCP → PKG
-- เช่น กระเทียมเจียว 3,200g → 12 ถุง × 250g + เศษ 200g
-- ============================================================
create table if not exists portion_log (
  id              uuid primary key default gen_random_uuid(),
  logged_at       date not null default current_date,
  logged_by       text not null,
  srcp_code       text not null,   -- เช่น 'SRCP-005'
  srcp_name       text not null,
  pkg_code        text not null,   -- เช่น 'PKG-005'
  pkg_name        text not null,
  grams_used      numeric not null check (grams_used > 0),   -- กรัมที่เอามาแบ่ง
  grams_per_bag   numeric not null check (grams_per_bag > 0), -- กรัม/ถุง
  bags_out        int not null,    -- จำนวนถุงที่ได้ (floor)
  grams_remainder numeric not null default 0, -- เศษที่เหลือ (คืนเข้า SRCP stock)
  note            text,
  created_at      timestamptz default now()
);

create index if not exists portion_log_date_idx on portion_log (logged_at desc);
create index if not exists portion_log_srcp_idx on portion_log (srcp_code);

-- RLS
alter table portion_log enable row level security;

drop policy if exists "anon_read_portion_log" on portion_log;
create policy "anon_read_portion_log" on portion_log
  for select to anon using (true);

drop policy if exists "anon_insert_portion_log" on portion_log;
create policy "anon_insert_portion_log" on portion_log
  for insert to anon with check (true);

-- ============================================================
-- SEED: เพิ่ม SRCP + PKG เข้า items table
-- ============================================================

-- SRCP-001 ซอสลับ (kitchen only, track เป็น ml)
insert into items (id, sku, name, category, unit, par_level, max_level, is_active)
values (gen_random_uuid(), 'SRCP-001', 'ซอสลับ', 'srcp', 'ml', 2500, 10000, true)
on conflict (sku) do nothing;

-- SRCP-004 พริกน้ำส้ม (track ยอดเบิก กรัม)
insert into items (id, sku, name, category, unit, par_level, max_level, is_active)
values (gen_random_uuid(), 'SRCP-004', 'พริกน้ำส้ม', 'srcp', 'g', 500, 3000, true)
on conflict (sku) do nothing;

-- SRCP-005 กระเทียมเจียว (bulk กรัม)
insert into items (id, sku, name, category, unit, par_level, max_level, is_active)
values (gen_random_uuid(), 'SRCP-005', 'กระเทียมเจียว (bulk)', 'srcp', 'g', 1000, 5000, true)
on conflict (sku) do nothing;

-- SRCP-006 พริกผัด (bulk กรัม)
insert into items (id, sku, name, category, unit, par_level, max_level, is_active)
values (gen_random_uuid(), 'SRCP-006', 'พริกผัด (bulk)', 'srcp', 'g', 1000, 5000, true)
on conflict (sku) do nothing;

-- PKG-005 กระเทียมเจียวถุง 250g
insert into items (id, sku, name, category, unit, par_level, max_level, is_active)
values (gen_random_uuid(), 'PKG-005', 'กระเทียมเจียว 250g', 'pkg', 'ถุง', 10, 40, true)
on conflict (sku) do nothing;

-- PKG-006 พริกผัดถุง 250g
insert into items (id, sku, name, category, unit, par_level, max_level, is_active)
values (gen_random_uuid(), 'PKG-006', 'พริกผัด 250g', 'pkg', 'ถุง', 10, 40, true)
on conflict (sku) do nothing;
