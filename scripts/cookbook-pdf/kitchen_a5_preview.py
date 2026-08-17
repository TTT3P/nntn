#!/usr/bin/env python3
"""Compose the approved A5 landscape kitchen-book preview from exported cookbook JSON."""

from __future__ import annotations

from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from typing import Any


WORK = Path(__file__).resolve().parent
DATA = WORK / "cookbook-data.json"
OUTPUT = WORK / "cookbook-kitchen-a5-template.html"
FULL_OUTPUT = WORK / "cookbook-kitchen-a5-full.html"
CATEGORY = "ข้าว/จานเดียว"

# ลำดับส่วนเมนูยึดยอดขาย 21 อันดับแรกก่อน แล้วจึงต่อด้วยหมวดที่เหลือ
# RCP-068 ไม่มีในเอกสารสรุป แต่มีจริงใน export และทำให้จำนวนเมนูหลักครบ 44 รายการ
MENU_ORDER = (
    "RCP-021", "RCP-053", "RCP-023", "RCP-039", "RCP-055", "RCP-022",
    "RCP-018", "RCP-070", "RCP-011", "RCP-052", "RCP-071", "RCP-069",
    "RCP-025", "RCP-027", "RCP-051", "RCP-019", "RCP-054", "RCP-017E",
    "RCP-057", "RCP-058", "RCP-056",
    "RCP-017A", "RCP-017B", "RCP-017C", "RCP-017D",
    "RCP-043", "RCP-044", "RCP-045", "RCP-046", "RCP-047", "RCP-048",
    "RCP-059", "RCP-060", "RCP-061", "RCP-062", "RCP-063",
    "RCP-030", "RCP-031", "RCP-032", "RCP-033",
    "RCP-024", "RCP-041", "RCP-049", "RCP-068",
)
KAPRAO_CODES = frozenset({
    "RCP-017A", "RCP-017B", "RCP-017C", "RCP-017D", "RCP-017E",
    "RCP-052", "RCP-053", "RCP-054",
})
NOODLE_SIZE_CODES = frozenset({"RCP-044", "RCP-045", "RCP-046", "RCP-047"})
MEATBALL_CODES = frozenset({"RCP-057"})


def select_glass_variants(data: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        recipe
        for recipe in data["recipes"]
        if recipe.get("type") == "menu" and str(recipe.get("rcp_code") or "").endswith("-M")
    ]


