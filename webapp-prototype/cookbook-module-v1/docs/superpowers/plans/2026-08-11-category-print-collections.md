# Category Print Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Print Center into a collection-first workflow where one click selects a complete kitchen-document category, named collection prints keep external components as references, and a daily packet expands shared dependencies exactly once.

**Architecture:** Keep V6 recipes and the canonical dependency graph as the only sources of truth. Extend the existing pure print-collection helper into a controlled seven-collection catalog, add a pure print-set projection for collection/daily/manual behavior, then let `PrintCenterPage` orchestrate those helpers through a focused collection picker. Recipe Editor edits the existing `category` field; no schema field or copied book document is introduced.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Playwright, Vite, existing print planner and CSS named-page rules.

## Global Constraints

- Work only inside `webapp-prototype/cookbook-module-v1`.
- Use `/opt/homebrew/bin/git`; do not use Apple Git.
- Preserve Stock V1/V2, auth, Supabase, production, deployment, MAW, and CROO boundaries.
- Do not add a dependency.
- Do not mutate real V4, V5, or V6 documents during tests.
- Preserve removed-dependency filtering, readiness derivation, cost-basis exclusion, exact operational text, A5/A4 MediaBoxes, no clipping, no blank tail pages, and print-shell hiding.
- Never infer a collection from a Thai recipe name.
- Preserve unknown non-standard category text until TINE changes it explicitly.
- One named collection is one print job; do not merge unrelated collections into one PDF.
- Named collections reference components outside their collection; only `ชุดงานวันนี้` expands required components into full documents.
- Shared dependencies appear once per daily packet.
- Stage and commit only files owned by the current task; preserve unrelated dirty worktree changes.

---

## File structure

- `src/features/print/printCollections.ts` — controlled catalog and pure recipe-to-collection grouping.
- `src/features/print/printCollections.test.ts` — catalog, recognized category, unknown category, ordering, and empty-collection tests.
- `src/features/print/printSetProjection.ts` — pure collection/reference/daily dependency projection.
- `src/features/print/printSetProjection.test.ts` — graph behavior, external references, shared-component deduplication, and removed-dependency tests.
- `src/features/print/PrintCollectionPicker.tsx` — accessible collection cards and bulk-selection controls.
- `src/features/print/PrintCollectionPicker.test.tsx` — button, count, empty state, select-all, clear-all, and manual override behavior.
- `src/features/print/PrintCenterPage.tsx` — page orchestration, active print set, output intent, proof summary, and current planner integration.
- `src/features/print/PrintCenterPage.test.tsx` — integration behavior across named collection, daily packet, manual selection, booklet, A4, and A5.
- `src/features/print/WorkstationCard.tsx` — compact public code next to referenced prepared components.
- `src/features/print/WorkstationCard.test.tsx` — reference rendering and cost-basis absence.
- `src/features/print/print.css` — collection-first controls and responsive print workspace.
- `src/features/recipe/RecipeEditor.tsx` — controlled standard collection selector backed by the existing `category` field.
- `src/features/recipe/RecipeEditor.test.tsx` — standard selection and legacy custom-category preservation.
- `src/app/AppShell.tsx` and `src/app/AppShell.test.tsx` — discoverable `จัดการสูตร` navigation and correct active state.
- `tests/media-print.spec.ts` — actual-App collection and daily-packet DOM/PDF regression.
- `tests/print-layout.browser.mjs` — existing layout and PDF page-box gate; run unchanged as a regression.

---

### Task 1: Define the controlled print-collection catalog

**Files:**
- Modify: `src/features/print/printCollections.ts`
- Modify: `src/features/print/printCollections.test.ts`

**Interfaces:**
- Produces: `PrintCollectionKey`, `PrintCollectionDefinition`, `STANDARD_PRINT_COLLECTIONS`, `recipePrintCollectionKey(recipe)`, and `buildPrintCollections(recipes)`.
- Consumers: Tasks 2–5.

- [ ] **Step 1: Write failing catalog tests**

Add tests that require all seven collections in fixed operator order, including empty collections, and route unknown category text to `unassigned` without changing the recipe:

```ts
expect(buildPrintCollections([
  { ...makeRecipe({ recipeId: "RCP-MENU", name: "เมนู A", kind: "sellable_menu" }), category: "เมนูอาหาร" },
  { ...makeRecipe({ recipeId: "RCP-CUSTOM", name: "สูตรเดิม", kind: "prepared_recipe" }), category: "หมวดเดิมจากระบบเก่า" },
]).map(({ key, label, recipes }) => ({
  key,
  label,
  ids: recipes.map(({ recipeId }) => recipeId),
}))).toEqual([
  { key: "menu", label: "เมนูอาหาร", ids: ["RCP-MENU"] },
  { key: "meat-prep", label: "เตรียมเนื้อ", ids: [] },
  { key: "sauce", label: "ซอสและน้ำจิ้ม", ids: [] },
  { key: "rice-sides", label: "ข้าวและเครื่องเคียง", ids: [] },
  { key: "stock-prep", label: "น้ำซุปและของเตรียม", ids: [] },
  { key: "plating", label: "จัดจาน", ids: [] },
  { key: "unassigned", label: "ยังไม่จัดหมวด", ids: ["RCP-CUSTOM"] },
]);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/features/print/printCollections.test.ts
```

Expected: FAIL because the current helper emits only categories present in data and uses kind-based fallback groups.

- [ ] **Step 3: Implement the catalog and grouping helpers**

Use these public types and exact labels:

```ts
export type PrintCollectionKey =
  | "menu"
  | "meat-prep"
  | "sauce"
  | "rice-sides"
  | "stock-prep"
  | "plating"
  | "unassigned";

export interface PrintCollectionDefinition {
  key: PrintCollectionKey;
  label: string;
  category: string | null;
}

export const STANDARD_PRINT_COLLECTIONS: readonly PrintCollectionDefinition[] = [
  { key: "menu", label: "เมนูอาหาร", category: "เมนูอาหาร" },
  { key: "meat-prep", label: "เตรียมเนื้อ", category: "เตรียมเนื้อ" },
  { key: "sauce", label: "ซอสและน้ำจิ้ม", category: "ซอสและน้ำจิ้ม" },
  { key: "rice-sides", label: "ข้าวและเครื่องเคียง", category: "ข้าวและเครื่องเคียง" },
  { key: "stock-prep", label: "น้ำซุปและของเตรียม", category: "น้ำซุปและของเตรียม" },
  { key: "plating", label: "จัดจาน", category: "จัดจาน" },
  { key: "unassigned", label: "ยังไม่จัดหมวด", category: null },
];
```

`recipePrintCollectionKey` compares trimmed category text only against definitions whose `category` is non-null. Blank or unknown values return `unassigned`. `buildPrintCollections` always returns all definitions in catalog order and sorts recipes by Thai name then stable recipe identity.

- [ ] **Step 4: Run the catalog tests and verify GREEN**

Run:

```bash
npx vitest run src/features/print/printCollections.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the catalog**

```bash
/opt/homebrew/bin/git add -- src/features/print/printCollections.ts src/features/print/printCollections.test.ts
/opt/homebrew/bin/git commit -m "feat(cookbook): define print collection catalog"
```

---

### Task 2: Make category editing and Recipe Management discoverable

**Files:**
- Modify: `src/features/recipe/RecipeEditor.tsx`
- Modify: `src/features/recipe/RecipeEditor.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/AppShell.test.tsx`

**Interfaces:**
- Consumes: `STANDARD_PRINT_COLLECTIONS` from Task 1.
- Produces: controlled `category` edits using the existing V6 edit path and a sidebar route to `/recipes?mode=manage`.

- [ ] **Step 1: Write failing Recipe Editor and App Shell tests**

Require the sidebar entry and active route:

```tsx
expect(screen.getByRole("link", { name: "จัดการสูตร" })).toHaveAttribute(
  "href",
  "/recipes?mode=manage",
);
expect(screen.getByRole("link", { name: "จัดการสูตร" })).toHaveAttribute(
  "aria-current",
  "page",
);
```

Require a controlled selector that preserves a legacy value until changed:

```tsx
const category = await screen.findByRole("combobox", { name: "หมวดหมู่" });
expect(category).toHaveValue("หมวดเดิมจากระบบเก่า");
expect(within(category).getByRole("option", { name: "หมวดเดิมจากระบบเก่า" })).toBeVisible();
await user.selectOptions(category, "ซอสและน้ำจิ้ม");
expect(category).toHaveValue("ซอสและน้ำจิ้ม");
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/app/AppShell.test.tsx src/features/recipe/RecipeEditor.test.tsx
```

Expected: FAIL because the sidebar has no `จัดการสูตร` entry, manage mode resolves to the recipes section, and category is a free-text input.

- [ ] **Step 3: Implement discoverable management navigation**

Add `manage` to the `Section` union, add a navigation item under `จัดการระบบ`, and resolve `mode=manage` before the default recipes section:

```ts
if (pathname === "/recipes" && params.get("mode") === "manage") return "manage";
```

Add one local `edit` icon to the existing `NavIcon` path table and use it for `จัดการสูตร`; do not add an icon package.

- [ ] **Step 4: Replace category free text with a controlled select**

Build options from `STANDARD_PRINT_COLLECTIONS` excluding `unassigned`. If `draft.category` is a non-empty value not in the standard catalog, prepend one option with that exact value. Include a blank option labelled `ยังไม่จัดหมวด`. Continue calling the existing `change` function; do not create a new persistence operation.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/app/AppShell.test.tsx src/features/recipe/RecipeEditor.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the editor and navigation change**

```bash
/opt/homebrew/bin/git add -- src/app/AppShell.tsx src/app/AppShell.test.tsx src/features/recipe/RecipeEditor.tsx src/features/recipe/RecipeEditor.test.tsx
/opt/homebrew/bin/git commit -m "feat(cookbook): expose recipe collection editing"
```

---

### Task 3: Add a pure print-set projection

**Files:**
- Create: `src/features/print/printSetProjection.ts`
- Create: `src/features/print/printSetProjection.test.ts`
- Modify: `src/features/print/PrintCenterPage.tsx`

**Interfaces:**
- Consumes: `PrintCollectionKey`, `recipePrintCollectionKey`, `buildRecipeGraph`, and `dependencyFirstOrder`.
- Produces:

```ts
export type PrintSetMode =
  | { kind: "collection"; collectionKey: PrintCollectionKey }
  | { kind: "daily" }
  | { kind: "manual"; dependencyPolicy: "reference" | "include" };

export interface PrintSetProjection {
  fullRecipes: RecipeVersion[];
  externalReferences: RecipeVersion[];
  duplicateFree: boolean;
}

export function projectPrintSet(
  recipes: RecipeVersion[],
  selectedRecipeIds: RecipeIdentity[],
  mode: PrintSetMode,
): PrintSetProjection;
```

- [ ] **Step 1: Write failing projection tests**

Create two menus that share one cooked-rice prepared recipe and one removed prepared line. Assert:

```ts
const collection = projectPrintSet(recipes, ["MENU-A", "MENU-B"], {
  kind: "collection",
  collectionKey: "menu",
});
expect(collection.fullRecipes.map(({ recipeId }) => recipeId)).toEqual(["MENU-A", "MENU-B"]);
expect(collection.externalReferences.map(({ recipeId }) => recipeId)).toEqual(["RICE"]);
expect(collection.duplicateFree).toBe(true);

const daily = projectPrintSet(recipes, ["MENU-A", "MENU-B"], { kind: "daily" });
expect(daily.fullRecipes.filter(({ recipeId }) => recipeId === "RICE")).toHaveLength(1);
expect(daily.fullRecipes.some(({ recipeId }) => recipeId === "REMOVED-SAUCE")).toBe(false);
```

Also require collection mode to exclude a selected recipe whose `category` does not match the active collection and require unresolved canonical dependencies to keep throwing rather than being dropped.

- [ ] **Step 2: Run projection tests and verify RED**

Run:

```bash
npx vitest run src/features/print/printSetProjection.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the projection**

