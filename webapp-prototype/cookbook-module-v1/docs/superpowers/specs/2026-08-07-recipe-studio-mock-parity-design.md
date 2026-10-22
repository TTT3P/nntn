# Recipe Studio Mock-Parity Design

**Date:** 2026-08-07
**Status:** Approved direction by TINE; written-spec review pending
**Scope:** Cookbook Module V1 local pilot only

## Outcome

Make the React Recipe Studio visually match `../preview-kitchen-sot-desktop.png` while preserving every verified Milestone 1 V5 behavior. The page remains a local fill surface for the 18 frozen V4 recipes. This work does not start Print Milestone 2 and does not touch Stock V1/V2, Supabase, authentication, production data, or deployment.

The visual reference controls page structure, palette, spacing, typography, cards, status badges, and responsive behavior. Small font-rendering differences between browsers are acceptable; missing sections, materially different hierarchy, or a different editing workflow are not.

## Chosen Approach

Port the approved static mock's presentation structure into the existing React Source Review surface. Keep the raw V5 draft document, provider, edit commands, validation, optimistic concurrency, and Vite middleware as the only persistence path.

Rejected alternatives:

- A CSS-only skin cannot reproduce the mock hierarchy without fragile selectors and misplaced semantics.
- Replacing the React surface with the old static mock would duplicate business behavior and risk V5 persistence regressions.

## Page Structure

The Source Review route keeps its current URL and becomes the Recipe Studio workspace shown in the mock:

1. Dark-green branded header with the local-pilot badge.
2. Workspace tabs with Source Review active.
3. Intro block explaining that original kitchen units are preserved.
4. Derived summary cards for all recipes, sellable/prepared counts, fill targets, and blockers.
5. A two-column desktop workspace:
   - left: searchable/filterable recipe queue with status and outstanding counts;
   - right: the selected recipe's source evidence and editable V5 fields.
6. A sticky save area inside the detail panel with dirty, saving, success, stale-draft, and error states.

At narrow widths the workspace becomes one column. The queue appears before the selected recipe, cards and tables avoid horizontal body overflow, touch targets remain usable, and the sticky save area does not cover inputs.

## Component Boundaries

Presentation is split along visible responsibilities while retaining the existing domain boundary:

- `RecipeStudioHeader`: branded context and prototype/local-pilot notice.
- `RecipeStudioSummary`: values derived from the loaded raw document only.
- `RecipeQueue`: search, filters, selection, READY/DRAFT badge, and outstanding counts.
- `RecipeReviewPanel`: selected recipe identity, source mapping, readiness, and edit sections.
- Existing item, method/yield, blocker, and save controls are restyled or extracted without changing their edit payloads.

`KitchenSotDraftProvider` remains the state owner. UI components receive raw-derived view data and dispatch the existing `KitchenSotEdit` variants. No component reconstructs a V5 document from the lossy Cookbook snapshot.

## V5 Logic Invariants

The visual rewrite must preserve these verified behaviors:

- all 18 recipes load from the allowed V4/V5 endpoints;
- all summary numbers are derived, never hard-coded;
- `candidate_text` remains the displayed/printed quantity source;
- owner edits set the existing provenance fields and required decision note;
- method edits require their existing scope note;
- blocker messages and codes remain immutable, with resolution appended only through the existing edit command;
- readiness continues to use the single canonical raw-document predicate;
- recipe 159 remains DRAFT across Recipe Studio, Library, and Detail;
- unchanged records remain byte-stable apart from allowed file-level metadata;
- save remains atomic and rejects stale tabs;
- V4 remains read-only and checksum-gated;
- no test or visual review creates the real V5 draft artifact.

Existing accessible names and stable test selectors used by the M1 regression suite remain intact. Visual wrappers may be added, but controls must remain properly labelled and keyboard reachable.

## State and Error Presentation

- Loading: branded page shell with a clear loading message; no false READY state.
- V4 checksum or transport error: fail closed with the existing error text in a prominent alert card.
- Dirty: save bar states that local changes are not yet written.
- Saving: controls remain locked according to the current provider contract.
- Saved: show the latest save confirmation without implying production publication.
- Conflict: stale-tab response remains a visible blocking alert and does not overwrite the newer draft.
- Recipe with missing method or unresolved decisions: remains editable and visibly DRAFT rather than producing a render error.

## Verification

Visual acceptance:

- At desktop width, structure and hierarchy match `preview-kitchen-sot-desktop.png`: header, tabs, summary strip, queue/detail split, source cards, item cards, method area, and save actions.
- At mobile width, the page follows `preview-kitchen-sot-mobile.png` without horizontal body overflow or covered controls.
- READY/DRAFT, blockers, and all editable values remain legible and visually distinct.
- A before/after screenshot review is performed at desktop and mobile sizes.

Regression acceptance, run sequentially on the final working tree:

1. Unit suite.
2. Lint.
3. Typecheck.
4. Build.
5. Browser layout harness.
6. Browser export harness.
7. Default E2E suite.
8. Isolated local-draft E2E suite.
9. `git diff --check` using `/opt/homebrew/bin/git`.
10. V4 checksum unchanged and real V5 draft absent after verification.

## Out of Scope

- Print Center data replacement or print-template changes.
- Work-stage redesign.
- Creating new recipes or changing recipe content.
- Supabase, authentication, production persistence, deployment, Stock V1/V2, MAW, or CROO work.
- New dependencies or a new design system.

## Stop Condition

This visual milestone is complete only when the Source Review route matches the approved mock at desktop and mobile widths, the verified V5 logic remains intact, every required regression gate passes, V4 stays unchanged, and no real V5 draft is produced by verification.
