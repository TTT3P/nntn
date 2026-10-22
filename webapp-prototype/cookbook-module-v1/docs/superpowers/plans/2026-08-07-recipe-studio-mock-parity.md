# Recipe Studio Mock-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local-pilot Recipe Studio match `webapp-prototype/preview-kitchen-sot-desktop.png` and its mobile companion while preserving all verified V5 persistence and readiness behavior.

**Architecture:** Keep `KitchenSotDraftProvider`, the raw V5 document, existing `KitchenSotEdit` commands, validation, transport, and middleware unchanged. Recompose `KitchenSotFillSurface` into the approved header/summary/queue/detail hierarchy and isolate its visual rules in a route-scoped stylesheet. Add DOM and browser-layout regressions before each presentation change.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, CSS Grid/Flexbox.

## Global Constraints

- Cookbook Module V1 local pilot only.
- Use `webapp-prototype/preview-kitchen-sot-desktop.png` as the desktop visual source of truth and `webapp-prototype/preview-kitchen-sot-mobile.png` for narrow screens.
- Do not change V5 persistence, validation, optimistic concurrency, readiness predicates, raw-document ownership, or endpoint behavior.
- Do not change recipe content, `candidate_text` display rules, V4 bytes, V4 checksum files, or create the real V5 draft during tests.
- Do not start Print Milestone 2 or redesign Print Center/Work surfaces.
- Do not touch Stock V1/V2, Supabase, authentication, production data, deployment, MAW, or CROO.
- Do not add dependencies.
- Preserve existing accessible names and stable selectors used by the M1 regression suite.
- Use `/opt/homebrew/bin/git` for read-only status/diff checks. Do not commit unless TINE gives a direct commit instruction.

---

## File Map

- Create `src/features/review/recipe-studio.css`: route-scoped palette, shell, summary, queue, detail, editor, save-bar, and responsive styles.
- Modify `src/features/review/KitchenSotFillSurface.tsx`: approved page hierarchy, derived queue filters, and presentation class names; retain existing edit dispatches verbatim.
- Modify `src/features/review/KitchenSotFillSurface.test.tsx`: structure, filtering, selection, labels, and preserved V5 edit/save regressions.
- Create `tests/recipe-studio-layout.spec.ts`: desktop/mobile geometry and overflow acceptance without writing V5.
- Modify `playwright.config.ts` only if the new layout spec is not already discovered by the default `tests/**/*.spec.ts` pattern.
- Modify `docs/HANDOFF.md`: record visual-milestone evidence only after every gate passes.

### Task 1: Lock the approved workspace hierarchy

**Files:**
- Modify: `src/features/review/KitchenSotFillSurface.test.tsx`
- Modify: `src/features/review/KitchenSotFillSurface.tsx`
- Create: `src/features/review/recipe-studio.css`

**Interfaces:**
- Consumes: `useKitchenSotDraft(): KitchenSotDraftContextValue`, `isKitchenSotRecipeDraft(recipe)`, and the current `KitchenSotEdit` dispatch contract.
- Produces: `.recipe-studio`, `.recipe-studio__summary`, `.recipe-studio__workspace`, `.recipe-studio__queue`, and `.recipe-studio__detail` layout hooks for Task 4.

- [ ] **Step 1: Add a failing structure test**

Add assertions to the existing durable-surface render helper so the selected recipe content remains driven by the fixture while the new visual hierarchy is required:

```tsx
expect(screen.getByText("SOURCE REVIEW · NO CONVERSION")).toBeVisible();
expect(screen.getByRole("heading", { level: 2, name: "ตรวจสอบสูตรจากที่คุณหนู" })).toBeVisible();
expect(screen.getByRole("region", { name: "สรุปข้อมูล Kitchen SOT" })).toHaveClass("recipe-studio__summary");
expect(screen.getByRole("navigation", { name: "คิวสูตร Kitchen SOT" })).toHaveClass("recipe-studio__queue");
expect(screen.getByRole("article", { name: /รายละเอียดสูตร/u })).toHaveClass("recipe-studio__detail");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- src/features/review/KitchenSotFillSurface.test.tsx
```

Expected: failure because the approved headings, regions, and layout classes do not exist yet; existing persistence assertions remain green.

