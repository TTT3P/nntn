# Intelligent CookingBook Module V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone React/TypeScript CookingBook V1 prototype that preserves verified kitchen quantities, projects one recipe graph into Prep/Cook/Service documents, supports ordered step media, and prints photo-aware A5/A4 packs without touching the operational NNTN frontend or production Supabase.

**Architecture:** Create a new local repository at `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook`. Keep domain logic in pure TypeScript modules behind a `CookbookRepository` interface, render the app through feature pages, and use a session-only fixture adapter for the prototype. Port validated behavior from the static prototype rather than importing its runtime code; production persistence is a separate future plan.

**Tech Stack:** React, TypeScript, Vite, React Router with `HashRouter`, Vitest, React Testing Library, Playwright, plain CSS with print media rules.

## Global Constraints

- The operational repository `/Users/trirongyinwichapoon/tt3p/product-hub/nntn` is read-only during implementation except for reading the approved fixtures and documents.
- The new application lives in `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook`; do not create or push a GitHub remote in this plan.
- The prototype performs zero requests and zero writes to production Supabase, Storage, Google Sheets, or the NNTN frontend.
- Source kitchen value/text/unit is authoritative. Never derive grams, milliliters, spoons, yield, or method text without explicit source evidence.
- Missing media is non-blocking and must not create `DRAFT`; missing quantity, method, dependency, or unresolved source conflict may block approved printing.
- Work-stage order is always `prep → cook → service`.
- Service quantities are per serving and are never multiplied by a batch multiplier.
- Default print format is A5 landscape; A4 portrait two-up contains exactly two A5 card slots.
- Prototype persistence is session-only. Reload restores versioned fixtures, and the UI must say this clearly.
- Runtime dependencies are limited to React and React Router. Test/build dependencies are Vite, TypeScript, Vitest, Testing Library, ESLint, and Playwright.
- V1 is single-organization. Branding is configuration; no tenant, billing, marketplace, stock, POS, or Food Cost engine is introduced.
- Every behavior change starts with a failing test and ends with targeted tests, then lint/typecheck/build as appropriate.

---

## Planned File Structure

```text
nntn-cookbook/
├── docs/
│   ├── PRD.html
│   ├── DESIGN.md
│   └── HANDOFF.md
├── public/
│   └── sample-media/
│       ├── prep-cut-size.svg
│       ├── cook-doneness.svg
│       └── service-delivery-layout.svg
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── App.test.tsx
│   │   ├── router.tsx
│   │   └── styles.css
│   ├── config/
│   │   └── brand.ts
│   ├── data/
│   │   ├── CookbookRepository.ts
│   │   ├── FixtureCookbookRepository.ts
│   │   ├── FixtureCookbookRepository.test.ts
│   │   └── fixtures/first-set.json
│   ├── domain/
│   │   ├── cookbook/types.ts
│   │   ├── graph/recipeGraph.ts
│   │   ├── graph/recipeGraph.test.ts
│   │   ├── review/readiness.ts
│   │   ├── review/readiness.test.ts
│   │   ├── work/workDocuments.ts
│   │   ├── work/workDocuments.test.ts
│   │   ├── media/stepMedia.ts
│   │   ├── media/stepMedia.test.ts
│   │   ├── print/printPlanner.ts
│   │   └── print/printPlanner.test.ts
│   ├── features/
│   │   ├── library/RecipeLibraryPage.tsx
│   │   ├── library/RecipeLibraryPage.test.tsx
│   │   ├── recipe/RecipeDetailPage.tsx
│   │   ├── recipe/RecipeDetailPage.test.tsx
│   │   ├── review/SourceReviewPage.tsx
│   │   ├── review/SourceReviewPage.test.tsx
│   │   ├── work/WorkStagePage.tsx
│   │   ├── work/WorkStagePage.test.tsx
│   │   ├── media/StepMediaEditor.tsx
│   │   ├── media/StepMediaEditor.test.tsx
│   │   ├── print/PrintCenterPage.tsx
│   │   ├── print/PrintCenterPage.test.tsx
│   │   ├── print/WorkstationCard.tsx
│   │   └── print/print.css
│   ├── prototype/
│   │   ├── PrototypeProvider.tsx
│   │   ├── prototypeReducer.ts
│   │   ├── prototypeReducer.test.ts
│   │   ├── snapshotExport.ts
│   │   └── snapshotExport.test.ts
│   ├── test/
│   │   ├── setup.ts
│   │   ├── builders.ts
│   │   └── renderWithPrototype.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/
│   ├── cookbook-flow.spec.ts
│   ├── media-print.spec.ts
│   └── no-production-network.spec.ts
├── eslint.config.js
├── index.html
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

The domain modules are the deep interfaces. UI pages consume their outputs and do not reproduce graph traversal, readiness, media ordering, or pagination logic.

## Shared Test Builder Contract

Task 2 creates `src/test/builders.ts`. Every later unit/component test imports these builders instead of creating incompatible local shapes:

```ts
export function makeIngredientLine(overrides: Partial<IngredientLine> = {}): IngredientLine;
export function makeWorkStep(overrides: Partial<WorkStep> = {}): WorkStep;
export function makeRecipe(overrides: Partial<RecipeVersion> = {}): RecipeVersion;
export function makeMediaAsset(overrides: Partial<MediaAsset> = {}): MediaAsset;
export function makeStepMediaLink(overrides: Partial<StepMediaLink> = {}): StepMediaLink;
export function makeSnapshot(overrides: Partial<CookbookSnapshot> = {}): CookbookSnapshot;
export function renderWithPrototype(
  ui: React.ReactElement,
  options?: { snapshot?: CookbookSnapshot; route?: string }
): ReturnType<typeof render>;
```

Tests that use the verified first set include this exact setup:

```ts
const repository = new FixtureCookbookRepository();
let firstSet: CookbookSnapshot;

