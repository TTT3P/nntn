# Recipe Workstage Editor Handoff

Date: 2026-08-11
Status: Verified complete

## Authoritative data boundary

Cookbook V6 `workDocuments` remains the only source of truth for ingredient and method-step membership in Prep, Cook, and Service. Recipe Editor controls submit narrow V6 edits; Work and Print Center project the saved document. No parallel station state or schema field was added.

The verification used only the disposable V6 vault under `node_modules/.cache/cookbook-v6-e2e-vault`. It did not write real V4, V5, or V6.

## Tracer-bullet operation

The browser regression opens `RCP-021` (`ข้าวขยำเนื้อแดดเดียว`) in Recipe Editor and performs one exact edit:

- ingredient line `เนื้อแดดเดียว`: Cook + Service → Prep + Service;
- existing first method step `ก่อนแพ็ค ตัดเนื้อให้เป็นชิ้นพอดีคำ ความยาวประมาณ 1.5 นิ้ว`: Cook → Service.

The test saves through the UI, reloads Recipe Editor, and verifies the persisted checkbox/select values. It then proves the saved projection on both downstream surfaces:

- Prep Work and Print contain the ingredient but not the moved step;
- Cook Work and Print contain neither the ingredient nor the moved step;
- Service Work and Print contain both the ingredient and the moved step.

Print Center is exercised through its visible recipe search, recipe checkbox, advanced disclosure, and `จุดงานที่จะพิมพ์` filter.

## Layout and accessibility evidence

Recipe Editor was verified at the default desktop viewport and at 430 × 932. Both widths satisfy `documentElement.scrollWidth === documentElement.clientWidth`. Every ingredient-stage checkbox label and method-stage select measured at least 44 × 44 CSS pixels.

## RED and GREEN evidence

Task 5 is post-implementation integration coverage. Its new E2E passed once its printed ingredient locator was correctly scoped to the accessible row header; no pre-feature E2E RED was fabricated.

The genuine behavior RED was captured during Task 3 before implementation:

- `RecipeEditor.test.tsx`: 2 new behavior tests failed and 11 existing tests passed;
- the missing category/workstage helper and missing `จุดงานของขั้นตอน ขั้นตอน 1` control caused the failures.

Fresh Task 5 GREEN evidence:

- isolated V6 persistence: 2 passed, including edit → save → reload → Work/Print;
- product browser tests: 6 passed, including desktop/430px overflow and target-size checks;
- full sequential gate: 58 Vitest files / 1,106 tests, 33 default Playwright tests, 3 isolated V5 tests, and 2 isolated V6 tests all passed.

The first shell-launched Chrome attempt failed before test execution with Chrome `SIGABRT` and an `EPERM` cleanup error. The authorized managed BrowserServer initially reported server v1.63/client v1.62 mismatch. Browser gates then ran through a temporary compatible `@playwright/test@1.63.0-alpha-2026-08-11` client, after which the declared `@playwright/test@1.62.1` was restored. `package.json` and `package-lock.json` remained byte-identical.

## Immutable-source receipts

- V4 `SHA256SUMS.txt`: 5/5 entries OK.
- Real V5 SHA-256: `9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7`.
- Real V6 SHA-256: `96775abb92580182e4c9b4bb324d199a8bf4bb043b572170e379276119031695`.

## Current limitations and future scope

- `จำนวนรอบการผลิต` remains descriptive for current verbatim quantities; it does not recalculate quantity text automatically.
- Custom Station Master configuration remains future scope.
- Readiness-policy changes remain future scope; missing workstage membership stays visible and does not change current readiness rules.
