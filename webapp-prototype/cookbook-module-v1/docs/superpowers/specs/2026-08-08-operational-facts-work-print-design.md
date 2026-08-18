# Operational Facts on Work and Print Design

**Date:** 2026-08-08
**Status:** Approved by TINE through the M4 brief
**Scope:** Cookbook Module V1 local pilot only

## Outcome

Work-stage pages and printable workstation cards show operational facts already present in the raw Kitchen SOT document without rewriting, unit conversion, calculation, or schema changes. Recipe 2 must expose the exact source text containing `หม้อเบอร์ 70`.

## Source authority

The loaded V5 draft is authoritative when present; otherwise the checksum-verified V4 source is used. The UI renders source strings byte-for-byte. It does not infer missing values or combine fields into generated prose.

## Chosen approach

Extend the existing read projection instead of reading the raw document directly from individual pages.

- `IngredientLine` carries nullable `servingNote` from `serving_note`.
- `RecipeVersion` carries nullable `yieldText` and `methodDecisionNote`; existing `operationalNotes` remains the recipe-level source.
- `ProjectedWorkDocument` carries the facts that apply to its stage.
- Work-stage and print components consume the same projected fields.
- `cost_basis_text` is never projected into a kitchen document.

This keeps a single consumer contract and prevents Work and Print from diverging. Direct raw lookups in each page were rejected because they would duplicate stage rules. Synthetic ingredients or steps were rejected because they would misrepresent source semantics and affect step ordering.

## Stage rules

| Field | Prep | Cook | Service |
| --- | --- | --- | --- |
| `operational_notes` | show all exact strings | show all exact strings | hide |
| `yield_candidate_text` | show exact string when present | show exact string when present | hide |
| `method_decision_note` | show exact string when present | show exact string when present | show exact string when present |
| `serving_note` | hide | hide | show beside its ingredient row |
| `cost_basis_text` | never project | never project | never project |

Operational notes are excluded from Service because the current raw data contains cost-basis notes such as `ฐานต้นทุนต่อที่: ข้าวสารญี่ปุ่นดิบ 72 กรัม`. Service uses the dedicated serving note instead, preserving the operational instruction `180 กรัม` without exposing food-cost data.

## Rendering

No layout redesign is introduced. Each work document/card adds a compact facts block before the ingredient table:

- operational notes as an ordered source list;
- yield as one source value;
- method decision note as one source value.

Service notes render in the quantity cell for the matching ingredient. Labels are UI chrome; every source value remains an untouched text node.

## Print safety

The print planner snapshots, validates, clones, and measures the new projected fields. Their display width contributes to pagination so passing DOM/PDF geometry gates remains meaningful. A document with source facts but no steps remains printable instead of being discarded.

## Tests

1. Work route `/work/2?stage=all` contains both exact operational notes, including `หม้อเบอร์ 70`.
2. Work renders exact yield and method note on Prep and exact serving note on Service.
3. Work Service excludes `cost_basis_text` and cost-basis operational notes.
4. Print cards render the same projected facts and exclude raw cost basis.
5. Projection tests prove all strings survive unchanged and stage filtering is deterministic.
6. Print planner tests prove source facts are snapshotted and included in layout validation.
7. Existing browser, export, E2E, local-draft, and PDF geometry gates remain green.

## Safety boundaries

- No V5 field, schema, persistence, or readiness change.
- No Stock V1/V2, auth, Supabase, production, deployment, MAW, or CROO change.
- Tests use isolated fixtures and must not create or modify the real V5 draft.
- No commit until TINE gives a separate commit instruction.