beforeAll(async () => {
  firstSet = await repository.loadSnapshot();
});
```

---

### Task 1: Standalone Application Foundation

**Files:**
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/package.json`
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/vite.config.ts`
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/src/config/brand.ts`
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/src/app/App.tsx`
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/src/app/App.test.tsx`
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/src/app/styles.css`
- Create: remaining standard Vite React TypeScript scaffold files

**Interfaces:**
- Consumes: approved PRD and design only; no runtime code from the static prototype
- Produces: `brandConfig`, working test/lint/typecheck/build scripts, and the app shell used by all later tasks

- [ ] **Step 1: Create the isolated local repository and scaffold React TypeScript**

Run:

```bash
mkdir -p /Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook
cd /Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook
git init -b main
npm create vite@latest . -- --template react-ts
npm install react-router-dom
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test
```

Expected: a local Git repository exists with no remote and `npm install` succeeds.

- [ ] **Step 2: Configure scripts and GitHub Pages base**

Set package scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc -b --pretty false",
    "preview": "vite preview"
  }
}
```

Configure `vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/nntn-cookbook/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
```

- [ ] **Step 3: Write the failing app-shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("labels the app as a local prototype", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "CookingBook" })).toBeInTheDocument();
  expect(screen.getByText("Prototype · ข้อมูลเฉพาะเครื่อง")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the test and verify failure**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the new shell copy is not rendered.

- [ ] **Step 5: Implement branding configuration and the minimal shell**

```ts
export const brandConfig = {
  productName: "CookingBook",
  organizationName: "NNTN",
  prototypeLabel: "Prototype · ข้อมูลเฉพาะเครื่อง"
} as const;
```

`App.tsx` must read these values rather than hardcoding NNTN inside domain modules.

- [ ] **Step 6: Run foundation checks**

Run:

```bash
npm test -- src/app/App.test.tsx
npm run lint
npm run typecheck
npm run build
```

Expected: all commands pass and `dist/` is generated.

- [ ] **Step 7: Copy the approved product documents and commit**

```bash
mkdir -p docs
cp /Users/trirongyinwichapoon/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype/docs/prd/intelligent-cookbook-module-v1-prd.html docs/PRD.html
cp /Users/trirongyinwichapoon/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype/docs/superpowers/specs/2026-08-04-intelligent-cookbook-module-v1-design.md docs/DESIGN.md
git add .
git commit -m "chore: scaffold standalone cookbook app"
```

---

### Task 2: Canonical Domain Types and Fixture Repository

**Files:**
- Create: `src/domain/cookbook/types.ts`
- Create: `src/data/CookbookRepository.ts`
- Create: `src/data/FixtureCookbookRepository.ts`
- Create: `src/data/FixtureCookbookRepository.test.ts`
- Create: `src/data/fixtures/first-set.json`
- Create: `src/test/builders.ts`

**Interfaces:**
- Consumes: static source fixture `kitchen-sot-first-set-v2.json`
- Produces: `CookbookSnapshot`, `RecipeVersion`, `CookbookRepository.loadSnapshot()`, explicit prototype capabilities, and shared test builders

- [ ] **Step 1: Define the canonical public types**

```ts
export type RecipeKind = "sellable_menu" | "prepared_recipe";
export type WorkStage = "prep" | "cook" | "service";
export type ReviewState = "confirmed" | "candidate" | "conflict" | "blocked";

export interface IngredientLine {
  lineKey: string;
  itemName: string;
  itemKind: "direct_ingredient" | "prepared_recipe";
  ingredientId: number | null;
  componentRecipeId: number | null;
  sourceText: string | null;
  sourceValue: number | null;
  sourceUnit: string | null;
  decisionStatus: string;
  selectedSource: string | null;
}

export interface WorkStep {
  stepId: string;
  stage: WorkStage;
  instruction: string;
  order: number;
}

export interface WorkDocument {
  stage: WorkStage;
  scalable: boolean;
  ingredientLineKeys: string[];
  steps: WorkStep[];
}

export interface RecipeVersion {
  recipeId: number;
  recipeVersionId: string;
  name: string;
  kind: RecipeKind;
  parentRecipeIds: number[];
  reviewState: ReviewState;
  sourceLocators: string[];
  lines: IngredientLine[];
  methodText: string | null;
  blockers: string[];
  operationalNotes: string[];
  workDocuments: Partial<Record<WorkStage, WorkDocument>>;
}

export interface CookbookSnapshot {
  recipes: RecipeVersion[];
  media: MediaAsset[];
  stepMedia: StepMediaLink[];
}
```

`MediaAsset` and `StepMediaLink` are declared in the same file now and implemented behaviorally in Task 8.

- [ ] **Step 2: Define the repository boundary**

```ts
export interface RepositoryCapabilities {
  persistence: "session" | "durable";
  mediaUpload: boolean;
  production: boolean;
}

export interface CookbookRepository {
  readonly capabilities: RepositoryCapabilities;
  loadSnapshot(): Promise<CookbookSnapshot>;
  saveSessionSnapshot(snapshot: CookbookSnapshot): Promise<{ persisted: false; scope: "session" }>;
}
```

- [ ] **Step 3: Copy the verified fixture**

Run:

```bash
mkdir -p src/data/fixtures
cp /Users/trirongyinwichapoon/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype/data/kitchen-sot-first-set-v2.json src/data/fixtures/first-set.json
```

- [ ] **Step 4: Write failing fixture mapping tests**

```ts
test("loads the 18 versioned recipes without normalizing kitchen quantities", async () => {
  const snapshot = await repository.loadSnapshot();
  expect(snapshot.recipes).toHaveLength(18);
  const vegetables = snapshot.recipes.find((recipe) => recipe.name === "ผัดผัก");
  expect(vegetables?.lines.some((line) => line.sourceText === "1 ช้อนชา")).toBe(true);
});

test("advertises session-only non-production capabilities", () => {
  expect(repository.capabilities).toEqual({
    persistence: "session",
    mediaUpload: false,
    production: false
  });
});
```

- [ ] **Step 5: Run tests and verify failure**

Run: `npm test -- src/data/FixtureCookbookRepository.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 6: Implement deterministic fixture mapping**

Map snake_case fixture properties to the public types. For each method step, create:

```ts
function stepId(recipeVersionId: string, stage: WorkStage, order: number): string {
  return `${recipeVersionId}:${stage}:${order}`;
}
```

Do not parse or calculate a new numeric quantity from `candidate_text`; keep it in `sourceText` and copy numeric fields only when the fixture explicitly supplies them.

- [ ] **Step 7: Implement the shared test builders**

Use complete defaults so an override always produces a valid public type:

```ts
export function makeRecipe(overrides: Partial<RecipeVersion> = {}): RecipeVersion {
  return {
    recipeId: 1,
    recipeVersionId: "test-v1-1",
    name: "สูตรทดสอบ",
    kind: "prepared_recipe",
    parentRecipeIds: [],
    reviewState: "confirmed",
    sourceLocators: ["TEST"],
    lines: [],
    methodText: "1. ทำตามขั้นตอนทดสอบ",
    blockers: [],
    operationalNotes: [],
    workDocuments: {},
    ...overrides
  };
}
```

Implement the other builder signatures from the shared contract with the same override-last rule.

- [ ] **Step 8: Verify and commit**

```bash
npm test -- src/data/FixtureCookbookRepository.test.ts
npm run typecheck
git add src/domain src/data src/test
git commit -m "feat: load verified cookbook fixtures"
```

---

### Task 3: Recipe Graph and Dependency Ordering

**Files:**
- Create: `src/domain/graph/recipeGraph.ts`
- Create: `src/domain/graph/recipeGraph.test.ts`

**Interfaces:**
- Consumes: `RecipeVersion[]`
- Produces: `buildRecipeGraph(recipes, rootRecipeIds)`, `dependencyFirstOrder(graph)`, and named cycle errors

- [ ] **Step 1: Write failing graph tests**

```ts
test("separates sellable menus, prepared recipes, and direct ingredients", () => {
  const fixtures = firstSet.recipes;
  const graph = buildRecipeGraph(fixtures, [159]);
  expect(graph.nodes.get("recipe:159")?.kind).toBe("sellable_menu");
  expect(graph.nodes.get("recipe:158")?.kind).toBe("prepared_recipe");
  expect([...graph.nodes.values()].some((node) => node.kind === "direct_ingredient")).toBe(true);
});

test("orders dependencies before the selected menu and deduplicates them", () => {
  const fixtures = firstSet.recipes;
  const order = dependencyFirstOrder(buildRecipeGraph(fixtures, [159, 165]));
  expect(order.at(-1)).toBe("recipe:165");
  expect(new Set(order).size).toBe(order.length);
});

test("returns a cycle named by recipe instead of recursing forever", () => {
  const recipeA = makeRecipe({
    recipeId: 1,
    name: "สูตร A",
    lines: [makeIngredientLine({ itemKind: "prepared_recipe", componentRecipeId: 2 })]
  });
  const recipeB = makeRecipe({
    recipeId: 2,
    name: "สูตร B",
    lines: [makeIngredientLine({ itemKind: "prepared_recipe", componentRecipeId: 1 })]
  });
  const cyclicGraph = buildRecipeGraph([recipeA, recipeB], [1]);
  expect(() => dependencyFirstOrder(cyclicGraph)).toThrow(/สูตร A → สูตร B → สูตร A/);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/domain/graph/recipeGraph.test.ts`

- [ ] **Step 3: Implement the graph module**

```ts
export interface GraphNode {
  id: string;
  displayName: string;
  kind: RecipeKind | "direct_ingredient";
  recipeId: number | null;
  ingredientId: number | null;
}

export interface RecipeGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, Set<string>>;
  rootIds: string[];
}

export function buildRecipeGraph(
  recipes: RecipeVersion[],
  rootRecipeIds: number[]
): RecipeGraph;

export function dependencyFirstOrder(graph: RecipeGraph): string[];
```

Use depth-first traversal with `visiting` and `visited` sets. Resolve cycle messages from node display names, not internal IDs.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/domain/graph/recipeGraph.test.ts
git add src/domain/graph
git commit -m "feat: model recipe dependency graph"
```

---

### Task 4: Work-Stage Projection and Kitchen Invariants

**Files:**
- Create: `src/domain/work/workDocuments.ts`
- Create: `src/domain/work/workDocuments.test.ts`
- Modify: `src/test/builders.ts`

**Interfaces:**
- Consumes: dependency-ordered `RecipeVersion[]`, requested `WorkStage | "all"`, batch multiplier
- Produces: `projectWorkDocuments()` and `scaleIngredientLine()` without altering the source snapshot

- [ ] **Step 1: Write failing work-document tests**

```ts
test("orders documents prep then cook then service", () => {
  const documents = projectWorkDocuments(firstSet.recipes, { stage: "all", multiplier: 3 });
  const rank = { prep: 0, cook: 1, service: 2 } as const;
  expect(documents.map((document) => rank[document.stage]))
    .toEqual([...documents].map((document) => rank[document.stage]).sort((a, b) => a - b));
});

test("never multiplies service quantities", () => {
  const service = projectWorkDocuments(firstSet.recipes, { stage: "service", multiplier: 5 })[0];
  expect(service.multiplier).toBe(1);
});

test("serves 180 grams of cooked rice and hides the 72 gram raw cost basis", () => {
  const service = projectWorkDocuments(firstSet.recipes, { stage: "service", multiplier: 1 });
  const stewedBeef = service.find((document) => document.recipeName === "ข้าวหน้าเนื้อตุ๋น");
  expect(stewedBeef?.ingredients).toContainEqual(
    expect.objectContaining({ itemName: "ข้าวหอมมะลิหุงสุก", sourceText: "180 กรัม" })
  );
  expect(stewedBeef?.ingredients.some((line) => line.sourceText === "72 กรัม")).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/domain/work/workDocuments.test.ts`

- [ ] **Step 3: Implement projection without copying recipe truth**

```ts
export interface ProjectedWorkDocument extends WorkDocument {
  recipeId: number;
  recipeVersionId: string;
  recipeName: string;
  ingredients: IngredientLine[];
  multiplier: number;
  blockers: string[];
}

export function projectWorkDocuments(
  recipes: RecipeVersion[],
  settings: { stage: WorkStage | "all"; multiplier: number }
): ProjectedWorkDocument[];

export function scaleIngredientLine(
  line: IngredientLine,
  multiplier: number,
  stage: WorkStage
): IngredientLine;
```

Resolve `ingredientLineKeys` against recipe lines. Return cloned display models; never mutate `RecipeVersion` or its source lines.

- [ ] **Step 4: Verify and commit**

Before verification, extend `src/test/builders.ts` after `ProjectedWorkDocument` exists:

```ts
export function makeProjectedWorkDocument(
  overrides: Partial<ProjectedWorkDocument> = {}
): ProjectedWorkDocument;
```

```bash
npm test -- src/domain/work/workDocuments.test.ts
git add src/domain/work src/test/builders.ts
git commit -m "feat: project recipes by work stage"
```

---

### Task 5: Readiness and Source Review Rules

**Files:**
- Create: `src/domain/review/readiness.ts`
- Create: `src/domain/review/readiness.test.ts`

**Interfaces:**
- Consumes: `RecipeVersion`, media coverage summary
- Produces: `evaluateReadiness(recipe, mediaCoverage)` and name-first review queue rows

- [ ] **Step 1: Write failing readiness tests**

```ts
test("missing method blocks approved printing", () => {
  const recipeWithoutMethod = makeRecipe({ methodText: null });
  const emptyCoverage = { linked: 0, reviewNeeded: 0 };
  expect(evaluateReadiness(recipeWithoutMethod, emptyCoverage)).toEqual(
    expect.objectContaining({ printableAsApproved: false, draft: true })
  );
});

test("missing media is a non-blocking gap", () => {
  const confirmedRecipe = makeRecipe();
  const result = evaluateReadiness(confirmedRecipe, { linked: 0, reviewNeeded: 0 });
  expect(result.printableAsApproved).toBe(true);
  expect(result.draft).toBe(false);
  expect(result.mediaGap).toBe(true);
});

test("review rows expose menu names and source questions instead of requiring codes", () => {
  const conflictedRecipe = makeRecipe({ name: "น้ำซุป", reviewState: "conflict" });
  expect(buildReviewQueue([conflictedRecipe])[0]).toEqual(
    expect.objectContaining({ recipeName: "น้ำซุป", status: "conflict" })
  );
});
```

- [ ] **Step 2: Implement explicit readiness states**

```ts
export interface MediaCoverage {
  linked: number;
  reviewNeeded: number;
}

export interface RecipeReadiness {
  printableAsApproved: boolean;
  draft: boolean;
  blockers: string[];
  mediaGap: boolean;
  mediaReviewNeeded: boolean;
}

export interface ReviewQueueRow {
  recipeId: number;
  recipeName: string;
  status: ReviewState;
  blockers: string[];
}

export function evaluateReadiness(recipe: RecipeVersion, media: MediaCoverage): RecipeReadiness;
export function buildReviewQueue(recipes: RecipeVersion[]): ReviewQueueRow[];
```

Only recipe/source blockers control `draft`. Media gaps remain separate.

- [ ] **Step 3: Verify and commit**

```bash
npm test -- src/domain/review/readiness.test.ts
git add src/domain/review
git commit -m "feat: evaluate cookbook readiness"
```

---

### Task 6: Prototype Session Store and App Routing

**Files:**
- Create: `src/prototype/PrototypeProvider.tsx`
- Create: `src/prototype/prototypeReducer.ts`
- Create: `src/prototype/prototypeReducer.test.ts`
- Create: `src/app/router.tsx`
- Create: `src/test/renderWithPrototype.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `CookbookRepository.loadSnapshot()`
- Produces: `usePrototype()` with session snapshot and typed actions; HashRouter routes used by feature pages

- [ ] **Step 1: Write failing reducer tests**

```ts
test("session edits do not claim durable persistence", () => {
  const initialState = createPrototypeState(makeSnapshot());
  const next = prototypeReducer(initialState, {
    type: "set-recipe-note",
    recipeId: 165,
    note: "ตรวจที่ครัวอีกครั้ง"
  });
  expect(next.dirty).toBe(true);
  expect(next.persistence).toBe("session");
});

test("reset restores the loaded fixture snapshot", () => {
  const initialSnapshot = makeSnapshot();
  const editedState = {
    ...createPrototypeState(initialSnapshot),
    snapshot: makeSnapshot({ recipes: [makeRecipe({ name: "ฉบับแก้" })] }),
    dirty: true
  };
  const next = prototypeReducer(editedState, { type: "reset-session" });
  expect(next.snapshot).toEqual(initialSnapshot);
});
```

- [ ] **Step 2: Implement provider and actions**

Expose:

```ts
export type PrototypeAction =
  | { type: "set-recipe-note"; recipeId: number; note: string }
  | { type: "add-session-media"; asset: MediaAsset; link: StepMediaLink }
  | { type: "replace-step-media"; stepId: string; links: StepMediaLink[] }
  | { type: "replace-snapshot"; snapshot: CookbookSnapshot }
  | { type: "reset-session" };

export interface PrototypeState {
  initialSnapshot: CookbookSnapshot;
  snapshot: CookbookSnapshot;
  dirty: boolean;
  persistence: "session";
}

export function createPrototypeState(snapshot: CookbookSnapshot): PrototypeState;

interface PrototypeContextValue {
  snapshot: CookbookSnapshot;
  dirty: boolean;
  persistence: "session";
  dispatch: React.Dispatch<PrototypeAction>;
}
```

- [ ] **Step 3: Configure HashRouter routes**

```tsx
<HashRouter>
  <Routes>
    <Route path="/" element={<Navigate to="/recipes" replace />} />
    <Route path="/recipes" element={<RecipeLibraryPage />} />
    <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
    <Route path="/source-review" element={<SourceReviewPage />} />
    <Route path="/work/:recipeId" element={<WorkStagePage />} />
    <Route path="/print" element={<PrintCenterPage />} />
  </Routes>
</HashRouter>
```

Add `renderWithPrototype()` using `MemoryRouter` and `PrototypeContext.Provider` so component tests receive an explicit snapshot without loading files or touching the network.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/prototype/prototypeReducer.test.ts src/app/App.test.tsx
npm run typecheck
git add src/prototype src/app src/test/renderWithPrototype.tsx
git commit -m "feat: add session-only cookbook shell"
```

---

### Task 7: Recipe Library and Recipe Detail Graph

**Files:**
- Create: `src/features/library/RecipeLibraryPage.tsx`
- Create: `src/features/library/RecipeLibraryPage.test.tsx`
- Create: `src/features/recipe/RecipeDetailPage.tsx`
- Create: `src/features/recipe/RecipeDetailPage.test.tsx`

**Interfaces:**
- Consumes: prototype snapshot, `buildRecipeGraph()`
- Produces: name-first search/filter and expandable menu → prepared recipe → ingredient navigation

- [ ] **Step 1: Write failing library tests**

```tsx
test("searches by Thai menu name without exposing recipe codes as the primary label", async () => {
  const user = userEvent.setup();
  renderWithPrototype(<RecipeLibraryPage />, { snapshot: firstSet });
  await user.type(screen.getByRole("searchbox"), "ยากินิกุ");
  expect(screen.getByRole("link", { name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
});

test("filters recipes with missing methods and media gaps independently", async () => {
  const user = userEvent.setup();
  renderWithPrototype(<RecipeLibraryPage />, { snapshot: firstSet });
  await user.selectOptions(screen.getByLabelText("สถานะ"), "missing-method");
  expect(screen.getAllByText("วิธีทำยังไม่ครบ").length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Implement library search and filters**

Filters: recipe kind, work stage, missing method, source conflict, missing media, media review needed.

- [ ] **Step 3: Write failing recipe-detail test**

```tsx
test("shows prepared recipes separately from direct ingredients", () => {
  renderWithPrototype(<RecipeDetailPage />, {
    snapshot: firstSet,
    route: "/recipes/159"
  });
  expect(screen.getByRole("heading", { name: "สูตรเตรียม" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "วัตถุดิบโดยตรง" })).toBeVisible();
  expect(screen.getByRole("link", { name: "ผัดผัก" })).toBeVisible();
});
```

- [ ] **Step 4: Implement graph-based detail view**

The page renders node type badges and source/readiness status. Ingredient rows are not clickable as recipes; prepared recipes are.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/library src/features/recipe
npm run typecheck
git add src/features/library src/features/recipe
git commit -m "feat: browse cookbook recipe graph"
```

---

### Task 8: Source Review and Work-Stage Views

**Files:**
- Create: `src/features/review/SourceReviewPage.tsx`
- Create: `src/features/review/SourceReviewPage.test.tsx`
- Create: `src/features/work/WorkStagePage.tsx`
- Create: `src/features/work/WorkStagePage.test.tsx`

**Interfaces:**
- Consumes: readiness queue and `projectWorkDocuments()`
- Produces: source-comparison UI and stage-specific operational views

- [ ] **Step 1: Write failing source-review test**

```tsx
test("states the source precedence and shows source values without conversion", () => {
  renderWithPrototype(<SourceReviewPage />, { snapshot: firstSet });
  expect(screen.getByText(/ลายมือใหม่เป็นหลักเมื่อมีการแก้ไข/)).toBeVisible();
  expect(screen.getByText("1 ช้อนโต๊ะ")).toBeVisible();
});
```

- [ ] **Step 2: Implement name-first review queue and comparison panel**

Display candidate text, selected source, decision status, source locators, method text, blockers, and session-only editing notice.

- [ ] **Step 3: Write failing work-stage tests**

```tsx
test("shows only service steps and the 180 gram cooked rice portion", async () => {
  renderWithPrototype(<WorkStagePage />, {
    snapshot: firstSet,
    route: "/work/165?stage=service"
  });
  expect(screen.getByText("ข้าวหอมมะลิหุงสุก")).toBeVisible();
  expect(screen.getByText("180 กรัม")).toBeVisible();
  expect(screen.queryByText("72 กรัม")).not.toBeInTheDocument();
});

test("labels the three operational stages", () => {
  renderWithPrototype(<WorkStagePage />, {
    snapshot: firstSet,
    route: "/work/37?stage=all"
  });
  expect(screen.getByText("ผลิตซอสและของเตรียม")).toBeVisible();
  expect(screen.getByText("ครัวปรุง / BOM")).toBeVisible();
  expect(screen.getByText("จัดเสิร์ฟหน้าร้าน")).toBeVisible();
});
```

- [ ] **Step 4: Implement stage navigation and document rendering**

Do not show empty stages. Explain `เมนูนี้ไม่มีขั้นตอนในจุดงานที่เลือก` when a user explicitly selects an unmapped stage.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/review src/features/work
git add src/features/review src/features/work
git commit -m "feat: review sources and work stages"
```

---

### Task 9: Step-Linked Media Domain

**Files:**
- Create: `src/domain/media/stepMedia.ts`
- Create: `src/domain/media/stepMedia.test.ts`
- Create: `public/sample-media/prep-cut-size.svg`
- Create: `public/sample-media/cook-doneness.svg`
- Create: `public/sample-media/service-delivery-layout.svg`
- Modify: `src/data/fixtures/first-set.json` only through an adjacent media manifest file, not by rewriting source recipe values

**Interfaces:**
- Consumes: stable `WorkStep.stepId`
- Produces: `attachMedia`, `reorderStepMedia`, `mediaCoverageForRecipe`, and revision review flags

- [ ] **Step 1: Complete the media types**

```ts
export type MediaRole = "before" | "during" | "checkpoint" | "final";
export type Vessel = "plate" | "delivery_box" | "cup_1oz";

export interface MediaAsset {
  mediaId: string;
  url: string;
  caption: string;
  altText: string;
  reviewState: "sample" | "unreviewed" | "confirmed";
  localSessionOnly: boolean;
}

export interface StepMediaLink {
  stepId: string;
  mediaId: string;
  order: number;
  role: MediaRole;
  vessel: Vessel | null;
  reviewNeeded: boolean;
}

export type NewStepMediaLink = Omit<StepMediaLink, "order" | "reviewNeeded">;
```

- [ ] **Step 2: Write failing media-domain tests**

```ts
test("orders multiple images within one step", () => {
  const stepId = "test-v1-1:prep:1";
  const snapshot = makeSnapshot({
    media: [makeMediaAsset({ mediaId: "media-a" }), makeMediaAsset({ mediaId: "media-b" })],
    stepMedia: [
      makeStepMediaLink({ stepId, mediaId: "media-a", order: 1 }),
      makeStepMediaLink({ stepId, mediaId: "media-b", order: 2 })
    ]
  });
  const links = reorderStepMedia(snapshot, stepId, ["media-b", "media-a"]).stepMedia;
  expect(links.filter((link) => link.stepId === stepId).map((link) => link.mediaId))
    .toEqual(["media-b", "media-a"]);
});

test("reuses one media asset across steps without duplicating the asset", () => {
  const secondStep = "step-2";
  const snapshot = makeSnapshot({
    media: [makeMediaAsset({ mediaId: "media-a" })],
    stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "media-a" })]
  });
  const result = attachMedia(snapshot, { stepId: secondStep, mediaId: "media-a", role: "checkpoint", vessel: null });
  expect(result.media.filter((asset) => asset.mediaId === "media-a")).toHaveLength(1);
  expect(result.stepMedia.filter((link) => link.mediaId === "media-a")).toHaveLength(2);
});

