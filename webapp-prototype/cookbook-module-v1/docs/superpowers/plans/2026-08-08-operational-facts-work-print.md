# Operational Facts on Work and Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render existing Kitchen SOT operational facts on Work and Print while keeping cost-basis data out of kitchen documents.

**Architecture:** Extend the current raw-to-read projection and `ProjectedWorkDocument` so Work and Print consume one stage-aware contract. Preserve every source string unchanged and make the print planner account for the added content.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Playwright, Vite

## Global Constraints

- Local Cookbook pilot only; do not touch Stock V1/V2, auth, Supabase, production, deployment, MAW, or CROO.
- Do not change the V5 schema, persistence, or readiness predicate.
- Render source strings exactly; do not calculate, normalize, convert, summarize, or generate replacement prose.
- Never project or render `cost_basis_text` in a kitchen document.
- Tests must not create or modify the real V5 draft at SHA-256 `588b5f4653455312c00a37bd1a19a5f2c8b37f0402f28afa3b33c12b45247762`.
- Do not commit without a separate TINE instruction.

---

### Task 1: Extend the shared read projection

**Files:**
- Modify: `src/domain/cookbook/types.ts`
- Modify: `src/domain/sot/kitchenSotPrintProjection.ts`
- Modify: `src/domain/sot/kitchenSotPrintProjection.test.ts`
- Modify: `src/data/FixtureCookbookRepository.ts`
- Modify: `src/test/builders.ts`

**Interfaces:**
- Produces: `IngredientLine.servingNote`, `RecipeVersion.yieldText`, and `RecipeVersion.methodDecisionNote`.
- Preserves: existing `RecipeVersion.operationalNotes` and all mixed recipe identities.

- [ ] Add failing projection tests asserting exact raw strings and asserting no `cost_basis_text` property exists in the projected recipe/line.
- [ ] Run `./node_modules/.bin/vitest run src/domain/sot/kitchenSotPrintProjection.test.ts` and confirm the new assertions fail because the fields are absent.
- [ ] Add the three nullable read fields and map them without trimming or rewriting.
- [ ] Update fixture and builder mappings with null defaults.
- [ ] Re-run the targeted projection test and confirm it passes.

### Task 2: Add stage-aware projected work facts

**Files:**
- Modify: `src/domain/work/workDocuments.ts`
- Modify: `src/domain/work/workDocuments.test.ts`

**Interfaces:**
- Produces: `ProjectedWorkDocument.operationalNotes`, `yieldText`, and `methodDecisionNote`.
- Stage contract: operational/yield on Prep and Cook; method note on all stages; serving note remains on ingredient lines and is rendered only on Service.

- [ ] Add failing tests for exact stage filtering and immutability of source strings.
- [ ] Run `./node_modules/.bin/vitest run src/domain/work/workDocuments.test.ts` and confirm the fields are missing.
- [ ] Populate the projected fields in `projectStage` and validate their nullable/array shapes.
- [ ] Re-run the targeted work-document test and confirm it passes.

### Task 3: Render facts on the Work page

**Files:**
- Modify: `src/features/work/WorkStagePage.tsx`
- Modify: `src/features/work/WorkStagePage.test.tsx`

**Interfaces:**
- Consumes: stage-filtered `ProjectedWorkDocument` facts and `IngredientLine.servingNote`.

- [ ] Add a failing test that `/work/2?stage=all` renders the two exact operational notes, including `ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70`.
- [ ] Add failing tests for exact yield, serving note, and method note rendering.
- [ ] Add a failing Service regression asserting `ข้าวสารญี่ปุ่นดิบ 72 กรัม` and `cost_basis_text` do not appear.
- [ ] Run `./node_modules/.bin/vitest run src/features/work/WorkStagePage.test.tsx` and confirm the operational-fact assertions fail.
- [ ] Add a compact facts block and Service-only serving-note rendering.
- [ ] Re-run the targeted Work test and confirm it passes.

### Task 4: Render and paginate facts on Print

**Files:**
- Modify: `src/features/print/WorkstationCard.tsx`
- Modify: `src/features/print/PrintCenterPage.tsx`
- Modify: `src/features/print/PrintCenterPage.test.tsx`
- Modify: `src/domain/print/printPlanner.ts`
- Modify: `src/domain/print/printPlanner.test.ts`
- Modify: `src/features/print/print.css`

**Interfaces:**
- Consumes: the same `ProjectedWorkDocument` facts as Work.
- Preserves: one sheet per logical station page and current A5/A4 MediaBox behavior.

- [ ] Add failing card tests for exact operational, yield, method, and Service serving text plus cost-basis exclusion.
- [ ] Add failing planner tests proving snapshot/clone preservation and layout accounting for facts.
- [ ] Run the targeted Print and planner tests and confirm the new assertions fail for missing fields.
- [ ] Extend Print Center capture, planner snapshot/validation/clone/layout units, and card rendering.
- [ ] Add only minimal CSS for the facts block; do not redesign the card.
- [ ] Re-run targeted tests and confirm they pass.

### Task 5: Verify all gates and safety invariants

**Files:**
- Verify only; no production-data mutation.

**Interfaces:**
- Proves: M4 acceptance and unchanged frozen-source boundaries.

- [ ] Run targeted Work, projection, work-document, Print, and planner tests.
- [ ] Run full unit, lint, typecheck, and build sequentially.
- [ ] Confirm `/opt/homebrew/bin/git diff --check` exits zero.
- [ ] Confirm V4 `SHA256SUMS.txt` is 5/5 before and after.
- [ ] Confirm real V5 SHA-256 remains `588b5f4653455312c00a37bd1a19a5f2c8b37f0402f28afa3b33c12b45247762`.
- [ ] Send the artifact identity to nntn-oracle for browser, export, E2E, local-draft, and PDF gates.
- [ ] Send the verified artifact to `05-nntn:nntn-codex.1` for independent final verification before updating `docs/HANDOFF.md`.

