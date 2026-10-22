# Wide Source Review Layout Design

## Goal

Use wide desktop space more effectively in the `ตรวจต้นฉบับ` workspace without making the editor hard to scan or breaking the existing tablet and mobile layouts.

## Design

- Increase the shared application content ceiling from 1320px to 1680px.
- Keep the content centered with a 20px minimum side gutter.
- Align the site header content to the same 1680px ceiling.
- Preserve the two-panel Source Review layout on wide and medium desktop screens.
- Keep filter controls responsive to the queue panel itself: four columns when the panel is wide enough, two columns when constrained, and one column on narrow screens.
- Preserve the existing single-column workspace below the current 980px viewport breakpoint.

## Acceptance checks

- At a 2048px viewport, the content shell is 1680px wide and centered.
- At a 1280px viewport, filter fields stay inside the queue panel and do not overlap the detail panel.
- At a 390px viewport, the page has no horizontal body overflow.
- Existing JavaScript tests and syntax checks continue to pass.

## Scope

CSS layout only. No recipe data, unit handling, Supabase, persistence, or production deployment changes.
