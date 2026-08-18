# Recipe Workstage Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Prep, Cook, and Service print membership visible and editable from Recipe Editor, and make Print Center terminology explain the same model.

**Architecture:** Keep Cookbook V6 `workDocuments` as the only source of truth. Add one narrow domain edit for ingredient stage membership, derive editor summaries from the current draft, and persist method stages through the existing method edit path. Print Center receives copy-only changes; print planning and schema stay unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, existing Cookbook V6 document client and print planner.

## Global Constraints

- Work only inside `webapp-prototype/cookbook-module-v1`.
- Use `/opt/homebrew/bin/git`; never stage unrelated dirty files.
- Read and apply `docs/DESIGN.md` before UI changes.
- Apply the repo engineering baseline derived from Devbook: DRY, one authoritative representation, explicit configuration, tracer-bullet delivery, easier-to-change boundaries, and state-coverage testing.
- Use strict RED → GREEN → refactor TDD for every behavior change.
- Do not add a dependency or schema field.
- Do not infer a stage from recipe/ingredient names.
- Preserve exact ingredient text, units, readiness, blockers, dependencies, removed-line behavior, Cost Basis exclusion, and print geometry.
- Do not mutate real V4, V5, or V6 in tests.
- Do not touch Stock V1/V2, auth, Supabase, production, deployment, MAW, or CROO.
- The current PR remains unmerged and undeployed; commits may update the existing feature branch only after verification.

---

### Task 1: Record the project-wide design and engineering baseline

**Files:**
- Create: `docs/ENGINEERING-BASELINE.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: durable read-order and feature workflow for later Cookbook agents.
- Consumes: `docs/DESIGN.md` and the approved Devbook-derived principles in the design spec.

- [ ] **Step 1: Write the engineering baseline**

Create a concise document with these mandatory sections:

```markdown
# Cookbook Engineering Baseline

## Required sources
1. AGENTS.md
2. docs/DESIGN.md
3. the active feature spec and plan
4. this engineering baseline

## Default feature loop
evidence → design/spec → plan → RED → GREEN → browser verification → independent review

## Devbook-derived rules
- One authoritative representation: never duplicate recipe/workstage/print state.
- Configuration is data: expose policy through validated domain edits, not UI-only state.
- Tracer bullet: prove the complete edit → save → reload → Work/Print path.
- DRY and ETC: prefer narrow reusable transformations over repeated conditionals.
- State coverage: test meaningful empty, partial, saved, stale, and printed states.
```

- [ ] **Step 2: Add the baseline to the module agent read order**

Update `AGENTS.md` so `docs/DESIGN.md` and `docs/ENGINEERING-BASELINE.md` precede feature plans. Record that design, TDD, browser verification, and independent review are defaults; additional skills are selected by task shape.

- [ ] **Step 3: Verify the documentation diff**

Run:

```bash
/opt/homebrew/bin/git diff --check -- AGENTS.md docs/ENGINEERING-BASELINE.md
```

Expected: exit 0 and no unrelated files staged.

- [ ] **Step 4: Commit the baseline**

```bash
/opt/homebrew/bin/git add -- AGENTS.md docs/ENGINEERING-BASELINE.md
/opt/homebrew/bin/git commit -m "docs(cookbook): record engineering baseline"
```

---

### Task 2: Add an atomic ingredient workstage edit

**Files:**
- Modify: `src/domain/cookbookV6/editCookbookV6.ts`
- Modify: `src/domain/cookbookV6/editCookbookV6.test.ts`

**Interfaces:**
- Produces:

```ts
type CookbookV6Edit =
  | {
      type: "ingredient-work-stages-update";
      recipeId: string;
      lineId: string;
      stages: CookbookV6Stage[];
    }
  | ExistingEdits;
```

- Consumes: existing `ensureWorkDocument`, `syncIngredientOrder`, `parseCookbookV6`, and typed `CookbookV6Stage`.

- [ ] **Step 1: Write a failing domain test for multi-stage membership**

Add a test using literal expectations:

```ts
test("moves one ingredient across work stages without changing recipe content or another recipe", () => {
  const original = makeDocument();
  const edited = applyCookbookV6Edits(original, [{
    type: "ingredient-work-stages-update",
    recipeId: "RCP-026",
    lineId: "egg",
    stages: ["prep", "service", "prep"],
  }]);

  expect(edited.recipes[0]?.workDocuments.cook?.ingredientLineIds).toEqual([]);
  expect(edited.recipes[0]?.workDocuments.prep?.ingredientLineIds).toEqual(["egg"]);
  expect(edited.recipes[0]?.workDocuments.service?.ingredientLineIds).toEqual(["egg"]);
  expect(edited.recipes[0]?.ingredients[0]).toEqual(original.recipes[0]?.ingredients[0]);
  expect(edited.recipes[1]).toEqual(original.recipes[1]);
});
```

Also assert `stages: []` removes membership from every document and an unknown line fails with `UNKNOWN_INGREDIENT_LINE`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
./node_modules/.bin/vitest run src/domain/cookbookV6/editCookbookV6.test.ts
```

