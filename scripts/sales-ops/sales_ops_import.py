#!/usr/bin/env python3
"""
sales_ops_import.py — NNTN Sales Ops P3 Import Pipeline

Pulls sales data from 4 POS accounts and upserts to Supabase `sales_ops.*`.

Architecture
============
- Authentication: Playwright headed browser for interactive first-time login,
  session captured via `storage_state` JSON, reused headless on subsequent runs.
- FoodStory: DataTable API call using captured cookies (proven via nntn_db_build.py).
- Grab:      `v1/reports/daily-pagination` + `v3/orders/{id}` batch (port of grab_pull.py).
- Upsert:    Supabase-py with env-selectable schema (sales_ops_test | sales_ops).

Session storage
===============
Location:  ~/.config/nntn/sessions/<pos_account>.json  (perms 0600)
Contents:  Playwright storage_state (cookies + localStorage).
Lifetime:  FoodStory ~1 day, Grab Merchant 30+ days with "Trust device".

Usage
=====
  # One-time setup (and whenever sessions expire)
  python3 sales_ops_import.py --setup                    # all 4 accounts
  python3 sales_ops_import.py --setup fs_noodle          # single account

  # Daily run
  python3 sales_ops_import.py --run --start 2026-04-01 --end 2026-04-14
  SCHEMA=sales_ops python3 sales_ops_import.py --run ...  # production

  # Status
  python3 sales_ops_import.py --check                    # session + DB connectivity
"""

import os
import sys
import json
import time
import argparse
import asyncio
import re
from pathlib import Path
from datetime import datetime, date, timezone, timedelta
from urllib.parse import quote

# Third-party
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from supabase import create_client, Client

# ───────────────────────── Constants ────────────────────────────────────────

SESSION_DIR = Path.home() / ".config" / "nntn" / "sessions"
ENV_FILE = Path.home() / ".config" / "nntn" / ".env"

FS_BASE = "https://owner.foodstory.co"
FS_LOGIN_URL = f"{FS_BASE}/th/login"
FS_REPORT_URL = f"{FS_BASE}/th/salebybilldetail"

GRAB_BASE = "https://api.grab.com/delvplatformapi/merchant"
GRAB_LOGIN_URL = "https://merchant.grab.com/login"
GRAB_DASHBOARD_URL = "https://merchant.grab.com/"
GRAB_MERCHANTS_API = "https://api.grab.com/food/merchant/v2/merchants"

# Accounts per COO routing msg 1493636280125493359
ACCOUNTS = [
    {
        "pos_account": "fs_noodle",
        "branch_id": "NT-NOODLE",
        "branch_name": "ร้านก๋วยเตี๋ยวเนื้อในตำนาน",
        "platform": "foodstory",
        "login_url": FS_LOGIN_URL,
        "ready_url": FS_REPORT_URL,
    },
    {
        "pos_account": "fs_kitchen",
        "branch_id": "NT-KITCHEN",
        "branch_name": "ร้านครัวเนื้อในตำนาน",
        "platform": "foodstory",
        "login_url": FS_LOGIN_URL,
        "ready_url": FS_REPORT_URL,
    },
    {
        "pos_account": "grab_noodle",
        "branch_id": "NT-NOODLE",
        "branch_name": "ร้านก๋วยเตี๋ยวเนื้อในตำนาน",
        "platform": "grab",
        "login_url": GRAB_LOGIN_URL,
        "ready_url": GRAB_DASHBOARD_URL,
    },
    {
        "pos_account": "grab_kitchen",
        "branch_id": "NT-KITCHEN",
        "branch_name": "ร้านครัวเนื้อในตำนาน",
        "platform": "grab",
        "login_url": GRAB_LOGIN_URL,
        "ready_url": GRAB_DASHBOARD_URL,
    },
]
ACCOUNT_BY_KEY = {a["pos_account"]: a for a in ACCOUNTS}

