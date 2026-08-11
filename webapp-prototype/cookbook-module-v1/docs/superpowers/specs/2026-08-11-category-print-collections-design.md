# Category Print Collections Design

Date: 2026-08-11  
Status: Approved direction by TINE; implementation not started

## Goal

Make Print Center operate in named kitchen-document sets instead of forcing the operator to tick recipes one by one or print one mixed packet and separate the sheets afterward.

The primary contract is:

> One print job represents one named collection. A collection prints its own recipes as a coherent set.

## Product model

The canonical recipe and dependency graph remains unchanged. A menu must continue to reference every prepared component it uses, including cooked rice, sauces, stocks, and prepared meat. Print collections are projections of that graph; they do not copy recipes or remove dependencies from BOM data.

Use the existing editable recipe `category` field as the collection source. Do not classify recipes by name heuristics. A recipe without a recognized category appears in `ยังไม่จัดหมวด` until TINE assigns it.

## ERP module boundary

Cookbook is one bounded module in the future NNTN ERP composition. It owns:

- recipe and prepared-component identity;
- ingredient/BOM lines as recipe requirements;
- recipe-to-component dependency relationships;
- kitchen method, yield, operational notes, and readiness projections;
- named print collections, Work documents, and kitchen print output.

Cookbook does not own stock balances, purchasing, supplier prices, food-cost calculations, sales, authentication, or production deployment. Future ERP modules may consume stable recipe, ingredient, component, and category identities, but must not copy Cookbook recipes into separate sources of truth.

The Print Center is therefore a Cookbook projection boundary. A print collection stores selection and ordering intent; it never becomes another recipe database. Future Stock and Food Cost integration must join through stable identities and remain outside kitchen-document rendering unless a separately approved contract says otherwise.

## Initial collections

1. `เมนูอาหาร`
2. `เตรียมเนื้อ`
3. `ซอสและน้ำจิ้ม`
4. `ข้าวและเครื่องเคียง`
5. `น้ำซุปและของเตรียม`
6. `จัดจาน`
7. `ยังไม่จัดหมวด`

`จัดจาน` is an available empty/template collection until the restaurant adds approved plating content. Missing data must not be invented.

## Print Center workflow

### Step 1: choose a print collection

Print Center begins with large collection actions rather than a flat recipe checklist. Each action shows the collection name and current recipe count, for example `ซอสและน้ำจิ้ม · 14 สูตร`.

Actions:

- `พิมพ์ทั้งหมวด` selects every active recipe in the collection;
- `เลือกสูตรเอง` opens the manual picker without selecting the whole collection;
- `ชุดงานวันนี้` is a separate operational bundle described below.

Selecting another collection replaces the active collection selection. Initial scope supports one active named collection per print job so unrelated books are not merged accidentally.

### Step 2: review the selected collection

After choosing a collection, Print Center shows:

- collection name;
- selected recipe count;
- page or sheet count when available;
- `เลือกทั้งหมด` and `เอาออกทั้งหมด` actions;
- a collapsible recipe list;
- individual checkboxes for optional removal or re-addition;
- search by recipe name or public recipe code.

Whole-collection selection is the default convenient path. Individual selection remains an override, not a required starting step.

### Step 3: apply the collection dependency policy

For named collection prints:

- print full documents only for recipes inside the active collection;
- show dependencies outside the collection as compact name-and-code references;
- do not append full documents from other collections;
- keep removed dependencies excluded by the existing canonical graph rule;
- never duplicate a recipe inside one print job.

Example: `เมนูอาหาร` keeps `ข้าวญี่ปุ่นหุงสุก 180 กรัม` in the menu BOM and prints a compact cooked-rice recipe reference, but does not append the full cooked-rice SOP. The full SOP belongs in `ข้าวและเครื่องเคียง`.

For `ชุดงานวันนี้`:

- the operator selects sellable menus;
- the existing dependency graph expands every required prepared component;
- a component shared by several selected menus appears once in the packet;
- dependency-first ordering remains canonical;
- removed dependencies remain excluded.

The current `reference` and `include` concepts remain domain behavior, but the normal UI describes them in operational Thai:

- `ใช้คู่มือเตรียมกลาง` for named collection reference-only output;
- `แนบของที่ต้องเตรียมครั้งเดียว` for the daily packet.

### Step 4: preview and print

The proof header states the active print set before printing, for example:

> ชุดซอสและน้ำจิ้ม  
> 14 สูตร · 18 หน้า · A5  
> อ้างอิงสูตรนอกหมวด 3 สูตร · ไม่มีเอกสารซ้ำ

Primary actions:

- `พิมพ์ทั้งหมวด`;
- `บันทึกเป็น PDF` through the browser print flow;
- `กลับไปเลือกชุดพิมพ์`.

Existing A5, A4, booklet, MediaBox, no-clipping, no-blank-tail, app-shell hiding, readiness, and cost-basis exclusion behavior remains mandatory.

## Data and editing behavior

- No new recipe-content field is required for the initial implementation.
- The existing `category` field becomes a controlled collection selector in Recipe Editor instead of relying on unrestricted text for these standard values.
- Existing meaningful non-standard categories must not be silently rewritten. They remain visible and can be moved deliberately by TINE.
- Moving a recipe between collections changes only category metadata; it does not copy, normalize, or rewrite ingredients, method, yield, readiness, or dependencies.
- Empty collections render a neutral empty state and remain printable only after at least one recipe is assigned.

## Error and empty states

- No active collection: `เลือกชุดที่ต้องการพิมพ์`.
- Empty collection: `หมวดนี้ยังไม่มีสูตร` with a link to Recipe Management.
- Uncategorized recipes: show the exact count and a link to filtered Recipe Management.
- Invalid or missing dependency: retain existing fail-closed behavior; do not invent a reference.
- A print-planning error preserves the current selection and offers retry after correction.

## Accessibility and convenience

- Collection actions are real buttons with selected state, counts, and keyboard focus.
- Collapsible recipe groups use native `details`/`summary` or equivalent accessible disclosure semantics.
- `เลือกทั้งหมด` and `เอาออกทั้งหมด` have collection-scoped accessible names.
- Selection changes update an `aria-live` summary without stealing focus.
- The operator can complete the normal category-print flow without scrolling through the full recipe catalog.

## Out of scope

- copying recipes into books;
- deleting shared component dependencies from menus;
- printing several unrelated collections as one merged PDF;
- automatic category inference from Thai recipe names;
- inventory, food-cost, supplier, Stock V1/V2, auth, Supabase, production, or deployment changes;
- revision history or multi-user approval changes.

## Acceptance criteria

1. Print Center presents the seven approved initial collections with derived recipe counts.
2. Clicking a non-empty collection selects every active recipe in that collection without individual ticking.
3. The operator can clear the collection, select all again, or adjust individual recipes.
4. A named collection prints only full documents from that collection.
5. Dependencies outside the active collection render as compact references and do not append full documents.
6. `ชุดงานวันนี้` expands dependencies and includes every shared component once per packet.
7. Selecting two menus that share cooked rice produces one cooked-rice document in the daily packet.
8. Menu BOMs continue to show their cooked-rice line and quantity.
9. Recipes without an approved collection appear in `ยังไม่จัดหมวด`; no name-based guessing occurs.
10. Recipe Editor offers the standard collection values while preserving existing non-standard category text until explicitly changed.
11. Preview states collection name, selected count, output count, external-reference count, and duplicate-free status.
12. Removed dependencies remain excluded.
13. Cost-basis data remains absent from every kitchen document.
14. Existing A5/A4/booklet geometry and PDF gates remain green.
15. Tests do not mutate real V4, V5, or V6 documents.

## Verification strategy

- Unit tests for category normalization, collection grouping, collection-wide selection, and reference-versus-daily dependency projection.
- Regression test with two selected menus sharing one cooked-rice component: named menu collection has no appended rice SOP; daily packet has exactly one rice SOP.
- Component tests for collection buttons, derived counts, select-all, clear-all, individual overrides, empty state, and uncategorized state.
- Browser/PDF gates for A5, A4, booklet, no clipping, no blank tail, and shell/control hiding.
- Immutable-source checks for V4 manifests and unchanged real V5/V6 hashes before and after verification.