Expected: FAIL because the edit type and handler do not exist.

- [ ] **Step 3: Implement the minimal atomic edit**

In `applyEdit`:

```ts
case "ingredient-work-stages-update": {
  lineFor(recipe, edit.lineId);
  const requested = [...new Set(edit.stages)];
  for (const workDocument of Object.values(recipe.workDocuments)) {
    workDocument.ingredientLineIds = workDocument.ingredientLineIds
      .filter((lineId) => lineId !== edit.lineId);
  }
  for (const stage of requested) {
    ensureWorkDocument(recipe, stage).ingredientLineIds.push(edit.lineId);
  }
  syncIngredientOrder(recipe);
  return;
}
```

Do not delete empty work documents and do not touch `stepIds` or `scalable`.

- [ ] **Step 4: Run the focused domain tests and verify GREEN**

Run:

```bash
./node_modules/.bin/vitest run src/domain/cookbookV6/editCookbookV6.test.ts src/domain/cookbookV6/parseCookbookV6.test.ts src/domain/cookbookV6/projectCookbookV6.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit the domain edit**

```bash
/opt/homebrew/bin/git add -- src/domain/cookbookV6/editCookbookV6.ts src/domain/cookbookV6/editCookbookV6.test.ts
/opt/homebrew/bin/git commit -m "feat(cookbook): edit ingredient work stages"
```

---

### Task 3: Make workstage configuration visible in Recipe Editor

**Files:**
- Modify: `src/features/recipe/RecipeEditor.tsx`
- Modify: `src/features/recipe/RecipeEditor.test.tsx`
- Modify: `src/features/recipe/recipe-editor.css`

**Interfaces:**
- Consumes: `ingredient-work-stages-update` from Task 2 and the existing method edit operations.
- Produces: draft-level ingredient stage membership, three-stage summary, explicit new-step stage selection, and saved V6 edits.

- [ ] **Step 1: Extend the test fixture with real workstage state**

Give `RCP-011` two ingredients and two steps with literal documents:

```ts
workDocuments: {
  prep: { stage: "prep", scalable: true, ingredientLineIds: ["rice"], stepIds: ["wash"] },
  cook: { stage: "cook", scalable: false, ingredientLineIds: ["rice", "beef"], stepIds: ["stir"] },
},
```

The fixture must mirror the complete V6 structures rather than partial mocks.

- [ ] **Step 2: Write failing user-behavior tests**

Add tests that require:

```ts
expect(screen.getByText("ใช้จัดกลุ่มสูตรในศูนย์พิมพ์ ไม่ได้กำหนดจุดงาน")).toBeVisible();
expect(screen.getByRole("heading", { name: "จุดงานและการพิมพ์" })).toBeVisible();
expect(screen.getByText("วัตถุดิบ 1 รายการ · ขั้นตอน 1 ขั้น")).toBeVisible();

const riceStages = screen.getByRole("group", { name: "พิมพ์วัตถุดิบนี้ในใบงาน รายการ 1" });
expect(within(riceStages).getByRole("checkbox", { name: "เตรียม" })).toBeChecked();
expect(within(riceStages).getByRole("checkbox", { name: "ปรุง" })).toBeChecked();
expect(within(riceStages).getByRole("checkbox", { name: "จัดเสิร์ฟ" })).not.toBeChecked();
```

Then move the ingredient to Service only, save, and assert the submitted document has the line only in `workDocuments.service.ingredientLineIds`.

Add a new method step and assert saving fails with `เลือกจุดงานของขั้นตอนที่ 3` until the user chooses a stage. Assert existing method selectors use the label `จุดงานของขั้นตอน ขั้นตอน 1` and helper text reflects the selected stage.

- [ ] **Step 3: Run Recipe Editor tests and verify RED**

Run:

```bash
./node_modules/.bin/vitest run src/features/recipe/RecipeEditor.test.tsx
```

Expected: FAIL because summary, ingredient membership controls, and explicit blank new-step state do not exist.

- [ ] **Step 4: Add draft workstage membership**

Extend drafts without changing persisted schema:

```ts
type IngredientDraft = CookbookV6IngredientLine & {
  removed: boolean;
  unitSelection: string;
  customUnit: string;
  workStages: CookbookV6Stage[];
};

