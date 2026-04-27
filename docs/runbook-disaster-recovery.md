# Disaster Recovery Runbook

> Operational playbook for incident response. Linked from BLUEPRINT.md §11.
> Last reviewed: 2026-04-27 (extracted from BLUEPRINT.md §14).

## Scenario matrix

| Scenario | Severity | RTO target | First action |
|---|---|---|---|
| Supabase project suspended (free-tier) | 🔴 critical | 30 min | Restore via dashboard + keepalive check |
| Supabase data corrupted (wrong UPDATE/DELETE) | 🔴 critical | 1–4 hr | Restore from `scripts/backup.py` JSON + replay sm |
| GitHub Pages deploy broke site | 🟠 high | 5 min | `git revert HEAD && git push` · Pages rebuilds |
| Playwright CI red (regression) | 🟠 high | Before next push | Debug + rollback commit · don't push over red |
| Webhook DLQ stuck > 1hr | 🟡 medium | Next session | Check pg_net queue, manually POST failed rows |
| `rpc_receive_universal` delta bug strikes | 🟡 medium | Same day | Zero-out SKU (workaround B1 in BLUEPRINT §5) · plan real fix |
| Token/password leaked accidentally | 🔴 critical | Immediately | Rotate via `~/.zshrc` + `gh secret set` + Supabase dashboard |

## Backup strategy

- **Nightly:** `scripts/backup.py` → `~/Documents/NNTN-Backup/YYYY-MM-DD/*.json`
  - Tables dumped: items, catch_weight, stock_counts, stock_movements, deliveries, delivery_lines, bom_items, recipes, purchase_orders, suppliers
  - Retention: **manual** (no auto-prune yet — TODO)
- **Pre-op pg_dump (T-018 routine):** for large/irreversible ops → `.backup/pg_dump_*.sql` (gitignored, 30-day retention) — see `docs/pg_dump_routine.md`
- **Small reversible ops:** schema snapshot pattern (precedent: `backup_20260422_rcp043`) — faster than full dump, equivalent reversibility
- **Git = code backup** (push to github.com/TTT3P/nntn)
- **No Supabase PITR** (not on paid plan) — backup.py JSON + pg_dump are the only DB safety net

## Restore drill (quarterly recommended)

1. Spin test Supabase project
2. Load latest JSON backup via `psql COPY FROM`
3. Verify `v_stock_unified` count matches production
4. Rebuild frontend, point to test URL
5. Confirm login + 1 delivery flow
6. Document gaps, update playbook

## Emergency contacts / links

- Supabase dashboard: `supabase.com/dashboard/project/emjqulzikpxorvpaaiww`
- GitHub repo: `github.com/TTT3P/nntn/settings`
- Discord: `discord.gg/kwrTnKp6` (NNTN server)
- ไทน์: on-call owner · all critical decisions
