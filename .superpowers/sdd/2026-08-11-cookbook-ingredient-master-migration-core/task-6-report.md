# Task 6 Report — Immutable Recipe Ingredient Relinking

## Status

Implemented and verified. The task-scoped commit SHA is recorded in the final handoff.

## Changed files

- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/relinkRecipeIngredients.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/relinkRecipeIngredients.test.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/types.ts` — Task 6 recipe-line decision-evidence type only
- `.superpowers/sdd/2026-08-11-cookbook-ingredient-master-migration-core/task-6-report.md`

## Implementation

- Added pure `relinkRecipeIngredients(document, decisionSet)` with local readonly structural document interfaces. The real Cookbook V6 document remains structurally assignable without importing or committing the pre-existing untracked `src/domain/cookbookV6/types.ts`.
- Binds each decision set to the immutable document revision SHA and indexes decisions by the collision-safe tuple `(sourceSha256, recipeId, lineId)`.
- Requires exactly one approved `link_ingredient`, `link_component_recipe`, or `mark_unmapped` decision for each active direct line. Display-name equality never creates identity.
- Rejects duplicate/missing/unapproved decisions, unsupported reconciliation actions, unknown or mismatched ingredient/specification targets, component payloads carrying Ingredient fields, and missing component recipes through deterministic structured issues.
- Preserves `amountText`, `unitText`, `sourceDisplayText`, `servingNote`, historical label, and the complete decision evidence on every successful relink without trimming or normalizing bytes.
- Keeps an old revision's stored label after master rename; a newly authored revision may store the new primary label. No rename rewrites historical recipe text.
- Resolves inactive ingredient/specification identities for historical display and returns deterministic replacement warnings without automatic substitution.
- Clones all direct source lines into `sourceLines`; inactive recipe/line evidence remains present but produces no active dependency.
- Added the plan's exact `assertDirectLineClosure(expected, links)` helper. It fails on either count mismatch or duplicate `(recipeId, lineId)` identity.
- Added no database, UI, Food Cost, Stock, Supabase, auth, dependency, persistence, or deployment work.

## Strict TDD evidence

Initial RED before production implementation:

```bash
./node_modules/.bin/vitest run \
  src/domain/ingredients/relinkRecipeIngredients.test.ts --reporter=verbose
```

```text
Test Files 1 failed (1)
Tests no tests
Failed to resolve import "./relinkRecipeIngredients" because the file did not exist
exit 1
```

Revision-binding hardening RED:

```text
Test Files 1 failed (1)
Tests 1 failed | 11 passed (12)
decision set for another immutable source revision was accepted
exit 1
```

Focused GREEN after both implementations:

```text
Test Files 1 passed (1)
Tests 12 passed (12)
exit 0
```

RED total: **2 witnessed failing runs** (one missing-module suite; one behavioral test).
GREEN focused total: **12 passed, 0 failed**.

## Closure evidence

- The test imports the tracked immutable V1 source at `webapp-prototype/outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json`, derives its direct lines, proves the frozen literal count is **426**, and passes `assertDirectLineClosure(426, links)`.
- The test imports tracked `src/data/fixtures/first-set.json`, derives its direct lines, proves the frozen literal baseline is **108**, and passes `assertDirectLineClosure(108, links)`.
- A programmatic later-manifest fixture with **109** unique lines fails against the frozen expected count `108` and passes only after the expected manifest count changes explicitly to `109`.
- A 108-row fixture containing a duplicate identity also fails closure, proving count alone cannot hide a dropped line.
- No untracked Cookbook V6, catalog, or owner-confirmed egg fixture participates in the tests or commit.

## Verification

Task 1–6 domain regression gate:

```bash
./node_modules/.bin/vitest run \
  src/domain/ingredients/legacyIngredientSnapshot.test.ts \
  src/domain/ingredients/parseIngredientMaster.test.ts \
  src/domain/ingredients/ingredientPolicy.test.ts \
  src/domain/ingredients/reconciliation.test.ts \
  src/domain/ingredients/publishIngredientMaster.test.ts \
  src/domain/ingredients/relinkRecipeIngredients.test.ts --reporter=verbose
```

```text
Test Files 6 passed (6)
Tests 148 passed (148)
exit 0
```

Static checks:

```bash
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/eslint \
  src/domain/ingredients/relinkRecipeIngredients.ts \
  src/domain/ingredients/relinkRecipeIngredients.test.ts \
  src/domain/ingredients/types.ts
