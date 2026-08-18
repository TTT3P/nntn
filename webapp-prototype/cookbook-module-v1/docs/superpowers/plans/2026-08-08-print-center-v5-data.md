# Print Center V5 Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local-pilot Print Center render the canonical Kitchen SOT V5 draft, falling back to verified V4, while preserving the approved print templates and actual-App PDF safety contract.

**Architecture:** The raw `KitchenSotDocument` remains canonical. A pure projection maps its 18 recipes into the existing read-only print domain and carries only session media from `CookbookSnapshot`; Print Center consumes that projection and the shared raw readiness predicate. No print template, V5 persistence, middleware, or source bytes change.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Playwright, Vite.

## Global Constraints

- Cookbook local pilot only; do not touch Stock V1/V2, auth, Supabase, production data, deployment, MAW, or CROO.
- V4 stays read-only at SHA-256 `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`.
- Tests use an isolated vault and must not create the real V5 draft.
- Display and print `candidate_text` verbatim; do not calculate or convert kitchen units.
- A recipe is DRAFT when the shared raw three-condition predicate says so.
- Print unresolved blocker messages byte-for-byte; never rewrite or hide them.
- Preserve A4 Master, A5 Kitchen Guide, and Cookbook Booklet presentation; no redesign or new input fields.
- Preserve mixed numeric/string recipe and component IDs.
- Do not commit unless TINE explicitly requests a commit.

---

### Task 1: Raw Kitchen SOT print projection

**Files:**
- Create: `src/domain/sot/kitchenSotPrintProjection.ts`
- Create: `src/domain/sot/kitchenSotPrintProjection.test.ts`

**Interfaces:**
- Consumes: `KitchenSotDocument`, `CookbookSnapshot`, `isKitchenSotRecipeDraft`.
- Produces: `projectKitchenSotPrintSnapshot(document, mediaSnapshot): { snapshot: CookbookSnapshot; recipeDraftById: ReadonlyMap<RecipeIdentity, boolean> }`.

- [ ] **Step 1: Write the failing projection tests**

Assert with the real frozen fixture that projection returns 18 recipes, preserves mixed IDs, maps every ingredient `sourceText` to the exact `candidate_text`, maps unresolved blocker messages byte-for-byte, and marks recipe 159 DRAFT through the shared predicate.

- [ ] **Step 2: Run the projection tests and verify RED**

Run: `./node_modules/.bin/vitest run src/domain/sot/kitchenSotPrintProjection.test.ts --reporter=verbose`

Expected: FAIL because `projectKitchenSotPrintSnapshot` does not exist.

- [ ] **Step 3: Implement the minimal pure projection**

Validate the raw print fields before mapping. Copy media and step-media arrays from the session snapshot, but build the recipe array exclusively from the raw Kitchen SOT document. Set numeric print source values to `null` so the planner cannot scale or convert `candidate_text`.

- [ ] **Step 4: Run projection tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

### Task 2: Print Center canonical data and DRAFT evidence

**Files:**
- Modify: `src/features/print/PrintCenterPage.tsx`
- Modify: `src/features/print/WorkstationCard.tsx`
- Modify: `src/features/print/PrintCenterPage.test.tsx`

**Interfaces:**
- Consumes: optional `KitchenSotDraftContextValue.document`, projection output from Task 1.
- Produces: Print Center selection and pages sourced from V5/V4 raw state; exact unresolved blocker text in DRAFT print cards.

- [ ] **Step 1: Write failing component tests**

Render Print Center under the real `KitchenSotDraftProvider` with a V5-shaped document. Assert all 18 raw recipe names are selectable, an edited `candidate_text` appears while the stale fixture value does not, recipe 159 remains DRAFT, and each unresolved blocker message is present unchanged on its printed card.

- [ ] **Step 2: Run the focused component tests and verify RED**

Run: `./node_modules/.bin/vitest run src/features/print/PrintCenterPage.test.tsx --reporter=verbose`

Expected: FAIL because Print Center still reads only `PrototypeProvider.snapshot` and warnings omit exact blocker messages.

- [ ] **Step 3: Integrate the raw projection**

Use `useOptionalKitchenSotDraft()` in Print Center. When raw state exists, project it with Task 1 and use its readiness map; otherwise retain the embedded verified-V4 snapshot fallback for static/test surfaces. Remove `evaluateReadiness` as the authoritative recipe status when raw state exists.

- [ ] **Step 4: Render exact unresolved blockers**

In `WorkstationCard`, render each `page.document.blockers` message verbatim inside the existing warning footer when readiness is DRAFT. Keep generic media warnings separate.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS with no warning output.

### Task 3: Actual-App regression and print safety

**Files:**
- Modify: `tests/media-print.spec.ts`
- Modify: `tests/cookbook-draft-persistence.spec.ts`
- Modify only if needed for data wiring: `playwright.local.config.ts`

**Interfaces:**
- Consumes: local Vite middleware and isolated V4/V5 vault.
- Produces: browser evidence that Print Center reloads saved V5 data and emits safe A5/A4 PDFs.

- [ ] **Step 1: Write failing actual-App tests**

In the isolated vault, save one owner-confirmed quantity through Recipe Studio, open Print Center, select that recipe, and assert the saved text appears after reload. Assert recipe 159 and all unresolved blocker messages remain DRAFT evidence.

- [ ] **Step 2: Verify RED before any test-specific implementation adjustment**

Run: `./node_modules/.bin/playwright test --config=playwright.local.config.ts tests/cookbook-draft-persistence.spec.ts`

Expected before Task 2 code: Print Center shows the baseline value or omits raw blockers.

- [ ] **Step 3: Run actual-App PDF gates**

Run default E2E plus the actual Chrome PDF probe. Require exact A5/A4 MediaBoxes, expected page counts, zero blank tail pages, zero clipping, and no app/export/session UI in printed output.

- [ ] **Step 4: Treat unavailable Chrome as a blocker, not a pass**

If Chrome aborts before page creation, record the browser launch error and do not mark M2 GO or rewrite `HANDOFF.md` to GO.

### Task 4: Sequential verification and handoff

**Files:**
- Modify only after every gate passes: `docs/HANDOFF.md`

**Interfaces:**
- Consumes: completed Tasks 1–3 and fresh verification evidence.
- Produces: M2 GO record only when the actual-App gate passes.

- [ ] **Step 1: Run sequential gates**

Run unit tests, lint, typecheck, build, browser layout harness, browser export harness, default E2E, local-draft E2E, and `git diff --check` sequentially.

- [ ] **Step 2: Recheck data safety**

Run `shasum -a 256 -c SHA256SUMS.txt` in V4 and verify the real V5 draft path is absent.

- [ ] **Step 3: Review scope**

Confirm the diff contains only Cookbook files and no Stock, Supabase, auth, production, or deployment path.

- [ ] **Step 4: Update handoff only on proven GO**

If every gate including actual-App PDF passes, record M2 GO evidence in `docs/HANDOFF.md`. Otherwise leave M2 NOT GO and report the exact blocker.