type MethodDraft = Omit<CookbookV6MethodStep, "stage"> & {
  stage: CookbookV6Stage | "";
  removed: boolean;
};
```

`toDraft` derives ingredient stages by checking each `workDocuments[stage].ingredientLineIds`. New ingredients call the existing one-stage default helper and carry that value in the draft.

- [ ] **Step 5: Emit only changed membership edits**

For existing ingredients, compare sorted typed stage arrays from original and draft. Emit `ingredient-work-stages-update` only when they differ. For new lines, pass `workStages` on `ingredient-add`.

Keep method update/add behavior unchanged after validating that `stage !== ""`.

- [ ] **Step 6: Render the stage summary and ingredient controls**

Add the exact section/helper from the design. Derive stage counts from visible active draft rows and visible method steps; do not read stale `workDocuments.stepIds` after draft edits.

Use:

```tsx
<fieldset aria-label={`พิมพ์วัตถุดิบนี้ในใบงาน รายการ ${number}`}>
  <legend>พิมพ์วัตถุดิบนี้ในใบงาน</legend>
  {WORK_STAGE_OPTIONS.map(({ value, label }) => (
    <label key={value}>
      <input type="checkbox" checked={line.workStages.includes(value)} ... />
      {label}
    </label>
  ))}
</fieldset>
```

When empty, render `ยังไม่อยู่ในใบงาน — รายการนี้จะไม่ถูกพิมพ์`.

- [ ] **Step 7: Repair method-stage interaction**

Rename the label to `จุดงานของขั้นตอน ขั้นตอน ${number}`, add an empty `เลือกจุดงาน` option for new steps, render the live helper, and validate the first blank step before `applyEdits`.

- [ ] **Step 8: Apply DESIGN.md styling and responsive behavior**

Use one content panel and three ledger rows, not three nested cards. Stage membership uses native inputs with 44px targets. At 56rem and 36rem, rows stack/wrap without horizontal overflow. Do not add a font, animation library, gradient, or new token layer.

- [ ] **Step 9: Run focused and adjacent tests**

Run:

```bash
./node_modules/.bin/vitest run \
  src/features/recipe/RecipeEditor.test.tsx \
  src/domain/cookbookV6/editCookbookV6.test.ts \
  src/domain/cookbookV6/projectCookbookV6.test.ts \
  src/features/work/WorkStagePage.test.tsx \
  src/features/print/PrintCenterPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 10: Commit the Recipe Editor tracer bullet**

```bash
/opt/homebrew/bin/git add -- \
  src/features/recipe/RecipeEditor.tsx \
  src/features/recipe/RecipeEditor.test.tsx \
  src/features/recipe/recipe-editor.css
/opt/homebrew/bin/git commit -m "feat(cookbook): configure recipe work stages"
```

---

### Task 4: Align Print Center terminology with Recipe Editor

**Files:**
- Modify: `src/features/print/PrintCenterPage.tsx`
- Modify: `src/features/print/PrintCenterPage.test.tsx`

**Interfaces:**
- Consumes: unchanged `stage`, `template`, `multiplierText`, and `previewMode` state.
- Produces: clear Thai labels only; no planner or domain behavior change.

- [ ] **Step 1: Write failing copy/semantics tests**

Require accessible controls named:

```ts
screen.getByRole("combobox", { name: "จุดงานที่จะพิมพ์" });
screen.getByRole("combobox", { name: "รูปแบบกระดาษ" });
screen.getByRole("spinbutton", { name: "จำนวนรอบการผลิต" });
screen.getByRole("combobox", { name: "แสดงสูตรสถานะ" });
```

