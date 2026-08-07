# Cookbook V5 Draft Fill Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local Vite Cookbook Recipe Studio load the frozen 18-recipe V4 document, collect TINE's missing kitchen facts, and atomically persist one provenance-safe V5 draft.

**Architecture:** Keep the existing projected `CookbookSnapshot` lane unchanged for Library, Work Stage, Media, and Print. Add a focused raw-SOT lane for Source Review: pure document/edit/validation modules preserve every unknown V4 field, a dev-only Vite middleware owns the exact vault paths, and a feature-local provider drives the editable Recipe Studio. Production builds keep the current read-only projected prototype and contain no writable server endpoint.

**Tech Stack:** TypeScript 6, React 19, Vite 8 `configureServer`, Vitest 4, Testing Library, Playwright, Node built-in `fs`, `path`, `crypto`, and `http`; no new dependencies.

## Global Constraints

- Local pilot only; never touch Stock V1, Stock V2, auth, Supabase, production data, deployment, MAW/CROO, or GitHub Pages.
- Frozen V4 path: `Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json`; it is read-only and must continue to match adjacent `SHA256SUMS.txt`.
- Writable path: `Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json` only.
- V5 schema version is exactly `2.1.0-prototype-draft`; `derived_from` records the V4 relative path and verified SHA-256.
- Preserve recipe order, item order, existing object-key order, untouched values, kitchen units, and blocker code/message verbatim.
- Owner entry writes `source_values.owner_confirmation`, `candidate_text`, `selected_source = "owner_confirmation"`, `decision_status = "confirmed_by_owner"`, and a dated `decision_note`.
- Methods require `method_candidate_text`, `method_selected_source = "owner_confirmation"`, and a no-invention `method_decision_note`; yield uses existing `yield_candidate_text`.
- Blocker resolution adds only `resolved`, `resolved_note`, and `resolved_at`; never delete or rewrite blocker evidence and never mutate `review_state`.
- DRAFT is derived from unresolved blockers or derived owner-provenance incompleteness.
- All displayed counts are derived; the accepted V4 snapshot is 18 recipes, 4 sellable menus, 14 prepared recipes, 15 unique unresolved items, 13 blockers, 5 missing methods, and 1 provenance-incomplete item.
- Recipe 159 is not hardcoded. Its inherited provenance-incomplete item is grandfathered unchanged until TINE edits that item and must not block an unrelated save.
- Automated persistence tests use an isolated temporary vault and never create owner-confirmation data in the real V5 path.
- Use `/opt/homebrew/bin/git` for every Git command.

---

## File Structure

### New pure domain files

- `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotDocument.ts` — lossless raw JSON types, parsing, summary derivation, provenance cue, and DRAFT derivation.
- `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotDocument.test.ts` — V4 counts, five missing-method IDs, recipe-159 trap, and clone/order tests.
- `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotTransport.ts` — browser-safe endpoint constants and JSON response contracts shared by client and dev middleware.
- `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotEdits.ts` — explicit edit union and deterministic V5 construction without unit conversion.
- `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotEdits.test.ts` — exact field mapping, blocker history, metadata, and no-noise behavior.
- `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotValidation.ts` — server-side transition validation scoped to changed records.
- `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotValidation.test.ts` — grandfathered-row, dirty provenance, identity/order, review-state, and unapproved-field rejection.

### New dev-server files

- `webapp-prototype/cookbook-module-v1/dev/cookbookSotPlugin.ts` — exact-path V4/V5 middleware, SHA gate, payload bound, and atomic writer.
- `webapp-prototype/cookbook-module-v1/dev/cookbookSotPlugin.test.ts` — temporary-vault HTTP tests for read, fallback, save, traversal, symlink, checksum, and failed rename.

### New browser data/state files

- `webapp-prototype/cookbook-module-v1/src/data/KitchenSotDraftClient.ts` — same-origin V5-first/V4-fallback HTTP client.
- `webapp-prototype/cookbook-module-v1/src/data/KitchenSotDraftClient.test.ts` — fetch contract and error discrimination.
- `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotDraftProvider.tsx` — load/edit/save state boundary for raw SOT data.
- `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotDraftProvider.test.tsx` — dirty state, save receipt, reload state, and failure retention.
- `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotFillSurface.tsx` — existing-design fill controls and exact blocker display.
- `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotFillSurface.test.tsx` — 18-recipe rendering, derived counts, five missing methods, provenance cue, and field interactions.

### Existing files to modify

- `webapp-prototype/cookbook-module-v1/vite.config.ts` — register the dev-only middleware and include dev tests.
- `webapp-prototype/cookbook-module-v1/tsconfig.node.json` — typecheck `dev/**/*.ts` and local Playwright configuration.
- `webapp-prototype/cookbook-module-v1/src/features/review/SourceReviewPage.tsx` — select durable fill surface when a draft client is supplied; preserve legacy read-only surface otherwise.
- `webapp-prototype/cookbook-module-v1/src/features/review/SourceReviewPage.test.tsx` — assert explicit legacy/durable boundaries.
- `webapp-prototype/cookbook-module-v1/src/app/router.tsx` — pass the draft client only to Source Review.
- `webapp-prototype/cookbook-module-v1/src/app/router.test.tsx` — inject a fake client for durable-route coverage.
- `webapp-prototype/cookbook-module-v1/src/app/App.tsx` — create the local HTTP client only in Vite dev and correct the persistence notice.
- `webapp-prototype/cookbook-module-v1/src/app/App.test.tsx` — verify local-draft versus session-only messaging.
- `webapp-prototype/cookbook-module-v1/src/app/styles.css` — reuse existing spacing/color language for form, dirty, DRAFT, blocker, and error states.
- `webapp-prototype/cookbook-module-v1/package.json` — add isolated local-persistence test scripts without dependencies.
- `webapp-prototype/cookbook-module-v1/tests/no-production-network.spec.ts` — keep production preview explicitly read-only without treating the absent dev API as a failure.