- [ ] **Step 3: Recompose the page shell without changing edit handlers**

Import the route stylesheet and change the existing wrapper tags in place:

```tsx
import "./recipe-studio.css";

<section className="recipe-studio" aria-labelledby="source-review-title">
<header className="recipe-studio__intro">
<section className="recipe-studio__summary" aria-label="สรุปข้อมูล Kitchen SOT">
<div className="recipe-studio__workspace">
<nav className="recipe-studio__queue" aria-label="คิวสูตร Kitchen SOT">
<article className="recipe-studio__detail" aria-label={`รายละเอียดสูตร ${selectedRecipe.recipe_name}`}>
<footer className="sot-save-bar">
```

Place the current summary, queue, selected-recipe content, and save controls inside those wrappers, preserving their order. Add the eyebrow and approved heading text to the intro. Do not alter `applyEdit`, `save`, `saving`, field values, validation messages, `role="status"`, or `role="alert"`.

- [ ] **Step 4: Add route-scoped foundation styles**

Start `recipe-studio.css` with mock-derived tokens and containment:

```css
.recipe-studio {
  --studio-green-700: #173d20;
  --studio-green-600: #1f4e2a;
  --studio-green-50: #eaf2ec;
  --studio-gold-500: #c9962c;
  --studio-ink-900: #141a13;
  --studio-ink-600: #5f6860;
  --studio-ink-200: #e6e8e3;
  --studio-surface: #fff;
  width: min(1680px, calc(100vw - 40px));
  color: var(--studio-ink-900);
}

.recipe-studio__workspace {
  display: grid;
  grid-template-columns: minmax(300px, 0.82fr) minmax(0, 1.68fr);
  gap: 22px;
  align-items: start;
}
```

Every selector in this file must start with `.recipe-studio` or a `recipe-studio__`/`sot-` class rendered only inside this route. Do not change Print Center CSS or global field rules.

- [ ] **Step 5: Run focused tests and diff check**

Run:

```bash
npm test -- src/features/review/KitchenSotFillSurface.test.tsx
/opt/homebrew/bin/git diff --check
```

Expected: focused suite passes and diff check emits no errors.

- [ ] **Step 6: Record an uncommitted checkpoint**

Run:

```bash
/opt/homebrew/bin/git status --short
/opt/homebrew/bin/git diff -- src/features/review/KitchenSotFillSurface.tsx src/features/review/KitchenSotFillSurface.test.tsx src/features/review/recipe-studio.css
```

Expected: only approved Cookbook files plus the already-approved spec/plan are present. Do not commit without a direct TINE instruction.

### Task 2: Match the mock queue, filters, summary, and selection

**Files:**
- Modify: `src/features/review/KitchenSotFillSurface.test.tsx`
- Modify: `src/features/review/KitchenSotFillSurface.tsx`
- Modify: `src/features/review/recipe-studio.css`

**Interfaces:**
- Consumes: `draft.document.recipes`, `draft.summary`, `identityKey`, `isKitchenSotRecipeDraft`, and `isOwnerProvenanceIncomplete`.
- Produces: local view-only `query`, `typeFilter`, and `statusFilter` state; it never mutates or reorders `draft.document.recipes`.

- [ ] **Step 1: Add failing queue behavior tests**

Add tests that prove filters are view-only and selection still controls the raw recipe detail:

```tsx
const search = screen.getByRole("searchbox", { name: "ค้นหาสูตร" });
await user.type(search, "ผงคั่วพริกเกลือ");
expect(screen.getByRole("button", { name: /ผงคั่วพริกเกลือ/u })).toBeVisible();
expect(screen.queryByRole("button", { name: /ข้าวหน้าเนื้อยากินิกุ/u })).not.toBeInTheDocument();
await user.clear(search);
await user.click(screen.getByRole("button", { name: /ข้าวหน้าเนื้อยากินิกุ/u }));
expect(screen.getByRole("heading", { level: 3, name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
```

