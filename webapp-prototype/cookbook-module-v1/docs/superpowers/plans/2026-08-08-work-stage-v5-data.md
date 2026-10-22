# Work-stage V5/V4 Data Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Work-stage consume the canonical Kitchen SOT V5 draft with verified V4 fallback while preserving its existing UI, dependency graph, stage behavior, and session-only media editing.

**Architecture:** Reuse `projectKitchenSotPrintSnapshot()` as the single raw-to-read projection already verified by Print Center. `WorkStagePage` selects that projected snapshot and raw readiness map when `KitchenSotDraftProvider` is present; isolated fixture-only tests retain the current snapshot/readiness fallback. Work-stage never constructs or saves V5 and never duplicates the raw DRAFT predicate.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Playwright, Vite dev middleware

## Global Constraints

- Cookbook Module V1 local pilot only.
- Do not commit until TINE gives a separate explicit commit instruction.
- Do not touch Stock V1/V2, auth, Supabase, production data, deployment, MAW, or CROO.
- Do not add dependencies or redesign Work-stage.
- Do not change V5 schema, persistence middleware, validation, concurrency, key ordering, or source allowlists.
- Preserve exact `candidate_text`; do not parse, convert, scale, normalize, or reconstruct quantities.
- Reuse the canonical raw readiness predicate; missing raw readiness fails closed.
- Preserve exact unresolved blocker messages and mixed numeric/string identities.
- Tests must use the isolated vault and must not create the real `Operations/CookBook/sot/v5-draft` path.
- V4 and `SHA256SUMS.txt` remain read-only and must verify 5/5 after the complete gate.

---

## File Map

- Modify `src/features/work/WorkStagePage.tsx`: select raw projected snapshot/readiness when available and render DRAFT from raw authority.
- Modify `src/features/work/WorkStagePage.test.tsx`: lock raw V5 precedence, fail-closed readiness, blockers, methodless rendering, and provider error behavior.
- Modify `tests/cookbook-draft-persistence.spec.ts`: prove save → reload → Work-stage uses isolated V5 data.
- Modify `docs/HANDOFF.md` only after independent approval: record Work-stage local-pilot GO without claiming a commit.

No new production source file or mapper is needed.

---

### Task 1: Lock raw Work-stage behavior with failing component tests

**Files:**
- Modify: `src/features/work/WorkStagePage.test.tsx`
- Read: `src/features/print/PrintCenterPage.test.tsx`
- Read: `src/domain/sot/kitchenSotPrintProjection.test.ts`

**Interfaces:**
- Consumes: `KitchenSotDraftProvider`, `KitchenSotDraftClient`, `parseKitchenSotDocument()`, `PrototypeContext`.
- Produces: failing acceptance tests for raw projection selection and readiness authority.

- [ ] **Step 1: Add raw-document test helpers**

Add imports for the draft client/provider, fixture parser, React Testing Library `render`, `MemoryRouter`, and `PrototypeContext`. Reuse the same loaded-draft shape already used by `PrintCenterPage.test.tsx`:

```tsx
function loadedKitchenSotDraft(document: KitchenSotDocument): LoadedKitchenSotDraft {
  return {
    document,
    origin: "v5-draft",
    sourcePath: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json",
    sourceSha256: "a".repeat(64),
    baseSha256: "b".repeat(64),
  };
}

function renderWorkWithKitchenSotDocument(
  document: KitchenSotDocument,
  route: string,
  snapshot = firstSet,
) {
  const client: KitchenSotDraftClient = {
    load: vi.fn(async () => loadedKitchenSotDraft(document)),
    save: vi.fn(async (submitted) => ({
      document: submitted,
      sha256: "c".repeat(64),
      base_sha256: "c".repeat(64),
      generatedAt: submitted.generated_at,
      path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
    })),
  };
  const context: PrototypeContextValue = {
    snapshot,
    dirty: false,
    persistence: "session",
    dispatch: () => ({ ok: true }),
    createSessionObjectUrl: () => "blob:unused",
    releaseSessionObjectUrl: () => undefined,
    isSessionObjectUrl: () => false,
  };
  return render(
    <PrototypeContext.Provider value={context}>
      <KitchenSotDraftProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <Routes><Route path="/work/:recipeId" element={<WorkStagePage />} /></Routes>
        </MemoryRouter>
      </KitchenSotDraftProvider>
    </PrototypeContext.Provider>,
  );
}
```

- [ ] **Step 2: Write the V5 precedence and exact-text test**

