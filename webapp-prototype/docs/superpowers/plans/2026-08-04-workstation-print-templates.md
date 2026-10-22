# NNTN Workstation Print Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate readable workstation-specific print packs from one recipe source, with A5 landscape as the default and every first-set rice menu serving 180 grams of cooked rice.

**Architecture:** Add explicit work-document projections to the generated Kitchen SOT data, then use a small pure `print-center.js` module to recommend layouts, filter work stages, deduplicate dependencies, paginate cards, and plan two-up sheets. Keep DOM rendering in the existing `app.js`, but feed it page descriptors from the pure planner so selection and pagination behavior are testable without a browser.

**Tech Stack:** Static HTML, CSS print rules, browser JavaScript, Node.js built-in test runner; no build step and no new dependency.

## Global Constraints

- Work only inside `webapp-prototype/` in the isolated `feature/kitchen-sot-prototype-v2` worktree.
- Preserve source kitchen units verbatim; do not create unit conversions or normalized grams.
- Use one shared recipe graph; templates are projections and never recipe copies.
- The three work stages are `cook`, `prep`, and `service`.
- A5 landscape is the default workstation layout; A4 two-up contains two A5 landscape card slots.
- Multipliers apply only to documents with `scalable: true`; service portions never scale.
- Every rice menu in the first set serves 180 grams of cooked rice per order; 72 grams remains only raw-rice cost basis.
- Incomplete recipes remain visibly draft and retain blocker messages.
- Keep the prototype static and in-memory: no Supabase, Google Sheets, authentication, network request, persistence, or new dependency.

---

### Task 1: Standardize Cooked Rice Portions

**Files:**
- Modify: `webapp-prototype/tests/kitchen-sot.test.js`
- Modify: `webapp-prototype/scripts/build-kitchen-sot-data.js`
- Regenerate: `webapp-prototype/data/kitchen-sot-first-set-v2.json`
- Regenerate: `webapp-prototype/data/kitchen-sot-first-set-v2.js`

**Interfaces:**
- Consumes: `candidateOverrides: Map<string, CandidateOverride>` and generated recipe objects.
- Produces: prepared-rice dependencies for recipe IDs `165`, `159`, and `37`, each with `candidate_text: "180 กรัม"`, a cooked-rice serving note, and raw-rice `cost_basis_text`.

- [ ] **Step 1: Write the failing rice-portion test**

Replace the existing jasmine-rice waiting assertions and add one invariant test:

```js
test("every first-set rice menu serves 180 grams of cooked rice", () => {
  const expected = new Map([
    [165, ["candidate:prepared:ข้าวหอมมะลิหุงสุก", "ข้าวหอมมะลิดิบ 72 กรัม"]],
    [159, ["candidate:prepared:ข้าวญี่ปุ่นหุงสุก", "ข้าวสารญี่ปุ่นดิบ 72 กรัม"]],
    [37, ["candidate:prepared:ข้าวหอมมะลิหุงสุก", "ข้าวหอมมะลิดิบ 72 กรัม"]]
  ]);

  for (const [recipeId, [componentId, costBasis]] of expected) {
    const recipe = kitchenData.recipes.find((entry) => entry.recipe_id === recipeId);
    const rice = recipe.items.find((item) => item.component_recipe_id === componentId);
    assert.equal(rice.candidate_text, "180 กรัม");
    assert.equal(rice.cost_basis_text, costBasis);
    assert.equal(rice.serving_note, "ตักข้าวหุงสุก 180 กรัม");
    assert.equal(rice.decision_status, "confirmed_by_owner");
  }
});
```