# FoodStory DataTable columns (29 fields, must match API order)
FS_COLS = [
    "date", "time", "receipt_no", "inv_no", "cash_drawer_code", "menu_code", "menu_name",
    "order_type", "quantity", "price", "total_price", "discount_value", "discounted_percent",
    "discounted_price", "is_non_vat", "channel", "table_name", "payment_customer_name",
    "phone_number", "payment_type", "payment_channel", "custom_payment_ref", "remark",
    "promotion_type_text", "menu_group_name", "category", "bill_open_by", "bill_close_by",
    "branch_name",
]

# ───────────────────────── Env & Supabase ───────────────────────────────────

def load_env() -> None:
    """Read ~/.config/nntn/.env into os.environ (simple KEY=VAL parser)."""
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get_supabase(schema: str) -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
        print(f"   Expected in {ENV_FILE} or shell env")
        sys.exit(2)
    client = create_client(url, key)
    # schema is passed per-call via client.schema(...) below
    return client

# ───────────────────────── Session storage ──────────────────────────────────

def session_path(pos_account: str) -> Path:
    return SESSION_DIR / f"{pos_account}.json"


def ensure_session_dir() -> None:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(SESSION_DIR, 0o700)
    except OSError:
        pass


def save_storage_state(context: BrowserContext, pos_account: str) -> Path:
    ensure_session_dir()
    p = session_path(pos_account)
    # Playwright sync API writes the file; async API returns the state dict
    asyncio.get_event_loop()  # sanity
    return p


async def save_context_state(context: BrowserContext, pos_account: str) -> Path:
    ensure_session_dir()
    p = session_path(pos_account)
    state = await context.storage_state()
    p.write_text(json.dumps(state, ensure_ascii=False))
    try:
        os.chmod(p, 0o600)
    except OSError:
        pass
    return p


def session_exists(pos_account: str) -> bool:
    return session_path(pos_account).exists()

# ───────────────────────── Browser helpers ──────────────────────────────────

async def _launch_browser(pw, headless: bool) -> Browser:
    """Prefer system Chrome (inherits system DNS/network); fall back to bundled Chromium."""
    try:
        return await pw.chromium.launch(headless=headless, channel="chrome")
    except Exception as e:
        print(f"    ⚠️  System Chrome unavailable ({e}); falling back to bundled Chromium")
        return await pw.chromium.launch(headless=headless)


async def setup_account(pw, account: dict) -> None:
    """Launch headed browser, navigate to login page, wait for user to sign in."""
    pos = account["pos_account"]
    print(f"\n━━━ Setup: {pos}  ({account['branch_name']})")
    print(f"    Platform: {account['platform']}")
    print(f"    Opening browser → {account['login_url']}")

    browser: Browser = await _launch_browser(pw, headless=False)
    context = await browser.new_context(
        viewport={"width": 1400, "height": 900},
        locale="th-TH",
    )
    page = await context.new_page()
    await page.goto(account["login_url"])

    print("    ➜ Please login in the browser window.")
    if account["platform"] == "grab":
        print("    ➜ Enter OTP when prompted, and check 'Trust this device' if available.")
    print("    ➜ After you see the dashboard/report page, return here.")
    input("    [Press ENTER once logged in to save session] ")

    p = await save_context_state(context, pos)
    print(f"    ✅ Session saved → {p}")

    await context.close()
    await browser.close()


async def open_context_from_session(pw, account: dict, headless: bool = True) -> tuple[Browser, BrowserContext]:
    sp = session_path(account["pos_account"])
    if not sp.exists():
        raise RuntimeError(
            f"No session for {account['pos_account']} — run: sales_ops_import.py --setup {account['pos_account']}"
        )
    browser = await _launch_browser(pw, headless=headless)
    context = await browser.new_context(
        storage_state=str(sp),
        viewport={"width": 1400, "height": 900},
        locale="th-TH",
    )
    return browser, context

# ───────────────────────── FoodStory extractor ──────────────────────────────

