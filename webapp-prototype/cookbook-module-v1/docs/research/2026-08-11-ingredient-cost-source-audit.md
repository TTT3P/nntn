# Ingredient and Cost Source Audit

Date: 2026-08-11
Scope: read-only repository evidence; no production query or mutation

## Result

The legacy Cookbook import is useful evidence, but it is not safe to promote directly into the new Ingredient Master. Keep it immutable behind an import adapter, reconcile every recipe line to a new Cookbook-owned culinary identity, and fail Food Cost closed whenever identity, price, unit conversion, yield, or provenance is missing.

## Primary evidence

Source: `webapp-prototype/outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json`

| Measure | Verified count |
| --- | ---: |
| Active legacy ingredient records | 138 |
| Legacy recipes | 101 |
| Recipe lines | 519 |
| Direct ingredient lines | 426 |
| Component-recipe lines | 93 |
| Lines still marked `needs_source_review` | 519 |
| Lines with no final quantity, final unit, or source locator | 519 |
| Lines where `conversion_applied=false` | 519 |
| Direct recipe-line unit strings | 14 |
| Purchase-unit strings | 17 |
| Ingredient records without `cost_per_unit_v1` | 2 |
| Ingredient records with yield other than `1` | 1 |

The two missing prices are:

- `MT-019` / ingredient `156` / `เนื้อสดหมักนุ่ม`
- `MT-003` / ingredient `159` / `มันเนื้อออส[500g]`

The only non-unit yield is `SP-206` / ingredient `153` / `พิคานย่าไทย (ดิบ)` with `yield_pct_v1=0.9`.

## Integrity gaps

- 44 direct lines across 39 recipes reference 16 ingredient IDs that are absent from the 138-row ingredient collection. Their rendered name is `ไม่พบชื่อวัตถุดิบ`.
- `cost_per_unit_v1` is not self-describing enough to prove whether it represents package, mass, volume, or another basis. A matching-looking `kg`, `g`, pack, bottle, or litre value is not conversion evidence.
- The current first-set fixture contains 108 direct ingredient lines, while `migrateV5ToV6.ts` deliberately assigns `ingredientId: null`. The current Cookbook document therefore has recipe evidence but no canonical Ingredient Master linkage.
- The existing production-facing pages read `ingredients`, `bom_items`, `recipe_costs`, and `recipes`. They remain read-only evidence for this initiative; they are not an authorization to reuse or mutate Stock or production Supabase.

## Recommended boundary

Treat the import as `LegacyIngredientCostSnapshot` and preserve its original text, identifiers, values, and provenance. Import through a read-only adapter into a deterministic reconciliation report.

Create one Cookbook Ingredient representation that owns:

- stable culinary ingredient identity;
- kitchen display name, aliases, and active state;
- evidenced kitchen base unit and conversions;
- versioned Cost Observations containing value, currency, basis quantity/unit, effective time, and source reference;
- explicit mappings from legacy identifiers and later Stock SKUs without merging those identities.

Each recipe line must resolve to a canonical Cookbook Ingredient or an explicit `unmapped` state. Food Cost must return missing-evidence diagnostics rather than zero, one, or an inferred conversion.

## Devbook contract applied

- DRY: one authoritative representation for each piece of knowledge.
- Boundary adapters: legacy and later Stock data remain behind controlled interfaces.
- Defensive programming: invalid or incomplete external data produces no derived cost.
- Plain text: preserve source snapshots and reconciliation output in inspectable formats.
- Tracer bullets: prove one ingredient-to-recipe-to-cost path end to end before bulk migration.
- State coverage: test mapped, unmapped, missing-price, missing-conversion, stale-price, and cyclic-component states.

## Next decision

Resolve [Choose the canonical ingredient identity and reconciliation policy](https://github.com/TTT3P/nntn/issues/25) before defining the calculator or production schema.

## Migration-core read-only verification — 2026-08-11

The owner-approved identity and migration policy is now represented by a transport-neutral migration core. Its boundary is deliberately narrow: immutable staging, deterministic reconciliation proposals, explicit decisions, transactional in-memory publication, recipe relinking, evidence-state reporting, exact JSON export, and an owned compare-and-swap byte interface. It does not include Food Cost arithmetic, an Ingredient Master UI, or a physical backend.

Fresh Task 8 evidence re-read the checked-in V1 import and reproduced the source receipt without creating reconciliation decisions:

| Evidence | Verified result |
| --- | ---: |
| V1 SHA-256 | `473975a555da7b1e67f2357ac0dbb0d65af6cc6f36d6095eededa376e6537a94` |
| Ingredients / recipes | 138 / 101 |
| Direct / component / total lines | 426 / 93 / 519 |
| Missing-price ingredient records | 2 |
| Missing-master references | 44 lines / 39 recipes / 16 ingredient IDs |
| Current first-set direct-line receipt | 108, still unresolved (`ingredientId: null`) |

The isolated tracer covers a generic oyster-sauce line that still requires a later costing-specification selection, an exact Mae Krua requirement, unrefined and white sugar as distinct specifications, two Stock package mappings to one specification, an inactive specification with its historical label intact, missing price evidence, an absent legacy identity kept explicitly unmapped, and cooked rice reclassified to exactly one Component Recipe. It executes stage → propose → decide → publish → relink → report → exact export → CAS, then repeats the import and proves zero new canonical records, byte-stable export, and a stable report. Its raw fixture JSON is unchanged and no Food Cost total is calculated.

Run the read-only evidence gates from `webapp-prototype/cookbook-module-v1/`:

```bash
npm run test:ingredients:inputs
npm test -- src/domain/ingredients/ingredientMigrationTracer.test.ts
```

In the current controller environment npm wrappers exit `255` before their child output. The explicit local fallback used for evidence was:

```bash
node scripts/verify-ingredient-migration-inputs.mjs
node --trace-uncaught node_modules/vitest/vitest.mjs run --reporter=verbose --maxWorkers=1 src/domain/ingredients/ingredientMigrationTracer.test.ts
```

No Ingredient Master record was published to a real database. Task 8 did not access or change Stock V1/V2, Supabase, auth, cloud resources, deployment, MAW, CROO, or production data. Remaining work is explicit: issue #26 owns Food Cost selection/arithmetic/rounding/staleness/recursive components; issue #28 owns reconciliation and Ingredient Master UI; issue #31 owns physical persistence, live adapters, shadow-read cutover, rollback selection, auth, and deployment.

Post-test read-only verification was identical to the before-test receipt: V4 remained 5/5, `SHA256SUMS.txt` remained `9b289542a031c0d5652a09d876a09a027e0838a2196f8bcb6315d47aa0090b70`, real V5 remained `9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7`, and current real V6 remained `96775abb92580182e4c9b4bb324d199a8bf4bb043b572170e379276119031695`.