Update the jasmine prepared-recipe assertion to expect `parent_recipe_ids` equal to `[165, 37]` and no rice-portion blocker on either sellable menu.

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
node --test --test-name-pattern="rice menu|jasmine rice" tests/kitchen-sot.test.js
```

Expected: failure because recipe `165` has no confirmed cooked quantity and recipe `37` still uses direct `ข้าวหอมมะลิ 72 กรัม`.

- [ ] **Step 3: Implement the owner-confirmed rice mappings**

In `candidateOverrides`:

```js
["165:ข้าวญี่ปุ่น", {
  itemName: "ข้าวหอมมะลิหุงสุก",
  componentRecipeId: "candidate:prepared:ข้าวหอมมะลิหุงสุก",
  candidateText: "180 กรัม",
  selectedSource: "owner_confirmation",
  decisionStatus: "confirmed_by_owner",
  decisionNote: "เจ้าของยืนยันวันที่ 2026-08-04 ว่าเมนูข้าวตักข้าวหุงสุก 180 กรัมต่อจาน",
  ownerConfirmation: "ข้าวหอมมะลิหุงสุก 180 กรัมต่อจาน",
  costBasisText: "ข้าวหอมมะลิดิบ 72 กรัม",
  servingNote: "ตักข้าวหุงสุก 180 กรัม"
}],
["37:ข้าวหอมมะลิ", {
  itemName: "ข้าวหอมมะลิหุงสุก",
  componentRecipeId: "candidate:prepared:ข้าวหอมมะลิหุงสุก",
  candidateText: "180 กรัม",
  selectedSource: "owner_confirmation",
  decisionStatus: "confirmed_by_owner",
  decisionNote: "เจ้าของยืนยันวันที่ 2026-08-04 ว่าเมนูข้าวตักข้าวหุงสุก 180 กรัมต่อจาน",
  ownerConfirmation: "ข้าวหอมมะลิหุงสุก 180 กรัมต่อจาน",
  costBasisText: "ข้าวหอมมะลิดิบ 72 กรัม",
  servingNote: "ตักข้าวหุงสุก 180 กรัม"
}]
```

Set the jasmine prepared recipe's parents to `[165, 37]`, update its owner source locator, and add the operational note `เมนูหน้าครัวตักข้าวหุงสุก 180 กรัมต่อจาน`.

- [ ] **Step 4: Regenerate data and verify GREEN**

Run:

```bash
node scripts/build-kitchen-sot-data.js
node --test --test-name-pattern="rice menu|jasmine rice|Japanese rice" tests/kitchen-sot.test.js
```

Expected: all selected rice tests pass and Japanese rice remains linked only to recipe `159` within the first set.

- [ ] **Step 5: Commit the data correction**

```bash
git add tests/kitchen-sot.test.js scripts/build-kitchen-sot-data.js data/kitchen-sot-first-set-v2.json data/kitchen-sot-first-set-v2.js
git commit -m "feat: standardize cooked rice portions"
```

---

### Task 2: Add Work-Document Projections to Kitchen SOT

**Files:**
- Modify: `webapp-prototype/tests/kitchen-sot.test.js`
- Modify: `webapp-prototype/scripts/build-kitchen-sot-data.js`
- Modify: `webapp-prototype/kitchen-sot.js`
- Regenerate: `webapp-prototype/data/kitchen-sot-first-set-v2.json`
- Regenerate: `webapp-prototype/data/kitchen-sot-first-set-v2.js`

**Interfaces:**
- Consumes: generated recipes and item `line_key` values.
- Produces: `recipe.work_documents` and `printRecipe(recipe).workDocuments` using this shape:

```js
{
  prep: { stage: "prep", scalable: true, ingredientLineKeys: [], steps: [] },
  cook: { stage: "cook", scalable: false, ingredientLineKeys: [], steps: [] },
  service: { stage: "service", scalable: false, ingredientLineKeys: [], steps: [] }
}
```

- [ ] **Step 1: Write failing projection tests**

Add tests proving:

```js
test("prepared recipes project to prep production documents", () => {
  const sauce = kitchenData.recipes.find((recipe) => recipe.recipe_id === 156);
  assert.equal(sauce.work_documents.prep.stage, "prep");
  assert.equal(sauce.work_documents.prep.scalable, true);
});

test("mixed menu methods are split into cooking and service documents", () => {
  const menu = kitchenData.recipes.find((recipe) => recipe.recipe_id === 37);
  assert.match(menu.work_documents.cook.steps.join("\n"), /ทอดเนื้อแดดเดียว/);
  assert.doesNotMatch(menu.work_documents.cook.steps.join("\n"), /ตักข้าวใส่กล่อง/);
  assert.match(menu.work_documents.service.steps.join("\n"), /ตักข้าวใส่กล่อง/);
});

