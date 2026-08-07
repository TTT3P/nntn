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

- 8 items with no selected source;
- 8 items marked `needs_review`;
- 7 items marked `conflict`;
- 6 recipes whose method is missing; and
- 13 blockers requiring evidence or a decision.

These numbers document the accepted source snapshot; every count displayed by the application is derived from the loaded document and is never hardcoded.

## 4. Chosen Storage Approach

Use a dev-only Vite `configureServer` plugin in the existing `cookbook-module-v1` development server.

The plugin exposes exactly two local API paths:

1. a read-only V4 endpoint; and
2. a read/write V5 draft endpoint.

The browser first requests V5. If V5 does not exist, it requests the verified V4 source. The UI never receives a request-supplied filesystem path.

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

### 6.1 Load

1. Request V5 draft.
2. If V5 exists and validates, use it as the working document.
3. If V5 does not exist, request V4.
4. The server verifies V4 SHA-256 against `SHA256SUMS.txt` before returning it.
5. The application renders all 18 recipes, including incomplete recipes.

A missing method is valid draft data, not an application error.

### 6.2 Edit

The UI keeps a working copy in memory and marks changed fields as dirty. Original source values and blocker evidence remain visible.

No data reaches the vault until TINE presses the existing save-draft action.

### 6.3 Save

On save, the client builds a V5 draft from the loaded document and applies only explicit edits plus required file-level metadata. The server validates the payload, verifies V4 again, and atomically writes V5.

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

### 8.2 Serving and cost basis

The existing fields `serving_note` and `cost_basis_text` are optional. The UI exposes them only as supporting fields when the kitchen serving quantity differs from the costing basis. They do not trigger unit conversion or calculation.

### 8.3 Method

Entering a method updates:

- `method_candidate_text`; and
- `method_selected_source = "owner_confirmation"`.

`method_decision_note` is required whenever the method changes. It must say what the received kitchen account still does not cover so the application cannot imply invented preparation, storage, holding, or yield instructions.

The six recipes currently lacking method content render as editable DRAFT recipes rather than errors.

### 8.4 Yield

Yield is stored in the existing `yield_candidate_text` field. No new yield field or calculated yield is introduced.

### 8.5 Blockers

Existing blocker `code` and `message` values are immutable evidence. The UI always displays the original Thai message without hiding, translating, or rewriting it.

Resolving a blocker adds only:

- `resolved = true`;
- `resolved_note`; and
- `resolved_at`.

A resolution requires a note. Reopening the draft shows the original blocker message and its resolution metadata together.

`review_state` is a frozen V4 observation and must not be changed or recomputed.

## 9. Readiness and DRAFT Rules

Readiness is derived at render time from blocker resolution rather than copied from `review_state` or maintained as a second mutable status.

A recipe displays DRAFT whenever at least one blocker has `resolved != true`.

Ingredient decision states remain visible as fill cues. In the accepted V4 snapshot, every recipe containing an unresolved ingredient decision also has an unresolved blocker. Resolving that recorded blocker, rather than recomputing `review_state`, is the explicit readiness transition.

Resolved blockers remain in the document as history but no longer block readiness. Unresolved blocker messages remain visible verbatim.

Missing method content always remains visible as missing. It never crashes rendering and never causes a synthetic method to appear.

Displayed quantities use `candidate_text` only.

## 10. User Interface

The accepted visual system and navigation remain unchanged. M1 extends the existing Source Review/Recipe Studio surface with functional controls rather than creating a new layout.

For each selected recipe, the surface shows:

- recipe identity and derived DRAFT/readiness state;
- ingredient rows with existing source evidence and an owner-confirmation input;
- method text and a required method provenance/omission note;
- optional yield, serving note, and cost-basis text using existing schema fields;
- all blocker messages, plus resolution status and note; and
- the existing save-draft action with saving, success, dirty, and error states.

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
- owner quantity lacks its required provenance fields;
- a changed method lacks `method_decision_note`;
- a resolved blocker lacks its note/timestamp or alters its original code/message;
- `review_state` changes;
- V5 metadata is absent or invalid; or
- the target resolves outside the exact V5 location.

Validation compares the submitted V5 against the verified V4 lineage and, when present, the last valid V5 draft. It permits only the transformations documented in this design.

## 12. Testing and Acceptance Evidence

Tests use an isolated temporary vault fixture. Automated tests must never seed invented owner-confirmation data into the real V5 artifact.

Required evidence:

1. **Persistence:** enter one field, save, close/reload, and observe the same value.
2. **Low-noise diff:** V5 versus V4 shows only the entered fields, permitted resolution fields, and required V5 metadata.
3. **Immutable source:** the real V4 SHA-256 still matches `SHA256SUMS.txt` after all work.
4. **Complete rendering:** all 18 recipes render.
5. **Missing methods:** all six missing-method cases render as DRAFT without an error.
6. **Blocker count:** 13 blocker instances are derived and displayed from the file.
7. **Status vocabulary:** owner entry produces `confirmed_by_owner`, never generic `confirmed`.
8. **Blocker history:** resolving a blocker preserves its original code/message and changes readiness only through `resolved`.
9. **Security:** traversal, symlink escape, unsupported methods, wrong filenames, and writes outside V5 are rejected.
10. **Atomicity:** an interrupted or failed write never leaves a truncated V5 document.
11. **Development-only boundary:** production build contains no writable vault endpoint.
12. **Regression gates:** unit tests, lint, typecheck, build, browser checks, and relevant E2E tests pass sequentially on the final integrated HEAD.

The real V5 file is created only by an intentional save from the completed local app. Verification must not fabricate kitchen decisions merely to leave an artifact behind.

## 13. Milestone Stop Condition

M1 is complete when TINE can open the local Cookbook, see all 18 real recipes, enter and save missing kitchen facts, reopen the same V5 draft, and review exact unresolved evidence without any mutation to V4 or Stock.

After M1 is accepted, M2 may replace Print Center mock data with V5-draft data and V4 fallback while preserving the already-approved A4 Master, A5 Kitchen Guide, and Cookbook Booklet designs.
