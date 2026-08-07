# NNTN Kitchen Cookbook — Source Review and Google Sheets Design

**Date:** 2026-08-04  
**Status:** Approved direction for Prototype v2 by TINE on 2026-08-04  
**Scope:** Extend the existing `webapp-prototype`; do not create a replacement application

## 1. Outcome

Turn the current static Recipe Studio into a usable kitchen-cookbook workflow that lets TINE:

1. compare DOCX, V2, and the newer handwritten corrections;
2. choose a final kitchen value without converting units;
3. distinguish direct ingredients from prepared recipes such as sauces;
4. see whether a recipe is complete enough to print;
5. send a menu and its required prepared recipes into the existing Print Center; and
6. later persist the approved data in a Google Sheet owned by the `tt3p` Google account.

The first deliverable is an updated static mock prototype for visual and workflow review. Google Sheets persistence is a later implementation milestone after the mock is accepted.

This prototype is **SOT-ready, not yet the production SOT**. It becomes the kitchen Source of Truth only after the persistence milestone, the first recipe set has been reviewed, and TINE has explicitly designated an approved recipe version for operational use.

## 1.1 Kitchen SOT Contract

The eventual Kitchen SOT has four distinct layers. They must never overwrite one another:

1. **Raw evidence** — original handwriting, scans, DOCX, V1, V2, and V3. These records are immutable evidence.
2. **Source transcription** — text and quantities copied verbatim from each source, including the original unit.
3. **Approved kitchen projection** — the reviewed recipe version used by the kitchen and Print Center.
4. **Derived costing projection** — normalized g/ml and later food-cost fields, stored separately with provenance.

An approved kitchen value always retains the source document, source location, reviewer, decision note, and recipe version. Updating a recipe creates a new version; it never edits the historical evidence or silently changes a previously printed version.

The application must distinguish three levels that were mixed together in the legacy data:

- **sellable menu** — the dish sold to a customer;
- **prepared recipe** — sauce, stock, vegetable preparation, seasoning mix, or other reusable component; and
- **direct ingredient** — a purchased or raw item used by a recipe.

A DOCX file is a source container, not automatically one recipe. Every named section inside a DOCX is mapped independently. If a section describes a prepared recipe that has no legacy web record, it becomes an unresolved candidate recipe; it must not be flattened into an ingredient or silently merged into the sellable menu.

## 2. Existing Application to Preserve

The existing prototype already provides:

- Recipe Editor;
- recipe variants and sellable metadata;
- Branch Menu and Dependency Preview;
- Print Center with A4, A5 Kitchen, Booklet, and Routing layouts;
- responsive styles; and
- pure JavaScript tests for recipe variants.

The extension must reuse these surfaces. It must not create a second recipe-management app or replace the existing layout language.

## 3. Source Authority

The canonical kitchen recipe is assembled by comparing three representations:

1. **Handwritten corrections** — newest evidence and final authority when a field or step is explicitly changed.
2. **DOCX true originals** — restores source units and fills content not changed by handwriting.
3. **V2** — coverage checklist and transcription aid; converted gram values are not kitchen-source values.

Rules:

- If handwriting explicitly changes a field, use the handwritten value.
- If handwriting does not touch a field and DOCX matches V2, the value can be accepted.
- If handwriting does not touch a field and DOCX conflicts with V2, mark the field `needs_review`.
- If every source lacks the field, mark it `missing`; never invent content.
- V1 and scans may be shown as supporting evidence but do not change the precedence above.
- V3 is layout evidence only.

## 4. Unit Contract

The kitchen app preserves source quantities exactly:

- tablespoon remains tablespoon;
- teaspoon remains teaspoon;
- grams remain grams;
- millilitres remain millilitres;
- pieces and other operational units remain unchanged.

The initial Prototype v2 milestone has no kitchen-unit conversion, density table, `qty_g`, or reverse conversion from grams. Existing Food Cost Preview code remains dormant and is not part of Source Review readiness or kitchen printing.

Each final quantity stores:

- `quantity_text` — the original human-readable quantity;
- `quantity_value` — parsed numeric value when unambiguous, otherwise null;
- `unit` — the source unit;
- `source_kind` — handwriting, DOCX, V2, or manually reviewed;
- `source_locator` — page or section reference; and
- `decision_note` — why the final value was selected.

## 5. Application Navigation

Add a third workspace and make it the default landing screen:

1. **ตรวจต้นฉบับ** — new Source Review workspace;
2. **Recipe Editor** — existing workspace; and
3. **สาขาและเมนู** — existing workspace.

The Source Review workspace is the entry point for all cookbook work. Recipe Editor receives only the current final draft produced by Source Review.

## 6. Source Review Dashboard

The dashboard lists recipes by menu name. Internal codes may exist in data but are not the primary user-facing label.

Each recipe card shows:

- menu name;
- recipe type: menu, prepared recipe, or prep item;
- completeness status;
- counts of conflicts and missing fields;
- required prepared recipes;
- last reviewed time; and
- actions to review, open in Recipe Editor, or add to the print queue.

Dashboard statuses:

- `ready_for_final_review` — all required content exists and no unresolved conflicts remain;
- `conflict` — sources disagree and no final decision exists;
- `missing_method` — method is absent;
- `missing_quantity_or_unit` — an ingredient line is incomplete;
- `missing_dependency` — a linked prepared recipe is absent or incomplete;
- `draft_confirmed` — final values are selected but the recipe remains a draft; and
- `ready_to_print` — required fields are complete and accepted.

Filters include all recipes, conflicts, missing data, prepared recipes, menus, and print-ready recipes.

## 7. Recipe Comparison Workspace

Opening a recipe shows comparison sections for:

1. ingredients;
2. method steps;
3. yield or batch output;
4. operational notes; and
5. prepared-recipe dependencies.

### 7.1 Ingredient Comparison

Each ingredient line displays:

| Field | Purpose |
| --- | --- |
| Item | Ingredient or prepared-recipe name |
| DOCX | Source quantity and unit from the DOCX |
| V2 | Value shown in V2 |
| Handwriting | Newest correction, when present |
| Final | Selected kitchen quantity and unit |
| Status | accepted, conflict, or missing |
| Reason | Why the final value was selected |

Rows also have an `item_kind`:

- `ingredient` — a direct raw or purchased ingredient;
- `prepared_recipe` — a sauce, stock, seasoning mix, or other recipe made separately; or
- `prep_item` — a non-recipe preparation or garnish.

Selecting `prepared_recipe` requires linking the line to another recipe by name.

### 7.2 Method Comparison

Methods are compared as ordered steps rather than one long text block. A handwritten replacement can supersede a DOCX/V2 step. Missing methods are visible and cannot be silently synthesized.

### 7.3 Finalization

The reviewer can save any recipe as a draft. A recipe becomes `ready_to_print` only when:

- all ingredient lines have a final name, quantity, and unit;
- required method steps exist;
- yield is present when required by that recipe type;
- every prepared-recipe link resolves;
- no unresolved source conflict remains; and
- the reviewer confirms the final draft.

## 8. Recipe Dependencies

Recipe dependencies reuse the conceptual boundary already present in Branch Menu.

Example:

```text
เนื้อตุ๋นคั่วพริกเกลือ
├── เนื้อตุ๋น
└── ผงคั่วพริกเกลือ
    ├── น้ำตาล
    ├── ผงปรุงรส
    ├── ผงชูรส
    └── เกลือ
```

The application must:

- resolve prepared recipes recursively;
- de-duplicate a prepared recipe used by multiple menus;
- display names instead of requiring users to interpret recipe codes;
- identify missing dependencies;
- detect and reject dependency cycles; and
- preserve the quantity and unit used by the parent recipe.

## 9. Print Center Integration

The existing Print Center remains the only print surface.

Entry points:

- `เพิ่มลงชุดพิมพ์` from Source Review;
- `เปิดดูตัวอย่าง A5` from a recipe; and
- the existing `เปิด Print Center` button.

When a menu is selected, Print Center automatically includes its required prepared recipes. Dependencies are printed once even when shared by multiple selected menus.

Default cookbook ordering:

1. prepared recipes and sauces;
2. prep items;
3. sellable menu recipes; and
4. draft appendix, when explicitly included.

Print readiness:

- `ready_to_print` recipes can appear in controlled kitchen output;
- incomplete recipes can be printed only as draft;
- unresolved recipes show a prominent `DRAFT — ข้อมูลไม่ครบ` watermark and a missing-data summary; and
- blocked recipes cannot be included in a final-status document.

Kitchen output displays only the selected final source quantity and unit. Source-comparison columns, normalized grams, and food-cost conversions do not appear in A5 Kitchen or the controlled Cookbook.

## 10. Mock Prototype Milestone

The first implementation milestone remains static and in-memory. It will:

- add the Source Review workspace to the current prototype;
- use realistic NNTN recipe names and representative comparison data;
- model handwritten overrides, DOCX/V2 agreement, conflicts, and missing methods;
- add ingredient/prepared-recipe classification;
- connect accepted recipes to the existing Dependency Preview;
- connect status-aware selection to Print Center;
- hide Food Cost Preview from the default kitchen workflow; and
- preserve current responsive and print behavior.

No Google authentication, Apps Script deployment, Sheet creation, or production data mutation occurs in this milestone.

## 11. Google Sheets Persistence Milestone

After the mock is accepted, create a Google Sheet named `NNTN Kitchen Cookbook DB` in the `tt3p` Google Drive account.

Proposed sheets:

### `source_documents`

- `source_id`
- `source_kind`
- `source_title`
- `effective_date`
- `drive_url`
- `vault_path`
- `notes`

The source row may contain a Drive URL, a vault path, or both. Source files are evidence and are never overwritten by recipe review.

### `ingredients`

- `ingredient_id`
- `ingredient_name`
- `aliases`
- `active`
- `notes`

### `recipes`

- `recipe_id`
- `recipe_name`
- `recipe_type`
- `current_draft_version_id`
- `current_approved_version_id`
- `active`
- `updated_at`

This sheet stores stable recipe identity only. Operational content belongs to an immutable recipe version.

