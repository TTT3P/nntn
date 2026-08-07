# NNTN Kitchen SOT Prototype v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing read-only Source Review workspace into a static, in-memory Kitchen SOT workflow for the first 16 recipes, with editable kitchen candidates, named recipe dependencies, readiness rules, and guarded Print Center handoff.

**Architecture:** Keep the existing direct-open static application. Add one pure `kitchen-sot.js` domain module and one generated first-set v2 data asset; the existing Source Review UI edits an in-memory draft map and publishes a small event-based print bridge consumed by `app.js`. Raw evidence, source transcription, kitchen candidates, and normalized costing remain separate representations.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node.js built-in test runner, Node.js built-in filesystem APIs for deterministic data generation; no framework, bundler, database, network request, or new dependency.

## Global Constraints

- Extend `webapp-prototype`; do not create a replacement application.
- The milestone is static and in-memory; reload resets edits.
- No Supabase, PostgREST, Google authentication, Apps Script deployment, database write, or runtime network request.
- Preserve handwritten, DOCX, V1, and V2 evidence verbatim; never overwrite raw evidence.
- Never convert tablespoon, teaspoon, gram, millilitre, ladle, glass, bag, head, bunch, piece, or any other operational unit.
- A DOCX is a source container, not automatically one recipe; map every named section independently.
- A DOCX section with no legacy web recipe becomes a named candidate prepared recipe with a stable `candidate:<document>:<section>` key and remains blocked until reviewed.
- User-facing navigation uses Thai recipe names; internal recipe IDs are not primary labels.
- A sellable menu, prepared recipe, and direct ingredient remain distinct types.
- Incomplete recipes may print only as draft with a visible blocker summary; controlled output requires readiness.
- Existing Recipe Editor, variants, Branch Menu, and Print Center behavior must continue to work.
- `index.html` must continue to open directly from the filesystem without a server.
- No new dependencies.

---

## File Structure

- Create `data/kitchen-sot-first-set-v2.json` — canonical reviewed-candidate data for the first 16 recipes; contains source-preserving candidate fields and method text but no normalized weights.
- Create `data/kitchen-sot-first-set-v2.js` — generated direct-browser global `window.NNTNKitchenSotFirstSetV2`.
- Create `scripts/build-kitchen-sot-data.js` — deterministic JSON-to-JS generator using Node built-ins.
- Create `kitchen-sot.js` — pure draft, dependency, readiness, and print-view-model functions; CommonJS + browser global export.
- Create `tests/kitchen-sot.test.js` — domain and print-gate tests.
- Modify `index.html` — Source Review hierarchy, editor controls, print action, and script loading.
- Modify `import-review-ui.js` — render recipe tree and comparison editor; own only DOM state and in-memory draft interactions.
- Modify `app.js` — accept version-pinned kitchen print recipes through a browser event and enforce draft/final eligibility.
- Modify `styles.css` — responsive hierarchy/editor/status styles using existing tokens.
- Modify `docs/ARCHITECTURE.md` and `docs/HANDOFF.md` — document the new module boundary, reset behavior, and verification evidence.

---

### Task 1: First-set v2 source data and deterministic browser asset

**Files:**
- Create: `data/kitchen-sot-first-set-v2.json`
- Create: `scripts/build-kitchen-sot-data.js`
- Create: `data/kitchen-sot-first-set-v2.js`
- Test: `tests/kitchen-sot.test.js`

**Interfaces:**
- Consumes: recipe IDs, source locators, decisions, and section mappings already present in `data/first-set-review-v1.json`.
- Produces: `window.NNTNKitchenSotFirstSetV2` and a JSON object shaped as `{ schema_version, source_policy, root_recipe_ids, recipes }`.

- [ ] **Step 1: Write the failing schema test**