```tsx
test("uses V5 candidate_text instead of the stale fixture projection", async () => {
  const document = parseKitchenSotDocument(fixture);
  const rice = document.recipes.find(({ recipe_id }) => recipe_id === 165)!.items
    .find(({ item_name }) => item_name === "ข้าวหอมมะลิหุงสุก")!;
  rice.candidate_text = "199 กรัม\nจาก V5";

  renderWorkWithKitchenSotDocument(document, "/work/165?stage=service");

  expect(await screen.findByText("199 กรัม\nจาก V5")).toBeVisible();
  expect(screen.queryByText("180 กรัม")).not.toBeInTheDocument();
  expect(screen.queryByText("72 กรัม")).not.toBeInTheDocument();
});
```

Add a parameterized route test over `parseKitchenSotDocument(fixture).recipes`. For each raw `recipe_id`, navigate with `encodeRecipeIdentity(recipe_id)` and `stage=all`, then assert the raw recipe name becomes the Work-stage level-2 heading. This proves all 18 identities, including both string IDs, are addressable through the raw projection.

- [ ] **Step 3: Write raw readiness and exact-blocker tests**

```tsx
test("keeps recipe 159 DRAFT through the shared raw readiness predicate", async () => {
  renderWorkWithKitchenSotDocument(
    parseKitchenSotDocument(fixture),
    "/work/159?stage=service",
  );
  expect(await screen.findByText("DRAFT")).toBeVisible();
  expect(screen.queryByText("พร้อมใช้งาน")).not.toBeInTheDocument();
});

test("shows unresolved blocker text verbatim and hides resolved history", async () => {
  const document = parseKitchenSotDocument(fixture);
  const recipe = document.recipes.find(({ recipe_id }) => recipe_id === 164)!;
  const message = recipe.blockers[0]!.message;
  renderWorkWithKitchenSotDocument(document, "/work/164?stage=prep");
  expect(await screen.findByText(message)).toBeVisible();
});
```

Extend the blocker test with a second render after setting `resolved = true`; assert the message is absent as an active blocker.

- [ ] **Step 4: Write methodless and fail-closed tests**

First add a parameterized test for all five missing-method recipe IDs `[2, 160, 9, 161, 162]`. Each route must render an article, show DRAFT, and render no invented ordered step list inside that article.

```tsx
test("renders recipe 162 as a non-empty methodless DRAFT without invented steps", async () => {
  renderWorkWithKitchenSotDocument(
    parseKitchenSotDocument(fixture),
    "/work/162?stage=prep",
  );
  const article = await screen.findByRole("article", { name: "ผงคั่วพริกเกลือ" });
  expect(within(article).getByText("DRAFT")).toBeVisible();
  expect(within(article).getAllByRole("row")).toHaveLength(5); // header + four ingredients
  expect(within(article).queryByRole("list")).not.toBeInTheDocument();
});
```

Add a test-only raw document mutation that removes the selected recipe from `recipeDraftById` through a mocked projection boundary or exported resolver helper. Assert the result is DRAFT, never “พร้อมใช้งาน”. Prefer testing a small exported/pure readiness resolver if direct setup would require copying production logic into the test.

- [ ] **Step 5: Write provider-error isolation test**

Render the normal provider with `load()` rejecting `new Error("RAW_LOAD_FAILED")`. Assert the provider alert is visible and that the fixture Work-stage recipe heading is absent. This proves raw failure does not silently promote fixture data.

- [ ] **Step 6: Run the focused tests and capture the expected RED**

Run:

```bash
./node_modules/.bin/vitest run src/features/work/WorkStagePage.test.tsx --maxWorkers=1
```

Expected: new V5/readiness tests fail because `WorkStagePage` still uses only `PrototypeProvider.snapshot` and `evaluateReadiness()`.

- [ ] **Step 7: Record a no-commit checkpoint**

Run:

```bash
/opt/homebrew/bin/git diff --check -- src/features/work/WorkStagePage.test.tsx
/opt/homebrew/bin/git status --short
```

Expected: only approved Cookbook worktree changes are present. Do not stage or commit.

---

### Task 2: Wire Work-stage to the shared raw projection

**Files:**
- Modify: `src/features/work/WorkStagePage.tsx`
- Test: `src/features/work/WorkStagePage.test.tsx`
- Reuse: `src/domain/sot/kitchenSotPrintProjection.ts`

