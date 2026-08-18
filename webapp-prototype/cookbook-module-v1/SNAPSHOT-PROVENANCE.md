# Snapshot Provenance

## Source

- Original repository: `~/tt3p/product-hub/nntn-cookbook`
- Source branch: `feature/cookbook-module-v1`
- Source commit: `fb86ca6e7630da7fd1ca88b6b1eece31c107c3ae`
- Snapshot date: `2026-08-05` (Asia/Bangkok)

This directory was created from tracked files at the source commit. It excludes the source `.git`, `.superpowers`, `node_modules`, `dist`, browser reports, caches, and runtime state.

## Fixture Identity

- Runtime fixture: `src/data/fixtures/first-set.json`
- Parent approved artifact: `../data/kitchen-sot-first-set-v2.json`
- SHA-256 for both: `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`

## Verified Source State

The source commit passed:

- 558 Vitest tests across 21 files
- ESLint
- TypeScript typecheck
- production build
- print and export Chrome harnesses
- Playwright 20/20
- strict loopback/read-only browser boundary

See parent `../docs/COOKBOOK-V1-FINAL-QA.md` for the recorded evidence and `../docs/COOKBOOK-V1-VERIFICATION.md` for rerun commands.

## Authority Boundary

The snapshot is the runnable prototype handoff, not production SOT and not a durable database. Raw evidence remains in the NNTN vault paths named by the parent continuation brief. Production Supabase integration is not included or authorized.
