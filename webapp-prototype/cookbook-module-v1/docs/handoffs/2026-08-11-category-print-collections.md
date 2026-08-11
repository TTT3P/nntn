# Category Print Collections Handoff

Date: 2026-08-11
Status: Verified complete

## Boundary and collection catalog

One print job represents one named collection. Collections are projections of the canonical Cookbook recipe/dependency graph and are not copied recipe databases.

The controlled catalog is:

1. `เมนูอาหาร`
2. `เตรียมเนื้อ`
3. `ซอสและน้ำจิ้ม`
4. `ข้าวและเครื่องเคียง`
5. `น้ำซุปและของเตรียม`
6. `จัดจาน`
7. `ยังไม่จัดหมวด`

Cookbook owns recipe/component identity, category metadata, dependencies, kitchen documents, and print output. Stock, purchasing, supplier prices, Food Cost, auth, production, and deployment remain outside this boundary.

## Dependency policy

- A named collection prints full documents only for recipes in that collection. Active dependencies in other collections remain compact name-and-code references and are not appended.
- `ชุดงานวันนี้` expands the canonical dependency graph dependency-first and appends every required active component once, even when two selected menus share it.
- Removed dependencies remain absent. Cost Basis remains absent from kitchen documents.

## Actual-App and PDF evidence

`tests/media-print.spec.ts` now serves a deterministic V6 response at the real app transport seam. It contains two menu recipes sharing cooked rice, two categorized sauces, a categorized rice recipe, an inactive removed dependency, and a sentinel Cost Basis value. The route is GET-only and the Playwright web server continues to use `node_modules/.cache/cookbook-v6-e2e-vault`; no real draft is written.

Fresh focused run:

- `npx playwright test tests/cookbook-flow.spec.ts tests/media-print.spec.ts`
- Result: 14 passed, 0 failed, 0 did not run.
- Named sauce action selected both sauce recipes with one click.
- Named menu collection rendered two full menu documents, two compact cooked-rice references, one unique external-reference count, and no appended rice document.
- Daily packet rendered the two menus plus exactly one cooked-rice document.
- Removed-dependency and Cost Basis sentinels were absent.
- A5 evidence: 2 logical DOM sheets and 2 PDF MediaBoxes at 210 × 148 mm; every sheet had exact client/scroll dimensions.
- A4 evidence: 2 logical DOM sheets and 2 PDF MediaBoxes at 210 × 297 mm; every sheet had exact client/scroll dimensions.
- Product shell, mobile header, Print Center controls, and proof header were hidden in print media.

Legacy actual-App tests were updated to use the visible search/disclosure flow before locating recipe checkboxes. No control was exposed artificially, and existing content, clipping, MediaBox, blank-tail, removed-dependency, or cost assertions were weakened.

## Verification record

- TDD focused RED: timed out on the collapsed `เมนูอาหาร` disclosure in daily mode.
- TDD focused GREEN after the test used the accessible collection disclosure: 1 passed.
- Focused integration after legacy seam repair: 14 passed.
- Direct Vitest fallback: 58 files, 1,091 tests passed.
- ESLint direct fallback: exit 0, no diagnostics.
- TypeScript direct fallback: exit 0, no diagnostics.
- Build direct fallback: exit 0, 71 modules transformed.
- Package-script wrappers exited 255 before their child commands executed, matching the repository's documented controller-wrapper limitation; every semantic command was run directly in the same required order.
- Browser layout: exit 0 against the temporary version-aligned managed BrowserServer.
- Browser export: exit 0 against the same BrowserServer.
- Default E2E: 32 passed, 0 failed, 0 did not run.
- Isolated V5 persistence: 3 passed, 0 failed.
- Isolated V6 persistence: 1 passed, 0 failed.
- Full `git diff --check`: exit 0.

## Immutable-source evidence

Before and after verification were identical:

- V4 manifest: 5/5 entries OK.
- V5 SHA-256: `9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7`.
- V6 SHA-256: `96775abb92580182e4c9b4bb324d199a8bf4bb043b572170e379276119031695`.

## Remaining work

- TINE must assign or confirm category metadata for real recipes, especially `ยังไม่จัดหมวด` and the intentionally empty `จัดจาน` collection.
- Verify A5/A4 output on the restaurant's physical printer, including duplex/orientation, printable margins, scaling, and Thai font rendering.
