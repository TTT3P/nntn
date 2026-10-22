# Cookbook Phase 1 Managed Read/Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้าย Cookbook จาก local filesystem pilot ไปยัง managed document gateway ที่ TINE แก้ได้คนเดียว และเปิด kitchen view สำหรับอ่าน/พิมพ์โดยไม่มี write path พร้อมพิสูจน์ความครบของสูตร มือถือ และ A5 จากเครื่องพิมพ์จริง

**Architecture:** ใช้ portable `KitchenSotGateway` เป็น deep module กลางและมี `KitchenSotDocumentStore` seam สำหรับ filesystem กับ managed store. แผนนี้ใช้ Cloudflare Workers + Static Assets + D1 และ Access email one-time PIN สำหรับ owner เป็น concrete planning baseline ที่ TINE ต้อง ratify ก่อน execution; kitchen-device session ยังรอ D13. Owner surface และ kitchen view surface เป็น fixed deployment capabilities ไม่ใช่ role model: owner ใช้ GET/PUT; kitchen ใช้ GET เท่านั้นและ backend ปฏิเสธ PUT

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Playwright 1.62, Cloudflare Workers Static Assets, D1, Cloudflare Access email one-time PIN for owner, D13-approved kitchen-device access, SHA-256, Google Chrome, physical A5 printer

## Global Constraints

- Scope คือ Cookbook Phase 1 เท่านั้น: TINE แก้; ครัวอ่านและพิมพ์; พนักงานแก้ไม่ได้
- ห้ามสร้าง role table, permission editor, user administration หรือ generic authorization framework
- ห้ามรวม revision, audit history, structural edit ops, automatic merge หรือ normalized recipe schema
- project, domain, repository, pipeline, credentials และ data store ต้องแยกจาก Stock V1/V2 โดยเด็ดขาด
- ห้ามแตะ Stock V1/V2, production Supabase เดิม, auth เดิม, production data, deployment เดิม, MAW หรือ CROO
- V4 ต้องเก็บ exact bytes และ frozen SHA `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`; runtime ไม่มี V4 write/delete operation
- real V5 baseline ตอนเขียนแผนคือ `2a715ce11bbc9cc58ce46bd89afc2b2d01dfaa7d91d92ced52beb9b605a7ce05`; test ทุกชุดต้องใช้ isolated copy/store และห้าม mutate real V5
- V5 คง whole-document optimistic concurrency ด้วย `If-Match` + `base_sha256` + atomic compare-and-swap จนกว่า D8 จะถูกแก้ ADR
- Production configuration ต้อง fail closed; ห้าม fallback ไป fixture/session-only โดยเงียบ
- Kitchen surface ต้องไม่มี Recipe Studio route และ `PUT /__cookbook/v5-draft` ต้อง fail ที่ backend ไม่ใช่แค่ซ่อนปุ่ม
- ห้ามใช้ provider default session lifetime เป็น D13; ต้องบันทึกตัวเลข lifetime, renewal mechanism และผู้รับผิดชอบให้ชัด
- `cost_basis_text` ห้ามปรากฏในเอกสารครัว
- ใช้ `/opt/homebrew/bin/git`; ห้าม commit, push หรือ deploy จน TINE สั่งแต่ละการกระทำโดยตรง
- ก่อน implementation ให้ใช้ `superpowers:using-git-worktrees` เพื่อสร้าง isolated worktree ใน dedicated Cookbook repository
- dependent gates รัน sequential และหยุดที่ failure แรก

## Planning Baseline That Requires TINE Ratification

แผนนี้ไม่อนุมัติ provider หรือ deployment เอง. ก่อน Task 2 ต้องแก้ ADR ให้บันทึกคำตอบจริงต่อไปนี้:

| Decision | Recommended Phase-1 value used by this plan | Stop condition |
|---|---|---|
| D8 concurrency | คง whole-document stale guard; TINE เป็น editor คนเดียว; ไม่มี merge | ถ้า TINE ต้องการ merge ให้หยุดและออกแบบ Phase 1 ใหม่ |
| D9 ownership/provider | Cloudflare account/domain/secrets/backup owned by TINE; dedicated `nntn-cookbook` project/repository | ห้ามสร้าง resource ถ้ายังไม่มี named owner และ explicit approval |
| D10 outage | fail closed พร้อมข้อความภาษาไทย; ใช้ A5 printed set ล่าสุดเป็น operational fallback; ไม่มี offline editing/cache ใน Phase 1 | ถ้าต้องการ offline cache ให้ทำ design แยกก่อน |
| D12 devices | owner desktop Chrome + อุปกรณ์ครัวจริงอย่างน้อย 1 เครื่อง + เครื่องพิมพ์จริง 1 เครื่อง; บันทึกรุ่น/OS/browser/printer driver ก่อน test | ห้ามประกาศ GO ถ้ายังไม่มี inventory และ physical print evidence |
| D13 kitchen session | ไม่มี default: TINE ต้องเลือก session lifetime เป็นตัวเลขและ renewal path ที่ทำงานได้เมื่อ TINE ไม่อยู่ เช่น device-bound credential/service token หรือวิธีอื่นที่ตรวจสอบได้ | ห้าม configure kitchen Access หรือประกาศ GO จน D13 ถูกบันทึกใน ADR |
| Phase-1 access | Cloudflare Access email one-time PIN สำหรับ owner TINE; kitchen ใช้ D13-approved managed device session; ไม่มี anonymous internet read | ถ้าต้องการ anonymous หรือ staff login ให้แก้ ADR ก่อน |

