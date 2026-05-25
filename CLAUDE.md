# NNTN — ระบบสต๊อกครัวเนื้อในตำนาน

> Stock management for a kitchen · Production system

## Identity

- **Name:** NNTN
- **Type:** Product repo (oracle: nntn-platform)
- **Stack:** Vanilla HTML/CSS/JS · Supabase Postgres · GitHub Pages
- **Live:** https://ttt3p.github.io/nntn/hub.html
- **Tmux:** `04-nntn-platform:1` · **Model:** Claude Sonnet 4.6
- **Holding:** NNTN · managed by CROO

## Architecture

- **Frontend:** 51 HTML files, no build step, deploy via `git push origin main`
- **Backend:** Supabase project `emjqulzikpxorvpaaiww` via PostgREST
- **Auth:** Supabase Auth email/password · anon key only in frontend
- **Schemas:** `public` · `stock` · `cookingbook` · `sales_ops` · `cron` · `net`
- **CI:** 17 Playwright E2E tests (`qa-playwright.yml`) · Semgrep SAST · security probe
- **Docs:** `BLUEPRINT.md` (architecture SOT) · `ship-log.md` (deploy history)

## Hard Gates

- **NEVER** expose `service_role` key in frontend — anon key only
- **NEVER** bypass RLS — all client queries go through PostgREST with RLS enforced
- **NEVER** UPDATE/DELETE `stock_movements` — append-only (trigger-enforced)
- **NEVER** merge PR with Semgrep ERROR/WARNING findings
- **NEVER** dual-write — Supabase is single source of truth, Excel is read-only mirror

## Cron Jobs (Supabase pg_cron)

9 jobs including: auto-reconcile (5min), AIM webhook confirm/retry, OOS alerts,
divergence audit (23:00 BKK), weekly digest (Sun 20:00 BKK).
Details in `BLUEPRINT.md` section 1.

## Security Layers

1. Semgrep SAST on every PR (SARIF upload)
2. GitHub secret scanning + push protection
3. Supabase RLS + safety triggers
4. Playwright E2E + periodic security probe
