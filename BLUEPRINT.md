# NNTN Web — Blueprint (current state)

> Living reference for the **existing** website — not future redesign.
> Open this before touching anything: know what writes where, what triggers fire, what bugs lurk.
>
> Last updated: **2026-04-25** · latest commit: `092cb0e` · 51 HTML files

---

## §1 Architecture snapshot

| Layer | Stack |
|---|---|
| Frontend | Vanilla HTML/CSS/JS · no build step · GitHub Pages |
| Auth | Supabase Auth email/password · JWT in `localStorage.nntn_sb_token` · shared `auth.js` |
| Backend | Supabase Postgres (project `emjqulzikpxorvpaaiww`) via PostgREST |
| Schemas active | `public` (core) · `stock` (deliveries) · `cookingbook` (BOM) · `sales_ops` (revenue) |
| Deploy | `git push origin main` → Pages rebuild ~1–2 min |
| CI | `.github/workflows/qa-playwright.yml` runs 17 tests every PR |
| Hub entry | `https://ttt3p.github.io/nntn/hub.html` |
| Repo | `github.com/TTT3P/nntn` |
| Credentials | `~/.zshrc` NNTN_USR/NNTN_PWD · GitHub Secret (same) · `platformci@staffnntn.co` |

**PostgreSQL extensions:** `pg_cron` · `pg_net` · `pgcrypto` · `uuid-ossp` · `pg_graphql` · `supabase_vault` · `pg_stat_statements`

**Cron jobs (6 in `cron.job`):**
| Job | Schedule | Purpose |
|---|---|---|
| `nntn-keep-alive` | `0 8 */5 * *` (every 5 days 08:00) | Prevent Supabase free-tier pause |
| `nntn-platform-auto-reconcile` | `*/5 * * * *` (every 5 min) | Sync sm↔stock_counts drift (creates count event) |
| `nntn-confirm-aim-deliveries` | `*/2 * * * *` | Confirm Discord AIM webhook delivery succeeded |
| `nntn-retry-aim-failures` | `*/3 * * * *` | Retry failed AIM webhooks |
| `nntn-confirm-oos-deliveries` | `*/2 * * * *` | Confirm OOS alert webhooks |
| `nntn-retry-oos-failures` | `*/5 * * * *` | Retry failed OOS alerts |

**Data scale:** 251 active items · 406 catch_weight bags In Stock (A=17, B=72, C=317) · 56 tables with RLS · 73 policies

---

## §2 Page catalog (47 files)

Legend: ✅ stable · ⚠️ has known issue · 🚫 deprecated redirect · 🎨 design preview · 📖 docs

### Public / entry
| URL | LoC | Purpose | Reads | Writes | Status |
|---|---:|---|---|---|---|
| `hub.html` | 206 | Main entry (8 cards) | — | — | ✅ |
| `login.html` | 184 | Auth gate | — | auth only | ✅ |
| `guide.html` | 805 | คู่มือใช้งาน | — | — | ✅ (v2 pending commit) |
| `app.html` | 13 | SPA shell iframe | — | — | ✅ |

### Non-meat stock
| URL | LoC | Purpose | Reads | Writes | Status |
|---|---:|---|---|---|---|
| `index.html` | 411 | Stock status by category | items, v_stock_unified | — | ✅ |
| `dashboard.html` | 567 | 4-card dashboard + filters | items, v_stock_unified, current_stock | — | ✅ |
| `stock-form.html` | 529 | นับสต๊อก (manual count) | items, stock_counts | stock_counts insert | ✅ |
| `count-sheet.html` | 316 | ใบนับ (form variant) | items | stock_counts | ✅ |
| `stock-dispense.html` | 1069 | เบิก + loss | items, v_stock_unified | stock_counts | ✅ |
| `stock-report.html` | 579 | Report + history | items, stock_counts (events) | — | ✅ |
| `portion-form.html` | 401 | แบ่ง SRCP→PKG portions | items, v_stock_unified | portion_log | ✅ |
| `po-receive.html` | 1064 | PO + รับของ | items, suppliers, PO | rpc_receive_universal | ⚠️ *receive_delta bug* |
| `goal-dashboard.html` | 611 | KPI goals | projects, commitments | — | ✅ |
| `data-pipeline.html` | 1501 | ระบบเก็บข้อมูลยอดขาย Grab/FS/Wongnai ingest | — | external sales tables | ✅ (doc light) |
| `production-log-form.html` | 946 | บันทึก prep (no stock effect) | bom_items, recipes | production_log, ingredient_dispense | ✅ |
| `production-log-view.html` | 272 | ประวัติ prep | production_log | — | ✅ |
| `production-history.html` | 322 | ประวัติผลิต (catch-weight-based) | v_production_history, catch_weight | — | ✅ |
| `prep-form.html` | 430 | บันทึก Prep (alt) | bom_items, prep_log | prep_log | ✅ |
| `prep-log-view.html` | 326 | Prep ประวัติ | prep_log | — | ✅ |

### Admin
| URL | LoC | Purpose | Status |
|---|---:|---|---|
| `admin-items.html` | 678 | ทะเบียนวัตถุดิบ (CRUD items + suppliers) | ✅ |
| `admin-bom.html` | 412 | จัดการ BOM | ✅ |
| `admin-config.html` | 422 | Par level config | ✅ |

### Meat stock
| URL | LoC | Purpose | Reads | Writes | Status |
|---|---:|---|---|---|---|
| `meat-stock/index.html` | 2895 | 🔴 **Monolith** — receive/produce/stock/history tabs | catch_weight, cook_sessions, delivery_lines | cw inserts, submit_close_pot RPC | ⚠️ 2900 LoC · split to 4 pages planned |
| `meat-stock/guide.html` | 589 | Meat-stock คู่มือ | — | — | 📖 |