async def fs_fetch_items(context: BrowserContext, start_date: str, end_date: str) -> list[dict]:
    """
    Reuse captured FoodStory session to call the DataTable API.
    Returns list of raw row dicts from the API response.
    """
    page = await context.new_page()
    await page.goto(FS_REPORT_URL)

    # Extract CSRF token from meta tag
    csrf = await page.evaluate(
        "() => document.querySelector('meta[name=\"csrf-token\"]')?.content || null"
    )
    if not csrf:
        await page.close()
        raise RuntimeError("FoodStory CSRF token not found — session may be invalid")

    # Set date range via POST /api/setDate using the page's fetch (carries cookies + CSRF)
    set_date_js = f"""
    async () => {{
      const r = await fetch('{FS_BASE}/api/setDate', {{
        method: 'POST',
        credentials: 'include',
        headers: {{
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-TOKEN': '{csrf}',
          'X-Requested-With': 'XMLHttpRequest',
        }},
        body: 'start_date={start_date}&end_date={end_date}',
      }});
      return {{status: r.status, ok: r.ok}};
    }}
    """
    set_res = await page.evaluate(set_date_js)
    if not set_res.get("ok"):
        await page.close()
        raise RuntimeError(f"FoodStory setDate failed: {set_res}")

    # Fetch rows
    params_parts = [
        "draw=1", "start=0", "length=9999",
        "order[0][column]=0", "order[0][dir]=asc",
        "search[value]=", "search[regex]=false",
    ]
    for i, col in enumerate(FS_COLS):
        params_parts += [
            f"columns[{i}][data]={col}",
            f"columns[{i}][name]={col}",
            f"columns[{i}][searchable]=true",
            f"columns[{i}][orderable]=true",
            f"columns[{i}][search][value]=",
            f"columns[{i}][search][regex]=false",
        ]
    query = "&".join(params_parts)

    getdata_js = f"""
    async () => {{
      const r = await fetch('{FS_BASE}/th/salebybilldetail/getdata?{query}', {{
        credentials: 'include',
        headers: {{
          'X-CSRF-TOKEN': '{csrf}',
          'X-Requested-With': 'XMLHttpRequest',
        }},
      }});
      if (!r.ok) return {{error: 'status ' + r.status}};
      return await r.json();
    }}
    """
    result = await page.evaluate(getdata_js)
    await page.close()

    if isinstance(result, dict) and result.get("error"):
        raise RuntimeError(f"FoodStory getdata failed: {result['error']}")
    rows = result.get("data", []) if isinstance(result, dict) else []
    return rows


def fs_transform(raw_rows: list[dict], account: dict, source_month: str) -> list[dict]:
    """Map raw FS rows to sales_ops.fs_items schema."""
    def strip_html(text):
        if not text:
            return None
        clean = re.split(r"\s*<li>", text)[0].strip()
        return re.sub(r"<[^>]+>", "", clean).strip() or None

    def parse_receipt(raw):
        if not raw:
            return None
        m = re.search(r">([^<]+)</a>", raw)
        return m.group(1) if m else raw

    def parse_options(raw):
        """FoodStory returns option_name as a JSON string of arrays. Parse to native list."""
        if not raw:
            return None
        if isinstance(raw, (list, dict)):
            return raw
        try:
            parsed = json.loads(raw)
            return parsed if parsed else None
        except (json.JSONDecodeError, TypeError):
            return {"_raw": str(raw)}

    out = []
    for r in raw_rows:
        sale_date = (r.get("date") or "")[:10] or None
        if not sale_date:
            continue
        # sale_time column is TIME type; nntn_db_build stored free text
        sale_time_raw = r.get("time") or None
        sale_time = None
        if sale_time_raw:
            m = re.search(r"(\d{1,2}:\d{2}(?::\d{2})?)", sale_time_raw)
            if m:
                hms = m.group(1)
                sale_time = hms if hms.count(":") == 2 else hms + ":00"

        row = {
            "branch_id": account["branch_id"],
            "branch_name": account["branch_name"],
            "pos_account": account["pos_account"],
            "sale_date": sale_date,
            "sale_time": sale_time,
            "receipt_no": parse_receipt(r.get("receipt_no")),
            "menu_name": strip_html(r.get("menu_name")),
            "menu_name_raw": r.get("menu_name"),
            "category": r.get("category"),
            "qty": float(r.get("quantity") or 0),
            "unit_price": float(r.get("price") or 0),
            "discounted_price": float(r.get("discounted_price") or 0),
            "discount_amount": float(r.get("discount_value") or 0),
            "channel_name": r.get("channel_name") or r.get("channel"),
            "order_type": r.get("order_type"),
            "payment_type": r.get("payment_type"),
            "options_json": parse_options(r.get("option_name")),
            "source_month": source_month,
        }
        if row["menu_name"] is None:
            # skip rows without a menu name (e.g. summary lines)
            continue
        out.append(row)
    return out