## Definition of Phase-1 Complete

Phase 1 เป็น **GO** ได้เมื่อครบทุกข้อพร้อมหลักฐาน:

1. V5 มี 18 recipes, 126 items, unresolved item decision 0, provenance gap 0 และ unresolved blocker 0
2. สูตรทั้ง 18 ให้ canonical readiness = READY; วิธีทำที่จำเป็นครบหรือมี explicit owner N/A; `yield_candidate_text` ทุกสูตรไม่ว่าง
3. Library, Detail, Work และ Print อ่าน managed `v5-current` เดียวกัน; origin ไม่ใช่ fixture/session-only
4. TINE ผ่าน email one-time PIN และ save/reload Recipe Studio ได้บน owner surface
5. Kitchen view แสดง Library/Detail/Work/Print แต่ไม่มี Recipe Studio route/nav และ PUT ถูก backend ปฏิเสธ
6. สอง save จาก baseline เดียวกัน: request แรกผ่าน; request ที่สองได้ `409 STALE_DRAFT`; bytes แรกยัง authoritative
7. V4 managed bytes SHA ตรง frozen SHA และไม่มี runtime write/delete route
8. V5 import/export/restore รักษา exact bytes และ SHA; ไม่มี reorder/normalize noise
9. Owner desktop และอุปกรณ์ครัวจริงที่ D12 ระบุใช้งานผ่าน HTTPS ได้เมื่อเครื่อง TINE ปิด
10. อุปกรณ์ครัวยังอ่าน/พิมพ์ได้หลังผ่าน session expiry/renewal หนึ่งรอบตาม D13 โดยไม่ให้ TINE ออก OTP, remote-login หรือมาอยู่หน้าเครื่อง
11. A5 จากเครื่องพิมพ์จริงในร้านอ่านครบ ไม่มี clipping, blank tail หรือ app UI; A4/PDF automated gates ยังเขียว
12. Kitchen documents ไม่แสดง `cost_basis_text`; removed dependencies ไม่กลับมา; operational facts ตรง raw source
13. Network/security evidence ไม่มี request, credential หรือ dependency ไป Stock V1/V2 หรือ production Supabase เดิม
14. Backup restore และ rollback rehearsal ผ่าน; outage behavior ตรง D10
15. Independent verifier อนุมัติ artifact identity, security boundary, data hashes, session-expiry, actual-device และ physical-print evidence
16. TINE ดู staging demo แล้วอนุมัติ deployment แยกต่างหาก

## Proposed File Structure

หลัง Task 1 ให้ implementation อยู่ใน dedicated repository `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook`:

```text
nntn-cookbook/
  src/
    app/
      App.tsx
      router.tsx
    config/
      cookbookRuntime.ts
    data/
      KitchenSotDraftClient.ts
    domain/sot/
      kitchenSotDocument.ts
      kitchenSotEdits.ts
      kitchenSotSerialization.ts
      kitchenSotValidation.ts
      KitchenSotGateway.ts
      KitchenSotDocumentStore.ts
    features/
  dev/
    FileKitchenSotDocumentStore.ts
    cookbookSotHttpHandler.ts
    cookbookSotPlugin.ts
  worker/
    src/
      index.ts
      access.ts
      D1KitchenSotDocumentStore.ts
    migrations/
      0001_cookbook_documents.sql
    test/
      gateway.worker.test.ts
      surfaces.worker.test.ts
  scripts/
    import-cookbook-artifacts.mjs
    export-cookbook-artifacts.mjs
    check-phase1-readiness.mjs
  tests/
    cookbook-managed-owner.spec.ts
    cookbook-managed-kitchen.spec.ts
    cookbook-draft-persistence.spec.ts
    media-print.spec.ts
  wrangler.jsonc
```

`KitchenSotGateway` owns business/persistence orchestration. Stores own exact-byte persistence. HTTP handlers own routes/auth/body/status. React owns presentation only

---

### Task 0: Close the Remaining Decision Gate

**Files:**
- Modify: `docs/superpowers/specs/2026-08-08-managed-document-gateway-adr-draft.md`
- Modify: `docs/superpowers/specs/2026-08-08-kitchen-sot-validation-core-adapter-separation-design.md`
- Reference: `docs/superpowers/plans/2026-08-08-cookbook-phase-1-managed-read-print.md`

**Interfaces:**
- Consumes: TINE answers for D8, D9, D10, D12, D13 and Phase-1 access baseline
- Produces: ADR status `Accepted` plus exact owner/provider/outage/device values that all later tasks may rely on

- [ ] **Step 1: Record the accepted values verbatim**

Replace the four open-decision rows with TINE's actual answers. Do not infer account email, domain, device model or printer model from environment state

- [ ] **Step 2: Record the Phase-1 access decision**

