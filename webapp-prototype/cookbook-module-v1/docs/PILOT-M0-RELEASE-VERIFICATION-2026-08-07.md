# Cookbook Pilot M0 release verification — 2026-08-07

## Scope and baseline

This note records the fresh release-verifier lane for the standalone local
Cookbook prototype. It does not claim production readiness or approve Stock,
auth, Supabase, deployment, or production-data work.

- Verified commit: `61b64e6e350cf9ab7a1480e51ff23948aef55413`
- Node: `v22.22.2`
- npm: `10.9.7`
- Browser: Google Chrome `151.0.7922.108`
- Runtime boundary: loopback-only, session-only prototype

## Fresh sequential gates

All commands ran from `webapp-prototype/cookbook-module-v1/` after a clean
`npm ci` on 2026-08-07 (Asia/Bangkok).

| Gate | Result | Evidence summary |
| --- | --- | --- |
| `npm ci` | PASS | 244 packages installed from the committed lockfile |
| `npm test` | PASS | 21 files; 558 tests passed |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | `tsc -b --pretty false` exit 0 |
| `npm run build` | PASS | 49 modules transformed; Vite build completed |
| `npm run test:browser` | PASS | Print-layout browser harness exit 0 |
| `npm run test:browser:export` | PASS | Snapshot-export browser harness exit 0 |
| `npm run test:e2e` | PASS | 20 Playwright tests passed in 29.1 seconds |

The Playwright suite exercised the Thai recipe flow, A5/A4 print-preview
geometry, media ordering, snapshot export, responsive overflow, router
surfaces, and the loopback read-only request guard. These passing DOM/browser
gates are not a substitute for physical PDF inspection; print-media acceptance
belongs to the separate print-audit lane.

## Boundary checks

- Runtime routing uses `HashRouter`; there is no React Server Component or
  router action surface.
- The release gates include a request guard that rejects non-loopback HTTP(S),
  redirects, methods other than GET/HEAD, request bodies, Supabase, analytics,
  CDN, and other external traffic.
- No source fixture, Stock path, auth surface, Supabase surface, deployment
  file, or production-data path was changed in this lane.
- No dependency was added or changed.

## Known release risks and gates

- `npm audit` reports two high-severity advisories through
  `react-router-dom@7.18.2` / `react-router@7.18.2`. The reported issue concerns
  RSC/action behavior that this client-only `HashRouter` prototype does not
  expose. No automatic or forced dependency change was made because dependency
  updates require a separate evidence-backed decision.
- Browser evidence is Chrome-only and local-loopback-only. It makes no Safari,
  Firefox, production hosting, persistence, or production-data claim.
- Overall isolated-pilot readiness remains gated on the separate print/PDF
  audit and operator-runbook integration.

## Release-verifier verdict

**PASS for the fresh automated release gates at the verified baseline.** No
release-lane code defect reproduced, so no product or test/config fix was
introduced. The leader must combine this evidence with the print-audit and
runbook lanes before making the isolated-pilot decision.
