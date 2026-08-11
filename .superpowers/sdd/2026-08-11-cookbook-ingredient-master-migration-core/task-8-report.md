# Task 8 Report — Migration Tracer and Read-only Acceptance

## Status

Implementation, unit/static verification, documentation, and immutable-artifact verification are complete. The first browser gate is blocked by the controller's Chrome launch environment; downstream browser gates remain unexecuted under the required stop-on-first-failure policy until a Chrome-capable controller supplies fresh evidence.

## Changed files

- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/ingredientMigrationTracer.test.ts`
- `webapp-prototype/cookbook-module-v1/src/domain/ingredients/legacyIngredientSnapshot.ts` — minimal read-only acceptance contract gap exposed by RED.
- `webapp-prototype/cookbook-module-v1/docs/research/2026-08-11-ingredient-cost-source-audit.md` — appended Task 8 receipts and boundaries; preserved all pre-existing untracked content.
- `webapp-prototype/cookbook-module-v1/docs/HANDOFF.md` — Task 8-only appended section; pre-task dirty content preserved and excluded from staging.
- `webapp-prototype/cookbook-module-v1/README.md` — Task 8-only appended section; pre-task dirty content preserved and excluded from staging.
- `.superpowers/sdd/2026-08-11-cookbook-ingredient-master-migration-core/task-8-report.md`

## Implementation

- Added an end-to-end isolated tracer over the real Task 0–7 APIs: immutable stage → deterministic proposal → explicit decision → transactional publish → discriminated relink → evidence report → exact JSON export → in-memory CAS.
- Covered generic oyster sauce, exact Mae Krua, unrefined/white sugar, two Stock package mappings to one specification, later-inactive specification with preserved historical label, missing price, explicit unmapped legacy ID, and cooked rice as a Component Recipe.
- Proved raw fixture JSON stays byte-identical and recursively asserted that no Food Cost total or margin field is produced.
- Replayed the same staged batch and decisions: every decision was already applied, canonical record counts did not grow, exact bytes remained stable, and the report was identical.
- Exercised CAS `rev-1`, stale-write rejection, and winning-byte authority.
- Added a pure `buildLegacyIngredientInventoryReport` because Task 7's canonical report correctly requires direct-line closure and therefore cannot report the full V1 queue without manufacturing 426 decisions. The new projection only derives source counts, two missing-price identities, and absent-reference counts from the read-only source.
- Proved the checked-in V1 receipt is 426 direct / 93 component / 519 total, two missing prices, and 44 lines / 39 recipes / 16 absent IDs, with no decision collection.
- Proved the current first set remains exactly 108 unresolved direct lines with `ingredientId: null`.
- Added no Food Cost engine, UI, physical persistence, database, filesystem store, browser store, network adapter, dependency, production write, Stock write, auth, Supabase, cloud, or deployment surface.

## Strict TDD evidence

Required npm focused command:

```text
npm test -- src/domain/ingredients/ingredientMigrationTracer.test.ts
exit 255 before Vitest output (known controller wrapper limitation)
```

Initial direct RED:

```text
Test Files 1 failed (1)
Tests 3 failed | 1 passed (4)
exit 1
```

Two failures exposed the existing publisher rule that a new decision cannot target an already-inactive specification. The fixture chronology was corrected to publish while active, then inactivate later for historical read/relink. No production guard changed.

Final intended direct RED before production repair:

```text
Test Files 1 failed (1)
Tests 1 failed | 3 passed (4)
TypeError: buildLegacyIngredientInventoryReport is not a function
exit 1
```

Focused GREEN:

```text
Test Files 1 passed (1)
Tests 4 passed (4)
exit 0
```

## Immutable source and artifact evidence

Before any test:

```text
V4 SHA256SUMS: 5/5 OK
SHA256SUMS.txt: present, 447 bytes, 9b289542a031c0d5652a09d876a09a027e0838a2196f8bcb6315d47aa0090b70
real V5: present, 168732 bytes, 9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7
current real V6: present, 182093 bytes, 96775abb92580182e4c9b4bb324d199a8bf4bb043b572170e379276119031695
```

After all executed tests, these paths, presence states, byte lengths, hashes, and V4 5/5 results were identical.

The immutable V1 verifier npm wrapper exited `255`; direct `node scripts/verify-ingredient-migration-inputs.mjs` exited `0` and printed:

```json
{"path":"../outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json","sha256":"473975a555da7b1e67f2357ac0dbb0d65af6cc6f36d6095eededa376e6537a94","ingredients":138,"recipes":101,"lines":519,"directLines":426,"componentLines":93}
```

## Sequential gate evidence

| Gate | npm exit | Direct/result |
| --- | ---: | --- |
| Immutable input verifier | 255 | exit 0; exact receipt above |
| Full Vitest | 255 | exit 0; 53 files / 1062 tests |
| ESLint | 255 | exit 0; no diagnostics |
| TypeScript | 255 | exit 0; no diagnostics |
| Production build | 255 | direct TypeScript exit 0; Vite exit 0; 69 modules |
| Full `git diff --check` | n/a | exit 0 before docs closure |
| Browser layout harness | 255 | exit 1 before tests; system Chrome SIGABRT |

The browser harness used its existing approved system path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (version 151.0.7922.108), temporary Playwright profile, and existing configuration. A raw isolated-profile Chrome probe also exited `134` without creating a profile. No alternate approved Chromium or bundled Playwright browser is installed. Assertions and configuration were not weakened. Per the required sequential stop, browser export, default Playwright, local-draft Playwright, and V6 Playwright have not been run in this controller after the layout gate failed.

## Boundaries and remaining work

- #26 remains: costing-specification selection, eligibility/staleness, recursive component Food Cost, rounding, batch/portion totals, and margin.
- #28 remains: reconciliation queue and Ingredient Master UI/CRUD/workflow/export surfaces.
- #31 remains: physical backend/schema/adapter, durable CAS/revision, live read-only price refresh, shadow read, adapter cutover, rollback selection, auth, and deployment.
- Design acceptance 19–20 are recorded exactly as `NOT EXECUTED — blocked by #31` in `docs/HANDOFF.md`.
- No Ingredient Master record was published to a real database. No Stock V1/V2, Supabase, auth, cloud, deployment, MAW, CROO, or production surface was accessed or changed.