# ───────────────────────── Grab extractor ───────────────────────────────────

async def grab_fetch_merchant_id(context: BrowserContext) -> str | None:
    page = await context.new_page()
    await page.goto(GRAB_DASHBOARD_URL)
    res = await page.evaluate(f"""
      async () => {{
        try {{
          const r = await fetch('{GRAB_MERCHANTS_API}', {{credentials: 'include'}});
          if (!r.ok) return null;
          return await r.json();
        }} catch(e) {{ return null; }}
      }}
    """)
    await page.close()
    if not res:
        return None
    # Response shape: {merchants: [{id, ...}]} or similar; grab first id
    if isinstance(res, dict):
        arr = res.get("merchants") or res.get("data") or []
        if arr and isinstance(arr, list):
            first = arr[0]
            return first.get("id") or first.get("merchantID")
    return None


async def grab_fetch_day_orders(page: Page, date_str: str) -> list[dict]:
    """Page through daily-pagination for one date, return list of order summaries."""
    start_enc = f"{date_str}T00%3A00%3A00%2B07%3A00"
    end_enc = f"{date_str}T23%3A59%3A59%2B07%3A00"
    results = []
    page_idx = 0
    while True:
        url = (
            f"{GRAB_BASE}/v1/reports/daily-pagination?"
            f"states=&startTime={start_enc}&endTime={end_enc}"
            f"&pageIndex={page_idx}&pageSize=50"
        )
        js = f"""
          async () => {{
            const r = await fetch('{url}', {{credentials: 'include'}});
            if (!r.ok) return {{error: 'status ' + r.status}};
            return await r.json();
          }}
        """
        d = await page.evaluate(js)
        if isinstance(d, dict) and d.get("error"):
            raise RuntimeError(f"Grab daily-pagination failed ({date_str}): {d['error']}")
        stmts = d.get("statements") or [] if isinstance(d, dict) else []
        for s in stmts:
            results.append({
                "id": s.get("ID"),
                "date": date_str,
                "status": s.get("deliveryStatus"),
                "earnings_minor": s.get("orderEarningsInMinorUnit") or 0,
            })
        if not (isinstance(d, dict) and d.get("hasMore")):
            break
        page_idx += 1
    return results


async def grab_fetch_order_details(page: Page, order_ids: list[str], batch: int = 10) -> dict[str, dict]:
    """Fetch order detail (with itemInfo) for many orderIDs in batches of N."""
    details = {}
    for i in range(0, len(order_ids), batch):
        chunk = order_ids[i:i+batch]
        js = f"""
          async (ids) => {{
            const results = await Promise.all(ids.map(async id => {{
              try {{
                const r = await fetch('{GRAB_BASE}/v3/orders/' + id, {{credentials: 'include'}});
                if (!r.ok) return {{id, error: 'status ' + r.status}};
                const d = await r.json();
                return {{id, order: d.order}};
              }} catch(e) {{ return {{id, error: e.message}}; }}
            }}));
            return results;
          }}
        """
        batch_res = await page.evaluate(js, chunk)
        for item in batch_res:
            if item.get("order"):
                details[item["id"]] = item["order"]
        print(f"      grab details: {min(i+batch, len(order_ids))}/{len(order_ids)}")
    return details


