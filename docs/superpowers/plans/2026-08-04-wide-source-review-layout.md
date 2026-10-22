# Wide Source Review Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the desktop Recipe Studio workspace to 1680px while keeping Source Review filters contained at desktop, tablet, and mobile widths.

**Architecture:** Keep the existing shared page shell and two-panel Source Review structure. Change only CSS sizing and container-query thresholds, then verify the layout through browser bounding-box assertions at 2048px, 1280px, and 390px.

**Tech Stack:** Static HTML, CSS container queries, Playwright browser smoke checks, Node.js tests.

## Global Constraints

- Maximum content width is 1680px with at least 20px viewport gutters.
- Source Review remains two columns above the existing 980px viewport breakpoint.
- Filter fields use four columns when their panel is wide enough, two columns when constrained, and one column when narrow.
- No recipe data, unit conversion, persistence, Supabase, or production changes.

---

### Task 1: Expand and verify the responsive workspace

**Files:**
- Modify: `webapp-prototype/styles.css`
- Test: browser DOM measurements against `webapp-prototype/index.html`

**Interfaces:**
- Consumes: `.site-header`, `.page-shell`, `.import-queue-panel`, `.import-filter-grid`, and existing 980px viewport breakpoint.
- Produces: a centered 1680px desktop shell and contained filter layouts at all supported widths.

- [ ] **Step 1: Record the current failing browser measurement**

At viewport 2048×1120, assert that `.page-shell` is currently 1320px rather than 1680px. At viewport 1280×900, retain the existing assertion that the filter fields do not cross `.import-queue-panel` or `.import-detail-panel`.

- [ ] **Step 2: Implement the minimal CSS change**

Update the shared header alignment and page shell:

```css
.site-header {
  padding-inline: max(24px, calc((100vw - 1680px) / 2));
}

.page-shell {
  width: min(1680px, calc(100% - 40px));
}
```

Allow a four-column filter row in a wider queue panel and retain contained fallbacks:

```css
.import-filter-grid {
  grid-template-columns: minmax(170px, 1fr) 130px 120px 150px;
}

@container import-queue (max-width: 620px) {
  .import-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container import-queue (max-width: 420px) {
  .import-filter-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Run browser layout verification**

- At 2048×1120: `.page-shell` width equals 1680px and left/right gutters are equal.
- At 1280×900: filter fields do not overflow the queue panel or overlap the detail panel.
- At 390×844: `document.body.scrollWidth <= window.innerWidth`.
- Browser console reports zero errors and zero warnings.

- [ ] **Step 4: Run repository verification**

Run:

```bash
node --check webapp-prototype/app.js
node --check webapp-prototype/import-review-ui.js
node --check webapp-prototype/kitchen-sot.js
node --test webapp-prototype/tests/*.test.js
git diff --check
```

Expected: all 29 tests pass, syntax checks exit successfully, and `git diff --check` is clean.

- [ ] **Step 5: Commit**

```bash
git add webapp-prototype/styles.css
git commit -m "fix: expand responsive recipe workspace"
```
