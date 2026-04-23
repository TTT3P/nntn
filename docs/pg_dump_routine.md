# T-018 · pg_dump pre-op routine

**Status:** APPROVED by ไทน์ 23/04/2026 (Discord `1496699191563391068`) · Option A (large ops only)
**Policy origin:** COO DEC-2026-04-22-002 · "reversibility required for all non-trivial schema ops"

## When this routine fires (trigger criteria)

Run `pg_dump` **before** the operation if **any one** is true:

- **Schema DDL** affecting existing table: `ALTER`, `DROP`, `RENAME` column / table / constraint / index
- **Data change** > 10 rows in one transaction
- **Cross-schema** op (touches `public` + `cookingbook` etc.)
- **Irreversible** op: `DROP TABLE`, `TRUNCATE`, large `DELETE` without exact rollback script

**Skip for:**
- Small reversible ops (≤10 rows, single schema, with rollback script) → use **schema snapshot pattern** (per RCP-043 precedent · 22/04/2026)
- Seed-only inserts on empty new table in same migration as CREATE
- Read-only queries / views / functions (no data impact)

## Routine

### 1. Pre-op dump

```bash
# Schema-only (always)
SLUG="<short-op-name>"        # e.g. rcp043_bom_fix
DATE=$(date +%Y%m%d_%H%M%S)
OUTDIR="$HOME/Documents/Claude-Work/ไฟล์/non-meat-stock/.backup"
mkdir -p "$OUTDIR"

pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --schema=public --schema=cookingbook \
  -f "$OUTDIR/pg_dump_${DATE}_${SLUG}_schema.sql"

# Data-only if change >10 rows (add --table for each affected)
pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --table=public.stock_counts \
  --table=public.stock_movements \
  -f "$OUTDIR/pg_dump_${DATE}_${SLUG}_data.sql"
```

### 2. Apply op
Proceed with migration / SQL as planned.

### 3. Verify
Run verification queries per op plan.

### 4. Retain
Backups in `.backup/` folder · gitignored · 30-day local retention.

## `.backup/` policy

- **Gitignored** (not committed) — see `.gitignore` entry
- **Local/server only** — lives on ไทน์'s machine
- **Retention:** 30 days · auto-pruned by cron (see below)
- **Not a PITR substitute** — Supabase project still lacks paid PITR

## Retention cron

```bash
# ~/.zshrc or launchd — nightly 03:00 ICT
0 3 * * * find "$HOME/Documents/Claude-Work/ไฟล์/non-meat-stock/.backup" -name "pg_dump_*.sql" -mtime +30 -delete
```

## Restore (emergency)

```bash
# Latest dump for a given op
LATEST=$(ls -t .backup/pg_dump_*_schema.sql | head -1)
psql "$SUPABASE_DB_URL" -f "$LATEST"
# Then apply data-only if exists
psql "$SUPABASE_DB_URL" -f "${LATEST%_schema.sql}_data.sql"
```

## COO spot check workflow

Before ship:
1. Platform posts planned op + SQL to `#coo`
2. COO assesses: does trigger criteria apply?
3. If yes → COO asks for dump artifact path before approve
4. Platform runs dump → posts file path → COO approves apply

## Env requirements (one-time setup)

**⚠️ Current gap (23/04/2026):** pg_dump **not installed** on ไทน์ machine — setup required before first routine run.

### Setup steps
```bash
# 1. Install postgres client (provides pg_dump + psql)
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
pg_dump --version   # verify 16+

# 2. Get Supabase connection string
# Dashboard → Project Settings → Database → "Connection string" → URI
# Copy the "Session pooler" string (port 5432)

# 3. Add to ~/.zshrc (secret — do not commit)
echo 'export SUPABASE_DB_URL="postgresql://postgres.emjqulzikpxorvpaaiww:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"' >> ~/.zshrc

# 4. Test connection
pg_dump "$SUPABASE_DB_URL" --schema-only --schema=public -t items | head
# expect: SQL DDL output
```

### Disk budget
- ~50 MB per schema-only dump
- ~200 MB per full data dump
- With 30-day retention: ~6 GB max (unlikely; most dumps are targeted)

## References

- BLUEPRINT §14 Disaster Recovery (this file is linked from there)
- DEC-2026-04-22-002 (reversibility policy)
- RCP-043 precedent (schema snapshot alternative · 22/04)
