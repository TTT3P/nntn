# NNTN Recipe Studio — Workstation Print Templates Design

**Date:** 2026-08-04  
**Status:** Approved direction for Prototype v2 by TINE on 2026-08-04  
**Scope:** Extend the existing static Print Center; keep one shared recipe source and generate workstation-specific documents

## 1. Outcome

Make printing a primary operational workflow rather than a browser afterthought. A user selects menus and the point of work, then Print Center assembles an ordered, readable document pack without duplicating recipe data.

The default workstation format is **A5 landscape** (half of A4). The system can also place two A5 landscape cards on one A4 portrait sheet for economical printing and cutting.

## 2. Operational Model

The system presents the same recipe graph through three work stages:

1. **ครัวปรุง / Cooking BOM** — the ingredients and steps used to boil, stir-fry, curry, or fry a menu.
2. **ผลิตซอสและของเตรียม / Prep Production** — batch production of sauces, stock, cooked rice, marinated meat, and other reusable components.
3. **จัดเสิร์ฟหน้าร้าน / Service & Assembly** — per-order reheating, portioning, assembly, plating, packing, and handoff.

These stages are document views, not independent recipe copies. A prepared recipe can feed several cooking or service documents, and the dependency appears only once in a generated pack unless the user explicitly requests duplicates.

## 3. Chosen Approach

Print Center uses a **hybrid auto-template model**:

- the system recommends a template from the selected work stage and recipe type;
- the user can override that recommendation for an exceptional case; and
- the underlying content and revision remain shared regardless of template.

This is preferred over a universal template because each station needs different information density. It is preferred over manually maintained Word/PDF files because copied documents drift from the recipe source.

## 4. Template Family

### 4.1 A5 Landscape — Cooking Card

For `ครัวปรุง / Cooking BOM`:

- menu name and station;
- portion or batch target;
- direct ingredients and prepared components;
- ordered cooking steps;
- critical heat, time, or doneness notes when present;
- revision, effective date, and page number; and
- unresolved-data warning when the recipe is not print-ready.

### 4.2 A5 Landscape — Prep Production Card

For `ผลิตซอสและของเตรียม`:

- prepared-recipe name;
- batch size and expected yield;
- ingredients in the original kitchen units;
- production method;
- cooling, storage, and shelf-life fields when the source provides them;
- packing or portion split, such as bags or one-ounce cups; and
- revision, effective date, and page number.

Missing yield, storage, or method information stays visibly missing. The template must not invent operational instructions.

### 4.3 A5 Landscape — Service & Assembly Card

For `จัดเสิร์ฟหน้าร้าน`:

- sellable menu name and station;
- per-order portion quantities;
- reheating and assembly sequence;
- plating or packaging notes;
- dine-in, takeaway, or delivery differences when source data exists;
- a compact visual order of work; and
- revision, effective date, and page number.

The rule for the first recipe set is: every rice menu serves **180 grams of cooked rice per order**. Raw-rice quantities used for costing do not appear as the service portion.

### 4.4 A4 Portrait — Master Recipe

For recipe control and review:

- complete ingredients and method;
- source and revision metadata;
- dependency summary;
- unresolved fields and review notes; and
- enough space for sign-off or operational annotations.

### 4.5 A4 Portrait — Two-up A5 Sheet

Places two A5 landscape workstation cards on one A4 portrait sheet. The cards retain A5 proportions, include a cut line, and can be printed duplex only when page order remains unambiguous.

### 4.6 Combined Workstation Pack

Creates one PDF/print job in operational order:

1. pack cover and contents;
2. prep-production cards;
3. cooking cards; and
4. service-and-assembly cards.

Shared prepared recipes appear once. Each card states which menus consume it.

## 5. Print Center Workflow

The Print Center flow is:

```text
เลือกเมนู → เลือกจุดงาน → ระบบแนะนำ Template → ตรวจชุดเอกสาร → พิมพ์หรือ Save PDF
```

Controls:

- menu and recipe selection;
- work-stage selection: cooking, prep production, service, or all;
- recommended template with manual override;
- output mode: individual A5, two-up A4, A4 master, or combined pack;
- include or exclude draft recipes;
- multiplier for batch documents only;
- preview with page count and dependency summary; and
- print or Save PDF through the browser print dialog.

Changing the work stage refreshes the recommended template and preview. It does not edit recipe data.

## 6. Content Contract

Every generated card consumes a shared print projection with these conceptual sections:

- identity and revision;
- recipe type and work stage;
- ingredients or prepared components;
- production method;
- service or assembly method;
- yield and portion information;
- operational notes;
- dependency links; and
- readiness blockers.

The existing recipe model remains the source. Prototype v2 may add presentation metadata such as `work_stage` or split a mixed method into `production_steps` and `service_steps`, but it must not create separate recipe copies for each template.

## 7. Pagination and Legibility

- A5 landscape is the default workstation page size.
- Text is never shrunk below the established readable minimum to force a one-page result.
- Long recipes continue onto a clearly labeled page with the recipe name and `หน้าต่อ` marker.
- Ingredient rows are not split across pages when avoidable.
- A page break must not separate a heading from its first content row.
- Print output excludes application navigation, modal chrome, buttons, and scroll containers.

## 8. Revision and Readiness

Each printed page carries:

- recipe name;
- document role;
- recipe revision;
- generated date;
- draft or approved status; and
- page number within the pack.

An unresolved recipe may be previewed or printed only as a draft. It receives a visible `DRAFT — ข้อมูลไม่ครบ` treatment and lists its blockers. Template generation never upgrades a recipe's approval state.

## 9. Error and Empty States

- No selected menu: show an empty preview and disable print.
- No document for a chosen work stage: explain that the selected menu has no mapped content for that stage.
- Missing dependency: retain the menu card as draft and name the missing component.
- Circular dependency: block pack generation and display the cycle.
- Content too long for one A5 page: paginate; do not clip or silently omit content.
- Unsupported browser print behavior: keep the preview visible and offer the A4 two-up layout as the stable fallback.

## 10. Prototype Interaction Details

The template controls should feel useful without becoming decorative:

- show a small page silhouette for A5 landscape, A4 master, and two-up A4;
- label the recommended template with `แนะนำ`;
- show live page count and the number of deduplicated dependencies;
- group pages by work stage in the preview;
- use restrained stage colors that remain distinguishable in grayscale; and
- remember the user's latest template choice only in the current in-memory session.

## 11. Verification

Automated tests must prove:

- the recommended template matches each work stage;
- a manual template override is respected;
- shared dependencies print once;
- stage filters include only relevant documents;
- batch multipliers do not alter service portions;
- all rice-menu service cards in the first set show 180 grams of cooked rice;
- incomplete recipes stay draft and list blockers;
- long content produces continuation pages instead of clipping; and
- two-up A4 contains exactly two A5 landscape card slots per sheet.

Browser verification must cover preview generation, template switching, work-stage filtering, Print CSS at A5 landscape and A4 portrait, no horizontal clipping, and a clean console.

## 12. Non-goals

This design does not add:

- Supabase, Google Sheets, or production persistence;
- direct printer hardware integration;
- automatic approval of recipes;
- guessed missing instructions or unit conversions;
- a second recipe database;
- a separate application for the front store; or
- production deployment.

The deliverable remains an isolated, reversible static Prototype v2 until TINE separately opens persistence or production scope.
