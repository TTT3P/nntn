# NNTN Stock System — Gemini Context

> Gemini CLI companion — auto-loaded เมื่อ run ใน repo นี้
> Source of truth สำหรับ project rules อยู่ที่ BLUEPRINT.md + CLAUDE.md (ถ้ามี)

## System Overview

ระบบ Stock อัจฉริยะสำหรับร้านเนื้อตุ๋น NNTN (F&B)
- **Frontend**: Vanilla HTML/CSS/JS · no build step · GitHub Pages
- **Backend**: Supabase Postgres (project `emjqulzikpxorvpaaiww`) via PostgREST
- **Auth**: Supabase Auth email/password · JWT · shared `auth.js`
- **Hub**: https://ttt3p.github.io/nntn/hub.html
- **Deploy**: `git push origin main` → Pages rebuild ~1-2 min
- **CI**: 17 Playwright tests every PR

## Architecture

| Layer | Detail |
|---|---|
| Schemas | `public` · `stock` · `cookingbook` · `sales_ops` · `cron` · `net` · `auth` |
| Pages | 51 HTML files (stock forms, dashboard, admin, cookingbook, sales-ops) |
| Shared modules | `shared/nntn-shell.js` (nav) · `shared/nntn-tokens.css` (design tokens) · `shared/nntn-nav-badge.js` |
| Cron | 9 pg_cron jobs (auto-reconcile, AIM webhooks, divergence audit, weekly digest) |
| RPCs | 11 server functions (receive, delivery, count, production, repack, disposal, transfer) |

## Key Files

- `BLUEPRINT.md` — full architecture reference (sections §0-§10)
- `hub.html` — main entry point (8 navigation cards)
- `schema.sql` / `schema_v2.sql` / `schema_v3.sql` — database evolution
- `shared/` — reusable JS/CSS modules
- `playwright/` — E2E test specs
- `meat-stock/` — meat stock subsystem
- `cookingbook/` — recipe/BOM management pages
- `scripts/` — utility scripts

## Supabase Source of Truth (effective 27/04/2026)

Supabase = single source of truth สำหรับทุกข้อมูล operational
- Master Excel = read-only mirror · export จาก Supabase · ห้าม edit ตรง
- Data change → migration / web app / SQL · ห้าม dual-write

## Ignore (noise for code review)

- `node_modules/` — npm dependencies
- `playwright-report/` — test output
- `test-results/` — test artifacts
- `wireframes/` — design mockups
- `spike/` — experimental prototypes
- `docs/` — documentation pages
