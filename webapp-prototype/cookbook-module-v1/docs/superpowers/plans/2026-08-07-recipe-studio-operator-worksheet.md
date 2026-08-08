# Recipe Studio Operator Worksheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard/card-heavy Recipe Studio layout with the approved operator worksheet while preserving every V5 behavior.

**Architecture:** Keep `KitchenSotFillSurface` state, derived counts, filtering, edit handlers, provider, and domain code unchanged. Reshape only semantic JSX wrappers/copy and route-scoped CSS; test the observable hierarchy and existing payload behavior with the real 18-recipe fixture.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Vite.

## Global Constraints

- Cookbook local pilot only; never touch Stock V1/V2, auth, Supabase, production data, deployment, MAW, or CROO.
- Preserve V5 raw-document persistence, edit payloads, validation, readiness, blockers, concurrency, middleware, and V4 checksum behavior.
- Do not add dependencies or create a real V5 draft during verification.
- Do not commit without a direct TINE commit instruction.
- Follow `docs/DESIGN.md` Operator worksheet visual contract and the approved design spec.

---

### Task 1: Lock the worksheet hierarchy with a real-fixture regression

**Files:**
- Modify: `src/features/review/KitchenSotFillSurface.test.tsx`

**Interfaces:**
- Consumes: `KitchenSotFillSurface`, real parsed first-set fixture, existing provider test client.
- Produces: an observable regression proving the operational hierarchy without asserting CSS implementation details.

- [ ] Add a test that renders the real fixture and asserts `กรอกสูตรจากทีมครัว`, the inline summary region, `เลือกสูตร`, the selected recipe article, and the plain-language quantity input are present.
- [ ] In the same test assert the removed dashboard language `SOURCE REVIEW · NO CONVERSION` and decorative marker `01` are absent.
- [ ] Run `./node_modules/.bin/vitest run src/features/review/KitchenSotFillSurface.test.tsx --pool=threads` and confirm RED because the old header and marker still render.

### Task 2: Reshape Recipe Studio into the operator worksheet

**Files:**
- Modify: `src/features/review/KitchenSotFillSurface.tsx`
- Modify: `src/features/review/recipe-studio.css`
- Modify: `src/app/styles.css` only for the Cookbook app background/token alignment if required.

**Interfaces:**
- Consumes: all existing component props, edit handlers, derived summary counts, filters, and readiness predicates unchanged.
- Produces: compact header + inline summary, 256px queue, max-768px editor, flat ingredient rows, one primary save action.

- [ ] Remove the eyebrow, decorative step marker, metric-card markup, and dashboard helper copy; render the approved title and inline derived summary.
- [ ] Preserve queue search/type/status controls and recipe button behavior while simplifying row markup only where needed for hierarchy.
- [ ] Keep every `ItemEditor`, `MethodAndYieldEditor`, and `BlockerEditor` handler byte-equivalent; change presentation classes/wrappers only.
- [ ] Replace dashboard/card CSS with the approved spacing/type/radius scales, single workspace surface, flat rows, bounded inputs, full selected state, opaque save bar, and mobile stack.
- [ ] Run the targeted test plus `src/domain/sot/kitchenSotEdits.test.ts` and `src/domain/sot/kitchenSotValidation.test.ts`; confirm GREEN and unchanged payload regressions.

### Task 3: Verify the integrated local pilot

**Files:**
- No production file changes expected.

**Interfaces:**
- Consumes: completed operator worksheet.
- Produces: fresh static, safety, and preview evidence.

- [ ] Run sequentially: full Vitest, ESLint, TypeScript build, Vite build, and `/opt/homebrew/bin/git diff --check`.
- [ ] Verify the frozen V4 SHA-256 remains `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d` and the real V5 draft path is absent.
- [ ] Restart only the isolated preview at port 5173 with `NNTN_VAULT_ROOT=node_modules/.cache/cookbook-v5-e2e-vault` and verify the served transformed module contains `กรอกสูตรจากทีมครัว` without a cache-buster.
- [ ] Attempt the local Playwright layout gate once; if system Chrome exits SIGABRT before page creation, report the environment gap and do not retry or mutate product code.
