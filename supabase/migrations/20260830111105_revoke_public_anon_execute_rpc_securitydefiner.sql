-- Lock down anon/PUBLIC EXECUTE on SECURITY DEFINER rpc_* functions (prod emjqu)
-- Authority: TINE deploy word 30/08 relayed via CROO. Scope: all SECURITY DEFINER public.rpc_*
--   EXCEPT rpc_po_receive (already locked). Postgres CREATE FUNCTION defaults EXECUTE to PUBLIC,
--   so every rpc_* (incl. the just-added rpc_manual_add_portioned) currently allows anon — 15 fns.
--
-- Falsifier (before apply): no frontend page calls rpc_* as anon. Mutating callers use the
--   auth.js createClient monkey-patch that injects the user JWT (runs as authenticated); the only
--   pages using the raw anon client (platform-health, sales-analysis) call platform_* / views, not rpc_*.
--   Residual risk to confirm in qa/verify: non-frontend callers (edge functions, cron, outbox).
--
-- Verify after apply: (a) calling any rpc_* with the anon key is rejected (permission denied);
--   (b) one real authenticated user flow (รับสต๊อก) still works.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.proname LIKE 'rpc\_%'
      AND p.proname <> 'rpc_po_receive'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    RAISE NOTICE 'revoked PUBLIC,anon EXECUTE on %', r.sig;
  END LOOP;
END $$;

-- ============================================================================
-- ROLLBACK (run to restore prior state — re-grants PUBLIC + anon EXECUTE):
-- ----------------------------------------------------------------------------
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN
--     SELECT p.oid::regprocedure AS sig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public' AND p.prosecdef AND p.proname LIKE 'rpc\_%'
--       AND p.proname <> 'rpc_po_receive'
--   LOOP
--     EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon;', r.sig);
--   END LOOP;
-- END $$;
-- ============================================================================
