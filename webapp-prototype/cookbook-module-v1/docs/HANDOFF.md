# CookingBook V1 Local Prototype Handoff

## Implemented scope

This repository contains a standalone React/TypeScript/Vite prototype for name-first recipe browsing, dependency graph inspection, source review, Prep/Cook/Service projections, ordered step media, A5 landscape and A4 two-up print planning, and a JSON snapshot export. In the local development pilot, Recipe Studio reads the verified Kitchen SOT V4 document and can persist an explicit V5 draft to a new local file. Other prototype edits remain session-only.

The browser QA covers the primary Thai flow (`ข้าวหน้าเนื้อตุ๋น` → related `เนื้อตุ๋น (ราดข้าว)` → Service print with cooked rice `180 กรัม` and no `72 กรัม`), every valid router surface and work-stage query, representative media-editor/print/export interactions, base-aware sample media, visible DEMO labeling, text-only steps, A5/A4/two-up/odd-tail geometry, accepted-boundary clipping checks, atomic over-capacity errors, responsive 1440 px and 390 px layouts, the downloaded export contract, and a read-only loopback request boundary.

## Source of truth and no-guess rule

The approved product references copied into this repository are [PRD.html](./PRD.html) and [DESIGN.md](./DESIGN.md). The implementation plan source is:

`~/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype/docs/superpowers/plans/2026-08-04-intelligent-cookbook-module-v1.md`

The versioned runtime fixture is [first-set.json](../src/data/fixtures/first-set.json), copied from the approved source:

`~/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype/data/kitchen-sot-first-set-v2.json`

Source kitchen text, value, and unit are authoritative. The prototype preserves the raw supplied fields and source precedence; it does not convert grams, milliliters, spoons, yields, or method text. Where sources conflict, newer handwritten corrections take precedence only when the approved source records that decision. Missing or conflicting values remain review items instead of being guessed.

## Local commands

```bash
npm ci
npm run dev -- --host 127.0.0.1
npm test
npm run lint
npm run typecheck
npm run build
npm run test:browser
npm run test:browser:export
npm run test:e2e
npm run test:e2e:local-draft
```

