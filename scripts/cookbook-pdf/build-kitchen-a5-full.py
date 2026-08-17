#!/usr/bin/env python3
"""Build the approved 78-source-row A5 landscape kitchen book."""

import json
import os
from pathlib import Path
import re
import sys

from kitchen_a5_preview import DATA, FULL_OUTPUT, render_full_book


os.environ.setdefault("OPENSSL_CONF", "/dev/null")
if Path("/private/tmp/ms-playwright").exists():
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/private/tmp/ms-playwright")

WORK = Path(__file__).resolve().parent
SOURCE = FULL_OUTPUT
OUT = WORK / "out" / "ตำราครัว-NNTN-ฉบับพนักงาน-A5แนวนอน-78สูตร.pdf"


def weasyprint_compatible_html(html: str) -> str:
    """Keep the approved browser stack; embed readable Latin numerals for WeasyPrint."""
    font_dir = next(
        path
        for root in (Path("/opt/homebrew/lib"), Path("/usr/local/lib"))
        for path in root.glob("python*/site-packages/matplotlib/mpl-data/fonts/ttf")
        if (path / "DejaVuSans.ttf").exists() and (path / "DejaVuSans-Bold.ttf").exists()
    )
    compatible = html.replace(
        "font-family: -apple-system, Helvetica, Arial, sans-serif;",
        'font-family: "Step Numeral", sans-serif;',
    )
    font_faces = f'''
    @font-face {{
      font-family: "Step Numeral";
      src: url("{(font_dir / 'DejaVuSans.ttf').as_uri()}") format("truetype");
      font-weight: 400;
    }}
    @font-face {{
      font-family: "Step Numeral";
      src: url("{(font_dir / 'DejaVuSans-Bold.ttf').as_uri()}") format("truetype");
      font-weight: 700;
    }}
    '''
    return compatible.replace("</style>", f"{font_faces}</style>", 1)


def render_with_playwright() -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(locale="th-TH")
        page.goto(SOURCE.as_uri(), wait_until="networkidle")
        page.pdf(
            path=str(OUT),
            print_background=True,
            prefer_css_page_size=True,
            display_header_footer=False,
        )
        browser.close()


def render_with_weasyprint() -> None:
    for local_deps in (Path("/private/tmp/pydeps66"), Path("/private/tmp/pydeps")):
        if local_deps.exists():
            sys.path.insert(0, str(local_deps))
            break
    from weasyprint import HTML

    imposed_html = SOURCE.read_text(encoding="utf-8")
    imposed_html = re.sub(
        r'<header class="screen-bar">.*?</header>',
        "",
        imposed_html,
        count=1,
        flags=re.DOTALL,
    )
    imposed_html = weasyprint_compatible_html(imposed_html)
    runner_font = Path("/private/tmp/NotoSansThai.ttf")
    if runner_font.exists():
        imposed_html = re.sub(
            r'file:///System/Library/Fonts/Supplemental/Tahoma(?:%20| )?(?:Bold)?\.ttf',
            runner_font.as_uri(),
            imposed_html,
        )
    HTML(string=imposed_html, base_url=str(WORK)).write_pdf(OUT)


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    SOURCE.write_text(render_full_book(data), encoding="utf-8")
    OUT.parent.mkdir(exist_ok=True)
    try:
        render_with_playwright()
        renderer = "Playwright Chromium"
    except Exception as playwright_error:
        print(f"Playwright ใช้ไม่ได้ใน runner นี้: {playwright_error.__class__.__name__}")
        try:
            render_with_weasyprint()
            renderer = "WeasyPrint fallback"
        except Exception as weasyprint_error:
            raise SystemExit(
                "เรนเดอร์ไม่ได้ทั้ง Playwright และ WeasyPrint: "
                f"{weasyprint_error}"
            ) from weasyprint_error
    if not OUT.exists():
        raise SystemExit("ตัวเรนเดอร์ไม่ได้สร้าง PDF")
    print(OUT)
    print(f"{OUT.stat().st_size} bytes")
    print(renderer)


if __name__ == "__main__":
    main()