async def grab_extract(context: BrowserContext, start_date: str, end_date: str) -> dict:
    """Return {daily, items, modifiers} aggregates for the date range."""
    page = await context.new_page()
    await page.goto(GRAB_DASHBOARD_URL)

    d0 = date.fromisoformat(start_date)
    d1 = date.fromisoformat(end_date)
    days = [(d0 + timedelta(days=i)).isoformat() for i in range((d1 - d0).days + 1)]

    daily_summary = []
    all_items_by_menu = {}
    modifier_counts: dict[tuple[str, str | None, str], int] = {}

    for day in days:
        orders = await grab_fetch_day_orders(page, day)
        completed = sum(1 for o in orders if o["status"] in ("COMPLETED", "COMPLETE", "DELIVERED"))
        cancelled = sum(1 for o in orders if o["status"] in ("CANCELLED", "CANCELED"))
        revenue_thb = sum((o["earnings_minor"] or 0) for o in orders) / 100.0

        daily_summary.append({
            "sale_date": day,
            "orders_total": len(orders),
            "completed": completed,
            "cancelled": cancelled,
            "revenue_thb": revenue_thb,
            "avg_order_thb": round(revenue_thb / completed, 2) if completed else 0,
        })
        print(f"      grab {day}: {len(orders)} orders, ฿{revenue_thb:,.0f}")

        completed_ids = [o["id"] for o in orders if o["status"] in ("COMPLETED", "COMPLETE", "DELIVERED")]
        if not completed_ids:
            continue
        details = await grab_fetch_order_details(page, completed_ids)
        for order in details.values():
            items = (order.get("itemInfo") or {}).get("items") or []
            for it in items:
                name = it.get("name") or "?"
                qty = int(it.get("quantity") or 1)
                price_min = ((it.get("fare") or {}).get("priceInMin") or 0)
                revenue = (price_min * qty) / 100.0
                agg = all_items_by_menu.setdefault(name, {"qty": 0, "revenue": 0.0, "order_count": 0})
                agg["qty"] += qty
                agg["revenue"] += revenue
                agg["order_count"] += 1

                # Modifier aggregation — (menu, group, modifier) → count × qty
                for mg in (it.get("modifierGroups") or []):
                    group_name = mg.get("groupName") or mg.get("name")
                    for mod in (mg.get("modifiers") or []):
                        mod_name = mod.get("modifierName") or mod.get("name") or "?"
                        key = (name, group_name, mod_name)
                        modifier_counts[key] = modifier_counts.get(key, 0) + qty

    await page.close()
    return {
        "daily": daily_summary,
        "items": [
            {"menu_name": n, "qty": v["qty"], "revenue_thb": round(v["revenue"], 2), "order_count": v["order_count"]}
            for n, v in all_items_by_menu.items()
        ],
        "modifiers": [
            {"menu_name": k[0], "modifier_group": k[1], "modifier_name": k[2], "count": v}
            for k, v in modifier_counts.items()
        ],
    }


def grab_transform_daily(raw_daily: list[dict], account: dict, source_month: str) -> list[dict]:
    return [
        {
            "branch_id": account["branch_id"],
            "branch_name": account["branch_name"],
            "pos_account": account["pos_account"],
            "sale_date": r["sale_date"],
            "orders_total": r["orders_total"],
            "completed": r["completed"],
            "cancelled": r["cancelled"],
            "revenue_thb": r["revenue_thb"],
            "avg_order_thb": r["avg_order_thb"],
            "source_month": source_month,
        }
        for r in raw_daily
    ]


