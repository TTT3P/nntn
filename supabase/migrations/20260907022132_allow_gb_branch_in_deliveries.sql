-- เปิดปลายทาง Glass Bangna (GB) ในใบนำส่ง (stock V1)
--
-- ปัญหา: UI hub-delivery มีตัวเลือก "Glass Bangna (GB)" ส่ง branch='GB'
-- แต่ deliveries_branch_check อนุญาตแค่ NT/FS → submit fail code 23514
-- (Postgres check_violation) rollback atomic ทุกครั้ง ส่ง Glass ไม่ได้เลย
--
-- Applied to prod (emjqulzikpxorvpaaiww) 2026-09-07 ~09:15 ICT via MCP apply_migration
-- ไฟล์นี้บันทึกเพื่อ traceability (idempotent — รันซ้ำปลอดภัย)
-- Rollback: ลบแถว branch='GB' ก่อน แล้ว add constraint check (branch in ('NT','FS'))

alter table stock.deliveries drop constraint if exists deliveries_branch_check;
alter table stock.deliveries add constraint deliveries_branch_check
  check (branch = any (array['NT'::text, 'FS'::text, 'GB'::text]));