test("marks retained media for review when a step meaning changes", () => {
  const stepId = "step-1";
  const snapshot = makeSnapshot({
    media: [makeMediaAsset({ mediaId: "media-a" })],
    stepMedia: [makeStepMediaLink({ stepId, mediaId: "media-a" })]
  });
  expect(markStepMeaningChanged(snapshot, stepId).stepMedia[0].reviewNeeded).toBe(true);
});
```

- [ ] **Step 3: Implement immutable media functions**

```ts
export function attachMedia(snapshot: CookbookSnapshot, input: NewStepMediaLink): CookbookSnapshot;
export function reorderStepMedia(snapshot: CookbookSnapshot, stepId: string, mediaIds: string[]): CookbookSnapshot;
export function markStepMeaningChanged(snapshot: CookbookSnapshot, stepId: string): CookbookSnapshot;
export function mediaCoverageForRecipe(snapshot: CookbookSnapshot, recipe: RecipeVersion): MediaCoverage;
```

- [ ] **Step 4: Add three clearly marked demo SVG assets**

Each SVG visibly contains `DEMO` and one use case: cut-size scale, doneness/color, or delivery placement. Do not present generated illustrations as real kitchen evidence.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/domain/media/stepMedia.test.ts
git add src/domain/media public/sample-media src/data
git commit -m "feat: link ordered media to work steps"
```

