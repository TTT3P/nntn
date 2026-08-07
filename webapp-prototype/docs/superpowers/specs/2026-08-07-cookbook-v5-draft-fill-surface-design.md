# NNTN Cookbook — V5 Draft Fill Surface Design

**Date:** 2026-08-07

**Status:** Approved by TINE on 2026-08-07

**Milestone:** M1 — persistent Recipe Studio fill surface

**Application:** `webapp-prototype/cookbook-module-v1`

**Authority:** TINE scope correction and NNTN Oracle decision received on 2026-08-07

## 1. Outcome

Turn the existing local Cookbook prototype into the single place where TINE can fill the missing kitchen facts after collecting them from the kitchen team.

This milestone must:

1. load all 18 recipes from the frozen V4 kitchen SOT candidate;
2. let TINE enter owner-confirmed ingredient quantities, methods, yield, relevant serving/cost-basis notes, and blocker resolutions;
3. persist those edits to one new V5 draft artifact;
4. reopen the persisted draft after the browser is closed and opened again; and
5. preserve the frozen V4 source as immutable provenance.

Printing is a downstream consumer of the saved data and remains Milestone 2. This milestone does not redesign the accepted Cookbook UI or print templates.

## 2. Hard Scope Boundaries

The implementation is a local pilot only.

It must not:

- touch Stock V1 or Stock V2;
- change authentication, Supabase, production data, deployment, MAW/CROO, or GitHub Pages;
- write to, delete, rename, replace, or change permissions on the frozen V4 source;
- normalize kitchen units or derive replacement quantities;
- invent missing recipe content;
- redesign Recipe Studio or Print Center;
- implement Print Center data migration in M1; or
- create another checklist, spreadsheet, database, or parallel SOT.

The single new data artifact is:

`Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json`

## 3. Source Authority

The immutable source is:

`Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json`

Its expected checksum is read from the adjacent `SHA256SUMS.txt`. The current verified SHA-256 is:

`09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`

The source contains:

- 4 sellable menus;
- 14 prepared recipes;
- 18 recipes total; and
- 13 blocker instances.

The current fill targets derived from this V4 snapshot are:

- 15 unique items with an unresolved decision status: 8 marked `needs_review` and 7 marked `conflict`;
- 8 of those 15 unresolved items also have no selected source; this is an overlapping diagnostic, not an additional count;
- 5 recipes whose method is missing: recipe IDs `2`, `160`, `9`, `161`, and `162`;
- 1 provenance-incomplete item whose selected source says owner confirmation but whose owner-confirmation source value is absent; and
- 13 blockers requiring evidence or a decision.

The deduplicated unresolved-item fill target is 16: the 15 status-unresolved items plus the one provenance-incomplete item, which is not part of the 15. These numbers document the accepted source snapshot; every count displayed by the application is derived from the loaded document and is never hardcoded.

## 4. Chosen Storage Approach

Use a dev-only Vite `configureServer` plugin in the existing `cookbook-module-v1` development server.

The plugin exposes exactly two local API paths:

1. a read-only V4 endpoint; and
2. a read/write V5 draft endpoint.

The browser first requests V5. If V5 does not exist, it requests the verified V4 source. The UI never receives a request-supplied filesystem path.

Every successful load returns both the frozen V4 source SHA-256 and a `base_sha256` for the exact document bytes being edited. A save sends that `base_sha256` in the JSON request and the same value as an `If-Match` header. The server accepts the write only when both values agree with each other and with the current V5 bytes, or with V4 bytes on the first save. A stale tab receives a conflict response and must reload instead of overwriting a newer draft.

This approach is chosen because it:

- reuses the Vite process TINE already starts;
- introduces no dependency, extra process, or extra port;
- can safely write the required local artifact;
- dies with the dev server; and
- cannot appear in Vite production build output.

Rejected alternatives:

- **Standalone companion server:** equivalent capability but adds a process and maintenance surface.
- **File System Access API:** depends on browser permissions and manual file selection and cannot guarantee the exact artifact path.
- **localStorage plus download:** persists only in one browser profile and fails the canonical-file acceptance criteria.

## 5. Filesystem Security Contract

The middleware resolves all filesystem targets itself from the local vault root. Request payloads cannot select or alter a path.

It allowlists only:

- `READ` for the exact V4 JSON file; and
- `READ/WRITE` for the exact V5 draft JSON file.

Before every operation, the middleware resolves the real target and verifies containment beneath the expected source or draft directory. Any path traversal, symlink escape, unexpected filename, unsupported method, or operation outside the allowlist fails closed.

Additional rules:

- V4 checksum verification is mandatory before V4 is served and before a V5 save is accepted.
- A checksum mismatch returns a clear blocking error and no recipe data.
- V5 writes are atomic: write a sibling temporary file, sync/close it, then rename it over the target.
- The middleware may create the new `v5-draft` directory when absent.
- It may not delete files or invoke `chmod`.
- Failed writes clean up only the temporary file created by that request.
- The plugin exists only in the development server hook and does not expose runtime code in `vite build` output.

## 6. Draft Load and Save Lifecycle

### 6.0 Canonical persistence boundary

The raw V4/V5 JSON document is the canonical editable state. The application patches explicit dirty records in a lossless clone of that raw document and validates/saves the resulting raw document.

The existing `CookbookSnapshot` and `RecipeVersion` types are lossy read projections: they omit `source_values`, decision notes, serving/cost-basis fields, blocker objects, method provenance, and yield. They may continue to support Library, Work Stage, Media, and Print as read-only projections, but they must never be used to construct, validate, or save V5.

Dirty scope is record-specific and is calculated by comparing the raw working record with its raw baseline. File metadata such as `generated_at` does not make every recipe or item dirty.

### 6.1 Load

1. Request V5 draft and its current `base_sha256`.
2. If V5 exists and validates, use it as the working document.
3. If V5 does not exist, request V4.
4. The server verifies V4 SHA-256 against `SHA256SUMS.txt` before returning it.
5. The application renders all 18 recipes, including incomplete recipes.

A missing method is valid draft data, not an application error.

### 6.2 Edit

The UI keeps a working copy in memory and marks changed fields as dirty. Original source values and blocker evidence remain visible.

No data reaches the vault until TINE presses the new M1 save-draft control.

### 6.3 Save

On save, the client builds a V5 draft from the loaded raw document and applies only explicit dirty-record edits plus required file-level metadata. It submits the loaded `base_sha256` in both the JSON body and `If-Match`. The server verifies optimistic concurrency and V4, validates the payload, and atomically writes V5.

The successful response includes the saved timestamp and SHA-256. The UI reports that the draft was saved locally and clears the dirty state only after the server confirms the rename.

Closing and reopening the page then loads the same V5 draft.

## 7. V5 File Contract

The V5 draft preserves recipe order, item order, existing key order, and all untouched values from V4.

Required file-level changes are:

- `schema_version = "2.1.0-prototype-draft"`;
- `generated_at` becomes the timestamp of the latest successful save; and
- a top-level `derived_from = { path, sha256 }` identifies the exact frozen V4 source.

The serializer retains the existing JSON indentation/newline convention so a V5-versus-V4 diff contains only:

- fields explicitly changed by TINE;
- permitted blocker-resolution fields; and
- the required V5 file metadata.

It must not normalize, alphabetize, or reorder recipes, items, source values, arrays, or unrelated object keys.

## 8. Editable Field Mapping

### 8.1 Ingredient quantity confirmed by TINE

Entering a kitchen quantity updates the existing item as follows:

- `source_values.owner_confirmation` = the raw text entered by TINE;
- `candidate_text` = the value used by the Cookbook;
- `selected_source = "owner_confirmation"`;
- `decision_status = "confirmed_by_owner"`; and
- `decision_note` records that the owner confirmed the value and includes the confirmation date.

The application preserves the entered kitchen unit exactly. It never converts, rounds, parses into another unit, or reverse-calculates a quantity.

The item decision note is generated from the recipe, item, entered value, and local confirmation date, and is shown before save. This keeps provenance mandatory without requiring TINE to retype boilerplate.

The value `confirmed` is not used for owner entry because V4 reserves it for matching-source decisions.

Owner-provenance validation applies only to items changed in the current save. An inherited V4 item that already says `selected_source = "owner_confirmation"` and `decision_status = "confirmed_by_owner"` but lacks `source_values.owner_confirmation` is grandfathered unchanged until TINE edits it. The validator must not block an unrelated save, backfill the missing value, or rewrite that inherited row.