```js
const kitchenData = require("../data/kitchen-sot-first-set-v2.json");

test("first-set v2 contains 16 versioned recipes and no derived quantities", () => {
  assert.equal(kitchenData.recipes.length, 16);
  assert.deepEqual(kitchenData.root_recipe_ids, [165, 159, 37, 163]);
  for (const recipe of kitchenData.recipes) {
    assert.match(recipe.recipe_version_id, /^kitchen-v2-/);
    assert.ok(["sellable_menu", "prepared_recipe"].includes(recipe.recipe_type));
    assert.equal(Object.hasOwn(recipe, "normalized_grams"), false);
  }
});

test("ผัดผัก keeps the DOCX method and source kitchen units", () => {
  const stirFry = kitchenData.recipes.find((recipe) => recipe.recipe_id === 157);
  assert.match(stirFry.method_candidate_text, /ไมโครเวฟไฟสูง 2 นาที/);
  assert.deepEqual(
    stirFry.items.filter((item) => item.candidate_text).map((item) => item.candidate_text),
    ["25 กรัม", "25 กรัม", "1 ช้อนชา", "1 ช้อนชา", "1 กรัม", "1 กรัม", "1 กรัม"]
  );
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/kitchen-sot.test.js`

Expected: FAIL because `data/kitchen-sot-first-set-v2.json` does not exist.

- [ ] **Step 3: Create the canonical data file**

Each recipe record must use this exact shape:

```json
{
  "recipe_id": 157,
  "legacy_recipe_id": 157,
  "recipe_version_id": "kitchen-v2-157-draft-001",
  "recipe_name": "ผัดผัก",
  "recipe_type": "prepared_recipe",
  "parent_recipe_ids": [159],
  "review_state": "reviewed_candidate",
  "source_locators": ["DOCX: true-originals/_inbox/ข้าวหน้าเนื้อยากินิกุ.docx", "V2: ผัดผัก"],
  "items": [
    {
      "line_key": "ผัดผัก:น้ำมันปาล์ม",
      "item_name": "น้ำมันปาล์ม",
      "item_kind": "direct_ingredient",
      "component_recipe_id": null,
      "source_values": { "v1": "1 tsp", "docx": "1 ช้อนชา", "v2": "tsp แต่จำนวนหาย", "handwriting": null },
      "candidate_text": "1 ช้อนชา",
      "selected_source": "docx",
      "decision_status": "confirmed_from_docx",
      "decision_note": "DOCX เติมจำนวนที่หายจาก V2"
    }
  ],
  "method_candidate_text": "1. ...",
  "method_selected_source": "docx",
  "yield_candidate_text": null,
  "operational_notes": [],
  "blockers": []
}
```

Populate all 16 recipes from the reviewed evidence. Preserve null for every unresolved candidate; do not copy a V1 gram value into `candidate_text` merely to make a recipe complete.

Imported records use their numeric `recipe_id` and repeat it in `legacy_recipe_id`. The schema also accepts future source-only recipes with a string `recipe_id` such as `candidate:yakiniku-docx:ผัดผัก`, `legacy_recipe_id: null`, and `review_state: "missing_legacy_recipe"`.

- [ ] **Step 4: Add the deterministic generator**

```js
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "data", "kitchen-sot-first-set-v2.json");
const outputPath = path.join(root, "data", "kitchen-sot-first-set-v2.js");
const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const output = `window.NNTNKitchenSotFirstSetV2 = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(outputPath, output, "utf8");
```

- [ ] **Step 5: Generate the browser asset and verify deterministic output**

Run: `node scripts/build-kitchen-sot-data.js && cp data/kitchen-sot-first-set-v2.js /tmp/kitchen-sot-first-set-v2.js && node scripts/build-kitchen-sot-data.js && cmp data/kitchen-sot-first-set-v2.js /tmp/kitchen-sot-first-set-v2.js`

Expected: exit 0 and no `cmp` output.

- [ ] **Step 6: Run tests**

Run: `node --test tests/kitchen-sot.test.js`

Expected: PASS for the data-contract tests.

- [ ] **Step 7: Commit**

```bash
git add webapp-prototype/data/kitchen-sot-first-set-v2.json webapp-prototype/data/kitchen-sot-first-set-v2.js webapp-prototype/scripts/build-kitchen-sot-data.js webapp-prototype/tests/kitchen-sot.test.js
git commit -m "feat: add first kitchen SOT review set"
```

---

### Task 2: Pure Kitchen SOT draft, dependency, and readiness model

**Files:**
- Create: `kitchen-sot.js`
- Modify: `tests/kitchen-sot.test.js`

**Interfaces:**
- Consumes: `createKitchenSotStore(dataset)` with the Task 1 dataset.
- Produces: `getRecipe(recipeId)`, `getRecipeTree(recipeId)`, `updateItemCandidate(recipeId, lineKey, candidateText, decisionNote)`, `updateMethodCandidate(recipeId, methodText, decisionNote)`, `saveDraft(recipeId)`, `evaluateRecipe(recipeId)`, and `buildPrintBundle(rootRecipeIds)`.

- [ ] **Step 1: Write failing tests for type boundaries and dependency expansion**

```js
const { createKitchenSotStore } = require("../kitchen-sot.js");