### New local-persistence acceptance files

- `webapp-prototype/cookbook-module-v1/scripts/prepare-cookbook-test-vault.mjs` — create only `node_modules/.cache/cookbook-v5-e2e-vault` from the byte-identical fixture and its computed checksum.
- `webapp-prototype/cookbook-module-v1/playwright.local.config.ts` — run Vite dev against the isolated vault.
- `webapp-prototype/cookbook-module-v1/tests/cookbook-draft-persistence.spec.ts` — browser close/reopen, grandfather trap, low-noise diff, and checksum acceptance.

---

### Task 1: Lossless V4 document model and derived fill summary

**Files:**
- Create: `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotDocument.ts`
- Create: `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotDocument.test.ts`
- Read fixture: `webapp-prototype/cookbook-module-v1/src/data/fixtures/first-set.json`

**Interfaces:**
- Consumes: the raw JSON shape from frozen V4.
- Produces: `KitchenSotDocument`, `KitchenSotRecipe`, `KitchenSotItem`, `KitchenSotBlocker`, `parseKitchenSotDocument`, `deriveFillSummary`, `isOwnerProvenanceIncomplete`, `isKitchenSotRecipeDraft`, `cloneKitchenSotDocument`, browser-safe endpoint constants, and response contracts.

- [ ] **Step 1: Write the failing source-count and recipe-159 trap tests**

```ts
import fixture from "../../data/fixtures/first-set.json";
import {
  deriveFillSummary,
  isKitchenSotRecipeDraft,
  parseKitchenSotDocument,
} from "./kitchenSotDocument";

test("derives the accepted V4 fill surface without additive double-counting", () => {
  const document = parseKitchenSotDocument(fixture);
  expect(deriveFillSummary(document)).toEqual({
    recipeCount: 18,
    sellableMenuCount: 4,
    preparedRecipeCount: 14,
    unresolvedItemCount: 15,
    noSelectedSourceCount: 8,
    blockerCount: 13,
    missingMethodRecipeIds: [2, 160, 9, 161, 162],
    provenanceIncompleteCount: 1,
  });
});

test("derives recipe 159 as DRAFT from missing owner provenance without adding a blocker", () => {
  const document = parseKitchenSotDocument(fixture);
  const recipe = document.recipes.find(({ recipe_id }) => recipe_id === 159)!;
  expect(recipe.blockers).toHaveLength(0);
  expect(isKitchenSotRecipeDraft(recipe)).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `npm test -- --run src/domain/sot/kitchenSotDocument.test.ts`

Expected: FAIL because `kitchenSotDocument.ts` does not exist.

- [ ] **Step 3: Add the lossless raw types and strict parser**

```ts
export type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};

export type RecipeIdentity = number | string;

export type KitchenSotItem = Record<string, JsonValue> & {
  line_key: string;
  item_name: string;
  candidate_text: string | null;
  selected_source: string | null;
  decision_status: string;
  decision_note: string | null;
  source_values: Record<string, JsonValue>;
};

export type KitchenSotBlocker = Record<string, JsonValue> & {
  code: string;
  message: string;
  resolved?: boolean;
  resolved_note?: string;
  resolved_at?: string;
};

export type KitchenSotRecipe = Record<string, JsonValue> & {
  recipe_id: RecipeIdentity;
  recipe_name: string;
  recipe_type: "sellable_menu" | "prepared_recipe";
  review_state: string;
  items: KitchenSotItem[];
  method_candidate_text: string | null;
  method_selected_source: string | null;
  method_decision_note: string | null;
  yield_candidate_text: string | null;
  blockers: KitchenSotBlocker[];
};

export type KitchenSotDocument = Record<string, JsonValue> & {
  schema_version: string;
  generated_at: string;
  recipes: KitchenSotRecipe[];
};
```

Implement `parseKitchenSotDocument(value: unknown)` with named errors for a non-object document, non-array recipes/items/blockers, invalid recipe identity, missing strings, and invalid nullable strings. Return `structuredClone(value)` only after validation so callers never mutate the imported fixture.

- [ ] **Step 4: Implement derived summary and DRAFT helpers**

```ts
export function isOwnerProvenanceIncomplete(item: KitchenSotItem): boolean {
  const owner = item.source_values.owner_confirmation;
  return item.selected_source === "owner_confirmation" &&
    (typeof owner !== "string" || owner.trim() === "");
}

export function isKitchenSotRecipeDraft(recipe: KitchenSotRecipe): boolean {
  return recipe.blockers.some(({ resolved }) => resolved !== true) ||
    recipe.items.some(isOwnerProvenanceIncomplete);
}
```

Count unresolved items by the union predicate `decision_status === "needs_review" || decision_status === "conflict"`. Count missing methods only when `method_candidate_text` is null or empty after trimming. Preserve recipe order in `missingMethodRecipeIds`.

- [ ] **Step 5: Add clone/key-order regression assertions**

```ts
test("clones without mutating values or existing key order", () => {
  const document = parseKitchenSotDocument(fixture);
  const clone = cloneKitchenSotDocument(document);
  expect(JSON.stringify(clone)).toBe(JSON.stringify(document));
  clone.recipes[0]!.recipe_name = "changed only in clone";
  expect(document.recipes[0]!.recipe_name).not.toBe("changed only in clone");
});
```

- [ ] **Step 6: Add the browser-safe transport contract**

Create `kitchenSotTransport.ts` without Node imports:

```ts
import type { KitchenSotDocument } from "./kitchenSotDocument";

export const V4_ENDPOINT = "/__cookbook/v4";
export const V5_ENDPOINT = "/__cookbook/v5-draft";