## Concerns

- Completion is blocked only on fresh Chrome-capable execution of the five sequential browser/persistence gates. Unit/static/domain behavior and immutable artifacts are verified; no browser, shadow-read cutover, rollback, production migration, release, or deployment claim is made.

## Browser verification recovery checkpoint

The parent controller proved that a managed Playwright browser server can launch outside this sandbox and that the repository's Playwright 1.62 client can connect when the websocket handshake carries the caller-supplied compatible User-Agent. The recovery change adds no endpoint or version constant: operators may opt in with `PLAYWRIGHT_WS_ENDPOINT` and, when required by the server, `PLAYWRIGHT_WS_USER_AGENT`.

- `tests/print-layout.browser.mjs` and `tests/snapshot-export.browser.mjs` now call `chromium.connect` only when a non-empty endpoint is supplied. With no endpoint, their prior system-browser `chromium.launch` path is unchanged.
- `playwright.config.ts` and `playwright.local.config.ts` expose the same opt-in through Playwright Test `use.connectOptions`; `playwright.v6.local.config.ts` inherits the local `use` object unchanged.
- The optional User-Agent becomes exactly one websocket handshake header. Blank/absent User-Agent adds no header.
- No endpoint, token, Playwright version, browser path, assertion exception, retry, or timeout was hardcoded or weakened.

Strict TDD recovery evidence:

```text
npm focused wrapper: exit 255 before Vitest output
direct RED: 1 file; 2 failed / 2 passed; exit 1
direct GREEN: 1 file; 4 passed / 4; exit 0
scoped ESLint: exit 0
TypeScript: exit 0
both standalone harness syntax checks: exit 0
full git diff --check: exit 0
```

Browser gates were intentionally not run in this worker. The parent controller owns launching the ephemeral managed endpoint and running the five gates sequentially with these opt-in variables.