def grab_transform_items(raw_items: list[dict], account: dict, source_month: str) -> list[dict]:
    return [
        {
            "branch_id": account["branch_id"],
            "branch_name": account["branch_name"],
            "pos_account": account["pos_account"],
            "source_month": source_month,
            "menu_name": r["menu_name"],
            "qty": r["qty"],
            "revenue_thb": r["revenue_thb"],
            "order_count": r["order_count"],
        }
        for r in raw_items
    ]


def grab_transform_modifiers(raw_mods: list[dict], account: dict, source_month: str) -> list[dict]:
    return [
        {
            "branch_id": account["branch_id"],
            "branch_name": account["branch_name"],
            "pos_account": account["pos_account"],
            "source_month": source_month,
            "menu_name": r["menu_name"],
            "modifier_group": r["modifier_group"],
            "modifier_name": r["modifier_name"],
            "count": r["count"],
        }
        for r in raw_mods
    ]

# ───────────────────────── Supabase writer ──────────────────────────────────

def upsert_rows(supabase: Client, schema: str, table: str, rows: list[dict],
                delete_keys: dict | None = None, chunk: int = 500) -> int:
    """Insert rows (optionally delete first by key columns for idempotency)."""
    if not rows:
        return 0
    tbl = supabase.schema(schema).table(table)
    if delete_keys:
        q = tbl.delete()
        for k, v in delete_keys.items():
            q = q.eq(k, v)
        q.execute()
    total = 0
    for i in range(0, len(rows), chunk):
        part = rows[i:i+chunk]
        tbl.insert(part).execute()
        total += len(part)
    return total

# ───────────────────────── CLI commands ─────────────────────────────────────

def month_tag(start_date: str) -> str:
    d = date.fromisoformat(start_date)
    return f"{d.strftime('%b').upper()}{d.year}"  # e.g. APR2026


async def cmd_setup(target: str | None) -> None:
    targets = [a for a in ACCOUNTS if (target is None or a["pos_account"] == target)]
    if not targets:
        print(f"❌ Unknown account: {target}")
        print("   Valid: " + ", ".join(a["pos_account"] for a in ACCOUNTS))
        return
    print("━" * 60)
    print(f"🔐 Setup {len(targets)} account(s) — Playwright headed login")
    print("━" * 60)
    async with async_playwright() as pw:
        for acc in targets:
            try:
                await setup_account(pw, acc)
            except Exception as e:
                print(f"    ❌ Setup failed for {acc['pos_account']}: {e}")
    print("\n✅ Setup complete")


async def cmd_check() -> None:
    print("━" * 60)
    print("🔍 Session + connectivity check")
    print("━" * 60)
    # Sessions
    print("\nSessions:")
    for a in ACCOUNTS:
        p = session_path(a["pos_account"])
        mark = "✅" if p.exists() else "❌"
        mtime = (
            datetime.fromtimestamp(p.stat().st_mtime).isoformat(timespec="minutes")
            if p.exists() else "-"
        )
        print(f"  {mark} {a['pos_account']:<14} {a['branch_id']:<12} saved={mtime}")
    # Supabase
    print("\nSupabase:")
    load_env()
    schema = os.environ.get("SCHEMA", "sales_ops_test")
    try:
        sb = get_supabase(schema)
        for tbl in ("fs_items", "grab_items", "grab_daily", "grab_modifiers"):
            cnt = sb.schema(schema).table(tbl).select("id", count="exact").limit(1).execute()
            total = getattr(cnt, "count", None)
            print(f"  ✅ {schema}.{tbl:<12} rows={total}")
    except Exception as e:
        print(f"  ❌ Supabase check failed: {e}")


