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