### Cross-domain
| URL | LoC | Purpose | Reads | Writes | Status |
|---|---:|---|---|---|---|
| `hub-delivery.html` | 2477 | 🚚 ใบนำส่ง meat+non-meat | v_stock_unified, catch_weight, delivery_drafts | `submit_delivery` RPC | ⚠️ *draft not auto-cleared after submit* |
| `count-log.html` | 163 | 📋 Transparency log (count/adjust only) | v_count_adjust_log | — | ✅ NEW 22/04 |
| `count-sheet-weekly.html` | 293 | 🖨️ ใบพิมพ์ 7 วัน (12 pre-packaged SKU) | catch_weight, items | — | ✅ NEW 22/04 |
| `platform-health.html` | 262 | 🛡️ SLO / invariants / DLQ | platform_* RPCs | — | ✅ |

### CookingBook (cross-room — CookingBook owns)
| URL | LoC | Purpose | Reads |
|---|---:|---|---|
| `cookingbook/index.html` | 98 | Entry · 2 sections (BOM · SOP) · role-gated cards | — |
| `cookingbook/menu.html` | 511 | เมนู + ต้นทุน | — |
| `cookingbook/menu-bom.html` | 154 | Menu BOM + FC% | bom_items, ingredients, recipe_costs, recipes |
| `cookingbook/bom-detail.html` | 185 | BOM detail | bom_items, ingredients, recipe_costs, recipes |
| `cookingbook/ingredients.html` | 133 | Ingredients list | ingredients |
| `cookingbook/prep-rcp.html` | 132 | Prep RCP | bom_items, ingredients, recipes |
| `admin-sop.html` | 521 | SOP authoring · free-form textarea + 1 cover photo + 7-state | recipes · bom_items · cookingbook.sop_steps · storage `sop-covers` |
| `sop-review.html` | 433 | ไทน์ QC queue · approve/reject/revise/pause | cookingbook.sop_steps |
| `print-recipe.html` | 409 | A4 print · `?rcp=<id>` · BOM + steps freeform | recipes · bom_items · cookingbook.sop_steps |

### Sales Ops
| URL | LoC | Purpose | Reads |
|---|---:|---|---|
| `sales-ops.html` | 1286 | Daily revenue · 6-breakpoint responsive · sparklines · donut · stacked bar · data-driven anomaly | v_daily_revenue · v_menu_performance · v_revenue_by_channel |

### Deprecated / redirect stubs
| URL | Redirects to |
|---|---|
| `receiving-form.html` | `po-receive.html` (3s meta refresh) |
| `daily-form.html` | `index.html` (3s meta refresh) |
| `withdrawal-form.html` | linked from hub-delivery (review needed) |
| `bom-view.html` | replaced by cookingbook/bom-detail |
| `salesops-daily-dashboard-poc.html` | 🎨 mock (sales-ops PoC design · superseded by `sales-ops.html` live) |
| `design-mock-production.html` | 🎨 mock |
| `design-system-preview.html` | 🎨 mock |
| `theme-preview.html` | 🎨 mock |
| `rpc-vs-rest.html` | 🎨 demo |
| `cook-approach-compare.html` | 🎨 demo |
| `meat-flow-diagram.html` | 📖 diagram |
| `nntn-supabase-diagram.html` | 📖 diagram |
| `prep-form-preview.html` | 🎨 preview |

---

## §3 Stock write paths

### Meat (catch_weight bag-level)
```mermaid
flowchart LR
  A[meat-stock#receive] -->|INSERT cw| CW[(catch_weight)]
  CW -->|cw_emit_sm_insert trigger| SM[(stock_movements +qty)]
  H[hub-delivery submit_delivery RPC] -->|UPDATE status=Delivered| CW
  CW -->|cw_emit_sm_status trigger| SM2[(sm -qty)]
  P[meat-stock#produce repack] -->|status=Repacked + new cw| CW
```

### Non-meat (stock_counts event log)
```mermaid
flowchart LR
  PO[po-receive] -->|rpc_receive_universal| SC[(stock_counts event=receive)]
  ST[stock-form/count-sheet] -->|INSERT event=count| SC
  DP[stock-dispense] -->|INSERT event=dispense dispense_qty=X| SC
  HD[hub-delivery submit_delivery] -->|INSERT event=dispense| SC
  SC -->|sc_emit_sm_insert trigger| SM[(stock_movements)]
  SC -.check_stock_before_dispense_trg.->|BEFORE insert| GUARD{qty >= dispense_qty?}
  GUARD -->|no| BLOCK[RAISE INSUFFICIENT_STOCK]
```

### PKG (same as non-meat, cascade gap)
- PKG-xxx reads/writes via stock_counts (same path as non-meat)
- **GAP**: PKG-009 "ชุดเครื่องปรุง" = bundle of PKG-001/002/003 — no cascade decrement
- Resolution: CookingBook must define bundle BOM + Platform implements cascade (pending)

### Read path (what UI queries for current qty)
- `v_stock_unified` — `SUM(qty_delta) GROUP BY item_id` from stock_movements
- Single source of truth since 21/04 migration

---

## §4 Triggers & RPCs reference

### RPCs (public schema)
| Name | Purpose | Caller |
|---|---|---|
| `rpc_receive_universal` | Universal receive (routes by item.type) | po-receive |
| `rpc_count_adjust` | Explicit count adjustment | (legacy admin) |
| `rpc_delivery_out` | Delivery out path (legacy) | — |
| `rpc_delivery_reverse` | Undo a delivery (compensating event) | admin tools |
| `rpc_disposal` | Mark bag disposed | meat-stock |
| `rpc_po_receive` | Older PO receive (deprecated by universal) | — |
| `rpc_production_execute` | Execute production (catch_weight multi-step) | meat-stock#produce |
| `rpc_repack_execute` | Execute repack session | meat-stock#produce |
| `rpc_stock_by_sku` | Lookup stock per SKU | helpers |
| `rpc_stock_snapshot*` | Snapshot for reports | platform-health |
| `rpc_tag_production` | Tag CW rows with production ref | meat-stock |
| `rpc_warehouse_transfer` | Move bag between คลัง A/B/C | meat-stock |

