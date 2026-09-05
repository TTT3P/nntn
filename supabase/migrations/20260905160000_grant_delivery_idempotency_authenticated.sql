-- HOTFIX: grant authenticated SELECT+INSERT on stock.delivery_idempotency (regression from #53)
-- Incident 2026-09-05 ~15:xx: after 20260905150000 deployed, every hub-delivery submit by a real
--   (authenticated) user failed with 42501 → client showed "ไม่มีสิทธิ์บันทึก — login ใหม่" (403).
-- Cause: submit_delivery is SECURITY INVOKER, so it runs as the calling role (authenticated). The
--   new stock.delivery_idempotency table was created WITHOUT granting the invoker roles — only the
--   table owner (postgres) + nntn_team_viewer(SELECT) had access. The client now always sends
--   p_idempotency_key, so the function's SELECT+INSERT on that table ran as authenticated and was
--   denied → the whole delivery transaction rolled back.
-- Why 20260905150000 verification missed it: dry-run + post-apply checks ran via the MCP/privileged
--   connection (role bypasses table grants), never as `authenticated`. Lesson: verify SECURITY
--   INVOKER writes under a real `SET ROLE authenticated`.
-- RLS is disabled on this table, so table GRANTs govern. Match stock.deliveries' surface
--   (authenticated only; anon never completes a submit because stock.deliveries grants authenticated
--   only). Function needs SELECT (dedup lookup) + INSERT (record key).

GRANT SELECT, INSERT ON stock.delivery_idempotency TO authenticated;