Add an assertion that the four summary values equal the fixture-derived `draft.summary` values rather than literals.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- src/features/review/KitchenSotFillSurface.test.tsx
```

Expected: failure because the search/filter controls and mock queue cards do not exist.

- [ ] **Step 3: Implement view-only queue derivation**

Add local state and a derived list inside `KitchenSotFillSurface`:

```tsx
const [query, setQuery] = useState("");
const [typeFilter, setTypeFilter] = useState<"all" | "sellable_menu" | "prepared_recipe">("all");
const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "ready">("all");

const visibleRecipes = draft.document.recipes.filter((recipe) => {
  const matchesQuery = recipe.recipe_name.toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th"));
  const matchesType = typeFilter === "all" || recipe.recipe_type === typeFilter;
  const draftRecipe = isKitchenSotRecipeDraft(recipe);
  const matchesStatus = statusFilter === "all" || (statusFilter === "draft" ? draftRecipe : !draftRecipe);
  return matchesQuery && matchesType && matchesStatus;
});
```

Render labelled search/type/status controls above the queue. Keep selection state keyed by `identityKey`; filtering must not mutate the document, change the saved selection, or generate edits.

- [ ] **Step 4: Render mock-aligned summary and queue cards**

Use semantic list buttons with a separate name, type, revision, status badge, unresolved-blocker count, and provenance cue. Preserve the existing full accessible button name pattern so `/recipe name/u` E2E locators continue to work.

Style the summary as four cards and the queue as the mock's compact table/card list. Active selection uses green tint and a visible border; DRAFT uses warning/danger colors; READY uses green.

- [ ] **Step 5: Run the focused suite**

Run:

```bash
npm test -- src/features/review/KitchenSotFillSurface.test.tsx
```

Expected: all existing V5 edit/save tests and new view-only filter tests pass.

### Task 3: Match the recipe detail and editing cards without touching V5 edits

**Files:**
- Modify: `src/features/review/KitchenSotFillSurface.test.tsx`
- Modify: `src/features/review/KitchenSotFillSurface.tsx`
- Modify: `src/features/review/recipe-studio.css`

**Interfaces:**
- Consumes: unchanged `ItemEditor`, `MethodAndYieldEditor`, and `BlockerEditor` edit payloads.
- Produces: mock-aligned source evidence, item, method/yield, blocker, and save presentation while retaining every existing accessible label.

- [ ] **Step 1: Add failing detail-presentation assertions**

Require stable visual hooks while reusing functional locators:

```tsx
expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveClass("recipe-studio__status");
expect(screen.getByRole("heading", { name: "วัตถุดิบและหลักฐานที่เลือก" }).closest("section"))
  .toHaveClass("recipe-studio__section");
expect(screen.getByLabelText(/หลักฐานต้นทาง/u).closest("fieldset"))
  .toHaveClass("recipe-studio__item-card");
expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeVisible();
```

Keep the existing tests that inspect submitted raw fields, decision notes, blocker resolution, stale state, and save locking unchanged.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- src/features/review/KitchenSotFillSurface.test.tsx
```

Expected: only the new presentation-hook assertions fail.

- [ ] **Step 3: Add presentation classes and grouping**

Apply these exact `className` replacements without rewriting event handlers:

```tsx
className="sot-edit-grid recipe-studio__item-card"
className="sot-edit-grid recipe-studio__section recipe-studio__method-card"
className="sot-blocker recipe-studio__blocker-card"
```

Represent source evidence as compact source cards, place `candidate_text`, selected source, and decision status in a clear current-value strip, and keep `owner_confirmation`, serving note, and cost basis fields visibly separated. Do not hide any source value or blocker message.

- [ ] **Step 4: Apply mock-derived detail styles**

Implement white cards, 20px radii, subtle borders/shadows, 48px controls, green focus rings, compact provenance grids, clear DRAFT banners, and a sticky save bar within the detail column. Disabled and stale states must remain visibly disabled; alerts use the existing danger palette.

- [ ] **Step 5: Prove V5 edit behavior still passes**

Run:

```bash
npm test -- src/features/review/KitchenSotFillSurface.test.tsx src/features/review/KitchenSotDraftProvider.test.tsx src/domain/sot/kitchenSotEdits.test.ts src/domain/sot/kitchenSotValidation.test.ts
```

Expected: all tests pass; no snapshot reconstruction, schema mutation, or transport change appears in the diff.

