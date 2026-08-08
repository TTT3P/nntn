# Work-stage V5/V4 Data Integration Design

**Date:** 2026-08-08
**Scope:** Cookbook Module V1 local pilot only
**Status:** Implemented and independently verified on 2026-08-08

## Goal

Make the existing Work-stage surface read the canonical local Kitchen SOT V5 draft, falling back to the checksum-verified V4 document, while preserving the Work-stage UI, dependency ordering, session-only media editing, and every verified M1/M2 data rule.

This milestone is a data-source correction. It does not redesign Work-stage, add recipe-editing fields, change print templates, or expand persistence.

## Authority and Boundaries

- The raw `KitchenSotDocument` remains the canonical recipe state.
- V5 draft is preferred when present; verified V4 is the fallback.
- `CookbookSnapshot` remains a read-only projection. It must never be used to construct, validate, or save V5.
- The frozen V4 source and `SHA256SUMS.txt` remain read-only.
- Tests use the isolated local-draft vault and must not create the real V5 draft artifact.
- Stock V1/V2, auth, Supabase, production data, deployment, MAW, and CROO are out of scope.
- No new dependency is authorized.
- No commit is authorized by this design approval; committing requires a separate explicit TINE instruction.

## Selected Approach

Reuse the verified Kitchen SOT read projection already consumed by Print Center instead of creating a Work-stage-specific mapper.

The existing projection already preserves the fields Work-stage needs:

- all 18 recipes in raw document order;
- numeric and string recipe/component identities without coercion;
- exact item `candidate_text` as `IngredientLine.sourceText`;
- unresolved blocker messages verbatim;
- raw-derived DRAFT state through the shared predicate;
- `work_documents` for Prep, Cook, and Service;
- session media and ordered step-media links from the prototype snapshot.

Work-stage will consume this projection as a read view. A small shared/generic export name may be added in the existing projection module if needed for clarity, but the verified Print Center API and behavior must remain compatible. The change must not duplicate readiness or raw-mapping business rules.

## Data Flow

```text
KitchenSotDraftProvider
  ├─ ready V5 draft ───────┐
  └─ verified V4 fallback ─┴─> shared raw read projection
                                   ├─ CookbookSnapshot read view
                                   └─ recipeDraftById map
                                              │
PrototypeProvider session media ──────────────┘
                                              │
                                              v
                                    WorkStagePage
                                      ├─ dependency graph/order
                                      ├─ projectWorkDocuments
                                      ├─ exact source facts/blockers
                                      └─ session-only StepMediaEditor
```

When Work-stage is rendered inside the normal application provider, raw Kitchen SOT state is authoritative. Existing isolated component/static tests that intentionally omit the raw provider may retain the embedded fixture snapshot as a compatibility fallback, but that fallback must not be treated as authoritative readiness when raw state exists.

Loading and checksum/transport errors remain owned by `KitchenSotDraftProvider`, which blocks child rendering and shows its existing status or error. Work-stage must not promote fixture data over a raw load failure.

## Readiness and Error Rules

Work-stage must use the same raw three-condition DRAFT predicate used by Recipe Studio, Library, Detail, and Print Center:

1. any blocker has `resolved != true`;
2. any item has `decision_status` in `{needs_review, conflict}`; or
3. an item has `selected_source="owner_confirmation"` while `source_values.owner_confirmation` is missing or blank.

Requirements:

- The predicate exists in one canonical implementation; Work-stage must not copy it.
- Recipe 159 remains DRAFT because its owner provenance is incomplete.
- Missing raw readiness for a recipe fails closed to DRAFT or a clear “ตรวจใน Recipe Studio” state; it must never default to “พร้อมใช้งาน”.
- Missing or review-needed media remains informational and does not create DRAFT by itself.
- Unresolved blocker text is displayed exactly as stored. Resolved blocker history remains in the raw document but is not shown as an active blocker.
- Invalid route identities, invalid stage queries, graph errors, and projection errors retain the existing explicit error surfaces.

## Source-Value and Method Rules

- Work-stage displays item quantity from `candidate_text` only.
- It must not calculate, parse, scale, normalize, or convert quantity/unit text.
- It must not fall back to `sourceValue`/`sourceUnit` when using the raw projection; those projected numeric fields remain `null`.
- Existing multiline text remains preserved with `white-space: pre-wrap`.
- A recipe with no method must still render its mapped stage, ingredients, exact blockers, and DRAFT status.
- Empty method data must not cause an error and must not produce invented steps.
- Yield, cost-basis, serving-note, provenance, and blocker history remain raw-document facts; this milestone adds no new display or edit field for them.

## Dependency and Stage Behavior