```

Both commands exited `0` with no diagnostics.

## Concerns / follow-on boundaries

- Relinked outputs intentionally carry richer preservation/evidence fields as an intersection over the existing transport `RecipeLineLink`. The current Ingredient Master parser predates Task 6 and serializes only its original minimal link fields. A later export/persistence integration must explicitly adopt the richer Task 6 result if it needs those fields inside `IngredientMasterSnapshot`; Task 6 does not expand parser ownership.
- `decisionSet` is deliberately a narrow explicit envelope containing the source SHA, recipe-line decisions, and current ingredient/specification lookup. It does not choose a repository, persistence model, or physical schema.
- Fatal validation returns no partial relink result. Inactive identity is the only warning class returned alongside a valid historical link.

---

## Fix Round 1/5 — Authoritative Relink Integrity

### Findings resolved

1. **Duplicate active source tuples and derived closure:** relinking now detects duplicate active `(recipeId, lineId)` tuples before decision indexing and fails with a deterministic issue. Successful relinking also enforces derived active-direct-line closure internally, so a single decision cannot produce duplicate active links.
2. **Authoritative preservation round-trip:** `RecipeLineLink` now owns `amountText`, `unitText`, `sourceDisplayText`, `servingNote`, `historicalLabel`, and complete `decisionEvidence` as required first-class fields for all three states. `parseIngredientMaster` parses these fields fail-closed, validates decision tuple/action agreement, rejects unknown link/evidence/action keys, and preserves the values through repeated snapshot serialization.
3. **Exact action payloads:** every active relink action must contain exactly its allowed runtime keys. Ingredient actions reject component fields, component actions reject ingredient/specification or unrelated fields, and unmapped actions reject linkage fields. Contradictory or extra payloads fail instead of being partially read.
4. **No last-entry-wins lookup:** duplicate decision IDs, Ingredient IDs, Specification IDs, recipe/component lookup IDs, decision tuples, and active source tuples are rejected before map construction or lookup.
5. **Inactive decision disposition:** inactive source lines remain cloned source evidence and create no dependency. A matching rejected/stale decision is not silently treated as an applied active decision; it is reported deterministically as `HISTORICAL_ONLY_RELINK_DECISION`. Wrong-revision decisions remain unused/fatal.
6. **Collision-safe manifest closure:** closure identities now use JSON tuple encoding, eliminating colon concatenation collisions. Added `DirectLineClosureManifest` and `assertManifestDirectLineClosure(expected, actual, links)`, binding manifest ID, source SHA, and count. `relinkRecipeIngredients` requires a source-manifest receipt and invokes this closure gate with its derived active-line count before returning.

No database, UI, Food Cost, Stock, Supabase, auth, dependency, persistence, deployment, or untracked Cookbook V6/catalog/egg artifact was added or read by the fixtures.

### RED evidence

All six finding groups were reproduced together before production repair:

```bash
./node_modules/.bin/vitest run \
  src/domain/ingredients/relinkRecipeIngredients.test.ts \
  src/domain/ingredients/parseIngredientMaster.test.ts --reporter=verbose
```

```text
Test Files 2 failed (2)
Tests 12 failed | 53 passed (65)

Failures covered:
- authoritative recipe-link fields stripped by parser;
- duplicate active source tuple accepted;
- ingredient/component/unmapped contradictory payloads accepted;
- duplicate decision/ingredient/specification/recipe lookup IDs accepted;
- rejected inactive-line decision silently consumed;
- colon tuple collision and absent manifest-bound closure helper.
exit 1
```

### GREEN evidence

Focused relink plus authoritative parser:

```text
Test Files 2 passed (2)
Tests 66 passed (66)
exit 0
```

Task 1–6 domain regression gate after the finding fixes:

```text
Test Files 6 passed (6)
Tests 161 passed (161)
exit 0
```

Static and integrity gates:

```bash
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/eslint \
  src/domain/ingredients/relinkRecipeIngredients.ts \
  src/domain/ingredients/relinkRecipeIngredients.test.ts \
  src/domain/ingredients/types.ts \
  src/domain/ingredients/parseIngredientMaster.ts \
  src/domain/ingredients/parseIngredientMaster.test.ts \
  src/domain/ingredients/ingredientPolicy.test.ts \
  src/test/ingredientBuilders.ts
/opt/homebrew/bin/git diff --check -- <seven finding-related source/test files plus report>
```

All commands exited `0` with no diagnostics after the final verification run.

### Fix files

- `src/domain/ingredients/relinkRecipeIngredients.ts`
- `src/domain/ingredients/relinkRecipeIngredients.test.ts`
- `src/domain/ingredients/types.ts`
- `src/domain/ingredients/parseIngredientMaster.ts`
- `src/domain/ingredients/parseIngredientMaster.test.ts`
- `src/domain/ingredients/ingredientPolicy.test.ts` — authoritative-link fixture fields only
- `src/test/ingredientBuilders.ts` — authoritative-link fixture fields only
- `.superpowers/sdd/2026-08-11-cookbook-ingredient-master-migration-core/task-6-report.md`

### Concerns

- No blocking concerns.
- Manifest-bound closure compares an approved expected receipt to an independently supplied/derived actual receipt; changing a count under the prior receipt fails. A later source inventory must publish and use a new manifest ID, source SHA, and count receipt together.
- The local readonly Cookbook V6 structural boundary remains unchanged and self-contained; this fix does not depend on the pre-existing untracked Cookbook V6 types file.