The provenance-incomplete predicate is triggered only by `selected_source = "owner_confirmation"` with a missing or empty `source_values.owner_confirmation`. It must not trigger from `decision_status` alone and must not be implemented as a whole-document provenance sweep. V4 contains an intentional asymmetry: one item has `decision_status = "confirmed_by_owner"` while `selected_source = "matching_sources"`; that item is not provenance-incomplete.

### 8.2 Serving and cost basis

The existing fields `serving_note` and `cost_basis_text` are optional. The UI exposes them only as supporting fields when the kitchen serving quantity differs from the costing basis. They do not trigger unit conversion or calculation.

### 8.3 Method

Entering a method updates:

- `method_candidate_text`; and
- `method_selected_source = "owner_confirmation"`.

`method_decision_note` is required whenever the method changes. It must say what the received kitchen account still does not cover so the application cannot imply invented preparation, storage, holding, or yield instructions.

The five recipes currently lacking method content render as editable DRAFT recipes rather than errors.

### 8.4 Yield

Yield is stored in the existing `yield_candidate_text` field. No new yield field or calculated yield is introduced.

### 8.5 Blockers

Existing blocker `code` and `message` values are immutable evidence. The UI always displays the original Thai message without hiding, translating, or rewriting it.

Resolving a blocker adds only:

- `resolved = true`;
- `resolved_note`; and
- `resolved_at`.

A resolution requires a note. Reopening the draft shows the original blocker message and its resolution metadata together.

A blocker with `code = "missing_method"` cannot be resolved while `method_candidate_text` is empty. The only exception is an explicit owner N/A decision: `resolved_note` must begin with `เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A):` and include a meaningful reason after the colon. The UI presents this as an explicit owner-N/A choice; it never infers N/A from an empty method.

`review_state` is a frozen V4 observation and must not be changed or recomputed.

## 9. Readiness and DRAFT Rules

Readiness is derived at render time from blocker resolution, unresolved item decisions, and owner-provenance completeness rather than copied from `review_state` or maintained as a second mutable status.

A recipe displays DRAFT whenever any condition is true:

1. at least one blocker has `resolved != true`; or
2. at least one item has `decision_status` equal to `needs_review` or `conflict`; or
3. an item has `selected_source = "owner_confirmation"` while `source_values.owner_confirmation` is missing or empty.

The third condition is the derived `provenance incomplete` fill cue. The current V4 snapshot contains one such item in recipe 159, but the application derives the condition from data and never hardcodes that recipe ID.

Ingredient decision states remain independent fill cues. V4 does not link blockers to item `line_key` values, so the application must not infer that resolving a recipe blocker resolves any ingredient decision. For example, recipe 28 has seven `needs_review` items and one unrelated `missing_source` blocker; resolving that blocker alone must leave the recipe DRAFT.

Resolved blockers remain in the document as history but no longer block readiness. Unresolved blocker messages remain visible verbatim.

Missing method content always remains visible as missing. It never crashes rendering and never causes a synthetic method to appear.

Displayed quantities use `candidate_text` only.

## 10. User Interface

The accepted visual system and navigation remain unchanged. M1 extends the existing Source Review/Recipe Studio surface with functional controls rather than creating a new layout.

For each selected recipe, the surface shows:

- recipe identity and derived DRAFT/readiness state;
- ingredient rows with existing source evidence and an owner-confirmation input;
- a derived `provenance incomplete` cue whenever `selected_source = "owner_confirmation"` lacks the corresponding owner source value;
- method text and a required method provenance/omission note;
- optional yield, serving note, and cost-basis text using existing schema fields;
- all blocker messages, plus resolution status and note; and
- a new M1 save-draft control with saving, success, dirty, stale-base, and error states.

The summary and filters derive their labels and counts from the loaded document. Static labels such as “4 เมนูหลัก + 12 สูตรประกอบ” are removed.

The UI must clearly distinguish:

- source checksum failure;
- missing V5, which is a normal first-run fallback to V4;
- invalid V5 schema;
- validation failure before save;
- write failure; and
- successful persistence.

No error state silently falls back to mock recipe data.

## 11. Validation Contract

The server rejects a save when:

- V4 checksum does not match;
- the payload is not valid JSON or exceeds the bounded local payload size;
- recipe or item identity/order differs from the source lineage;
- an edit introduces an unapproved field;
- an owner quantity changed in the current save lacks its required provenance fields;
- a changed method lacks `method_decision_note`;
- a resolved blocker lacks its note/timestamp or alters its original code/message;
- `review_state` changes;
- V5 metadata is absent or invalid; or
- the target resolves outside the exact V5 location.

The server also rejects a save when `base_sha256` or `If-Match` is absent, the two values disagree, or the current draft bytes no longer match the loaded base. A `missing_method` blocker cannot transition to resolved while its method remains empty unless its resolution note carries the explicit owner-N/A prefix and reason.

Validation compares the submitted V5 against the verified V4 lineage and, when present, the last valid V5 draft. It permits only the transformations documented in this design.

Field-level invariants for owner quantity, method, yield, and blocker resolution apply to raw dirty records changed in the current save. Dirty records are identified against the raw baseline, not from a document-level flag or regenerated metadata. Pre-existing V4 irregularities are grandfathered only while byte-equivalent at that record; they remain visible as fill cues and cannot be silently repaired, normalized, or used to block an unrelated edit.

## 12. Testing and Acceptance Evidence

Tests use an isolated temporary vault fixture. Automated tests must never seed invented owner-confirmation data into the real V5 artifact.

Required evidence:

1. **Persistence:** enter one field, save, close/reload, and observe the same value.
2. **Low-noise diff:** V5 versus V4 shows only the entered fields, permitted resolution fields, and required V5 metadata.
3. **Immutable source:** the real V4 SHA-256 still matches `SHA256SUMS.txt` after all work.
4. **Complete rendering:** all 18 recipes render.
5. **Missing methods:** the five missing-method recipes (`2`, `160`, `9`, `161`, and `162`) render as DRAFT without an error.
6. **Blocker count:** 13 blocker instances are derived and displayed from the file.
7. **Status vocabulary:** owner entry produces `confirmed_by_owner`, never generic `confirmed`.
8. **Blocker history:** resolving a blocker preserves its original code/message, and that blocker stops blocking readiness only through `resolved`.
9. **Grandfathered provenance trap:** an unrelated first save succeeds despite the inherited provenance-incomplete row, that row remains unchanged, and the UI still presents its derived fill cue and DRAFT state.
10. **Independent item readiness:** resolving recipe 28's blocker leaves it DRAFT while its seven item decisions remain `needs_review`.
11. **Missing-method guard:** a `missing_method` blocker cannot resolve against an empty method without an explicit owner-N/A prefix and reason.
12. **Optimistic concurrency:** the second of two tabs saving the same base is rejected as stale and cannot overwrite the first tab's V5.
13. **Mixed-ID round trip:** 16 numeric and 2 string recipe IDs, plus 15 numeric and 3 string non-null component IDs, preserve both value and JSON type through load, edit, and save.
14. **Raw canonical persistence:** V5 is patched and validated from the lossless raw document; `CookbookSnapshot` is never the save source.
15. **Security:** traversal, symlink escape, unsupported methods, wrong filenames, and writes outside V5 are rejected.
16. **Atomicity:** an interrupted or failed write never leaves a truncated V5 document.
17. **Development-only boundary:** production build contains no writable vault endpoint.
18. **Regression gates:** unit tests, lint, typecheck, build, browser checks, and relevant E2E tests pass sequentially on the final integrated HEAD.

The real V5 file is created only by an intentional save from the completed local app. Verification must not fabricate kitchen decisions merely to leave an artifact behind.

## 13. Milestone Stop Condition

M1 is complete when TINE can open the local Cookbook, see all 18 real recipes, enter and save missing kitchen facts, reopen the same V5 draft, and review exact unresolved evidence without any mutation to V4 or Stock.

Before M1 is declared complete, a verifier who did not author this design or its source decision must independently inspect the implementation and acceptance evidence. NNTN Oracle's design review does not satisfy this independent final-verification requirement.

After M1 is accepted, M2 may replace Print Center mock data with V5-draft data and V4 fallback while preserving the already-approved A4 Master, A5 Kitchen Guide, and Cookbook Booklet designs.