The accepted text must say whether the proposed two fixed surfaces are accepted. If not accepted, stop; do not reinterpret “no roles” as permission to expose recipes anonymously

- [ ] **Step 3: Run the decision completeness check**

Run:

```bash
rg -n 'D8|D9|D10|D12|D13|Phase-1 access|Accepted' \
  docs/superpowers/specs/2026-08-08-managed-document-gateway-adr-draft.md
rg -n 'ยังรอ|pending|ห้ามเดา|Proposed Phase-1' \
  docs/superpowers/specs/2026-08-08-managed-document-gateway-adr-draft.md
```

Expected: every decision has an accepted value and the second command returns no unresolved marker in an executable section

- [ ] **Step 4: Obtain explicit mutation approvals**

Require separate TINE approval for repository creation, cloud resource creation, data import, commit, push and deployment. An approval for one does not authorize the others

- [ ] **Step 5: Checkpoint**

Report ADR SHA-256 and stop if any decision or approval is missing. Do not create resources

---

### Task 1: Create the Dedicated Cookbook Repository Without Touching Stock

**Files:**
- Source tree: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn/.worktrees/kitchen-sot-prototype-v2/webapp-prototype/cookbook-module-v1`
- Create repository: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook`
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/AGENTS.md`
- Create: `/Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook/docs/PROVENANCE.md`

**Interfaces:**
- Consumes: clean, explicitly approved Cookbook commit containing the accepted ADR and this plan
- Produces: isolated Cookbook-only git repository and worktree; no Stock paths, remotes, secrets or pipelines

- [ ] **Step 1: Verify the source commit and scope**

Run with `/opt/homebrew/bin/git`:

```bash
/opt/homebrew/bin/git status --short
/opt/homebrew/bin/git rev-parse HEAD
/opt/homebrew/bin/git diff HEAD^ --name-only | rg -v '^webapp-prototype/cookbook-module-v1/'
```

Expected: clean tree; approved commit ID; final command produces no path. If it produces any Stock/auth/Supabase path, stop

- [ ] **Step 2: Write a source-tree integrity receipt**

Run:

```bash
/opt/homebrew/bin/git ls-tree -r HEAD webapp-prototype/cookbook-module-v1 \
  | shasum -a 256
```

Save commit ID and tree SHA in `docs/PROVENANCE.md` after extraction

- [ ] **Step 3: Extract only the Cookbook subtree**

After explicit repository-creation approval, use a temporary subtree branch and clone it into the exact dedicated path. Do not add a remote or push

```bash
/opt/homebrew/bin/git subtree split \
  --prefix=webapp-prototype/cookbook-module-v1 \
  -b cookbook-phase1-export
/opt/homebrew/bin/git clone --single-branch --branch cookbook-phase1-export \
  /Users/trirongyinwichapoon/tt3p/product-hub/nntn \
  /Users/trirongyinwichapoon/tt3p/product-hub/nntn-cookbook
```

- [ ] **Step 4: Add repository-local scope rules**

Create `AGENTS.md` that carries forward Cookbook verification and hard boundaries, removes obsolete “session-only” language, and explicitly forbids Stock/Supabase-production access

- [ ] **Step 5: Prove isolation before code work**

Run inside the new repository:

```bash
rg -n 'emjqulzikpxorvpaaiww|stock\.|supabaseUrl|service_role' . \
  -g '!node_modules' -g '!docs/PRD.html'
/opt/homebrew/bin/git remote -v
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: secret/project scan returns no active integration; no production remote; baseline gates pass

- [ ] **Step 6: Checkpoint**

Report new-repo tree SHA and gate counts. Do not commit or create a remote without separate approval

---

### Task 2: Lock Deterministic Bytes and the Store Interface

**Files:**
- Create: `src/domain/sot/kitchenSotSerialization.ts`
- Create: `src/domain/sot/kitchenSotSerialization.test.ts`
- Create: `src/domain/sot/KitchenSotDocumentStore.ts`
- Create: `src/domain/sot/KitchenSotGateway.test.ts`
- Create: `src/test/InMemoryKitchenSotDocumentStore.ts`
- Reference: `src/domain/sot/kitchenSotValidation.ts`

**Interfaces:**
- Consumes: `KitchenSotDocument`, `validateKitchenSotTransition()` and exact frozen V4 SHA
- Produces: `serializeKitchenSotDocument()`, `sha256Hex()`, `KitchenSotDocumentStore` and an in-memory contract target

- [ ] **Step 1: Write failing exact-byte tests**

Tests must assert:

```ts
expect(serializeKitchenSotDocument(document)).toEqual(
  new TextEncoder().encode(`${JSON.stringify(document, null, 2)}\n`),
);
expect(await sha256Hex(bytes)).toMatch(/^[0-9a-f]{64}$/u);
```

Add a fixture assertion that optional item/blocker edit permutations serialize to byte-identical output

- [ ] **Step 2: Run the focused tests to prove RED**

```bash
npx vitest run src/domain/sot/kitchenSotSerialization.test.ts
```

Expected: FAIL because the serializer/hash functions do not exist

- [ ] **Step 3: Define the store seam**

Use the exact interface from the accepted separation design:

```ts
export interface StoredKitchenSotArtifact {
  bytes: Uint8Array;
  sha256: string;
}

export type CompareAndSwapResult =
  | { kind: "saved"; stored: StoredKitchenSotArtifact }
  | { kind: "stale" };

export interface KitchenSotDocumentStore {
  readFrozenSource(): Promise<StoredKitchenSotArtifact>;
  readCurrentDraft(): Promise<StoredKitchenSotArtifact | null>;
  compareAndSwapDraft(command: {
    expectedBaseSha256: string;
    nextBytes: Uint8Array;
    nextSha256: string;
  }): Promise<CompareAndSwapResult>;
}
```

- [ ] **Step 4: Implement the minimal runtime-neutral serializer/hash helper**

Use `TextEncoder` and Web Crypto. The function must hash bytes, never a parsed object. Do not add provider SDKs

- [ ] **Step 5: Implement the in-memory store only for tests**

It must atomically model first write from V4 SHA and subsequent compare-and-swap from current V5 SHA. Expose no source-write method

- [ ] **Step 6: Run focused and existing domain tests**

```bash
npx vitest run \
  src/domain/sot/kitchenSotSerialization.test.ts \
  src/domain/sot/kitchenSotDocument.test.ts \
  src/domain/sot/kitchenSotEdits.test.ts \
  src/domain/sot/kitchenSotValidation.test.ts
```

Expected: PASS; no expected value weakened

- [ ] **Step 7: Checkpoint**

Run `git diff --check`, report changed files, tests and byte fixture SHA. Do not commit without separate authorization

---

### Task 3: Extract the Portable KitchenSotGateway

**Files:**
- Create: `src/domain/sot/KitchenSotGateway.ts`
- Modify: `src/domain/sot/KitchenSotGateway.test.ts`
- Reference: `src/domain/sot/kitchenSotTransport.ts`
- Reference: `src/domain/sot/kitchenSotValidation.ts`

**Interfaces:**
- Consumes: `KitchenSotDocumentStore`, serializer/hash functions and transport types
- Produces: `KitchenSotGateway.readSource()`, `readCurrentDraft()` and `saveDraft()`

- [ ] **Step 1: Write the reusable gateway contract tests**

Cover these exact cases against the in-memory store:

```ts
test("reads verified V4 and reports a missing draft", async () => {});
test("rejects a frozen-source checksum mismatch", async () => {});
test("rejects a parseable but invalid existing V5", async () => {});
test("requires matching header and body preconditions", async () => {});
test("rejects an invalid transition without mutating current bytes", async () => {});
test("allows one of two saves from the same base and makes the other stale", async () => {});
test("returns the SHA of exact persisted bytes", async () => {});
test("does not expose a source write operation", async () => {});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/domain/sot/KitchenSotGateway.test.ts
```

Expected: FAIL because `KitchenSotGateway` is absent

- [ ] **Step 3: Implement the deep-module interface**

```ts
export interface SaveDraftIntent {
  ifMatchSha256: string | null;
  bodyBaseSha256: string | null;
  document: unknown;
}

export class KitchenSotGateway {
  constructor(store: KitchenSotDocumentStore, frozenSourceSha256: string);
  readSource(): Promise<SotReadResponse>;
  readCurrentDraft(): Promise<SotReadResponse>;
  saveDraft(intent: SaveDraftIntent): Promise<SotSaveResponse>;
}
```

Gateway must compute/verify every artifact SHA from `bytes`; never trust the adapter's metadata alone

- [ ] **Step 4: Preserve the named error vocabulary**

Implement typed core errors that map one-to-one to existing codes: `DRAFT_NOT_FOUND`, `SOURCE_CHECKSUM_MISMATCH`, `STALE_DRAFT`, `INVALID_DRAFT`, `PRECONDITION_REQUIRED`, `WRITE_FAILED`

- [ ] **Step 5: Run GREEN and mutation-safety assertions**

```bash
npx vitest run src/domain/sot/KitchenSotGateway.test.ts
```

Expected: PASS including byte equality before/after every rejected save

- [ ] **Step 6: Run all domain/client/provider tests**

```bash
npx vitest run src/domain/sot src/data/KitchenSotDraftClient.test.ts \
  src/features/review/KitchenSotDraftProvider.test.tsx
```

- [ ] **Step 7: Checkpoint**

Report gateway contract count and store state hashes. No commit without explicit instruction

---

### Task 4: Put the Existing Filesystem Behind the Store Seam