### Task 4: Prove responsive mock parity and rerun the full M1 gate

**Files:**
- Create: `tests/recipe-studio-layout.spec.ts`
- Modify: `src/features/review/recipe-studio.css`
- Modify: `docs/HANDOFF.md`

**Interfaces:**
- Consumes: Task 1 layout hooks and the existing dev-only V4 read endpoint.
- Produces: browser evidence that the page is two-column on desktop, one-column on mobile, overflow-free, and read-only during layout verification.

- [ ] **Step 1: Add a failing browser layout spec**

Create a Playwright test that never fills or saves a field:

```ts
import { expect, test } from "@playwright/test";

test("Recipe Studio follows the approved desktop and mobile structure", async ({ page }) => {
  await page.goto("./#/source-review");
  await expect(page.getByRole("heading", { name: "ตรวจสอบสูตรจากที่คุณหนู" })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  const queue = page.getByRole("navigation", { name: "คิวสูตร Kitchen SOT" });
  const detail = page.getByRole("article", { name: /รายละเอียดสูตร/u });
  const queueBox = await queue.boundingBox();
  const detailBox = await detail.boundingBox();
  expect(queueBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(queueBox!.x + queueBox!.width).toBeLessThan(detailBox!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileQueueBox = await queue.boundingBox();
  const mobileDetailBox = await detail.boundingBox();
  expect(mobileQueueBox).not.toBeNull();
  expect(mobileDetailBox).not.toBeNull();
  expect(mobileDetailBox!.y).toBeGreaterThan(mobileQueueBox!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
```

- [ ] **Step 2: Run the browser spec and confirm RED if responsive CSS is incomplete**

Run:

```bash
npx playwright test tests/recipe-studio-layout.spec.ts --workers=1
```

Expected before the final responsive styles: the mobile stacking or overflow assertion fails.

- [ ] **Step 3: Finish responsive styles**

Add a breakpoint at `980px` that switches `.recipe-studio__workspace` to one column, removes sticky positioning from the queue/detail containers, collapses filters to one column as space requires, and keeps the save bar in normal flow on very narrow screens. Add `min-width: 0`, `overflow-wrap: anywhere`, and responsive evidence-card rules only where needed to eliminate body overflow.

- [ ] **Step 4: Run targeted browser and unit checks**

Run sequentially:

```bash
npm test -- src/features/review/KitchenSotFillSurface.test.tsx
npx playwright test tests/recipe-studio-layout.spec.ts --workers=1
```

Expected: focused unit suite passes; layout spec passes at 1440×1000 and 390×844 without saving data.

- [ ] **Step 5: Capture visual evidence outside the repository**

Use the running local app to capture desktop and mobile screenshots under `/private/tmp/cookbook-recipe-studio-visual-20260807/`. Compare them with the two approved preview PNGs for hierarchy, palette, spacing, cards, statuses, and responsive stacking. Do not place screenshot artifacts in the repository.

- [ ] **Step 6: Run the full sequential M1 regression gate**

Run each command only after the previous command succeeds:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:browser
npm run test:browser:export
npm run test:e2e
npm run test:e2e:local-draft
/opt/homebrew/bin/git diff --check
```

Expected: every command exits 0; local-draft remains 2/2; default E2E includes the new layout spec and has zero failures.

- [ ] **Step 7: Verify safety invariants**

Run the existing checksum verification documented in `docs/HANDOFF.md`, confirm all V4 manifest entries pass, and confirm this path is absent:

```text
Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json
```

Expected: V4 checksum remains `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`; the real V5 draft is absent; no Stock, Supabase, auth, production, or deployment files appear in the diff.

- [ ] **Step 8: Update handoff evidence and report the uncommitted result**

Append the visual milestone status, screenshot paths, gate counts, unchanged V4 SHA, absent real V5, and remaining scope (`Print/Work = M2`) to `docs/HANDOFF.md`. Run:

```bash
/opt/homebrew/bin/git status --short
/opt/homebrew/bin/git diff --stat
/opt/homebrew/bin/git diff --check
```

Do not claim GO if any gate fails or if visual comparison still materially differs from the approved mock. Do not commit without a direct TINE instruction.
