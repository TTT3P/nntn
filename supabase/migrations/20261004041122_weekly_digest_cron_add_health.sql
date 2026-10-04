-- Weekly digest ส่ง health check ต่อท้าย — ส่วนที่ 2/2 ของ 20261004041058_platform_weekly_health_text.sql (TINE 2026-10-04)
--
-- ส่งผล: cron job เดิม 'nntn-weekly-digest' (Sunday 13:00 UTC = 20:00 ICT) เรียก health ต่อท้ายเป็นข้อความที่ 2
--   (ไม่เขียน nntn_weekly_digest ใหม่ทั้งตัว — เลี่ยงความเสี่ยงทำ format เดิมพัง)
-- Rollback cron: command := ' SELECT public.nntn_weekly_digest(); '
select cron.alter_job(
  (select jobid from cron.job where jobname = 'nntn-weekly-digest'),
  command := $cmd$ SELECT public.nntn_weekly_digest(); SELECT public.aim_notify(public.platform_weekly_health_text()); $cmd$
);

-- Applied to prod (emjqulzikpxorvpaaiww) 2026-10-04 via MCP apply_migration · cron command อ่านกลับตรง