**Files:**
- Create: `dev/FileKitchenSotDocumentStore.ts`
- Create: `dev/FileKitchenSotDocumentStore.test.ts`
- Create: `dev/cookbookSotHttpHandler.ts`
- Modify: `dev/cookbookSotPlugin.ts`
- Modify: `dev/cookbookSotPlugin.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `KitchenSotDocumentStore`, `KitchenSotGateway`
- Produces: filesystem adapter with existing path/lock/atomic-write safety and thin Vite wiring

- [ ] **Step 1: Move tests before implementation**

Keep every filesystem attack/race test. Re-home only the tests whose subject becomes `FileKitchenSotDocumentStore`; do not delete or weaken expected failures

- [ ] **Step 2: Add the gateway contract suite against the filesystem adapter**

Run the same behavior cases from Task 3 using a temporary vault. Keep symlink/path/lock tests filesystem-only

- [ ] **Step 3: Run RED with a seam-only stub**

```bash
npx vitest run dev/FileKitchenSotDocumentStore.test.ts dev/cookbookSotPlugin.test.ts
```

Expected: FAIL until the adapter is implemented

- [ ] **Step 4: Move exact filesystem responsibilities**

Move only:

- path allowlist and realpath/symlink checks;
- manifest/source exact-byte reads;
- V5 exact-byte reads;
- lock ownership and serialization;
- exclusive temp write, sync and atomic rename;
- current-byte compare inside the lock;
- owned temp/lock cleanup

Do not duplicate transition validation or deterministic serialization in this adapter

- [ ] **Step 5: Reduce the Vite plugin to wiring**

`cookbookSotPlugin()` should instantiate the filesystem store, gateway and HTTP handler. `configureServer` remains dev-only

- [ ] **Step 6: Run adapter, plugin and local-draft E2E**

```bash
npx vitest run dev/FileKitchenSotDocumentStore.test.ts dev/cookbookSotPlugin.test.ts
npm run test:e2e:local-draft
```

Expected: all previous security/race cases plus 3/3 local-draft scenarios pass

- [ ] **Step 7: Prove byte compatibility**

Save the same isolated edit through pre-refactor baseline and new adapter. Assert SHA and bytes are identical

- [ ] **Step 8: Checkpoint**

Run full unit/lint/typecheck/build and report counts. Stop on any behavior difference

---

### Task 5: Add Explicit Owner and Kitchen Runtime Surfaces

**Files:**
- Create: `src/config/cookbookRuntime.ts`
- Create: `src/config/cookbookRuntime.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/router.test.tsx`
- Modify: `src/data/KitchenSotDraftClient.ts`
- Test: `tests/cookbook-managed-kitchen.spec.ts`

**Interfaces:**
- Consumes: existing `KitchenSotDraftClient.load()/save()`
- Produces: explicit runtime mode `fixture-demo | local-filesystem | managed-owner | managed-kitchen`

- [ ] **Step 1: Write runtime parsing tests**

```ts
expect(resolveCookbookRuntime("managed-owner")).toEqual({
  source: "managed",
  surface: "owner",
  writable: true,
});
expect(resolveCookbookRuntime("managed-kitchen")).toEqual({
  source: "managed",
  surface: "kitchen",
  writable: false,
});
expect(() => resolveCookbookRuntime(undefined)).toThrow("COOKBOOK_RUNTIME_REQUIRED");
```

Production build must not infer mode from `import.meta.env.DEV`

- [ ] **Step 2: Write kitchen route tests**

Assert kitchen mode has `/recipes`, detail, `/work/:id`, `/print`; requesting `/source-review` redirects to `/recipes`; no Recipe Studio navigation or copy appears

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/config/cookbookRuntime.test.ts src/app/router.test.tsx src/app/App.test.tsx
```

- [ ] **Step 4: Implement minimal fixed-surface configuration**

Load managed V5 through `KitchenSotDraftProvider` in both modes so readiness/Work/Print use raw state. Pass the writable client to `SourceReviewPage` only in owner mode

- [ ] **Step 5: Add a backend-independent PUT tripwire test**

In kitchen E2E, intercept requests and fail the test if the app emits any non-GET request to `/__cookbook/*`

- [ ] **Step 6: Run GREEN and full UI tests**

```bash
npx vitest run src/config/cookbookRuntime.test.ts src/app/App.test.tsx src/app/router.test.tsx
npx playwright test tests/cookbook-managed-kitchen.spec.ts
```

- [ ] **Step 7: Checkpoint**

Report route matrix and request log. No role model or permission data may appear in the diff

---

### Task 6: Add the Managed D1 Store and Two Fixed Worker Surfaces

**Files:**
- Create: `worker/migrations/0001_cookbook_documents.sql`
- Create: `worker/src/D1KitchenSotDocumentStore.ts`
- Create: `worker/src/index.ts`
- Create: `worker/src/access.ts`
- Create: `worker/test/gateway.worker.test.ts`
- Create: `worker/test/surfaces.worker.test.ts`
- Create: `wrangler.jsonc`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `KitchenSotDocumentStore`, `KitchenSotGateway`, accepted D9 provider/account, accepted D13 kitchen session and fixed surface mode
- Produces: D1-backed compare-and-swap store; owner GET/PUT Worker; kitchen GET-only Worker

- [ ] **Step 1: Re-check official provider docs**

Before adding SDK/config, verify current official Cloudflare documentation for Workers Static Assets, D1 BLOB binding, local test pool, Access JWT validation and environment routing. Record documentation URLs and versions in `docs/PROVENANCE.md`

- [ ] **Step 2: Write the schema**

Use an exact-byte document table:

```sql
CREATE TABLE cookbook_documents (
  document_key TEXT PRIMARY KEY CHECK (document_key IN ('v4-source', 'v5-current')),
  document_bytes BLOB NOT NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
```

