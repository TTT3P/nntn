#!/usr/bin/env python3
"""
NNTN Backup Script
Export all critical tables from Supabase → local JSON files
Usage: python3 scripts/backup.py
Output: ~/Documents/NNTN-Backup/YYYY-MM-DD/
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
LOCAL_DIR    = Path(os.environ.get("BACKUP_DIR", str(Path.home() / "Documents" / "NNTN-Backup")))

if not SUPABASE_URL or not SERVICE_KEY:
    # Try loading from .env file
    env_path = Path.home() / ".config" / "nntn" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                if k.strip() == "SUPABASE_URL":
                    SUPABASE_URL = v.strip().rstrip("/")
                elif k.strip() == "SUPABASE_SERVICE_ROLE_KEY":
                    SERVICE_KEY = v.strip()

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

# ── Tables to backup ──────────────────────────────────────────────────────────
# Format: (schema, table, select_columns)
TABLES = [
    # Stock core
    ("public",      "items",          "*"),
    ("public",      "catch_weight",   "*"),
    ("public",      "stock_counts",   "*"),
    ("public",      "bom_items",      "*"),
    # CookingBook
    ("cookingbook", "recipes",        "*"),
    ("cookingbook", "bom_items",      "*"),
    ("cookingbook", "control_params", "*"),
    ("cookingbook", "tier_pricing",   "*"),
    # Stock deliveries
    ("stock",       "deliveries",     "*"),
    ("stock",       "delivery_lines", "*"),
    # Sales Ops
    ("sales_ops",   "fs_items",       "*"),
    ("sales_ops",   "grab_items",     "*"),
    ("sales_ops",   "grab_daily",     "*"),
    ("sales_ops",   "grab_modifiers", "*"),
]

def fetch_table(schema: str, table: str, select: str = "*") -> list:
    """Fetch all rows from a table via PostgREST REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&limit=100000"
    headers = dict(HEADERS)
    if schema != "public":
        headers["Accept-Profile"] = schema
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ❌ {schema}.{table}: HTTP {e.code} — {body[:120]}")
        return []
    except Exception as e:
        print(f"  ❌ {schema}.{table}: {e}")
        return []

def run_backup():
    ts = datetime.now(timezone.utc)
    date_str = ts.strftime("%Y-%m-%d")
    out_dir = LOCAL_DIR / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"🗄️  NNTN Backup — {date_str}")
    print(f"📁  Output: {out_dir}\n")

    manifest = {"date": date_str, "timestamp": ts.isoformat(), "tables": {}}
    total_rows = 0

    for schema, table, select in TABLES:
        print(f"  ⬇️  {schema}.{table}...", end=" ", flush=True)
        rows = fetch_table(schema, table, select)
        filename = f"{schema}__{table}.json"
        (out_dir / filename).write_text(
            json.dumps(rows, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8"
        )
        manifest["tables"][f"{schema}.{table}"] = {"rows": len(rows), "file": filename}
        total_rows += len(rows)
        print(f"{len(rows)} rows ✅")

    # Write manifest
    (out_dir / "_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"\n✅ Backup complete — {total_rows} rows total")
    print(f"📋 Manifest: {out_dir / '_manifest.json'}")

    # Cleanup: keep only last 30 days locally
    cutoff = ts.timestamp() - (30 * 86400)
    cleaned = 0
    for d in LOCAL_DIR.iterdir():
        if d.is_dir() and d.name != date_str:
            try:
                if d.stat().st_mtime < cutoff:
                    import shutil
                    shutil.rmtree(d)
                    cleaned += 1
            except Exception:
                pass
    if cleaned:
        print(f"🧹 Cleaned {cleaned} old backup(s) (>30 days)")

if __name__ == "__main__":
    run_backup()
