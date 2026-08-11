# Task 7 Report — Exact Export, Migration Report, and CAS Store Seam

## Status

Implemented and verified. The task-scoped commit SHA is recorded in the final handoff.

## Changed files

- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/ingredientMigrationReport.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/ingredientMigrationReport.test.ts`
- `webapp-prototype/cookbook-module-v1/src/data/ingredients/IngredientMasterStore.ts`
- `webapp-prototype/cookbook-module-v1/src/data/ingredients/InMemoryIngredientMasterStore.ts`
- `webapp-prototype/cookbook-module-v1/src/data/ingredients/InMemoryIngredientMasterStore.test.ts`
- `.superpowers/sdd/2026-08-11-cookbook-ingredient-master-migration-core/task-7-report.md`

## Implementation

- Added seven distinct report categories: mapped, unmapped, duplicate candidate, inactive, missing price, missing conversion, and missing yield.
- Missing-price entries carry the explicit `MISSING_PRICE_EVIDENCE` state and no numeric `price` field; missing evidence is never represented by zero.
- Report evidence is derived from canonical recipe links, redirects, active/inactive identities, approved observations, approved exact conversion evidence, and approved yield evidence. It does not calculate Food Cost.
- Added deterministic source-count reporting keyed by the caller's authoritative manifest/source label, preserving expected direct/component/total receipts while adding observed mapped/unmapped counts.
- Added exact JSON export with one trailing newline. Domain object keys are recursively canonicalized; the authoritative `LegacySourceRecord.raw` subtree preserves its original object-key and array order exactly.
- Exact export includes manifests, raw source records, ingredients, specifications, aliases, redirects, mappings, unit conversions, usable yields, cost observations, reconciliation decisions, and rich recipe relinks.
- Export omits regenerated reconciliation proposals and derived Food Cost totals.
- Added the transport-owned `IngredientMasterStore` byte interface and an in-memory-only CAS implementation.
- Every constructor or CAS payload is parsed with `parseIngredientMaster` and must equal its exact canonical serialization byte-for-byte. Malformed and merely valid-but-noncanonical JSON are rejected with `INVALID_INGREDIENT_MASTER_SNAPSHOT` before state changes.
- CAS revisions are opaque monotonic `rev-N` tokens. A stale writer fails with `STALE_INGREDIENT_MASTER`; the winning bytes and revision remain authoritative. Reads allocate a fresh result envelope and expose no mutable domain object reference.
- Added no filesystem, browser storage, HTTP, cloud, SQL, Supabase, Stock, UI, dependency, or production write surface.

## Strict TDD evidence

Initial RED before production implementation:

```bash
./node_modules/.bin/vitest run --config vite.config.ts \
  src/domain/ingredients/ingredientMigrationReport.test.ts \
  src/data/ingredients/InMemoryIngredientMasterStore.test.ts --reporter=verbose
```

```text
Test Files 2 failed (2)
Tests no tests
Failed to resolve the two not-yet-created production modules
exit 1
```

Focused GREEN after implementation and one test-only indentation assertion repair:

```text
Test Files 2 passed (2)
Tests 6 passed (6)
exit 0
```

RED total: **2 failed suites witnessed before production implementation**.
GREEN focused total: **6 passed, 0 failed**.

## Exact export evidence

- `serializeIngredientMaster(snapshot)` ends with exactly one newline.
- `serializeIngredientMaster(parseIngredientMaster(JSON.parse(bytes))) === bytes` passes.
- Canonical top-level and nested domain key order is asserted.
- A raw fixture with deliberately non-canonical keys (`zeta` before `alpha`, nested `beta` before `alpha`, and array-row `z` before `a`) survives export and parse/export with the same authoritative raw order.
- Every authoritative snapshot family and the full rich recipe relink evidence is asserted present.
- Regenerated proposals and derived Food Cost fields are asserted absent.

## CAS evidence

- Two readers observe the same revision.
- Writer one succeeds and advances the opaque revision.
- Writer two fails with `STALE_INGREDIENT_MASTER`.
- A subsequent read returns writer one's exact bytes and revision.
- Empty-store writes advance `rev-1` then `rev-2`.
- Mutating a caller-owned read envelope cannot mutate stored bytes.
- Malformed and noncanonical candidate bytes fail validation and leave bytes/revision unchanged.

## Verification

Focused Task 7 tests:

```text
Test Files 2 passed (2)
Tests 6 passed (6)
```

Relevant Tasks 1–6 domain regressions:

```text
Test Files 6 passed (6)
Tests 167 passed (167)
```

Static checks:

```bash
npm run typecheck
./node_modules/.bin/eslint \
  src/domain/ingredients/ingredientMigrationReport.ts \
  src/domain/ingredients/ingredientMigrationReport.test.ts \
  src/data/ingredients/IngredientMasterStore.ts \
  src/data/ingredients/InMemoryIngredientMasterStore.ts \
  src/data/ingredients/InMemoryIngredientMasterStore.test.ts
```

Both commands exited `0` with no diagnostics. The final scoped diff check is recorded in the task handoff.

## Concerns / follow-on boundaries

- No blocking concerns.
- `expectedBySource` is deliberately supplied by the caller and keyed by its authoritative source/manifest label; this task does not infer or rewrite frozen source receipts.
- Report evidence completeness is identity/evidence readiness only. Observation source eligibility, staleness, Food Cost arithmetic, rounding, and totals remain blocked by issue #26.
- The in-memory store proves the owned byte/CAS contract only. Filesystem, browser, database, Blob, cloud, revision persistence, and production cutover remain blocked by issue #31.