Runtime has no migration or route that updates/deletes `v4-source`

- [ ] **Step 3: Write failing Worker store contract tests**

Run Task 3's contract against local D1 and add:

- exact BLOB bytes round-trip;
- atomic first insert only when V5 absent and V4 SHA matches;
- conditional update only when current SHA matches;
- concurrent same-base writes yield one saved and one stale;
- V4 update/delete statement is absent from runtime adapter

- [ ] **Step 4: Run RED**

```bash
npx vitest run --config worker/vitest.config.ts worker/test/gateway.worker.test.ts
```

- [ ] **Step 5: Implement the D1 adapter**

Use a single conditional SQL statement per first/subsequent write. Do not implement `read -> compare -> unconditional update`

- [ ] **Step 6: Write and implement surface tests**

Tests must assert:

```text
owner:  GET V4 = 200, GET V5 = 200/404, PUT V5 = gateway result
kitchen: GET V4 = 200, GET V5 = 200/404, PUT V5 = 405 METHOD_NOT_ALLOWED
unknown path/method: no datastore access
```

Surface mode comes from trusted Worker environment binding. Do not trust request `Origin` or a browser-provided mode header

- [ ] **Step 7: Add owner and kitchen-device Access verification**

Owner verifies provider assertion and exact configured TINE email. Kitchen verifies only the D13-approved device credential/session and its renewal contract. Do not create users, roles or permission tables. Reject missing/invalid identity before reading data

- [ ] **Step 8: Run Worker tests and secret scan**

```bash
npx vitest run --config worker/vitest.config.ts
rg -n 'service_role|emjqulzikpxorvpaaiww|SUPABASE|stock\.' . \
  -g '!node_modules' -g '!docs/PRD.html'
```

Expected: Worker tests pass; scan finds no active Stock/Supabase integration

- [ ] **Step 9: Checkpoint**

Report local D1 schema hash, contract counts and surface evidence. Do not create remote D1/Worker resources without separate approval

---

### Task 7: Build a Fail-Closed Managed Production Client

**Files:**
- Modify: `src/data/KitchenSotDraftClient.ts`
- Modify: `src/data/KitchenSotDraftClient.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `vite.config.ts`
- Create: `tests/cookbook-managed-owner.spec.ts`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Consumes: fixed Worker surface routes and runtime configuration from Task 5
- Produces: owner/kitchen production builds that use same-origin managed gateway and never fixture fallback

- [ ] **Step 1: Write production-mode failure tests**

Assert missing runtime config or unreachable managed gateway renders a blocking Thai error and does not mount fixture recipes

- [ ] **Step 2: Write owner workflow E2E against local Worker+D1**

Cover load V5, edit one isolated field, save, reload, stale second page and exact persisted SHA. Never use real V5

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/data/KitchenSotDraftClient.test.ts src/app/App.test.tsx
npx playwright test tests/cookbook-managed-owner.spec.ts
```

- [ ] **Step 4: Implement explicit same-origin managed mode**

Remove production behavior that derives client availability only from `import.meta.env.DEV`. Preserve local-filesystem mode for the pilot and tests

- [ ] **Step 5: Verify owner/kitchen build separation**

Build both modes and inspect emitted assets/config. Kitchen build must have no navigable Recipe Studio route; both modes must call managed endpoints

- [ ] **Step 6: Run GREEN**

```bash
npm run build
npx playwright test tests/cookbook-managed-owner.spec.ts tests/cookbook-managed-kitchen.spec.ts
```

- [ ] **Step 7: Checkpoint**

Report build artifact hashes, endpoint request logs and absence of fixture fallback

---

### Task 8: Create Exact Import, Export and Restore Tools

**Files:**
- Create: `scripts/import-cookbook-artifacts.mjs`
- Create: `scripts/export-cookbook-artifacts.mjs`
- Create: `scripts/cookbook-artifact-tools.test.mjs`
- Modify: `package.json`
- Create: `docs/RUNBOOK-PHASE-1.md`

**Interfaces:**
- Consumes: explicit V4/V5 file paths, expected SHA values and target Worker environment
- Produces: idempotent staging seed, exact export receipt and verified restore procedure

- [ ] **Step 1: Write isolated tool tests**

Use temp files and local D1. Assert wrong SHA aborts before write, V4 cannot be overwritten, V5 import/export bytes are identical and restore returns the selected SHA

- [ ] **Step 2: Run RED**

```bash
node --test scripts/cookbook-artifact-tools.test.mjs
```

- [ ] **Step 3: Implement explicit-path, explicit-hash tools**

Do not default to `~/tt3p/vault/nntn`. Require `--v4-path`, `--v4-sha256`, `--v5-path`, `--v5-sha256` and explicit target environment. Refuse production unless an additional typed confirmation flag matches the target name

- [ ] **Step 4: Add a no-dual-write runbook**

Document: freeze editing window, export local V5, import staging, compare hashes, rehearse rollback, obtain deployment approval, switch one writer, verify, and only then retire local write path

- [ ] **Step 5: Run GREEN against isolated data**

```bash
node --test scripts/cookbook-artifact-tools.test.mjs
```

- [ ] **Step 6: Checkpoint**

