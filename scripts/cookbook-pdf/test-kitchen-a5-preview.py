#!/usr/bin/env python3

import importlib.util
import json
from pathlib import Path
import re
import unittest


WORK = Path(__file__).resolve().parent
MODULE_PATH = WORK / "kitchen_a5_preview.py"
SPEC = importlib.util.spec_from_file_location("kitchen_a5_preview", MODULE_PATH)
preview = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(preview)

BUILD_MODULE_PATH = WORK / "build-kitchen-a5-full.py"
BUILD_SPEC = importlib.util.spec_from_file_location("build_kitchen_a5_full", BUILD_MODULE_PATH)
full_builder = importlib.util.module_from_spec(BUILD_SPEC)
assert BUILD_SPEC.loader is not None
BUILD_SPEC.loader.exec_module(full_builder)


class KitchenA5PreviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((WORK / "cookbook-data.json").read_text(encoding="utf-8"))

    def test_selects_twelve_non_glass_rice_single_dish_recipes(self):
        recipes = preview.select_preview_recipes(self.data)
        self.assertEqual(12, len(recipes))
        self.assertEqual(
            [
                "RCP-021", "RCP-023", "RCP-039", "RCP-022", "RCP-011", "RCP-071",
                "RCP-069", "RCP-027", "RCP-051", "RCP-019", "RCP-049", "RCP-068",
            ],
            [recipe["rcp_code"] for recipe in recipes],
        )

    def test_orders_all_forty_four_real_menu_records_once(self):
        recipes = preview.ordered_menu_recipes(self.data)
        codes = [recipe["rcp_code"] for recipe in recipes]
        self.assertEqual(44, len(codes))
        self.assertEqual(44, len(set(codes)))
        self.assertEqual(list(preview.MENU_ORDER), codes)
        self.assertEqual(34, len(preview.select_support_recipes(self.data)))
        self.assertEqual(4, len(preview.select_glass_variants(self.data)))
        self.assertEqual(
            82,
            len(recipes)
            + len(preview.select_support_recipes(self.data))
            + len(preview.select_glass_variants(self.data)),
        )
        self.assertNotIn("RCP-022-M", codes)
        self.assertNotIn("RCP-023-M", codes)
        self.assertNotIn("RCP-055-M", codes)
        self.assertNotIn("RCP-069-M", codes)
        self.assertEqual("RCP-068", codes[-1])

    def test_consolidates_families_without_losing_or_inventing_source_menus(self):
        entries = preview.consolidated_menu_entries(self.data)
        covered = [code for entry in entries for code in entry["codes"]]
        self.assertEqual(34, len(entries))
        self.assertEqual(list(preview.MENU_ORDER), sorted(covered, key=preview.MENU_ORDER.index))
        self.assertEqual(44, len(covered))
        self.assertEqual(44, len(set(covered)))

        kaprao = next(entry for entry in entries if entry["kind"] == "kaprao")
        self.assertEqual(
            ["RCP-053", "RCP-052", "RCP-054", "RCP-017E", "RCP-017A", "RCP-017B", "RCP-017C", "RCP-017D"],
            kaprao["codes"],
        )
        noodles = next(entry for entry in entries if entry["kind"] == "noodle_sizes")
        self.assertEqual(["RCP-044", "RCP-045", "RCP-046", "RCP-047"], noodles["codes"])
        meatball = next(entry for entry in entries if entry["kind"] == "meatball_sizes")
        self.assertEqual(["RCP-057"], meatball["codes"])
        self.assertFalse(meatball["has_separate_size_record"])

        singles = {entry["codes"][0] for entry in entries if entry["kind"] == "single"}
        self.assertIn("RCP-043", singles)
        self.assertIn("RCP-048", singles)

    def test_builds_grounded_switch_tables_for_each_consolidated_family(self):
        tables = preview.consolidation_tables(self.data)
        kaprao = tables["kaprao"]
        self.assertEqual(8, len(kaprao["rows"]))
        self.assertEqual("สามชั้น (ดิบ)", kaprao["rows"][0]["protein"])
        self.assertEqual("(ใช้ตาชั่ง) 200 กรัม", kaprao["rows"][0]["protein_quantity"])
        self.assertEqual("1 ช้อนชา", kaprao["rows"][0]["oil_quantity"])
        self.assertEqual("ไม่มีข้าว", kaprao["rows"][0]["rice_quantity"])
        rice_variant = next(row for row in kaprao["rows"] if row["code"] == "RCP-017A")
        self.assertEqual("1 ช้อนโต๊ะ", rice_variant["oil_quantity"])
        self.assertEqual("(ใช้ตาชั่ง) 72 กรัม", rice_variant["rice_quantity"])

        noodles = tables["noodle_sizes"]["rows"]
        self.assertEqual(["S", "M", "L", "XL"], [row["size"] for row in noodles])
        self.assertEqual([3, 5, 6, 8], [row["units"] for row in noodles])
        self.assertEqual(
            ["(ใช้ตาชั่ง) 90 กรัม", "(ใช้ตาชั่ง) 150 กรัม", "(ใช้ตาชั่ง) 180 กรัม", "(ใช้ตาชั่ง) 240 กรัม"],
            [row["protein_quantity"] for row in noodles],
        )

        meatball = tables["meatball_sizes"]
        self.assertEqual(1, len(meatball["rows"]))
        self.assertEqual(4, meatball["rows"][0]["sticks"])
        self.assertIn("2 ไม้", meatball["pending_note"])

    def test_uses_spoons_only_when_conversion_is_grounded(self):
        self.assertEqual("1 ช้อนโต๊ะ", preview.format_quantity("น้ำมันพืช", 15, "ml", ""))
        self.assertEqual("ครึ่งช้อนชา", preview.format_quantity("ซีอิ๊วขาว", 2.5, "ml", ""))
        self.assertEqual("1 ช้อนโต๊ะ", preview.format_quantity("น้ำมันพืช", 14, "g", ""))
        self.assertEqual("1 ช้อนชา", preview.format_quantity("น้ำตาลทรายไม่ขัดสี", 4, "g", ""))
        self.assertEqual("2 ช้อนชา", preview.format_quantity("เครื่องปรุง", 13.3, "g", "2 ช้อนชา (10 ml) ต่อ 1 เสิร์ฟ"))
        self.assertEqual("(ใช้ตาชั่ง) 75 กรัม", preview.format_quantity("เนื้อพิคานย่า", 75, "g", ""))

    def test_imposes_landscape_a5_as_top_and_bottom_halves_of_portrait_a4(self):
        self.assertEqual(
            [
                (1, 1, 2, 9, 10),
                (2, 3, 4, 11, 12),
                (3, 5, 6, 13, 14),
                (4, 7, 8, 15, 16),
            ],
            preview.imposition_pairs(16),
        )

    def test_cleans_system_codes_and_unavailable_print_glyphs_from_steps(self):
        cleaned = preview.clean_steps("1. ใช้ RCP-001 ครึ่งช้อน ½ ช้อน → ผัดต่อ")
        self.assertEqual("1. ใช้ ครึ่งช้อน ครึ่ง ช้อน แล้วผัดต่อ", cleaned)

    def test_shortens_brand_heavy_names_and_marks_gram_steps_for_scales(self):
        self.assertEqual("ซอสถั่วเหลือง", preview.clean_name("ซอสถั่วเหลือง (คิคโคแมน)"))
        self.assertEqual("ข้าวญี่ปุ่น", preview.clean_name("ข้าวญี่ปุ่นซาซานิชิกิ (โอริชุรุ)"))
        self.assertEqual("เสือร้องไห้ออส", preview.clean_name("เสือร้องไห้ออส[500g]"))
        self.assertEqual("ขวดพลาสติก 220 มล.", preview.clean_name("ขวดพลาสติก 220ml"))
        self.assertEqual(
            "1. ใส่ผงข้าวผัด (ใช้ตาชั่ง) 10 กรัม",
            preview.clean_steps("1. ใส่ผงข้าวผัด 10 กรัม"),
        )
        self.assertEqual("ใช้น้ำมัน 1 ช้อนโต๊ะ", preview.clean_steps("ใช้น้ำมัน 1 ช้อนโต๊ะ (14 g)"))
        self.assertEqual(
            "ชั่งในภาชนะที่มีขีดบอกปริมาตร แล้วคนชุดผสม",
            preview.clean_steps("ชั่งในภาชนะที่มีขีดบอก ml แล้วคน batch"),
        )

    def test_rendered_preview_has_landscape_geometry_and_twelve_real_recipes(self):
        html = preview.render_preview(self.data)
        self.assertIn("width: 210mm", html)
        self.assertIn("height: 148.5mm", html)
        self.assertIn("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)", html)
        self.assertIn("left: 4mm", html)
        self.assertIn("right: 4mm", html)
        self.assertIn("top: 148.5mm", html)
        self.assertIn("A4 portrait", html)
        self.assertNotIn("เล่ม 1 จาก 3", html)
        self.assertNotIn("RCP-", preview.visible_text(html))
        self.assertNotIn("BOM", preview.visible_text(html))
        self.assertEqual(16, len(re.findall(r'<article class="logical-page', html)))
        self.assertEqual(12, html.count('data-page-kind="recipe"'))

    def test_step_numbers_use_latin_system_font_for_visual_centering(self):
        html = preview.render_full_book(self.data)
        rule = re.search(r"\.step-number\s*\{([^}]*)\}", html)
        self.assertIsNotNone(rule)
        self.assertIn("display: flex;", rule.group(1))
        self.assertIn("align-items: center;", rule.group(1))
        self.assertIn("justify-content: center;", rule.group(1))
        self.assertIn(
            "font-family: -apple-system, Helvetica, Arial, sans-serif;",
            rule.group(1),
        )

    def test_weasyprint_fallback_embeds_readable_latin_font_for_step_numbers(self):
        html = (
            "<style>.step-number { "
            "font-family: -apple-system, Helvetica, Arial, sans-serif; "
            "}</style>"
        )
        compatible = getattr(full_builder, "weasyprint_compatible_html", lambda value: value)(html)
        self.assertIn('font-family: "Step Numeral", sans-serif;', compatible)
        self.assertIn('@font-face', compatible)
        self.assertIn('DejaVuSans-Bold.ttf', compatible)
        self.assertNotIn('-apple-system', compatible)

    def test_full_contents_calculates_two_columns_without_fixed_height_or_third_column(self):
        html = preview.render_full_book(self.data)
        rule = re.search(r"\.full-contents\s*\{([^}]*)\}", html)
        self.assertIsNotNone(rule)
        self.assertNotIn("height:", rule.group(1))
        self.assertIn("display: grid;", rule.group(1))
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr));", rule.group(1))
        self.assertIn("grid-template-rows: repeat(var(--contents-rows), auto);", rule.group(1))

        for page_number in (2, 37):
            page = re.search(
                rf'<article class="logical-page intro" data-page="{page_number}">(.*?)</article>',
                html,
                flags=re.DOTALL,
            )
            self.assertIsNotNone(page)
            self.assertIn('style="--contents-rows: 17"', page.group(1))
            self.assertEqual(34, page.group(1).count("<li>"))

    def test_full_book_has_seventy_six_imposed_pages_and_covers_seventy_eight_rows(self):
        html = preview.render_full_book(self.data)
        self.assertEqual(76, len(re.findall(r'<article class="logical-page', html)))
        self.assertEqual(68, html.count('data-page-kind="recipe"'))
        logical_html = html.split('<main id="imposed-pages"', 1)[0]
        source_counts = [int(value) for value in re.findall(r'data-source-count="(\d+)"', logical_html)]
        self.assertEqual(78, sum(source_counts))
        self.assertEqual(78, len(source_counts) + 10)  # การยุบกะเพรา 7 + ก๋วยเตี๋ยว 3
        self.assertIn('data-page="76"', html)
        self.assertIn("44 เมนู · 34 หัวข้อ", html)
        self.assertIn("ซอสและของเตรียม 34 รายการ", html)
        visible = preview.visible_text(html)
        for forbidden in (
            "RCP-", "SRCP-", "BOM", "[GLASS]", "สูตรวัตถุดิบทางเลือก",
            "ข้าวผัดเนื้อพิคานย่า (ออส)", "ข้าวคลุกกะเพราเนื้อพิคานย่า (ออส)",
            "สเต๊กเนื้อพิคานย่า (ออส)", "ข้าวหน้าเนื้อยากินิกุ (ออส)", "เล่ม 1 จาก 3",
        ):
            self.assertNotIn(forbidden, visible)

    def test_full_support_section_has_only_thirty_four_prep_and_sub_records(self):
        recipes = preview.select_support_section_recipes(self.data)
        self.assertEqual(34, len(recipes))
        self.assertTrue(all(recipe["type"] in {"prep", "sub"} for recipe in recipes))
        self.assertFalse(any(recipe["rcp_code"].endswith("-M") for recipe in recipes))

    def test_full_book_cut_and_stack_orders_top_then_bottom_halves(self):
        pairs = preview.imposition_pairs(76)
        self.assertEqual(19, len(pairs))
        top, bottom = [], []
        for _, top_front, top_back, bottom_front, bottom_back in pairs:
            top.extend([top_front, top_back])
            bottom.extend([bottom_front, bottom_back])
        self.assertEqual(list(range(1, 39)), top)
        self.assertEqual(list(range(39, 77)), bottom)


if __name__ == "__main__":
    unittest.main()
