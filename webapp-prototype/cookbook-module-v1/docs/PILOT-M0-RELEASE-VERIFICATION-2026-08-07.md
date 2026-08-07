# Cookbook Pilot M0 release verification — 2026-08-07

## Scope and baseline

This note records the fresh release-verifier lane for the standalone local
Cookbook prototype. It does not claim production readiness or approve Stock,
auth, Supabase, deployment, or production-data work.

- Verified code commit: `43597bdbd904ed97e732b488e594d30cbe3b363d`
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
| `npm run test:e2e` | PASS | 21 Playwright tests passed, including the actual-App print regression |
| Actual-App Chrome PDF probe | PASS | A5 1/1 page at 594.96 × 420 pt; A4 two-up 2/2 pages at 594.96 × 841.92 pt; zero blank pages, export UI hits, or forbidden requests |

The Playwright suite exercised the Thai recipe flow, A5/A4 print-preview
geometry, media ordering, snapshot export, responsive overflow, router
surfaces, the actual-App print-media PDF contract, and the loopback read-only
request guard. The independent PDF probe persisted its local evidence under
`/tmp/cookbook-print-pdf-probe-integrated-20260807T022244Z`; its summary SHA-256
is `05e2788ff6e32df11ca8d8951efb5ae74fefcb2ffe5cf58457df91f096af6b68`.

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
- The dependency advisory remains a production/deployment gate, not a blocker
  for this isolated, loopback-only local pilot.

## Release-verifier verdict

**GO for the isolated local Cookbook pilot in Google Chrome at verified code
commit `43597bd`.** The print defect was reproduced, corrected with the scoped
print CSS/App-shell fix, and locked by an actual-App regression. This verdict
does not authorize production deployment, persistence, Supabase, auth, Stock
V1/V2 integration, or approval of kitchen source data.
