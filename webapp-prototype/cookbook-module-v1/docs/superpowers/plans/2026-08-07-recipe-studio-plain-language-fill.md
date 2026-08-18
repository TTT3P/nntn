# Recipe Studio Plain-Language Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace schema-oriented ingredient-card copy with one clear kitchen question and move optional/technical fields behind an accessible disclosure.

**Architecture:** Keep `ItemEditor` state and all existing `KitchenSotEdit` dispatches unchanged. Change only JSX grouping, user-facing copy, accessible labels, and route-scoped CSS. Use native `details`/`summary` so the optional area is closed by default without new state or dependencies.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library.

## Global Constraints

- Cookbook Module V1 local pilot only.
- The primary visible question is `ทีมครัวใช้ {ชื่อวัตถุดิบ} เท่าไร? (ต้องกรอก)`.
- Preserve raw values and every existing `KitchenSotEdit` payload.
- Preserve blur-to-commit, validation, readiness, blocker, concurrency, middleware, V4, and V5 behavior.
- Do not redesign method, yield, blocker, Print Center, or Work-stage surfaces.
- Do not touch Stock V1/V2, Supabase, authentication, production data, deployment, MAW, or CROO.
- Do not add dependencies.
- Do not commit unless TINE gives a direct commit instruction.

---

### Task 1: Make the ingredient card understandable by default

**Files:**
- Modify: `src/features/review/KitchenSotFillSurface.test.tsx`
- Modify: `src/features/review/KitchenSotFillSurface.tsx`
- Modify: `src/features/review/recipe-studio.css`

**Interfaces:**
- Consumes: current `ItemEditor` props and `item-owner-confirmation`, `item-serving-note`, and `item-cost-basis` edit variants.
- Produces: one always-visible primary input and one native optional disclosure; edit payloads remain byte-equivalent for the same values.

- [ ] **Step 1: Write the failing plain-language test**

Render the real fixture and assert the default card shows the user question but hides optional and technical copy:

```tsx
const item = document.recipes[0]!.items[0]!;
const question = await screen.findByLabelText(`ทีมครัวใช้ ${item.item_name} เท่าไร? (ต้องกรอก)`);
expect(question).toBeVisible();
const card = question.closest("fieldset")!;
expect(within(card).getByText(/ตอนนี้ใช้:/u)).toBeVisible();
expect(within(card).getByText("ตัวเลือกเพิ่มเติม (ไม่บังคับ)")).toBeVisible();
expect(within(card).queryByLabelText("ปริมาณตอนเสิร์ฟ (ไม่บังคับ)")).not.toBeVisible();
expect(within(card).queryByLabelText("ปริมาณสำหรับคิดต้นทุน (ไม่บังคับ)")).not.toBeVisible();
expect(within(card).queryByText(/ค่าหน้าครัว|ฐานต้นทุน|สถานะการตัดสินใจ/u)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run RED**

```bash
./node_modules/.bin/vitest run src/features/review/KitchenSotFillSurface.test.tsx --pool=threads
```

Expected: the new label and disclosure assertions fail while existing V5 tests remain green.

- [ ] **Step 3: Implement the minimal JSX regrouping**

Keep the existing primary input handler unchanged. Replace its label and error text, then wrap the existing source-evidence `dl` and the two optional field labels between these exact tags:

```tsx
<details className="recipe-studio__optional-fields">
  <summary>ตัวเลือกเพิ่มเติม (ไม่บังคับ)</summary>
  <div className="recipe-studio__optional-content">
    <p>กรอกส่วนนี้เฉพาะเมื่อปริมาณตอนเสิร์ฟหรือปริมาณที่ใช้คิดต้นทุนต่างจากคำตอบด้านบน</p>
  </div>
</details>
```

Move the existing `dl` and serving/cost labels inside `recipe-studio__optional-content`, after its explanation paragraph and before its closing `div`. Use these exact user-facing labels and helper text:

```text
ตอนนี้ใช้: {candidate_text หรือ "ยังรอคำตอบ"}
ทีมครัวใช้ {item_name} เท่าไร? (ต้องกรอก)
ตัวอย่าง: 30 กรัมต่อจาน · 1 ทัพพี · ครึ่งช้อนโต๊ะ
ปริมาณตอนเสิร์ฟ (ไม่บังคับ)
กรอกเมื่อปริมาณที่เสิร์ฟต่างจากคำตอบหลัก
ปริมาณสำหรับคิดต้นทุน (ไม่บังคับ)
กรอกเมื่อปริมาณที่ใช้คิดต้นทุนต่างจากคำตอบหลัก
```

Replace the empty-primary error with `กรอกปริมาณที่ทีมครัวใช้ก่อน ระบบคืนค่าเดิมให้แล้ว` and the provenance warning with `ยังรอคำตอบจากทีมครัว`.

- [ ] **Step 4: Style the primary path and disclosure**

Make the primary question full-width and visually dominant. Keep `details` full-width, use a clear focus ring on `summary`, and lay optional fields out in two columns only when open and space permits. Do not hide content with CSS selectors that remove it from assistive technology after the disclosure is opened.

- [ ] **Step 5: Run GREEN and payload regressions**

```bash
./node_modules/.bin/vitest run src/features/review/KitchenSotFillSurface.test.tsx src/domain/sot/kitchenSotEdits.test.ts src/domain/sot/kitchenSotValidation.test.ts --pool=threads
```

Expected: all copy/disclosure assertions and all existing edit-payload tests pass.

### Task 2: Verify the integrated local pilot safely

**Files:**
- Modify: `docs/HANDOFF.md` only if all available gates pass and the remaining Chrome environment gap is stated accurately.

**Interfaces:**
- Consumes: the completed plain-language item card.
- Produces: fresh static and safety evidence without creating the real V5 draft.

- [ ] **Step 1: Run static gates sequentially**

```bash
./node_modules/.bin/vitest run --pool=threads
./node_modules/.bin/eslint .
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/vite build
/opt/homebrew/bin/git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Re-run the local layout gate once if Chrome launches**

```bash
./node_modules/.bin/playwright test --config playwright.local.config.ts tests/recipe-studio-layout.local.ts --workers=1
```

Expected product result: pass. If system Chrome exits `SIGABRT` before page creation, report it as the existing environment-only gap and do not alter product code or claim the browser pack passed.

- [ ] **Step 3: Verify immutable source safety**

Confirm the frozen V4 SHA-256 remains `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`, the real V5 draft path is absent, and the diff contains no Stock, Supabase, auth, production, or deployment files.

- [ ] **Step 4: Leave the isolated dev server available for operator review**

Run the app against `node_modules/.cache/cookbook-v5-e2e-vault` only. The review URL is `http://127.0.0.1:5173/nntn-cookbook/#/source-review`. Do not point the review server at the real vault.