test("recipe tree separates menu, prepared recipes, and direct ingredients", () => {
  const store = createKitchenSotStore(kitchenData);
  const tree = store.getRecipeTree(159);
  assert.equal(tree.recipe.recipe_name, "ข้าวหน้าเนื้อยากินิกุ");
  assert.deepEqual(tree.children.map((child) => child.recipe.recipe_name), ["ซอสยากินิกุ", "ผัดผัก", "น้ำจิ้มซีฟู๊ด"]);
  assert.ok(tree.directIngredients.some((item) => item.item_name.includes("พิคานย่า")));
});

test("print bundle is dependency-first and de-duplicates prepared recipes", () => {
  const store = createKitchenSotStore(kitchenData);
  const bundle = store.buildPrintBundle([165, 159]);
  assert.equal(new Set(bundle.recipes.map((recipe) => recipe.recipe_id)).size, bundle.recipes.length);
  assert.ok(bundle.recipes.findIndex((recipe) => recipe.recipe_id === 158) < bundle.recipes.findIndex((recipe) => recipe.recipe_id === 159));
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/kitchen-sot.test.js`

Expected: FAIL because `kitchen-sot.js` does not exist.

- [ ] **Step 3: Implement an isolated in-memory store**

Use a UMD-style browser/CommonJS wrapper matching `import-review.js`. Clone the input dataset with `structuredClone` when available and JSON serialization as fallback. Keep mutations inside a `Map<string, RecipeDraft>`.

Normalize map keys with `String(recipeId)` rather than `Number(recipeId)` so a source-only candidate recipe can coexist with imported numeric IDs.

Readiness uses these exact blockers:

```js
const blockerCodes = {
  missingCandidate: "missing_quantity_or_unit",
  unresolvedDecision: "unresolved_source_conflict",
  missingMethod: "missing_method",
  missingDependency: "missing_dependency",
  dependencyCycle: "dependency_cycle"
};
```

`evaluateRecipe(recipeId)` returns:

```js
{
  recipeId: 159,
  status: "blocked",
  blockers: [{ code: "unresolved_source_conflict", recipeName: "ข้าวหน้าเนื้อยากินิกุ", itemName: "น้ำจิ้มซีฟู้ด", message: "..." }]
}
```

Allowed statuses are `draft`, `blocked`, `ready_for_final_review`, and `print_ready`. The static milestone may enter `print_ready` after a deliberate owner confirmation, but it must never label a version `approved`.

- [ ] **Step 4: Add cycle and no-conversion tests**

```js
test("dependency cycles are named and block printing", () => {
  const cyclic = structuredClone(kitchenData);
  cyclic.recipes.find((recipe) => recipe.recipe_id === 156).items.push({
    line_key: "cycle", item_name: "เมนูหลัก", item_kind: "prepared_recipe", component_recipe_id: 159,
    source_values: {}, candidate_text: "1 ชุด", selected_source: "manual_review", decision_status: "confirmed", decision_note: "fixture"
  });
  const result = createKitchenSotStore(cyclic).buildPrintBundle([159]);
  assert.equal(result.allowedFinal, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "dependency_cycle"));
});

test("editing a spoon value never creates normalized grams", () => {
  const store = createKitchenSotStore(kitchenData);
  const updated = store.updateItemCandidate(157, "ผัดผัก:น้ำมันปาล์ม", "1 ช้อนชา", "ยืนยันจาก DOCX");
  assert.equal(updated.items.find((item) => item.line_key === "ผัดผัก:น้ำมันปาล์ม").candidate_text, "1 ช้อนชา");
  assert.equal(JSON.stringify(updated).includes("normalized_grams"), false);
});

test("a DOCX-only section stays a named blocked candidate recipe", () => {
  const sourceOnly = structuredClone(kitchenData);
  sourceOnly.recipes.push({
    recipe_id: "candidate:example-docx:ซอสใหม่",
    legacy_recipe_id: null,
    recipe_version_id: "kitchen-v2-candidate-example-draft-001",
    recipe_name: "ซอสใหม่",
    recipe_type: "prepared_recipe",
    parent_recipe_ids: [159],
    review_state: "missing_legacy_recipe",
    source_locators: ["DOCX: example.docx / ซอสใหม่"],
    items: [],
    method_candidate_text: null,
    blockers: [{ code: "missing_legacy_recipe", message: "ยังไม่มีสูตรเดิมบนเว็บ" }]
  });
  const candidate = createKitchenSotStore(sourceOnly).getRecipe("candidate:example-docx:ซอสใหม่");
  assert.equal(candidate.recipe_name, "ซอสใหม่");
  assert.equal(createKitchenSotStore(sourceOnly).evaluateRecipe(candidate.recipe_id).status, "blocked");
});
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/kitchen-sot.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add webapp-prototype/kitchen-sot.js webapp-prototype/tests/kitchen-sot.test.js
git commit -m "feat: model kitchen SOT drafts and readiness"
```

---

### Task 3: Name-first recipe tree and editable kitchen draft UI

**Files:**
- Modify: `index.html`
- Modify: `import-review-ui.js`
- Modify: `styles.css`
- Test: `tests/kitchen-sot.test.js`

**Interfaces:**
- Consumes: `window.NNTNKitchenSotFirstSetV2` and `window.KitchenSot.createKitchenSotStore(dataset)`.
- Produces: in-memory edits, visible readiness, and a `CustomEvent("nntn:kitchen-print-request", { detail })` for Task 4.

- [ ] **Step 1: Add a failing presentation-model test**

Add `recipeTreeRows(recipeId)` to the pure store so the DOM renderer receives flat depth/name/type/status rows rather than calculating hierarchy itself.

```js
test("recipeTreeRows uses names and depth instead of requiring recipe codes", () => {
  const rows = createKitchenSotStore(kitchenData).recipeTreeRows(159);
  assert.deepEqual(rows.map(({ name, depth }) => ({ name, depth })), [
    { name: "ข้าวหน้าเนื้อยากินิกุ", depth: 0 },
    { name: "ซอสยากินิกุ", depth: 1 },
    { name: "ผัดผัก", depth: 1 },
    { name: "น้ำจิ้มซีฟู๊ด", depth: 1 }
  ]);
  assert.equal(rows.some((row) => /^RCP-|^SRCP-/.test(row.name)), false);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/kitchen-sot.test.js`

Expected: FAIL because `recipeTreeRows` is missing.

- [ ] **Step 3: Add the minimal presentation helper**

Implement `recipeTreeRows(recipeId)` as a deterministic pre-order traversal over prepared-recipe children. Return `{ recipeId, name, type, depth, status, blockerCount }` for each row.

- [ ] **Step 4: Replace the detail header with three plain-language levels**

In `index.html`, add a compact legend:

```html
<div class="kitchen-level-legend" aria-label="โครงสร้างสูตร">
  <span><b>เมนูขาย</b> ของที่ลูกค้าสั่ง</span>
  <span><b>สูตรเตรียม</b> ซอส น้ำซุป หรือของที่ครัวทำไว้</span>
  <span><b>วัตถุดิบ</b> ของที่หยิบมาใช้โดยตรง</span>
</div>
```

Add containers `#kitchen-recipe-tree`, `#kitchen-draft-editor`, `#kitchen-readiness`, and buttons `#save-kitchen-draft`, `#mark-kitchen-print-ready`, `#add-kitchen-print-bundle`.

- [ ] **Step 5: Render the recipe tree and editor**

The tree buttons show names only. Selecting a child recipe updates the same detail editor. Each comparison row contains:

```html
<label class="field kitchen-candidate-field">
  <span>ค่าหน้าครัว</span>
  <input data-line-key="..." value="1 ช้อนชา" aria-label="ค่าหน้าครัว น้ำมันปาล์ม">
</label>
```

The method editor is a `<textarea id="kitchen-method-candidate">`. Show source evidence read-only above editable candidate fields. Use `textContent` or the existing `escapeHtml()` for every data-derived value.

- [ ] **Step 6: Wire explicit draft actions**

- `บันทึกฉบับร่าง` updates only the in-memory store and shows `บันทึกในหน้าทดลองแล้ว · รีโหลดแล้วข้อมูลจะหาย`.
- `ทำเครื่องหมายพร้อมพิมพ์` calls `evaluateRecipe`; it succeeds only with zero blockers.
- `เพิ่มเมนูและสูตรเตรียมลงชุดพิมพ์` dispatches the Task 4 event with `{ rootRecipeIds: [selectedRootId] }`.
- No control uses the words `อนุมัติจริง` or implies persistence.

- [ ] **Step 7: Add responsive styles**

Use existing spacing, type, radius, green, gold, danger, and ink tokens. Desktop may use tree + editor columns; at `max-width: 980px` stack them; at `390px` ensure inputs fill width and no body overflow. Status must have both text and shape/border, not color alone.

- [ ] **Step 8: Run static and domain checks**

Run: `node --check kitchen-sot.js && node --check import-review-ui.js && node --test tests/kitchen-sot.test.js tests/import-review.test.js`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add webapp-prototype/index.html webapp-prototype/import-review-ui.js webapp-prototype/styles.css webapp-prototype/kitchen-sot.js webapp-prototype/tests/kitchen-sot.test.js
git commit -m "feat: add name-first kitchen draft workflow"
```

---

### Task 4: Guarded Print Center bridge with recursive prepared recipes

**Files:**
- Modify: `kitchen-sot.js`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/kitchen-sot.test.js`

**Interfaces:**
- Consumes: `buildPrintBundle(rootRecipeIds)` returning `{ recipes, blockers, allowedFinal }`.
- Produces: Print Center recipe view models shaped as `{ id, recipeVersionId, name, category, yield, version, ingredients, steps, kitchenStatus, blockers }`.

- [ ] **Step 1: Write failing print-view-model and gate tests**

```js
test("blocked recipes become draft print models with blocker text", () => {
  const bundle = createKitchenSotStore(kitchenData).buildPrintBundle([159]);
  assert.equal(bundle.allowedFinal, false);
  assert.ok(bundle.recipes.every((recipe) => recipe.id.startsWith("kitchen:")));
  assert.ok(bundle.blockers.some((blocker) => blocker.recipeName === "ข้าวหน้าเนื้อยากินิกุ"));
});

test("print ingredients use candidate text without unit conversion", () => {
  const bundle = createKitchenSotStore(kitchenData).buildPrintBundle([159]);
  const vegetables = bundle.recipes.find((recipe) => recipe.name === "ผัดผัก");
  assert.ok(vegetables.ingredients.some((item) => item.amount === "1" && item.unit === "ช้อนชา"));
  assert.equal(JSON.stringify(bundle).includes("normalized"), false);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/kitchen-sot.test.js`

Expected: FAIL until the print mapping is implemented.

- [ ] **Step 3: Implement print mapping in the pure module**

Parse `candidate_text` only for display splitting. Keep the original candidate string as `sourceAmountText`. If a quantity cannot be split unambiguously, use `amount: candidate_text` and `unit: ""`; never infer a replacement unit.

- [ ] **Step 4: Add the browser event bridge to `app.js`**

Create `const kitchenPrintRecipes = new Map();`. Handle:

```js
window.addEventListener("nntn:kitchen-print-request", (event) => {
  const bundle = event.detail?.bundle;
  if (!bundle || !Array.isArray(bundle.recipes)) return;
  kitchenPrintRecipes.clear();
  bundle.recipes.forEach((recipe) => {
    kitchenPrintRecipes.set(recipe.id, recipe);
    selectedRecipeIds.add(recipe.id);
  });
  renderRecipePicker();
  renderPrintPreview();
  openPrintCenter();
});
```

Append `...kitchenPrintRecipes.values()` in `allRecipes()`.

- [ ] **Step 5: Enforce document status**

If any selected kitchen recipe has `kitchenStatus !== "print_ready"`, force the effective document status to `DRAFT — ข้อมูลไม่ครบ`, render the blocker summary on each affected page, and prevent the `อนุมัติแล้ว` status from being selected. Existing sample recipes retain existing mock behavior.

- [ ] **Step 6: Load scripts in dependency order**

```html
<script src="data/cookbook-import-v1.js"></script>
<script src="data/kitchen-sot-first-set-v2.js"></script>
<script src="import-review.js"></script>
<script src="kitchen-sot.js"></script>
<script src="import-review-ui.js"></script>
<script src="recipe-variants.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 7: Run all JavaScript tests and static checks**

Run: `node --check app.js && node --check import-review-ui.js && node --check kitchen-sot.js && node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add webapp-prototype/app.js webapp-prototype/index.html webapp-prototype/styles.css webapp-prototype/kitchen-sot.js webapp-prototype/tests/kitchen-sot.test.js
git commit -m "feat: connect kitchen drafts to guarded printing"
```

---

### Task 5: Browser verification, regression evidence, and handoff

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/HANDOFF.md`
- Create: `preview-kitchen-sot-desktop.png`
- Create: `preview-kitchen-sot-mobile.png`

**Interfaces:**
- Consumes: completed Prototype v2 static app.
- Produces: fresh test evidence, browser evidence, screenshots, and an exact next milestone boundary.

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
node scripts/build-kitchen-sot-data.js
node --check app.js
node --check import-review.js
node --check import-review-ui.js
node --check kitchen-sot.js
node --check recipe-variants.js
node --test tests/*.test.js
grep -RniE 'supabase|postgrest|fetch\(|XMLHttpRequest|WebSocket|localStorage' . --exclude=README.md --exclude='*.md' --exclude='*.png'
```

Expected: syntax and tests pass; grep finds no runtime persistence/network implementation in Prototype v2 files.

- [ ] **Step 2: Verify the primary browser flow at desktop width**

Open `index.html`, then verify:

1. Source Review is the default workspace.
2. Selecting `ข้าวหน้าเนื้อยากินิกุ` displays the three-level legend and named recipe tree.
3. Selecting `ผัดผัก` displays its seven ingredient candidates and two DOCX method steps.
4. Editing `1 ช้อนชา` preserves the typed unit exactly after saving the in-memory draft.
5. Reload resets the draft and the UI states this clearly.
6. Adding the menu to Print Center includes `ซอสยากินิกุ`, `ผัดผัก`, `น้ำจิ้มซีฟู๊ด`, then the sellable menu once each.
7. Unresolved seafood-sauce placement forces `DRAFT — ข้อมูลไม่ครบ`.
8. Browser console has zero local application errors.

- [ ] **Step 3: Verify at 390 px width**

Confirm no body overflow, the recipe tree stacks above the editor, source comparison cards remain readable, and all action buttons are reachable without horizontal page scrolling.

- [ ] **Step 4: Verify existing regression flows**

- Recipe Editor adds/removes ingredients.
- Single/variant mode preserves hidden variants.
- Print Center still switches A4/A5/Booklet/Routing for existing sample recipes.
- Branch Menu Express still resolves its existing dependency count.

- [ ] **Step 5: Capture screenshots**

Save the desktop Source Review/editor state as `preview-kitchen-sot-desktop.png` and the 390 px state as `preview-kitchen-sot-mobile.png`.

- [ ] **Step 6: Update architecture and handoff**

Document:

- `kitchen-sot.js` owns domain state and readiness;
- `import-review-ui.js` owns DOM only;
- `app.js` owns Print Center consumption;
- data is in-memory and resets on reload;
- `print_ready` in Prototype v2 is a mock workflow state, not production approval;
- Google Sheets persistence remains the next separate milestone.

- [ ] **Step 7: Commit**

```bash
git add webapp-prototype/docs/ARCHITECTURE.md webapp-prototype/docs/HANDOFF.md webapp-prototype/preview-kitchen-sot-desktop.png webapp-prototype/preview-kitchen-sot-mobile.png
git commit -m "docs: verify kitchen SOT prototype v2"
```

---

## Stop Condition

Prototype v2 is complete when the first 16 recipes can be navigated by Thai name, edited as in-memory kitchen candidates, evaluated without unit conversion, expanded into named prepared-recipe dependencies, and handed to Print Center with incomplete recipes forced to draft; all existing automated tests and browser regression checks pass. Google Sheet creation, authentication, production approval, and production data mutation are explicitly not part of this plan.
