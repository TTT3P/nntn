# Recipe Workstage Editor Design

Date: 2026-08-11
Status: Approved direction by TINE in-session; implementation not started

## Source contracts

- `docs/DESIGN.md` is the active UI/UX source of truth.
- Devbook source reviewed from `webapp-prototype/DEV BOOK/2026-07-30_devbook-digest.html` in the parent checkout. Applied principles: one authoritative representation, DRY, explicit configuration, proximity of related controls, tracer-bullet delivery, easier-to-change boundaries, and state-coverage testing.
- `workDocuments` in Cookbook V6 remains the only source of truth for Prep, Cook, and Service print membership.
- Stock V1/V2, auth, Supabase, production data, deployment, MAW, and CROO remain out of scope.

## Problem

Recipe Editor currently shows recipe category near the top and hides a work-stage selector inside each method row near the bottom. Category controls which named print collection contains the recipe; it does not control which ingredient or method step appears in Prep, Cook, or Service documents. Ingredient rows expose no work-stage membership control at all.

The result is a broken mental model: Print Center offers a `จุดงาน` filter, but Recipe Editor does not show where that output is configured. An operator can edit a recipe without understanding which lines will print at each kitchen station.

## Approaches considered

### A. Relabel method steps only

Improve the existing method-stage label and add help text. This is small but incomplete because ingredient membership remains uneditable.

### B. Expose the existing V6 work-document projection — selected

Add an explicit workstage section, show three stage summaries, expose ingredient membership as a multi-select checkbox group, keep method steps as a single-stage select, and persist through narrow V6 edit operations. This solves the user problem without a schema change or duplicate state.

### C. Add a Station Master now

Create custom stations such as hot kitchen, cold kitchen, sauce station, and service counter. This is useful later but changes the domain beyond the approved three-stage print model and is not required to make current output understandable.

## Information architecture

Recipe Editor order becomes:

1. recipe identity and collection metadata;
2. `จุดงานและการพิมพ์` summary;
3. ingredients with print-stage membership;
4. method steps with one workstage each;
5. sticky save bar.

The category field receives helper text:

> ใช้จัดกลุ่มสูตรในศูนย์พิมพ์ ไม่ได้กำหนดจุดงาน

## Workstage summary

Add one full-width section after `ข้อมูลสูตร`:

**Heading:** `จุดงานและการพิมพ์`

**Helper:**

> กำหนดว่าวัตถุดิบและขั้นตอนใดจะอยู่ในใบงานแต่ละจุด เมื่อเลือกจุดงานในศูนย์พิมพ์ ระบบจะแสดงเฉพาะรายการที่กำหนดไว้ที่นี่

Render three ledger rows rather than nested cards:

- `เตรียม — วัตถุดิบ 5 รายการ · ขั้นตอน 2 ขั้น`
- `ปรุง — วัตถุดิบ 3 รายการ · ขั้นตอน 4 ขั้น`
- `จัดเสิร์ฟ — วัตถุดิบ 2 รายการ · ขั้นตอน 1 ขั้น`

An empty stage says `ยังไม่มีรายการในใบงานนี้`. Counts derive from the current editor draft and update through an `aria-live="polite"` summary.

## Ingredient membership

Each active ingredient row adds a native checkbox group:

**Legend:** `พิมพ์วัตถุดิบนี้ในใบงาน`

Options:

- `เตรียม`
- `ปรุง`
- `จัดเสิร์ฟ`

One ingredient may belong to more than one stage. Existing membership is preselected from `workDocuments[stage].ingredientLineIds`. New ingredients preserve the existing domain default: if the recipe has exactly one work document, select that stage; otherwise start with no stage selected.

No selection is permitted because the product allows incomplete data, but the row must show:

> ยังไม่อยู่ในใบงาน — รายการนี้จะไม่ถูกพิมพ์

This release does not change readiness rules. Missing stage membership remains visible rather than silently inferred.

## Method stages

Each method step belongs to exactly one stage.