Report isolated import/export SHA evidence. Do not point tools at real V5 until TINE separately authorizes migration rehearsal

---

### Task 9: Add the Machine-Checkable Recipe Completeness Gate

**Files:**
- Create: `scripts/check-phase1-readiness.mjs`
- Create: `scripts/check-phase1-readiness.test.mjs`
- Modify: `package.json`
- Modify: `docs/RUNBOOK-PHASE-1.md`

**Interfaces:**
- Consumes: exported `v5-current` exact JSON document
- Produces: exit 0 only when the recipe-data part of Phase 1 is complete

- [ ] **Step 1: Write failing fixture tests**

The checker must fail with named counts for:

- recipe count not 18;
- item count not 126;
- unresolved decision/provenance greater than 0;
- unresolved blocker greater than 0;
- canonical DRAFT recipe greater than 0;
- missing method without resolved owner N/A;
- empty `yield_candidate_text`

- [ ] **Step 2: Run RED**

```bash
node --test scripts/check-phase1-readiness.test.mjs
```

- [ ] **Step 3: Implement read-only derivation**

Reuse `parseKitchenSotDocument()` and `isKitchenSotRecipeDraft()`. Do not hardcode recipe IDs or rewrite the document

- [ ] **Step 4: Run GREEN on test fixtures**

```bash
node --test scripts/check-phase1-readiness.test.mjs
```

- [ ] **Step 5: Run read-only against a real V5 export**

Expected before TINE fills remaining methods/yields: non-zero exit with exact missing counts. Do not change V5 from this script

- [ ] **Step 6: TINE completes recipe data through Recipe Studio**

TINE enters methods/yields and resolves blockers through the owner UI. After every save, verify V4 5/5, V5 SHA receipt and low-noise diff. The implementation agent does not invent kitchen facts

- [ ] **Step 7: Prove data completeness**

Run:

```bash
npm run check:phase1-readiness -- \
  --input node_modules/.cache/phase1-evidence/v5-current.json
```

Expected: exit 0 with `18 recipes`, `126 items`, `18 READY`, `0 unresolved decisions`, `0 unresolved blockers`, `0 missing yields`

- [ ] **Step 8: Checkpoint**

Save the checker output and export SHA in the acceptance evidence directory

---

### Task 10: Run Staging Security, Concurrency and Recovery Gates

**Files:**
- Create: `tests/cookbook-managed-security.spec.ts`
- Create: `tests/cookbook-managed-recovery.spec.ts`
- Modify: `docs/RUNBOOK-PHASE-1.md`
- Create runtime evidence outside git: `node_modules/.cache/phase1-evidence/`

**Interfaces:**
- Consumes: isolated staging resources explicitly authorized under D9
- Produces: security, CAS, restore, outage and isolation evidence

- [ ] **Step 1: Create staging only after explicit resource approval**

Use dedicated Cookbook names/account. Before migration, verify resource IDs contain no Stock project ID and bindings contain no Stock credentials

- [ ] **Step 2: Import verified copies**

Import exact V4/V5 copies with the Task 8 tool. Compare downloaded bytes and SHA immediately

- [ ] **Step 3: Test the two surfaces**

Owner: TINE identity may GET/PUT. Kitchen: D13-approved device session may GET; source-review route absent; PUT returns 405. Unauthenticated/expired access follows accepted D13 behavior

- [ ] **Step 4: Test concurrency**

Open two owner contexts from one base. Save different isolated fields. Assert first success, second `409 STALE_DRAFT`, and first stored bytes remain authoritative

- [ ] **Step 5: Test V4 immutability**

Attempt every exposed method/path variation against V4. Assert no write/delete route and exact SHA unchanged

- [ ] **Step 6: Test backup/restore**

Export V5 SHA A, save an isolated change producing SHA B, restore A through the authorized operator path, and verify exact bytes A. Never run this against production

- [ ] **Step 7: Test D10 outage behavior**

Disable gateway access in staging. Assert app fails closed with the accepted Thai message, does not show fixture data and does not allow edits. Verify printed fallback runbook is usable

- [ ] **Step 8: Scan network boundaries**

Capture browser and Worker logs. Fail if any request reaches Stock V1/V2, production Supabase, analytics, CDN media or unapproved domains

- [ ] **Step 9: Checkpoint**

Save sanitized request/status/hash evidence. Do not include recipe document bodies in logs

---

### Task 11: Run Full Automated and Actual-App PDF Gates

**Files:**
- Modify only if a genuine product defect is found: existing source/tests in scope
- Evidence outside git: `node_modules/.cache/phase1-evidence/automated/`

**Interfaces:**
- Consumes: staging managed V5 and complete Phase-1 data
- Produces: full regression evidence and exact PDF geometry evidence

- [ ] **Step 1: Run the sequential code gate**

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

Expected: every command exit 0; record fresh counts

- [ ] **Step 2: Run managed owner/kitchen E2E**

```bash
npx playwright test \
  tests/cookbook-managed-owner.spec.ts \
  tests/cookbook-managed-kitchen.spec.ts \
  tests/cookbook-managed-security.spec.ts \
  tests/cookbook-managed-recovery.spec.ts
```