- The selected recipe is resolved using exact mixed-type identity matching.
- Reachable prepared dependencies remain dependency-first and render once.
- Unrelated recipes must not be projected into the selected work pack.
- Stage order remains Prep → Cook → Service.
- Explicit `prep`, `cook`, `service`, and `all` route behavior remains unchanged.
- An explicitly selected unmapped stage retains the existing explanatory empty state.
- Existing operational Thai stage labels remain unchanged.

## Media Editing

- `StepMediaEditor` remains available for projected step IDs.
- Media edits remain session-only through `PrototypeProvider`.
- The raw Kitchen SOT document is never mutated by media actions.
- Existing media ordering, role, vessel, DEMO/review status, and export behavior remain unchanged.
- A mismatch between raw step projection and session media must use existing validation/error behavior rather than silently reassigning media.

## UI Contract

This milestone must not redesign Work-stage.

The existing page hierarchy, stage navigation, tables, headings, labels, and session-media controls remain intact. Only source labels or a compact V4/V5 origin indicator may be added if needed to prevent ambiguity; no new cards, dashboard metrics, recipe fields, print controls, or decorative system is authorized.

## Verification Design

### Unit/component coverage

Add or extend tests to prove:

1. Work-stage selects all 18 raw recipes from V5/V4 rather than fixture-only names.
2. A V5-edited `candidate_text` appears and the stale V4/fixture value does not.
3. `candidate_text` is rendered exactly, including multiline and kitchen-unit text, with no numeric leakage.
4. Recipe 159 is DRAFT from the shared raw readiness map.
5. A raw-ready recipe remains ready when media alone is missing.
6. Every unresolved blocker for a selected recipe appears verbatim; resolved blockers are not active warnings.
7. Recipe 162 renders a non-empty Prep document with four ingredient rows, zero invented steps, and DRAFT status.
8. Numeric and string recipe/component identities round-trip without coercion.
9. Prepared dependencies remain dependency-first, deduplicated, and exclude unrelated recipes.
10. Missing readiness-map entries fail closed.
11. Provider loading/error behavior does not fall back to fixture content.
12. Existing route, stage, media, and error regressions remain green.

### Actual-App local-draft coverage

In the isolated test vault:

1. load verified V4 through the development middleware;
2. enter and save one owner-confirmed quantity in Recipe Studio;
3. reload the application;
4. open Work-stage for the affected recipe/stage;
5. assert the saved V5 text appears and the baseline text does not;
6. assert origin is V5 draft where an origin label is rendered;
7. assert recipe 159 and exact unresolved blocker evidence remain DRAFT; and
8. assert the isolated draft persists while the real vault remains untouched.

### Sequential completion gate

Run in order and stop at the first failure:

1. unit tests;
2. lint;
3. typecheck;
4. production build;
5. browser layout harness;
6. browser export harness;
7. actual-App media-print suite;
8. default Playwright E2E;
9. isolated local-draft E2E;
10. `git diff --check`;
11. V4 `SHA256SUMS.txt` verification (5/5); and
12. confirmation that the real `Operations/CookBook/sot/v5-draft` path is absent.

The final diff must remain inside the standalone Cookbook scope and contain no Stock, auth, Supabase, production, deployment, MAW, or CROO changes.

## Acceptance Criteria

The milestone is complete only when all of the following are true:

1. Normal application Work-stage uses V5 draft with checksum-verified V4 fallback.
2. All 18 raw recipes and mixed identities remain addressable.
3. Work-stage quantities equal raw `candidate_text` byte-for-byte as JavaScript strings.
4. Work-stage uses the shared raw readiness predicate and fails closed.
5. Recipe 159 is DRAFT consistently with Recipe Studio, Library, Detail, and Print Center.
6. Exact unresolved blocker messages are visible and resolved blocker history is not presented as active.
7. All five missing-method recipes render without errors or invented steps; recipe 162 has explicit component and browser coverage.
8. Dependency-first ordering, deduplication, stage filtering, route errors, and session media behavior remain unchanged.
9. A saved isolated V5 edit survives reload and appears in Work-stage.
10. The complete sequential gate passes with zero failed or skipped required assertions.
11. V4 checksum remains valid, no real V5 test artifact exists, and forbidden scopes remain untouched.
12. An independent verifier approves the final artifact before HANDOFF is changed from pending to GO.

## Out of Scope

- Work-stage visual redesign.
- Recipe, method, yield, blocker, serving-note, or cost-basis editing from Work-stage.
- Durable media storage or media writes into V5.
- Print template or Print Center redesign.
- Changing V5 schema, persistence middleware, validation, concurrency, key ordering, or source allowlists.
- Final kitchen-data approval.
- Supabase, production, deployment, authentication, Stock V1/V2, MAW, or CROO work.

## Completion Record

After independent approval, append a Work-stage local-pilot GO section to `docs/HANDOFF.md` containing the verified artifact identity, gate counts, V4/V5 safety evidence, and remaining production/data boundaries. Do not claim a commit if the approved artifact remains an uncommitted worktree.