### RPC (stock schema)
| Name | Purpose |
|---|---|
| `stock.submit_delivery` | Atomic meat+nm delivery (bags→Delivered + stock_counts dispense + deliveries row) |

### Triggers — critical safety
| Table | Trigger | When | What |
|---|---|---|---|
| `stock_movements` | `sm_block_mutation` | BEFORE UPDATE/DELETE | ⚠️ **Raises** — sm is append-only |
| `stock_movements` | `sm_auto_emit_activity` | AFTER INSERT | Emits activity stream |
| `catch_weight` | `stamp_actor_catch_weight` | BEFORE INS/UPD | Sets `actor_id` from `app.actor` GUC |
| `catch_weight` | `prevent_deliver_if_not_in_stock` | BEFORE UPDATE | Blocks status→Delivered if not In Stock |
| `catch_weight` | `cw_emit_sm_insert` | AFTER INSERT | Emits sm +qty_delta |
| `catch_weight` | `cw_emit_sm_status` | AFTER UPD(status) | Emits sm (Delivered=-, Disposed=-) |
| `catch_weight` | `cw_emit_sm_transfer` | AFTER UPD(warehouse) | Emits warehouse_transfer event |
| `catch_weight` | `cw_oos_alert_trigger` | AFTER INS/UPD(status) | Discord OOS alert |
| `catch_weight` | `aim_catch_weight_trg` | AFTER INS/UPD | Discord AIM notification |
| `stock_counts` | `check_stock_before_dispense_trg` | BEFORE INSERT | ⚠️ **Guard**: raises INSUFFICIENT_STOCK |
| `stock_counts` | `sc_emit_sm_insert` | AFTER INSERT | Emits sm by event_type (receive/dispense/count/adjustment) |
| `stock_counts` | `aim_stock_counts_trg` | AFTER INSERT | Discord AIM |
| `deliveries` | `aim_deliveries_trg` | AFTER INSERT | Discord AIM |

### Views
- `v_stock_unified` — **SoT** qty_on_hand per item (frontend primary)
- `v_count_adjust_log` — for count-log.html (count_adjust_up/down only)
- `v_production_history` — cw join production tags
- `v_production_reconciliation` — recipe vs actual consumed
- `v_stock_history_per_item` · `v_stock_history_per_lot` — audit timelines
- `v_cost_per_bag` — cost tracking

---

## §5 Known bugs + workaround

| ID | Severity | Bug | Workaround | Fix path |
|---|---|---|---|---|
| **B1** | 🔴 P1 | `rpc_receive_universal` + `emit_sm_from_stock_counts` receive branch uses `NEW.qty` (= after total) as delta → inflates sm when before>0 | Zero-out SKU before first receive (rare ops): `INSERT stock_counts qty=0 event=count` | Fix trigger: compute `v_delta = NEW.qty - running_total` OR rpc writes delta not after-total |
| **B2** | 🟠 P1 | `hub-delivery` draft not deleted after successful submit → stale drafts block re-submit | Manual `DELETE FROM stock.delivery_drafts WHERE bill_no=X` | Add `DELETE` at end of `submit_delivery` success in hub-delivery.html submitDelivery() |
| **B3** | 🟡 P2 | Bundle SKU (e.g. PKG-009 ชุดเครื่องปรุง) dispenses standalone qty without cascading sub-items | None | Waiting on CookingBook BOM spec → Platform implements cascade |
| **B4** | 🟡 P2 | `platform_slo_log` SLO cron not writing | None needed (no downstream reader) | Drop table OR schedule cron |
| **B5** | 🟢 P3 | count-log doesn't show receive/dispense events → user may see +10 adjust + think stock is 10 | Check dashboard for true qty | Add qty_on_hand column to count-log UI |
| **B6** | 🟢 P3 | 4-bill scatter when shipping combined meat+nm via SQL (FS20260422-1 + -NM + -M2 + -NM2) | bill_no UNIQUE prevents merge | UI enhancement: group bills by date+branch in hub-delivery history view |
| **B7** | 🟢 P3 | `data-pipeline.html` purpose unclear (1501 LoC) | Skip | Audit + deprecate or document |

---

## §6 Decision log (rolling, latest 30)

