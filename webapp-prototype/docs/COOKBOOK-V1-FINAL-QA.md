# Task 14 Report — Browser QA, Network Boundary, and Handoff

Status: DONE

Base: `1f517bc`

Commits: `4a0d8ec`, review fix `fb86ca6`

## Scope delivered

- Added deterministic Playwright configuration for a built Vite preview at `http://127.0.0.1:4187/nntn-cookbook/`, `reuseExistingServer: false`, one worker, zero retries, and repository-portable system Chrome detection with optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- Added strict shared browser guards for canonical loopback HTTP(S), GET/HEAD without bodies, failed requests, responses `>= 400`, console warnings/errors, page errors, and broken images. The guard tracks in-flight activity, waits for a bounded stable-idle interval, asserts, then detaches listeners.
- Added real-browser coverage for every router surface and valid work-stage query plus search/dependency expansion, media-editor controls, print/two-up, and export interactions. The exact Thai menu/service contract remains `180 กรัม` cooked rice and no `72 กรัม`.
- Production preview verifies all three approved fixture media links in their actual recipe/stage/step containers; each current sequence contains one image. The focused source harness independently verifies the synthetic three-images-on-one-step alt/caption order without modifying the approved fixture.
- Added local-only README/HANDOFF documentation with approved source paths, raw-unit/text precedence, no-conversion policy, sample/session/export limitations, Chrome-only evidence scope, and the separately gated Supabase future brief.
- Scoped Vitest discovery to `src/**/*.{test,spec}.{ts,tsx}` so both source conventions remain discoverable while Playwright specs stay isolated under `tests/`.

## TDD evidence

1. Initial RED: `npm run test:e2e` exited 1 before Task 14 files existed. Without a Playwright config, Playwright discovered Vitest files, produced parser/runner errors, and ended with `No tests found`.
2. First browser GREEN attempt exposed test defects: ambiguous accessible-name matching for `จุดงาน` and source-only harness URLs unavailable under `vite preview`. The tests were corrected to anchored accessible-role queries and production-preview flows; exhaustive harness assertions stayed in `npm run test:browser`.
3. Integration RED: the first full gate ran `npm test` and Vitest discovered all three `tests/*.spec.ts` files. Result: 19 existing unit files and 556 tests passed, but 3 Playwright suites failed in the wrong runner.
4. Minimal GREEN: added the Vitest include convention in `vite.config.ts`; fresh `npm test` then passed 19/19 files and 556/556 tests.

## Review correction RED/GREEN evidence

1. RED — `npm test -- src/test/vitestDiscovery.spec.ts` exited 1 with `No test files found`, proving source `.spec.ts` files were skipped.
2. RED — `npx playwright test tests/browser-guards.spec.ts` exited 1 because the old guard had no install/drain/assert/detach controller or canonical predicate.
3. RED — expanded network traversal exited 1 at the first route drain because the old fixture exposed no controller.
4. Adversarial GREEN — canonical loopback/predicate and delayed 404/request failure/external redirect/POST body/console/page-error/broken-image coverage passed 12/12.
5. Production RED — expanded traversal caught WorkStage sample media loading from origin-root `/sample-media/...`: late HTTP 404, console error, and broken image under the Vite base.
6. Resolver RED — the explicit-base resolver test received `/sample-media/prep-cut-size.svg` instead of `/nntn-cookbook/sample-media/prep-cut-size.svg`.
7. Minimal GREEN — one validated `resolveSampleMediaUrl()` is shared by the editor and print card; targeted unit/component/print tests passed 56/56, then expanded production media/network tests passed 6/6.
8. Final boundary RED/GREEN — the delayed synthetic loopback `late-supabase` request was initially absent from guard diagnostics, then passed after explicit Supabase/analytics/CDN signature rejection was added.

## Superseding fresh sequential gate — 2026-08-05 08:12 ICT

1. `npm test` — exit 0; 21/21 files passed; 558/558 tests passed, including the source `.spec.ts` canary.
2. `npm run lint` — exit 0; 0 ESLint errors/warnings.
3. `npm run typecheck` — exit 0.
4. `npm run build` — exit 0; Vite transformed 49 modules.
5. `npm run test:browser` — exit 0; 56 scenario loads, including exact three-image alt/caption/step ordering.
6. `npm run test:browser:export` — exit 0; real download/lifecycle harness passed.
7. `npm run test:e2e` — exit 0; 20/20 Playwright tests passed using one worker in 14.1s.
8. `git diff --check` — exit 0.
9. Static prohibited production API scan — 0 matches.
10. Listener checks for ports 4175, 4176, and 4187 — 0 processes listening after the gate.

## Fresh sequential gate — 2026-08-05 07:44 ICT

Run in the required order from the repository root:

1. `npm test` — exit 0; 19/19 files passed; 556/556 tests passed.
2. `npm run lint` — exit 0; 0 ESLint errors/warnings.
3. `npm run typecheck` — exit 0.
4. `npm run build` — exit 0; Vite transformed 48 modules and emitted the production bundle.
5. `npm run test:browser` — exit 0 under installed system Google Chrome; 22 accepted station scenarios, 1 A4 two-up/odd-tail scenario, 26 atomic boundary+1 rejection scenarios, and 7 invalid-control scenarios (56 total scenario loads).
6. `npm run test:browser:export` — exit 0; 1 real download scenario verified schema, binary warnings, download consumption before revoke, bounded revoke timing, anchor cleanup, and loopback-only requests.
7. `npm run test:e2e` — exit 0; 7/7 Playwright tests passed using one worker in 8.4s.
8. `git diff --check` — exit 0.
9. Static prohibited production API scan over non-test `src/**/*.{ts,tsx}` for Supabase/client creation, `fetch`, XHR, WebSocket, beacon, and HTTP(S) literals — 0 matches.
10. Listener checks for ports 4175, 4176, and 4187 — 0 processes listening after the gate.

## Files

- `playwright.config.ts`
- `tests/browser-guards.ts`
- `tests/cookbook-flow.spec.ts`
- `tests/media-print.spec.ts`
- `tests/no-production-network.spec.ts`
- `tests/browser-guards.spec.ts`
- `tests/print-layout.browser.mjs`
- `vite.config.ts`
- `README.md`
- `docs/HANDOFF.md`
- `src/features/media/sampleMediaUrl.ts`
- `src/features/media/sampleMediaUrl.test.ts`
- `src/test/vitestDiscovery.spec.ts`
- `src/features/media/StepMediaEditor.tsx`
- `src/features/print/WorkstationCard.tsx`

## Review and remaining risks

- Direct acceptance review found no open Task 14 defect after the full gate. Native child review could not be dispatched because this executor is a leaf agent; no child-agent completion claim was substituted for the fresh evidence above.
- Browser/print evidence is limited to the installed Google Chrome on this machine. Safari and Firefox were not tested.
- DEMO SVGs are illustrative only; session media binaries are not exported or persisted.
- Supabase schema/RLS/Storage/migration/rollback/backfill remain outside scope and require a separate approved brief.
