#!/usr/bin/env python3
"""
NNTN Architecture Catalog Generator
===================================
Scans non-meat-stock/**/*.html for:
- <script src="..."> imports
- Supabase REST calls: /rest/v1/<table>
- RPC calls: /rest/v1/rpc/<fn>
- Edge functions: /functions/v1/<fn>
- Title, line count

Outputs auto-generated Markdown catalog to:
  ~/Documents/NNTN-Vault/System/architecture/module-catalog.md

Run:
  python3 scripts/gen_arch.py

This is safe to run anytime — overwrites the catalog file.
Do not edit module-catalog.md by hand; all edits belong in
roadmap.md / tech-debt.md / rewrite-plan.md instead.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

REPO_DIR = Path(__file__).resolve().parent.parent
OUT_FILE = (
    Path.home()
    / "Documents"
    / "NNTN-Vault"
    / "System"
    / "architecture"
    / "module-catalog.md"
)

# Folders to skip (different sub-projects / legacy / generated output)
SKIP_DIRS = {"cookingbook", "node_modules", "playwright-report", "test-results"}


def scan_html(path: Path) -> dict | None:
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return None

    # <script src="..."> (exclude CDN / http)
    scripts = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', content)
    local_scripts = [s for s in scripts if not s.startswith(("http", "//"))]

    # /rest/v1/<table>  — exclude /rpc/
    tables = set()
    for m in re.finditer(r"/rest/v1/([a-zA-Z_][a-zA-Z0-9_]*)", content):
        name = m.group(1)
        if name != "rpc":
            tables.add(name)

    # /rest/v1/rpc/<fn>
    rpcs = set(re.findall(r"/rest/v1/rpc/([a-zA-Z_][a-zA-Z0-9_]*)", content))

    # /functions/v1/<fn>
    edges = set(re.findall(r"/functions/v1/([a-zA-Z_][a-zA-Z0-9_\-]*)", content))

    # Page title
    title_match = re.search(r"<title>([^<]+)</title>", content)
    title = title_match.group(1).strip() if title_match else "—"

    # Rough size metric
    loc = content.count("\n") + 1

    return {
        "title": title,
        "scripts": local_scripts,
        "tables": sorted(tables),
        "rpcs": sorted(rpcs),
        "edges": sorted(edges),
        "loc": loc,
    }


def main() -> int:
    html_files: list[Path] = []
    for p in sorted(REPO_DIR.rglob("*.html")):
        # Skip anything inside SKIP_DIRS
        if any(part in SKIP_DIRS for part in p.relative_to(REPO_DIR).parts):
            continue
        html_files.append(p)

    rows: list[tuple[str, dict]] = []
    for f in html_files:
        data = scan_html(f)
        if not data:
            continue
        rel = f.relative_to(REPO_DIR).as_posix()
        rows.append((rel, data))

    # Collect aggregates
    all_tables: dict[str, list[str]] = {}
    all_rpcs: dict[str, list[str]] = {}
    all_edges: dict[str, list[str]] = {}
    all_scripts: dict[str, list[str]] = {}

    for rel, d in rows:
        for t in d["tables"]:
            all_tables.setdefault(t, []).append(rel)
        for r in d["rpcs"]:
            all_rpcs.setdefault(r, []).append(rel)
        for e in d["edges"]:
            all_edges.setdefault(e, []).append(rel)
        for s in d["scripts"]:
            all_scripts.setdefault(s, []).append(rel)

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    md: list[str] = []
    md.append("# NNTN Module Catalog (auto-generated)")
    md.append("")
    md.append(f"> **Generated:** {now}  ")
    md.append(f"> **Source:** `non-meat-stock/scripts/gen_arch.py`  ")
    md.append(f"> **Scope:** `non-meat-stock/` HTML pages (excl. {', '.join(sorted(SKIP_DIRS))})  ")
    md.append("> ")
    md.append("> ⚠️ **Do not edit by hand** — run `python3 scripts/gen_arch.py` to regenerate.  ")
    md.append("> Manual architecture notes belong in `roadmap.md` / `tech-debt.md` / `rewrite-plan.md`.")
    md.append("")

    # --- Summary ---
    md.append("## Summary")
    md.append("")
    md.append(f"- **Modules (HTML pages):** {len(rows)}")
    md.append(f"- **Supabase tables referenced:** {len(all_tables)}")
    md.append(f"- **RPC functions:** {len(all_rpcs)}")
    md.append(f"- **Edge functions:** {len(all_edges)}")
    md.append(f"- **Shared scripts:** {len(all_scripts)}")
    md.append("")

    # --- Module catalog ---
    md.append(f"## Module Catalog")
    md.append("")
    md.append("| Page | Title | LoC | Scripts | Tables | RPC | Edge |")
    md.append("|------|-------|----:|---------|--------|-----|------|")
    for rel, d in rows:
        scripts = ", ".join(f"`{s}`" for s in d["scripts"]) or "—"
        tables = ", ".join(f"`{t}`" for t in d["tables"]) or "—"
        rpcs = ", ".join(f"`{r}`" for r in d["rpcs"]) or "—"
        edges = ", ".join(f"`{e}`" for e in d["edges"]) or "—"
        title = d["title"].replace("|", "\\|")
        md.append(f"| `{rel}` | {title} | {d['loc']} | {scripts} | {tables} | {rpcs} | {edges} |")
    md.append("")

    # --- Data layer ---
    md.append("## Data Layer — Tables")
    md.append("")
    if not all_tables:
        md.append("_No tables detected._")
    else:
        md.append("| Table | # consumers | Pages |")
        md.append("|-------|------------:|-------|")
        for t, consumers in sorted(all_tables.items()):
            pages = ", ".join(f"`{p}`" for p in consumers)
            md.append(f"| `{t}` | {len(consumers)} | {pages} |")
    md.append("")

    # --- RPC ---
    if all_rpcs:
        md.append("## RPC Functions")
        md.append("")
        md.append("| Function | # consumers | Pages |")
        md.append("|----------|------------:|-------|")
        for r, consumers in sorted(all_rpcs.items()):
            pages = ", ".join(f"`{p}`" for p in consumers)
            md.append(f"| `{r}` | {len(consumers)} | {pages} |")
        md.append("")

    # --- Edge fn ---
    if all_edges:
        md.append("## Edge Functions")
        md.append("")
        md.append("| Function | # consumers | Pages |")
        md.append("|----------|------------:|-------|")
        for e, consumers in sorted(all_edges.items()):
            pages = ", ".join(f"`{p}`" for p in consumers)
            md.append(f"| `{e}` | {len(consumers)} | {pages} |")
        md.append("")

    # --- Shared scripts ---
    md.append("## Shared Scripts")
    md.append("")
    if not all_scripts:
        md.append("_No shared scripts detected._")
    else:
        md.append("| Script | # importers | Pages |")
        md.append("|--------|------------:|-------|")
        for s, consumers in sorted(all_scripts.items()):
            pages = ", ".join(f"`{p}`" for p in consumers)
            md.append(f"| `{s}` | {len(consumers)} | {pages} |")
    md.append("")

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text("\n".join(md), encoding="utf-8")
    print(
        f"✅ Wrote {OUT_FILE}\n"
        f"   {len(rows)} modules | {len(all_tables)} tables | "
        f"{len(all_rpcs)} rpcs | {len(all_edges)} edge fns"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