---

### Task 10: Step Media Editor Interaction

**Files:**
- Create: `src/features/media/StepMediaEditor.tsx`
- Create: `src/features/media/StepMediaEditor.test.tsx`
- Modify: `src/features/work/WorkStagePage.tsx`

**Interfaces:**
- Consumes: media-domain functions and prototype session dispatch
- Produces: `StepMediaEditor({ stepId }: { stepId: string })`, session-only file preview, caption/role/vessel editing, ordering, reuse, and review warnings

- [ ] **Step 1: Write failing editor tests**

```tsx
test("previews a selected image but labels it session-only", async () => {
  const user = userEvent.setup();
  renderWithPrototype(<StepMediaEditor stepId="step-1" />, { snapshot: makeSnapshot() });
  const file = new File(["image"], "cut-size.png", { type: "image/png" });
  await user.upload(screen.getByLabelText("เลือกรูป"), file);
  expect(screen.getByAltText("ตัวอย่าง cut-size.png")).toBeVisible();
  expect(screen.getByText("รูปนี้อยู่เฉพาะ session และจะหายเมื่อ reload")).toBeVisible();
});

test("supports role and delivery vessel selection", async () => {
  const user = userEvent.setup();
  const snapshot = makeSnapshot({
    media: [makeMediaAsset({ mediaId: "media-a" })],
    stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "media-a" })]
  });
  renderWithPrototype(<StepMediaEditor stepId="step-1" />, { snapshot });
  await user.selectOptions(screen.getByLabelText("ชนิดรูป"), "final");
  await user.selectOptions(screen.getByLabelText("ภาชนะ"), "delivery_box");
  expect(screen.getByDisplayValue("delivery_box")).toBeVisible();
});
```

