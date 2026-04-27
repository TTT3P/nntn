# Manual Reconcile · Saga Pattern Runbook

> Compensating-write pattern for fixing data divergence by hand.
> Linked from BLUEPRINT.md §11. Extracted from BLUEPRINT.md §16 on 2026-04-27.
> Proven on MT-020/037/039/040 reconcile (25/04).

## Pattern · sm/CW divergence repair

```
1. Diagnose: SELECT * FROM v_sm_cw_divergence WHERE divergence != 0;
2. For each divergent SKU:
   a. Decide direction (CW too high → flip bags · sm too high → adjust sm)
   b. UPDATE catch_weight to correct status
      ⚠️  trigger cw_emit_sm_status will auto-add ±N to sm
   c. INSERT compensating row in stock_movements
      (sm is append-only · cannot DELETE)
      movement_type = 'count_adjust_up' / 'count_adjust_down'
      note = 'Reconcile <date>: <reason>'
3. Verify: SELECT * FROM v_sm_cw_divergence WHERE item_id = ...;
   Both sides must equal.
4. Discord noise: writes containing 'reconcile'/'backfill'/'zero-out' in notes
   are auto-suppressed (see aim_cw_trigger_suppress_bulk_and_scrap).
```

## Why compensating insert (not delete)

`stock_movements` has `block_sm_mutation` rule preventing DELETE/UPDATE.
This is intentional — preserves immutable audit trail.
Therefore: any error is corrected by **adding offsetting row**, never erasing.

## Anti-patterns

- ❌ Direct UPDATE/DELETE on stock_movements (will fail)
- ❌ Bypassing trigger via `ALTER TABLE DISABLE TRIGGER` (breaks audit)
- ❌ Manual flipping CW without compensating sm row (creates new divergence)
- ❌ Bulk reconcile without `reconcile`/`backfill` marker in notes (Discord flood)

## Idempotency

Re-running the verify query should be safe and stateless. Reconcile scripts
should grep `notes ILIKE '%reconcile <date>%'` before applying — prevents
double-fix if script re-run.

## Reference incident

`Areas/incidents/2026-04-25-mt-cw-divergence.md` (template-able)