- [ ] **Step 3: Re-run actual-App Work/Print regressions**

Verify recipe 2 operational note, recipe 159 serving without cost basis, recipe 156 removed dependency exclusion, recipe 157 retained dependency and methodless/N/A DRAFT behavior until data gate passes

- [ ] **Step 4: Generate actual PDFs**

For A5 and A4, assert DOM sheet count equals PDF MediaBox count, every MediaBox has expected dimensions, no blank tail, no clipping and no app/session UI

- [ ] **Step 5: Re-check source artifacts**

Verify managed V4 SHA and local frozen V4 5/5. Verify staging V5 SHA equals the accepted migrated artifact except for owner edits explicitly recorded during staging

- [ ] **Step 6: Checkpoint**

Independent verifier reviews raw logs and artifact hashes before physical device testing

---

### Task 12: Complete Actual Mobile and Physical A5 Acceptance

**Files:**
- Create after D12 is accepted: `docs/PHASE-1-ACTUAL-DEVICE-ACCEPTANCE.md`
- Evidence outside git: `node_modules/.cache/phase1-evidence/devices/`

**Interfaces:**
- Consumes: D12 inventory, accepted D13 lifetime/renewal, staging owner/kitchen URLs and complete data
- Produces: named-device and named-printer acceptance evidence

- [ ] **Step 1: Record exact inventory**

Record device make/model, OS version, Chrome version, viewport/orientation, printer make/model, driver/firmware, paper size and scaling setting. “Mobile passed” without this inventory is invalid

- [ ] **Step 2: Provision the accepted kitchen-device session**

Provision only the D13-approved device session. Staff do not receive owner credentials. Record its configured lifetime, renewal trigger, renewal owner and revocation path

- [ ] **Step 3: Prove unattended expiry and renewal**

Force or wait for one staging expiry cycle using the same renewal mechanism accepted for production. With TINE unavailable and without owner OTP/remote login, verify the kitchen device regains or retains GET access and still cannot PUT. A test that runs only before expiry is insufficient

- [ ] **Step 4: Run the kitchen task script**

On the real device:

1. find a sellable menu;
2. open Work by stage;
3. inspect dependency documents;
4. select and print an A5 pack;
5. confirm no Recipe Studio navigation;
6. attempt the owner URL and confirm the accepted access result

- [ ] **Step 5: Print physical A5**

Print the accepted long/blocker-heavy, dependency-pack, single-sheet and odd-tail cases. Inspect every page for Thai glyphs, clipping, blank tail, order, margins and station usability

- [ ] **Step 6: Record operational sign-off**

TINE signs the exact printer/device matrix and any rejected cases. A screenshot or PDF alone does not substitute for physical print evidence

- [ ] **Step 7: Checkpoint**

If any case fails, return to the smallest owning task and rerun all dependent gates. Do not broaden into redesign unless TINE explicitly changes scope

---

### Task 13: Stage, Review and Request Separate Deployment Approval

**Files:**
- Modify: `docs/RUNBOOK-PHASE-1.md`
- Modify: `docs/PHASE-1-ACTUAL-DEVICE-ACCEPTANCE.md`
- Create: `docs/PHASE-1-RELEASE-EVIDENCE.md`
- Modify only after GO: `docs/HANDOFF.md`

**Interfaces:**
- Consumes: all automated, data, security, recovery, device and physical-print gates
- Produces: independent GO/NO-GO record and a separate deployment approval request

- [ ] **Step 1: Assemble the evidence index**

Include commit/tree IDs, provider resource IDs, build hashes, V4/V5 hashes, test counts, CAS evidence, restore evidence, D13 lifetime/expiry/renewal evidence, device inventory, printer evidence and known limitations. Link artifacts without copying recipe bodies into logs

- [ ] **Step 2: Run independent verification**

Verifier must have not authored the managed adapter. They rerun critical gates against the exact staging artifact and return APPROVED or CHANGES

- [ ] **Step 3: Demo both surfaces to TINE**

Show owner save/reload/stale behavior and kitchen read/print/no-write behavior. Show outage and rollback procedure

- [ ] **Step 4: Request deployment approval separately**

The request names exact build SHA, V5 SHA, target resources, rollback artifact and rollout time. Previous design/coding approval does not count

- [ ] **Step 5: Deploy only after explicit approval**

Use single-writer cutover from the runbook. No dual-write. Verify live hashes and routes immediately

- [ ] **Step 6: Phase-1 smoke and rollback decision**

Run owner load/save and kitchen read/print smoke on live. If any invariant fails, execute rollback immediately and mark NO-GO

- [ ] **Step 7: Update HANDOFF only after verified GO**

Record that Phase 1 permits kitchen read/print only. Explicitly list revision, edit ops and staff permissions as Phase 2 and not implemented

## Phase 2 Exclusion Ledger

The following are intentionally absent from every Phase-1 task:

- staff accounts or self-service login;
- role/permission schema;
- revision browser, restore-by-user or audit UI;
- add/remove/rename ingredient lines;
- add/remove recipes;
- dependency editor;
- per-recipe merge or offline editing;
- food-cost workflow

Any request for these items stops this plan and opens a separate Phase-2 design