- [ ] **Step 2: Implement safe object URL lifecycle**

Create object URLs on selection and revoke them on replacement/unmount. Dispatch `add-session-media` with `localSessionOnly: true`; never call `fetch` or upload APIs.

In `src/test/setup.ts`, stub `URL.createObjectURL` to return `blob:test-media` and `URL.revokeObjectURL` with `vi.fn()` so the test asserts cleanup without relying on jsdom browser support.

- [ ] **Step 3: Implement ordering and reuse controls**

Use explicit Move Earlier/Move Later buttons plus a searchable `เลือกจากคลังรูป` control. Keyboard users must be able to reorder without drag-and-drop.

- [ ] **Step 4: Implement missing-media and review-needed presentation**

Show `เพิ่มรูปภายหลัง` for empty steps and `รูปควรตรวจใหม่` for review-needed links. Neither label changes recipe draft status.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/media/StepMediaEditor.test.tsx
npm run typecheck
git add src/features/media src/features/work
git commit -m "feat: edit step media in prototype session"
```

---

### Task 11: Photo-Aware Print Planner

**Files:**
- Create: `src/domain/print/printPlanner.ts`
- Create: `src/domain/print/printPlanner.test.ts`

**Interfaces:**
- Consumes: projected work documents, media assets/links, requested template and multiplier
- Produces: deterministic A5 card pages and A4 two-up sheets

- [ ] **Step 1: Write failing print-planner tests**

```ts
test("recommends A5 station cards for every work stage", () => {
  expect(resolveTemplate("auto", "service")).toBe("station");
});

