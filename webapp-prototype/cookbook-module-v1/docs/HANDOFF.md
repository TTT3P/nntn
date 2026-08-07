# CookingBook V1 Local Prototype Handoff

## Implemented scope

This repository contains a standalone React/TypeScript/Vite prototype for name-first recipe browsing, dependency graph inspection, source review, Prep/Cook/Service projections, ordered step media, A5 landscape and A4 two-up print planning, and a JSON snapshot export. State and edits are session-only: a reload restores the versioned fixture.

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
```

`npm run test:e2e` builds the production bundle and starts `vite preview` on `127.0.0.1:4187` with `reuseExistingServer: false`. The app base is `/nntn-cookbook/`. The suite uses the installed system Chrome/Chromium when detected (or the explicit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`), without downloading a browser.

## Limitations and evidence boundary

- Data, edits, selected local files, and object URLs last only for the current browser session. There is no durable persistence.
- The three SVGs in `public/sample-media/` are clearly marked DEMO samples, not approved kitchen evidence. They demonstrate cut-size, doneness, and delivery placement only.
- JSON export includes recipe/media metadata and `binary-not-included` warnings for session-only media; it does not embed uploaded file binaries and is not a durable save or approval action.
- On a 390 px viewport, the page/body remains free of unintended horizontal overflow while the fixed physical-size print preview intentionally scrolls inside `.print-preview`.
- Browser and print results are empirical for the installed headless Google Chrome only. This handoff makes no Safari or Firefox compatibility claim and is not production-readiness or data-approval evidence.
- Production-preview evidence covers all three approved fixture media links in their actual recipe/stage/step containers. Each current fixture sequence contains one image. The separate source harness supplies the synthetic three-images-on-one-step case and asserts exact alt/caption order inside that step; the approved fixture is not modified to manufacture coverage.
- The automated guard tracks in-flight requests, waits for a bounded stable-idle interval, checks late responses/failures/console/page errors/broken images, then detaches listeners. It rejects non-loopback HTTP(S), redirects, methods other than GET/HEAD, request bodies, Supabase, external media, analytics, and CDN traffic. The prototype performs no writes or uploads.

## Future Supabase gate

Supabase is outside V1. Any future persistence work requires a separate approved brief covering schema, RLS policies, Storage buckets/policies, migration sequencing, rollback, backfill, data validation, and production access. No production Supabase mutation, Storage upload, remote migration, or network write is authorized by this handoff.

## Pilot M0 readiness — 2026-08-07

**Pilot decision: NO-GO pending print correction and fresh PDF evidence.** The operator start/stop and acceptance flow is documented in the module [README](../README.md), but it must not be used for kitchen acceptance yet.

The current blocking evidence is a real Chrome PDF with blank tail pages and leaked export UI. Existing DOM geometry tests and the standard browser/E2E gate can still pass while this output is defective, so their passing result is not sufficient print-readiness evidence. The print owner must correct the defect and record a fresh PDF regression that proves A5 landscape and A4 two-up output have no blank tail pages, clipped content, or non-print UI before the leader changes this decision to GO.

Fresh integration-lane evidence on 2026-08-07 confirmed that `npm ci` completes, the production bundle builds, the Vite development server serves the application shell and module entry at `/nntn-cookbook/`, shutdown leaves no listener, and runtime TypeScript/TSX contains no `fetch`, Supabase, external HTTP, browser storage, WebSocket, or beacon path. The authoritative release-test counts and print-readability evidence belong in the dated verification record and must be rerun for the final integrated commit rather than inferred from this startup check.

Usable now:

- local name-first browsing, dependency and source review, Prep/Cook/Service projections, print planning, DEMO/session media, and JSON prototype export;
- review of the versioned first-set candidate while preserving raw source text, value, unit, precedence, conflicts, and blockers;
- Chrome-based A5/A4 evaluation for diagnosis only until the fresh PDF regression passes.

Still gated:

- any claim that the first-set candidate is Final Approved kitchen SOT;
- durable save, approval, auth, audit, Supabase/Storage, production data, migration, deployment, or Stock V1/V2 integration;
- production release while the dependency advisory recorded in the parent verification guide remains open;
- Safari/Firefox support or kitchen print acceptance beyond the freshly recorded Chrome evidence.