test("print projection resolves line keys to ingredients", () => {
  const printMenu = createKitchenSotStore(kitchenData).buildPrintBundle([37]).recipes
    .find((recipe) => recipe.recipe_id === 37);
  assert.equal(printMenu.workDocuments.service.stage, "service");
  assert.ok(printMenu.workDocuments.service.ingredients.some((item) => item.name === "ข้าวหอมมะลิหุงสุก"));
});
```

- [ ] **Step 2: Run the projection tests and verify RED**

```bash
node --test --test-name-pattern="project to prep|split into cooking|resolves line keys" tests/kitchen-sot.test.js
```

Expected: failure because `work_documents` and `workDocuments` do not exist.

- [ ] **Step 3: Generate explicit stage documents**

Add `workDocumentOverrides` for the four root recipes:

- recipe `165`: all known steps and ingredients in `service`;
- recipe `159`: all known steps and ingredients in `service`;
- recipe `37`: steps 1–2 in `cook`, steps 3–6 in `service`; cooking ingredients contain `เนื้อแดดเดียว`, service contains all per-order components;
- recipe `163`: all known steps and ingredients in `cook`.

For every prepared recipe, generate a `prep` document with all current ingredients and method steps. Keep missing methods empty so blockers remain visible.

Use exact line-key references rather than copied ingredient quantities:

```js
function workDocumentsFor(recipe, items, methodText) {
  const steps = splitMethodSteps(methodText);
  if (recipe.recipe_type !== "sellable_menu") {
    return { prep: { stage: "prep", scalable: true, ingredientLineKeys: items.map((item) => item.line_key), steps } };
  }
  return structuredClone(workDocumentOverrides.get(recipe.recipe_id) ?? {});
}
```

- [ ] **Step 4: Resolve work documents in the print projection**

In `printRecipe(recipe)`, map each work document's `ingredientLineKeys` back to already-projected ingredient rows and expose them as `ingredients`:

```js
const ingredientsByLineKey = new Map(visibleItems.map((item) => [item.line_key, printIngredient(item)]));
const workDocuments = Object.fromEntries(Object.entries(recipe.work_documents || {}).map(([stage, document]) => [stage, {
  ...clone(document),
  ingredients: document.ingredientLineKeys.map((lineKey) => ingredientsByLineKey.get(lineKey)).filter(Boolean)
}]));
```

- [ ] **Step 5: Regenerate and verify GREEN**

```bash
node scripts/build-kitchen-sot-data.js
node --test --test-name-pattern="project to prep|split into cooking|resolves line keys" tests/kitchen-sot.test.js
```

Expected: all projection tests pass.

- [ ] **Step 6: Commit the stage projection**

```bash
git add tests/kitchen-sot.test.js scripts/build-kitchen-sot-data.js kitchen-sot.js data/kitchen-sot-first-set-v2.json data/kitchen-sot-first-set-v2.js
git commit -m "feat: project recipes by work stage"
```

---

### Task 3: Build the Pure Print-Page Planner

**Files:**
- Create: `webapp-prototype/print-center.js`
- Create: `webapp-prototype/tests/print-center.test.js`

**Interfaces:**
- Consumes: `recipes: PrintRecipe[]`, `settings: { workStage, template, multiplier }`.
- Produces: `NNTNPrintCenter.recommendTemplate(workStage)`, `resolveTemplate(template, workStage)`, `workDocuments(recipes, workStage)`, `paginateDocument(document)`, and `buildPagePlan(recipes, settings)`.

- [ ] **Step 1: Write failing planner tests**

Cover exact behavior:

```js
assert.equal(recommendTemplate("cook"), "station");
assert.equal(recommendTemplate("prep"), "station");
assert.equal(recommendTemplate("service"), "station");
assert.equal(resolveTemplate("two-up", "service"), "two-up");
assert.deepEqual(workDocuments(recipes, "all").map((doc) => doc.stage), ["prep", "cook", "service"]);
assert.equal(buildPagePlan(recipes, { workStage: "all", template: "two-up", multiplier: 2 })[0].slots.length, 2);
```

Also prove that duplicate `[recipeId, stage]` pairs are removed, service quantities receive multiplier `1`, and a long document returns at least two continuation descriptors.

- [ ] **Step 2: Run the planner test and verify RED**

```bash
node --test tests/print-center.test.js
```

Expected: failure because `../print-center.js` does not exist.

- [ ] **Step 3: Implement the UMD-style pure module**

Expose browser and CommonJS APIs using the same pattern as `kitchen-sot.js`. Use stage order:

```js
const STAGE_ORDER = ["prep", "cook", "service"];
const STAGE_LABELS = { prep: "ผลิตซอสและของเตรียม", cook: "ครัวปรุง / BOM", service: "จัดเสิร์ฟหน้าร้าน" };
```

`workDocuments()` flattens selected recipe projections, filters by stage, and deduplicates with `${recipe.id}:${stage}`. `paginateDocument()` uses a deterministic line-weight budget and adds `continuation: true` after the first page. `buildPagePlan()` returns:

- `{ kind: "station", document }` for A5 landscape;
- `{ kind: "two-up", slots: [documentPage, documentPage?] }` for A4 two-up; or
- existing-template descriptors for master, booklet, and routing fallbacks.

- [ ] **Step 4: Run the planner tests and verify GREEN**

```bash
node --test tests/print-center.test.js
node --check print-center.js
```

Expected: all planner tests pass and syntax check exits zero.

- [ ] **Step 5: Commit the planner**

```bash
git add print-center.js tests/print-center.test.js
git commit -m "feat: plan workstation print pages"
```

---

### Task 4: Add Work-Stage and Template Controls to Print Center

**Files:**
- Modify: `webapp-prototype/index.html`
- Modify: `webapp-prototype/app.js`
- Create: `webapp-prototype/tests/prototype-ui.test.js`

**Interfaces:**
- Consumes: `window.NNTNPrintCenter` from `print-center.js` and `PrintRecipe.workDocuments` from Task 2.
- Produces: DOM controls `#print-work-stage`, `#print-template-auto`, and template values `station` and `two-up`; renders descriptors from `buildPagePlan()`.

