-- pg_cron log (cron.job_run_details) ไม่เคยถูก purge: 6 jobs ทุก 5 นาที → ~1,700 แถว/วัน สะสมตั้งแต่ 2026-05-11
-- ตั้ง job ลบ log ที่เก่ากว่า 7 วัน ทุกวัน 20:00 UTC (03:00 ICT) · TINE สั่ง 2026-09-13
-- idempotent: unschedule ชื่อเดิมก่อน (ถ้ามี)
select cron.unschedule(jobid) from cron.job where jobname = 'nntn-purge-cron-run-details';
select cron.schedule(
  'nntn-purge-cron-run-details',
  '0 20 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);