test("places exactly two A5 cards on each A4 two-up sheet", () => {
  const documents = [makeProjectedWorkDocument(), makeProjectedWorkDocument({ recipeId: 2 })];
  const media = buildMediaIndex(makeSnapshot());
  const plan = buildPrintPlan(documents, media, { template: "two-up", stage: "all", multiplier: 1 });
  expect(plan.every((page) => page.kind !== "two-up" || page.slots.length <= 2)).toBe(true);
});

test("returns text space when a step has no media", () => {
  const documentWithoutMedia = makeProjectedWorkDocument({
    steps: [makeWorkStep({ stepId: "step-1", instruction: "อ่านข้อความอย่างเดียว" })]
  });
  const [page] = paginateWorkDocument(documentWithoutMedia, buildMediaIndex(makeSnapshot()));
  expect(page.blocks[0]).toEqual(expect.objectContaining({ kind: "step", layout: "text-only" }));
});

test("creates continuation pages instead of clipping mixed photo and text steps", () => {
  const longDocumentWithMedia = makeProjectedWorkDocument({
    steps: Array.from({ length: 12 }, (_, index) => makeWorkStep({
      stepId: `step-${index + 1}`,
      order: index + 1,
      instruction: `ขั้นตอนยาวลำดับ ${index + 1} พร้อมรายละเอียดการตรวจมาตรฐาน`
    }))
  });
  const pages = paginateWorkDocument(longDocumentWithMedia, buildMediaIndex(makeSnapshot()));
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.map((page) => page.partNumber)).toEqual([1, 2]);
});
```

- [ ] **Step 2: Implement the planner interfaces**

```ts
export type PrintTemplate = "auto" | "station" | "two-up";