- Rename the label to `จุดงานของขั้นตอน`.
- Show live helper text such as `ขั้นตอนนี้จะพิมพ์ในใบงาน “ปรุง”`.
- A new step starts with a placeholder `เลือกจุดงาน`; it must not silently default to Prep.
- Saving a new step with no stage shows `เลือกจุดงานของขั้นตอนที่ 3` and focuses or identifies the relevant control.

Existing steps retain their stored stage.

## Persistence boundary

Do not add a schema field. Add a narrow V6 edit operation:

```ts
{
  type: "ingredient-work-stages-update";
  recipeId: string;
  lineId: string;
  stages: CookbookV6Stage[];
}
```

The operation:

1. verifies the recipe and ingredient line;
2. deduplicates requested stages;
3. removes the line from every work document;
4. appends the line to each requested stage, creating a work document when needed;
5. restores canonical ingredient order in every work document;
6. never changes method steps, ingredient content, readiness, or another recipe.

Recipe Editor sends this edit only when stage membership changed. New ingredients continue using the existing `workStages` field on `ingredient-add`.

## Print Center copy repair

Rename advanced controls without changing print planning:

- `จุดงาน` → `จุดงานที่จะพิมพ์`
- `แม่แบบ` → `รูปแบบกระดาษ`
- `ตัวคูณการผลิต` → `จำนวนรอบการผลิต`
- `ชุดที่ต้องการพิมพ์` → `แสดงสูตรสถานะ`
- `ข้อมูลทั้งหมด` → `ทุกสถานะ (รวมรอข้อมูล)`
- `เฉพาะสูตรพร้อมใช้` → `เฉพาะพร้อมใช้`
- details summary: `ตั้งค่าการพิมพ์เพิ่มเติม`

Add honest multiplier help:

> จำนวนรอบจะแสดงบนใบงานที่รองรับ ปริมาณข้อความเดิมไม่เปลี่ยนอัตโนมัติ

Do not expose an editable `scalable` toggle in this release. V6 quantities are currently verbatim text and the renderer does not recalculate them; a multiplication toggle would imply behavior the system does not provide.

## Visual and accessibility rules

- Follow the active `docs/DESIGN.md`: deep green, cool-neutral surfaces, brass only for restrained focus/action detail, no nested cards, no gradients, no glass effects, no text below 12px.
- Use fieldset/legend semantics for ingredient stage membership.
- Native checkbox and select controls have at least 44px interaction targets.
- Do not rely on stage color alone; every state has a Thai text label.
- On narrow screens, stage summary rows stack and stage checkboxes wrap without horizontal overflow.
- Preserve visible keyboard focus and WCAG 2.2 AA contrast.

## Error and incomplete states

- No ingredient stage: visible warning, save allowed.
- New method step with no stage: save blocked with a direct Thai action message.
- Unknown edit recipe/line/stage: fail closed through existing V6 parser/edit error behavior.
- Persistence conflict: preserve the existing stale-write guard and unsaved draft behavior.
- No stage data: show all three empty stage rows; never invent membership.

## Out of scope

- custom station names or Station Master;
- changes to readiness calculation;
- numeric unit conversion or automatic quantity multiplication;
- changes to collection metadata semantics;
- production backend, Supabase, auth, roles, revision history, or deployment;
- mutation of real V4/V5/V6 during tests.

## Acceptance criteria

1. Recipe Editor clearly states that category is different from workstage.
2. Recipe Editor shows Prep, Cook, and Service counts derived from the current draft.
3. Existing ingredient stage membership loads from V6 and can be changed to one, several, or no stages.
4. Saved ingredient membership reloads from V6 and changes Work/Print stage filtering accordingly.
5. Existing method stage remains editable and is described as the stage where the step prints.
6. A new method step requires an explicit stage selection.
7. No new schema field or duplicate station state is introduced.
8. Print Center uses the approved clear Thai labels and honest multiplier help.
9. Desktop, notebook, and iPhone 15 Pro Max widths have no unintended horizontal overflow.
10. Unit, lint, typecheck, build, browser layout/export, default E2E, isolated V5, and isolated V6 gates pass.
11. V4 checksum remains 5/5 and real V5/V6 hashes remain unchanged.
12. Project guidance records `docs/DESIGN.md`, Devbook-derived engineering principles, TDD, and independent review as ongoing defaults for future Cookbook work.