async def cmd_run(start_date: str, end_date: str, schema: str, only: list[str] | None,
                  test_tag: bool) -> None:
    load_env()
    sb = get_supabase(schema)
    src_month = month_tag(start_date)
    if test_tag:
        src_month = f"{src_month}-TEST-{datetime.now().strftime('%H%M%S')}"

    targets = ACCOUNTS if not only else [a for a in ACCOUNTS if a["pos_account"] in only]
    if not targets:
        print(f"❌ No matching accounts in --only={only}")
        return

    print("━" * 60)
    print(f"🚀 Run — {start_date} → {end_date}")
    print(f"    schema       = {schema}")
    print(f"    source_month = {src_month}")
    print(f"    accounts     = {', '.join(a['pos_account'] for a in targets)}")
    print("━" * 60)

    async with async_playwright() as pw:
        for acc in targets:
            pos = acc["pos_account"]
            print(f"\n[{pos}] starting…")
            if not session_exists(pos):
                print(f"  ⚠️  no session — run: --setup {pos}")
                continue

            try:
                browser, context = await open_context_from_session(pw, acc, headless=True)
            except Exception as e:
                print(f"  ❌ cannot open context: {e}")
                continue

            try:
                if acc["platform"] == "foodstory":
                    raw = await fs_fetch_items(context, start_date, end_date)
                    rows = fs_transform(raw, acc, src_month)
                    print(f"  fetched {len(raw)} raw rows → {len(rows)} normalized")
                    n = upsert_rows(
                        sb, schema, "fs_items", rows,
                        delete_keys={"pos_account": pos, "source_month": src_month},
                    )
                    print(f"  ✅ upserted {n} → {schema}.fs_items")

                elif acc["platform"] == "grab":
                    agg = await grab_extract(context, start_date, end_date)
                    daily_rows = grab_transform_daily(agg["daily"], acc, src_month)
                    item_rows = grab_transform_items(agg["items"], acc, src_month)
                    mod_rows = grab_transform_modifiers(agg["modifiers"], acc, src_month)
                    nd = upsert_rows(
                        sb, schema, "grab_daily", daily_rows,
                        delete_keys={"pos_account": pos, "source_month": src_month},
                    )
                    ni = upsert_rows(
                        sb, schema, "grab_items", item_rows,
                        delete_keys={"pos_account": pos, "source_month": src_month},
                    )
                    nm = upsert_rows(
                        sb, schema, "grab_modifiers", mod_rows,
                        delete_keys={"pos_account": pos, "source_month": src_month},
                    )
                    print(f"  ✅ upserted {nd} → grab_daily, {ni} → grab_items, {nm} → grab_modifiers")

                # Refresh storage_state (capture any cookie rotation)
                await save_context_state(context, pos)
            except Exception as e:
                print(f"  ❌ {pos} failed: {e}")
            finally:
                await context.close()
                await browser.close()

    print("\n━" * 60)
    print(f"✅ Run complete — source_month={src_month}")
    print("━" * 60)

# ───────────────────────── Entry point ──────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description="NNTN Sales Ops P3 import pipeline")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--setup", nargs="?", const="__all__",
                      help="Run interactive login for all 4 accounts, or a specific pos_account")
    mode.add_argument("--run", action="store_true", help="Extract data and upsert to Supabase")
    mode.add_argument("--check", action="store_true", help="Check sessions and DB connectivity")

    ap.add_argument("--start", help="Start date YYYY-MM-DD (--run)")
    ap.add_argument("--end", help="End date YYYY-MM-DD (--run)")
    ap.add_argument("--schema", default=os.environ.get("SCHEMA", "sales_ops_test"),
                    help="Target schema (default: env SCHEMA or sales_ops_test)")
    ap.add_argument("--only", help="Comma-separated pos_account(s) to run")
    ap.add_argument("--test-tag", action="store_true",
                    help="Suffix source_month with -TEST-<hhmmss> for safer dev runs")

    args = ap.parse_args()

    if args.setup is not None:
        target = None if args.setup == "__all__" else args.setup
        asyncio.run(cmd_setup(target))
        return 0

    if args.check:
        asyncio.run(cmd_check())
        return 0

    if args.run:
        if not args.start or not args.end:
            print("❌ --run requires --start and --end")
            return 2
        only = args.only.split(",") if args.only else None
        asyncio.run(cmd_run(args.start, args.end, args.schema, only, args.test_tag))
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