**Interfaces:**
- Consumes: `useOptionalKitchenSotDraft()`, `projectKitchenSotPrintSnapshot(document, mediaSnapshot)`.
- Produces: raw-authoritative `CookbookSnapshot` plus `ReadonlyMap<RecipeIdentity, boolean>` for Work-stage.

- [ ] **Step 1: Add the raw projection imports and pure readiness resolver**

```tsx
import { projectKitchenSotPrintSnapshot } from "../../domain/sot/kitchenSotPrintProjection";
import { useOptionalKitchenSotDraft } from "../review/KitchenSotDraftProvider";

export function resolveWorkStageDraft(
  recipe: RecipeVersion,
  snapshot: CookbookSnapshot,
  rawDraftById: ReadonlyMap<RecipeIdentity, boolean> | null,
): boolean {
  if (rawDraftById !== null) return rawDraftById.get(recipe.recipeId) ?? true;
  return evaluateReadiness(
    recipe,
    deriveRecipeMediaCoverage(recipe, snapshot).coverage,
  ).draft;
}
```

The raw branch fails closed on a missing identity. The fixture-only branch preserves existing tests and static surfaces.

- [ ] **Step 2: Select the authoritative Work-stage snapshot**

Inside `WorkStagePage`:

```tsx
const { snapshot: sessionSnapshot } = usePrototype();
const draft = useOptionalKitchenSotDraft();
const rawProjection = draft === null
  ? null
  : projectKitchenSotPrintSnapshot(draft.document, sessionSnapshot);
const snapshot = rawProjection?.snapshot ?? sessionSnapshot;
const rawDraftById = rawProjection?.recipeDraftById ?? null;
```

Do not mutate `draft.document`, `sessionSnapshot`, or the projection result.

- [ ] **Step 3: Make WorkDocumentView consume an explicit DRAFT boolean**

Change the component boundary to:

```tsx
function WorkDocumentView({
  document,
  recipe,
  snapshot,
  draft,
}: {
  document: ProjectedWorkDocument;
  recipe: RecipeVersion;
  snapshot: CookbookSnapshot;
  draft: boolean;
}) {
  const media = deriveRecipeMediaCoverage(recipe, snapshot);
  return (
    <article aria-labelledby={`work-document-${document.recipeVersionId}-${document.stage}`}>
      {/* existing heading */}
      <p>{draft ? "DRAFT" : "พร้อมใช้งาน"}</p>
      {/* exact document.blockers and existing media information */}
    </article>
  );
}
```

Remove `readinessOnlyBlockers`. Raw Work-stage warnings come from exact projected blocker messages; generic readiness text must not replace or rewrite them.

- [ ] **Step 4: Resolve readiness once per projected recipe**

When rendering each document, call:

```tsx
const isDraft = resolveWorkStageDraft(documentRecipe, snapshot, rawDraftById);
```

Pass `draft={isDraft}` to `WorkDocumentView`. Remove the old validation-only `evaluateReadiness()` loop; graph/projection errors remain handled by the existing `try/catch`.

- [ ] **Step 5: Run focused component and projection tests**

Run:

```bash
./node_modules/.bin/vitest run \
  src/features/work/WorkStagePage.test.tsx \
  src/domain/sot/kitchenSotPrintProjection.test.ts \
  src/features/print/PrintCenterPage.test.tsx \
  --maxWorkers=1
```

Expected: PASS. Existing Print Center projection behavior remains unchanged.

- [ ] **Step 6: Run typecheck and lint for the integration boundary**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 7: Record a no-commit checkpoint**

Run:

```bash
/opt/homebrew/bin/git diff --check -- \
  src/features/work/WorkStagePage.tsx \
  src/features/work/WorkStagePage.test.tsx
/opt/homebrew/bin/git status --short
```

Do not stage or commit.

---

### Task 3: Prove isolated V5 save/reload reaches Work-stage

**Files:**
- Modify: `tests/cookbook-draft-persistence.spec.ts`
- Test config: `playwright.local.config.ts`

**Interfaces:**
- Consumes: existing isolated V4/V5 vault, existing `isolatedOwnerQuantity`, numeric Work-stage route.
- Produces: browser evidence that Work-stage reloads the saved V5 value and retains raw DRAFT evidence.

- [ ] **Step 1: Extend the existing save-and-print serial test**

After the V5 quantity has been saved and verified in Print Center, navigate to Work-stage:

```ts
await page.goto("./#/work/164?stage=prep");
const recipe164Work = page.getByRole("article", {
  name: "เนื้อตุ๋น (ราดข้าว)",
});
await expect(recipe164Work).toContainText(isolatedOwnerQuantity);
await expect(recipe164Work).toContainText(unresolvedRecipe164Blocker);
await expect(recipe164Work).toContainText("DRAFT");

await page.reload();
await expect(page.getByRole("article", {
  name: "เนื้อตุ๋น (ราดข้าว)",
})).toContainText(isolatedOwnerQuantity);
```

- [ ] **Step 2: Add the provenance-incomplete cross-surface assertion**

```ts
await page.goto("./#/work/159?stage=service");
const recipe159Work = page.getByRole("article", {
  name: "ข้าวหน้าเนื้อยากินิกุ",
});
await expect(recipe159Work).toContainText("DRAFT");
await expect(recipe159Work).not.toContainText("พร้อมใช้งาน");
```

- [ ] **Step 3: Run the isolated local-draft suite**

Run:

```bash
npm run test:e2e:local-draft
```

Expected: 3/3 pass. The test-created V5 exists only below `node_modules/.cache/cookbook-v5-e2e-vault`.

- [ ] **Step 4: Confirm the real vault was not written**

Run the real-vault absence check from the worktree root:

```bash
test ! -e Operations/CookBook/sot/v5-draft
```

Expected: exit 0.

- [ ] **Step 5: Record a no-commit checkpoint**

Run:

```bash
/opt/homebrew/bin/git diff --check -- tests/cookbook-draft-persistence.spec.ts
/opt/homebrew/bin/git status --short
```

Do not stage or commit.

---

### Task 4: Run the complete sequential gate and request independent verification

**Files:**
- Verify: all approved Cookbook changes
- Modify after approval only: `docs/HANDOFF.md`

**Interfaces:**
- Consumes: Tasks 1–3 integrated worktree.
- Produces: artifact identity, full gate evidence, and independent GO/CHANGES verdict.

- [ ] **Step 1: Run unit tests**

```bash
./node_modules/.bin/vitest run --maxWorkers=1
```

Expected: all tests pass; record file/test counts.

- [ ] **Step 2: Run static gates sequentially**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: all exit 0.

- [ ] **Step 3: Run browser and PDF gates sequentially**

```bash
npm run test:browser
npx playwright test tests/media-print.spec.ts
npm run test:browser:export
```

Expected: all exit 0; media-print remains 8/8 unless the suite count changes for an explicitly added Work-stage assertion.

- [ ] **Step 4: Run default and isolated E2E sequentially**

```bash
npm run test:e2e
npm run test:e2e:local-draft
```

Expected: all required assertions pass with no failed or did-not-run tests.

- [ ] **Step 5: Verify source safety and scope**

From the V4 directory, run:

```bash
shasum -a 256 -c SHA256SUMS.txt
```

From the worktree root, run:

```bash
test ! -e Operations/CookBook/sot/v5-draft
/opt/homebrew/bin/git diff --check
/opt/homebrew/bin/git status --short
```

Expected: V4 5/5, real V5 path absent, diff check clean, no forbidden paths.

- [ ] **Step 6: Bind the uncommitted artifact**

Record separately:

```bash
/opt/homebrew/bin/git rev-parse HEAD
/opt/homebrew/bin/git diff --binary HEAD | shasum -a 256
/opt/homebrew/bin/git ls-files --others --exclude-standard \
  | LC_ALL=C sort \
  | while IFS= read -r file_path; do shasum -a 256 "$file_path"; done \
  | shasum -a 256
```

The tracked diff hash does not cover untracked files; both hashes are required.

- [ ] **Step 7: Request independent verification**

Send the exact HEAD, tracked diff SHA, untracked manifest SHA, gate counts, V4/V5 evidence, and acceptance checklist to the independent verifier. Require `[APPROVED][§13][Work-stage]` or `[CHANGES]`; the implementation owner must not self-approve.

- [ ] **Step 8: Update HANDOFF only after approval**

Append the Work-stage local-pilot GO record to `docs/HANDOFF.md`, clearly stating that the verified artifact is uncommitted and that the HANDOFF edit itself is documentation-only. Recompute the implementation hash excluding `docs/HANDOFF.md` and confirm it still matches the independently verified hash.

- [ ] **Step 9: Report completion without committing**

Report `[DONE]` with gate counts, artifact identity, verifier verdict, V4 5/5, real V5 absence, and remaining production/data boundaries. Do not stage or commit.
