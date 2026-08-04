# Architecture — Static Recipe Studio Prototype

## Runtime Shape

```text
index.html
├── Recipe Editor workspace
│   ├── SOP form
│   ├── Recipe Variant editor
│   ├── Food Cost Preview
│   ├── Measurement Knowledge summary
│   └── Print Center launcher
├── Branch Menu workspace
│   ├── Company/Brand/Branch context
│   ├── Menu Set + Menu Catalog
│   ├── Dependency Preview
│   ├── Branch Readiness
│   └── Rollout table
└── Print Center modal

styles.css
├── NNTN-derived local palette
├── Responsive application UI
├── Branch/Menu components
└── @media print + named A4/A5 pages

recipe-variants.js
├── Variant normalization
└── Base Recipe + Variant composition

app.js
├── Mock data registries
├── Recipe form interactions
├── Measurement/cost normalization
├── Print renderers
└── Branch menu/dependency/readiness state
```

ไม่มี framework, bundler, dependency, storage หรือ network layer

## File Structure

```text
webapp-prototype/
├── AGENTS.md
├── README.md
├── index.html
├── styles.css
├── app.js
├── recipe-variants.js
├── tests/
│   └── recipe-variants.test.js
├── docs/
│   ├── PRD-MVP.md
│   ├── ARCHITECTURE.md
│   ├── HANDOFF.md
│   ├── 2026-08-03-recipe-variants-design.md
│   └── 2026-08-03-recipe-variants-plan.md
└── preview-*.png
```

## Mock Data Registries in `app.js`

- `historyEntries` — revision timeline
- `sampleRecipes` — print examples
- `measurementKnowledge` — ingredient-specific conversion profiles
- `recipeDependencies` — Master/Sub-recipe/Prep/Packaging dependencies
- `branchMenuItems` — sellable Menu Items
- `branchMenuSets` — Full/Express/Delivery presets
- `branchProfiles` — branch format/equipment/readiness examples

## Important UI Boundaries

### Workspaces

- `#recipe-workspace`
- `#branch-workspace`
- `.workspace-tab[data-workspace-target]`

`switchWorkspace()` owns visibility and tab state

### Measurement and Food Cost

- `#ingredient-list` — SOP inputs
- `#cost-knowledge-body` — normalized output
- `#knowledge-detail` — formula/provenance detail

Key functions:

- `findMeasurementProfile()`
- `normalizeIngredientWeight()`
- `renderCostKnowledge()`
- `renderKnowledgeSummary()`

Resolution behavior:

```text
g/kg → direct mass conversion
other units → exact ingredient/profile lookup
missing profile/unit → no normalized value
```

### Recipe Variants

- `#variant-list` — Variant cards
- `#variant-template` — ชื่อ ราคา active state และ SOP note
- `#variant-part-template` — nested meat/part row
- `#cost-variant-select` — เลือก Variant สำหรับ normalized weight preview
- `input[name="recipe-mode"]` — explicit single/variant mode
- `#single-menu-meta` — metadata/routing ของเมนูเดี่ยว
- `.variant-status` — draft/active/inactive state
- `.variant-metadata` — SKU, station, branch และ channel mapping ต่อ Variant

Pure domain helpers ใน `recipe-variants.js`:

- `normalizeVariants(variants)` — clean/filter rows โดยรักษาหลาย part ต่อ Variant
- `buildVariantRecipes(baseRecipe, variants, { mode })` — สร้าง printable recipes ตาม explicit menu mode และรับเฉพาะ active Variant
- `suggestSku(recipeCode, variantCode)` — สร้าง Internal SKU ตัวอย่างจากรหัสที่ผู้ใช้กำหนด

DOM state/functions ใน `app.js`:

- `variantRowsFromForm()`
- `addVariant()` / `addVariantPart()`
- `syncVariantConsumers()`
- `costIngredientsFromForm()`
- `applyRecipeMode()`
- `currentSingleSellable()`

โหมด `single` คืนสูตรแม่หนึ่งรายการ โหมด `variant` คืนเฉพาะ active Variant และคืนรายการว่างเมื่อไม่มี active Variant เพื่อไม่ตีความสูตรแม่เป็นเมนูขายโดยอัตโนมัติ

### Print Center

- `#print-modal`
- `#print-document`
- `#print-recipe-picker`

Renderers:

- `masterSheet()`
- `kitchenSheet()`
- `bookletCover()` / `bookletToc()` / `bookletRecipeSheet()`
- `routingSheet()`

Print isolation uses `body.printing` and `@media print`; direct Ctrl+P outside Print Center does not force the hidden modal

### Branch Menu

- `#menu-catalog`
- `#dependency-groups`
- `#readiness-checks`

State:

- `selectedBranchMenuIds`

Key functions:

- `applyBranchMenuSet()`
- `selectedBranchMenus()`
- `requiredDependencies()`
- `renderMenuCatalog()`
- `renderBranchSummary()`
- `renderReadiness()`

Dependency union is computed from selected Menu Item IDs and de-duplicated with a `Set`

## Security/Integrity Notes

- Prototype has no auth because it has no persistence or backend
- User-entered recipe values rendered into preview use `escapeHtml()`
- Variant name, ingredients, price และ note ผ่าน model แล้ว escape เมื่อ render ใน Print Center
- Runtime source must remain free of Supabase, `fetch`, XHR and WebSocket
- Mock measurement values must never be described as production truth
- Branch data is illustrative and must not be interpreted as live rollout state

## Responsive Notes

- Desktop uses two-column Recipe/Sidebar and Branch/Main+Readiness layouts
- Below 940px branch sidebar becomes non-sticky
- Below 680px grids collapse to one column
- Wide cost/rollout tables scroll inside their wrappers
- `.recipe-form`, `.panel` and branch columns use `min-width: 0` to prevent body overflow

## Future Extraction Boundary

หากพัฒนา production app ในอนาคต ให้แยก mock registries เป็น domain modules/API contracts โดยรักษา interface ทางแนวคิดเดิม:

```text
RecipeRepository
MeasurementKnowledgeRepository
MenuCatalogRepository
BranchAssignmentRepository
PrintViewModelBuilder
```

อย่าเชื่อม production database เข้ากับไฟล์ prototype โดยตรง