Move the current `selectedReachableRecipes` implementation out of `PrintCenterPage.tsx` into this pure module. For collection mode, retain only selected recipes whose derived collection key matches, then collect unique direct active prepared-component targets outside the collection as `externalReferences`. For daily mode, use the canonical graph and dependency-first order. For manual mode, preserve current `reference` versus `include` behavior. Compute `duplicateFree` from stable typed recipe identity keys, never from display names.

- [ ] **Step 4: Wire `PrintCenterPage` to the helper without changing visible UI**

Replace the inline `includedRecipes` conditional with `projectPrintSet`. Keep the current default visible behavior in manual mode so this intermediate commit is behavior-compatible.

- [ ] **Step 5: Run projection, graph, and Print Center tests**

Run:

```bash
npx vitest run src/features/print/printSetProjection.test.ts src/domain/graph/recipeGraph.test.ts src/features/print/PrintCenterPage.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the projection boundary**

```bash
/opt/homebrew/bin/git add -- src/features/print/printSetProjection.ts src/features/print/printSetProjection.test.ts src/features/print/PrintCenterPage.tsx
/opt/homebrew/bin/git commit -m "refactor(cookbook): isolate print set projection"
```

---

### Task 4: Implement collection-first selection controls

**Files:**
- Create: `src/features/print/PrintCollectionPicker.tsx`
- Create: `src/features/print/PrintCollectionPicker.test.tsx`
- Modify: `src/features/print/PrintCenterPage.tsx`
- Modify: `src/features/print/PrintCenterPage.test.tsx`
- Modify: `src/features/print/print.css`

**Interfaces:**
- Consumes: all catalog collections from Task 1 and `PrintSetMode` from Task 3.
- Produces:

```ts
export interface PrintCollectionPickerProps {
  collections: PrintCollection[];
  activeCollectionKey: PrintCollectionKey | null;
  selectedRecipeKeys: readonly string[];
  onChooseCollection(collectionKey: PrintCollectionKey): void;
  onChooseDaily(): void;
  onChooseManual(): void;
  onToggleRecipe(recipeId: RecipeIdentity, checked: boolean): void;
  onSelectAll(collectionKey: PrintCollectionKey): void;
  onClearCollection(collectionKey: PrintCollectionKey): void;
}
```

- [ ] **Step 1: Write failing picker tests**

Require seven named collection buttons with derived counts, an empty disabled collection, bulk selection, clear, and individual override:

```tsx
expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" })).toBeEnabled();
expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด จัดจาน 0 สูตร" })).toBeDisabled();
await user.click(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" }));
expect(onChooseCollection).toHaveBeenCalledWith("sauce");
```

In the Print Center integration test, click the sauce collection and require both sauce recipes selected without clicking their checkboxes.

- [ ] **Step 2: Run picker and Print Center tests and verify RED**

Run:

```bash
npx vitest run src/features/print/PrintCollectionPicker.test.tsx src/features/print/PrintCenterPage.test.tsx
```

Expected: FAIL because collection-first controls do not exist.

- [ ] **Step 3: Implement the picker**

Render collection cards first, followed by the selected collection disclosure. Use real buttons with `aria-pressed`, derived counts, and disabled empty state. Keep native checkboxes inside the expanded collection for adjustment. `เลือกทั้งหมด` and `เอาออกทั้งหมด` accessible names include the collection label.

- [ ] **Step 4: Implement Print Center state transitions**

Use explicit handlers:

```ts
function chooseCollection(collectionKey: PrintCollectionKey): void {
  const collection = collections.find(({ key }) => key === collectionKey);
  setPrintSetMode({ kind: "collection", collectionKey });
  setSelectedKeys(collection?.recipes.map(({ recipeId }) => identityKey(recipeId)) ?? []);
}

function chooseDaily(): void {
  setPrintSetMode({ kind: "daily" });
  setSelectedKeys([]);
}

function chooseManual(): void {
  setPrintSetMode({ kind: "manual", dependencyPolicy: "reference" });
  setSelectedKeys([]);
}
```

If `initialRecipeIds` or `recipe` search parameters exist, initialize manual mode and preserve current deep-link behavior. Collection selection replaces the previous active set. Reorder the normal workflow so print-set choice appears before A4/A5/booklet output intent.

- [ ] **Step 5: Add collection-first CSS**

Use the existing green/gold tokens. On desktop render compact collection cards above the scrollable recipe disclosure; on mobile use one column. Do not add animation beyond the existing 150–180 ms disclosure/menu transitions. Ensure the operator can choose a whole collection without scrolling through the complete catalog.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/features/print/PrintCollectionPicker.test.tsx src/features/print/PrintCenterPage.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 7: Commit the collection-first UI**

```bash
/opt/homebrew/bin/git add -- src/features/print/PrintCollectionPicker.tsx src/features/print/PrintCollectionPicker.test.tsx src/features/print/PrintCenterPage.tsx src/features/print/PrintCenterPage.test.tsx src/features/print/print.css
/opt/homebrew/bin/git commit -m "feat(cookbook): select print sets by collection"
```

---

### Task 5: Render external references and proof-set evidence

**Files:**
- Modify: `src/features/print/WorkstationCard.tsx`
- Modify: `src/features/print/WorkstationCard.test.tsx`
- Modify: `src/features/print/CookbookBooklet.tsx`
- Modify: `src/features/print/PrintCenterPage.tsx`
- Modify: `src/features/print/PrintCenterPage.test.tsx`
- Modify: `src/features/print/print.css`

**Interfaces:**
- Consumes: `PrintSetProjection.externalReferences` and stable recipe identity maps.
- Produces: compact name/code references on menu documents and a proof summary containing collection name, selected count, output count, external-reference count, and duplicate-free status.

- [ ] **Step 1: Write failing reference and proof tests**

For a menu collection containing two menus that share cooked rice, require no cooked-rice full recipe article and require compact references:

```tsx
expect(screen.queryByRole("article", { name: "ข้าวญี่ปุ่นหุงสุก" })).not.toBeInTheDocument();
expect(screen.getAllByText("ข้าวญี่ปุ่นหุงสุก · RCP-RICE")).toHaveLength(2);
expect(screen.getByText("อ้างอิงสูตรนอกหมวด 1 สูตร")).toBeVisible();
expect(screen.getByText("ไม่มีเอกสารซ้ำ")).toBeVisible();
```

For daily mode, require one full cooked-rice document and zero duplicate full documents. Retain the existing assertion that no cost-basis text appears.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/features/print/WorkstationCard.test.tsx src/features/print/PrintCenterPage.test.tsx
```

Expected: FAIL because Workstation cards do not show component public codes and the proof header lacks collection evidence.

- [ ] **Step 3: Add a component-label resolver to WorkstationCard**

Extend props without changing `WorkDocument`:

```ts
componentLabelFor?: (componentRecipeId: RecipeIdentity) => string | null;
```

For an ingredient whose `componentRecipeId` is non-null, render the returned label as a compact secondary line beneath `itemName`. Keep the original amount and serving note byte-exact. If the resolver returns null, render no invented code.

- [ ] **Step 4: Reuse the resolver in Print Center and preserve booklet behavior**

Build one `recipesByIdentity` map in Print Center and pass a resolver to every Workstation card. Keep `CookbookBooklet` direct component references, but ensure named collection mode receives only collection recipes while daily mode receives the deduplicated expanded set.

- [ ] **Step 5: Add the proof summary**

Render exact operational labels from projection state:

```tsx
<span>{activeCollection?.label ?? "ชุดเลือกเอง"}</span>
<span>{selectedRecipes.length} สูตร</span>
<span>{outputCount} {outputIntent === "booklet" ? "หน้าสูตร" : "แผ่น"}</span>
<span>อ้างอิงสูตรนอกหมวด {projection.externalReferences.length} สูตร</span>
<span>{projection.duplicateFree ? "ไม่มีเอกสารซ้ำ" : "พบเอกสารซ้ำ"}</span>
```

Duplicate state is derived from typed identities. Do not show a success claim when projection failed.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/features/print/WorkstationCard.test.tsx src/features/print/PrintCenterPage.test.tsx src/features/print/printSetProjection.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit reference and proof rendering**

```bash
/opt/homebrew/bin/git add -- src/features/print/WorkstationCard.tsx src/features/print/WorkstationCard.test.tsx src/features/print/CookbookBooklet.tsx src/features/print/PrintCenterPage.tsx src/features/print/PrintCenterPage.test.tsx src/features/print/print.css
/opt/homebrew/bin/git commit -m "feat(cookbook): show collection print references"
```

---

### Task 6: Lock actual-App and PDF behavior

**Files:**
- Modify: `tests/media-print.spec.ts`
- Verify unchanged: `tests/print-layout.browser.mjs`
- Create: `docs/handoffs/2026-08-11-category-print-collections.md`

**Interfaces:**
- Consumes: completed collection-first Print Center.
- Produces: browser/PDF evidence and a handoff record for the future ERP module.

- [ ] **Step 1: Capture immutable-source baselines**

From the vault root, record before hashes without writing files:

```bash
shasum -a 256 Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json
shasum -a 256 Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json
(cd Operations/CookBook/sot/v4-2026-08-05 && shasum -c SHA256SUMS.txt)
```

If a real V5 or V6 file is absent, record `absent`; do not create it.

- [ ] **Step 2: Write failing actual-App tests**

Add a deterministic V6 fixture with two menu recipes sharing cooked rice and categorized sauce/rice collections. Test:

- one click selects all sauce recipes;
- named menu collection prints menu full documents only;
- external cooked-rice reference count is one;
- daily packet prints cooked rice once;
- removed dependency never appears;
- cost basis never appears;
- App shell and controls are hidden in print media;
- DOM sheet count equals PDF MediaBox count;
- every A5/A4 sheet has `scrollWidth === clientWidth` and `scrollHeight === clientHeight`.

- [ ] **Step 3: Run the focused browser test and verify RED**

Run:

```bash
npx playwright test tests/media-print.spec.ts -g "prints named collections and deduplicates the daily packet"
```

Expected: FAIL before the collection UI and projection are connected to the actual app.

- [ ] **Step 4: Make only test-seam adjustments required by the real flow**

Use stable roles, accessible labels, collection names, and DOM sheet counts. Do not weaken exact MediaBox, clipping, blank-tail, shell-hiding, removed-dependency, or cost-basis assertions. Do not hardcode PDF page counts separately from rendered logical sheet counts.

- [ ] **Step 5: Run the sequential verification gate**

Run in this exact order and stop at the first failure:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:browser
npm run test:browser:export
npm run test:e2e
npm run test:e2e:local-draft
npm run test:e2e:v6
/opt/homebrew/bin/git diff --check
```

Expected: every command exits 0. Record unit file/test counts and Playwright passed/failed/did-not-run counts.

- [ ] **Step 6: Recheck immutable sources**

Repeat the Step 1 commands and compare exact before/after V5 and V6 hashes. Require V4 `5/5 OK`. Any mutation is a hard failure.

- [ ] **Step 7: Update the handoff**

Create `docs/handoffs/2026-08-11-category-print-collections.md` with:

- collection catalog and one-print-job boundary;
- named collection versus daily packet dependency policy;
- exact verification counts;
- actual-App DOM/PDF evidence;
- immutable-source evidence;
- remaining work, including category assignment by TINE and physical printer verification.

- [ ] **Step 8: Commit the verified gate and handoff**

```bash
/opt/homebrew/bin/git add -- tests/media-print.spec.ts docs/handoffs/2026-08-11-category-print-collections.md
/opt/homebrew/bin/git commit -m "test(cookbook): verify category print collections"
```

Before committing, run `/opt/homebrew/bin/git diff --cached --name-status` and remove any unrelated staged file.

---

## Completion evidence

The milestone is complete only when:

1. all 15 acceptance criteria in `docs/superpowers/specs/2026-08-11-category-print-collections-design.md` map to passing tests or fresh actual-App evidence;
2. two menus sharing cooked rice produce no appended rice SOP in a named menu collection and exactly one rice SOP in a daily packet;
3. category-wide selection needs one collection action, not individual recipe ticking;
4. Recipe Management and category editing are discoverable from the sidebar;
5. every sequential gate exits 0;
6. V4 is 5/5 and real V5/V6 hashes are unchanged;
7. no Stock, auth, Supabase, production, deployment, MAW, or CROO file changed;
8. unrelated pre-existing dirty worktree files remain preserved.