def select_support_recipes(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return actual prep/sub rows; GLASS menu variants remain a separate DB class."""
    return [recipe for recipe in data["recipes"] if recipe.get("type") in {"prep", "sub"}]


def select_support_section_recipes(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return only the 34 prep/sub records approved for the book's tail section."""
    result = sorted(
        select_support_recipes(data),
        key=lambda recipe: ((recipe.get("category") or ""), clean_name(recipe["name"])),
    )
    if len(result) != 34:
        raise ValueError(f"ส่วนซอส/ของเตรียมต้องมี 34 รายการ แต่พบ {len(result)}")
    return result


def ordered_menu_recipes(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the 44 canonical menu records in the approved sales-first order."""
    canonical = {
        recipe["rcp_code"]: recipe
        for recipe in data["recipes"]
        if recipe.get("type") == "menu"
        and not str(recipe.get("rcp_code") or "").endswith("-M")
    }
    expected = set(MENU_ORDER)
    missing = expected - canonical.keys()
    extra = canonical.keys() - expected
    if missing or extra:
        raise ValueError(
            "รายการเมนูใน export ไม่ตรงกับลำดับที่ตรวจแล้ว: "
            f"ขาด={sorted(missing)} เกิน={sorted(extra)}"
        )
    if len(MENU_ORDER) != 44 or len(expected) != 44:
        raise AssertionError("ลำดับเมนูหลักต้องมี 44 รหัสและห้ามซ้ำ")
    return [canonical[code] for code in MENU_ORDER]


def consolidated_menu_entries(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Collapse related menus into one method heading while preserving every source row."""
    ordered = ordered_menu_recipes(data)
    recipe_by_code = {recipe["rcp_code"]: recipe for recipe in ordered}
    groups = (
        ("kaprao", KAPRAO_CODES),
        ("noodle_sizes", NOODLE_SIZE_CODES),
        ("meatball_sizes", MEATBALL_CODES),
    )
    emitted: set[str] = set()
    entries: list[dict[str, Any]] = []
    for recipe in ordered:
        code = recipe["rcp_code"]
        family = next(((kind, codes) for kind, codes in groups if code in codes), None)
        if family:
            kind, family_codes = family
            if kind in emitted:
                continue
            member_codes = [item for item in MENU_ORDER if item in family_codes]
            entry = {
                "kind": kind,
                "codes": member_codes,
                "recipes": [recipe_by_code[item] for item in member_codes],
                "representative": recipe,
            }
            if kind == "meatball_sizes":
                # Export มีเพียงสูตร RCP-057; อย่าสร้างสูตรไซส์ที่ไม่มีในฐานข้อมูล
                entry["has_separate_size_record"] = len(member_codes) > 1
            entries.append(entry)
            emitted.add(kind)
        else:
            entries.append({
                "kind": "single",
                "codes": [code],
                "recipes": [recipe],
                "representative": recipe,
            })
    covered = [code for entry in entries for code in entry["codes"]]
    if len(covered) != 44 or set(covered) != set(MENU_ORDER):
        raise AssertionError("การยุบรวมต้องครอบคลุมเมนูหลักทั้ง 44 รายการครั้งเดียว")
    return entries


def select_preview_recipes(data: dict[str, Any]) -> list[dict[str, Any]]:
    recipes = [
        recipe
        for recipe in ordered_menu_recipes(data)
        if (recipe.get("category") or "").strip() == CATEGORY
    ]
    if len(recipes) != 12:
        raise ValueError(f"หมวด {CATEGORY} ที่ไม่ใช่รุ่น GLASS ต้องมี 12 สูตร แต่พบ {len(recipes)}")
    return recipes


def _number(value: float) -> str:
    if abs(value - round(value)) < 0.01:
        return str(int(round(value)))
    fractions = {
        0.125: "1/8",
        0.25: "1/4",
        0.5: "ครึ่ง",
        0.75: "3/4",
        1.5: "1 ครึ่ง",
    }
    for target, label in fractions.items():
        if abs(value - target) < 0.02:
            return label
    return f"{value:.1f}".rstrip("0").rstrip(".")


def _spoon(value: float, kind: str) -> str:
    label = _number(value)
    if label == "ครึ่ง":
        return f"ครึ่ง{kind}"
    return f"{label} {kind}"


def _from_ml(value: float) -> str:
    if value >= 15:
        tablespoons = int(value // 15)
        remainder = value - tablespoons * 15
        if abs(remainder) < 0.01:
            return _spoon(float(tablespoons), "ช้อนโต๊ะ")
        teaspoons = remainder / 5
        return f"{_spoon(float(tablespoons), 'ช้อนโต๊ะ')} + {_spoon(teaspoons, 'ช้อนชา')}"
    if abs(value - 7.5) < 0.01:
        return "ครึ่งช้อนโต๊ะ"
    return _spoon(value / 5, "ช้อนชา")


def _explicit_spoon(note: str) -> str | None:
    note = note or ""
    combined = re.search(r"(\d+(?:\.\d+)?)\s*ช้อนโต๊ะ\s*\+\s*(\d+(?:\.\d+)?)\s*ช้อนชา", note)
    if combined:
        return f"{_spoon(float(combined.group(1)), 'ช้อนโต๊ะ')} + {_spoon(float(combined.group(2)), 'ช้อนชา')}"
    half_tbsp = re.search(r"(?:½|1/2)\s*ช้อนโต๊ะ", note)
    if half_tbsp:
        return "ครึ่งช้อนโต๊ะ"
    teaspoons = re.search(r"(?<![/\d])([1-9]\d*(?:\.\d+)?)\s*ช้อนชา", note)
    if teaspoons:
        return _spoon(float(teaspoons.group(1)), "ช้อนชา")
    tablespoons = re.search(r"(?<![/\d])([1-9]\d*(?:\.\d+)?)\s*ช้อนโต๊ะ", note)
    if tablespoons:
        return _spoon(float(tablespoons.group(1)), "ช้อนโต๊ะ")
    return None


def format_quantity(name: str, qty: float | int | None, unit: str | None, note: str | None) -> str:
    if qty is None:
        return "ไม่ระบุปริมาณ"
    value = float(qty)
    unit = (unit or "g").strip().lower()
    note = note or ""

    explicit = _explicit_spoon(note)
    if explicit:
        return explicit
    if unit in {"ml", "มล", "มล."}:
        return _from_ml(value)
    if unit in {"ฟอง", "ใบ"}:
        return f"{_number(value)} ฟอง"
    if unit in {"portion", "serving", "ชุด"}:
        return f"{_number(value)} ชุด"

    density_per_teaspoon = None
    if "น้ำมันพืช" in name:
        density_per_teaspoon = 14 / 3
    elif "น้ำตาลทรายไม่ขัดสี" in name:
        density_per_teaspoon = 4
    elif "ผงชูรส" in name:
        density_per_teaspoon = 4
    elif "น้ำปลา" in name:
        density_per_teaspoon = 6
    elif "ซอสกะเพรา" in name:
        density_per_teaspoon = 10
    elif "ผงลาบ" in name:
        density_per_teaspoon = 3

    if density_per_teaspoon:
        teaspoons = value / density_per_teaspoon
        if teaspoons >= 3 and abs(teaspoons % 3) < 0.02:
            return _spoon(teaspoons / 3, "ช้อนโต๊ะ")
        return _spoon(teaspoons, "ช้อนชา")
    if "น้ำมะนาว" in name and abs(value - 5) < 0.25:
        return "ประมาณ 1 ช้อนชา"
    return f"(ใช้ตาชั่ง) {_number(value)} กรัม"


QUANTITY_OVERRIDES = {
    ("RCP-011", 3): "2 ช้อนชา",
    ("RCP-027", 10): "0.8 ช้อนชา",
    ("RCP-039", 4): "1 ช้อนโต๊ะ + 1 ช้อนชา",
    ("RCP-069", 1): "3 ช้อนโต๊ะ",
    ("RCP-069", 2): "1 ชุด",
}


STEP_OVERRIDES = {
    "RCP-023": """ข้าวคลุกซอสกะเพรา:
1. ตั้งกระทะ ใส่น้ำมัน 1 ช้อนชา รอให้ร้อน
2. ใส่ข้าวสวยและซอสกะเพรา 1 ช้อน ผัดให้ทั่ว
3. ใส่ใบกะเพรา 1 หยิบมือ ผัดเร็วๆ ให้สลด แล้วปิดไฟ

การเตรียมพิคานย่า:
1. ตั้งกระทะไฟแรงจนร้อนจัด
2. จี่ด้านมันจนเป็นสีน้ำตาล พลิกจี่แต่ละด้าน 30–40 วินาที
3. พักเนื้อ 3 นาที แล้วหั่นชิ้นบาง

การจัดเสิร์ฟ: ตักข้าวใส่จาน วางเนื้อด้านข้าง
เครื่องเคียง: แตงกวา 3 ชิ้น · พริกน้ำปลา 1 ถ้วย""",
}


def clean_name(name: str) -> str:
    name = re.sub(r"^\[[^\]]+\]\s*", "", name or "")
    name = re.sub(r"\[\s*\d+(?:\.\d+)?\s*g\s*\]$", "", name, flags=re.IGNORECASE)
    name = name.replace(" [GLASS]", "")
    replacements = {
        "ไข่ไก่ยกแผง (แผง)": "ไข่ไก่",
        "ข้าวหอมมะลิ M (200g สุก)": "ข้าวหอมมะลิ 200 กรัม (สุก)",
        "ข้าวหอมมะลิ ตราฉัตร (ใหม่ 100%)": "ข้าวหอมมะลิ",
        "ข้าวญี่ปุ่นซาซานิชิกิ (โอริชุรุ)": "ข้าวญี่ปุ่น",
        "ซอสถั่วเหลือง (คิคโคแมน)": "ซอสถั่วเหลือง",
        "มิริน (ซีซ่า)": "มิริน",
        "ชิโรดาชิ (คิคโคแมน)": "ชิโรดาชิ",
        "ฮอนสึยุ (คิคโคแมน)": "ฮอนสึยุ",
        "สาเก (Mizkan)": "สาเก",
        "พริกป่นญี่ปุ่น 7 ชนิด (S&B)": "พริกป่นญี่ปุ่น",
        "ขิงดองสีแดงญี่ปุ่น / Beni Shoga": "ขิงดองแดง",
        "เกาเหลาเนื้อตุ๋น (M-tier AVG)": "เกาเหลาเนื้อตุ๋น",
        "ซอสลับ (v2)": "ซอสลับ",
        "น้ำสต๊อกเนื้อ (Beef Stock)": "น้ำสต๊อกเนื้อ",
        "เนื้อสะเต๊ะ 1 set (10 ไม้)": "เนื้อสะเต๊ะ 1 ชุด (10 ไม้)",
        "คนอร์ ซุปรสไก่ก้อน (Broth Base)": "คนอร์ ซุปรสไก่ก้อน",
    }
    name = replacements.get(name, name)
    name = re.sub(r"(?<=\d)\s*ml\b", " มล.", name, flags=re.IGNORECASE)
    name = re.sub(r"(?<=\d)\s*g\b", " กรัม", name, flags=re.IGNORECASE)
    return name


def consolidation_tables(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Build the future book's variation tables from BOM rows without guessed values."""
    recipe_by_code = {recipe["rcp_code"]: recipe for recipe in data["recipes"]}
    ingredient_by_id = {ingredient["id"]: ingredient["name"] for ingredient in data["ings"]}
    recipe_name_by_id = {recipe["id"]: recipe["name"] for recipe in data["recipes"]}

    def rows_for(code: str) -> list[dict[str, Any]]:
        recipe = recipe_by_code[code]
        return sorted(
            (row for row in data["bom"] if row["recipe_id"] == recipe["id"]),
            key=lambda row: row.get("line_no") or 0,
        )

    def row_name(row: dict[str, Any]) -> str:
        if row.get("sub_recipe_id"):
            return clean_name(recipe_name_by_id[row["sub_recipe_id"]])
        return clean_name(ingredient_by_id[row["ingredient_id"]])

    kaprao_rows: list[dict[str, Any]] = []
    for code in (item for item in MENU_ORDER if item in KAPRAO_CODES):
        recipe = recipe_by_code[code]
        bom = rows_for(code)
        protein = next(row for row in bom if row.get("line_no") == 4)
        oil = next(row for row in bom if row.get("line_no") == 3)
        rice = next((row for row in bom if row.get("line_no") == 8), None)
        kaprao_rows.append({
            "code": code,
            "menu": clean_name(recipe["name"]),
            "protein": row_name(protein),
            "protein_quantity": format_quantity(
                row_name(protein), protein.get("qty_g"), protein.get("unit"), protein.get("note")
            ),
            "oil_quantity": format_quantity(
                row_name(oil), oil.get("qty_g"), oil.get("unit"), oil.get("note")
            ),
            "rice_quantity": (
                format_quantity(row_name(rice), rice.get("qty_g"), rice.get("unit"), rice.get("note"))
                if rice else "ไม่มีข้าว"
            ),
        })

    noodle_rows: list[dict[str, Any]] = []
    for code in (item for item in MENU_ORDER if item in NOODLE_SIZE_CODES):
        recipe = recipe_by_code[code]
        size_match = re.search(r"\b(S|M|L|XL)\s*\((\d+)u\)", recipe["name"])
        if not size_match:
            raise ValueError(f"อ่านไซส์ก๋วยเตี๋ยวจากชื่อไม่ได้: {recipe['name']}")
        protein = next(row for row in rows_for(code) if row.get("line_no") == 9)
        noodle_rows.append({
            "code": code,
            "size": size_match.group(1),
            "units": int(size_match.group(2)),
            "protein_quantity": format_quantity(
                row_name(protein), protein.get("qty_g"), protein.get("unit"), protein.get("note")
            ),
        })

    meatball_recipe = recipe_by_code["RCP-057"]
    meatball = rows_for("RCP-057")[0]
    note = meatball.get("note") or ""
    sticks_match = re.search(r"(\d+)\s*ไม้", note)
    if not sticks_match:
        raise ValueError("ข้อมูลลูกชิ้นไม่มีจำนวนไม้ที่ยืนยันใน BOM")

    return {
        "kaprao": {"method_count": 1, "rows": kaprao_rows},
        "noodle_sizes": {"method_count": 1, "rows": noodle_rows},
        "meatball_sizes": {
            "method_count": 1,
            "rows": [{
                "code": meatball_recipe["rcp_code"],
                "size": "ปกติ",
                "sticks": int(sticks_match.group(1)),
                "quantity": format_quantity(
                    row_name(meatball), meatball.get("qty_g"), meatball.get("unit"), note
                ),
            }],
            "pending_note": "รุ่น 2 ไม้ถูกระบุว่าเพิ่มทีหลัง แต่ยังไม่มีสูตรแยกใน export จึงไม่เดาปริมาณ",
        },
    }


def clean_steps(text: str | None) -> str | None:
    if not text or not text.strip():
        return None
    text = text.strip()
    text = text.replace("½", "ครึ่ง")
    text = text.replace(" → ", " แล้ว")
    text = re.sub(r"ขีดบอก\s*ml\b", "ขีดบอกปริมาตร", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\bbatch\b", "ชุดผสม", text, flags=re.IGNORECASE)
    text = re.sub(r"\bS?RCP-\d+(?:-[A-Z0-9]+)?\b", "", text)
    text = text.replace("BOM", "รายการวัตถุดิบ")
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s*\(\s*\d+(?:\.\d+)?\s*g\s*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(?<!\()(?<!ชั่ง )(?<!ตาชั่ง )\b(\d+(?:\.\d+)?)\s*g\b", r"(ใช้ตาชั่ง) \1 กรัม", text)
    text = re.sub(r"(?<!\(ใช้ตาชั่ง\) )\b(\d+(?:\.\d+)?)\s*กรัม\b", r"(ใช้ตาชั่ง) \1 กรัม", text)
    text = re.sub(r"\b(\d+(?:\.\d+)?)\s*ml\b", lambda m: _from_ml(float(m.group(1))), text, flags=re.IGNORECASE)
    text = re.sub(r"\b(\d+(?:\.\d+)?)\s*มล\.?", lambda m: _from_ml(float(m.group(1))), text)
    text = re.sub(r"\s+·\s+หมายเหตุ:.*$", "", text, flags=re.DOTALL)
    text = re.sub(r"\n\(?หมายเหตุ:.*$", "", text, flags=re.DOTALL)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def _steps_html(text: str | None) -> str:
    cleaned = clean_steps(text)
    if not cleaned:
        return (
            '<div class="no-steps"><strong>ยังไม่มีวิธีทำที่ครัวยืนยัน</strong>'
            '<span>แสดงตามข้อมูลจริงโดยไม่แต่งขั้นตอนเพิ่ม</span></div>'
        )
    parts: list[str] = []
    for raw_line in cleaned.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        numbered = re.match(r"(\d+)\.\s*(.*)", line)
        if numbered:
            parts.append(
                '<div class="step"><span class="step-number">'
                f'{escape(numbered.group(1))}</span><p>{escape(numbered.group(2))}</p></div>'
            )
        elif line.endswith(":"):
            parts.append(f'<h3 class="method-subhead">{escape(line[:-1])}</h3>')
        else:
            parts.append(f'<p class="method-note">{escape(line)}</p>')
    return "".join(parts)


def _ingredient_rows(
    recipe: dict[str, Any],
    data: dict[str, Any],
    ingredient_map: dict[int, str],
    recipe_map: dict[int, str],
) -> str:
    rows = []
    bom = sorted(
        (row for row in data["bom"] if row["recipe_id"] == recipe["id"]),
        key=lambda row: row.get("line_no") or 0,
    )
    for row in bom:
        if row.get("sub_recipe_id"):
            name = recipe_map.get(row["sub_recipe_id"], "ของเตรียม")
        else:
            name = ingredient_map.get(row.get("ingredient_id"), "วัตถุดิบ")
        name = clean_name(name)
        override = QUANTITY_OVERRIDES.get((recipe["rcp_code"], row.get("line_no")))
        amount = override or format_quantity(name, row.get("qty_g"), row.get("unit"), row.get("note"))
        rows.append(f"<tr><td>{escape(name)}</td><td>{escape(amount)}</td></tr>")
    return "".join(rows)


def _recipe_page(
    page_number: int,
    recipe: dict[str, Any],
    data: dict[str, Any],
    ingredient_map: dict[int, str],
    recipe_map: dict[int, str],
    sop_map: dict[int, str | None],
    category_label: str | None = None,
    source_count: int = 1,
) -> str:
    name = clean_name(recipe["name"])
    rows = _ingredient_rows(recipe, data, ingredient_map, recipe_map)
    source_steps = STEP_OVERRIDES.get(recipe["rcp_code"], sop_map.get(recipe["id"]))
    steps = _steps_html(source_steps)
    bom_count = sum(1 for row in data["bom"] if row["recipe_id"] == recipe["id"])
    dense = " dense" if bom_count >= 10 or len(clean_steps(source_steps) or "") > 650 else ""
    if recipe.get("type") in {"prep", "sub"}:
        batch = recipe.get("batch_size_g")
        serving = f"ได้ประมาณ {_number(float(batch))} กรัม" if batch else "สูตรเตรียม"
    else:
        serving = f"สำหรับ 1 {clean_name(recipe.get('unit') or 'จาน')}"
    category = category_label or clean_name(recipe.get("category") or "สูตรครัว")
    return f'''
    <article class="logical-page recipe-page{dense}" data-page="{page_number}" data-page-kind="recipe" data-source-count="{source_count}">
      <header class="recipe-header">
        <div><span class="category-name">{escape(category)}</span><h2>{escape(name)}</h2></div>
        <span class="serving">{escape(serving)}</span>
      </header>
      <div class="recipe-columns">
        <section class="ingredient-column">
          <h3>ของที่ใช้</h3>
          <table class="ingredients">
            <thead><tr><th>วัตถุดิบ</th><th>ปริมาณ</th></tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </section>
        <section class="method-column">
          <h3>วิธีทำ</h3>
          <div class="method-body">{steps}</div>
        </section>
      </div>
      <footer><span>ตำราครัวเนื้อในตำนาน</span><span>{page_number}</span></footer>
    </article>'''


def imposition_pairs(page_count: int) -> list[tuple[int, int, int, int, int]]:
    if page_count <= 0 or page_count % 4:
        raise ValueError("จำนวนหน้า A5 ต้องหารด้วย 4 ลงตัว")
    half = page_count // 2
    return [
        (k + 1, 2 * k + 1, 2 * k + 2, 2 * k + 1 + half, 2 * k + 2 + half)
        for k in range(page_count // 4)
    ]


def _imposed_html(logical_pages: list[str]) -> str:
    sheets: list[str] = []
    for sheet, top_front, top_back, bottom_front, bottom_back in imposition_pairs(len(logical_pages)):
        for top, bottom, side in (
            (top_front, bottom_front, "หน้าแรก"),
            (top_back, bottom_back, "หน้าหลัง"),
        ):
            top_html = (
                logical_pages[top - 1]
                .replace("logical-page", "print-page", 1)
                .replace('data-page-kind="recipe"', 'data-print-kind="recipe"')
            )
            bottom_html = (
                logical_pages[bottom - 1]
                .replace("logical-page", "print-page", 1)
                .replace('data-page-kind="recipe"', 'data-print-kind="recipe"')
            )
            sheets.append(
                '<section class="sheet">'
                f'<div class="slot top">{top_html}</div>'
                f'<div class="slot bottom">{bottom_html}</div>'
                '<div class="cut-line"></div>'
                f'<div class="sheet-label">แผ่น {sheet} {side}</div>'
                '</section>'
            )
    return "".join(sheets)


CSS = r'''
    @font-face {
      font-family: "Kitchen Sans";
      src: url("file:///System/Library/Fonts/Supplemental/Tahoma.ttf") format("truetype");
      font-weight: 400;
    }
    @font-face {
      font-family: "Kitchen Sans";
      src: url("file:///System/Library/Fonts/Supplemental/Tahoma Bold.ttf") format("truetype");
      font-weight: 600 700;
    }
    :root {
      --green-900: #003D2A;
      --green-800: #005036;
      --green-100: #E8F1ED;
      --copper-600: #A05F38;
      --copper-400: #D29568;
      --ink: #1A1A1A;
      --muted: #666666;
      --quiet: #666666;
      --page: #FAFAF7;
      --zebra: #F3F6F4;
      --line: #D9DDD9;
      --screen: #E7ECE9;
      --s1: 4px;
      --s2: 8px;
      --s3: 12px;
      --s4: 16px;
      --s6: 24px;
      --s8: 32px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--screen);
      font-family: "Kitchen Sans", sans-serif;
      font-size: 14px;
      line-height: 1.7;
    }
    button {
      min-height: 48px;
      padding: 0 var(--s4);
      border: 0;
      border-radius: 4px;
      color: #FFFFFF;
      background: var(--green-800);
      font: 700 14px/1 "Kitchen Sans", sans-serif;
    }
    button:focus-visible { outline: 2px solid var(--copper-600); outline-offset: 2px; }
    .screen-bar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s4);
      padding: var(--s3) var(--s4);
      color: #FFFFFF;
      background: var(--green-900);
    }
    .screen-bar strong { font-size: 16px; }
    .screen-bar span { color: #D7E5DF; font-size: 12px; }
    .screen-note {
      max-width: 72ch;
      margin: var(--s6) auto 0;
      padding: var(--s4);
      border: 1px solid #B8C8C0;
      border-radius: 8px;
      background: #F7FAF8;
    }
    .screen-note h1 { margin: 0 0 var(--s2); font-size: 20px; line-height: 1.5; }
    .screen-note p { margin: 0; }
    #logical-pages {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--s6);
      padding: var(--s6);
    }
    .logical-page, .print-page {
      position: relative;
      width: 210mm;
      height: 148.5mm;
      overflow: hidden;
      padding: 9mm 10mm 8mm;
      background: var(--page);
    }
    .logical-page { box-shadow: 0 12px 32px rgba(0, 61, 42, 0.16), 0 2px 8px rgba(0, 0, 0, 0.12); }
    h1, h2, h3, p { overflow-wrap: anywhere; text-wrap: pretty; }
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 12mm;
      color: #FFFFFF;
      background: var(--green-900);
    }
    .cover-mark { width: 32px; height: 4px; margin-bottom: var(--s6); background: var(--copper-400); }
    .cover-kicker { margin: 0 0 var(--s2); color: #D7E5DF; font-size: 16px; font-weight: 600; }
    .cover h1 { max-width: 18ch; margin: 0; font-size: 36px; line-height: 1.2; }
    .cover-subtitle { margin: var(--s3) 0 0; color: #D7E5DF; font-size: 18px; line-height: 1.6; }
    .cover-meta {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--s4);
      padding-top: var(--s3);
      border-top: 1px solid rgba(255,255,255,.28);
      font-size: 12px;
    }
    .cover-meta strong { display: block; font-size: 18px; }
    .intro h2, .reference h2 { margin: 0 0 var(--s3); color: var(--green-900); font-size: 24px; line-height: 1.5; }
    .intro-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s6); }
    .contents-list { columns: 2; column-gap: var(--s6); margin: 0; padding: 0; list-style: none; }
    .contents-list li {
      display: flex;
      justify-content: space-between;
      gap: var(--s3);
      break-inside: avoid;
      padding: var(--s1) 0;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
      line-height: 1.5;
    }
    .contents-list span:last-child { color: var(--green-800); font-weight: 700; font-variant-numeric: tabular-nums; }
    .full-contents {
      columns: initial;
      display: grid;
      grid-auto-flow: column;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(var(--contents-rows), auto);
      column-gap: var(--s6);
    }
    .full-contents li { padding-block: 2px; }
    .full-contents li span:first-child { min-width: 0; overflow-wrap: anywhere; }
    .contents-meta { margin: 0 0 var(--s3); color: var(--muted); font-size: 12px; }
    .use-list { margin: 0; padding-left: var(--s6); font-size: 12px; line-height: 1.7; }
    .use-list li + li { margin-top: var(--s2); }
    .measure-note {
      margin-top: var(--s3);
      padding: var(--s3);
      border: 1px solid var(--copper-400);
      border-radius: 4px;
      background: #FFF8F2;
      font-size: 12px;
      font-weight: 600;
    }
    .recipe-page { display: flex; flex-direction: column; }
    .recipe-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--s4);
      margin-bottom: var(--s3);
      padding-bottom: var(--s2);
      border-bottom: 4px solid var(--copper-400);
    }
    .recipe-header > * { min-width: 0; }
    .category-name { color: var(--muted); font-size: 12px; line-height: 1.5; }
    .recipe-header h2 { margin: var(--s1) 0 0; color: var(--green-900); font-size: 24px; line-height: 1.3; }
    .serving { flex: 0 0 auto; color: var(--muted); font-size: 12px; }
    .recipe-columns {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--s4);
      min-height: 0;
      flex: 1;
    }
    .ingredient-column, .method-column { min-width: 0; min-height: 0; }
    .method-column { padding-left: var(--s4); border-left: 1px solid var(--line); }
    .ingredient-column h3, .method-column > h3 {
      margin: 0 0 var(--s2);
      color: var(--green-800);
      font-size: 16px;
      line-height: 1.5;
    }
    .ingredients { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.5; font-variant-numeric: tabular-nums; }
    .ingredients th { padding: var(--s1) var(--s2); color: #FFFFFF; background: var(--green-900); text-align: left; }
    .ingredients th:last-child, .ingredients td:last-child { width: 40%; text-align: right; }
    .ingredients td { padding: var(--s1) var(--s2); border-bottom: 1px solid var(--line); vertical-align: top; }
    .ingredients tbody tr:nth-child(even) { background: var(--zebra); }
    .variant-block + .common-block { margin-top: var(--s2); }
    .variant-table { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.3; }
    .variant-table th { padding: 2px var(--s1); color: #FFFFFF; background: var(--green-900); text-align: left; }
    .variant-table td { padding: 2px var(--s1); border-bottom: 1px solid var(--line); vertical-align: top; }
    .variant-table tbody tr:nth-child(even) { background: var(--zebra); }
    .variant-detail { display: block; color: var(--muted); font-size: 11px; line-height: 1.3; }
    .variant-rule { margin: var(--s1) 0 0; color: var(--muted); font-size: 12px; line-height: 1.35; }
    .method-body { font-size: 12px; line-height: 1.6; }
    .method-subhead { margin: var(--s2) 0 var(--s1); color: var(--green-900); font-size: 12px; line-height: 1.5; }
    .step { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: var(--s2); align-items: start; }
    .step + .step { margin-top: var(--s1); }
    .step-number {
      display: flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      color: #FFFFFF;
      background: var(--green-800);
      font-weight: 700;
      font-family: -apple-system, Helvetica, Arial, sans-serif;
      line-height: 1;
    }
    .step p, .method-note { margin: 0; }
    .method-note + .method-note { margin-top: var(--s1); }
    .no-steps { padding: var(--s3); border: 1px solid var(--line); border-radius: 4px; background: var(--zebra); }
    .no-steps strong { display: block; margin-bottom: var(--s1); color: var(--green-900); font-size: 14px; }
    .no-steps span { color: var(--muted); }
    .dense { padding-top: 6mm; padding-bottom: 5mm; }
    .dense .recipe-header { margin-bottom: var(--s1); padding-bottom: var(--s1); }
    .dense .recipe-header h2 { font-size: 20px; }
    .dense .ingredients { line-height: 1.2; }
    .dense .method-body { line-height: 1.3; }
    .dense .ingredients th, .dense .ingredients td { padding-block: 0; }
    .dense .ingredient-column h3, .dense .method-column > h3 { margin-bottom: var(--s1); }
    .dense .step { grid-template-columns: 20px minmax(0, 1fr); gap: var(--s1); }
    .dense .step-number { width: 20px; height: 20px; }
    .dense .step + .step { margin-top: 0; }
    .dense footer { margin-top: var(--s1); padding-top: 0; }
    footer {
      display: flex;
      justify-content: space-between;
      gap: var(--s3);
      margin-top: var(--s2);
      padding-top: var(--s1);
      border-top: 1px solid var(--line);
      color: var(--quiet);
      font-size: 12px;
      line-height: 1.5;
      font-variant-numeric: tabular-nums;
    }
    .reference-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s6); }
    .reference table { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.5; }
    .reference th { padding: var(--s2); color: #FFFFFF; background: var(--green-900); text-align: left; }
    .reference td { padding: var(--s2); border-bottom: 1px solid var(--line); }
    .reference tr:nth-child(even) { background: var(--zebra); }
    .back-cover { display: flex; flex-direction: column; justify-content: space-between; background: var(--green-100); }
    .back-cover h2 { max-width: 18ch; margin: 0; color: var(--green-900); font-size: 30px; line-height: 1.3; }
    .back-cover p { max-width: 60ch; margin: var(--s3) 0 0; color: var(--muted); }
    .spacer-page { background: var(--page); }
    .spacer-page .spacer-note { position: absolute; left: 10mm; bottom: 8mm; color: var(--quiet); font-size: 10px; }
    .print-check { padding-top: var(--s3); border-top: 1px solid #B8C8C0; font-size: 12px; line-height: 1.7; }
    #imposed-pages { display: none; }
    .sheet {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: var(--page);
      break-inside: avoid;
      page-break-inside: avoid;
      break-after: page;
      page-break-after: always;
    }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    .slot { position: relative; width: 210mm; height: 148.5mm; overflow: hidden; }
    .slot .print-page { position: absolute; inset: 0; width: 100%; height: 100%; box-shadow: none; }
    .cut-line {
      position: absolute;
      z-index: 4;
      top: 148.5mm;
      left: 4mm;
      right: 4mm;
      border-top: .25mm dashed #A9A9A4;
      pointer-events: none;
    }
    .cut-line::before, .cut-line::after {
      content: "";
      position: absolute;
      top: -3mm;
      height: 6mm;
      border-left: .25mm solid #777772;
    }
    .cut-line::before { left: -4mm; }
    .cut-line::after { right: -4mm; }
    .sheet-label { position: absolute; z-index: 5; right: 2mm; bottom: 1mm; color: var(--quiet); font-size: 8px; line-height: 1; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { background: #FFFFFF; }
      .screen-bar, .screen-note, #logical-pages { display: none !important; }
      #imposed-pages { display: block; }
    }
    @media (max-width: 900px) {
      .screen-bar span { display: none; }
      #logical-pages { align-items: flex-start; overflow-x: auto; }
      .screen-note { margin-inline: var(--s4); }
    }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
'''


def _family_title(kind: str) -> str:
    return {
        "kaprao": "กะเพรา 8 แบบ",
        "noodle_sizes": "ก๋วยเตี๋ยวเนื้อตุ๋น 4 ไซส์",
        "meatball_sizes": "ลูกชิ้นปิ้งในตำนาน",
    }[kind]


def _family_page(
    page_number: int,
    entry: dict[str, Any],
    data: dict[str, Any],
    ingredient_map: dict[int, str],
    recipe_map: dict[int, str],
    sop_map: dict[int, str | None],
    tables: dict[str, dict[str, Any]],
) -> str:
    kind = entry["kind"]
    representative = entry["representative"]
    bom = sorted(
        (row for row in data["bom"] if row["recipe_id"] == representative["id"]),
        key=lambda row: row.get("line_no") or 0,
    )
    if kind == "kaprao":
        common = [row for row in bom if row.get("line_no") in {1, 5, 6, 7}]
        variant_rows = "".join(
            f"<tr><td>{escape(row['protein'])}</td><td>{escape(row['protein_quantity'])}</td></tr>"
            for row in tables[kind]["rows"]
        )
        variant_head = "<tr><th>เนื้อ</th><th>ปริมาณ</th></tr>"
        variant_note = ""
        method_extra = (
            '<div class="measure-note"><strong>ข้อแตกต่าง</strong><br>'
            'เมนูราดข้าวแบบเนื้อบด เนื้อสดหมักนุ่ม และสามชั้นตุ๋น ใช้น้ำมัน 1 ช้อนโต๊ะ; '
            'แบบอื่นใช้ 1 ช้อนชา<br>เมนูราดข้าวใช้ (ใช้ตาชั่ง) 72 กรัม; เมนูกับข้าวไม่ใส่ข้าว</div>'
        )
    elif kind == "noodle_sizes":
        common = [row for row in bom if row.get("line_no") != 9]
        variant_rows = "".join(
            f"<tr><td>{escape(row['size'])}</td><td>{row['units']} หน่วย</td>"
            f"<td>{escape(row['protein_quantity'])}</td></tr>"
            for row in tables[kind]["rows"]
        )
        variant_head = "<tr><th>ไซส์</th><th>จำนวน</th><th>เนื้อตุ๋น</th></tr>"
        variant_note = ""
        method_extra = ""
    else:
        common = bom
        variant_rows = "".join(
            f"<tr><td>{escape(row['size'])}</td><td>{row['sticks']} ไม้"
            f"<span class=\"variant-detail\">ลูกชิ้น {escape(row['quantity'])}</span></td></tr>"
            for row in tables[kind]["rows"]
        )
        variant_head = "<tr><th>ไซส์</th><th>จำนวนไม้</th></tr>"
        variant_note = ""
        method_extra = ""

    common_data = dict(data)
    common_data["bom"] = common
    common_rows = _ingredient_rows(
        representative, common_data, ingredient_map, recipe_map
    )
    steps = _steps_html(STEP_OVERRIDES.get(
        representative["rcp_code"], sop_map.get(representative["id"])
    ))
    pending = ""
    if kind == "meatball_sizes":
        pending = (
            '<div class="measure-note">ข้อมูลรุ่น 2 ไม้ยังไม่ยืนยันปริมาณ '
            'จึงยังไม่ใส่ในตาราง</div>'
        )
    return f'''
    <article class="logical-page recipe-page dense family-page" data-page="{page_number}" data-page-kind="recipe" data-source-count="{len(entry['codes'])}">
      <header class="recipe-header"><div><span class="category-name">{escape(clean_name(representative.get('category') or 'เมนู'))}</span>
      <h2>{escape(_family_title(kind))}</h2></div><span class="serving">วิธีทำเดียว · ตารางสลับ</span></header>
      <div class="recipe-columns"><section class="ingredient-column">
        <div class="variant-block"><h3>ตารางสลับ</h3><table class="variant-table"><thead>{variant_head}</thead><tbody>{variant_rows}</tbody></table>{variant_note}</div>
        <div class="common-block"><h3>ของที่ใช้ร่วม</h3><table class="ingredients"><thead><tr><th>วัตถุดิบ</th><th>ปริมาณ</th></tr></thead><tbody>{common_rows}</tbody></table></div>
        {pending}
      </section><section class="method-column"><h3>วิธีทำ</h3><div class="method-body">{steps}</div>{method_extra}</section></div>
      <footer><span>ตำราครัวเนื้อในตำนาน</span><span>{page_number}</span></footer>
    </article>'''


def _contents_page(
    page_number: int,
    title: str,
    subtitle: str,
    items: list[tuple[str, int]],
) -> str:
    rows_per_column = (len(items) + 1) // 2
    rows = "".join(
        f"<li><span>{escape(name)}</span><span>{target_page}</span></li>"
        for name, target_page in items
    )
    return f'''<article class="logical-page intro" data-page="{page_number}">
      <h2>{escape(title)}</h2><p class="contents-meta">{escape(subtitle)}</p>
      <ol class="contents-list full-contents" style="--contents-rows: {rows_per_column}">{rows}</ol>
      <footer><span>สารบัญ</span><span>{page_number}</span></footer>
    </article>'''


def _unit_reference_page(page_number: int) -> str:
    return f'''<article class="logical-page reference" data-page="{page_number}">
      <h2>หน่วยที่ใช้ในเล่ม</h2><div class="reference-grid"><section><table><thead><tr><th>หน่วย</th><th>ปริมาตร</th></tr></thead><tbody>
      <tr><td>1 ช้อนโต๊ะ</td><td>15 มล.</td></tr><tr><td>1 ช้อนชา</td><td>5 มล.</td></tr><tr><td>ครึ่งช้อนโต๊ะ</td><td>7.5 มล.</td></tr><tr><td>ครึ่งช้อนชา</td><td>2.5 มล.</td></tr></tbody></table></section>
      <section><h3>เมื่อไหร่ต้องใช้ตาชั่ง</h3><p>เนื้อ ข้าว ผัก ของสด และวัตถุดิบที่ครัวยังไม่ได้ยืนยันค่าช้อน จะแสดงคำว่า “ใช้ตาชั่ง” พร้อมกรัม</p>
      <div class="measure-note">ห้ามใช้ช้อนกินข้าวแทนช้อนตวงมาตรฐาน</div></section></div>
      <footer><span>ตำราครัวเนื้อในตำนาน</span><span>{page_number}</span></footer>
    </article>'''


def render_full_book(data: dict[str, Any]) -> str:
    menu_entries = consolidated_menu_entries(data)
    support_recipes = select_support_section_recipes(data)
    tables = consolidation_tables(data)
    ingredient_map = {row["id"]: row["name"] for row in data["ings"]}
    recipe_map = {row["id"]: row["name"] for row in data["recipes"]}
    sop_map: dict[int, str | None] = {}
    for sop in data["sops"]:
        sop_map.setdefault(sop["recipe_id"], sop.get("steps_freeform"))

    menu_titles = [
        _family_title(entry["kind"])
        if entry["kind"] != "single"
        else clean_name(entry["representative"]["name"])
        for entry in menu_entries
    ]
    logical_pages = [
        '''<article class="logical-page cover" data-page="1"><div><div class="cover-mark"></div>
        <p class="cover-kicker">ตำราครัวเนื้อในตำนาน</p><h1>ฉบับพนักงานครัว</h1>
        <p class="cover-subtitle">ของที่ใช้อยู่ซ้าย · วิธีทำอยู่ขวา · เห็นพร้อมกันในหน้าเดียว</p></div>
        <div class="cover-meta"><div><strong>78 สูตร · เล่มเดียวจบ</strong>
        <span>44 เมนู · 34 หัวข้อ · ซอสและของเตรียม 34 รายการ</span></div><span>A5 แนวนอน</span></div></article>''',
        _contents_page(
            2,
            "สารบัญเมนู",
            "เรียงตามยอดขายก่อน แล้วต่อด้วยหมวดเมนูที่เหลือ",
            [(title, index + 3) for index, title in enumerate(menu_titles)],
        ),
    ]

    page_number = 3
    for entry in menu_entries:
        if entry["kind"] == "single":
            logical_pages.append(_recipe_page(
                page_number, entry["representative"], data,
                ingredient_map, recipe_map, sop_map,
                source_count=1,
            ))
        else:
            logical_pages.append(_family_page(
                page_number, entry, data, ingredient_map, recipe_map, sop_map, tables
            ))
        page_number += 1
    if page_number != 37:
        raise AssertionError(f"ส่วนเมนูต้องจบที่หน้า 36 แต่หน้าถัดไปเป็น {page_number}")

    support_items = [
        (clean_name(recipe["name"]), 38 + index)
        for index, recipe in enumerate(support_recipes)
    ]
    logical_pages.append(_contents_page(
        37, "สารบัญซอสและของเตรียม", "34 รายการ เรียงตามหมวดและชื่อ", support_items
    ))
    page_number = 38
    for recipe in support_recipes:
        logical_pages.append(_recipe_page(
            page_number, recipe, data, ingredient_map, recipe_map, sop_map,
            source_count=1,
        ))
        page_number += 1
    if page_number != 72:
        raise AssertionError(f"ส่วนซอส/ของเตรียมต้องจบที่หน้า 71 แต่หน้าถัดไปเป็น {page_number}")

    logical_pages.append(_unit_reference_page(72))
    for blank_page in (73, 74, 75):
        logical_pages.append(
            f'<article class="logical-page spacer-page" data-page="{blank_page}">'
            f'<span class="spacer-note">หน้าว่างสำหรับจัดชุดพิมพ์ · {blank_page}</span></article>'
        )
    logical_pages.append('''<article class="logical-page back-cover" data-page="76">
      <div><div class="cover-mark"></div><h2>เล่มเดียว ครบทุกสูตรที่ครัวต้องใช้</h2>
      <p>44 เมนู เรียงตามยอดขายและยุบเป็น 34 หัวข้อ · ซอสและของเตรียม 34 รายการ · รวมข้อมูลต้นทางครบ 78 สูตร</p></div>
      <div class="print-check"><strong>การพิมพ์</strong><br>พิมพ์สองหน้า A4 แนวตั้ง · พลิกด้านยาว · ขนาดจริง 100% · ตัดขวางกลางแผ่น แล้ววางปึกบนหน้า 1–38 เหนือปึกล่างหน้า 39–76</div>
    </article>''')

    if len(logical_pages) != 76:
        raise AssertionError(f"เล่มเต็มต้องมี 76 หน้า A5 แต่ได้ {len(logical_pages)}")
    logical = "".join(logical_pages)
    imposed = _imposed_html(logical_pages)
    return f'''<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตำราครัวเนื้อในตำนาน ฉบับพนักงานครัว 78 สูตร</title><style>{CSS}</style></head><body>
<header class="screen-bar"><div><strong>ตำราครัวฉบับเต็ม 78 สูตร</strong><br>
<span>76 หน้า A5 แนวนอน · พิมพ์เป็น A4 แนวตั้ง 38 หน้า · cut-and-stack</span></div>
<button type="button" onclick="window.print()">พิมพ์เล่ม</button></header>
<section class="screen-note"><h1>เล่มเต็มที่อนุมัติรูปแบบแล้ว</h1>
<p>44 เมนู · 34 หัวข้อ · ซอสและของเตรียม 34 รายการ · รวมข้อมูลต้นทางครบ 78 สูตร</p></section>
<main id="logical-pages" aria-label="หน้า A5 แนวนอนเรียงตามลำดับอ่าน">{logical}</main>
<main id="imposed-pages" aria-label="แผ่นพิมพ์ A4 แนวตั้งแบบ cut-and-stack">{imposed}</main>
</body></html>'''


def render_preview(data: dict[str, Any]) -> str:
    recipes = select_preview_recipes(data)
    ingredient_map = {row["id"]: row["name"] for row in data["ings"]}
    recipe_map = {row["id"]: row["name"] for row in data["recipes"]}
    sop_map: dict[int, str | None] = {}
    for sop in data["sops"]:
        sop_map.setdefault(sop["recipe_id"], sop.get("steps_freeform"))

    contents = "".join(
        f"<li><span>{escape(clean_name(recipe['name']))}</span><span>{index + 3}</span></li>"
        for index, recipe in enumerate(recipes)
    )

    logical_pages = [
        '''<article class="logical-page cover" data-page="1">
          <div><div class="cover-mark"></div><p class="cover-kicker">ตำราครัวเนื้อในตำนาน</p>
          <h1>ฉบับพนักงานครัว</h1><p class="cover-subtitle">เห็นของที่ใช้และวิธีทำพร้อมกันในหน้าเดียว</p></div>
          <div class="cover-meta"><div><strong>82 สูตร · เล่มเดียวจบ</strong><span>ต้นแบบข้อมูลจริง หมวดข้าว/จานเดียว 12 สูตร</span></div><span>A5 แนวนอน</span></div>
        </article>''',
        f'''<article class="logical-page intro" data-page="2">
          <h2>หมวดข้าว/จานเดียว</h2>
          <div class="intro-grid"><section><ol class="contents-list">{contents}</ol></section>
          <section><h3>วิธีใช้หน้านี้</h3><ol class="use-list"><li>ดูชื่อเมนูให้ตรงกับบิล</li><li>ตวงของจากคอลัมน์ซ้าย</li><li>ทำตามลำดับในคอลัมน์ขวา</li><li>เจอคำว่าใช้ตาชั่ง ให้ชั่งตามกรัม</li></ol>
          <div class="measure-note">ช้อนโต๊ะ 15 มล. · ช้อนชา 5 มล.</div></section></div>
          <footer><span>ตัวอย่างหมวดเดียว 12 สูตร</span><span>2</span></footer>
        </article>''',
    ]
    for index, recipe in enumerate(recipes, start=3):
        logical_pages.append(
            _recipe_page(index, recipe, data, ingredient_map, recipe_map, sop_map)
        )
    logical_pages.extend(
        [
            '''<article class="logical-page reference" data-page="15">
              <h2>หน่วยที่ใช้ในเล่ม</h2><div class="reference-grid"><section><table><thead><tr><th>หน่วย</th><th>ปริมาตร</th></tr></thead><tbody>
              <tr><td>1 ช้อนโต๊ะ</td><td>15 มล.</td></tr><tr><td>1 ช้อนชา</td><td>5 มล.</td></tr><tr><td>ครึ่งช้อนโต๊ะ</td><td>7.5 มล.</td></tr><tr><td>ครึ่งช้อนชา</td><td>2.5 มล.</td></tr></tbody></table></section>
              <section><h3>เมื่อไหร่ต้องใช้ตาชั่ง</h3><p>เนื้อ ข้าว ผัก ของสด และวัตถุดิบที่ครัวยังไม่ได้ยืนยันค่าช้อน จะแสดงคำว่า “ใช้ตาชั่ง” พร้อมกรัม</p>
              <div class="measure-note">ห้ามใช้ช้อนกินข้าวแทนช้อนตวงมาตรฐาน</div></section></div>
              <footer><span>ตำราครัวเนื้อในตำนาน</span><span>15</span></footer>
            </article>''',
            '''<article class="logical-page back-cover" data-page="16">
              <div><div class="cover-mark"></div><h2>เล่มเดียว ครบทุกสูตรที่ครัวต้องใช้</h2>
              <p>รอบนี้ใส่ข้อมูลจริงเฉพาะหมวดข้าว/จานเดียว 12 สูตร เพื่อให้ตรวจรูปเล่มก่อนทำครบ 82 สูตร</p></div>
              <div class="print-check"><strong>ก่อนพิมพ์ทั้งปึก</strong><br>พิมพ์สองหน้า 1 แผ่น · A4 แนวตั้ง · พลิกด้านยาว · ขนาดจริง 100% · ตัดขวางตามเส้นกลางแล้วเช็กลำดับหน้า</div>
            </article>''',
        ]
    )
    if len(logical_pages) != 16:
        raise AssertionError(f"preview ต้องมี 16 หน้า แต่ได้ {len(logical_pages)}")

    logical = "".join(logical_pages)
    imposed = _imposed_html(logical_pages)
    return f'''<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตำราครัวเนื้อในตำนาน ฉบับพนักงานครัว</title><style>{CSS}</style></head><body>
<header class="screen-bar"><div><strong>ต้นแบบ A5 แนวนอน ข้อมูลจริง 12 สูตร</strong><br><span>หน้าจอเรียง 1 ถึง 16 ตอนพิมพ์จัด A4 แนวตั้งแบบ cut-and-stack</span></div><button type="button" onclick="window.print()">พิมพ์แผ่นทดสอบ</button></header>
<section class="screen-note"><h1>รอบตรวจหมวดข้าว/จานเดียว</h1><p>ข้อมูลจริง 12 สูตร ไม่รวมรุ่น GLASS ที่ซ้ำกับเมนูหลัก ยังไม่ได้ทำหมวดอื่นจนครบ 82 สูตร</p></section>
<main id="logical-pages" aria-label="หน้า A5 แนวนอนเรียงตามลำดับอ่าน">{logical}</main>
<main id="imposed-pages" aria-label="แผ่นพิมพ์ A4 แนวตั้งแบบ cut-and-stack">{imposed}</main>
</body></html>'''


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hidden = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"style", "script"}:
            self.hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"style", "script"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def visible_text(html: str) -> str:
    parser = _VisibleTextParser()
    parser.feed(html)
    return " ".join(parser.parts)


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    html = render_preview(data)
    OUTPUT.write_text(html, encoding="utf-8")
    print(OUTPUT)
    print(f"{OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