| Date | Decision | Why |
|---|---|---|
| 24/04 | `371416b` cookingbook/index SOP nav section · 3 cards · `data-role="staff,admin"` fail-open gating · QA 1/1 | CB brief 1496922698... · SOP pages shipped but invisible without nav |
| 23/04 | `5fae97c` sales-ops live data rebuild · 1286 LoC · 6-breakpoint responsive · merged existing Supabase wiring + PoC rich design · data-driven anomaly (<50% of 7-day median) · QA 44/44 | ไทน์ flag "ดีกว่าเดิมเยอะ · ต้อง responsive ด้วย" after PoC round |
| 25/04 | HR wireframes 3 หน้า · attendance form + dashboard + employee config (mock data · spec in vault) | COO brief `1497543249483534346` · ไทน์ approve · Phase 1 reference |
| 25/04 | Phase C migration `phase_c_weekly_digest` · nntn_weekly_digest() + cron Sunday 20:00 ICT | weekly volume + users + drift summary |
| 25/04 | Phase B inline help banners (meat-stock #รับเนื้อสด + stock-dispense) · "ใช้เมื่อ / ไม่ใช้" guidance | Phase B step 3 · prevent wrong-tab usage |
| 25/04 | `092cb0e` guards: confirm summary on dispense + yield 30-110% sanity warn on แปรรูป | Phase B step 2 · catch finger-slip + typo |
| 25/04 | `821fbdb` audit: stock_counts.counted_by = `<USER> · channel` (was channel-only) | Phase B step 1 · per-user traceability |
| 25/04 | migration `phase_a_audit_views_and_divergence_check` · v_user_actions_daily + v_sm_cw_divergence + cron 23:00 ICT | Phase A · system-driven divergence audit · auto Discord alert daily |
| 25/04 | migration `aim_cw_status_summary_v3` · statement-level UPDATE trigger · 1 msg/SKU | Phase 1 noise reduction · transition tables aggregation |
| 25/04 | `d9804c6` MT-044 เนื้อโกเบ + REPACK_MAP MT-004 → [MT-004, MT-044] | New product line · ชายโครงตุ๋น แปรรูป → 50% โกเบ + 50% leftover |
| 25/04 | `2486282` แปรรูป scrap auto-pick via SCRAP_MAP · no น้องเลือก | Prevent SKU drift in scrap naming |
| 25/04 | `79b55d8` แปรรูป scrap row → dropdown + INSERT CW (was text-only summary) | Bug fix · scrap stock ไม่ขึ้นทุกครั้ง |
| 25/04 | `e9803ff` po-receive block MT items (meat_portioned/cooked/trim) | Force in-house repack-only path |
| 25/04 | guide.html v2 shipped · sticky FAB + flow diagrams + gradient header · 169 inserts | UX polish · uncommitted 2-3 days · ไทน์ approve msg `1497296007682064394` |
| 25/04 | Cleanup: 5 historical migration SQL files (05-06/04 · already applied) removed from repo root | Noise reduction · catch_weight/meat_tables/phase2_ingredients_view/phase2_recipe_costs_view/stock_schema tables/views verified exist · superseded by Supabase migrations table |
| 24/04 | FS menu sync · 21 ops (Option 1) · migration `fs_menu_sync_20260424_opt1_21ops` · 4 price UPDATE + RCP-022-M DEACTIVATE + 18 INSERT (RCP-049..066) · RCP-009 skip (sub-recipe ref RCP-021) · QA 128/128 | CB → COO ship via COO `1497269458861953094` · CB ack `1497274670846578812` |
| 24/04 | `2b1a70f` stock-dispense: guard catch_weight + fix log UUID display | Block wrong-path dispense (sm/CW divergence) + picker excludes pkg ทำ log fallback UUID |
| 24/04 | `8d699af` admin-sop recipe search: normalize 'กระ'↔'กะ' | User typed 'กระเพรา' ไม่เจอ 'กะเพรา' |
| 24/04 | `2953e2a` SOP 3 pages: update stale anon key | hardcoded iat 2025 · sync to auth.js iat 2026 |
| 23/04 | CB `866c531` SOP stack live: `cookingbook.sop_steps` + bucket `sop-covers` + 3 pages (admin-sop · sop-review · print-recipe) · RLS authenticated r/w | CookingBook SOP authoring flow |
| 23/04 | `34ca44b` Enter key jump next bag input (ปิดหม้อ modal) | UX — ไม่ต้องลากเม้าส์ทุกบรรทัด |
| 23/04 | `885d1f8` MT-004 ชายโครงตุ๋น → แปรรูป input (แบ่งถุง self-map) | ไทน์ request · 6 ถุง CW in_stock |
| 22/04 | RCP-042→RCP-043 rename + 8 BOM rows + sell_price_delivery=299 (rows 1669-1676 · snapshot `backup_20260422_rcp043`) | CB ship SQL via COO DEC-2026-04-22-002 flow (2× spot + ไทน์ approve) |
| 22/04 | `d44c66d` draft nm rows show stock badge (✓/⚠️/❌) | Draft flow — see stock mismatch before submit day |
| 22/04 | `f0147c8` po-receive allow PKG items | PKG can legit come from supplier |
| 22/04 | `370e289` count-sheet-weekly narrow whitelist to 12 SKU (v2 PDF) | Per ไทน์ reference — shop-counter pre-packaged only |
| 22/04 | `185d3e4` count-log.html + v_count_adjust_log view | Transparency > RLS lockdown (small-team deterrent) |
| 22/04 | `f078b48` remove หม้อตุ๋น dup card + redirect 2 orphan forms | Hub cleanup |
| 22/04 | `dee8ec0` harmonize 3 cwStock loads (sku+category) | Row 2 dropdown empty bug in meat-stock#produce |
| 22/04 | `98b4a57` parse RPC errors → Thai friendly | User can't read `HTTP 400` |
| 22/04 | `f5869f5` pre-submit re-fetch v_stock_unified (stale cache guard) | Another session may dispense |
| 22/04 | `0bae822` block OOS items in hub-delivery nm picker | PKG stock cache bug + DB-level guard bypass risk |
| 22/04 | `d509bd0` wrap bag id with String().substring() | bigint crash when legacy_cw_row null |
| 22/04 | `1c03ef8` migrate 3 pages to v_stock_unified (SoT migration) | Deprecate raw stock_counts reads |
| 22/04 | Zero-out ผักบุ้ง SP-128 | Receive_delta bug workaround (B1) |
| 22/04 | Revert 13-bag MT-019 repack | น้องทำผิด (source #3283/#3284 back + output #3302-3314 Out) |
| 22/04 | Delete stuck draft NT20260422-1 | Auto-clear bug B2 |
| 21/04 | `ae24aa0` sales-ops Section 1 MVP live | Unblock ไทน์ 4-day wait |
| 21/04 | `b647726` frontend SoT migration (stock-dispense, po-receive via RPC) | Unify read path |
| 21/04 | `6e9f54a` platform-health audit tab + JWT actor + unified receive | Audit + observability |
| 21/04 | `fe1416f` platform-health operational dashboard (Sprint 1) | Stop-the-bleeding visibility |
| 21/04 | `951f8a2` hub-delivery draft as source of truth on submit | Draft-form desync fix |
| 21/04 | `ea25058` auth.js JWT auto-refresh + 401 retry | Token expiry UX |
| 21/04 | `a471f97` meat-stock uniform-weight fill for fixed portions | UX |
| 21/04 | `ffeebb4` multi-SKU output groups + cleanup MT-031 | แปรรูป UX |
| 20/04 | `b49a802` goal-dashboard v2 live data | Replace mock |
| 19/04 | `422c53a` shared shell v2 iframe-based SPA | Unified navigation |
| 19/04 | `e064282` shared shell sidebar/topbar on 10 pages | IA consistency |
| 19/04 | `2253120` nav: Non-meat Stock + split Hub/Goal | Clarify IA |
| 19/04 | `8ca5a0e` revert expandable nav — flat | Sub-categories need aggregate pages |
| 19/04 | `0f2165a` expandable nested nav (since reverted) | Shopify-style tree |
| 19/04 | `e98b8e3` fix nav-badge query (current_status → current_stock) | Badge showed wrong count |
| 18/04+ | Auto-reconcile cron · platform_health SLOs · pg_net DLQ | Operational reliability sprint |

---

## §7 Quick lookup

### "Where does qty come from in UI?"
→ `v_stock_unified` (since 21/04) · query: `SELECT qty_on_hand FROM v_stock_unified WHERE sku='SKU'`

### "Where do I add a new item?"
→ `admin-items.html` — inserts into `public.items`

### "How do I dispense without triggering guard?"
→ Can't — guard fires BEFORE insert. Must ensure `SUM(sm.qty_delta) >= dispense_qty` first

### "How do I undo a delivery?"
→ `SELECT public.rpc_delivery_reverse(delivery_id)` — creates compensating events

### "Where are Discord notifications configured?"
→ `aim_*_trg` triggers on catch_weight / stock_counts / deliveries · webhook in pg_net queue

### "Where is JWT handled?"
→ `auth.js` (shared) — auto-refresh on 401 · stored in `localStorage.nntn_sb_token`

### "How do I add a new module to hub?"
→ Edit `hub.html` grid section (8 cards currently) + create HTML file

---

---

## §8 CI / Ops / Backup

### GitHub Actions (`.github/workflows/`)
| Workflow | Trigger | Purpose |
|---|---|---|
| `qa-playwright.yml` | PR + push main | 17-test regression suite (needs NNTN_USR/PWD secrets) |
| `backup.yml` | Nightly cron | Calls `scripts/backup.py` — dumps key tables to JSON |
| `keepalive.yml` | Periodic | Cron-poke Supabase endpoints (duplicate of DB cron safety) |
| `security-probe.yml` | `0 2 * * 1` (Mon 09:00 BKK) | Probe anon access — all critical endpoints must return 401 |

### Scripts (`scripts/`)
| File | Purpose |
|---|---|
| `backup.py` | Export items · catch_weight · stock_movements · etc → `~/Documents/NNTN-Backup/YYYY-MM-DD/*.json` |
| `gen_arch.py` | Scan HTML → generate `NNTN-Vault/System/architecture/module-catalog.md` (⚠️ TCC-blocked on macOS currently) |

### Testing (Playwright)
Config: `playwright.config.ts` · suites in `tests/`:
- `auth.setup.js` — login once, store state
- `public-pages.spec.js` — login + hub render
- `hub-delivery.spec.js` — form loads + history
- `hub-delivery-draft.spec.js` — draft roundtrip
- `meat-stock.spec.js` — FIFO + repack + dropdowns
- `qa-goal-dashboard.spec.js` — structure integrity
- `end-to-end-smoke.spec.js` — smoke top flows

**Run:** `npm test` · `npm run test:ui` · `npm run test:headed` (dev: inherit env from `~/.zshrc`)

### GitHub Secrets (repo `TTT3P/nntn`)
- `NNTN_USR` · `NNTN_PWD` — Playwright login
- `SUPABASE_ANON_KEY` — security-probe workflow
- (Backup script uses local config, not repo secret)

### RLS Policy summary
- 56 tables RLS-enabled · 73 policies total
- Pattern: `authenticated_all = true` on most tables (transparent-team model)
- Sensitive: `stock_movements` = append-only via `sm_block_mutation` trigger (not RLS)
- Auth enforced at frontend level via `auth.js` JWT check

---

## §9 Integrations (external)

### Discord AIM (outgoing webhook via pg_net)
```mermaid
flowchart LR
  T[triggers: catch_weight / stock_counts / deliveries] -->|AFTER INS/UPD| AIM[aim_*_trigger fn]
  AIM -->|pg_net.http_post| Q[(net.http_request_queue)]
  Q --> D[Discord webhook URL]
  C[cron: confirm-aim-deliveries every 2min] -->|verify| Q
  R[cron: retry-aim-failures every 3min] -->|requeue 4xx/5xx| Q
```
- Config table: `aim_config`
- Functions: `aim_notify`, `aim_catch_weight_trigger`, `aim_stock_counts_trigger`, `aim_deliveries_trigger`, `aim_items_trigger`, `aim_process_summary_trigger`
- Channels: `#aim` (stock events), `#coo`, `#platform`, `#stock`, `#cookingbook`, `#sales-ops`

### Sales data ingestion (`data-pipeline.html`)
- Sources: **Grab · FoodStory · Wongnai** — manual/scraped dump into SB tables
- Consumed by: `sales-ops.html` (v_daily_revenue)
- Scope: Platform holds schema; CookingBook/Sales Ops interpret

### Keepalive (dual layer)
1. GitHub Action `keepalive.yml`
2. Supabase `cron.job` `nntn-keep-alive` every 5 days
(belt + suspenders to prevent free-tier pause)

### Webhook DLQ (pg_net)
- `net.http_request_queue` holds pending webhooks
- Failure retries via cron
- Monitored on `platform-health.html` (DLQ stuck > 15 min alarm)

---

## §10 Conventions / glossary

### SKU prefix
| Prefix | Meaning | Example | Count |
|---|---|---|---|
| `MT-xxx` | Meat — finished portioned pack | `MT-019 เนื้อสดหมักนุ่ม` | ~40 |
| `SP-xxx` | Supply / supplies (any non-meat single-item) | `SP-128 ผักบุ้งสด` | ~100 |
| `SRCP-xxx` | Semi-recipe / prep (made in-house, raw→cooked intermediate) | `SRCP-004 พริกน้ำส้ม` | 5 |
| `PKG-xxx` | Packaged ready-to-sell (bottle/bag) | `PKG-006 น้ำเก็กฮวย 220ml` | 16 |
| `MISC` | Ad-hoc free-text item (not in catalog) | — | 1 |

### Item category (14 active)
| Category | Count | Notes |
|---|---:|---|
| `seasoning` | 59 | Sauce, condiments |
| `consumable` | 29 | Packaging supplies (SP- items) |
| `packaging` | 29 | Wrappers, boxes |
| `spice` | 26 | Dry spices |
| `vegetable` | 26 | ผัก — received fresh, dispensed same-day typically |
| `meat` | 19 | Raw meat cuts |
| `pkg` | 16 | Pre-packaged SKU |
| `meat_portioned` | 12 | Portioned meat (75g, 100g, 500g pre-pack) |
| `noodle` | 11 | เส้น brands |
| `meat_cooked` | 10 | Cooked meat (ตุ๋น ready) |
| `srcp` | 5 | In-house prep (sauce, dressing) |
| `meat_trim` | 5 | เศษเนื้อ |
| `meat_other` | 3 | Offal / special parts |
| `misc` | 1 | Catch-all |

### Warehouse (คลัง) convention
- **คลัง A** (17 bags) = incoming raw staging — ใช้แทน "เพิ่งรับมา ยังไม่ผ่าน process"
- **คลัง B** (72 bags) = cooking area / repack staging — อยู่ระหว่าง process
- **คลัง C** (317 bags) = ready-to-deliver — ปกติคลัง C ใหญ่สุด, ส่งจากตรงนี้ไปหน้าร้าน

### catch_weight status transitions
```
✅ In Stock ────┬──→ 🔄 Repacked (source consumed in repack)
                ├──→ 🚚 Delivered (shipped via submit_delivery)
                ├──→ 🗑️ Disposed (loss/expired)
                └──→ ❌ Out (cancelled, manual admin)
```
- Blocked by `prevent_deliver_if_not_in_stock` trigger (can't Deliver if not In Stock)
- Blocked by `sm_block_mutation` (can't UPDATE sm row — bags can transition, sm append-only)

### Actor resolution chain
1. `rpc_receive_universal` / `submit_delivery` → sets `SET app.actor = p_actor` via `set_config`
2. `stamp_actor_catch_weight` BEFORE INS/UPD trigger → reads GUC → writes `cw.actor_id`
3. `_resolve_actor()` fallback → returns `current_setting('app.actor', true)` or auth.jwt()->>'email'
4. UI: `window.nntnCurrentUser` (from auth.js) passed as p_actor param

### Auth refresh cycle (`auth.js`)
- On load: check localStorage `nntn_sb_token`
- Expired / near-expiry: auto-refresh via Supabase Auth endpoint
- On 401 response: retry once with fresh token (since `ea25058` 21/04)
- Not-logged-in: redirect to `login.html`

### Brand (official guide — NOT approximate)
SoT: `~/Documents/Claude-Work/ไฟล์/AI-Strategy/brand identity/Brand Asset-20260413T061700Z-3-001.zip` → `เนื้อในตำนาน brand ci/CI/เนื้อในตำนาน_BRAND GUIDELINE.pdf` (40 pages)

**Colors (official hex from guide §2.1):**

| Token | Hex | RGB | CMYK |
|---|---|---|---|
| `brand-green` | **`#005036`** | 0, 80, 54 | 91, 41, 85, 42 |
| `brand-gold` | **`#D29568`** | 210, 149, 104 | 16, 45, 64, 1 |
| `ink-black` / `paper-white` | `#000` / `#FFF` | — | — |

Only 2 brand colors. Don't invent a third.

**Typography (official guide §3):**

| Font | Lang | Weights used | Role |
|---|---|---|---|
| Crimson Text | English | Bold · Semibold · Regular | Headline · Sub · Body |
| Moh Luang | Thai (display) | Regular | Headline (heritage feel) |
| SOV_Station | Thai (sans) | Bold · Book | Sub headline · Body |

Font files at `brand ci/FONTS/`. Don't substitute without approval.

**Logo rules (§1.7 — 9 don'ts):**
No rotate · no recolor · no outline · no disproportionate resize · no visual effects · no frame · no harmonious bg · no combine with other tagline · no modify parts.

**Logo minimum:** 2cm stacked · 3cm horizontal. Clear space = 1 "อ"-height around logo.

**Brand element (§4):** Diamond lattice pattern (4.1) + standalone diamond ornament (4.2) · 4-point radial symmetry · use as texture/divider/frame accent.

Logo theme = heritage modern (serif Thai + diamond ornament) — **not** minimalist flat. 5 variants available (green-on-white / green-on-cream / gold-on-green / black-on-white / white-on-black) in both Horizontal + Vertical.

---

## §11 What this blueprint does NOT cover (future work)

- ❌ CookingBook BOM detail schema — owned by CookingBook room
- ❌ Sales data pipeline internals (Grab/FS scraping logic)
- ❌ Web redesign target state (separate Phase 1 deliverable)
- ❌ Mobile/responsive behavior (desktop-first only)
- ❌ Full RLS policy audit per-table (73 policies — sampling only)
- ❌ DB migration history (list in Supabase dashboard `supabase_migrations.schema_migrations`)

---

---

## §12 SLO / Quality attributes

**Live dashboard:** `platform-health.html` reads these from `platform_slos()` RPC.

| Metric | Target | Measure | Breach action |
|---|---|---|---|
| **Stock drift** (sm vs stock_counts) | 0 items drifting > 1h | auto-reconcile cron every 5min fixes most · `v_drift` | If drift persists > 1 item > 2h → Discord #platform alert |
| **Delivery RPC success rate** | ≥ 99% | submit_delivery attempts vs 4xx/5xx | 3 fails in 10min → freeze POs until investigated |
| **Webhook DLQ age** | 0 items stuck > 15min | `net.http_request_queue` | Retry cron fires every 3-5min · manual replay if > 1hr stuck |
| **Negative stock count** | 0 SKUs with qty < 0 | `v_stock_unified` | Any < 0 → immediate investigation (sm emission bug) |
| **Page load** | < 2s p95 | GitHub Pages + CDN | 1-2 min deploy — if CDN slow, force cache bust `?v=timestamp` |
| **Auth token valid** | ≥ 95% sessions w/o re-login | `localStorage.nntn_sb_token` lifetime | Auto-refresh on 401 (since `ea25058`) |
| **Playwright regression** | 17/17 pass every push | CI workflow | Any red → revert or hotfix before next commit |
| **Backup freshness** | < 24h since last backup | `scripts/backup.py` local output | If missed nightly → run manually |

**Not-SLO but watched:**
- Catch-weight bag count per warehouse (A/B/C balance · too many in A = receive not flowing)
- Items with `on_hand = 0` (expected for perishables; alert only if > 20% of active catalog)
- Cron job last-run timestamp (any job silent > 2× interval = broken)

---

## §13 Context diagram (C4 Level 1 — who touches the system)

```mermaid
flowchart TB
  ไทน์[👤 ไทน์ owner<br>browser desktop] -->|login + all ops| SYS
  น้อง1[👥 น้องครัว 3-5 คน<br>mobile + desktop] -->|count, dispense, prep| SYS
  หน้าร้าน[🏪 FS / NT shop staff<br>receive deliveries] -->|view delivery bills| SYS

  SYS[🍜 NNTN Web<br>github.io/nntn/*] --> SB[(🗄️ Supabase<br>emjqulzikpxorvpaaiww)]

  SB -->|pg_net webhook| DC[📢 Discord AIM bot<br>#aim #coo #platform]
  SB -->|pg_cron keepalive| SB

  GRAB[📱 Grab food platform] -.->|order CSV / scrape| PIPE[data-pipeline.html]
  FS[📱 FoodStory POS] -.-> PIPE
  WN[📱 Wongnai] -.-> PIPE
  PIPE --> SB

  SUP[🏭 Suppliers] -.->|physical delivery| หน้าร้าน
  หน้าร้าน -->|po-receive form| SB

  GH[📦 GitHub Actions<br>backup · keepalive · QA · security] -->|scheduled| SYS
  GH -->|backup.py| FS2[💾 ~/Documents/NNTN-Backup/]

  classDef ext fill:#fef3c7,stroke:#ca8a04
  classDef our fill:#dbeafe,stroke:#1e40af
  class GRAB,FS,WN,SUP,DC ext
  class SYS,SB,GH our
```

**Users:**
- **ไทน์** — owner, sees everything · approves cross-room · desktop primary
- **น้องครัว** — 3-5 staff · kitchen mobile flows (receive, dispense, count) + desktop for complex
- **หน้าร้าน FS/NT** — receives delivery bills, doesn't enter data

**External systems:**
- **Discord** — AIM bot outbound notifications (read-only from system POV)
- **Grab / FoodStory / Wongnai** — sales data ingestion (one-way into NNTN)
- **Suppliers** — physical flow · connected via PO form

**Infra:**
- **Supabase** — Postgres + Auth + Storage (not used yet) · single region
- **GitHub** — Pages host · Actions run scheduled + CI · source of truth for code
- **Local macOS (ไทน์'s MacBook)** — backups land here · dev environment

---

## §14 Disaster Recovery playbook

### Scenario matrix
| Scenario | Severity | RTO target | First action |
|---|---|---|---|
| Supabase project suspended (free-tier) | 🔴 critical | 30 min | Restore via dashboard + keepalive check |
| Supabase data corrupted (wrong UPDATE/DELETE) | 🔴 critical | 1–4 hr | Restore from `scripts/backup.py` JSON + replay sm |
| GitHub Pages deploy broke site | 🟠 high | 5 min | `git revert HEAD && git push` · Pages rebuilds |
| Playwright CI red (regression) | 🟠 high | Before next push | Debug + rollback commit · don't push over red |
| Webhook DLQ stuck > 1hr | 🟡 medium | Next session | Check pg_net queue, manually POST failed rows |
| `rpc_receive_universal` delta bug strikes | 🟡 medium | Same day | Zero-out SKU (workaround B1) · plan real fix |
| Token/password leaked accidentally | 🔴 critical | Immediately | Rotate via `~/.zshrc` + `gh secret set` + Supabase dashboard |

### Backup strategy
- **Nightly:** `scripts/backup.py` → `~/Documents/NNTN-Backup/YYYY-MM-DD/*.json`
  - Tables dumped: items, catch_weight, stock_counts, stock_movements, deliveries, delivery_lines, bom_items, recipes, purchase_orders, suppliers
  - Retention: **manual** (no auto-prune yet — TODO)
- **Pre-op pg_dump (T-018 routine):** for large/irreversible ops → `.backup/pg_dump_*.sql` (gitignored, 30-day retention) — see `docs/pg_dump_routine.md`
- **Small reversible ops:** schema snapshot pattern (precedent: `backup_20260422_rcp043`) — faster than full dump, equivalent reversibility
- **Git = code backup** (push to github.com/TTT3P/nntn)
- **No Supabase PITR** (not on paid plan) — backup.py JSON + pg_dump are the only DB safety net

### Restore drill (quarterly recommended)
1. Spin test Supabase project
2. Load latest JSON backup via `psql COPY FROM`
3. Verify `v_stock_unified` count matches production
4. Rebuild frontend, point to test URL
5. Confirm login + 1 delivery flow
6. Document gaps, update playbook

### Emergency contacts / links
- Supabase dashboard: `supabase.com/dashboard/project/emjqulzikpxorvpaaiww`
- GitHub repo: `github.com/TTT3P/nntn/settings`
- Discord: `discord.gg/kwrTnKp6` (NNTN server)
- ไทน์: on-call owner · all critical decisions

---

## §15 RPC API contracts

> Freeze point: changing any signature below = breaking change → bump frontend + bump version.

### `public.rpc_receive_universal` — unified receive
```ts
rpc_receive_universal(
  p_actor:     text,     // required · "PO-receive" · "meat-stock-kanban" · etc
  p_item_id:   uuid,     // required · items.id
  p_qty:       numeric,  // required · > 0 · amount RECEIVED (not running total)
  p_unit_note: text?,    // optional · appended to stock_counts.note
  p_bags:      jsonb?    // only for meat-raw · [{bag_no, weight_g, warehouse}]
): jsonb                 // { ok, route: 'meat-raw-per-bag'|'sc-receive', item, ... }
```
**Routes by `items.type`:** `meat/raw` → per-bag catch_weight · else → stock_counts receive event

### `stock.submit_delivery` — atomic delivery
```ts
stock.submit_delivery(
  p_bill:     text,       // unique bill_no (schema UNIQUE)
  p_branch:   text,       // 'NT' | 'FS' (CHECK constraint)
  p_date:     date,
  p_channel:  text,       // 'NT' | 'FS' | 'hub-delivery' (CHECK)
  p_bag_ids:  bigint[],   // catch_weight IDs · empty array ok
  p_nm_lines: jsonb       // [{item_id, qty, note?, is_misc, avail?}]
): uuid                   // new delivery_id
```
**Raises:** `P0001: bag(s) not In Stock` · `P0001: bill/branch/date required` · `P0001: no bags and no nm lines`

### `public.rpc_delivery_reverse` — undo a delivery
```ts
rpc_delivery_reverse(p_actor, p_cw_id: bigint, p_reason: text): jsonb
```
Sets bag back to `✅ In Stock` + emits compensating sm event

### `public.rpc_count_adjust` — explicit count (manager adjustment)
```ts
rpc_count_adjust(p_actor, p_item_id: uuid, p_counted_qty: numeric, p_note?: text): jsonb
```
Writes stock_counts event='count' · trigger computes delta = counted_qty - current_sm_sum

### `public.rpc_production_execute` — cook session
```ts
rpc_production_execute(
  p_actor, p_recipe_id: uuid,
  p_source_cw_ids: bigint[],   // raw/portion bags going in
  p_produced: jsonb,           // [{item_id, bags: [{weight_g, warehouse}]}]
  p_cook_note?: text
): jsonb
```

### `public.rpc_repack_execute` — repack bag into smaller bags
```ts
rpc_repack_execute(
  p_actor, p_source_cw_id: bigint,
  p_produced: jsonb,   // [{bag_no, weight_g, warehouse}]
  p_mode: text = 'meat'
): jsonb
```

### `public.rpc_disposal` — dispose/loss
```ts
rpc_disposal(
  p_actor, p_reason: text,
  p_cw_ids?: bigint[],      // for meat bags
  p_item_id?: uuid,         // for non-meat (with p_qty)
  p_qty?: numeric,
  p_note?: text
): jsonb
```

### `public.rpc_warehouse_transfer` — move bags คลัง
```ts
rpc_warehouse_transfer(p_actor, p_cw_ids: bigint[], p_to_wh: char(1), p_reason?: text): jsonb
```

### `public.rpc_stock_by_sku` — simple lookup
```ts
rpc_stock_by_sku(p_sku: text): TABLE(sku, name, qty, unit)
```

### `public.rpc_stock_snapshot` / `rpc_stock_snapshot_rich` — report snapshots
```ts
rpc_stock_snapshot(p_warehouse?, p_type?, p_tier?, p_limit=50, p_offset=0): jsonb
rpc_stock_snapshot_rich(p_type='meat', p_warehouse?): jsonb
```

### `public.rpc_tag_production` — tag CW with recipe ref
```ts
rpc_tag_production(p_actor, p_recipes: jsonb): jsonb
```

### `public.rpc_delivery_out` (legacy — prefer submit_delivery)
### `public.rpc_po_receive` (legacy — prefer rpc_receive_universal)

---

**Compatibility rule (important):**
- ✅ Safe: add optional param at end · add field to return JSON
- ⚠️ Risky: rename param · change type · make optional → required
- 🔴 Breaking: remove param · remove return field · change route logic

ทุกครั้งที่แก้ RPC: bump line in §6 decision log + update §15 signature.

---

**Maintenance:** update §6 decision log per commit (1-line) · refresh §2 page catalog monthly or when adding/removing pages · bump "Last updated" at top.
