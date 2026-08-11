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

---

## Fix Round 1/5 — Verified Source Closure and Duplicate-state Semantics

### Findings resolved

1. **Verified source closure:** `buildIngredientMigrationReport` now requires a one-to-one source-key match between `expectedBySource` and canonical `sourceManifests`. Duplicate manifest IDs, unknown or missing expected sources, invalid counts, and unbound receipts fail with `INGREDIENT_MIGRATION_SOURCE_CLOSURE_FAILED`.
2. **Authoritative count binding:** every direct/component/total value must be a non-negative integer, satisfy `direct + component === total`, and exactly match the manifest's immutable `direct_line`, `component_line`, and `recipe_line` expected counts. The manifest counts themselves are validated by the same integer/sum rules.
3. **Observed closure:** each recipe link must name an existing manifest and its exact source SHA. Per-manifest `(recipeId, lineId)` tuples must be unique, and observed unique `mapped + unmapped` must equal the authoritative direct-line count. Incomplete and overcounted sources fail before generic snapshot parsing can hide the source-accounting error.
4. **Unresolved duplicate candidates:** the report now regenerates Task 4 proposals directly from immutable `legacySourceRecords` plus the canonical snapshot by reusing `buildReconciliationQueue`. It includes only deterministic `merge_redirect` proposals with a non-null suggested target and no exact approved matching merge decision.
5. **Resolved duplicates:** approved redirects no longer masquerade as candidates. They are reported separately under `resolvedDuplicates`, sourced directly from canonical redirects.
6. **Narrow Task 4 seam:** `buildReconciliationQueue` now accepts `Pick<LegacyStagingBatch, "records">`. Existing full staging batches remain compatible, while report generation no longer fabricates semantically false ingredient/recipe/line partitions.
7. Exact export and CAS production behavior were not changed. Authoritative snapshots still store no regenerated proposals.

### Strict TDD evidence

RED before production repair:

```bash
./node_modules/.bin/vitest run --config vite.config.ts \
  src/domain/ingredients/ingredientMigrationReport.test.ts \
  src/domain/ingredients/reconciliation.test.ts --reporter=verbose
./node_modules/.bin/tsc -b --pretty false
```

```text
Vitest: 10 failed | 34 passed (44)
TypeScript: 3 errors

Failures covered:
- ghost and missing source keys accepted;
- negative, fractional, inconsistent, and manifest-mismatched counts accepted;
- unknown link manifest returned only the generic parser error;
- incomplete and overcount closure accepted;
- approved redirects reported as duplicate candidates;
- records-only Task 4 queue input rejected by the type contract.
```

Focused GREEN after repair:

```bash
./node_modules/.bin/vitest run --config vite.config.ts \
  src/domain/ingredients/ingredientMigrationReport.test.ts \
  src/data/ingredients/InMemoryIngredientMasterStore.test.ts \
  src/domain/ingredients/reconciliation.test.ts --reporter=verbose
```

```text
Test Files 3 passed (3)
Tests 48 passed (48)
```

RED total: **10 failed behavioral tests plus 3 TypeScript errors**.
GREEN focused total: **48 passed, 0 failed**.

### Hostile and control evidence

- Rejects ghost expected source and omitted canonical source.
- Rejects negative, fractional, and inconsistent direct/component/total values.
- Rejects counts that disagree with the canonical manifest receipt.
- Rejects link evidence naming an unknown manifest before parser fallback.
- Rejects both incomplete and overcounted observed direct-line closure.
- Accepts a two-manifest control and reports each manifest's mapped/unmapped counts independently.
- Proves an unresolved exact-match merge proposal appears under `duplicateCandidates`.
- Proves an approved matching merge proposal is excluded from candidates and its redirect appears only under `resolvedDuplicates`.
- Continues to prove exact export contains no `reconciliationProposals` field.

### Fix files

- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/ingredientMigrationReport.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/ingredientMigrationReport.test.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/reconciliation.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/reconciliation.test.ts`
- `.superpowers/sdd/2026-08-11-cookbook-ingredient-master-migration-core/task-7-report.md`

### Concerns

- No blocking concerns.
- Report closure intentionally counts ingredient, component-reclassified, and unmapped recipe-link states against the manifest's direct-line inventory. Source component lines remain represented by the separate authoritative `component_line` count and are not recipe relink outputs.

---

## Fix Round 2/5 — Safe-integer Count Integrity

### Finding resolved

- Replaced integer-only count acceptance with `Number.isSafeInteger` for all caller `expectedBySource` direct/component/total counts and all authoritative manifest `direct_line`/`component_line`/`recipe_line` counts used by report closure.
- Safe-integer validation now completes before recipe-link iteration and before direct-plus-component arithmetic.
- After operand validation, each sum is independently required to remain a safe integer before comparison with total. IEEE-754 rounding cannot make an unsafe or overflowing receipt appear internally consistent.
- Existing source closure, unresolved proposal regeneration, resolved redirect reporting, exact export, and CAS behavior remain unchanged.

### Strict TDD evidence

RED before production repair:

```bash
./node_modules/.bin/vitest run --config vite.config.ts \
  src/domain/ingredients/ingredientMigrationReport.test.ts --reporter=verbose
```

```text
Test Files 1 failed (1)
Tests 6 failed | 13 passed (19)

All six unsafe caller/manifest direct, component, and total cases reached the poisoned
recipe-link getter instead of failing source-count validation first.
```

Focused GREEN:

```bash
./node_modules/.bin/vitest run --config vite.config.ts \
  src/domain/ingredients/ingredientMigrationReport.test.ts \
  src/data/ingredients/InMemoryIngredientMasterStore.test.ts \
  src/domain/ingredients/reconciliation.test.ts --reporter=verbose
```

```text
Test Files 3 passed (3)
Tests 55 passed (55)
```

RED total: **6 failed behavioral tests**.
GREEN focused total: **55 passed, 0 failed**.

### Boundary evidence

- Rejects unsafe caller direct, component, and total independently before recipe-link access.
- Rejects unsafe authoritative manifest direct, component, and total independently before recipe-link access.
- Accepts `direct = 0`, `component = Number.MAX_SAFE_INTEGER`, `total = Number.MAX_SAFE_INTEGER`, proving the inclusive safe boundary when arithmetic remains safe.

### Fix files

- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/ingredientMigrationReport.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/ingredientMigrationReport.test.ts`
- `.superpowers/sdd/2026-08-11-cookbook-ingredient-master-migration-core/task-7-report.md`

### Concerns

- No blocking concerns.