- [ ] **Step 1: Write failing static UI tests**

Assert that `index.html`:

- loads `print-center.js` before `app.js`;
- contains work-stage options `all`, `prep`, `cook`, and `service`;
- contains template options `auto`, `station`, `two-up`, and `master`; and
- labels station output `A5 แนวนอน` and two-up output `2 ใบ A5 บน A4`.

- [ ] **Step 2: Run the UI test and verify RED**

```bash
node --test --test-name-pattern="Print Center v2" tests/prototype-ui.test.js
```

Expected: failure because the new controls and script are absent.

- [ ] **Step 3: Add the controls and script order**

Add a first control group for the work stage and revise the template group:

```html
<select id="print-work-stage">
  <option value="all">ครบทั้งชุด</option>
  <option value="prep">ผลิตซอสและของเตรียม</option>
  <option value="cook">ครัวปรุง / BOM</option>
  <option value="service">จัดเสิร์ฟหน้าร้าน</option>
</select>
```

Template radios include `auto` (checked), `station`, `two-up`, `master`, `booklet`, and `routing`. Mark the auto choice with visible `แนะนำ` copy.

- [ ] **Step 4: Render planned workstation pages**

In `printSettings()`, add `workStage` and resolve `auto` through `NNTNPrintCenter.resolveTemplate()`.

Add focused renderers:

```js
function workstationCard(documentPage, settings, pageNumber, totalPages) { /* A5 landscape card */ }
function twoUpSheet(page, settings, pageNumber, totalPages) { /* two card slots and cut line */ }
```

Use each document's `scalable` value when passing the multiplier to `ingredientTable()`. Display the stage label, recipe revision, draft watermark, blockers, `หน้าต่อ` marker, and page count. Keep existing master, booklet, and routing renderers working.

- [ ] **Step 5: Wire automatic recommendations and preview status**

On work-stage change:

- if `auto` remains selected, refresh the recommendation label and preview;
- if the user selected an explicit template, preserve it;
- update the toolbar with page count plus deduplicated document count; and
- disable print when no descriptor is produced.

- [ ] **Step 6: Run UI and syntax tests**

```bash
node --test tests/prototype-ui.test.js
node --check app.js
```

Expected: Print Center v2 UI test passes and `app.js` syntax check exits zero.

- [ ] **Step 7: Commit the Print Center interaction**

```bash
git add index.html app.js tests/prototype-ui.test.js
git commit -m "feat: add workstation print controls"
```

---

### Task 5: Implement A5 Landscape and A4 Two-up Print Layouts

**Files:**
- Modify: `webapp-prototype/styles.css`
- Modify: `webapp-prototype/tests/prototype-ui.test.js`