export interface SotReadResponse {
  document: KitchenSotDocument;
  sourcePath: string;
  sourceSha256: string;
  origin: "v4" | "v5-draft";
}

export interface SotSaveResponse {
  document: KitchenSotDocument;
  sha256: string;
  generatedAt: string;
  path: string;
}
```

Both the browser client and Node middleware import this pure contract. The browser must never import `dev/cookbookSotPlugin.ts`.

- [ ] **Step 7: Run the focused tests and commit**

Run: `npm test -- --run src/domain/sot/kitchenSotDocument.test.ts`

Expected: PASS with 18 / 4+14 / 15 / 8 / 13 / five IDs / one provenance trap.

Commit:

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/src/domain/sot
/opt/homebrew/bin/git commit -m "feat(cookbook): model raw kitchen SOT document"
```

### Task 2: Explicit edit application and dirty-record transition validation

**Files:**
- Create: `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotEdits.ts`
- Create: `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotEdits.test.ts`
- Create: `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotValidation.ts`
- Create: `webapp-prototype/cookbook-module-v1/src/domain/sot/kitchenSotValidation.test.ts`

**Interfaces:**
- Consumes: raw document types from Task 1.
- Produces: `KitchenSotEdit`, `applyKitchenSotEdit`, `buildV5Draft`, `DerivedFrom`, `validateKitchenSotTransition`, and named validation errors.

- [ ] **Step 1: Write failing field-mapping tests**

```ts
test("writes owner confirmation with owner-specific status and a dated note", () => {
  const base = parseKitchenSotDocument(fixture);
  const edited = applyKitchenSotEdit(base, {
    kind: "item-owner-confirmation",
    recipeId: 164,
    lineKey: "164:direct:แป้งมันฮ่องกง",
    value: "1 ช้อนโต๊ะ",
    confirmedOn: "2026-08-07",
  });
  const item = edited.recipes.find(({ recipe_id }) => recipe_id === 164)!
    .items.find(({ line_key }) => line_key === "164:direct:แป้งมันฮ่องกง")!;
  expect(item.source_values.owner_confirmation).toBe("1 ช้อนโต๊ะ");
  expect(item.candidate_text).toBe("1 ช้อนโต๊ะ");
  expect(item.selected_source).toBe("owner_confirmation");
  expect(item.decision_status).toBe("confirmed_by_owner");
  expect(item.decision_note).toContain("2026-08-07");
});
```

Use the actual `line_key` read from the fixture in the test setup rather than assuming a generated key.

- [ ] **Step 2: Run edit tests to verify RED**

Run: `npm test -- --run src/domain/sot/kitchenSotEdits.test.ts`

Expected: FAIL because edit functions do not exist.

- [ ] **Step 3: Implement the complete edit union**

```ts
export type KitchenSotEdit =
  | { kind: "item-owner-confirmation"; recipeId: RecipeIdentity; lineKey: string; value: string; confirmedOn: string }
  | { kind: "item-serving-note"; recipeId: RecipeIdentity; lineKey: string; value: string }
  | { kind: "item-cost-basis"; recipeId: RecipeIdentity; lineKey: string; value: string }
  | { kind: "method"; recipeId: RecipeIdentity; value: string; decisionNote: string }
  | { kind: "yield"; recipeId: RecipeIdentity; value: string }
  | { kind: "resolve-blocker"; recipeId: RecipeIdentity; blockerIndex: number; note: string; resolvedAt: string };
```

Each action clones the input document, finds one exact recipe/item/blocker, changes only approved fields, and throws a named error for unknown identities, empty required text, invalid ISO date/timestamp, or an out-of-range blocker index. The item note format is `เจ้าของยืนยันวันที่ YYYY-MM-DD ว่า<recipe_name> ใช้<item_name> <raw value>`.

- [ ] **Step 4: Add method, yield, optional notes, and blocker-history tests**

```ts
test("resolves a blocker without removing or rewriting evidence", () => {
  const base = parseKitchenSotDocument(fixture);
  const before = structuredClone(base.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[0]!);
  const edited = applyKitchenSotEdit(base, {
    kind: "resolve-blocker",
    recipeId: 162,
    blockerIndex: 0,
    note: "ครัวยืนยันผลผลิตและวิธีเก็บแล้ว",
    resolvedAt: "2026-08-07T03:30:00.000Z",
  });
  const after = edited.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[0]!;
  expect({ code: after.code, message: after.message }).toEqual({
    code: before.code,
    message: before.message,
  });
  expect(after).toMatchObject({
    resolved: true,
    resolved_note: "ครัวยืนยันผลผลิตและวิธีเก็บแล้ว",
    resolved_at: "2026-08-07T03:30:00.000Z",
  });
});
```

Assert method edits require a non-empty no-invention note, yield writes only `yield_candidate_text`, and serving/cost edits keep raw strings unchanged.

- [ ] **Step 5: Implement deterministic V5 metadata construction**

```ts
export interface DerivedFrom {
  path: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
  sha256: string;
}

export function buildV5Draft(
  working: KitchenSotDocument,
  generatedAt: string,
  derivedFrom: DerivedFrom,
): KitchenSotDocument;
```

Clone the working document, replace the existing `schema_version` and `generated_at` values in place, and append `derived_from` only when absent. If `derived_from` already exists, preserve its key position while replacing its value. Serialize later with `JSON.stringify(document, null, 2) + "\n"`.

- [ ] **Step 6: Write failing transition-validation tests for the grandfather trap and forbidden changes**