Require options `ทุกสถานะ (รวมรอข้อมูล)` and `เฉพาะพร้อมใช้`, and require the honest multiplier helper text. Assert old ambiguous labels are absent from the advanced controls.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
./node_modules/.bin/vitest run src/features/print/PrintCenterPage.test.tsx
```

Expected: FAIL on the old labels.

- [ ] **Step 3: Make copy-only production changes**

Replace the labels and options exactly as specified. Add helper text with a stable `aria-describedby` from the number input. Keep values `all/prep/cook/service`, `auto/station/two-up`, `draft/approved`, and all handlers unchanged.

- [ ] **Step 4: Run Print Center, planner, and card tests**

```bash
./node_modules/.bin/vitest run \
  src/features/print/PrintCenterPage.test.tsx \
  src/domain/print/printPlanner.test.ts \
  src/features/print/WorkstationCard.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit the copy alignment**

```bash
/opt/homebrew/bin/git add -- src/features/print/PrintCenterPage.tsx src/features/print/PrintCenterPage.test.tsx
/opt/homebrew/bin/git commit -m "fix(cookbook): explain print stage controls"
```

---

### Task 5: Lock save, reload, Work, and Print agreement

**Files:**
- Modify: `tests/cookbook-v6-persistence.spec.ts`
- Modify: `tests/cookbook-product.spec.ts`
- Create: `docs/handoffs/2026-08-11-recipe-workstage-editor.md`

**Interfaces:**
- Consumes: the actual V6 editor, middleware, Work page, and Print Center.
- Produces: one tracer-bullet browser regression proving the same saved `workDocuments` drive every surface.

- [ ] **Step 1: Write a failing isolated persistence E2E**

In the isolated V6 vault:

1. open a recipe edit route;
2. move one ingredient from Cook to Prep + Service;
3. move one existing method step to Service;
4. save through the UI;
5. reload the editor and assert the same controls remain selected;
6. open Work for Prep/Cook/Service and assert the ingredient/step appears only in the selected stages;
7. open Print Center and assert the stage filter uses the saved projection.

The test must fail before implementation because ingredient membership controls do not exist.

- [ ] **Step 2: Add desktop and iPhone layout assertions**

Extend the product test to open Recipe Editor at desktop and 430px width, expand the stage section, and assert `scrollWidth === clientWidth` plus 44px minimum interactive targets for stage checkboxes/selects.

- [ ] **Step 3: Run the focused browser tests**

```bash
./node_modules/.bin/playwright test --config playwright.v6.local.config.ts tests/cookbook-v6-persistence.spec.ts
./node_modules/.bin/playwright test tests/cookbook-product.spec.ts
```

Expected: all focused cases pass against the isolated loopback services.

- [ ] **Step 4: Write the dedicated handoff**

Record:

- V6 `workDocuments` remains the source of truth;
- exact edit operation and UI behavior;
- RED/GREEN evidence;
- real V4/V5/V6 before/after receipts;
- current limitation that multiplier is descriptive for verbatim quantities;
- Station Master and readiness changes remain future scope.

- [ ] **Step 5: Run the complete sequential gate**

Run in this order and stop at the first failure:

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/eslint .
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/vite build
node tests/print-layout.browser.mjs
node tests/snapshot-export.browser.mjs
./node_modules/.bin/playwright test
./node_modules/.bin/playwright test --config playwright.local.config.ts tests/cookbook-draft-persistence.spec.ts
./node_modules/.bin/playwright test --config playwright.v6.local.config.ts tests/cookbook-v6-persistence.spec.ts
/opt/homebrew/bin/git diff --check
```

If the shell sandbox cannot launch Chrome, use the user-authorized `tt3p` Chrome managed BrowserServer without changing tests, timeouts, assertions, or package manifests. Restore local Playwright to the declared version afterward.

- [ ] **Step 6: Verify immutable sources**

Require:

- V4 `SHA256SUMS.txt`: 5/5 OK;
- real V5 SHA unchanged from `9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7`;
- real V6 SHA unchanged from `96775abb92580182e4c9b4bb324d199a8bf4bb043b572170e379276119031695`.

- [ ] **Step 7: Commit verification artifacts**

```bash
/opt/homebrew/bin/git add -- \
  tests/cookbook-v6-persistence.spec.ts \
  tests/cookbook-product.spec.ts \
  docs/handoffs/2026-08-11-recipe-workstage-editor.md
/opt/homebrew/bin/git commit -m "test(cookbook): verify recipe workstage editing"
```

- [ ] **Step 8: Independent review and PR update**

Request an independent whole-feature review over the spec-to-HEAD range. Fix every Critical or Important finding through a scoped RED/GREEN loop, rerun the affected gate, then push the verified commits to the existing Cookbook pull request. Do not merge or deploy.