export interface PrintSettings {
  template: PrintTemplate;
  stage: WorkStage | "all";
  multiplier: number;
}

export interface MediaIndex {
  assetsById: Map<string, MediaAsset>;
  linksByStepId: Map<string, StepMediaLink[]>;
}

export interface WorkstationPage {
  kind: "station";
  document: ProjectedWorkDocument;
  blocks: Array<{ kind: "step"; stepId: string; layout: "text-only" | "with-media" }>;
  partNumber: number;
  totalParts: number;
}

export interface TwoUpPage {
  kind: "two-up";
  slots: WorkstationPage[];
}

export type PrintPage = WorkstationPage | TwoUpPage;

export function resolveTemplate(template: PrintTemplate, stage: WorkStage | "all"): Exclude<PrintTemplate, "auto">;
export function buildMediaIndex(snapshot: CookbookSnapshot): MediaIndex;
export function paginateWorkDocument(document: ProjectedWorkDocument, media: MediaIndex): WorkstationPage[];
export function buildPrintPlan(documents: ProjectedWorkDocument[], media: MediaIndex, settings: PrintSettings): PrintPage[];
```

Use deterministic content weights. A photo step consumes more capacity than text-only; the same input must always produce the same pages.

- [ ] **Step 3: Preserve stage/deduplication rules**

The planner consumes dependency-deduplicated documents in stage order. It must never reintroduce duplicates and must force service multiplier to one.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/domain/print/printPlanner.test.ts
git add src/domain/print
git commit -m "feat: plan photo-aware workstation pages"
```

---

### Task 12: Print Center UI and Print CSS

**Files:**
- Create: `src/features/print/PrintCenterPage.tsx`
- Create: `src/features/print/PrintCenterPage.test.tsx`
- Create: `src/features/print/WorkstationCard.tsx`
- Create: `src/features/print/print.css`

**Interfaces:**
- Consumes: `buildPrintPlan()` and selected recipe IDs
- Produces: `PrintCenterPage({ initialRecipeIds? }: { initialRecipeIds?: number[] })`, interactive preview, A5 landscape print pages, and A4 two-up sheets

- [ ] **Step 1: Write failing Print Center tests**

```tsx
test("defaults to an automatic A5 workstation recommendation", () => {
  renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot: firstSet });
  expect(screen.getByText("ตัวอย่าง A5 แนวนอนสำหรับจุดงาน · แนะนำอัตโนมัติ")).toBeVisible();
});

test("filters the pack to service documents", async () => {
  const user = userEvent.setup();
  renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot: firstSet });
  await user.selectOptions(screen.getByLabelText("จุดงาน"), "service");
  expect(screen.getAllByText("จัดเสิร์ฟหน้าร้าน").length).toBeGreaterThan(0);
  expect(screen.queryByText("ผลิตซอสและของเตรียม")).not.toBeInTheDocument();
});

test("renders ordered images beside their work steps", () => {
  const recipe = firstSet.recipes.find((item) => item.recipeId === 165)!;
  const stepId = recipe.workDocuments.service!.steps[0].stepId;
  const snapshot = {
    ...firstSet,
    media: [
      makeMediaAsset({ mediaId: "media-a", altText: "ภาพขั้นตอนหนึ่ง" }),
      makeMediaAsset({ mediaId: "media-b", altText: "ภาพขั้นตอนสอง" })
    ],
    stepMedia: [
      makeStepMediaLink({ stepId, mediaId: "media-a", order: 1 }),
      makeStepMediaLink({ stepId, mediaId: "media-b", order: 2 })
    ]
  };
  renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot });
  const firstImage = screen.getByAltText("ภาพขั้นตอนหนึ่ง");
  expect(firstImage.closest("li")?.querySelectorAll("img")).toHaveLength(2);
});
```

- [ ] **Step 2: Implement controls and preview**

Controls: recipe selection, work stage, `auto/station/two-up`, multiplier, draft/approved preview. Disable Print when no recipes are selected.

- [ ] **Step 3: Implement photo-aware workstation cards**

Each step renders step number, instruction, ordered images, role/caption/measurement text, and vessel label. Empty media renders no placeholder in print.

- [ ] **Step 4: Implement exact print CSS**

```css
@page workstation { size: A5 landscape; margin: 0; }
@page two-up { size: A4 portrait; margin: 0; }

.workstation-sheet {
  page: workstation;
  width: 210mm;
  height: 148mm;
  break-after: page;
  overflow: hidden;
}

.two-up-sheet {
  page: two-up;
  width: 210mm;
  height: 297mm;
  break-after: page;
}
```

The planner, not CSS clipping, decides continuation pages.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/print/PrintCenterPage.test.tsx
npm run typecheck
npm run build
git add src/features/print
git commit -m "feat: print cookbook workstation packs"
```

---

### Task 13: Prototype Snapshot Export

**Files:**
- Create: `src/prototype/snapshotExport.ts`
- Create: `src/prototype/snapshotExport.test.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: current `CookbookSnapshot`
- Produces: stable JSON export with recipe fixtures, media metadata, and explicit session-only media warnings

- [ ] **Step 1: Write failing export tests**