```ts
test("allows an unrelated first edit while grandfathering the inherited provenance gap", () => {
  const source = parseKitchenSotDocument(fixture);
  const edited = applyKitchenSotEdit(source, {
    kind: "yield",
    recipeId: 162,
    value: "ค่าทดสอบใน temp vault",
  });
  const submitted = buildV5Draft(edited, "2026-08-07T03:31:00.000Z", derivedFrom);
  expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom)).not.toThrow();
  expect(submitted.recipes.find(({ recipe_id }) => recipe_id === 159)!.items)
    .toEqual(source.recipes.find(({ recipe_id }) => recipe_id === 159)!.items);
});

test("rejects a dirty owner item without owner_confirmation", () => {
  const source = parseKitchenSotDocument(fixture);
  const submitted = buildV5Draft(source, "2026-08-07T03:31:00.000Z", derivedFrom);
  const item = submitted.recipes[0]!.items[0]!;
  item.candidate_text = "changed";
  item.selected_source = "owner_confirmation";
  item.decision_status = "confirmed_by_owner";
  expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom))
    .toThrow(/owner_confirmation/u);
});
```

- [ ] **Step 7: Implement allowlisted structural diff validation**

Validate against `previousV5 ?? sourceV4`. Permit only:

```ts
const TOP_LEVEL_MUTABLE = new Set(["schema_version", "generated_at", "derived_from"]);
const RECIPE_MUTABLE = new Set([
  "method_candidate_text",
  "method_selected_source",
  "method_decision_note",
  "yield_candidate_text",
]);
const ITEM_MUTABLE = new Set([
  "candidate_text",
  "selected_source",
  "decision_status",
  "decision_note",
  "serving_note",
  "cost_basis_text",
  "source_values",
]);
const BLOCKER_MUTABLE = new Set(["resolved", "resolved_note", "resolved_at"]);
```

Require equal array lengths and identities at every recipe/item/blocker index. For `source_values`, permit only `owner_confirmation` to differ and require every pre-existing key/value/order to stay identical. For a changed owner item, require all five mapped fields. For a changed method, require owner source and a meaningful decision note. For a changed blocker, require original code/message plus resolution metadata. Reject any `review_state` change through the general immutable-field comparison.

- [ ] **Step 8: Run all SOT domain tests and commit**

Run: `npm test -- --run src/domain/sot`

Expected: PASS, including inherited recipe-159 save, dirty recipe-159 repair, order preservation, forbidden field, identity reorder, review-state mutation, and blocker rewrite cases.

Commit:

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/src/domain/sot
/opt/homebrew/bin/git commit -m "feat(cookbook): apply and validate v5 draft edits"
```

### Task 3: Dev-only exact-path Vite persistence middleware

**Files:**
- Create: `webapp-prototype/cookbook-module-v1/dev/cookbookSotPlugin.ts`
- Create: `webapp-prototype/cookbook-module-v1/dev/cookbookSotPlugin.test.ts`
- Modify: `webapp-prototype/cookbook-module-v1/vite.config.ts`
- Modify: `webapp-prototype/cookbook-module-v1/tsconfig.node.json`

**Interfaces:**
- Consumes: `parseKitchenSotDocument` and `validateKitchenSotTransition` from Tasks 1–2.
- Produces: `cookbookSotPlugin` and `createCookbookSotRequestHandler`; consumes endpoint/response contracts from the browser-safe transport module in Task 1.

- [ ] **Step 1: Write failing temporary-vault GET tests**

```ts
test("serves verified V4 and reports V5 missing without falling through", async () => {
  const vault = await makeTemporaryVault();
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  const v5 = await fetch(`${server.origin}/__cookbook/v5-draft`);
  expect(v5.status).toBe(404);
  const v4 = await fetch(`${server.origin}/__cookbook/v4`);
  expect(v4.status).toBe(200);
  expect((await v4.json()).sourceSha256).toBe(vault.sha256);
  await server.close();
});
```

`makeTemporaryVault()` uses `mkdtemp`, copies `src/data/fixtures/first-set.json` to the exact V4 relative path, writes an exact `SHA256SUMS.txt` entry, and removes only its own returned directory in `afterEach`.

- [ ] **Step 2: Run middleware tests to verify RED**

Run: `npm test -- --run dev/cookbookSotPlugin.test.ts`

Expected: FAIL because the dev middleware and test include do not exist.

- [ ] **Step 3: Add exact API contracts and bounded body reader**

```ts
const MAX_BODY_BYTES = 5 * 1024 * 1024;
```

Import `V4_ENDPOINT`, `V5_ENDPOINT`, `SotReadResponse`, and `SotSaveResponse` from `src/domain/sot/kitchenSotTransport.ts`. Accept only `GET` on V4 and `GET`/`PUT` on V5. Return JSON errors with stable codes: `METHOD_NOT_ALLOWED`, `SOURCE_CHECKSUM_MISMATCH`, `DRAFT_NOT_FOUND`, `INVALID_DRAFT`, `PAYLOAD_TOO_LARGE`, and `WRITE_FAILED`.

- [ ] **Step 4: Implement vault resolution and SHA gate**

Resolve fixed paths from `vaultRoot`; never read a request path. Verify the V4 real path is beneath the real source directory and its digest equals the exact entry parsed from `SHA256SUMS.txt`. After creating `v5-draft`, resolve its real directory and reject a symlink escape. If V5 exists, require its real path to equal the expected target beneath that directory.

- [ ] **Step 5: Implement validated atomic PUT**

```ts
const temporaryPath = join(realDraftDirectory, `.${V5_FILENAME}.${randomUUID()}.tmp`);
const handle = await open(temporaryPath, "wx");
try {
  await handle.writeFile(JSON.stringify(document, null, 2) + "\n", "utf8");
  await handle.sync();
  await handle.close();
  await rename(temporaryPath, targetPath);
} catch (error) {
  await handle.close().catch(() => undefined);
  await unlink(temporaryPath).catch(() => undefined);
  throw error;
}
```

Before writing: re-verify V4, parse the submitted document, load/validate existing V5 when present, and call `validateKitchenSotTransition`. Hash the exact serialized bytes returned in the success response.

- [ ] **Step 6: Add hostile-path, checksum, and interrupted-write tests**

Assert:

- `/__cookbook/v5-draft/../other` and encoded traversal never reach a filesystem operation;
- a symlinked draft directory outside the temporary vault is rejected;
- a one-byte V4 mutation returns `SOURCE_CHECKSUM_MISMATCH` for both GET V4 and PUT V5;
- unsupported POST/DELETE methods return 405;
- oversized and malformed payloads leave no V5;
- injected rename failure preserves the previous V5 byte-for-byte and leaves no `.tmp` file; and
- no operation calls chmod or deletion outside the request-owned temporary file.

- [ ] **Step 7: Register the plugin only in Vite dev**

```ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cookbookSotPlugin } from "./dev/cookbookSotPlugin";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultVaultRoot = resolve(moduleDirectory, "../../../../../..", "vault/nntn");