`npm run test:e2e` builds the production bundle and starts `vite preview` on `127.0.0.1:4187` with `reuseExistingServer: false`. The app base is `/nntn-cookbook/`. The suite uses the installed system Chrome/Chromium when detected (or the explicit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`), without downloading a browser.

## Limitations and evidence boundary

- Recipe Studio V5 draft fields persist to the approved local draft path when the app is run through the Vite development server. Other prototype edits, selected local files, and object URLs last only for the current browser session.
- The three SVGs in `public/sample-media/` are clearly marked DEMO samples, not approved kitchen evidence. They demonstrate cut-size, doneness, and delivery placement only.
- JSON export includes recipe/media metadata and `binary-not-included` warnings for session-only media; it does not embed uploaded file binaries and is not a durable save or approval action.
- On a 390 px viewport, the page/body remains free of unintended horizontal overflow while the fixed physical-size print preview intentionally scrolls inside `.print-preview`.
- Browser and print results are empirical for the installed headless Google Chrome only. This handoff makes no Safari or Firefox compatibility claim and is not production-readiness or data-approval evidence.
- Production-preview evidence covers all three approved fixture media links in their actual recipe/stage/step containers. Each current fixture sequence contains one image. The separate source harness supplies the synthetic three-images-on-one-step case and asserts exact alt/caption order inside that step; the approved fixture is not modified to manufacture coverage.
- The automated guard tracks in-flight requests, waits for a bounded stable-idle interval, checks late responses/failures/console/page errors/broken images, then detaches listeners. It rejects non-loopback HTTP(S), redirects, methods other than GET/HEAD, request bodies, Supabase, external media, analytics, and CDN traffic. The prototype performs no writes or uploads.

## Future Supabase gate

Supabase is outside V1. Any future persistence work requires a separate approved brief covering schema, RLS policies, Storage buckets/policies, migration sequencing, rollback, backfill, data validation, and production access. No production Supabase mutation, Storage upload, remote migration, or network write is authorized by this handoff.

## Pilot M0 readiness — 2026-08-07

**Pilot decision: GO for the isolated local Cookbook pilot in Google Chrome at verified code commit `43597bd`.** This is not production readiness, deployment approval, or kitchen-data approval. Operators must use the local start/stop and acceptance flow in the module [README](../README.md).

The prior print blocker is corrected and covered by an actual-App Chrome regression. Fresh integrated evidence produced exactly one A5 landscape page for one SOP sheet and exactly two A4 pages for two two-up sheets, all with the expected A5/A4 MediaBoxes. The rendered PDFs contained no blank tail pages, clipped/overflowing SOP sheet content, export/session UI, or forbidden network requests. The persisted local artifact summary reported `RESULT=PASS`; the regression is also part of the Playwright suite.

Fresh sequential evidence on 2026-08-07 confirmed `npm ci`, 558/558 unit tests, lint, typecheck, production build, both browser harnesses, and 21/21 Playwright tests on the integrated candidate. The Vite application remained loopback-only, shutdown left no listener, and the accepted diff stayed inside the standalone Cookbook scope. Details are recorded in [PILOT-M0-RELEASE-VERIFICATION-2026-08-07.md](./PILOT-M0-RELEASE-VERIFICATION-2026-08-07.md).

Usable now:

- local name-first browsing, dependency and source review, Prep/Cook/Service projections, print planning, DEMO/session media, and JSON prototype export;
- review of the versioned first-set candidate while preserving raw source text, value, unit, precedence, conflicts, and blockers;
- Chrome-based A5 landscape and A4 two-up printing for the isolated local pilot at the verified commit.

Still gated:

- any claim that the first-set candidate is Final Approved kitchen SOT;
- production/network-backed durable save, approval, auth, audit, Supabase/Storage, production data, migration, deployment, or Stock V1/V2 integration;
- production release while the dependency advisory recorded in the parent verification guide remains open;
- Safari/Firefox support or kitchen print acceptance beyond the freshly recorded Chrome evidence.

## Pilot M1 Recipe Studio fill surface — 2026-08-07

**Pilot decision: GO for the isolated local M1 fill surface at verified code commit `3556733a492d184c15352b51470942651e0deed1`.** Independent verifier `05-nntn:nntn-codex.1` returned `[APPROVED][§13][M1]`. This GO is limited to entering and saving missing Kitchen SOT facts in the local Cookbook; it is not production, deployment, Supabase, Stock V1/V2, or kitchen-data approval.

Start the local pilot from `cookbook-module-v1`:

```bash
npm run dev -- --host 127.0.0.1
```

The development-only Vite middleware reads the frozen V4 source after verifying its checksum and writes only the new V5 draft path:

- read-only V4: `Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json`
- approved V4 SHA-256: `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`
- writable V5 draft: `Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json`

The real V5 draft did not exist at verification time. It must be created only when TINE intentionally saves real kitchen input through Recipe Studio; tests use an isolated vault under `node_modules/.cache` and never fabricate a real V5 artifact. V4 remains `FIRST_SET_CANDIDATE`, not Final Approved kitchen SOT.

M1 behavior now verified:

- Recipe Studio renders all 18 real recipes: 4 sellable menus and 14 prepared recipes.
- Derived fill counts are 16 item targets and 13 blocker instances; counts are read from the document, not hardcoded.
- Owner quantity, optional serving/cost notes, method plus required no-invention note, yield, and blocker resolution history save into the lossless raw document without normalizing or reordering untouched data.
- Reload persistence, low-noise V5-versus-V4 output, atomic writes, stale-tab rejection, mixed ID types, canonical key order, and fresh-V4 cumulative validation are covered.
- Library, Recipe Detail, and Recipe Studio use the same raw three-condition readiness predicate. Actual Chrome matched the source for all 18 recipes: 5 READY and 13 DRAFT. Recipe 159 is DRAFT on all three surfaces until its missing owner provenance is supplied.
- Missing or unavailable raw readiness fails closed; the local app never promotes a recipe to READY from the lossy fixture projection.

Fresh sequential evidence on the verified code commit passed all eight gates:

1. unit tests: 29 files, 726/726;
2. lint;
3. typecheck;
4. production build;
5. browser layout harness;
6. browser export harness;
7. default Playwright E2E: 21/21; and
8. isolated local-draft E2E: 2/2, covering persistence and stale-tab rejection.

Actual-App Chrome evidence additionally confirmed 18/18 readiness agreement, recipe 159 consistency across the three M1 surfaces, zero page errors, unchanged V4 checksums (5/5 manifest entries), no real V5 artifact, and a clean worktree. The code/spec/security rereview found zero open issues.

Still M2, not part of this M1 GO:

- replace Print Center and Work-stage mock/read projections with V5 draft data and V4 fallback where M2 authorizes it;
- preserve the already-approved A4 Master, A5 Kitchen Guide, and Cookbook Booklet designs without redesign or new fields; and
- any production persistence, auth, Supabase, deployment, Stock V1/V2 integration, or production-data mutation.