```ts
test("exports a versioned snapshot without inventing durable URLs", async () => {
  const snapshot = makeSnapshot({
    media: [makeMediaAsset({ mediaId: "session-media", localSessionOnly: true })]
  });
  const exported = await exportPrototypeSnapshot(snapshot, "2026-08-04T00:00:00.000Z");
  expect(exported.schemaVersion).toBe("cookbook-prototype-v1");
  expect(exported.recipes).toHaveLength(snapshot.recipes.length);
  expect(exported.media.find((asset) => asset.localSessionOnly)).toEqual(
    expect.objectContaining({ exportWarning: "binary-not-included" })
  );
});

test("sorts recipes, media, and links deterministically", async () => {
  const snapshot = makeSnapshot({
    recipes: [makeRecipe({ recipeId: 1 }), makeRecipe({ recipeId: 2 })]
  });
  const shuffled = { ...snapshot, recipes: [...snapshot.recipes].reverse() };
  const exportedAt = "2026-08-04T00:00:00.000Z";
  expect(await exportPrototypeSnapshot(shuffled, exportedAt))
    .toEqual(await exportPrototypeSnapshot(snapshot, exportedAt));
});
```

- [ ] **Step 2: Implement the export contract**

```ts
export interface PrototypeExport {
  schemaVersion: "cookbook-prototype-v1";
  exportedAt: string;
  recipes: RecipeVersion[];
  media: Array<MediaAsset & { exportWarning?: "binary-not-included" }>;
  stepMedia: StepMediaLink[];
}

export function exportPrototypeSnapshot(
  snapshot: CookbookSnapshot,
  exportedAt?: string
): PrototypeExport;
```

Inject `exportedAt` from a function parameter in tests to keep assertions deterministic.

- [ ] **Step 3: Add the download action**

Use `Blob`, `URL.createObjectURL`, and an anchor download. Label the button `Export prototype snapshot`; explain that session file binaries are not included.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/prototype/snapshotExport.test.ts
git add src/prototype src/app
git commit -m "feat: export cookbook prototype snapshot"
```

---

### Task 14: Browser QA, Network Boundary, and Handoff

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/cookbook-flow.spec.ts`
- Create: `tests/media-print.spec.ts`
- Create: `tests/no-production-network.spec.ts`
- Create: `docs/HANDOFF.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: complete V1 prototype
- Produces: browser evidence, documented commands, and explicit Supabase follow-up boundary

- [ ] **Step 1: Configure Playwright against the Vite preview build**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: false
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 }
  }
});
```

- [ ] **Step 2: Write the primary flow test**

```ts
test("finds a menu, opens dependencies, and previews a service pack", async ({ page }) => {
  await page.goto("/#/recipes");
  await page.getByRole("searchbox").fill("ข้าวหน้าเนื้อตุ๋น");
  await page.getByRole("link", { name: "ข้าวหน้าเนื้อตุ๋น" }).click();
  await expect(page.getByRole("link", { name: "เนื้อตุ๋น (ราดข้าว)" })).toBeVisible();
  await page.goto("/#/print");
  await page.getByLabel("จุดงาน").selectOption("service");
  await expect(page.getByText("ข้าวหอมมะลิหุงสุก 180 กรัม")).toBeVisible();
  await expect(page.getByText("72 กรัม")).toHaveCount(0);
});
```

- [ ] **Step 3: Write media and print-size checks**

Use `getBoundingClientRect()` to verify A5 proportions, select two-up and verify two slots, check no horizontal overflow at 1440 and 390 widths, and assert no blank media frames for text-only steps.

- [ ] **Step 4: Enforce the production-network boundary**

```ts
test("makes no Supabase or external requests", async ({ page }) => {
  const forbidden: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) forbidden.push(request.url());
  });
  await page.goto("/#/recipes");
  await expect.poll(() => forbidden).toEqual([]);
});
```

- [ ] **Step 5: Run the full quality gate**

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

Expected: all tests pass, build succeeds, browser console is clean, and no external requests occur.

- [ ] **Step 6: Write the handoff**

`docs/HANDOFF.md` must record:

- exact implemented scope;
- local run/test commands;
- fixture sources and no-guess rules;
- current sample-media limitations;
- current browser/print evidence;
- no production Supabase mutation;
- required separate future brief for schema, RLS, Storage, migration, rollback, and backfill.

- [ ] **Step 7: Commit the verified prototype**

```bash
git add playwright.config.ts tests README.md docs/HANDOFF.md
git commit -m "test: verify cookbook module v1 prototype"
git status --short
```

Expected: final status is clean.

---

## Spec Coverage Map

| PRD/design requirement | Implemented by |
|---|---|
| Separate React/TypeScript/Vite application and branding boundary | Tasks 1 and 6 |
| Verified fixture migration and no-guess kitchen quantities | Tasks 2, 4, and 5 |
| Menu/prepared recipe/ingredient graph | Tasks 3 and 7 |
| Name-first source review and provenance | Tasks 5 and 8 |
| Prep/Cook/Service projections and multiplier rules | Tasks 4 and 8 |
| Ordered step media, reuse, vessel, and revision warning | Tasks 9 and 10 |
| Missing media remains non-blocking | Tasks 5, 9, 10, and 11 |
| A5 landscape, A4 two-up, continuation, and deduplication | Tasks 11 and 12 |
| Session-only prototype and export contract | Tasks 6 and 13 |
| No production network or Supabase mutation | Global Constraints and Task 14 |
| Accessibility, responsive layout, browser and print verification | Tasks 10, 12, and 14 |
| Supabase implementation remains a separately gated future phase | Global Constraints, Task 14 handoff, and Final Verification |

Self-review result: every V1 requirement is assigned to at least one task; production Supabase, stock, Food Cost, POS, multi-tenant, billing, and generative AI remain explicitly outside this plan.

---

## Final Verification Checklist

- [ ] The application lives only in the new local `nntn-cookbook` repository.
- [ ] No remote was created or pushed.
- [ ] The operational NNTN working tree has no new implementation changes.
- [ ] All kitchen quantities preserve verified source units.
- [ ] Recipe graph, stage projections, media links, readiness, and print planning are pure tested modules.
- [ ] Missing images are non-blocking and consume no print space.
- [ ] A5 landscape and A4 two-up previews have no clipping or horizontal overflow.
- [ ] The prototype performs no external or Supabase requests.
- [ ] Full unit, lint, typecheck, build, and Playwright suites pass.
- [ ] Supabase remains a separately gated future implementation plan.