**Interfaces:**
- Consumes: `.workstation-sheet`, `.two-up-sheet`, `.two-up-slot`, `.stage-prep`, `.stage-cook`, and `.stage-service` markup from Task 4.
- Produces: screen preview and physical print sizing for A5 landscape and A4 portrait two-up.

- [ ] **Step 1: Write failing CSS contract tests**

Assert the stylesheet contains named page rules and exact dimensions:

```css
@page workstation { size: A5 landscape; }
@page two-up { size: A4 portrait; }
```

Also assert `.workstation-sheet` uses `210mm × 148mm` and `.two-up-sheet` contains a two-row grid for A5 slots.

- [ ] **Step 2: Run the CSS contract test and verify RED**

```bash
node --test --test-name-pattern="A5 landscape|two-up" tests/prototype-ui.test.js
```

Expected: failure because workstation page rules do not exist.

- [ ] **Step 3: Add preview and print CSS**

Implement:

- `width: 210mm; min-height: 148mm` for workstation cards;
- `width: 210mm; min-height: 297mm` for two-up sheets;
- two equal A5 slots with a visible cut line in preview;
- compact but readable ingredient and step columns;
- restrained stage accents that also differ by label and border style in grayscale;
- `break-inside: avoid` for ingredient rows and section headings; and
- print rules that hide modal controls and show only generated sheets.

- [ ] **Step 4: Run CSS and full automated verification**

```bash
node --test tests/*.test.js
node --check app.js
node --check import-review.js
node --check import-review-ui.js
node --check kitchen-sot.js
node --check print-center.js
node --check scripts/build-kitchen-sot-data.js
git diff --check
```

Expected: all tests pass, all syntax checks exit zero, and `git diff --check` has no output.

- [ ] **Step 5: Browser-smoke the complete workflow**

At `http://127.0.0.1:4182/index.html` verify:

1. open Print Center from `ข้าวหน้าเนื้อตุ๋น`;
2. select `จัดเสิร์ฟหน้าร้าน` and confirm automatic A5 landscape recommendation;
3. confirm `ข้าวหอมมะลิหุงสุก 180 กรัม` appears and raw `72 กรัม` does not appear as the service portion;
4. select `ครบทั้งชุด` and confirm pages are ordered prep → cook → service;
5. select two-up and confirm two A5 slots per A4 preview page;
6. select a draft dependency and confirm blockers and watermark remain visible;
7. inspect print preview at A5 landscape and A4 portrait; and
8. confirm zero console errors and no failed local network requests.

- [ ] **Step 6: Refresh handoff evidence and commit**

Update `docs/HANDOFF.md` with the new stage controls, template family, rice invariant, automated test count, and browser evidence.

```bash
git add styles.css docs/HANDOFF.md tests/prototype-ui.test.js
git commit -m "feat: print A5 workstation packs"
```

---

### Task 6: Final Verification

**Files:**
- Verify only; modify files only when a check exposes a defect.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: evidence that data generation, automated tests, syntax, static no-network boundary, and browser printing all satisfy the design.

- [ ] **Step 1: Regenerate and run the complete verification suite**

```bash
node scripts/build-kitchen-sot-data.js
node --test tests/*.test.js
node --check app.js
node --check recipe-variants.js
node --check import-review.js
node --check import-review-ui.js
node --check kitchen-sot.js
node --check print-center.js
node --check scripts/build-kitchen-sot-data.js
grep -RniE 'supabase|postgrest|fetch\(|XMLHttpRequest|WebSocket' . --exclude=README.md --exclude='*.md' --exclude='*.png' --exclude-dir=.git
git diff --check
git status --short
```

Expected: generated data is stable; all tests and syntax checks pass; the network-boundary grep returns no implementation match; `git diff --check` is empty; worktree is clean after commits.

- [ ] **Step 2: Repeat the browser smoke at desktop width**

Confirm the Print Center opens, auto-template selection works, A5 landscape and two-up previews fit without horizontal clipping, all three rice-menu service documents show 180 grams cooked rice, and the browser console has zero errors.

- [ ] **Step 3: Record final evidence**

Report commit hashes, automated test total, local URL, console error count, and any source-data blockers that remain. Do not describe incomplete source data as implementation failure; keep it visibly draft in the UI.