export default defineConfig({
  base: "/nntn-cookbook/",
  plugins: [
    react(),
    cookbookSotPlugin({
      vaultRoot: process.env.NNTN_VAULT_ROOT ?? defaultVaultRoot,
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "dev/**/*.{test,spec}.ts"],
    setupFiles: "./src/test/setup.ts",
  },
});
```

The plugin must implement `configureServer` only; it must not add `transform`, `load`, `generateBundle`, or preview-server hooks.

Update `tsconfig.node.json` to include `vite.config.ts`, `playwright.local.config.ts`, `dev/**/*.ts`, and the imported pure `src/domain/sot/**/*.ts` files. Do not add Node types to `tsconfig.app.json`.

- [ ] **Step 8: Run middleware tests, typecheck, build inspection, and commit**

Run:

```bash
npm test -- --run dev/cookbookSotPlugin.test.ts
npm run typecheck
npm run build
rg -n "node:fs|node:path|SHA256SUMS|Operations/CookBook/sot/v5-draft|chmod" dist
```

Expected: tests/typecheck/build PASS; `rg` returns no Node filesystem implementation, checksum-file access, writable filesystem path, or permission operation from `dist`. A browser endpoint string is allowed because the dev client needs to address the same-origin API.

Commit:

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/dev webapp-prototype/cookbook-module-v1/vite.config.ts webapp-prototype/cookbook-module-v1/tsconfig.node.json
/opt/homebrew/bin/git commit -m "feat(cookbook): add local v5 draft middleware"
```

### Task 4: V5-first browser client with fail-closed fallback

**Files:**
- Create: `webapp-prototype/cookbook-module-v1/src/data/KitchenSotDraftClient.ts`
- Create: `webapp-prototype/cookbook-module-v1/src/data/KitchenSotDraftClient.test.ts`

**Interfaces:**
- Consumes: browser-safe transport interfaces and raw document parser from Task 1.
- Produces: `KitchenSotDraftClient`, `HttpKitchenSotDraftClient`, `LoadedKitchenSotDraft`, and `KitchenSotHttpError`.

- [ ] **Step 1: Write failing V5-first/fallback tests**

```ts
test("falls back to V4 only when V5 returns DRAFT_NOT_FOUND", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(jsonResponse(404, { code: "DRAFT_NOT_FOUND" }))
    .mockResolvedValueOnce(jsonResponse(200, v4ReadResponse));
  const client = new HttpKitchenSotDraftClient(fetcher);
  await expect(client.load()).resolves.toMatchObject({ origin: "v4" });
  expect(fetcher).toHaveBeenNthCalledWith(1, "/__cookbook/v5-draft", expect.any(Object));
  expect(fetcher).toHaveBeenNthCalledWith(2, "/__cookbook/v4", expect.any(Object));
});

test.each([400, 409, 500])("does not hide V5 HTTP %s behind V4", async (status) => {
  const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, { code: "INVALID_DRAFT" }));
  await expect(new HttpKitchenSotDraftClient(fetcher).load()).rejects.toThrow(KitchenSotHttpError);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run client tests to verify RED**

Run: `npm test -- --run src/data/KitchenSotDraftClient.test.ts`

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement the client contract**

```ts
export interface LoadedKitchenSotDraft {
  document: KitchenSotDocument;
  origin: "v4" | "v5-draft";
  sourcePath: string;
  sourceSha256: string;
}

export interface KitchenSotDraftClient {
  load(): Promise<LoadedKitchenSotDraft>;
  save(document: KitchenSotDocument): Promise<SotSaveResponse>;
}
```

Use same-origin absolute endpoint paths, `cache: "no-store"`, `Accept: application/json`, and `Content-Type: application/json` for PUT. Parse every successful document with `parseKitchenSotDocument`. Cap surfaced server error text and never include filesystem stack traces.

- [ ] **Step 4: Add save request and malformed-response tests**

Assert PUT uses the exact V5 endpoint/body; save parses the returned persisted document; invalid JSON, missing fields, network failure, and HTML error bodies produce named user-safe errors.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- --run src/data/KitchenSotDraftClient.test.ts`

Expected: PASS.

Commit:

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/src/data/KitchenSotDraftClient.ts webapp-prototype/cookbook-module-v1/src/data/KitchenSotDraftClient.test.ts
/opt/homebrew/bin/git commit -m "feat(cookbook): load and save local SOT drafts"
```

### Task 5: Raw-draft React provider and save lifecycle

**Files:**
- Create: `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotDraftProvider.tsx`
- Create: `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotDraftProvider.test.tsx`

**Interfaces:**
- Consumes: `KitchenSotDraftClient`, raw document helpers, edit functions, and V5 builder.
- Produces: `KitchenSotDraftProvider`, `useKitchenSotDraft`, and `KitchenSotDraftContextValue`.

- [ ] **Step 1: Write failing load/edit/save lifecycle tests**

```tsx
function Harness() {
  const draft = useKitchenSotDraft();
  return <>
    <output aria-label="origin">{draft.origin}</output>
    <output aria-label="dirty">{String(draft.dirty)}</output>
    <button onClick={() => draft.applyEdit({
      kind: "yield",
      recipeId: 162,
      value: "ค่าทดสอบ temp",
    })}>edit</button>
    <button onClick={() => void draft.save()}>save</button>
  </>;
}

test("keeps dirty edits until an atomic save receipt replaces the base", async () => {
  const client = makeDraftClient(v4LoadedResponse);
  render(<KitchenSotDraftProvider client={client}><Harness /></KitchenSotDraftProvider>);
  expect(await screen.findByLabelText("origin")).toHaveTextContent("v4");
  await userEvent.click(screen.getByRole("button", { name: "edit" }));
  expect(screen.getByLabelText("dirty")).toHaveTextContent("true");
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByLabelText("dirty")).toHaveTextContent("false");
  expect(client.save).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run provider tests to verify RED**

Run: `npm test -- --run src/features/review/KitchenSotDraftProvider.test.tsx`

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement load state and context**

```ts
export interface KitchenSotDraftContextValue {
  document: KitchenSotDocument;
  summary: KitchenSotFillSummary;
  origin: "v4" | "v5-draft";
  dirty: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  saveMessage: string | null;
  applyEdit(edit: KitchenSotEdit): void;
  save(): Promise<void>;
}
```

Render distinct Thai loading and load-error states. Keep the mounted route alive after action/save errors. Ignore stale async load/save results after unmount or client replacement.

- [ ] **Step 4: Implement edit and save behavior**

On edit, call `applyKitchenSotEdit`, update only the working document, and set dirty. On save, reject clean saves, call `buildV5Draft` with current ISO time and loaded source lineage, then call the client. Replace base/working documents only with the server-returned document and clear dirty only on success.

- [ ] **Step 5: Add failure, rapid-save, and unmount tests**

Assert a failed save retains edits/dirty state, a second save cannot overlap an in-flight save, a successful receipt exposes path/SHA/time, and no state update occurs after unmount.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- --run src/features/review/KitchenSotDraftProvider.test.tsx`

Expected: PASS.

Commit:

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotDraftProvider*
/opt/homebrew/bin/git commit -m "feat(cookbook): manage durable recipe draft state"
```

### Task 6: Recipe Studio fill controls and exact readiness evidence

**Files:**
- Create: `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotFillSurface.tsx`
- Create: `webapp-prototype/cookbook-module-v1/src/features/review/KitchenSotFillSurface.test.tsx`
- Modify: `webapp-prototype/cookbook-module-v1/src/features/review/SourceReviewPage.tsx`
- Modify: `webapp-prototype/cookbook-module-v1/src/features/review/SourceReviewPage.test.tsx`

**Interfaces:**
- Consumes: `useKitchenSotDraft` from Task 5 and existing read-only Source Review implementation.
- Produces: editable Recipe Studio when `draftClient` exists, with the old projected view retained only for explicit read-only builds/tests.

- [ ] **Step 1: Write failing complete-render and count tests**

```tsx
test("renders all real recipes and derives the accepted snapshot counts", async () => {
  renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));
  expect(screen.getByText("18 สูตร")).toBeVisible();
  expect(screen.getByText("4 เมนูขาย + 14 สูตรประกอบ")).toBeVisible();
  expect(screen.getByText("15 รายการรอเคาะ")).toBeVisible();
  expect(screen.getByText("13 ตัวขวาง")).toBeVisible();
  expect(screen.getAllByRole("button", { name: /revision/u })).toHaveLength(18);
});

test("shows the derived provenance gap without hardcoding recipe 159", async () => {
  renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));
  await userEvent.click(screen.getByRole("button", { name: /ข้าวหน้าเนื้อยากินิกุ/u }));
  expect(screen.getByText("ข้อมูลยืนยันเจ้าของไม่ครบ")).toBeVisible();
  expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
});
```

- [ ] **Step 2: Run UI tests to verify RED**

Run: `npm test -- --run src/features/review/KitchenSotFillSurface.test.tsx`

Expected: FAIL because the fill surface does not exist.

- [ ] **Step 3: Build the derived summary and 18-recipe queue**

Reuse the existing Source Review typography/navigation structure. Each recipe button displays recipe name, revision, DRAFT/readiness, unresolved blocker count, and provenance cue. Use stable identity keys for number/string recipe IDs; do not expose internal candidate IDs as the primary label.

- [ ] **Step 4: Add item owner-confirmation inputs**

For each item row show item name, `candidate_text`, selected source, decision status, and an input labeled `ค่าหน้าครัว — <item_name>`. Initialize the input from `source_values.owner_confirmation` when present, otherwise from an empty string; do not prefill from a different source as if TINE confirmed it.

Keep typing in component-local controlled state and dispatch on blur:

```ts
{
  kind: "item-owner-confirmation",
  recipeId: recipe.recipe_id,
  lineKey: item.line_key,
  value,
  confirmedOn: localIsoDate(),
}
```

Expose `serving_note` and `cost_basis_text` as optional text inputs on the same row, using their existing raw values only.

- [ ] **Step 5: Add method, yield, and blocker controls**

Render a method textarea and separate required `method_decision_note` textarea. Render yield using `yield_candidate_text`. For every blocker, show `message` verbatim and never use the message as a React key; use recipe identity plus blocker index. Resolution requires a checkbox and non-empty note before dispatching `resolve-blocker`.

- [ ] **Step 6: Add save state and exact error behavior**

The save button is disabled when clean or saving. Display `กำลังบันทึก…`, the returned V5 path/SHA/time on success, and a safe error on failure. Never switch to fixture/mock data after a load or save error.

- [ ] **Step 7: Cover five missing methods and verbatim blockers**

```tsx
test.each([2, 160, 9, 161, 162])("renders missing method recipe %s as editable DRAFT", async (recipeId) => {
  const view = renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));
  await view.selectRecipe(recipeId);
  expect(screen.getByLabelText("วิธีทำจากหน้าครัว")).toHaveValue("");
  expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
});

test("renders all 13 blocker messages byte-for-byte", async () => {
  const document = parseKitchenSotDocument(fixture);
  const view = renderFillSurfaceWithDocument(document);
  for (const recipe of document.recipes.filter(({ blockers }) => blockers.length > 0)) {
    await view.selectRecipe(recipe.recipe_id);
    expect(screen.getAllByTestId("sot-blocker").map((node) => node.textContent))
      .toEqual(recipe.blockers.map(({ message }) => message));
  }
});
```

- [ ] **Step 8: Make SourceReviewPage choose durable versus explicit legacy mode**

```tsx
export function SourceReviewPage({ draftClient }: { draftClient?: KitchenSotDraftClient }) {
  if (draftClient === undefined) return <ReadOnlySourceReviewPage />;
  return (
    <KitchenSotDraftProvider client={draftClient}>
      <KitchenSotFillSurface />
    </KitchenSotDraftProvider>
  );
}
```

The legacy branch must say it is read-only. The durable branch must not render the old “session only / no storage” notice.

- [ ] **Step 9: Run review UI tests and commit**

Run: `npm test -- --run src/features/review`

Expected: PASS for existing source-review protections and new durable behavior.

Commit:

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/src/features/review
/opt/homebrew/bin/git commit -m "feat(cookbook): add persistent Recipe Studio fields"
```

### Task 7: App wiring, route injection, and accepted visual language

**Files:**
- Modify: `webapp-prototype/cookbook-module-v1/src/app/router.tsx`
- Modify: `webapp-prototype/cookbook-module-v1/src/app/router.test.tsx`
- Modify: `webapp-prototype/cookbook-module-v1/src/app/App.tsx`
- Modify: `webapp-prototype/cookbook-module-v1/src/app/App.test.tsx`
- Modify: `webapp-prototype/cookbook-module-v1/src/app/styles.css`

**Interfaces:**
- Consumes: `HttpKitchenSotDraftClient` and `SourceReviewPage({ draftClient })`.
- Produces: dev-only durable route wiring while every other page remains on the existing projected repository.

- [ ] **Step 1: Write failing router injection tests**

```tsx
test("passes the durable client only to Source Review", async () => {
  const client = makeDraftClient(v4LoadedResponse);
  render(
    <PrototypeProvider initialSnapshot={makeSnapshot()}>
      <MemoryRouter initialEntries={["/source-review"]}>
        <AppRoutes draftClient={client} />
      </MemoryRouter>
    </PrototypeProvider>,
  );
  expect(await screen.findByText("18 สูตร")).toBeVisible();
  expect(client.load).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run router/App tests to verify RED**

Run: `npm test -- --run src/app/router.test.tsx src/app/App.test.tsx`

Expected: FAIL because `draftClient` is not accepted.

- [ ] **Step 3: Wire the client through App and router**

Create one module-level `HttpKitchenSotDraftClient` only when `import.meta.env.DEV` is true. `App` accepts an optional injected client for tests. `AppRoutes` passes it only to `/source-review`; Recipe Library, Recipe Detail, Work Stage, Media, and Print keep using `PrototypeProvider` and the current fixture repository.

- [ ] **Step 4: Correct global persistence messaging**

When the durable client exists, render: `Recipe Studio บันทึกลง V5 draft ในเครื่อง · รูปและหน้าทดลองอื่นยังอยู่เฉพาะเซสชัน`. Without it, render the existing explicit read-only/session message. Keep the prototype/local labels; do not imply production approval.

- [ ] **Step 5: Add minimal responsive styles**

Reuse existing tokens/selectors for:

- `.sot-summary` responsive count row;
- `.sot-edit-grid` label/input layout;
- `.sot-draft-badge` and `.sot-provenance-warning`;
- `.sot-blocker` with unchanged message plus resolution controls;
- `.sot-save-bar` dirty/saving/saved/error state; and
- mobile table-to-card behavior without changing Print Center CSS.

No new colors, typefaces, illustrations, navigation, or print layout rules.

- [ ] **Step 6: Run app tests, accessibility queries, and commit**

Run:

```bash
npm test -- --run src/app src/features/review
npm run lint
npm run typecheck
```

Expected: PASS; every form control has an accessible Thai label and the production/read-only route remains explicit.

Commit:

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/src/app webapp-prototype/cookbook-module-v1/src/features/review webapp-prototype/cookbook-module-v1/src/app/styles.css
/opt/homebrew/bin/git commit -m "feat(cookbook): wire local draft Recipe Studio"
```

### Task 8: Isolated real-browser persistence acceptance and full sequential gate

**Files:**
- Create: `webapp-prototype/cookbook-module-v1/scripts/prepare-cookbook-test-vault.mjs`
- Create: `webapp-prototype/cookbook-module-v1/playwright.local.config.ts`
- Create: `webapp-prototype/cookbook-module-v1/tests/cookbook-draft-persistence.spec.ts`
- Modify: `webapp-prototype/cookbook-module-v1/package.json`
- Modify: `webapp-prototype/cookbook-module-v1/tests/no-production-network.spec.ts`
- Modify after evidence: `webapp-prototype/cookbook-module-v1/docs/HANDOFF.md`

**Interfaces:**
- Consumes: completed local API, client, provider, and fill surface.
- Produces: reproducible browser acceptance against an isolated vault plus final handoff evidence.

- [ ] **Step 1: Create the bounded test-vault preparer**

The script resolves only `node_modules/.cache/cookbook-v5-e2e-vault`, verifies the target is beneath `node_modules/.cache`, recreates that exact directory, copies `src/data/fixtures/first-set.json` to the V4 relative path, computes SHA-256 from copied bytes, and writes `SHA256SUMS.txt`. It must never reference the real vault or V5 path.

- [ ] **Step 2: Add local Playwright configuration and scripts**

```json
{
  "scripts": {
    "test:e2e:local-draft": "playwright test --config playwright.local.config.ts tests/cookbook-draft-persistence.spec.ts",
    "test:prepare:local-draft": "node scripts/prepare-cookbook-test-vault.mjs"
  }
}
```

Configure a single worker and a Vite dev web server:

```ts
webServer: {
  command: "npm run test:prepare:local-draft && NNTN_VAULT_ROOT=node_modules/.cache/cookbook-v5-e2e-vault npm run dev -- --host 127.0.0.1 --port 4188 --strictPort",
  url: "http://127.0.0.1:4188/nntn-cookbook/",
  reuseExistingServer: false,
}
```

- [ ] **Step 3: Write the failing first-save grandfather test**

```ts
test("saves an unrelated field while recipe 159 stays visibly provenance-incomplete", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("./#/source-review");
  await page.getByRole("button", { name: /ผงคั่วพริกเกลือ/u }).click();
  await page.getByLabel("ผลผลิตจากหน้าครัว").fill("ค่าทดสอบใน isolated vault");
  await page.getByRole("button", { name: "บันทึกฉบับร่าง V5" }).click();
  await expect(page.getByRole("status")).toContainText("บันทึกแล้ว");
  await page.getByRole("button", { name: /ข้าวหน้าเนื้อยากินิกุ/u }).click();
  await expect(page.getByText("ข้อมูลยืนยันเจ้าของไม่ครบ")).toBeVisible();
  await page.close();
});
```

- [ ] **Step 4: Write close/reopen persistence and low-noise diff acceptance**

Open a fresh page after closing the first page, confirm the isolated yield value remains, then read V4/V5 with Node in the test. Assert:

- V4 digest still equals its test `SHA256SUMS.txt` entry;
- V5 has `schema_version`, `generated_at`, and `derived_from` metadata;
- only the selected yield field plus metadata differ;
- recipe 159 items are deeply equal to V4;
- recipe/item array order is unchanged; and
- no real-vault path was created or modified by the test.

- [ ] **Step 5: Keep production preview explicitly read-only**

Update `tests/no-production-network.spec.ts` so the production build's Source Review branch asserts a visible read-only/local-dev-required message and performs no PUT/body request. All current strict browser boundary checks remain in place for the production preview suite.

- [ ] **Step 6: Run the targeted RED/GREEN acceptance**

Run: `npm run test:e2e:local-draft`

Expected: PASS for browser save, closed-page reopen, recipe-159 trap, low-noise diff, and isolated checksum.

- [ ] **Step 7: Run the complete sequential gate on one unchanged HEAD**

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
cd /Users/trirongyinwichapoon/tt3p/vault/nntn/Operations/CookBook/sot/v4-2026-08-05
shasum -a 256 -c SHA256SUMS.txt
```

Return to the module directory after the checksum command. Capture exact test counts, build result, both E2E results, and all checksum lines.

- [ ] **Step 8: Inspect build output and repository boundaries**

Run:

```bash
rg -n "node:fs|node:path|SHA256SUMS|Operations/CookBook/sot/v5-draft|chmod" dist
/opt/homebrew/bin/git status --short
/opt/homebrew/bin/git diff --name-only 695b25a..HEAD
```

Expected: no Node filesystem middleware, checksum reader, writable filesystem path, or permission operation in `dist`; a browser endpoint string is acceptable. Only Cookbook-scoped source/docs/tests changed; no Stock, auth, Supabase, deployment, or real V5 artifact from automated tests.

- [ ] **Step 9: Obtain independent final verification**

Send the final implementation commit, sequential-gate evidence, V4 checksum output, isolated V5 diff, and build-output scan to a verifier who did not author the design or NNTN decision. Acceptable lanes are codex-oracle or CROO. Require an explicit `[VERIFIED]` or exact `[CHANGES]`; NNTN Oracle's design approval alone is insufficient.

- [ ] **Step 10: Update handoff only after independent verification**

Record M1 scope, how to run `npm run dev`, the exact real V5 destination, test counts, checksum, independent verifier identity/verdict, and the fact that Print Center remains M2. Do not claim a real V5 SHA until TINE intentionally saves real kitchen data.

- [ ] **Step 11: Commit acceptance artifacts**

```bash
/opt/homebrew/bin/git add webapp-prototype/cookbook-module-v1/scripts webapp-prototype/cookbook-module-v1/playwright.local.config.ts webapp-prototype/cookbook-module-v1/tests webapp-prototype/cookbook-module-v1/package.json webapp-prototype/cookbook-module-v1/docs/HANDOFF.md
/opt/homebrew/bin/git commit -m "test(cookbook): prove local v5 draft persistence"
```

- [ ] **Step 12: Callback NNTN only with verified evidence**

Send `[DONE]` to `05-nntn:nntn-oracle.1` with implementation commit, local app command, expected V5 path, V4 SHA verification, exact acceptance counts, and independent verifier verdict. If any gate or verifier remains unresolved, send `[STUCK]` with the exact failing evidence instead of claiming completion.