### `recipe_versions`

- `recipe_version_id`
- `recipe_id`
- `version_label`
- `status`
- `yield_text`
- `reviewed_by`
- `reviewed_at`
- `approved_by`
- `approved_at`
- `created_at`

Allowed statuses are `draft`, `blocked`, `ready_for_final_review`, `approved`, and `retired`. Approving a version updates `recipes.current_approved_version_id`; it does not rewrite an older approved version.

### `recipe_items`

- `line_id`
- `recipe_version_id`
- `sort_order`
- `item_kind`
- `ingredient_id`
- `component_recipe_id`
- `item_name`
- `quantity_text`
- `quantity_value`
- `unit`
- `notes`

Exactly one of `ingredient_id` or `component_recipe_id` is populated for a linked line.

### `recipe_steps`

- `step_id`
- `recipe_version_id`
- `sort_order`
- `step_text`
- `source_kind`
- `source_locator`
- `notes`

### `source_comparison`

- `comparison_id`
- `recipe_version_id`
- `section_kind`
- `line_key`
- `docx_source_id`
- `docx_text`
- `v2_source_id`
- `v2_text`
- `handwriting_source_id`
- `handwriting_text`
- `final_text`
- `final_quantity_value`
- `final_unit`
- `selected_source`
- `source_locator`
- `decision_status`
- `decision_note`
- `reviewed_by`
- `reviewed_at`

Dependencies are derived from `recipe_items.component_recipe_id`; they are not stored in a second relationship table. This avoids conflicting duplicate relationships.

Print jobs and exports resolve a specific `recipe_version_id`. They never read an unspecified "latest" version, so a previously approved kitchen document cannot change silently when a new draft is edited.

### `revision_log`

- `event_id`
- `recipe_id`
- `recipe_version_id`
- `event_type`
- `summary`
- `actor`
- `created_at`

## 12. Google Apps Script Boundary

The Apps Script web app is deployed for the `tt3p` owner account only. It is not anonymously writable.

Initial server functions:

- `getBootstrapData()`;
- `listRecipes(filters)`;
- `getRecipeReview(recipeId)`;
- `saveReviewDecision(payload)`;
- `saveRecipeDraft(payload)`;
- `getRecipeGraph(recipeIds)`; and
- `appendRevision(payload)`.

All saves validate required identifiers and units on the server. Approved projections into `recipe_items` and `recipe_steps` are written together under a script lock. An `updated_at` check prevents overwriting a newer edit. Client calls provide success, pending, failure, and retry states.

## 13. Error and Recovery Behavior

- A failed save leaves the local draft visible and offers retry.
- A stale edit is not overwritten; the app reloads the newer version and shows the difference.
- A missing Sheet tab or schema column blocks writes and reports the exact configuration error.
- A dependency cycle blocks finalization and identifies the affected recipe names.
- A recipe with missing evidence remains editable but cannot become `ready_to_print`.
- Reloading the mock prototype resets data; the interface must state this clearly until Google Sheets persistence is connected.

## 14. Test and Verification Strategy

### Domain tests

- handwriting overrides an explicitly changed DOCX/V2 field;
- DOCX/V2 agreement is accepted when handwriting does not touch the field;
- DOCX/V2 disagreement produces `needs_review`;
- missing method blocks `ready_to_print`;
- source units survive unchanged;
- no function converts tablespoon, teaspoon, gram, or millilitre values;
- prepared recipes resolve recursively and are de-duplicated;
- dependency cycles are rejected; and
- draft and final print eligibility are distinct.

### UI tests

- Source Review is the default workspace;
- filters and status counts match the mock data;
- recipe comparison shows DOCX, V2, handwriting, and final columns;
- selecting a prepared recipe exposes the linked-recipe control;
- accepted final values populate Recipe Editor;
- Print Center auto-adds dependencies;
- incomplete recipes receive the draft watermark; and
- A5 and Booklet preserve source units.

### Regression tests

- existing recipe-variant tests continue to pass;
- existing Recipe Editor add/remove behavior remains functional;
- Branch Menu interaction remains functional;
- existing Print Center templates still render; and
- desktop and mobile layouts have no body overflow.

### Browser verification

- zero console errors;
- only expected local static requests during the mock milestone;
- keyboard-accessible workspace and modal navigation;
- screenshots of the Source Review dashboard, recipe comparison, dependency preview, and Print Center; and
- verification at desktop and 390 px mobile widths.

## 15. Explicit Non-goals

The first two milestones do not include:

- Supabase writes or production schema changes;
- food-cost calculation;
- automatic unit conversion;
- supplier pricing;
- POS or channel integration;
- multi-user editing or staff access;
- public sharing; or
- automatic extraction from DOCX/PDF into Google Sheets.

## 16. Delivery Sequence

1. Update the static mock prototype and review it with TINE.
2. Correct the workflow and visual design based on that review.
3. Create and verify the Google Sheet schema.
4. Add the Apps Script repository adapter and owner-only deployment.
5. Import the first reviewed recipe set.
6. Verify persistence, dependency expansion, and print output.
7. Consider Supabase integration only after kitchen-source data is stable.
